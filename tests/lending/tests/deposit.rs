// Deposit-step tests for lending-type. Build the contract first. CKB's VM has
// no atomics (A extension), so it must be built with -a (the `dummy-atomic`
// ckb-std feature supplies the replacements). Rust 1.98 ICEs on this flag,
// so use 1.89:
//   RUSTFLAGS="-C target-feature=-a" cargo +1.89.0 build -p lending-type \
//     --release --target riscv64imac-unknown-none-elf

use ckb_testtool::builtin::ALWAYS_SUCCESS;
use ckb_testtool::ckb_types::{bytes::Bytes, core::{ScriptHashType, TransactionBuilder}, packed::*, prelude::*};
use ckb_testtool::context::Context;

const MAX_CYCLES: u64 = 10_000_000;

// Loan terms baked into the script args.
const LOAN_AMOUNT: u128 = 1_000;
const REPAY_AMOUNT: u128 = 1_100;
const DEADLINE: u64 = 1_800_000_000;

// Error codes from lending/contracts/src/main.rs
const BAD_ARGS: i8 = 2;
const BAD_LOAN_DATA: i8 = 3;
const BAD_STATE_TRANSITION: i8 = 9;
const ASSET_NOT_IN_INPUTS: i8 = 5;
const ASSET_NOT_OWNED: i8 = 6;
const ASSET_NOT_IN_VAULT: i8 = 7;
const NO_ATTESTATION: i8 = 8;

#[derive(Clone, Copy)]
struct Opts {
    asset_present: bool,
    asset_owner_is_borrower: bool,
    asset_to_vault: bool,
    att_present: bool,
    att_issuer_ok: bool,
    att_subject_ok: bool,
    att_status: u8,
    att_len_ok: bool,
    loan_state: u8,
    loan_in_inputs: bool,
    args_len_ok: bool,
}

impl Opts {
    fn valid() -> Self {
        Opts {
            asset_present: true,
            asset_owner_is_borrower: true,
            asset_to_vault: true,
            att_present: true,
            att_issuer_ok: true,
            att_subject_ok: true,
            att_status: 1,
            att_len_ok: true,
            loan_state: 0,
            loan_in_inputs: false,
            args_len_ok: true,
        }
    }
}

fn run(o: Opts) -> Result<u64, String> {
    let mut ctx = Context::default();
    let lending_bin = std::fs::read(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../target/riscv64imac-unknown-none-elf/release/lending-type"
    ))
    .expect("build lending-type first");
    let lending_op = ctx.deploy_cell(Bytes::from(lending_bin));
    let succ_op = ctx.deploy_cell(ALWAYS_SUCCESS.clone());
    let lock = |ctx: &mut Context, tag: u8| ctx.build_script(&succ_op, Bytes::from(vec![tag])).unwrap();

    let borrower = lock(&mut ctx, 1);
    let issuer = lock(&mut ctx, 2);
    let stranger = lock(&mut ctx, 3);
    let vault = lock(&mut ctx, 4);
    let asset_type = lock(&mut ctx, 9); // any script works as the asset's type
    let loan_token = lock(&mut ctx, 8); // any script works as the loan token's type
    let borrower_hash = borrower.calc_script_hash();

    let mut args = Vec::new();
    args.extend_from_slice(issuer.calc_script_hash().as_slice());
    args.extend_from_slice(asset_type.calc_script_hash().as_slice());
    args.extend_from_slice(loan_token.calc_script_hash().as_slice());
    args.extend_from_slice(&LOAN_AMOUNT.to_le_bytes());
    args.extend_from_slice(&REPAY_AMOUNT.to_le_bytes());
    args.extend_from_slice(&DEADLINE.to_le_bytes());
    if !o.args_len_ok {
        args.pop();
    }
    let loan_type = ctx
        .build_script_with_hash_type(&lending_op, ScriptHashType::Data2, Bytes::from(args))
        .unwrap();

    let mut loan_data = borrower_hash.as_slice().to_vec();
    loan_data.push(o.loan_state);

    let cell = |ctx: &mut Context, lock: &Script, ty: Option<&Script>, data: Vec<u8>| {
        let out = CellOutput::new_builder()
            .capacity(1000u64)
            .lock(lock.clone())
            .type_(ty.cloned().pack())
            .build();
        let op = ctx.create_cell(out.clone(), Bytes::from(data));
        CellInput::new_builder().previous_output(op).build()
    };

    let mut inputs = vec![];
    if o.asset_present {
        let owner = if o.asset_owner_is_borrower { &borrower } else { &stranger };
        inputs.push(cell(&mut ctx, owner, Some(&asset_type), vec![]));
    }
    if o.att_present {
        let mut d = if o.att_subject_ok { borrower_hash.as_slice().to_vec() } else { vec![0xee; 32] };
        d.push(o.att_status);
        if o.att_len_ok {
            d.extend_from_slice(&1_759_500_000u64.to_le_bytes());
        }
        let l = if o.att_issuer_ok { &issuer } else { &stranger };
        inputs.push(cell(&mut ctx, l, None, d));
    }
    if o.loan_in_inputs {
        inputs.push(cell(&mut ctx, &vault, Some(&loan_type), loan_data.clone()));
    }
    if inputs.is_empty() {
        inputs.push(cell(&mut ctx, &stranger, None, vec![]));
    }

    let out = |lock: &Script, ty: Option<&Script>| {
        CellOutput::new_builder()
            .capacity(500u64)
            .lock(lock.clone())
            .type_(ty.cloned().pack())
            .build()
    };
    let asset_lock = if o.asset_to_vault { &vault } else { &borrower };
    let outputs = vec![
        out(asset_lock, Some(&asset_type)),
        out(&vault, Some(&loan_type)),
    ];
    let outputs_data = vec![Bytes::new().pack(), Bytes::from(loan_data).pack()];

    let tx = TransactionBuilder::default()
        .inputs(inputs)
        .outputs(outputs)
        .outputs_data(outputs_data)
        .build();
    let tx = ctx.complete_tx(tx);
    ctx.verify_tx(&tx, MAX_CYCLES).map_err(|e| e.to_string())
}

