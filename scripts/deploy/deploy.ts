// Deploys the RWA asset and lending contracts to CKB testnet.
//
// Both binaries go into one tx, each as a cell locked by the issuer. The
// scripts are referenced by data hash (hash_type "data2"), so the code hash is
// just the blake2b hash of the binary, and the cell dep is the deployed
// outpoint. The result is recorded in scripts/deploy/deployment.testnet.json.
//
//   npm run build:contracts
//   npx ts-node scripts/deploy/deploy.ts [--force]
//
// Capacity: a code cell needs 1 CKB per byte of data plus overhead, so expect
// to lock roughly 75,000 testnet CKB for the two binaries.

import { ccc } from "@ckb-ccc/core";
import * as fs from "fs";
import * as path from "path";
import {
  BINARY_DIR,
  ContractInfo,
  Deployment,
  completeAndSend,
  issuerSigner,
  loadEnv,
  lockOf,
  makeClient,
  readDeployment,
  updateDeployment,
} from "../lib/common";

const BINARIES = [
  { name: "asset", file: "rwa-asset-type" },
  { name: "lending", file: "lending-type" },
] as const;

async function main() {
  loadEnv();
  const force = process.argv.includes("--force");
  const existing = readDeployment();
  if (!force && Object.keys(existing.contracts).length > 0) {
    throw new Error(
      "contracts already deployed (see deployment.testnet.json); pass --force to redeploy",
    );
  }

  const client = makeClient();
  const issuer = issuerSigner(client);
  const issuerLock = await lockOf(issuer);

  const bins = BINARIES.map((b) => {
    const file = path.join(BINARY_DIR, b.file);
    if (!fs.existsSync(file)) {
      throw new Error(`${file} not found: run \`npm run build:contracts\` first`);
    }
    return { ...b, data: ccc.hexFrom(fs.readFileSync(file)) };
  });

  const tx = ccc.Transaction.from({
    outputs: bins.map(() => ({ lock: issuerLock })),
    outputsData: bins.map((b) => b.data),
  });
  const needed = tx.getOutputsCapacity();
  console.log(
    `locking ${ccc.fixedPointToString(needed)} CKB for ${bins.map((b) => b.name).join(" + ")}`,
  );
  await tx.completeInputsByCapacity(issuer);
  const hash = await completeAndSend(client, tx, issuer, [], "deploy");

  const contracts: Deployment["contracts"] = {};
  bins.forEach((b, index) => {
    const info: ContractInfo = {
      codeHash: ccc.hashCkb(b.data),
      hashType: "data2",
      cellDep: { txHash: hash, index, depType: "code" },
    };
    contracts[b.name] = info;
    console.log(`${b.name}: code_hash ${info.codeHash} (data2), dep ${hash}:${index}`);
  });
  updateDeployment({ contracts });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
