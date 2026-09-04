# CKB RWA Asset Adapter

A reference implementation demonstrating how an established externally issued real-world asset (RWA), such as **PAX Gold (PAXG)**, can be represented on **Nervos CKB**, connected to a price oracle, consumed by DeFi applications, and exposed through wallet/application metadata.

## Overview

The project demonstrates the complete technical pipeline:

**PAXG → CKB Asset Representation → Price Oracle → DeFi → Wallet/Application**

The goal is to provide a practical and reproducible reference for bringing established external assets into the CKB ecosystem without creating a new oracle network or redefining the underlying external asset.

---

## Problem

There is currently no simple, standardized reference path for taking an established externally issued RWA and making it usable as a CKB DeFi asset.

Projects integrating external assets need to address several independent concerns:

* How the external asset is represented on CKB
* How the representation is identified and verified
* How its external market price is made available on-chain
* How DeFi applications consume the asset and its price
* How wallets and applications identify and display the asset
* How the complete system can be deployed and reproduced on CKB testnet

This repository addresses these concerns through a single reference implementation.

---

## Solution

This repository provides a reference implementation for the technical pipeline:

```text
┌───────────────┐
│     PAXG      │
│ External RWA  │
└───────┬───────┘
        │
        ▼
┌───────────────────────┐
│ CKB Asset             │
│ Representation        │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Oracle Adapter        │
│ PAXG / USD Price      │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ CKB DeFi Application  │
│ Swap / Liquidity /    │
│ Collateral             │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Wallet / Application  │
│ Metadata              │
└───────────────────────┘
```

The implementation focuses on **adapting an existing externally issued asset to CKB**, rather than creating a new asset issuer or oracle network.

---

# Objectives

The project covers five main areas:

1. **CKB Asset Representation**
2. **Oracle Adapter**
3. **DeFi Integration**
4. **Wallet & Application Metadata**
5. **End-to-End CKB Testnet Demonstration**

---

# 1. CKB Asset Representation

The first component defines how PAXG is represented on CKB.

The implementation documents and demonstrates:

* Token type
* Token symbol
* Decimals
* Supply model
* Issuance authority
* Mint/burn assumptions
* External asset reference
* Relationship between the CKB representation and the underlying PAXG asset

Where practical, the implementation uses existing CKB token infrastructure instead of introducing unnecessary custom token logic.

### Asset Model

The CKB representation should clearly distinguish between:

```text
External Asset
     │
     │ represents / corresponds to
     ▼
CKB Asset Representation
```

The CKB-side representation does **not automatically imply ownership of the underlying external PAXG**. The relationship between the CKB asset and the external asset must be explicitly defined and documented.

### Implementation

Asset-related contracts and scripts are located under:

```text
contracts/rwa-asset/
```

Tests are located under:

```text
tests/asset/
```

---

# 2. Oracle Adapter

The second component provides a PAXG/USD price adapter.

The adapter is intentionally designed as an **oracle adapter**, not as a new oracle network.

Its responsibility is to consume an existing price source and transform the information into a format that can be consumed by CKB applications and smart contracts.

### Oracle Data

The on-chain price representation includes:

* PAXG/USD price
* Timestamp
* Price precision / scale
* Freshness threshold
* Stale-price detection
* Failure handling

Conceptually:

```text
External Price Source
        │
        ▼
┌─────────────────┐
│ PAXG Oracle     │
│ Adapter         │
└────────┬────────┘
         │
         ▼
   CKB Price Data
```

### Stale Price Handling

A price should only be considered valid when:

```text
current_time - price_timestamp <= freshness_threshold
```

If the price exceeds the configured freshness threshold, the integration should treat the price as stale and prevent operations that depend on a valid price.

### Failure Handling

The adapter should define behavior for:

* Missing price data
* Invalid price data
* Stale prices
* Unexpected price format
* Oracle/source availability failures

Oracle-related implementation is located under:

```text
oracle/paxg-adapter/
```

Tests are located under:

```text
tests/oracle/
```

---

# 3. DeFi Integration

The CKB-side representation is integrated with **one CKB DeFi protocol or application**.

The integration demonstrates the complete asset consumption flow:

1. Identify the CKB asset
2. Retrieve the PAXG/USD oracle price
3. Validate price freshness
4. Construct a DeFi transaction
5. Submit the transaction to CKB
6. Verify the resulting transaction

Where technically practical, the testnet demonstration may include:

* Token swap
* Liquidity provision
* Collateral usage
* Other supported DeFi operations

The exact operation depends on the capabilities and integration requirements of the selected CKB DeFi application.

DeFi integration code is located under:

```text
integration/defi/
```

Integration tests are located under:

```text
tests/integration/
```

---

# 4. Wallet & Application Metadata

The project defines standardized metadata allowing wallets and applications to identify the CKB representation of PAXG.

Example metadata:

```json
{
  "name": "PAX Gold",
  "symbol": "PAXG",
  "decimals": 18,
  "issuer": "Paxos",
  "external_asset": {
    "name": "PAX Gold",
    "symbol": "PAXG",
    "reference": "..."
  },
  "ckb": {
    "type_script": "...",
    "lock_script": "...",
    "code_hash": "...",
    "hash_type": "type"
  },
  "logo": "...",
  "metadata": "..."
}
```

The exact fields and values should be finalized according to the deployed CKB representation.

The metadata is located under:

```text
metadata/paxg.json
```

Documentation for wallet and application integration is available at:

```text
docs/wallet-integration.md
```

---

# 5. End-to-End Testnet Demo

The final objective is to deploy the components to **CKB testnet** and provide a reproducible demonstration.

The testnet deployment should document:

* Contract deployment information
* Script/code hashes
* Type script information
* Oracle configuration
* DeFi configuration
* Transaction hashes
* Example transactions
* Required environment variables
* Wallet configuration
* Reproduction steps

Example flow:

```text
1. Deploy asset contracts
          ↓
2. Configure asset representation
          ↓
3. Configure PAXG oracle adapter
          ↓
4. Deploy/configure DeFi integration
          ↓
5. Configure wallet metadata
          ↓
6. Mint/obtain testnet representation
          ↓
7. Retrieve PAXG/USD price
          ↓
8. Execute DeFi transaction
          ↓
9. Verify transaction on CKB testnet
```

Deployment and testnet scripts are located under:

```text
scripts/deploy/
scripts/testnet/
```

---

# Repository Structure

```text
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
```

---

# Architecture

At a high level, the system consists of four layers:

### 1. External Asset Layer

The underlying externally issued asset:

```text
PAXG
```

This layer remains governed by the external issuer and its existing asset infrastructure.

### 2. CKB Representation Layer

A CKB-side representation identifies and tracks the asset within the CKB ecosystem.

```text
PAXG
  │
  ▼
CKB Asset
```

### 3. Oracle Layer

The oracle adapter provides an on-chain representation of the external asset's market price.

```text
PAXG/USD
   │
   ▼
Oracle Adapter
   │
   ▼
CKB
```

### 4. Application Layer

CKB DeFi protocols, wallets, and applications consume the asset representation and associated metadata.

```text
                ┌─── DeFi
                │
PAXG → CKB Asset ─── Wallet
                │
                └── Applications
```

---

# Documentation

Detailed documentation is organized as follows:

| Document                                                   | Description                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)             | Overall system architecture and component interactions               |
| [`docs/asset-model.md`](docs/asset-model.md)               | CKB asset representation, supply, issuance and external relationship |
| [`docs/oracle.md`](docs/oracle.md)                         | Oracle adapter, price format, freshness and failure handling         |
| [`docs/defi-integration.md`](docs/defi-integration.md)     | DeFi integration and transaction flow                                |
| [`docs/wallet-integration.md`](docs/wallet-integration.md) | Wallet and application metadata integration                          |

---

# Getting Started

## Prerequisites

The exact requirements depend on the selected CKB tooling and DeFi integration.

At minimum, development requires:

* Git
* Rust
* CKB development tooling
* Node.js / npm where required
* A CKB testnet wallet
* CKB testnet access

---

## Clone the Repository

```bash
git clone <repository-url>
cd ckb-rwa-asset-adapter
```

---

## Install Dependencies

Install the dependencies required by the contracts, oracle adapter, and integration components.

```bash
# Example
npm install
```

If individual components have separate dependencies, follow the instructions in their respective directories.

---

# Configuration

Create the required environment configuration for testnet deployment.

Example:

```env
CKB_NETWORK=testnet

# CKB RPC
CKB_RPC_URL=

# Deployment wallet
PRIVATE_KEY=

# Oracle configuration
PAXG_PRICE_SOURCE=
PAXG_PRICE_FRESHNESS_THRESHOLD=

# DeFi configuration
DEFI_CONTRACT_ADDRESS=
```

**Never commit private keys or other secrets to the repository.**

---

# Testing

Run the asset representation tests:

```bash
npm run test:asset
```

Run the oracle adapter tests:

```bash
npm run test:oracle
```

Run the integration tests:

```bash
npm run test:integration
```

Run the complete test suite:

```bash
npm test
```

The exact commands may be updated to match the final project tooling.

---

# Testnet Deployment

Deploy the required contracts and configuration:

```bash
./scripts/deploy/deploy.sh
```