fn assert_code(r: Result<u64, String>, code: i8) {
    let e = r.expect_err("tx should fail");
    assert!(e.contains(&format!("error code {}", code)), "wanted {code}, got: {e}");
}

#[test]
fn valid_deposit_passes() {
    run(Opts::valid()).expect("valid deposit should verify");
}

#[test]
fn asset_missing() {
    assert_code(run(Opts { asset_present: false, ..Opts::valid() }), ASSET_NOT_IN_INPUTS);
}

#[test]
fn asset_owned_by_someone_else() {
    assert_code(run(Opts { asset_owner_is_borrower: false, ..Opts::valid() }), ASSET_NOT_OWNED);
}

#[test]
fn asset_not_locked_in_vault() {
    assert_code(run(Opts { asset_to_vault: false, ..Opts::valid() }), ASSET_NOT_IN_VAULT);
}

#[test]
fn attestation_missing() {
    assert_code(run(Opts { att_present: false, ..Opts::valid() }), NO_ATTESTATION);
}

#[test]
fn attestation_status_fail() {
    assert_code(run(Opts { att_status: 0, ..Opts::valid() }), NO_ATTESTATION);
}

#[test]
fn attestation_for_other_subject() {
    assert_code(run(Opts { att_subject_ok: false, ..Opts::valid() }), NO_ATTESTATION);
}

#[test]
fn attestation_from_wrong_issuer() {
    assert_code(run(Opts { att_issuer_ok: false, ..Opts::valid() }), NO_ATTESTATION);
}

#[test]
fn attestation_wrong_length() {
    assert_code(run(Opts { att_len_ok: false, ..Opts::valid() }), NO_ATTESTATION);
}

#[test]
fn bad_loan_state() {
    assert_code(run(Opts { loan_state: 1, ..Opts::valid() }), BAD_LOAN_DATA);
}

#[test]
fn redepositing_over_an_existing_loan_cell_rejected() {
    // A loan cell among the inputs makes this a borrow attempt (state 0 -> 0),
    // which fails the state check rather than passing as a second deposit.
    assert_code(run(Opts { loan_in_inputs: true, ..Opts::valid() }), BAD_STATE_TRANSITION);
}

#[test]
fn malformed_script_args() {
    assert_code(run(Opts { args_len_ok: false, ..Opts::valid() }), BAD_ARGS);
}
