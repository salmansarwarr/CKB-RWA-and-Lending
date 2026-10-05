// Tests for rwa-asset-type (Type-ID uniqueness). Build the contract first:
//   RUSTFLAGS="-C target-feature=-a" cargo +1.89.0 build -p rwa-asset-type \
//     --release --target riscv64imac-unknown-none-elf
// (CKB's VM has no atomics; Rust 1.98 ICEs on this flag, so use 1.89.)

use blake2b_ref::Blake2bBuilder;
use ckb_testtool::builtin::ALWAYS_SUCCESS;
use ckb_testtool::ckb_types::{bytes::Bytes, core::{ScriptHashType, TransactionBuilder}, packed::*, prelude::*};
use ckb_testtool::context::Context;

const MAX_CYCLES: u64 = 10_000_000;

// Error codes from asset/contracts/src/main.rs
const BAD_ARGS: i8 = 2;
const BAD_SHAPE: i8 = 3;
const UNIQUENESS_MISMATCH: i8 = 5;

fn type_id(first_input: &CellInput, index: u64) -> [u8; 32] {
    let mut h = Blake2bBuilder::new(32).personal(b"ckb-default-hash").build();
    h.update(first_input.as_slice());
    h.update(&index.to_le_bytes());
    let mut out = [0u8; 32];
    h.finalize(&mut out);
    out
}

struct Env {
    ctx: Context,
    asset_op: OutPoint,
    lock: Script,
}

fn env() -> Env {
    let mut ctx = Context::default();
    let bin = std::fs::read(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../target/riscv64imac-unknown-none-elf/release/rwa-asset-type"
    ))
    .expect("build rwa-asset-type first");
    let asset_op = ctx.deploy_cell(Bytes::from(bin));
    let succ = ctx.deploy_cell(ALWAYS_SUCCESS.clone());
    let lock = ctx.build_script(&succ, Bytes::from(vec![1])).unwrap();
    Env { ctx, asset_op, lock }
}

impl Env {
    fn asset_type(&mut self, args: Vec<u8>) -> Script {
        self.ctx
            .build_script_with_hash_type(&self.asset_op, ScriptHashType::Data2, Bytes::from(args))
            .unwrap()
    }

    fn input(&mut self, ty: Option<&Script>) -> CellInput {
        let out = CellOutput::new_builder()
            .capacity(1000u64)
            .lock(self.lock.clone())
            .type_(ty.cloned().pack())
            .build();
        let op = self.ctx.create_cell(out, Bytes::new());
        CellInput::new_builder().previous_output(op).build()
    }

    fn output(&self, ty: Option<&Script>) -> CellOutput {
        CellOutput::new_builder()
            .capacity(500u64)
            .lock(self.lock.clone())
            .type_(ty.cloned().pack())
            .build()
    }

    fn verify(&mut self, inputs: Vec<CellInput>, outputs: Vec<CellOutput>) -> Result<u64, String> {
        let data = vec![Bytes::new().pack(); outputs.len()];
        let tx = TransactionBuilder::default()
            .inputs(inputs)
            .outputs(outputs)
            .outputs_data(data)
            .build();
        let tx = self.ctx.complete_tx(tx);
        self.ctx.verify_tx(&tx, MAX_CYCLES).map_err(|e| e.to_string())
    }
}

fn assert_code(r: Result<u64, String>, code: i8) {
    let e = r.expect_err("tx should fail");
    assert!(e.contains(&format!("error code {}", code)), "wanted {code}, got: {e}");
}

#[test]
fn valid_issuance_passes() {
    let mut e = env();
    let first = e.input(None);
    let ty = e.asset_type(type_id(&first, 0).to_vec());
    let out = e.output(Some(&ty));
    e.verify(vec![first], vec![out]).expect("issuance should verify");
}

#[test]
fn issuance_with_arbitrary_args_fails() {
    let mut e = env();
    let first = e.input(None);
    let ty = e.asset_type(vec![0x42; 32]);
    let out = e.output(Some(&ty));
    assert_code(e.verify(vec![first], vec![out]), UNIQUENESS_MISMATCH);
}

#[test]
fn issuance_with_wrong_output_index_fails() {
    let mut e = env();
    let first = e.input(None);
    let ty = e.asset_type(type_id(&first, 1).to_vec());
    let out = e.output(Some(&ty));
    assert_code(e.verify(vec![first], vec![out]), UNIQUENESS_MISMATCH);
}

#[test]
fn reusing_args_from_another_issuance_fails() {
    // Args derived from a different first input cannot be replayed.
    let mut e = env();
    let other_first = e.input(None);
    let ty = e.asset_type(type_id(&other_first, 0).to_vec());
    let first = e.input(None);
    let out = e.output(Some(&ty));
    assert_code(e.verify(vec![first], vec![out]), UNIQUENESS_MISMATCH);
}

#[test]
fn malformed_args_fail() {
    let mut e = env();
    let first = e.input(None);
    let ty = e.asset_type(vec![0; 31]);
    let out = e.output(Some(&ty));
    assert_code(e.verify(vec![first], vec![out]), BAD_ARGS);
}

#[test]
fn two_asset_outputs_in_one_issuance_fail() {
    let mut e = env();
    let first = e.input(None);
    let ty = e.asset_type(type_id(&first, 0).to_vec());
    let outs = vec![e.output(Some(&ty)), e.output(Some(&ty))];
    assert_code(e.verify(vec![first], outs), BAD_SHAPE);
}

#[test]
fn transfer_keeps_identity() {
    let mut e = env();
    let ty = e.asset_type(vec![0x42; 32]);
    let input = e.input(Some(&ty));
    let out = e.output(Some(&ty));
    e.verify(vec![input], vec![out]).expect("transfer should verify");
}

#[test]
fn destruction_is_allowed() {
    let mut e = env();
    let ty = e.asset_type(vec![0x42; 32]);
    let input = e.input(Some(&ty));
    let out = e.output(None);
    e.verify(vec![input], vec![out]).expect("retiring a claim should verify");
}

#[test]
fn duplicating_an_existing_asset_fails() {
    let mut e = env();
    let ty = e.asset_type(vec![0x42; 32]);
    let input = e.input(Some(&ty));
    let outs = vec![e.output(Some(&ty)), e.output(Some(&ty))];
    assert_code(e.verify(vec![input], outs), BAD_SHAPE);
}
