# KYC Attestation

**KYC verification is mocked for this demo.** The real plan is Sumsub
integration; this phase focuses on proving the on-chain attestation and
gating logic works, independent of which verification provider produces the
pass/fail result.

Flow for this phase:

1. A "passed verification" result is hardcoded for a given CKB address (no
   live Sumsub call).
2. On that mocked pass, a signed attestation is written on-chain: a minimal
   Cell recording that the address has passed KYC.
3. The attestation Cell is **issuer-revocable** (the project issuer can
   invalidate it), **not subject-revocable**.

This is a single-purpose attestation for this project only — it is not a
general-purpose identity system.

## Contents

- `scripts/write_attestation.ts` — mocked verification (always passes) and the
  attestation write. There is no `contracts/` crate: the attestation is a plain
  cell under the issuer's own lock, so only the issuer can spend (revoke) it.

## Status

Implemented. Layout, revocation and how lending checks it:
[docs/kyc-attestation.md](../docs/kyc-attestation.md). Tests:
`npm run test:kyc-attestation`.
