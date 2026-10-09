// CKB RWA Asset Lending Frontend
// Reference demo data & lifecycle state machine

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
    termSub: "Term starts on deposit"
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
    termSub: "Term starts on deposit"
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
    termSub: "Due in 30 days"
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
    termSub: "Due 05 Oct 2026"
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
    termSub: "Repaid on schedule"
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
    termSub: "Lifecycle completed"
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
    shortHash: "0x9f2a...c71e",
    time: "Today, 14:32",
    status: "CONFIRMED"
  },
  {
    action: "KYC attestation",
    hash: "0x144311a53e7c323b4edd459acf83727137117106d962a8aff2b47d4be2a83607",
    shortHash: "0x4b18...a902",
    time: "Today, 14:35",
    status: "CONFIRMED"
  },
  {
    action: "Collateral deposit",
    hash: "0x39f2cf5bc6a6ca0d00f340bacccbde1208560570108db372d3b61d87ffc12061",
    shortHash: "0x72c0...1fd4",
    time: "Today, 14:38",
    status: "CONFIRMED"
  },
  {
    action: "Borrow 18,000 CKB",
    hash: "0xd9a3d4ee47054803921cea8ab89e84c79ce9def0837c3a5c03c3b517e74d54dc",
    shortHash: "0xc8e1...b42a",
    time: "Today, 14:40",
    status: "CONFIRMED"
  },
  {
    action: "Repay loan (principal + interest)",
    hash: "0x556720b28e007ad8da112024ef8f36202bde2286b03d213220aa85d750ac4e16",
    shortHash: "0x5567...4e16",
    time: "Today, 14:45",
    status: "CONFIRMED"
  },
  {
    action: "Collateral release",
    hash: "0x52dea1b098805128d017d9826f848fb88208524601ae761ea23027baf2274b9d",
    shortHash: "0x52de...4b9d",
    time: "Today, 14:48",
    status: "CONFIRMED"
  }
];

let currentStep = 4; // Starts at Borrow (matching ui/image.png)
let selectedAsset = "receipt";
let walletConnected = true;

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

// Wallet
const walletBtn = document.getElementById("walletBtn");
const walletStatusIndicator = document.getElementById("walletStatusIndicator");
const walletAddressDisplay = document.getElementById("walletAddressDisplay");

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

function renderStep(step) {
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

  // Update progress bar
  const pct = Math.min(100, Math.max(0, ((step - 1) / 5) * 100));
  stepperProgressBar.style.width = `${pct}%`;

  // Update stepper buttons
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

  // Filter transactions visible up to current step
  renderTransactions(step);
}

function renderTransactions(upToStep) {
  txTableBody.innerHTML = "";
  // Show transactions corresponding to steps
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
    hashLink.title = `Full Hash: ${tx.hash} (click to open CKB Explorer)`;
    hashLink.innerHTML = `
      <span>${tx.shortHash}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px; height:11px; opacity:0.6;">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;

    // Copy on right click or aux click
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
    const statusPill = document.createElement("span");
    statusPill.className = "status-pill-confirmed";
    statusPill.textContent = tx.status;
    tdStatus.appendChild(statusPill);

    tr.appendChild(tdAction);
    tr.appendChild(tdHash);
    tr.appendChild(tdTime);
    tr.appendChild(tdStatus);

    txTableBody.appendChild(tr);
  });
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
    }).catch(() => {
      fallbackCopy(text, message);
    });
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
      showToast(`View stage: ${STATE_DATA[i].name}`);
    });
  }
}

// Main stage action button
stageActionBtn.addEventListener("click", () => {
  if (currentStep < 6) {
    const next = currentStep + 1;
    renderStep(next);
    showToast(`Executed: ${STATE_DATA[currentStep].tag}`);
  } else {
    renderStep(1);
    showToast("Flow reset to Step 1: Asset Issuance");
  }
});

// Reset flow button
resetFlowBtn.addEventListener("click", () => {
  renderStep(1);
  showToast("Lifecycle reset to beginning");
});

// Asset switcher
btnReceiptAsset.addEventListener("click", () => setAsset("receipt"));
btnInvoiceAsset.addEventListener("click", () => setAsset("invoice"));

// Cell lock copy
cellLockVal.addEventListener("click", () => {
  const full = ASSETS[selectedAsset].fullLock;
  copyToClipboard(full, "Full Cell Lock script hash copied!");
});

// Wallet toggle / info
walletBtn.addEventListener("click", () => {
  walletConnected = !walletConnected;
  if (walletConnected) {
    walletStatusIndicator.querySelector(".status-dot").className = "status-dot online";
    walletStatusIndicator.querySelector(".status-label").textContent = "WALLET CONNECTED";
    walletAddressDisplay.textContent = "0x7b...91c4";
    showToast("Connected: 0x7b23...91c4 (CKB Testnet Pudge)");
  } else {
    walletStatusIndicator.querySelector(".status-dot").className = "status-dot";
    walletStatusIndicator.querySelector(".status-label").textContent = "DISCONNECTED";
    walletAddressDisplay.textContent = "Connect";
    showToast("Wallet disconnected");
  }
});

// Modals
openHowItWorksBtn.addEventListener("click", () => {
  howItWorksModal.removeAttribute("hidden");
});
closeHowItWorksBtn.addEventListener("click", () => {
  howItWorksModal.setAttribute("hidden", "");
});
howItWorksModal.addEventListener("click", (e) => {
  if (e.target === howItWorksModal) {
    howItWorksModal.setAttribute("hidden", "");
  }
});

btnViewDeploymentJson.addEventListener("click", () => {
  deploymentModal.removeAttribute("hidden");
});
closeDeploymentBtn.addEventListener("click", () => {
  deploymentModal.setAttribute("hidden", "");
});
deploymentModal.addEventListener("click", (e) => {
  if (e.target === deploymentModal) {
    deploymentModal.setAttribute("hidden", "");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    howItWorksModal.setAttribute("hidden", "");
    deploymentModal.setAttribute("hidden", "");
  }
});

// Initial boot
renderStep(4);
