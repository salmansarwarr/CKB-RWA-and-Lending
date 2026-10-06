// Issues the demo RWA asset on CKB testnet as one unique Type-ID cell, owned
// by the borrower.
//
//   npx ts-node asset/scripts/issue_asset.ts [--force]
//
// The type script args are blake2b(first tx input | output index 0), so the
// asset cell must be output 0 and the issuer's first input is fixed before the
// args are computed. The asset is a demo reference claim, not a custodied or
// legally binding instrument (see metadata/asset.json).

import { ccc } from "@ckb-ccc/core";
import {
  borrowerSigner,
  cellDepOf,
  completeAndSend,
  issuerSigner,
  loadEnv,
  lockOf,
  makeClient,
  readDeployment,
  requireContract,
  scriptToJson,
  updateDeployment,
} from "../../scripts/lib/common";

async function main() {
  loadEnv();
  const deployment = readDeployment();
  if (deployment.asset && !process.argv.includes("--force")) {
    throw new Error("asset already issued (see deployment.testnet.json); pass --force to issue another");
  }
  const contract = requireContract(deployment, "asset");

  const client = makeClient();
  const issuer = issuerSigner(client);
  const borrowerLock = await lockOf(borrowerSigner(client));

  // Placeholder args of the right size: the real ones depend on the inputs.
  const placeholder = ccc.Script.from({
    codeHash: contract.codeHash,
    hashType: contract.hashType,
    args: "0x" + "00".repeat(32),
  });
  const tx = ccc.Transaction.from({
    cellDeps: [cellDepOf(contract)],
    outputs: [{ lock: borrowerLock, type: placeholder }],
    outputsData: ["0x"],
  });
  await tx.completeInputsByCapacity(issuer);

  const typeScript = ccc.Script.from({
    ...placeholder,
    args: ccc.hashTypeId(tx.inputs[0], 0),
  });
  tx.outputs[0].type = typeScript;

  await completeAndSend(client, tx, issuer, [], "issue_asset");
  updateDeployment({ asset: { typeScript: scriptToJson(typeScript) } });
  console.log(`asset type script args (Type ID): ${typeScript.args}`);
  console.log(`asset type hash: ${typeScript.hash()}`);
}

main().then(
  () => process.exit(0), // the RPC client would otherwise keep Node alive
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
