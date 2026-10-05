// Tests for the attestation data layout and the mocked verification.
// Run with: npm run test:kyc-attestation

import { ccc } from "@ckb-ccc/core";
import * as assert from "assert";
import {
  STATUS_FAIL,
  STATUS_PASS,
  decodeAttestation,
  encodeAttestation,
  mockVerify,
} from "../../kyc-attestation/scripts/write_attestation";

const lockHash = "0x" + "ab".repeat(32);
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("encodes to 41 bytes: subject | status | issued-at LE", () => {
  const b = ccc.bytesFrom(
    encodeAttestation({ subjectLockHash: lockHash, status: STATUS_PASS, issuedAt: 0x0102030405060708n }),
  );
  assert.strictEqual(b.length, 41);
  assert.deepStrictEqual(Array.from(b.slice(0, 32)), Array(32).fill(0xab));
  assert.strictEqual(b[32], 1);
  assert.deepStrictEqual(Array.from(b.slice(33)), [8, 7, 6, 5, 4, 3, 2, 1]);
});

test("round-trips pass and fail attestations", () => {
  for (const status of [STATUS_PASS, STATUS_FAIL] as const) {
    const a = { subjectLockHash: lockHash, status, issuedAt: 1_759_500_000n };
    assert.deepStrictEqual(decodeAttestation(encodeAttestation(a)), a);
  }
});

test("rejects a subject hash that is not 32 bytes", () => {
  assert.throws(() =>
    encodeAttestation({ subjectLockHash: "0x1234", status: STATUS_PASS, issuedAt: 0n }),
  );
});

test("rejects wrong length and unknown status byte", () => {
  assert.throws(() => decodeAttestation("0x" + "00".repeat(40)));
  const bad = ccc.bytesFrom(
    encodeAttestation({ subjectLockHash: lockHash, status: STATUS_PASS, issuedAt: 0n }),
  );
  bad[32] = 2;
  assert.throws(() => decodeAttestation(ccc.hexFrom(bad)));
});

test("mocked verification passes every subject", () => {
  const lock = ccc.Script.from({ codeHash: lockHash, hashType: "type", args: "0x" });
  assert.strictEqual(mockVerify(lock), STATUS_PASS);
});

console.log(`${passed} passed`);
