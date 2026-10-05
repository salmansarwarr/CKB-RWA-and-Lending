// Shared helpers for the testnet scripts: env loading, client/signers,
// multi-signer tx completion, and the deployment record
// (scripts/deploy/deployment.testnet.json — public data only, no secrets).

import { ccc } from "@ckb-ccc/core";
import * as fs from "fs";
import * as path from "path";

export const ROOT = path.resolve(__dirname, "../..");
export const BINARY_DIR = path.join(
  ROOT,
  "target/riscv64imac-unknown-none-elf/release",
);
export const DEPLOYMENT_FILE = path.join(
  ROOT,
  "scripts/deploy/deployment.testnet.json",
);
export const EXPLORER = "https://pudge.explorer.nervos.org";

// 2x the 1000 shannons/KB minimum, as headroom for witnesses that are only
// filled in when a co-signer signs.
const FEE_RATE = 2000;
const SECP_SIGNATURE_LEN = 65;

/** Minimal .env loader (KEY=VALUE lines); real environment variables win. */
export function loadEnv(file = path.join(ROOT, ".env")): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name} (see .env.example)`);
  return v;
}

export function makeClient(): ccc.Client {
  const network = process.env.CKB_NETWORK ?? "testnet";
  if (network !== "testnet") {
    throw new Error(`only testnet is supported, got CKB_NETWORK=${network}`);
  }
  const url = process.env.CKB_RPC_URL;
  return new ccc.ClientPublicTestnet(url ? { url } : undefined);
}

/** Issuer / lender / vault owner. */
export function issuerSigner(client: ccc.Client): ccc.SignerCkbPrivateKey {
  return new ccc.SignerCkbPrivateKey(client, requireEnv("PRIVATE_KEY"));
}

/** The borrower: owns the RWA asset and repays the loan. */
export function borrowerSigner(client: ccc.Client): ccc.SignerCkbPrivateKey {
  return new ccc.SignerCkbPrivateKey(client, requireEnv("BORROWER_PRIVATE_KEY"));
}

export async function lockOf(signer: ccc.Signer): Promise<ccc.Script> {
  return (await signer.getRecommendedAddressObj()).script;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/transaction/${hash}`;
}

// ---------------------------------------------------------------------------
// Transactions

/**
 * Completes the fee from `payer` and signs with every distinct signer in
 * `signers` (the payer is always included), sends the tx, waits until it is
 * committed, and records its hash under `step` in the deployment file.
 *
 * Co-signers must each own at least one input, otherwise they have no group
 * to sign.
 */
export async function completeAndSend(
  client: ccc.Client,
  tx: ccc.Transaction,
  payer: ccc.Signer,
  cosigners: ccc.Signer[],
  step: string,
): Promise<string> {
  const signers = await distinctSigners([payer, ...cosigners]);
  // Reserve witness space for co-signers so the fee estimate is not short.
  for (const s of signers) {
    if (s === payer) continue;
    await tx.prepareSighashAllWitness(await lockOf(s), SECP_SIGNATURE_LEN, client);
  }
  await tx.completeFeeBy(payer, FEE_RATE);

  let signed = tx;
  for (const s of signers) signed = await s.signOnlyTransaction(signed);
  const hash = await client.sendTransaction(signed);
  console.log(`${step}: sent ${hash}`);
  await client.waitTransaction(hash, 0, 180_000, 3_000);
  console.log(`${step}: committed ${explorerTx(hash)}`);
  recordTransaction(step, hash);
  return hash;
}

async function distinctSigners(signers: ccc.Signer[]): Promise<ccc.Signer[]> {
  const seen = new Set<string>();
  const out: ccc.Signer[] = [];
  for (const s of signers) {
    const key = (await lockOf(s)).hash();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deployment record

export interface ScriptJson {
  codeHash: string;
  hashType: string;
  args: string;
}

export interface ContractInfo {
  codeHash: string; // blake2b of the binary
  hashType: "data2";
  cellDep: { txHash: string; index: number; depType: "code" };
}

export interface LoanTerms {
  loanAmount: string; // u128, decimal string
  repayAmount: string;
  deadline: number; // unix seconds
}

export interface Deployment {
  network: "testnet";
  contracts: { asset?: ContractInfo; lending?: ContractInfo };
  asset?: { typeScript: ScriptJson };
  loan?: { typeScript: ScriptJson; terms: LoanTerms };
  transactions: Record<string, string>;
}

export function readDeployment(): Deployment {
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    return { network: "testnet", contracts: {}, transactions: {} };
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
}

export function writeDeployment(d: Deployment): void {
  fs.mkdirSync(path.dirname(DEPLOYMENT_FILE), { recursive: true });
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(d, null, 2) + "\n");
}

export function updateDeployment(patch: Partial<Deployment>): Deployment {
  const d = { ...readDeployment(), ...patch };
  writeDeployment(d);
  return d;
}

export function recordTransaction(step: string, hash: string): void {
  const d = readDeployment();
  d.transactions[step] = hash;
  writeDeployment(d);
}

export function requireContract(
  d: Deployment,
  name: "asset" | "lending",
): ContractInfo {
  const c = d.contracts[name];
  if (!c) throw new Error(`${name} contract not deployed: run scripts/deploy/deploy.ts`);
  return c;
}

export function scriptToJson(s: ccc.Script): ScriptJson {
  return { codeHash: s.codeHash, hashType: s.hashType, args: s.args };
}

export function scriptFromJson(j: ScriptJson): ccc.Script {
  return ccc.Script.from(j);
}

export function cellDepOf(c: ContractInfo): ccc.CellDepLike {
  return {
    outPoint: { txHash: c.cellDep.txHash, index: c.cellDep.index },
    depType: c.cellDep.depType,
  };
}

/** u128 little-endian, the sUDT amount encoding. */
export function u128Le(n: bigint): Uint8Array {
  return ccc.numLeToBytes(n, 16);
}
