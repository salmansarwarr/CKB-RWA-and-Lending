// Rebuilds nothing: hashes the locally built contract binaries and compares
// them with the code hashes recorded in deployment.testnet.json, so anyone can
// check that the deployed code is what this repo builds.
//
//   npm run build:contracts && npx ts-node scripts/deploy/verify_code_hashes.ts

import { ccc } from "@ckb-ccc/core";
import * as fs from "fs";
import * as path from "path";
import { BINARY_DIR, readDeployment } from "../lib/common";

const d = readDeployment();
let ok = true;
for (const [name, file] of [
  ["asset", "rwa-asset-type"],
  ["lending", "lending-type"],
] as const) {
  const local = ccc.hashCkb(fs.readFileSync(path.join(BINARY_DIR, file)));
  const recorded = d.contracts[name]?.codeHash;
  const match = local === recorded;
  ok &&= match;
  console.log(`${match ? "MATCH   " : "MISMATCH"} ${name}: built ${local}, recorded ${recorded ?? "(none)"}`);
}
process.exit(ok ? 0 : 1);
