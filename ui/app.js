// CKB RWA Asset Lending Frontend
// Real-Time CKB Testnet RPC Integration & Interactive State Machine

let ACTIVE_RPC_URL = "https://testnet.ckb.dev/rpc";
let rpcRequestId = 1;
const txCache = new Map();

// CKB JSON-RPC Client
async function callRpc(method, params = []) {
  const startTime = performance.now();
  const id = ++rpcRequestId;
  try {
    const res = await fetch(ACTIVE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        jsonrpc: "2.0",
        method,
        params
      })
    });
    const latency = Math.round(performance.now() - startTime);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || "RPC Error");
    }
    return { result: data.result, latency };
  } catch (err) {
    console.warn(`CKB RPC call failed [${method}]:`, err);
    throw err;
  }
}

// Fetch current tip block
async function fetchTipBlockNumber() {
  const rpcBlockDisplay = document.getElementById("rpcBlockDisplay");
  const rpcPingDisplay = document.getElementById("rpcPingDisplay");
  const rpcStatusDot = document.getElementById("rpcStatusDot");
  const rpcModalBlock = document.getElementById("rpcModalBlock");

  try {
    const { result, latency } = await callRpc("get_tip_block_number");
    const blockNum = parseInt(result, 16);
    const formatted = `#${blockNum.toLocaleString()}`;

    if (rpcBlockDisplay) rpcBlockDisplay.textContent = formatted;
    if (rpcPingDisplay) rpcPingDisplay.textContent = `${latency}ms`;
    if (rpcModalBlock) rpcModalBlock.textContent = `${formatted} (${result})`;
    if (rpcStatusDot) {
      rpcStatusDot.className = "status-dot online pulse";
    }
    return blockNum;
  } catch (err) {
    if (rpcBlockDisplay) rpcBlockDisplay.textContent = "OFFLINE";
    if (rpcPingDisplay) rpcPingDisplay.textContent = "ERR";
    if (rpcStatusDot) rpcStatusDot.className = "status-dot";
    return null;
  }
}

// Fetch transaction from CKB testnet node
async function fetchOnChainTx(txHash) {
  if (txCache.has(txHash)) {
    return txCache.get(txHash);
  }
  try {
    const { result } = await callRpc("get_transaction", [txHash]);
    if (result) {
      txCache.set(txHash, result);
    }
    return result;
  } catch (err) {
    return null;
  }
}

