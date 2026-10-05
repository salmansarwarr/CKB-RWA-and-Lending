# Lending (fixed-term, no oracle)

A simple fixed-term loan flow gated by KYC attestation. No dynamic
collateral ratio, no price oracle, no liquidation logic — deliberately out
of scope for this phase.

## Flow

1. **Deposit** — borrower locks the RWA asset + a valid KYC attestation.
2. **Borrow** — a fixed, pre-agreed amount is released to the borrower (a
   CKB-native token or stablecoin is fine for the demo).
3. **Repay** — borrower repays the fixed amount by a fixed deadline.
4. **Release** — on repayment, the RWA asset collateral is released back to
   the borrower.

If not repaid by the deadline, the collateral simply remains locked — no
auction/liquidation flow for this demo.

## Contents

- `contracts/` — `lending-type` crate: the loan-cell **type script** that
  enforces the deposit/borrow/repay/release state machine (a type script
  runs when the loan cell is created; a lock script would not).
- `scripts/` — `deposit.ts`, `borrow.ts`, `fund_interest.ts`, `repay.ts`,
  `release.ts`, plus `lib.ts` (layouts and cell lookup).

## Status

All four steps are implemented and covered by `ckb-testtool` tests
(`npm run test:lending`). The TypeScript scripts are run by
[`scripts/testnet/demo.sh`](../scripts/testnet/demo.sh); transaction hashes
are in [docs/testnet-deployment.md](../docs/testnet-deployment.md). See
[docs/lending.md](../docs/lending.md) for the rules, error codes and trust
assumptions.
