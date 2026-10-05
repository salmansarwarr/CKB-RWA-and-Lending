// lending/contracts/src/main.rs
//
// Lending loan-cell type script. Implements the DEPOSIT, BORROW and REPAY steps (release to follow).
//
// A type script (not a lock) is used because it runs when the loan cell is
// *created*; a lock script only runs when a cell is spent, so it could not
// gate the deposit.
//
// Script args (136 bytes; integers little-endian). They fix the loan terms, so
// every loan cell with the same args is the same pre-agreed loan:
//   [0..32)     issuer lock hash    -- the only lock whose attestations are
//                                      trusted; also the lender that receives
//                                      repayment
//   [32..64)    RWA asset type hash -- the only asset type accepted as collateral
//   [64..96)    loan token type hash -- token the loan is paid and repaid in
//   [96..112)   loan amount, u128   -- released to the borrower on borrow
//   [112..128)  repay amount, u128  -- owed back to the lender on repay
//   [128..136)  repay deadline, u64 -- unix seconds
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
// Borrow tx (one loan cell in, one out, state 0x00 -> 0x01) must satisfy:
//   - the loan cell keeps its borrower and its lock (the vault);
//   - the collateral is not touched (no asset cell among the inputs);
//   - loan-token cells locked by the borrower and totalling at least the loan
//     amount are among the outputs. The token's own type script decides where
//     those tokens may come from (e.g. sUDT owner mode for the lender).
//
// Repay tx (one loan cell in, one out, state 0x01 -> 0x02) must satisfy:
//   - the loan cell keeps its borrower and its lock;
//   - the collateral is not touched (released separately, once repaid);
//   - a cell locked by the borrower is among the inputs (the borrower signs);
//   - loan-token cells locked by the issuer (the lender) and totalling at
//     least the repay amount are among the outputs.
//
// The repay deadline is checked against the header deps: at least one must be
// present and every one must be timestamped at or before the deadline. CKB
// scripts cannot read the commit time of their own tx and `since` only gives
// lower bounds, so this is best effort: it proves the repayer *named* a block
// from before the deadline, not that the tx was committed before it.
//
// Every other transition (release) is rejected until implemented.

#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc,
    error::SysError,
    high_level::{
        load_cell_data, load_cell_lock_hash, load_cell_type_hash, load_header, load_script,
        QueryIter,
    },
};

ckb_std::entry!(program_entry);
default_alloc!();

const ARGS_LEN: usize = 136;
const LOAN_DATA_LEN: usize = 33;
const ATTESTATION_LEN: usize = 41;
const STATE_DEPOSITED: u8 = 0;
const STATE_BORROWED: u8 = 1;
const STATE_REPAID: u8 = 2;
const TOKEN_AMOUNT_LEN: usize = 16;
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
    BadStateTransition,
    VaultChanged,
    CollateralMoved,
    LoanNotPaid,
    BorrowerNotSigning,
    RepayNotPaid,
    MissingHeader,
    DeadlinePassed,
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

struct Config<'a> {
    issuer_lock_hash: &'a [u8],
    asset_type_hash: &'a [u8],
    loan_token_type_hash: &'a [u8],
    loan_amount: u128,
    repay_amount: u128,
    deadline: u64,
}

fn check() -> Result<(), Error> {
    let script = load_script()?;
    let args: ckb_std::ckb_types::bytes::Bytes = script.args().unpack();
    if args.len() != ARGS_LEN {
        return Err(Error::BadArgs);
    }
    let cfg = Config {
        issuer_lock_hash: &args[0..32],
        asset_type_hash: &args[32..64],
        loan_token_type_hash: &args[64..96],
        loan_amount: u128::from_le_bytes(args[96..112].try_into().unwrap()),
        repay_amount: u128::from_le_bytes(args[112..128].try_into().unwrap()),
        deadline: u64::from_le_bytes(args[128..136].try_into().unwrap()),
    };

    // The shape of the loan cell group selects the transition.
    let inputs = count_group(Source::GroupInput);
    let outputs = count_group(Source::GroupOutput);
    match (inputs, outputs) {
        (0, 1) => check_deposit(&cfg),
        (1, 1) => {
            let state = load_cell_data(0, Source::GroupInput)?.get(32).copied();
            match state {
                Some(STATE_DEPOSITED) => check_borrow(&cfg),
                Some(STATE_BORROWED) => check_repay(&cfg),
                _ => Err(Error::UnsupportedTransition),
            }
        }
        _ => Err(Error::UnsupportedTransition),
    }
}

