// Mocked KYC verification + on-chain attestation write (CKB testnet).
//
// Usage:
//   ISSUER_PRIVATE_KEY=0x... npx ts-node kyc-attestation/scripts/write_attestation.ts <subject-ckt-address>
//
// Attestation cell data layout (41 bytes, all integers little-endian):
//   [0..32)   subject lock hash
//   [32]      status: 0x01 = pass, 0x00 = fail
//   [33..41)  issued-at, u64, unix seconds
//
// The cell sits under the issuer's own lock and has no type script, so only
// the issuer can spend (i.e. revoke) it. The subject cannot.

import { ccc } from "@ckb-ccc/core";

export const STATUS_FAIL = 0;
export const STATUS_PASS = 1;
export type KycStatus = typeof STATUS_FAIL | typeof STATUS_PASS;

export interface Attestation {
  subjectLockHash: string; // 0x-prefixed, 32 bytes
  status: KycStatus;
  issuedAt: bigint; // unix seconds
}

/** Mock for the Sumsub integration: every subject passes. */
export function mockVerify(_subject: ccc.Script): KycStatus {
  return STATUS_PASS;
}

export function encodeAttestation(a: Attestation): string {
  const hash = ccc.bytesFrom(a.subjectLockHash);
  if (hash.length !== 32) throw new Error("subject lock hash must be 32 bytes");
  return ccc.hexFrom(
    ccc.bytesConcat(hash, [a.status], ccc.numLeToBytes(a.issuedAt, 8)),
  );
}

export function decodeAttestation(data: string): Attestation {
  const b = ccc.bytesFrom(data);
  if (b.length !== 41) throw new Error(`bad attestation length ${b.length}`);
  const status = b[32];
  if (status !== STATUS_FAIL && status !== STATUS_PASS) {
    throw new Error(`bad status byte ${status}`);
  }
  return {
    subjectLockHash: ccc.hexFrom(b.slice(0, 32)),
    status,
    issuedAt: ccc.numFrom(ccc.numLeFromBytes(b.slice(33, 41))),
  };
}

/** Builds, signs and sends the tx; returns the tx hash. */
export async function writeAttestation(
  client: ccc.Client,
  issuer: ccc.Signer,
  subject: ccc.Script,
  status: KycStatus,
): Promise<string> {
  const issuerLock = (await issuer.getRecommendedAddressObj()).script;
  const data = encodeAttestation({
    subjectLockHash: subject.hash(),
    status,
    issuedAt: BigInt(Math.floor(Date.now() / 1000)),
  });

  const tx = ccc.Transaction.from({
    outputs: [{ lock: issuerLock }],
    outputsData: [data],
  });
  await tx.completeInputsByCapacity(issuer);
  await tx.completeFeeBy(issuer, 1000);
  return issuer.sendTransaction(tx);
}

async function main() {
  const [subjectAddr] = process.argv.slice(2);
  const key = process.env.ISSUER_PRIVATE_KEY;
  if (!subjectAddr || !key) {
    console.error(
      "usage: ISSUER_PRIVATE_KEY=0x... write_attestation.ts <subject-ckt-address>",
    );
    process.exit(1);
  }

  const client = new ccc.ClientPublicTestnet();
  const issuer = new ccc.SignerCkbPrivateKey(client, key);
  const subject = (await ccc.Address.fromString(subjectAddr, client)).script;

  const status = mockVerify(subject);
  console.log(`mock KYC for ${subjectAddr}: ${status === STATUS_PASS ? "pass" : "fail"}`);

  const txHash = await writeAttestation(client, issuer, subject, status);
  console.log(`attestation tx: ${txHash}`);
  console.log(`https://pudge.explorer.nervos.org/transaction/${txHash}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
