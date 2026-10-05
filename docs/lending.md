# Lending

Fixed-term, no-oracle lending flow gated by a valid KYC attestation.

## Deposit (implemented)

The deposit is enforced by a **type script** on the loan cell
(`lending/contracts`), because a type script runs when the cell is created,
whereas a lock script only runs when a cell is spent.

Script args (136 bytes, integers little-endian) fix the pre-agreed loan, so
all loan cells with the same args are the same loan:

| Bytes     | Field                                                        |
| --------- | ------------------------------------------------------------ |
| `0..32`   | issuer lock hash (trusted attestation issuer, also the lender) |
| `32..64`  | RWA asset type hash (accepted collateral)                    |
| `64..96`  | loan token type hash                                         |
| `96..112` | loan amount, u128                                            |
| `112..128`| repay amount, u128                                           |
| `128..136`| repay deadline, u64, unix seconds                            |

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
should re-create it as an output (not enforced on-chain).

## Borrow (implemented)

The loan cell is spent and re-created (state `0x00` -> `0x01`). The script
rejects the tx unless:

1. The loan cell keeps its borrower, and its lock (the vault) is unchanged.
2. The collateral is not touched: no RWA asset cell is among the inputs.
3. Loan-token cells (type hash from args) locked by the borrower and totalling
   at least the loan amount are among the outputs. Token amounts are read as
   a u128 from the first 16 data bytes (sUDT layout). Where the tokens come
   from is the token type script's business; in the demo the issuer is the
   sUDT owner and mints them in the same tx.

The vault lock authorizes the spend, so in the demo the lender (issuer) signs
the borrow. Any transition other than deposit and borrow is currently
rejected.

Error codes: 1 syscall, 2 bad args (not 136 bytes), 3 bad loan data, 4 unsupported
transition, 5 asset not in inputs, 6 asset not owned by borrower, 7 asset
not locked in vault, 8 no valid attestation, 9 bad state transition, 10
vault lock changed, 11 collateral moved, 12 loan not paid.

To be documented once implemented:

- Repay: repayment conditions and deadline check
- Release: collateral return on repayment
- Behavior when the deadline passes without repayment (collateral remains
  locked; no auction/liquidation in this phase)

Explicitly out of scope for this phase: dynamic collateral ratios, price
oracles, liquidation logic.
