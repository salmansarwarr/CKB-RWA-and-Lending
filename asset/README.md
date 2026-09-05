# RWA Asset

Issues a native CKB token/cell representing a single, simple real-world claim
(e.g. an invoice or warehouse receipt), issued directly on CKB — no bridge,
no external chain involved.

This is a **demo reference asset**: it is not a legally binding or custodied
instrument, and creating it does not establish ownership of any real-world claim.

## Contents

- `contracts/` — on-chain type script: fixed supply, decimals (if applicable), basic metadata.
- `scripts/` — issuance / deployment scripts.

## Status

Not yet implemented. See [docs/asset-model.md](../docs/asset-model.md) and the
root [README](../README.md) for the full pipeline this fits into.
