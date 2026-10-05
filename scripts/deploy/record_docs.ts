// Renders scripts/deploy/deployment.testnet.json into the marked block of
// docs/testnet-deployment.md, so the recorded hashes are copied, not typed.
//
//   npx ts-node scripts/deploy/record_docs.ts

import * as fs from "fs";
import * as path from "path";
import { Deployment, ROOT, explorerTx, readDeployment } from "../lib/common";

const DOC = path.join(ROOT, "docs/testnet-deployment.md");
const BEGIN = "<!-- BEGIN deployment-record -->";
const END = "<!-- END deployment-record -->";

const STEPS: [string, string][] = [
  ["deploy", "Contracts deployed (asset + lending code cells)"],
  ["issue_asset", "1. RWA asset issued"],
  ["kyc_attestation", "2. KYC attestation written (mocked verification)"],
  ["deposit", "3. Deposit (collateral locked + loan cell)"],
  ["borrow", "4. Borrow (loan released to borrower)"],
  ["fund_interest", "   Interest tokens minted to borrower (demo setup)"],
  ["repay", "5. Repay (before deadline)"],
  ["release", "6. Release (collateral returned)"],
];

export function render(d: Deployment): string {
  const out: string[] = [];
  const pending = Object.keys(d.transactions).length === 0 && !d.contracts.asset;
  if (pending) {
    out.push("_Not deployed yet. Run `./scripts/testnet/demo.sh`, which fills this in._");
    return out.join("\n");
  }

  out.push("### Transactions", "", "| Step | Transaction |", "| --- | --- |");
  for (const [key, label] of STEPS) {
    const h = d.transactions[key];
    out.push(`| ${label} | ${h ? `[\`${h}\`](${explorerTx(h)})` : "_not run_"} |`);
  }

  out.push("", "### Contracts", "", "| Contract | Code hash (data hash) | Hash type | Cell dep |", "| --- | --- | --- | --- |");
  for (const [name, c] of Object.entries(d.contracts)) {
    if (!c) continue;
    const dep = `${c.cellDep.txHash}:${c.cellDep.index}`;
    out.push(`| ${name} | \`${c.codeHash}\` | ${c.hashType} | [\`${dep}\`](${explorerTx(c.cellDep.txHash)}) |`);
  }

  if (d.asset) {
    const t = d.asset.typeScript;
    out.push("", "### RWA asset type script", "", "```json", JSON.stringify(t, null, 2), "```");
  }
  if (d.loan) {
    out.push("", "### Loan type script and terms", "", "```json", JSON.stringify(d.loan, null, 2), "```");
  }
  return out.join("\n");
}

function main() {
  const doc = fs.readFileSync(DOC, "utf8");
  const i = doc.indexOf(BEGIN);
  const j = doc.indexOf(END);
  if (i < 0 || j < i) throw new Error(`${DOC} is missing the ${BEGIN} / ${END} markers`);
  const next = `${doc.slice(0, i + BEGIN.length)}\n\n${render(readDeployment())}\n\n${doc.slice(j)}`;
  fs.writeFileSync(DOC, next);
  console.log(`updated ${path.relative(ROOT, DOC)}`);
}

if (require.main === module) main();