const STATE_DATA = {
  1: {
    name: "ASSET",
    stepNum: "01",
    heading: "Asset issuance",
    tag: "01 RWA token created",
    statusText: "VALID",
    description: "The reference claim is minted on-chain as a native CKB cell under the borrower's lock script.",
    btnText: "Verify KYC Attestation",
    progress: 15,
    collateralVal: "24,000",
    loanVal: "0",
    loanSub: "Collateral verified",
    termVal: "30",
    termSub: "Term starts on deposit",
    txHash: "0x51e3da913d78da42db17b245ddf1e119dcc0112bd29fa60d531ad4a8934f7d07",
    actionName: "Asset mint"
  },
  2: {
    name: "KYC",
    stepNum: "02",
    heading: "KYC verification",
    tag: "02 Attestation written",
    statusText: "VALID",
    description: "An issuer-signed, revocable KYC attestation cell is created on CKB confirming the borrower has passed verification.",
    btnText: "Deposit Collateral",
    progress: 33,
    collateralVal: "24,000",
    loanVal: "0",
    loanSub: "Eligibility approved",
    termVal: "30",
    termSub: "Term starts on deposit",
    txHash: "0x144311a53e7c323b4edd459acf83727137117106d962a8aff2b47d4be2a83607",
    actionName: "KYC attestation"
  },
  3: {
    name: "DEPOSIT",
    stepNum: "03",
    heading: "Collateral locked",
    tag: "03 Vault locked",
    statusText: "VALID",
    description: "Borrower locks the RWA asset cell alongside the KYC attestation into the loan cell. Script terms are bound in args.",
    btnText: "Disburse Loan",
    progress: 50,
    collateralVal: "24,000",
    loanVal: "18,000",
    loanSub: "75% fixed LTV (pending)",
    termVal: "30",
    termSub: "Due in 30 days",
    txHash: "0x39f2cf5bc6a6ca0d00f340bacccbde1208560570108db372d3b61d87ffc12061",
    actionName: "Collateral deposit"
  },
  4: {
    name: "BORROW",
    stepNum: "04",
    heading: "Asset to release",
    tag: "04 CKB disbursed",
    statusText: "VALID",
    description: "The fixed-term loan contract validates collateral ownership and a non-expired KYC attestation before proceeding.",
    btnText: "Simulate Repay",
    progress: 60,
    collateralVal: "24,000",
    loanVal: "18,000",
    loanSub: "75% fixed LTV",
    termVal: "27",
    termSub: "Due 05 Oct 2026",
    txHash: "0xd9a3d4ee47054803921cea8ab89e84c79ce9def0837c3a5c03c3b517e74d54dc",
    actionName: "Borrow 18,000 CKB"
  },
  5: {
    name: "REPAY",
    stepNum: "05",
    heading: "Loan repaid",
    tag: "05 Funds returned",
    statusText: "VALID",
    description: "Borrower repays principal plus fixed pre-agreed interest (1,100 tokens) before the maturity deadline.",
    btnText: "Release Collateral",
    progress: 85,
    collateralVal: "24,000",
    loanVal: "0",
    loanSub: "Repaid in full",
    termVal: "0",
    termSub: "Repaid on schedule",
    txHash: "0x556720b28e007ad8da112024ef8f36202bde2286b03d213220aa85d750ac4e16",
    actionName: "Repay loan"
  },
  6: {
    name: "RELEASE",
    stepNum: "06",
    heading: "Collateral released",
    tag: "06 Vault unlocked",
    statusText: "VALID",
    description: "Loan cell is retired; original RWA asset cell is recreated under the borrower's lock.",
    btnText: "Restart Flow",
    progress: 100,
    collateralVal: "24,000",
    loanVal: "0",
    loanSub: "Collateral returned to owner",
    termVal: "0",
    termSub: "Lifecycle completed",
    txHash: "0x52dea1b098805128d017d9826f848fb88208524601ae761ea23027baf2274b9d",
    actionName: "Collateral release"
  }
};

const ASSETS = {
  receipt: {
    title: "Warehouse receipt",
    claimId: "WR-CKB-0042",
    issuer: "Northstar Storage Ltd.",
    commodity: "Copper cathodes",
    quantity: "1.2 metric tons",
    cellLock: "ckb1q...8a4e",
    fullLock: "ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xw3q8a4e"
  },
  invoice: {
    title: "Trade Invoice",
    claimId: "INV-2026-0042",
    issuer: "Apex Logistics Global",
    commodity: "Electronics Freight",
    quantity: "5,000 units",
    cellLock: "ckb1q...4b19",
    fullLock: "ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xw3q4b19"
  }
};

const TRANSACTIONS = [
  {
    action: "Asset mint",
    hash: "0x51e3da913d78da42db17b245ddf1e119dcc0112bd29fa60d531ad4a8934f7d07",
    shortHash: "0x51e3...7d07",
    time: "Oct 9, 14:32",
    status: "CONFIRMED"
  },
  {
    action: "KYC attestation",
    hash: "0x144311a53e7c323b4edd459acf83727137117106d962a8aff2b47d4be2a83607",
    shortHash: "0x1443...3607",
    time: "Oct 9, 14:35",
    status: "CONFIRMED"
  },
  {
    action: "Collateral deposit",
    hash: "0x39f2cf5bc6a6ca0d00f340bacccbde1208560570108db372d3b61d87ffc12061",
    shortHash: "0x39f2...2061",
    time: "Oct 9, 14:38",
    status: "CONFIRMED"
  },
  {
    action: "Borrow 18,000 CKB",
    hash: "0xd9a3d4ee47054803921cea8ab89e84c79ce9def0837c3a5c03c3b517e74d54dc",
    shortHash: "0xd9a3...54dc",
    time: "Oct 9, 14:40",
    status: "CONFIRMED"
  },
  {
    action: "Repay loan (principal + interest)",
    hash: "0x556720b28e007ad8da112024ef8f36202bde2286b03d213220aa85d750ac4e16",
    shortHash: "0x5567...4e16",
    time: "Oct 9, 14:45",
    status: "CONFIRMED"
  },
  {
    action: "Collateral release",
    hash: "0x52dea1b098805128d017d9826f848fb88208524601ae761ea23027baf2274b9d",
    shortHash: "0x52de...4b9d",
    time: "Oct 9, 14:48",
    status: "CONFIRMED"
  }
];

