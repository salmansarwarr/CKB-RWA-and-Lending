#  RWA and lending on CKBs

A CKB testnet demo proving one pattern end to end: a real-world asset claim,
gated by KYC verification, used as collateral in a simple fixed-term loan.

```text
RWA Asset -> KYC Attestation -> Deposit -> Borrow -> Repay -> Release
```

> **Disclaimer:** The RWA asset in this repository is a **reference/demo
> asset only**. It is not a real custodied or legally binding instrument, it
> does not represent ownership of any actual invoice, warehouse receipt, or
> other real-world claim, and it must not be treated as one. This is a
> technical demo proving the pattern works end to end — it is **not** a
> production lending product and does not custody real value.

---

## Objective

Build a working CKB testnet demo showing a real-world asset claim, gated by
KYC verification, used in a simple fixed-term loan.

---

## Build

### 1. RWA Asset ([`asset/`](asset/))

Issue a native CKB token/cell representing a single, simple real-world claim
(e.g. an invoice or warehouse receipt).

- Issued directly on CKB — no bridge, no external chain involved.
- Define: type script, decimals (if applicable), fixed supply, basic
  metadata (name, description of what it represents).
- Clearly label it as a demo reference asset, not a legally binding or
  custodied instrument.

See [docs/asset-model.md](docs/asset-model.md).

### 2. KYC Attestation (mocked for this phase) ([`kyc-attestation/`](kyc-attestation/))

- Skip live Sumsub integration for the demo — hardcode a "passed
  verification" result for a given CKB address instead.
- On that mocked pass, write a signed attestation on-chain: a minimal Cell
  recording that the address has passed KYC.
- The attestation Cell should be **issuer-revocable** (you, as issuer, can
  invalidate it), **not subject-revocable**.
- No need to build a general-purpose identity system — this is a
  single-purpose attestation for this project only.

**README must state clearly:** "KYC verification is mocked for this demo.
The real plan is Sumsub integration; this phase focuses on proving the
on-chain attestation and gating logic works, independent of which
verification provider produces the pass/fail result."

See [docs/kyc-attestation.md](docs/kyc-attestation.md).

### 3. Lending Flow (fixed-term, no oracle) ([`lending/`](lending/))

- **Deposit** — borrower locks the RWA asset + a valid KYC attestation.
- **Borrow** — a fixed, pre-agreed amount is released to the borrower (a
  CKB-native token or stablecoin is fine for the demo).
- **Repay** — borrower repays the fixed amount by a fixed deadline.
- **Release** — on repayment, the RWA asset collateral is released back to
  the borrower.

No dynamic collateral ratio, no price oracle, no liquidation logic —
deliberately out of scope for this phase. If not repaid by the deadline, the
collateral simply remains locked (no auction/liquidation flow needed for
the demo).

See [docs/lending.md](docs/lending.md).

### 4. Testnet + Documentation

- Deployment scripts for all components ([`scripts/deploy/`](scripts/deploy/)).
- Record transaction hashes for: asset issuance, KYC attestation write,
  deposit, borrow, repay, release ([docs/testnet-deployment.md](docs/testnet-deployment.md)).
- Short README with reproduction instructions (below).

---

## Definition of Done

A reviewer can follow the README and independently verify one complete
testnet transaction chain:

```text
RWA asset issued -> KYC attestation written (mocked verification)
  -> deposited as collateral -> loan issued -> repaid -> collateral released
```

---

## Out of Scope (this phase)

- Live Sumsub (or any real KYC provider) integration — mocked for this
  phase, real integration is Phase 2 work
- Real custody, real legal backing, or redemption of the RWA asset
- Dynamic collateral ratios, price oracles, or liquidation logic
- General-purpose or reusable identity/attestation system
- Multiple asset types or multiple concurrent loans
- Fuzzing or formal verification of the contracts
- Security audit

Those are potential Phase 2 work.

---

## Repository Structure

```text
ckb-rwa-asset-adapter/
├── asset/
│   ├── contracts/
│   └── scripts/
├── kyc-attestation/
│   ├── contracts/
│   └── scripts/
├── lending/
│   ├── contracts/
│   └── scripts/
├── metadata/
│   └── asset.json
├── scripts/
│   ├── deploy/      deploy, record_docs, verify_code_hashes, deployment.testnet.json
│   ├── lib/         shared helpers
│   └── testnet/     demo.sh
├── tests/
│   ├── asset/
│   ├── kyc-attestation/
│   └── lending/
├── docs/
│   ├── architecture.md
│   ├── asset-model.md
│   ├── kyc-attestation.md
│   ├── lending.md
│   └── testnet-deployment.md
├── examples/
└── README.md
```

---

## Documentation

