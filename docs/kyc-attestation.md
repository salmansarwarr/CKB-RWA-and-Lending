# KYC Attestation

**KYC verification is mocked for this demo.** The real plan is Sumsub
integration; this phase focuses on proving the on-chain attestation and
gating logic works, independent of which verification provider produces the
pass/fail result.

## Mocked verification

`mockVerify()` in `kyc-attestation/scripts/write_attestation.ts` always
returns pass, for any subject.

## Attestation cell layout

The data is 41 bytes, all integers little-endian:

| Bytes   | Field                                      |
| ------- | ------------------------------------------ |
| `0..32` | subject lock hash                          |
| `32`    | status: `0x01` = pass, `0x00` = fail       |
| `33..41`| issued-at, u64, unix seconds               |

The cell has no type script. It sits under the issuer's own lock
(secp256k1), so no new Rust contract is needed for this piece. It needs about
102 CKB of capacity (61 bytes of lock overhead plus 41 bytes of data).

## Issuer-revocable, not subject-revocable

Because the cell is locked by the issuer, only the issuer can spend it. The
issuer revokes an attestation by consuming the cell. The subject has no way
to remove or alter it.

## Writing an attestation

```
ISSUER_PRIVATE_KEY=0x... npx ts-node kyc-attestation/scripts/write_attestation.ts <subject-ckt-address>
```

## To be documented

- How the lending flow checks for a valid, non-revoked attestation
