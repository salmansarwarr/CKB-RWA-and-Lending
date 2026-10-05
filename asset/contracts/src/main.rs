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
// Script args (32 bytes): blake2b(first tx input | output index as u64 LE).
// The output index is fixed at 0, so the issuance tx must place the asset
// cell at output 0.
//
// DEMO REFERENCE ASSET ONLY: not a custodied or legally binding instrument.

#![no_std]
#![no_main]

use blake2b_ref::Blake2bBuilder;
use ckb_std::{
    ckb_constants::Source,
    ckb_types::{bytes::Bytes, prelude::*},
    default_alloc,
    high_level::{load_cell_type_hash, load_input, load_script, load_script_hash, QueryIter},
};

ckb_std::entry!(program_entry);
default_alloc!();

const SCRIPT_ARGS_LEN: usize = 32;

#[repr(i8)]
enum Error {
    Syscall = 1,
    BadArgs,
    BadShape,
    NoFirstInput,
    UniquenessMismatch,
}

fn program_entry() -> i8 {
    match check() {
        Ok(()) => 0,
        Err(e) => e as i8,
    }
}

fn check() -> Result<(), Error> {
    let script = load_script().map_err(|_| Error::Syscall)?;
    let args: Bytes = script.args().unpack();
    if args.len() != SCRIPT_ARGS_LEN {
        return Err(Error::BadArgs);
    }

    let type_hash = load_script_hash().map_err(|_| Error::Syscall)?;
    let count = |source| {
        QueryIter::new(load_cell_type_hash, source)
            .filter(|h| h.as_ref() == Some(&type_hash))
            .count()
    };

    match (count(Source::Input), count(Source::Output)) {
        // Creation: no input cell of this type, exactly one output cell of
        // this type, and args == hash(first tx input | output index 0), as in
        // the standard Type ID pattern. The consumed input can never exist
        // again, so the args can never be reproduced.
        (0, 1) => verify_creation(&args),

        // Transfer: the claim moves to a new owner (new lock) but keeps its
        // identity (type args). Lock scripts handle authorization.
        (1, 1) => Ok(()),

        // Destruction: one input, no output, e.g. a claim deliberately retired.
        (1, 0) => Ok(()),

        // Anything else (e.g. two outputs claiming the same type) is invalid.
        _ => Err(Error::BadShape),
    }
}

fn verify_creation(args: &[u8]) -> Result<(), Error> {
    let first_input = load_input(0, Source::Input).map_err(|_| Error::NoFirstInput)?;

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
        Err(Error::UniquenessMismatch)
    }
}