| Document | Description |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Overall system architecture and component interactions |
| [`docs/asset-model.md`](docs/asset-model.md) | CKB asset representation, supply, and external relationship |
| [`docs/kyc-attestation.md`](docs/kyc-attestation.md) | Mocked verification, attestation cell design, revocation |
| [`docs/lending.md`](docs/lending.md) | Deposit/borrow/repay/release flow and deadline handling |
| [`docs/testnet-deployment.md`](docs/testnet-deployment.md) | Deployed addresses, code hashes, and example transactions |

---

## Getting Started

### Prerequisites

- Git
- Node.js 18+ and npm
- Rust via [rustup](https://rustup.rs), plus the pinned toolchain for the
  on-chain contracts (CKB's VM has no atomics, so they are built with
  `-C target-feature=-a`, which Rust 1.98 currently ICEs on):

  ```bash
  rustup toolchain install 1.89.0 --target riscv64imac-unknown-none-elf
  ```

- Two CKB **testnet** keys, funded from the
  [faucet](https://faucet.nervos.org): the issuer/lender (needs about 75,000
  CKB, because the two contract binaries are stored on chain at 1 CKB per
  byte) and the borrower (a few hundred CKB). Use throwaway keys.

### Install

```bash
git clone <repository-url>
cd ckb-rwa-asset-adapter
npm install
```

### Configuration

```bash
cp .env.example .env
```

Fill in `PRIVATE_KEY` (issuer/lender) and `BORROWER_PRIVATE_KEY` (both
`0x`-prefixed). The loan amounts and term are optional (defaults: borrow 1000,
repay 1100, 1 hour). `.env` is gitignored: **never commit private keys.**

### Testing (no network, no keys)

```bash
npm test          # asset (9) + KYC (5) + lending (52) tests
npm run typecheck # TypeScript scripts
```

The contract tests run the compiled RISC-V binaries in `ckb-testtool`'s VM,
covering every accept and reject path of each step.

### Reproduce the testnet flow

```bash
./scripts/testnet/demo.sh
```

This builds the contracts, deploys them, and runs the whole chain, recording
every transaction hash:

```text
deploy -> issue RWA asset -> write KYC attestation (mocked)
  -> deposit -> borrow -> repay -> release
```

Each step is also a standalone script (`npx ts-node <script>`), in this order:

| Step | Script |
| --- | --- |
| Deploy contracts | `scripts/deploy/deploy.sh` |
| Issue the asset | `asset/scripts/issue_asset.ts` |
| Write the attestation | `kyc-attestation/scripts/write_attestation.ts` |
| Deposit | `lending/scripts/deposit.ts` |
| Borrow | `lending/scripts/borrow.ts` |
| Fund interest (demo setup) | `lending/scripts/fund_interest.ts` |
| Repay | `lending/scripts/repay.ts` |
| Release | `lending/scripts/release.ts` |

Progress is kept in `scripts/deploy/deployment.testnet.json` (public data
only). `./scripts/testnet/demo.sh --fresh` keeps the deployed contracts and
reruns the flow with a new asset and loan.

### Verify independently

See [docs/testnet-deployment.md](docs/testnet-deployment.md): it lists every
transaction and explains how to check the code hashes against a local build
(`npx ts-node scripts/deploy/verify_code_hashes.ts`) and follow the chain on the
explorer.

---

## Security Considerations

Before any production use, the following require additional review:

- Asset issuance authorization
- Attestation issuer key management and revocation process
- Replay protection on deposit/borrow/repay/release
- The repay deadline is best effort: CKB scripts cannot read their own commit
  time, so the contract checks header-dep timestamps (see
  [docs/lending.md](docs/lending.md#deadline))
- The vault lock is the issuer's own key in this demo, so the issuer co-signs
  every loan step (see [Trust assumptions](docs/lending.md#trust-assumptions-demo))
- Contract authorization and upgradeability
- Failure and recovery procedures

The demo implementation intentionally simplifies these for the purposes of
proving the pattern end to end — see [Out of Scope (this phase)](#out-of-scope-this-phase).

---

## Future Work (Phase 2)

- Live Sumsub (or other real KYC provider) integration
- Real custody / legal backing / redemption for the RWA asset
- Dynamic collateral ratios, price oracle, and liquidation logic
- General-purpose, reusable attestation system
- Multiple asset types and concurrent loans
- Fuzzing, formal verification and a security audit

---

## Contributing

Contributions are welcome.

1. Keep components modular (`asset/`, `kyc-attestation/`, `lending/`).
2. Add tests for new functionality under `tests/`.
3. Update the relevant documentation under `docs/`.
4. Clearly document security assumptions and trust boundaries.
5. Keep testnet reproduction steps up to date.

---

## License

[MIT](LICENSE)
