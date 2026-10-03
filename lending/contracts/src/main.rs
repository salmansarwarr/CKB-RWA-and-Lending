// lending/contracts/src/main.rs
//
// Lending loan-cell type script. Currently implements the DEPOSIT step only.
//
// A type script (not a lock) is used because it runs when the loan cell is
// *created*; a lock script only runs when a cell is spent, so it could not
// gate the deposit.
//
// Script args (64 bytes):
//   [0..32)   issuer lock hash   -- the only lock whose attestations are trusted
//   [32..64)  RWA asset type hash -- the only asset type accepted as collateral
//
// Loan cell data (33 bytes):
//   [0..32)   borrower lock hash
//   [32]      state: 0x00 = deposited
//
// Deposit tx (no loan cell in inputs, exactly one in outputs) must satisfy:
//   (a) the RWA asset cell is among the inputs, owned by the borrower, and
//       re-created in the outputs under the same lock as the loan cell
//       (the collateral is now held by the lending lock);
//   (b) a valid KYC attestation cell is among the inputs: locked by the
//       issuer, data = borrower lock hash | status 0x01 (pass) | issued-at.
//       The attestation sits under the issuer's lock, so the issuer must
//       co-sign the deposit; it should be re-created as an output to keep it
//       alive (not enforced here).
//
// Every other transition (borrow/repay/release) is rejected until implemented.

#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc,
    error::SysError,
    high_level::{
        load_cell_data, load_cell_lock_hash, load_cell_type_hash, load_script, QueryIter,
    },
};

ckb_std::entry!(program_entry);
default_alloc!();

const ARGS_LEN: usize = 64;
const LOAN_DATA_LEN: usize = 33;
const ATTESTATION_LEN: usize = 41;
const STATE_DEPOSITED: u8 = 0;
const STATUS_PASS: u8 = 1;

#[repr(i8)]
enum Error {
    Syscall = 1,
    BadArgs,
    BadLoanData,
    UnsupportedTransition,
    AssetNotInInputs,
    AssetNotOwnedByBorrower,
    AssetNotLockedInVault,
    NoValidAttestation,
}

impl From<SysError> for Error {
    fn from(_: SysError) -> Self {
        Error::Syscall
    }
}

fn program_entry() -> i8 {
    match check() {
        Ok(()) => 0,
        Err(e) => e as i8,
    }
}

fn check() -> Result<(), Error> {
    let script = load_script()?;
    let args: ckb_std::ckb_types::bytes::Bytes = script.args().unpack();
    if args.len() != ARGS_LEN {
        return Err(Error::BadArgs);
    }
    let issuer_lock_hash = &args[0..32];
    let asset_type_hash = &args[32..64];

    let inputs = count_group(Source::GroupInput);
    let outputs = count_group(Source::GroupOutput);
    if (inputs, outputs) != (0, 1) {
        return Err(Error::UnsupportedTransition);
    }

    let data = load_cell_data(0, Source::GroupOutput)?;
    if data.len() != LOAN_DATA_LEN || data[32] != STATE_DEPOSITED {
        return Err(Error::BadLoanData);
    }
    let borrower_lock_hash = &data[0..32];
    let vault_lock_hash = load_cell_lock_hash(0, Source::GroupOutput)?;

    // (a) RWA asset: in inputs, owned by borrower, re-locked into the vault.
    let mut asset_in_inputs = false;
    let mut asset_owned_by_borrower = false;
    for (i, th) in QueryIter::new(load_cell_type_hash, Source::Input).enumerate() {
        if th.as_ref().map(|h| &h[..]) == Some(asset_type_hash) {
            asset_in_inputs = true;
            if load_cell_lock_hash(i, Source::Input)?[..] == *borrower_lock_hash {
                asset_owned_by_borrower = true;
            }
        }
    }
    if !asset_in_inputs {
        return Err(Error::AssetNotInInputs);
    }
    if !asset_owned_by_borrower {
        return Err(Error::AssetNotOwnedByBorrower);
    }
    let asset_in_vault = QueryIter::new(load_cell_type_hash, Source::Output)
        .enumerate()
        .any(|(i, th)| {
            th.as_ref().map(|h| &h[..]) == Some(asset_type_hash)
                && load_cell_lock_hash(i, Source::Output).ok() == Some(vault_lock_hash)
        });
    if !asset_in_vault {
        return Err(Error::AssetNotLockedInVault);
    }

    // (b) KYC attestation among the inputs.
    let mut attested = false;
    for (i, lh) in QueryIter::new(load_cell_lock_hash, Source::Input).enumerate() {
        if lh[..] != *issuer_lock_hash {
            continue;
        }
        let d = load_cell_data(i, Source::Input)?;
        if d.len() == ATTESTATION_LEN && d[0..32] == *borrower_lock_hash && d[32] == STATUS_PASS {
            attested = true;
            break;
        }
    }
    if !attested {
        return Err(Error::NoValidAttestation);
    }
    Ok(())
}

fn count_group(source: Source) -> usize {
    QueryIter::new(load_cell_data, source).count()
}
