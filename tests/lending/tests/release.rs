// Release-step tests for lending-type. See deposit.rs for how to build the
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
const ASSET_NOT_IN_INPUTS: i8 = 5;
const LOAN_NOT_REPAID: i8 = 17;
const ASSET_NOT_RETURNED: i8 = 18;

#[derive(Clone)]
struct Opts {
    input_state: u8,
    collateral_in_inputs: bool,
    collateral_held_by_vault: bool,
    asset_returned: bool,
    returned_to_borrower: bool,
    // Re-creating the loan cell instead of retiring it.
    extra_loan_output: bool,
}

impl Opts {
    fn valid() -> Self {
        Opts {
            input_state: 2,
            collateral_in_inputs: true,
            collateral_held_by_vault: true,
            asset_returned: true,
            returned_to_borrower: true,
            extra_loan_output: false,
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
    let loan_token = lock(&mut ctx, 8);
    let asset_type = lock(&mut ctx, 9);
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

    let loan_data = |state: u8| {
        let mut d = borrower_hash.as_slice().to_vec();
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

    let mut inputs = vec![cell(&mut ctx, &vault, Some(&loan_type), loan_data(o.input_state))];
    if o.collateral_in_inputs {
        let holder = if o.collateral_held_by_vault { &vault } else { &stranger };
        inputs.push(cell(&mut ctx, holder, Some(&asset_type), vec![]));
    }

    let out = |lock: &Script, ty: Option<&Script>| {
        CellOutput::new_builder()
            .capacity(500u64)
            .lock(lock.clone())
            .type_(ty.cloned().pack())
            .build()
    };
    let mut outputs = vec![];
    let mut outputs_data = vec![];
    if o.asset_returned {
        let owner = if o.returned_to_borrower { &borrower } else { &stranger };
        outputs.push(out(owner, Some(&asset_type)));
        outputs_data.push(Bytes::new().pack());
    }
    if o.extra_loan_output {
        outputs.push(out(&vault, Some(&loan_type)));
        outputs_data.push(Bytes::from(loan_data(2)).pack());
    }
    if outputs.is_empty() {
        // A tx needs at least one output; use an unrelated one.
        outputs.push(out(&stranger, None));
        outputs_data.push(Bytes::new().pack());
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
fn valid_release_passes() {
    run(Opts::valid()).expect("valid release should verify");
}

#[test]
fn release_before_borrowing() {
    assert_code(run(Opts { input_state: 0, ..Opts::valid() }), LOAN_NOT_REPAID);
}

#[test]
fn release_while_loan_outstanding() {
    assert_code(run(Opts { input_state: 1, ..Opts::valid() }), LOAN_NOT_REPAID);
}

#[test]
fn collateral_not_among_inputs() {
    assert_code(run(Opts { collateral_in_inputs: false, ..Opts::valid() }), ASSET_NOT_IN_INPUTS);
}

#[test]
fn input_asset_not_held_by_vault() {
    assert_code(run(Opts { collateral_held_by_vault: false, ..Opts::valid() }), ASSET_NOT_IN_INPUTS);
}

#[test]
fn collateral_not_recreated() {
    assert_code(run(Opts { asset_returned: false, ..Opts::valid() }), ASSET_NOT_RETURNED);
}

#[test]
fn collateral_sent_to_someone_else() {
    assert_code(run(Opts { returned_to_borrower: false, ..Opts::valid() }), ASSET_NOT_RETURNED);
}

#[test]
fn keeping_the_loan_cell_alive_is_not_a_release() {
    // A repaid loan cell can only be retired; re-creating it is unsupported.
    assert_code(run(Opts { extra_loan_output: true, ..Opts::valid() }), UNSUPPORTED);
}
