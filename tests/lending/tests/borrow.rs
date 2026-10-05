// Borrow-step tests for lending-type. See deposit.rs for how to build the
// contract first.

use ckb_testtool::builtin::ALWAYS_SUCCESS;
use ckb_testtool::ckb_types::{bytes::Bytes, core::{ScriptHashType, TransactionBuilder}, packed::*, prelude::*};
use ckb_testtool::context::Context;

const MAX_CYCLES: u64 = 10_000_000;

const LOAN_AMOUNT: u128 = 1_000;
const REPAY_AMOUNT: u128 = 1_100;
const DEADLINE: u64 = 1_800_000_000;

// Error codes from lending/contracts/src/main.rs
const UNSUPPORTED: i8 = 4;
const BAD_STATE_TRANSITION: i8 = 9;
const VAULT_CHANGED: i8 = 10;
const COLLATERAL_MOVED: i8 = 11;
const LOAN_NOT_PAID: i8 = 12;

#[derive(Clone)]
struct Opts {
    input_state: u8,
    output_state: u8,
    output_borrower_ok: bool,
    output_vault_ok: bool,
    token_outputs: Vec<(u128, bool, bool)>, // (amount, locked by borrower, token type ok)
    spend_asset: bool,
}

impl Opts {
    fn valid() -> Self {
        Opts {
            input_state: 0,
            output_state: 1,
            output_borrower_ok: true,
            output_vault_ok: true,
            token_outputs: vec![(LOAN_AMOUNT, true, true)],
            spend_asset: false,
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
    let other_vault = lock(&mut ctx, 5);
    let loan_token = lock(&mut ctx, 8);
    let asset_type = lock(&mut ctx, 9);
    let wrong_token = lock(&mut ctx, 10);
    let borrower_hash = borrower.calc_script_hash();

    let mut args = Vec::new();
    args.extend_from_slice(issuer.calc_script_hash().as_slice());
    args.extend_from_slice(asset_type.calc_script_hash().as_slice());
    args.extend_from_slice(loan_token.calc_script_hash().as_slice());
    args.extend_from_slice(&LOAN_AMOUNT.to_le_bytes());
    args.extend_from_slice(&REPAY_AMOUNT.to_le_bytes());
    args.extend_from_slice(&DEADLINE.to_le_bytes());
    let loan_type = ctx
        .build_script_with_hash_type(&lending_op, ScriptHashType::Data2, Bytes::from(args))
        .unwrap();

    let loan_data = |borrower_hash: &[u8], state: u8| {
        let mut d = borrower_hash.to_vec();
        d.push(state);
        d
    };

    let cell = |ctx: &mut Context, lock: &Script, ty: Option<&Script>, data: Vec<u8>| {
        let out = CellOutput::new_builder()
            .capacity(1000u64)
            .lock(lock.clone())
            .type_(ty.cloned().pack())
            .build();
        let op = ctx.create_cell(out, Bytes::from(data));
        CellInput::new_builder().previous_output(op).build()
    };

    let mut inputs = vec![cell(
        &mut ctx,
        &vault,
        Some(&loan_type),
        loan_data(borrower_hash.as_slice(), o.input_state),
    )];
    if o.spend_asset {
        inputs.push(cell(&mut ctx, &vault, Some(&asset_type), vec![]));
    }

    let out = |lock: &Script, ty: Option<&Script>| {
        CellOutput::new_builder()
            .capacity(500u64)
            .lock(lock.clone())
            .type_(ty.cloned().pack())
            .build()
    };
    let out_borrower = if o.output_borrower_ok { borrower_hash.as_slice().to_vec() } else { vec![0xee; 32] };
    let out_vault = if o.output_vault_ok { &vault } else { &other_vault };
    let mut outputs = vec![out(out_vault, Some(&loan_type))];
    let mut outputs_data = vec![Bytes::from(loan_data(&out_borrower, o.output_state)).pack()];
    for (amount, to_borrower, token_ok) in &o.token_outputs {
        let l = if *to_borrower { &borrower } else { &stranger };
        let t = if *token_ok { &loan_token } else { &wrong_token };
        outputs.push(out(l, Some(t)));
        outputs_data.push(Bytes::from(amount.to_le_bytes().to_vec()).pack());
    }

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
fn valid_borrow_passes() {
    run(Opts::valid()).expect("valid borrow should verify");
}

#[test]
fn borrow_more_than_loan_amount_passes() {
    run(Opts { token_outputs: vec![(LOAN_AMOUNT + 1, true, true)], ..Opts::valid() }).unwrap();
}

#[test]
fn loan_split_across_cells_passes() {
    let split = vec![(LOAN_AMOUNT / 2, true, true), (LOAN_AMOUNT / 2, true, true)];
    run(Opts { token_outputs: split, ..Opts::valid() }).unwrap();
}

#[test]
fn no_tokens_released() {
    assert_code(run(Opts { token_outputs: vec![], ..Opts::valid() }), LOAN_NOT_PAID);
}

#[test]
fn amount_too_small() {
    assert_code(run(Opts { token_outputs: vec![(LOAN_AMOUNT - 1, true, true)], ..Opts::valid() }), LOAN_NOT_PAID);
}

#[test]
fn tokens_go_to_someone_else() {
    assert_code(run(Opts { token_outputs: vec![(LOAN_AMOUNT, false, true)], ..Opts::valid() }), LOAN_NOT_PAID);
}

#[test]
fn wrong_token_type() {
    assert_code(run(Opts { token_outputs: vec![(LOAN_AMOUNT, true, false)], ..Opts::valid() }), LOAN_NOT_PAID);
}

#[test]
fn state_not_advanced() {
    assert_code(run(Opts { output_state: 0, ..Opts::valid() }), BAD_STATE_TRANSITION);
}

#[test]
fn state_skips_to_repaid() {
    assert_code(run(Opts { output_state: 2, ..Opts::valid() }), BAD_STATE_TRANSITION);
}

#[test]
fn borrower_rewritten() {
    assert_code(run(Opts { output_borrower_ok: false, ..Opts::valid() }), BAD_STATE_TRANSITION);
}

#[test]
fn vault_lock_changed() {
    assert_code(run(Opts { output_vault_ok: false, ..Opts::valid() }), VAULT_CHANGED);
}

#[test]
fn collateral_spent_during_borrow() {
    assert_code(run(Opts { spend_asset: true, ..Opts::valid() }), COLLATERAL_MOVED);
}

#[test]
fn borrowing_twice_is_unsupported() {
    // Input already in state borrowed: handled by repay, not borrow.
    assert_code(run(Opts { input_state: 1, output_state: 1, ..Opts::valid() }), UNSUPPORTED);
}

#[test]
fn unknown_input_state_is_unsupported() {
    assert_code(run(Opts { input_state: 7, ..Opts::valid() }), UNSUPPORTED);
}
