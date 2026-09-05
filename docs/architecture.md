# Architecture

## Pipeline

```text
RWA Asset -> KYC Attestation -> Deposit -> Borrow -> Repay -> Release
```

## Components

| Component | Location | Description |
| --- | --- | --- |
| RWA Asset | [`asset/`](../asset/) | On-chain representation of a single real-world claim. |
| KYC Attestation | [`kyc-attestation/`](../kyc-attestation/) | Mocked-verification, issuer-revocable attestation cell. |
| Lending | [`lending/`](../lending/) | Fixed-term deposit/borrow/repay/release flow, gated by the attestation. |

## Trust model

- The RWA asset cell does not imply custody or legal backing of the
  underlying real-world claim — see [asset-model.md](asset-model.md).
- The KYC attestation reflects a mocked verification result for this phase —
  see [kyc-attestation.md](kyc-attestation.md).
- The lending flow has no price oracle or liquidation logic — see
  [lending.md](lending.md).

This is a technical reference demonstrating the pattern end to end. It is not
a production lending product and does not custody real value.
