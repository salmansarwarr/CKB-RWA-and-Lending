// Shared helpers for the lending flow scripts (deposit/borrow/repay/release).
//
// The on-chain layouts mirrored here live in lending/contracts/src/main.rs.

import { ccc } from "@ckb-ccc/core";
import {
  Deployment,
  LoanTerms,
  cellDepOf,
  requireContract,
  scriptFromJson,
  u128Le,
} from "../../scripts/lib/common";

export const STATE_DEPOSITED = 0;
export const STATE_BORROWED = 1;
export const STATE_REPAID = 2;
export const LOAN_DATA_LEN = 33;

/** Loan terms from the environment; the deadline is set at deposit time. */
export function termsFromEnv(now = Math.floor(Date.now() / 1000)): LoanTerms {
  const loanAmount = BigInt(process.env.LENDING_BORROW_AMOUNT || "1000");
  const repayAmount = BigInt(process.env.LENDING_REPAY_AMOUNT || "1100");
  const term = Number(process.env.LENDING_TERM_SECONDS || "3600");
  if (repayAmount < loanAmount) throw new Error("repay amount below loan amount");
  return {
    loanAmount: loanAmount.toString(),
    repayAmount: repayAmount.toString(),
    deadline: now + term,
  };
}

/** The 136-byte loan type script args: see the header of lending main.rs. */
export function encodeLoanArgs(
  issuerLockHash: string,
  assetTypeHash: string,
  tokenTypeHash: string,
  terms: LoanTerms,
): string {
  return ccc.hexFrom(
    ccc.bytesConcat(
      ccc.bytesFrom(issuerLockHash),
      ccc.bytesFrom(assetTypeHash),
      ccc.bytesFrom(tokenTypeHash),
      u128Le(BigInt(terms.loanAmount)),
      u128Le(BigInt(terms.repayAmount)),
      ccc.numLeToBytes(terms.deadline, 8),
    ),
  );
}

/** Loan cell data: borrower lock hash | state. */
export function encodeLoanData(borrowerLockHash: string, state: number): string {
  return ccc.hexFrom(ccc.bytesConcat(ccc.bytesFrom(borrowerLockHash), [state]));
}

export function decodeLoanData(data: string): { borrowerLockHash: string; state: number } {
  const b = ccc.bytesFrom(data);
  if (b.length !== LOAN_DATA_LEN) throw new Error(`bad loan data length ${b.length}`);
  return { borrowerLockHash: ccc.hexFrom(b.slice(0, 32)), state: b[32] };
}

/** The loan token: sUDT owned by the issuer (owner mode = mint). */
export async function loanTokenType(
  client: ccc.Client,
  issuerLockHash: string,
): Promise<ccc.Script> {
  const info = await client.getKnownScript(ccc.KnownScript.SUdt);
  return ccc.Script.from({
    codeHash: info.codeHash,
    hashType: info.hashType,
    args: issuerLockHash,
  });
}

export function loanType(d: Deployment): ccc.Script {
  if (!d.loan) throw new Error("no loan recorded: run lending/scripts/deposit.ts first");
  return scriptFromJson(d.loan.typeScript);
}

export function assetType(d: Deployment): ccc.Script {
  if (!d.asset) throw new Error("no asset recorded: run asset/scripts/issue_asset.ts first");
  return scriptFromJson(d.asset.typeScript);
}

/** A tx input spending `cell`, with the cell info prefilled (no extra RPC). */
export function inputOf(cell: ccc.Cell): ccc.CellInputLike {
  return {
    previousOutput: cell.outPoint,
    cellOutput: cell.cellOutput,
    outputData: cell.outputData,
  };
}

export async function findOne(
  gen: AsyncGenerator<ccc.Cell>,
  what: string,
): Promise<ccc.Cell> {
  for await (const cell of gen) return cell;
  throw new Error(`${what} not found on chain`);
}

/** Loads the live loan cell and checks it is in `state`. */
export async function loadLoanCell(
  client: ccc.Client,
  d: Deployment,
  state: number,
): Promise<ccc.Cell> {
  const cell = await findOne(client.findCellsByType(loanType(d), true), "loan cell");
  const got = decodeLoanData(cell.outputData).state;
  if (got !== state) throw new Error(`loan cell is in state ${got}, expected ${state}`);
  return cell;
}

/** Adds the cell deps every lending tx needs (lending code + secp + sUDT). */
export async function addLendingDeps(
  client: ccc.Client,
  tx: ccc.Transaction,
  d: Deployment,
  extra: { asset?: boolean; sudt?: boolean } = {},
): Promise<void> {
  tx.addCellDeps(cellDepOf(requireContract(d, "lending")));
  if (extra.asset) tx.addCellDeps(cellDepOf(requireContract(d, "asset")));
  const known = [ccc.KnownScript.Secp256k1Blake160];
  if (extra.sudt) known.push(ccc.KnownScript.SUdt);
  await tx.addCellDepsOfKnownScripts(client, known);
}
