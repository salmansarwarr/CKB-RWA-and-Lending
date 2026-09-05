# KYC Attestation

**KYC verification is mocked for this demo.** The real plan is Sumsub
integration; this phase focuses on proving the on-chain attestation and
gating logic works, independent of which verification provider produces the
pass/fail result.

To be documented once `kyc-attestation/contracts` is implemented:

- Mocked verification result format (hardcoded pass for a given CKB address)
- Attestation Cell layout (address, status, issuer signature)
- Issuer-revocable vs. subject-revocable design and why issuer-revocable was
  chosen for this phase
- How the lending flow checks for a valid, non-revoked attestation
