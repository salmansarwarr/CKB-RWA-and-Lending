#!/usr/bin/env bash
# Runs the full end-to-end demo on CKB testnet and records every tx hash:
#   deploy -> issue asset -> mocked KYC attestation -> deposit -> borrow
#   -> repay -> release
#
# Needs a funded PRIVATE_KEY (issuer, ~75,000 testnet CKB for the contracts)
# and BORROWER_PRIVATE_KEY (a second key; a few hundred CKB is plenty) in .env.
#
#   ./scripts/testnet/demo.sh            # resumes: deploys only if not deployed
#   ./scripts/testnet/demo.sh --fresh    # keep the deployed contracts, rerun the flow
set -euo pipefail
cd "$(dirname "$0")/../.."

run() { echo; echo "==> $*"; npx ts-node "$@"; }

if [[ "${1:-}" == "--fresh" ]]; then
  npx ts-node scripts/testnet/reset_flow.ts
fi

if ! grep -q '"lending"' scripts/deploy/deployment.testnet.json 2>/dev/null; then
  ./scripts/deploy/deploy.sh
else
  echo "contracts already deployed (scripts/deploy/deployment.testnet.json); skipping deploy"
fi

run asset/scripts/issue_asset.ts
run kyc-attestation/scripts/write_attestation.ts
run lending/scripts/deposit.ts
run lending/scripts/borrow.ts
run lending/scripts/fund_interest.ts
run lending/scripts/repay.ts
run lending/scripts/release.ts
run scripts/deploy/record_docs.ts

echo
echo "Done. Hashes are in docs/testnet-deployment.md and scripts/deploy/deployment.testnet.json."
