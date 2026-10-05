// Forgets the recorded asset, loan and transaction hashes (keeping the
// deployed contracts) so the demo flow can be run again from the start.
// Nothing on chain is touched.

import { readDeployment, writeDeployment } from "../lib/common";

const d = readDeployment();
writeDeployment({ network: d.network, contracts: d.contracts, transactions: {} });
console.log("flow state reset; deployed contracts kept");
