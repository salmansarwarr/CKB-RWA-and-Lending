// Repay: the borrower pays the fixed repay amount to the lender before the
// deadline, and the loan cell moves from borrowed (1) to repaid (2).
//
//   npx ts-node lending/scripts/repay.ts
//
// Signers: the borrower (their tokens fund the payment) and the issuer (vault
// lock owner, fee payer). The tx names the current tip header as a header dep:
// the contract checks its timestamp against the deadline (best effort, see
// docs/lending.md).

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
  STATE_REPAID,
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
  const { repayAmount, deadline } = d.loan.terms;
  const client = makeClient();
  const issuer = issuerSigner(client);
  const borrower = borrowerSigner(client);
  const issuerLock = await lockOf(issuer);
  const borrowerLock = await lockOf(borrower);

  const loanCell = await loadLoanCell(client, d, STATE_BORROWED);
  const { borrowerLockHash } = decodeLoanData(loanCell.outputData);
  if (borrowerLockHash !== borrowerLock.hash()) {
    throw new Error("BORROWER_PRIVATE_KEY is not the borrower recorded in the loan cell");
  }
  const token = await loanTokenType(client, issuerLock.hash());

  const tip = await client.getTipHeader();
  if (Number(tip.timestamp / 1000n) > deadline) {
    throw new Error(`deadline ${new Date(deadline * 1000).toISOString()} has passed; the collateral stays locked`);
  }

  const tx = ccc.Transaction.from({
    headerDeps: [tip.hash],
    outputs: [
      { lock: loanCell.cellOutput.lock, type: loanCell.cellOutput.type },
      { lock: issuerLock, type: token }, // the repayment, to the lender
    ],
    outputsData: [
      encodeLoanData(borrowerLockHash, STATE_REPAID),
      ccc.hexFrom(u128Le(BigInt(repayAmount))),
    ],
  });
  tx.addInput(inputOf(loanCell));
  await addLendingDeps(client, tx, d, { sudt: true });

  // The borrower's tokens fund the repayment; any surplus goes back to them.
  await tx.completeInputsByUdt(borrower, token);
  const surplus =
    (await tx.getInputsUdtBalance(client, token)) - tx.getOutputsUdtBalance(token);
  if (surplus > 0n) {
    tx.addOutput({ lock: borrowerLock, type: token }, ccc.hexFrom(u128Le(surplus)));
  }

  await tx.completeInputsByCapacity(issuer);
  await completeAndSend(client, tx, issuer, [borrower], "repay");
  console.log(`repaid ${repayAmount} loan tokens to the lender`);
}

main().then(
  () => process.exit(0), // the RPC client would otherwise keep Node alive
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
