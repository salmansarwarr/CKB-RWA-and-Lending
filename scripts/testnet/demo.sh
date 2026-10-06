#!/usr/bin/env bash
# Runs the full end-to-end demo on CKB testnet and records every tx hash:
#   deploy -> issue asset -> mocked KYC attestation -> deposit -> borrow
#   -> repay -> release
#
# Needs a funded PRIVATE_KEY (issuer, ~75,000 testnet CKB for the contracts)
# and BORROWER_PRIVATE_KEY (a second key; a few hundred CKB is plenty) in .env.
#
#   ./scripts/testnet/demo.sh            # resumes: skips steps already recorded
#   ./scripts/testnet/demo.sh --fresh    # keep the deployed contracts, rerun the flow
set -euo pipefail
cd "$(dirname "$0")/../.."

# step <recorded-key> <script>: runs the script unless its tx hash is already
# recorded, so an interrupted demo resumes where it stopped.
step() {
  local key="$1"; shift
  if grep -q "\"$key\":" scripts/deploy/deployment.testnet.json 2>/dev/null; then
    echo; echo "==> $key already recorded; skipping"
  else
    echo; echo "==> $*"; npx ts-node "$@"
  fi
}

if [[ "${1:-}" == "--fresh" ]]; then
  npx ts-node scripts/testnet/reset_flow.ts
fi

if ! grep -q '"lending"' scripts/deploy/deployment.testnet.json 2>/dev/null; then
  ./scripts/deploy/deploy.sh
else
  echo "contracts already deployed (scripts/deploy/deployment.testnet.json); skipping deploy"
fi

step issue_asset asset/scripts/issue_asset.ts
step kyc_attestation kyc-attestation/scripts/write_attestation.ts
step deposit lending/scripts/deposit.ts
step borrow lending/scripts/borrow.ts
step fund_interest lending/scripts/fund_interest.ts
step repay lending/scripts/repay.ts
step release lending/scripts/release.ts
npx ts-node scripts/deploy/record_docs.ts

echo
echo "Done. Hashes are in docs/testnet-deployment.md and scripts/deploy/deployment.testnet.json."
