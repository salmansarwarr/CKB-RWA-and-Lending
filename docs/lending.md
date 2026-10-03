# Lending

Fixed-term, no-oracle lending flow gated by a valid KYC attestation.

## Deposit (implemented)

The deposit is enforced by a **type script** on the loan cell
(`lending/contracts`), because a type script runs when the cell is created,
whereas a lock script only runs when a cell is spent.

Script args (64 bytes): `issuer lock hash | RWA asset type hash`.
Loan cell data (33 bytes): `borrower lock hash | state` (`0x00` = deposited).

A deposit tx has no loan cell in its inputs and exactly one in its outputs,
and the script rejects it unless:

1. The RWA asset cell (type hash from args) is among the inputs, its lock
   hash equals the borrower's, and it is re-created in the outputs under the
   same lock as the loan cell (collateral is now held by the lending lock).
2. A KYC attestation cell is among the inputs: lock hash equals the issuer's,
   data is 41 bytes, subject lock hash equals the borrower's, status is
   `0x01` (pass). See [kyc-attestation.md](kyc-attestation.md).

Note: the attestation is spent by the deposit, so the issuer must co-sign and
should re-create it as an output (not enforced on-chain). Any non-deposit
transition on the loan cell is currently rejected.

Error codes: 1 syscall, 2 bad args, 3 bad loan data, 4 unsupported
transition, 5 asset not in inputs, 6 asset not owned by borrower, 7 asset
not locked in vault, 8 no valid attestation.

To be documented once implemented:

- Borrow: fixed amount, fixed deadline
- Repay: repayment conditions and deadline check
- Release: collateral return on repayment
- Behavior when the deadline passes without repayment (collateral remains
  locked; no auction/liquidation in this phase)

Explicitly out of scope for this phase: dynamic collateral ratios, price
oracles, liquidation logic.