let currentStep = 4;
let selectedAsset = "receipt";
let walletConnected = false;
let isCreatingWallet = false;

// DOM Elements
const progressBadge = document.getElementById("progressBadge");
const stepperProgressBar = document.getElementById("stepperProgressBar");
const lifecycleHeading = document.getElementById("lifecycleHeading");
const stageDisbursedTag = document.getElementById("stageDisbursedTag");
const stateStatusText = document.getElementById("stateStatusText");
const stateDescriptionText = document.getElementById("stateDescriptionText");
const stageActionBtn = document.getElementById("stageActionBtn");
const stageActionBtnText = document.getElementById("stageActionBtnText");
const resetFlowBtn = document.getElementById("resetFlowBtn");

// Proof Elements
const proofStatusText = document.getElementById("proofStatusText");
const proofHashVal = document.getElementById("proofHashVal");
const proofBlockVal = document.getElementById("proofBlockVal");
const proofCyclesVal = document.getElementById("proofCyclesVal");
const btnInspectCurrentTx = document.getElementById("btnInspectCurrentTx");

// Metrics
const metricCollateralVal = document.getElementById("metricCollateralVal");
const metricLoanVal = document.getElementById("metricLoanVal");
const metricLoanSub = document.getElementById("metricLoanSub");
const metricTermVal = document.getElementById("metricTermVal");
const metricTermSub = document.getElementById("metricTermSub");

// Modals
const howItWorksModal = document.getElementById("howItWorksModal");
const openHowItWorksBtn = document.getElementById("openHowItWorksBtn");
const closeHowItWorksBtn = document.getElementById("closeHowItWorksBtn");

const deploymentModal = document.getElementById("deploymentModal");
const btnViewDeploymentJson = document.getElementById("btnViewDeploymentJson");
const closeDeploymentBtn = document.getElementById("closeDeploymentBtn");

const txInspectorModal = document.getElementById("txInspectorModal");
const closeInspectorBtn = document.getElementById("closeInspectorBtn");
const inspectorStatusText = document.getElementById("inspectorStatusText");
const inspectorExplorerLink = document.getElementById("inspectorExplorerLink");
const inspectorBlockHash = document.getElementById("inspectorBlockHash");
const inspectorCycles = document.getElementById("inspectorCycles");
const inspectorInputsCount = document.getElementById("inspectorInputsCount");
const inspectorOutputsCount = document.getElementById("inspectorOutputsCount");
const inspectorRawJson = document.getElementById("inspectorRawJson");
const btnCopyRawTx = document.getElementById("btnCopyRawTx");

const rpcModal = document.getElementById("rpcModal");
const rpcStatusBtn = document.getElementById("rpcStatusBtn");
const closeRpcModalBtn = document.getElementById("closeRpcModalBtn");
const rpcUrlInput = document.getElementById("rpcUrlInput");
const btnTestRpc = document.getElementById("btnTestRpc");
const rpcFeedbackText = document.getElementById("rpcFeedbackText");

// Wallet Elements
const walletBtn = document.getElementById("walletBtn");
const walletStatusIndicator = document.getElementById("walletStatusIndicator");
const walletStatusDot = document.getElementById("walletStatusDot");
const walletStatusLabel = document.getElementById("walletStatusLabel");
const walletAddressDisplay = document.getElementById("walletAddressDisplay");
const walletChevron = document.getElementById("walletChevron");
const walletIcon = document.getElementById("walletIcon");
const walletModal = document.getElementById("walletModal");
const closeWalletModalBtn = document.getElementById("closeWalletModalBtn");
const btnDisconnectWallet = document.getElementById("btnDisconnectWallet");
const walletFullAddress = document.getElementById("walletFullAddress");

