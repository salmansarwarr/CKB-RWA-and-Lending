//! RWA Asset type script — scaffold only, not yet implemented.
//!
//! Reference/demo asset. This type script does not create real custody or
//! legal ownership of any real-world claim; see the root README's
//! disclaimer and `docs/asset-model.md`.
//!
//! ---
//! ## Type script args
//!
//! The args field is a 32-byte CKB "Type ID" (blake2b-256 hash of the
//! transaction's first input's outpoint, plus the output index that first
//! creates this cell — see CKB's standard Type ID convention). Reusing
//! Type ID rather than inventing custom uniqueness logic guarantees:
//!
//! - This exact type script (code_hash + args) can only ever be produced by
//!   the one transaction that mints the asset cell.
//! - There is no separate "mint" code path to guard against — supply is
//!   fixed at creation because no other transaction can reproduce these args.
//!
//! ```text
//! args: <32 bytes> = blake2b256(first_input.outpoint || output_index)
//! ```
//!
//! ## Cell data layout
//!
//! For this demo phase, cell data is a UTF-8 JSON document (not a packed
//! molecule struct — see `metadata/asset.json` for the shape). A production
//! version should replace this with a compact molecule-encoded struct.
//!
//! ```text
//! data: UTF-8 JSON, fields:
//!   name        - string  - human-readable claim name (e.g. "Invoice #1042")
//!   symbol      - string  - short ticker for wallets/UIs (e.g. "RWA-DEMO")
//!   decimals    - number  - 0 for this demo: the claim is a single unit,
//!                           not a divisible fungible balance
//!   description - string  - what real-world claim this cell represents
//!   claim_ref   - string  - external reference / document hash for the
//!                           claim (informational only — not independently
//!                           verified on-chain in this phase)
//!   issuer      - string  - identifies who issued this demo cell
//! ```
//!
//! ## Verification rules (TODO)
//!
//! - **Issuance** (type script present only in an output): args must equal
//!   the Type ID computed from the transaction's first input outpoint and
//!   this output's index.
//! - **Fixed supply**: exactly one live cell may ever carry this
//!   (code_hash, args) pair — guaranteed by Type ID uniqueness above, so no
//!   additional mint-guard logic is required.
//! - **Transfer** (type script present in both an input and an output):
//!   cell data must be byte-for-byte unchanged; only the lock script may
//!   differ (e.g. when the lending contract takes custody as collateral).
//! - **No burn path** in this phase — the asset is only ever locked/unlocked
//!   by the lending flow, never destroyed.

#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]

#[cfg(not(test))]
ckb_std::entry!(program_entry);
#[cfg(not(test))]
ckb_std::default_alloc!();

#[cfg(not(test))]
fn program_entry() -> i8 {
    match verify() {
        Ok(()) => 0,
        Err(code) => code,
    }
}

fn verify() -> Result<(), i8> {
    // TODO: distinguish issuance vs. transfer (is this type script in the
    // transaction's inputs, outputs, or both?).
    // TODO: on issuance, check args == Type ID derived from first input
    // outpoint + output index.
    // TODO: on transfer, check cell data is unchanged across input/output.
    Ok(())
}
