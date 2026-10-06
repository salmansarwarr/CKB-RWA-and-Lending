// Release: once the loan is repaid, the RWA asset collateral goes back to the
// borrower and the loan cell is retired.
//
//   npx ts-node lending/scripts/release.ts
//
// Signer: the issuer (vault lock owner); the loan type script forces the asset
// back to the borrower regardless.

import { ccc } from "@ckb-ccc/core";
import {
  borrowerSigner,
  completeAndSend,
  issuerSigner,
  loadEnv,
  lockOf,
  makeClient,
  readDeployment,
} from "../../scripts/lib/common";
import {
  STATE_REPAID,
  addLendingDeps,
  assetType,
  findOne,
  inputOf,
  loadLoanCell,
} from "./lib";

async function main() {
  loadEnv();
  const d = readDeployment();
  const client = makeClient();
  const issuer = issuerSigner(client);
  const borrowerLock = await lockOf(borrowerSigner(client));
  const asset = assetType(d);

  const loanCell = await loadLoanCell(client, d, STATE_REPAID);
  const collateral = await findOne(
    client.findCellsByType(asset, true),
    "RWA asset collateral in the vault",
  );

  const tx = ccc.Transaction.from({
    outputs: [{ lock: borrowerLock, type: asset }],
    outputsData: ["0x"],
  });
  tx.addInput(inputOf(loanCell));
  tx.addInput(inputOf(collateral));
  await addLendingDeps(client, tx, d, { asset: true });
  await tx.completeInputsByCapacity(issuer);

  await completeAndSend(client, tx, issuer, [], "release");
  console.log("collateral returned to the borrower; loan cell retired");
}

main().then(
  () => process.exit(0), // the RPC client would otherwise keep Node alive
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