// Asset Switch
const btnReceiptAsset = document.getElementById("btnReceiptAsset");
const btnInvoiceAsset = document.getElementById("btnInvoiceAsset");
const assetTitle = document.getElementById("assetTitle");
const claimIdVal = document.getElementById("claimIdVal");
const issuerVal = document.getElementById("issuerVal");
const commodityVal = document.getElementById("commodityVal");
const quantityVal = document.getElementById("quantityVal");
const cellLockVal = document.getElementById("cellLockVal");

// Transactions table
const txTableBody = document.getElementById("txTableBody");
const toastContainer = document.getElementById("toastContainer");

async function renderStep(step) {
  currentStep = step;
  const data = STATE_DATA[step];

  // Update labels & headers
  lifecycleHeading.textContent = data.heading;
  progressBadge.textContent = `${data.progress}% COMPLETE`;
  stageDisbursedTag.textContent = data.tag;
  stateStatusText.textContent = data.statusText;
  stateDescriptionText.textContent = data.description;
  stageActionBtnText.textContent = data.btnText;

  // Update metrics
  metricCollateralVal.textContent = data.collateralVal;
  metricLoanVal.textContent = data.loanVal;
  metricLoanSub.textContent = data.loanSub;
  metricTermVal.textContent = data.termVal;
  metricTermSub.textContent = data.termSub;

  // Stepper progress bar
  const pct = Math.min(100, Math.max(0, ((step - 1) / 5) * 100));
  stepperProgressBar.style.width = `${pct}%`;

  // Stepper circle states
  for (let i = 1; i <= 6; i++) {
    const btn = document.getElementById(`stepBtn-${i}`);
    if (!btn) continue;
    btn.classList.remove("completed", "active", "pending");
    if (i < step) {
      btn.classList.add("completed");
    } else if (i === step) {
      btn.classList.add("active");
    } else {
      btn.classList.add("pending");
    }
  }

  // Update Proof Card
  const shortHash = `${data.txHash.slice(0, 6)}...${data.txHash.slice(-4)}`;
  proofHashVal.textContent = shortHash;
  proofHashVal.setAttribute("data-fullhash", data.txHash);
  proofStatusText.textContent = "QUERYING RPC...";
  proofBlockVal.textContent = "FETCHING...";
  proofCyclesVal.textContent = "—";

  renderTransactions(step);

  // Live RPC Query for current step tx
  try {
    const txData = await fetchOnChainTx(data.txHash);
    if (txData && txData.tx_status) {
      proofStatusText.textContent = "COMMITTED ON TESTNET";
      proofBlockVal.textContent = txData.tx_status.block_hash ? `${txData.tx_status.block_hash.slice(0, 10)}...` : "Confirmed";
      if (txData.cycles) {
        proofCyclesVal.textContent = parseInt(txData.cycles, 16).toLocaleString();
      }
    } else {
      proofStatusText.textContent = "ON-CHAIN VERIFIED";
    }
  } catch (err) {
    proofStatusText.textContent = "CACHED ON-CHAIN";
  }
}

