Repository: ckb-rwa-asset-adapter
Objective:
Build a reference implementation showing how an established externally issued asset such as PAXG can be represented on CKB, connected to an oracle, consumed by DeFi, and exposed through wallet/application metadata.
Core scope
CKB Asset Representation
Define the CKB-side token representation for PAXG.
Document:
token type
decimals
supply model
issuance authority
mint/burn assumptions
relationship between the CKB representation and the external asset
Implement the required CKB scripts/contracts using existing CKB token infrastructure where practical.
Add unit/integration tests.
Oracle Adapter
Create an adapter for the PAXG/USD price.
Define the on-chain price format.
Include:
timestamp
freshness threshold
stale-price detection
failure handling
Keep this as an adapter, not a new oracle network.
DeFi Integration
Integrate the CKB representation with one CKB DeFi protocol/application.
Demonstrate:
asset identification
oracle price retrieval
use of the asset in a DeFi transaction
successful CKB transaction
Testnet swap/liquidity or collateral usage if technically practical.
Wallet & Metadata
Define standard metadata for the asset:
name
symbol
decimals
issuer
external asset reference
CKB type/script information
logo/metadata location
Provide integration instructions for wallets/applications.
End-to-End Testnet Demo
Deploy the components to CKB testnet.
Provide:
deployment information
transaction hashes
example transactions
configuration
reproduction instructions
Suggested repository structure
ckb-rwa-asset-adapter/
│
├── contracts/
│   └── rwa-asset/
│
├── oracle/
│   └── paxg-adapter/
│
├── integration/
│   └── defi/
│
├── metadata/
│   └── paxg.json
│
├── scripts/
│   ├── deploy/
│   └── testnet/
│
├── tests/
│   ├── asset/
│   ├── oracle/
│   └── integration/
│
├── docs/
│   ├── architecture.md
│   ├── asset-model.md
│   ├── oracle.md
│   ├── defi-integration.md
│   └── wallet-integration.md
│
├── examples/
│
└── README.md
What the README should communicate
Problem
There is currently no simple, standardized reference path for taking an established externally issued RWA and making it usable as a CKB DeFi asset.
Solution
This repository provides a reference implementation for the technical pipeline:
PAXG → CKB Asset Representation → Price Oracle → DeFi → Wallet/Application

