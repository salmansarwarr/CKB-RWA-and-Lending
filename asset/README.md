# RWA Asset

Issues a native CKB token/cell representing a single, simple real-world claim
(e.g. an invoice or warehouse receipt), issued directly on CKB — no bridge,
no external chain involved.

This is a **demo reference asset**: it is not a legally binding or custodied
instrument, and creating it does not establish ownership of any real-world claim.

## Contents

- `contracts/` — `rwa-asset-type` crate: the on-chain type script (Type ID
  args, fixed supply, basic metadata). Currently a **scaffold only** — see
  the doc comment at the top of [`contracts/src/main.rs`](contracts/src/main.rs)
  for the args/data layout and the verification rules still to implement.
- `scripts/` — issuance / deployment scripts (not yet implemented).

## Building

The crate targets CKB's RISC-V VM (`riscv64imac-unknown-none-elf`), not the
host target, so a plain `cargo check`/`cargo build` from the repo root will
fail (missing `panic_handler`/`eh_personality` for the host). Building for
the real target needs a `core`/`alloc` build-std toolchain — typically via
[capsule](https://github.com/nervosnetwork/capsule) or an equivalent
CKB script build container. That toolchain setup is not yet wired up here.

## Status

Scaffold only — type script skeleton exists but verification logic is not
implemented. See [docs/asset-model.md](../docs/asset-model.md) and the root
[README](../README.md) for the full pipeline this fits into.