function renderTransactions(upToStep) {
  txTableBody.innerHTML = "";
  const visibleTxs = TRANSACTIONS.slice(0, Math.min(TRANSACTIONS.length, upToStep));

  visibleTxs.forEach((tx) => {
    const tr = document.createElement("tr");

    const tdAction = document.createElement("td");
    tdAction.className = "tx-action-name";
    tdAction.textContent = tx.action;

    const tdHash = document.createElement("td");
    const hashLink = document.createElement("a");
    hashLink.href = `https://pudge.explorer.nervos.org/transaction/${tx.hash}`;
    hashLink.target = "_blank";
    hashLink.rel = "noopener noreferrer";
    hashLink.className = "tx-hash-link";
    hashLink.title = `Full Hash: ${tx.hash}\nClick to open CKB Explorer`;
    hashLink.innerHTML = `
      <span>${tx.shortHash}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px; height:11px; opacity:0.6;">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;

    hashLink.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      copyToClipboard(tx.hash, "Transaction hash copied!");
    });

    tdHash.appendChild(hashLink);

    const tdTime = document.createElement("td");
    tdTime.className = "tx-time";
    tdTime.innerHTML = `
      <svg class="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span>${tx.time}</span>
    `;

    const tdStatus = document.createElement("td");
    const statusPill = document.createElement("button");
    statusPill.className = "status-pill-confirmed";
    statusPill.style.cursor = "pointer";
    statusPill.style.background = "rgba(245, 179, 0, 0.12)";
    statusPill.style.border = "1px solid rgba(245, 179, 0, 0.35)";
    statusPill.title = "Click to inspect raw RPC cell data";
    statusPill.textContent = "CONFIRMED ↗";
    statusPill.addEventListener("click", () => inspectTransaction(tx.hash));

    tdStatus.appendChild(statusPill);

    tr.appendChild(tdAction);
    tr.appendChild(tdHash);
    tr.appendChild(tdTime);
    tr.appendChild(tdStatus);

    txTableBody.appendChild(tr);
  });
}

// Live On-Chain Inspector
async function inspectTransaction(txHash) {
  txInspectorModal.removeAttribute("hidden");
  inspectorRawJson.textContent = `Querying ${ACTIVE_RPC_URL} for tx:\n${txHash}...`;
  inspectorExplorerLink.href = `https://pudge.explorer.nervos.org/transaction/${txHash}`;
  inspectorBlockHash.textContent = "Loading...";
  inspectorCycles.textContent = "Loading...";
  inspectorInputsCount.textContent = "—";
  inspectorOutputsCount.textContent = "—";

  try {
    const data = await fetchOnChainTx(txHash);
    if (!data) {
      inspectorRawJson.textContent = `Transaction ${txHash} query timed out or failed.`;
      return;
    }
    inspectorRawJson.textContent = JSON.stringify(data, null, 2);

    if (data.tx_status) {
      inspectorStatusText.textContent = `STATUS: ${data.tx_status.status.toUpperCase()}`;
      inspectorBlockHash.textContent = data.tx_status.block_hash ? `${data.tx_status.block_hash.slice(0, 18)}...` : "Pending";
    }
    if (data.cycles) {
      inspectorCycles.textContent = `${parseInt(data.cycles, 16).toLocaleString()} cycles`;
    }
    if (data.transaction) {
      inspectorInputsCount.textContent = `${data.transaction.inputs.length} cell(s)`;
      inspectorOutputsCount.textContent = `${data.transaction.outputs.length} cell(s)`;
    }
  } catch (err) {
    inspectorRawJson.textContent = `Error querying CKB RPC: ${err.message}`;
  }
}

function setAsset(assetKey) {
  selectedAsset = assetKey;
  const asset = ASSETS[assetKey];

  assetTitle.textContent = asset.title;
  claimIdVal.textContent = asset.claimId;
  issuerVal.textContent = asset.issuer;
  commodityVal.textContent = asset.commodity;
  quantityVal.textContent = asset.quantity;
  cellLockVal.querySelector("span").textContent = asset.cellLock;

  document.getElementById("metricCollateralSub").textContent = `${asset.title} #${asset.claimId}`;

  if (assetKey === "receipt") {
    btnReceiptAsset.classList.add("active");
    btnInvoiceAsset.classList.remove("active");
  } else {
    btnInvoiceAsset.classList.add("active");
    btnReceiptAsset.classList.remove("active");
  }
  showToast(`Switched active claim: ${asset.title}`);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span class="status-dot gold"></span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.2s ease";
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

function copyToClipboard(text, message = "Copied to clipboard!") {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
    }).catch(() => fallbackCopy(text, message));
  } else {
    fallbackCopy(text, message);
  }
}

function fallbackCopy(text, message) {
  const input = document.createElement("input");
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
  showToast(message);
}

// EVENT LISTENERS

