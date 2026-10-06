// Gives the borrower the loan tokens needed to cover the interest.
//
//   npx ts-node lending/scripts/fund_interest.ts
//
// The borrower is lent `loan amount` but owes `repay amount`; the difference
// has to come from somewhere. In the real world they would earn or buy it. In
// this demo the issuer mints it (sUDT owner mode). This is not part of the
// loan contract.

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
  u128Le,
} from "../../scripts/lib/common";
import { loanTokenType } from "./lib";

async function main() {
  loadEnv();
  const d = readDeployment();
  if (!d.loan) throw new Error("no loan recorded: run lending/scripts/deposit.ts first");
  const interest = BigInt(d.loan.terms.repayAmount) - BigInt(d.loan.terms.loanAmount);
  if (interest <= 0n) {
    console.log("no interest to fund");
    return;
  }
  const client = makeClient();
  const issuer = issuerSigner(client);
  const token = await loanTokenType(client, (await lockOf(issuer)).hash());

  const tx = ccc.Transaction.from({
    outputs: [{ lock: await lockOf(borrowerSigner(client)), type: token }],
    outputsData: [ccc.hexFrom(u128Le(interest))],
  });
  await tx.addCellDepsOfKnownScripts(client, [
    ccc.KnownScript.Secp256k1Blake160,
    ccc.KnownScript.SUdt,
  ]);
  await tx.completeInputsByCapacity(issuer);
  await completeAndSend(client, tx, issuer, [], "fund_interest");
  console.log(`minted ${interest} tokens to the borrower to cover interest`);
}

main().then(
  () => process.exit(0), // the RPC client would otherwise keep Node alive
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
