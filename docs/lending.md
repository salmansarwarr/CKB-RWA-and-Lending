# Lending

Fixed-term, no-oracle lending flow gated by a valid KYC attestation.

To be documented once `lending/contracts` is implemented:

- Deposit: locking the RWA asset + KYC attestation reference
- Borrow: fixed amount, fixed deadline
- Repay: repayment conditions and deadline check
- Release: collateral return on repayment
- Behavior when the deadline passes without repayment (collateral remains
  locked; no auction/liquidation in this phase)

Explicitly out of scope for this phase: dynamic collateral ratios, price
oracles, liquidation logic.