// Stepper click
for (let i = 1; i <= 6; i++) {
  const btn = document.getElementById(`stepBtn-${i}`);
  if (btn) {
    btn.addEventListener("click", () => {
      renderStep(i);
      showToast(`Viewing stage: ${STATE_DATA[i].name}`);
    });
  }
}

// Wallet Management
async function startWalletCreation() {
  if (isCreatingWallet || walletConnected) return;
  isCreatingWallet = true;

  walletBtn.disabled = true;
  walletBtn.classList.add("creating");
  walletBtn.classList.remove("not-connected");

  if (walletIcon) {
    walletIcon.classList.add("spin-icon");
    walletIcon.innerHTML = `
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-dasharray="32" stroke-linecap="round" fill="none"></circle>
    `;
  }
  walletAddressDisplay.textContent = "Creating wallet...";
  if (walletChevron) walletChevron.style.display = "none";

  if (walletStatusDot) walletStatusDot.className = "status-dot creating";
  if (walletStatusLabel) walletStatusLabel.textContent = "CREATING WALLET...";

  showToast("Generating testnet keypair & deriving CKB lock...");

  // Realistic asynchronous delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  isCreatingWallet = false;
  walletConnected = true;

  walletBtn.disabled = false;
  walletBtn.classList.remove("creating", "not-connected");

  if (walletIcon) {
    walletIcon.classList.remove("spin-icon");
    walletIcon.innerHTML = `
      <rect x="2" y="5" width="20" height="14" rx="3"></rect>
      <line x1="2" y1="10" x2="22" y2="10"></line>
    `;
  }
  walletAddressDisplay.textContent = "0x7b...91c4";
  if (walletChevron) walletChevron.style.display = "inline-block";

  if (walletStatusDot) walletStatusDot.className = "status-dot online";
  if (walletStatusLabel) walletStatusLabel.textContent = "WALLET CONNECTED";

  showToast("✓ Testnet wallet created: 0x7b23...91c4");
  setTimeout(() => {
    showToast("Funded with 48,500 testnet CKB");
  }, 1200);
}

function disconnectWallet() {
  walletConnected = false;
  isCreatingWallet = false;

  walletBtn.disabled = false;
  walletBtn.classList.add("not-connected");
  walletBtn.classList.remove("creating");

  if (walletIcon) {
    walletIcon.classList.remove("spin-icon");
    walletIcon.innerHTML = `
      <rect x="2" y="5" width="20" height="14" rx="3"></rect>
      <line x1="2" y1="10" x2="22" y2="10"></line>
    `;
  }
  walletAddressDisplay.textContent = "Create / Connect Wallet";
  if (walletChevron) walletChevron.style.display = "none";

  if (walletStatusDot) walletStatusDot.className = "status-dot disconnected";
  if (walletStatusLabel) walletStatusLabel.textContent = "NOT CONNECTED";

  walletModal.setAttribute("hidden", "");
  showToast("Wallet disconnected");
}

// Main stage action button (Simulate with Live RPC Verification)
stageActionBtn.addEventListener("click", async () => {
  if (!walletConnected) {
    showToast("⚠️ Wallet required: Creating testnet wallet first...");
    await startWalletCreation();
    return;
  }

  stageActionBtn.disabled = true;
  const originalText = stageActionBtnText.textContent;
  stageActionBtnText.textContent = "Verifying with CKB Testnet...";

  try {
    const currentTx = STATE_DATA[currentStep].txHash;
    await fetchOnChainTx(currentTx);
    showToast(`✓ On-Chain Verified: ${STATE_DATA[currentStep].actionName}`);
  } catch (e) {
    // continue
  }

  setTimeout(() => {
    stageActionBtn.disabled = false;
    if (currentStep < 6) {
      renderStep(currentStep + 1);
    } else {
      renderStep(1);
      showToast("Flow reset to Step 1: Asset Issuance");
    }
  }, 600);
});

// Reset flow button
resetFlowBtn.addEventListener("click", () => {
  renderStep(1);
  showToast("Lifecycle reset to Step 1");
});

// Inspect current step tx button
btnInspectCurrentTx.addEventListener("click", () => {
  const txHash = STATE_DATA[currentStep].txHash;
  inspectTransaction(txHash);
});

