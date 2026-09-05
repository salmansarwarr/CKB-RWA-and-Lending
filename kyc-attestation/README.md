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

- `contracts/` — attestation cell type script (issuer-revocable).
- `scripts/` — mock verification + attestation write/revoke scripts.

## Status

Not yet implemented. See [docs/kyc-attestation.md](../docs/kyc-attestation.md).
