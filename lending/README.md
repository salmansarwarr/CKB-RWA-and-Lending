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

- `contracts/` — lending lock script implementing the deposit/borrow/repay/release state machine.
- `scripts/` — deposit / borrow / repay / release scripts.

## Status

Not yet implemented. See [docs/lending.md](../docs/lending.md).
