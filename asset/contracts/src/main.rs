// asset/contracts/src/main.rs
//
// RWA Asset Type Script — Type-ID-style uniqueness check.
//
// This represents a single, unique real-world claim (one invoice, one
// warehouse receipt) — not a fungible, divisible token. There is no supply
// amount, no decimals, no mint/burn logic. The Type Script's only job is to
// guarantee this specific cell can be created exactly once and never
// duplicated, following the same pattern as CKB's standard Type ID script.
//
// Status: implementable skeleton. Needs a local CKB dev environment
// (capsule / ckb-std toolchain) to build and test against testnet.

#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    high_level::{load_cell_type, load_input, load_script, QueryIter},
    ckb_types::packed::CellInput,
};
use blake2b_ref::Blake2bBuilder;

const SCRIPT_ARGS_LEN: usize = 32;

#[no_mangle]
pub extern "C" fn main() -> i8 {
    match check() {
        Ok(()) => 0,
        Err(code) => code,
    }
}

fn check() -> Result<(), i8> {
    let script = load_script().map_err(|_| 1)?;
    let args: ckb_std::ckb_types::bytes::Bytes = script.args().unpack();
    if args.len() != SCRIPT_ARGS_LEN {
        return Err(2); // malformed args
    }

    let type_hash = script.calc_script_hash();

    let inputs_with_this_type = QueryIter::new(load_cell_type, Source::Input)
        .filter(|t| t.as_ref().map(|s| s.calc_script_hash()) == Some(type_hash.clone()))
        .count();

    let outputs_with_this_type = QueryIter::new(load_cell_type, Source::Output)
        .filter(|t| t.as_ref().map(|s| s.calc_script_hash()) == Some(type_hash.clone()))
        .count();

    match (inputs_with_this_type, outputs_with_this_type) {
        // Creation: no input cell of this type, exactly one output cell of
        // this type. Verify args == hash(first tx input's outpoint + a
        // fixed output index), same as the standard Type ID pattern. This
        // guarantees the args can never be reproduced, since the consumed
        // input can never exist again.
        (0, 1) => verify_creation(&args),

        // Transfer: exactly one input and one output of this type. The
        // claim is being moved to a new owner (new Lock Script) but its
        // identity (Type Script args) is unchanged. No further check
        // needed here -- Lock Script(s) handle authorization.
        (1, 1) => Ok(()),

        // Destruction: one input, no output. Allowed -- e.g. if a claim is
        // deliberately retired. Revisit if this should be restricted.
        (1, 0) => Ok(()),

        // Anything else (e.g. two outputs claiming the same type) is invalid.
        _ => Err(3),
    }
}

fn verify_creation(args: &[u8]) -> Result<(), i8> {
    // TODO: confirm which output index this cell occupies if more than one
    // output is possible in the issuance tx; for the demo, assume index 0.
    let first_input: CellInput = load_input(0, Source::Input).map_err(|_| 4)?;

    let mut hasher = Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    hasher.update(first_input.as_slice());
    hasher.update(&0u64.to_le_bytes()); // output index, fixed at 0 for the demo
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);

    if hash == args {
        Ok(())
    } else {
        Err(5) // args don't match expected uniqueness hash
    }
}