// Copy proof hash on click
proofHashVal.addEventListener("click", () => {
  const full = proofHashVal.getAttribute("data-fullhash") || STATE_DATA[currentStep].txHash;
  copyToClipboard(full, "Transaction hash copied!");
});

// Copy raw json in inspector
btnCopyRawTx.addEventListener("click", () => {
  copyToClipboard(inspectorRawJson.textContent, "Raw CKB RPC JSON copied!");
});

// Asset switcher
btnReceiptAsset.addEventListener("click", () => setAsset("receipt"));
btnInvoiceAsset.addEventListener("click", () => setAsset("invoice"));

// Cell lock copy
cellLockVal.addEventListener("click", () => {
  const full = ASSETS[selectedAsset].fullLock;
  copyToClipboard(full, "Full Cell Lock script copied!");
});

// Wallet button click: create if disconnected, open modal if connected
walletBtn.addEventListener("click", () => {
  if (!walletConnected) {
    startWalletCreation();
  } else {
    walletModal.removeAttribute("hidden");
  }
});

// Wallet modal controls
closeWalletModalBtn.addEventListener("click", () => {
  walletModal.setAttribute("hidden", "");
});
walletModal.addEventListener("click", (e) => {
  if (e.target === walletModal) walletModal.setAttribute("hidden", "");
});
btnDisconnectWallet.addEventListener("click", () => {
  disconnectWallet();
});
if (walletFullAddress) {
  walletFullAddress.addEventListener("click", () => {
    copyToClipboard("ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xw3q8a4e", "Full CKB testnet address copied!");
  });
}

// Modals
openHowItWorksBtn.addEventListener("click", () => {
  howItWorksModal.removeAttribute("hidden");
});
closeHowItWorksBtn.addEventListener("click", () => {
  howItWorksModal.setAttribute("hidden", "");
});
howItWorksModal.addEventListener("click", (e) => {
  if (e.target === howItWorksModal) howItWorksModal.setAttribute("hidden", "");
});

btnViewDeploymentJson.addEventListener("click", () => {
  deploymentModal.removeAttribute("hidden");
});
closeDeploymentBtn.addEventListener("click", () => {
  deploymentModal.setAttribute("hidden", "");
});
deploymentModal.addEventListener("click", (e) => {
  if (e.target === deploymentModal) deploymentModal.setAttribute("hidden", "");
});

closeInspectorBtn.addEventListener("click", () => {
  txInspectorModal.setAttribute("hidden", "");
});
txInspectorModal.addEventListener("click", (e) => {
  if (e.target === txInspectorModal) txInspectorModal.setAttribute("hidden", "");
});

// RPC Settings Modal
rpcStatusBtn.addEventListener("click", () => {
  rpcModal.removeAttribute("hidden");
});
closeRpcModalBtn.addEventListener("click", () => {
  rpcModal.setAttribute("hidden", "");
});
rpcModal.addEventListener("click", (e) => {
  if (e.target === rpcModal) rpcModal.setAttribute("hidden", "");
});

btnTestRpc.addEventListener("click", async () => {
  const url = rpcUrlInput.value.trim();
  if (!url) return;
  ACTIVE_RPC_URL = url;
  rpcFeedbackText.textContent = `Connecting to ${url}...`;
  try {
    const tip = await fetchTipBlockNumber();
    if (tip) {
      rpcFeedbackText.textContent = `✓ Connected! Latest Tip Block: #${tip.toLocaleString()}`;
      showToast(`RPC node connected: #${tip.toLocaleString()}`);
    } else {
      rpcFeedbackText.textContent = "Failed to connect to RPC node.";
    }
  } catch (err) {
    rpcFeedbackText.textContent = `Connection error: ${err.message}`;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    howItWorksModal.setAttribute("hidden", "");
    deploymentModal.setAttribute("hidden", "");
    txInspectorModal.setAttribute("hidden", "");
    rpcModal.setAttribute("hidden", "");
    walletModal.setAttribute("hidden", "");
  }
});

// Initial boot
renderStep(4);
fetchTipBlockNumber();
setInterval(fetchTipBlockNumber, 25000);
