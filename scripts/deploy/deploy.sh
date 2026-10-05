#!/usr/bin/env bash
# Builds the on-chain contracts and deploys them to CKB testnet.
# Needs PRIVATE_KEY (funded, ~75,000 testnet CKB) in .env; see .env.example.
set -euo pipefail
cd "$(dirname "$0")/../.."

npm run build:contracts
npx ts-node scripts/deploy/deploy.ts "$@"
