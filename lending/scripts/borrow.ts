// Borrow: releases the fixed loan amount to the borrower and moves the loan
// cell from deposited (0) to borrowed (1).
//
//   npx ts-node lending/scripts/borrow.ts
//
// The loan token is an sUDT whose owner is the issuer, so the issuer mints it
// in this tx (owner mode: an issuer-locked input is present). Signer: issuer
// (the vault lock owns the loan cell).

import { ccc } from "@ckb-ccc/core";
import {
  borrowerSigner,
  completeAndSend,
  issuerSigner,
  loadEnv,
  lockOf,
  makeClient,
  readDeployment,
  u128Le,
} from "../../scripts/lib/common";
import {
  STATE_BORROWED,
  STATE_DEPOSITED,
  addLendingDeps,
  decodeLoanData,
  encodeLoanData,
  inputOf,
  loadLoanCell,
  loanTokenType,
} from "./lib";

async function main() {
  loadEnv();
  const d = readDeployment();
  if (!d.loan) throw new Error("no loan recorded: run lending/scripts/deposit.ts first");
  const client = makeClient();
  const issuer = issuerSigner(client);
  const borrowerLock = await lockOf(borrowerSigner(client));
  const issuerLock = await lockOf(issuer);

  const loanCell = await loadLoanCell(client, d, STATE_DEPOSITED);
  const { borrowerLockHash } = decodeLoanData(loanCell.outputData);
  if (borrowerLockHash !== borrowerLock.hash()) {
    throw new Error("BORROWER_PRIVATE_KEY is not the borrower recorded in the loan cell");
  }
  const token = await loanTokenType(client, issuerLock.hash());

  const tx = ccc.Transaction.from({
    outputs: [
      { lock: loanCell.cellOutput.lock, type: loanCell.cellOutput.type },
      { lock: borrowerLock, type: token },
    ],
    outputsData: [
      encodeLoanData(borrowerLockHash, STATE_BORROWED),
      ccc.hexFrom(u128Le(BigInt(d.loan.terms.loanAmount))),
    ],
  });
  tx.addInput(inputOf(loanCell));
  await addLendingDeps(client, tx, d, { sudt: true });
  await tx.completeInputsByCapacity(issuer);

  await completeAndSend(client, tx, issuer, [], "borrow");
  console.log(`borrower received ${d.loan.terms.loanAmount} loan tokens`);
}

main().then(
  () => process.exit(0), // the RPC client would otherwise keep Node alive
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