Configure the testnet environment:

```bash
./scripts/testnet/configure.sh
```

Run the end-to-end demonstration:

```bash
./scripts/testnet/demo.sh
```

The final implementation should replace these examples with the actual commands used by the project.

---

# Testnet Deployment Information

After deployment, this section should contain the actual deployed configuration.

### Network

```text
CKB Testnet
```

### Asset

```text
Name:
Symbol:
Decimals:
Type Script:
Code Hash:
Type ID:
```

### Oracle

```text
Price Source:
Oracle Adapter:
Price Format:
Freshness Threshold:
```

### DeFi

```text
Protocol:
Integration Contract:
Example Transaction:
```

### Example Transactions

```text
Asset deployment:
<transaction-hash>

Oracle configuration:
<transaction-hash>

DeFi transaction:
<transaction-hash>
```

Transaction hashes should link to the appropriate CKB testnet explorer.

---

# End-to-End Example

A successful demonstration should show the following flow:

```text
PAXG
 │
 │ External asset
 ▼
CKB Asset Representation
 │
 │ Asset identification
 ▼
PAXG/USD Oracle Adapter
 │
 │ Price + timestamp
 ▼
CKB DeFi Application
 │
 │ Swap / liquidity / collateral
 ▼
CKB Testnet Transaction
 │
 ▼
Wallet / Application
```

The demo should provide enough information for another developer to reproduce the same flow from a clean environment.

---

# Design Principles

## Use Existing CKB Infrastructure

The implementation should reuse established CKB token and scripting infrastructure wherever practical instead of introducing unnecessary custom primitives.

## Adapter, Not New Oracle Network

The oracle component is an adapter between an existing price source and CKB.

It does not attempt to create a new decentralized oracle network.

## Explicit Asset Relationship

The implementation must clearly distinguish between:

* The externally issued PAXG asset
* The CKB-side representation
* The mechanism establishing the relationship between them

A CKB token representation should not implicitly claim that it is the underlying asset.

## Verifiable On-Chain State

Important information required by DeFi applications should be represented in a way that can be independently verified from CKB state and transactions.

## Reproducible Testnet Deployment

The project should prioritize reproducibility. A developer should be able to follow the documentation, deploy the required components, and execute the demonstration without relying on undocumented manual steps.

---

# Scope & Limitations

This repository is a **reference implementation** rather than a production-ready bridge or custody system.

In particular:

* It does not create PAXG.
* It does not replace the external PAXG issuer.
* It does not establish ownership of external PAXG merely by creating a CKB token.
* It does not introduce a new oracle network.
* Testnet deployment does not imply production security or economic guarantees.
* Production deployment would require additional security, custody, legal, operational, and economic considerations.

The exact trust model between the CKB representation and the external asset must be explicitly documented before production use.

---

# Security Considerations

Before production deployment, the following areas require additional review:

* Asset issuance and mint/burn authorization
* Custody and redemption mechanisms
* Oracle manipulation resistance
* Oracle freshness guarantees
* Replay protection
* Contract authorization
* Upgradeability
* DeFi integration assumptions
* Administrative key management
* Failure and recovery procedures
* External issuer dependencies

The testnet implementation should clearly document which security assumptions are simplified for demonstration purposes.

---

# Future Work

Potential future extensions include:

* Support for additional RWAs
* Multiple external price sources
* Additional CKB DeFi protocols
* Automated oracle updates
* Standardized RWA metadata schemas
* Wallet-native asset discovery
* Redemption / settlement workflows
* Proof-of-reserves integration
* Cross-chain asset verification
* Production-grade monitoring
* Formal verification and security audits

---

# Contributing

Contributions are welcome.

When contributing:

1. Keep components modular.
2. Add tests for new functionality.
3. Update the relevant documentation.
4. Avoid introducing custom infrastructure when an established CKB primitive can be reused.
5. Clearly document security assumptions and trust boundaries.
6. Keep testnet reproduction steps up to date.

---

# License

Add the project's applicable license here.

---

# Summary

This repository demonstrates a practical reference path for bringing an established external RWA into the CKB ecosystem:

```text
┌─────────┐
│  PAXG   │
└────┬────┘
     │
     ▼
┌─────────────────────┐
│ CKB Asset           │
│ Representation      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ PAXG/USD            │
│ Oracle Adapter      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ CKB DeFi            │
│ Integration         │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Wallet / Application│
│ Metadata             │
└─────────────────────┘
```

**PAXG → CKB Asset Representation → Price Oracle → DeFi → Wallet/Application**

The resulting implementation serves as a technical reference for how established externally issued assets can be represented, priced, consumed, and surfaced within the CKB ecosystem.
