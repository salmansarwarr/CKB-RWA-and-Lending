// Deposit: the borrower locks the RWA asset into the vault and a loan cell is
// created, in one tx, only if a valid KYC attestation is also an input.
//
//   npx ts-node lending/scripts/deposit.ts
//
// Inputs:  borrower's RWA asset cell, the issuer's attestation cell for the
//          borrower (+ issuer cells for capacity).
// Outputs: the asset cell under the vault lock, the new loan cell (state 0),
//          the attestation cell re-created for the issuer.
// Signers: the borrower (asset) and the issuer (attestation, vault).
//
// The vault lock is the issuer's own lock in this demo, so the issuer
// co-signs every loan step. The loan type script (not the lock) is what
// enforces the rules; see docs/lending.md.

import { ccc } from "@ckb-ccc/core";
import { decodeAttestation, STATUS_PASS } from "../../kyc-attestation/scripts/write_attestation";
import {
  borrowerSigner,
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
import {
  STATE_DEPOSITED,
  addLendingDeps,
  assetType,
  encodeLoanArgs,
  encodeLoanData,
  findOne,
  inputOf,
  loanTokenType,
  termsFromEnv,
} from "./lib";

async function main() {
  loadEnv();
  const d = readDeployment();
  if (d.loan && !process.argv.includes("--force")) {
    throw new Error("a loan is already recorded (see deployment.testnet.json); pass --force to start another");
  }
  const lendingContract = requireContract(d, "lending");
  const client = makeClient();
  const issuer = issuerSigner(client);
  const borrower = borrowerSigner(client);
  const issuerLock = await lockOf(issuer);
  const borrowerLock = await lockOf(borrower);
  const borrowerHash = borrowerLock.hash();
  const asset = assetType(d);

  const assetCell = await findOne(
    client.findCellsByLock(borrowerLock, asset, true),
    "RWA asset cell owned by the borrower",
  );
  const attestationCell = await findOne(
    attestationsFor(client, issuerLock, borrowerHash),
    "passing KYC attestation for the borrower (run kyc-attestation/scripts/write_attestation.ts)",
  );

  const terms = termsFromEnv();
  const token = await loanTokenType(client, issuerLock.hash());
  const loanTypeScript = ccc.Script.from({
    codeHash: lendingContract.codeHash,
    hashType: lendingContract.hashType,
    args: encodeLoanArgs(issuerLock.hash(), asset.hash(), token.hash(), terms),
  });

  const tx = ccc.Transaction.from({
    outputs: [
      { lock: issuerLock, type: asset }, // collateral, now held by the vault
      { lock: issuerLock, type: loanTypeScript }, // the loan cell
      { lock: issuerLock }, // attestation, kept alive
    ],
    outputsData: [
      "0x",
      encodeLoanData(borrowerHash, STATE_DEPOSITED),
      attestationCell.outputData,
    ],
  });
  tx.addInput(inputOf(assetCell));
  tx.addInput(inputOf(attestationCell));
  await addLendingDeps(client, tx, d, { asset: true });
  await tx.completeInputsByCapacity(issuer);

  await completeAndSend(client, tx, issuer, [borrower], "deposit");
  updateDeployment({ loan: { typeScript: scriptToJson(loanTypeScript), terms } });
  console.log(
    `loan: borrow ${terms.loanAmount}, repay ${terms.repayAmount} by ${new Date(terms.deadline * 1000).toISOString()}`,
  );
}

/** Live attestation cells under `issuerLock` that pass for `subjectLockHash`. */
async function* attestationsFor(
  client: ccc.Client,
  issuerLock: ccc.Script,
  subjectLockHash: string,
): AsyncGenerator<ccc.Cell> {
  for await (const cell of client.findCellsByLock(issuerLock, null, true)) {
    if (cell.cellOutput.type || ccc.bytesFrom(cell.outputData).length !== 41) continue;
    const a = decodeAttestation(cell.outputData);
    if (a.subjectLockHash === subjectLockHash && a.status === STATUS_PASS) yield cell;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