fn check_deposit(cfg: &Config) -> Result<(), Error> {
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
        if th.as_ref().map(|h| &h[..]) == Some(cfg.asset_type_hash) {
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
            th.as_ref().map(|h| &h[..]) == Some(cfg.asset_type_hash)
                && load_cell_lock_hash(i, Source::Output).ok() == Some(vault_lock_hash)
        });
    if !asset_in_vault {
        return Err(Error::AssetNotLockedInVault);
    }

    // (b) KYC attestation among the inputs.
    let mut attested = false;
    for (i, lh) in QueryIter::new(load_cell_lock_hash, Source::Input).enumerate() {
        if lh[..] != *cfg.issuer_lock_hash {
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

/// Shared by borrow and repay: the loan cell advances to state `to` keeping its
/// borrower and vault lock, and the collateral is left alone. Returns the
/// borrower lock hash.
fn check_loan_cell_step(cfg: &Config, to: u8) -> Result<[u8; 32], Error> {
    let input = load_cell_data(0, Source::GroupInput)?;
    let output = load_cell_data(0, Source::GroupOutput)?;
    if input.len() != LOAN_DATA_LEN || output.len() != LOAN_DATA_LEN {
        return Err(Error::BadLoanData);
    }
    if output[0..32] != input[0..32] || output[32] != to {
        return Err(Error::BadStateTransition);
    }
    if load_cell_lock_hash(0, Source::GroupInput)? != load_cell_lock_hash(0, Source::GroupOutput)? {
        return Err(Error::VaultChanged);
    }

    // The collateral stays where it is: it must not be spent by this tx.
    let asset_spent = QueryIter::new(load_cell_type_hash, Source::Input)
        .any(|th| th.as_ref().map(|h| &h[..]) == Some(cfg.asset_type_hash));
    if asset_spent {
        return Err(Error::CollateralMoved);
    }
    Ok(input[0..32].try_into().unwrap())
}

fn check_borrow(cfg: &Config) -> Result<(), Error> {
    let borrower_lock_hash = check_loan_cell_step(cfg, STATE_BORROWED)?;
    if token_total(Source::Output, cfg.loan_token_type_hash, &borrower_lock_hash)? < cfg.loan_amount {
        return Err(Error::LoanNotPaid);
    }
    Ok(())
}

fn check_repay(cfg: &Config) -> Result<(), Error> {
    let borrower_lock_hash = check_loan_cell_step(cfg, STATE_REPAID)?;

    check_deadline(cfg.deadline)?;

    // The borrower must authorize the repayment: one of their cells is spent.
    let borrower_signs = QueryIter::new(load_cell_lock_hash, Source::Input)
        .any(|lh| lh == borrower_lock_hash);
    if !borrower_signs {
        return Err(Error::BorrowerNotSigning);
    }

    // The lender (issuer) receives at least the fixed repay amount.
    if token_total(Source::Output, cfg.loan_token_type_hash, cfg.issuer_lock_hash)? < cfg.repay_amount {
        return Err(Error::RepayNotPaid);
    }
    Ok(())
}

/// Every header dep must be timestamped at or before `deadline` (unix seconds);
/// at least one must be given.
fn check_deadline(deadline: u64) -> Result<(), Error> {
    let mut seen = false;
    for header in QueryIter::new(load_header, Source::HeaderDep) {
        seen = true;
        let timestamp_ms: u64 = header.raw().timestamp().unpack();
        if timestamp_ms / 1000 > deadline {
            return Err(Error::DeadlinePassed);
        }
    }
    if seen {
        Ok(())
    } else {
        Err(Error::MissingHeader)
    }
}

/// Sum of the u128 amounts (first 16 data bytes, sUDT layout) of all cells in
/// `source` that carry the token type and are locked by `lock_hash`.
fn token_total(source: Source, token_type_hash: &[u8], lock_hash: &[u8]) -> Result<u128, Error> {
    let mut total: u128 = 0;
    for (i, th) in QueryIter::new(load_cell_type_hash, source).enumerate() {
        if th.as_ref().map(|h| &h[..]) != Some(token_type_hash)
            || load_cell_lock_hash(i, source)?[..] != *lock_hash
        {
            continue;
        }
        let d = load_cell_data(i, source)?;
        if d.len() < TOKEN_AMOUNT_LEN {
            continue;
        }
        total = total.saturating_add(u128::from_le_bytes(d[0..TOKEN_AMOUNT_LEN].try_into().unwrap()));
    }
    Ok(total)
}

fn count_group(source: Source) -> usize {
    QueryIter::new(load_cell_data, source).count()
}
