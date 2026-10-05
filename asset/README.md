# RWA Asset

Issues a native CKB token/cell representing a single, simple real-world claim
(e.g. an invoice or warehouse receipt), issued directly on CKB — no bridge,
no external chain involved.

This is a **demo reference asset**: it is not a legally binding or custodied
instrument, and creating it does not establish ownership of any real-world claim.

## Contents

- `contracts/` — `rwa-asset-type` crate: the on-chain type script. A
  Type-ID-style uniqueness check: the cell can be created exactly once, with
  args `blake2b(first tx input | output index 0)`, and can then be
  transferred or retired but never duplicated. There is no supply amount, no
  decimals and no mint/burn: the asset is one unique claim.
- `scripts/` — issuance script (see [docs/testnet-deployment.md](../docs/testnet-deployment.md)).

## Building

The crate targets CKB's RISC-V VM (`riscv64imac-unknown-none-elf`). CKB's VM
has no atomics, so it is built with `-C target-feature=-a` (the `dummy-atomic`
ckb-std feature supplies replacements). Rust 1.98 ICEs on that flag; use 1.89:

```bash
rustup toolchain install 1.89.0 --target riscv64imac-unknown-none-elf
npm run build:asset   # -> target/riscv64imac-unknown-none-elf/release/rwa-asset-type
```

## Tests

```bash
npm run test:asset
```

Error codes: 1 syscall, 2 bad args (not 32 bytes), 3 bad tx shape, 4 no first
input, 5 args do not match the uniqueness hash.
