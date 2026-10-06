import { parseAmount, formatAmount, walletError } from "./numbers.js";
import { renderActivityRows } from "./activity-table.js";
import { createWalletMenu, connectedAccounts, authorizeAccounts, preferredAccount, rememberAccount } from "./wallet-menu.js";

const HOME_ACTIVITY_LIMIT = 5;

const $ = (id) => document.getElementById(id);
const state = { config: null, wallet: null, provider: null, position: null, busy: false,
  accounts: [], walletBusy: false, cursor: null, items: [], tx: null, generation: 0, historyBusy: false };
const storageKey = () => state.wallet && state.config ? ["microinvest", state.config.chainId, state.config.contractAddress, state.wallet.toLowerCase()].join(":") : null;
const walletMenu = createWalletMenu({ onConnect: connect, onSelect: selectAccount,
  onManage: async () => {
    const selected = state.wallet;
    await ensureNetwork();
    await selectAccount(await authorizeAccounts(), selected);
  }, onError: notice, onBusy: busy => { state.walletBusy = busy; actions(); } });

async function api(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(path, { signal: controller.signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "The request could not be completed.");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The query timed out. Please retry.");
    throw error;
  } finally { clearTimeout(timer); }
}
function notice(message = "") {
  $("page-message").textContent = message;
  $("page-message").classList.toggle("hidden", !message);
  $("page-message").classList.toggle("error", Boolean(message));
}
function actions() {
  const enabled = Boolean(state.config?.configured && state.wallet && state.provider && state.position && !state.busy && !state.walletBusy);
  $("deposit-button").disabled = !enabled;
  $("withdraw-button").disabled = !enabled || BigInt(state.position?.sharesUnits || "0") === 0n;
  $("withdraw-all-button").disabled = $("withdraw-button").disabled;
  $("deposit-amount").disabled = state.busy;
  $("withdraw-amount").disabled = state.busy;
  walletMenu.setBusy(state.busy || !state.config);
}
function clearPosition() {
  state.position = null;
  for (const id of ["owned-shares", "redeemable", "available-amount", "wallet-balance"]) $(id).textContent = "—";
  $("data-state").textContent = state.wallet ? "Position not loaded" : "Connect to get started";
  actions();
}
function showPosition(position) {
  state.position = position;
  $("owned-shares").textContent = position.shares;
  $("redeemable").textContent = position.redeemableEth;
  $("available-amount").textContent = position.redeemableEth;
  $("wallet-balance").textContent = position.walletBalanceEth;
  $("data-state").textContent = "Updated at block " + position.blockNumber;
  actions();
}
function txView(transaction) {
  state.tx = transaction;
  $("transaction-box").classList.remove("hidden");
  $("transaction-box").classList.toggle("failed", transaction.status === "failed" || transaction.status === "rejected");
  const labels = { signing: "Approve in MetaMask", pending: "Waiting for confirmation", success: "Transaction confirmed",
    failed: "Transaction execution failed", rejected: "Wallet request declined", unknown: "Confirmation not available yet", cancelled: "Transaction cancelled" };
  $("transaction-status").textContent = labels[transaction.status] || transaction.status;
  $("transaction-detail").textContent = transaction.detail || "";
  const link = $("transaction-link");
  link.textContent = transaction.hash || "";
  link.removeAttribute("href");
  if (transaction.hash && state.config.explorerUrl) link.href = state.config.explorerUrl + "/tx/" + transaction.hash;
  $("check-transaction").classList.toggle("hidden", !transaction.hash || ["success", "failed", "cancelled"].includes(transaction.status));
}
function persist(transaction) {
  if (!storageKey() || !transaction.hash) return;
  try { localStorage.setItem(storageKey(), JSON.stringify(transaction)); } catch { /* Wallet use still works with storage disabled. */ }
}
function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
    if (saved?.hash && /^0x[0-9a-fA-F]{64}$/.test(saved.hash)) {
      txView(saved);
      if (!["success", "failed", "cancelled"].includes(saved.status)) void checkTransaction();
    }
  } catch { /* Ignore invalid local-only state. */ }
}
async function checkTransaction() {
  const current = state.tx;
  if (!current?.hash) return;
  const context = state.generation;
  try {
    const result = await api("/api/transactions/" + current.hash);
    if (context !== state.generation || state.tx?.hash !== current.hash) return;
    const status = result.status === "not_found" ? "unknown" : result.status;
    const detail = status === "success" ? "Confirmed in block " + result.blockNumber + ". Your position can now be refreshed."
      : status === "failed" ? "The transaction was mined but reverted. Shares were unchanged; gas was spent."
      : "The transaction is not confirmed yet. You can check again or view it in your wallet.";
    const updated = { ...current, status, detail };
    txView(updated); persist(updated);
    if (["success", "failed"].includes(status)) await refresh();
  } catch (error) {
    if (context !== state.generation || state.tx?.hash !== current.hash) return;
    const updated = { ...current, status: "unknown", detail: error.message + " Keep this hash and check again." };
    txView(updated); persist(updated);
  }
}
function renderHistory() {
  renderActivityRows($("history-body"), state.items.slice(0, HOME_ACTIVITY_LIMIT), state.config?.explorerUrl);
  $("history-empty").classList.toggle("hidden", state.items.length > 0);
  $("history-empty").textContent = !state.wallet ? "Connect your wallet to see your activity."
    : state.cursor ? "No recent activity. View all activity to browse older records." : "No confirmed activity yet.";
  $("view-all-activity").href = state.wallet ? "/activity?wallet=" + encodeURIComponent(state.wallet) : "/activity";
}
async function history() {
  if (!state.wallet || !state.config.configured || state.historyBusy) return;
  const wallet = state.wallet, generation = state.generation;
  state.historyBusy = true;
  $("history-state").textContent = "Reading on-chain activity…";
  try {
    const result = await api("/api/history/" + wallet + "?limit=" + HOME_ACTIVITY_LIMIT);
    if (generation !== state.generation) return;
    state.cursor = result.nextCursor;
    state.items = result.items.slice(0, HOME_ACTIVITY_LIMIT);
    renderHistory();
    $("history-state").textContent = "Showing " + state.items.length + " recent record" + (state.items.length === 1 ? "" : "s") + (state.cursor ? " · More available" : "");
  } catch (error) {
    if (generation === state.generation) { $("history-state").textContent = error.message; $("history-empty").textContent = "Activity query unavailable. Press refresh to retry."; }
  } finally { if (generation === state.generation) state.historyBusy = false; }
}
async function refresh() {
  if (!state.config?.configured) return;
  const generation = state.generation, wallet = state.wallet;
  $("refresh-button").disabled = true;
  notice();
  try {
    const pool = await api("/api/pool");
    if (generation !== state.generation) return;
    $("pool-principal").textContent = pool.principalEth;
    if (!pool.solvent) throw new Error("The contract balance does not cover its recorded principal. Do not submit a deposit.");
    if (wallet) {
      const position = await api("/api/position/" + wallet);
      if (generation !== state.generation) return;
      showPosition(position);
      await history();
    }
  } catch (error) {
    if (generation === state.generation) { $("pool-principal").textContent = "—"; clearPosition(); notice(error.message); }
  } finally { $("refresh-button").disabled = false; }
}
async function ensureNetwork() {
  const chain = await window.ethereum.request({ method: "eth_chainId" });
  if (Number.parseInt(chain, 16) === state.config.chainId) return;
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: state.config.chainHex }] }); }
  catch (error) {
    if (error.code === 4902 && state.config.chainId === 11155111) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
        chainId: state.config.chainHex, chainName: "Sepolia", nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"],
      }] });
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: state.config.chainHex }] });
    } else throw error;
  }
}
async function selectAccount(accounts, selected = null) {
  state.accounts = connectedAccounts(accounts);
  state.generation++; state.wallet = state.accounts.find(account => account.toLowerCase() === selected?.toLowerCase()) || state.accounts[0] || null;
  const generation = state.generation;
  state.provider = null;
  state.items = []; state.cursor = null; state.tx = null; state.historyBusy = false;
  $("transaction-box").classList.add("hidden"); $("form-message").textContent = "";
  clearPosition(); renderHistory();
  walletMenu.setAccounts(state.accounts, state.wallet);
  rememberAccount(state.wallet, state.config);
  $("account-label").textContent = state.wallet || "Connect your wallet to view your position.";
  if (!state.wallet) { notice(); return; }
  const chain = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
  if (generation !== state.generation) return;
  if (chain !== state.config.chainId) { notice("Open the wallet menu and choose Reconnect wallet to switch to " + state.config.chainName + "."); return; }
  state.provider = new window.ethers.BrowserProvider(window.ethereum, "any");
  await refresh(); if (generation === state.generation) loadSaved();
}
async function connect() {
  if (!window.ethereum) { notice("MetaMask was not found. Install or enable MetaMask, then reload this page."); return; }
  try {
    await ensureNetwork();
    const accounts = connectedAccounts(await window.ethereum.request({ method: "eth_requestAccounts" }));
    await selectAccount(accounts, preferredAccount(accounts, state.config));
  } catch (error) { notice(walletError(error)); }
}
async function submit(kind) {
  if (state.busy || state.walletBusy || !state.position || !state.wallet) return;
  $("form-message").textContent = "";
  const generation = state.generation, wallet = state.wallet;
  let value;
  try {
    value = kind === "all" ? BigInt(state.position.redeemableWei) : parseAmount($(kind === "deposit" ? "deposit-amount" : "withdraw-amount").value);
    if (kind !== "deposit" && value > BigInt(state.position.redeemableWei)) throw new Error("The amount exceeds your redeemable principal.");
    if (value <= 0n) throw new Error("You have no shares to redeem.");
  } catch (error) { $("form-message").textContent = error.message; return; }
  state.busy = true; actions();
  txView({ status: "signing", detail: "Review the amount and gas in MetaMask. No transaction has been submitted yet." });
  try {
    const chain = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (chain !== state.config.chainId || !connectedAccounts(accounts).some(account => account.toLowerCase() === wallet.toLowerCase())) throw new Error("Wallet changed");
    const signer = await state.provider.getSigner(wallet);
    const contract = new window.ethers.Contract(state.config.contractAddress, state.config.abi, signer);
    if (kind === "deposit") {
      const gas = await contract.deposit.estimateGas({ value });
      const fees = await state.provider.getFeeData();
      const balance = await state.provider.getBalance(wallet);
      if (balance < value + gas * (fees.maxFeePerGas || fees.gasPrice || 0n)) throw { code: "INSUFFICIENT_FUNDS" };
    }
    if (generation !== state.generation) throw new Error("Wallet changed");
    const tx = kind === "deposit" ? await contract.deposit({ value })
      : kind === "all" ? await contract.withdrawAll() : await contract.withdraw(value);
    const transaction = { hash: tx.hash, status: "pending", kind, wallet, detail: "Submitted. Waiting for the blockchain to execute it." };
    if (generation !== state.generation) return;
    txView(transaction); persist(transaction);
    try {
      const receipt = await tx.wait(1, 60000);
      if (generation !== state.generation) return;
      const updated = { ...transaction, status: receipt?.status === 1 ? "success" : "failed",
        detail: receipt?.status === 1 ? "Confirmed in block " + receipt.blockNumber + "." : "The transaction reverted. Shares were unchanged; gas was spent." };
      txView(updated); persist(updated);
      if (updated.status === "success") $(kind === "deposit" ? "deposit-amount" : "withdraw-amount").value = "";
      await refresh();
    } catch (error) {
      if (generation !== state.generation) return;
      if (error.code === "TRANSACTION_REPLACED") {
        const updated = { ...transaction, hash: error.replacement?.hash || transaction.hash,
          status: error.cancelled ? "cancelled" : error.receipt?.status === 1 ? "success" : "failed",
          detail: error.cancelled ? "The wallet replaced this operation with a cancellation." : "The replacement transaction has been mined." };
        txView(updated); persist(updated); await refresh();
      } else if (error.receipt) {
        const updated = { ...transaction, status: "failed", detail: "The transaction reverted. Shares were unchanged; gas was spent." };
        txView(updated); persist(updated); await refresh();
      } else {
        const updated = { ...transaction, status: "unknown", detail: "Confirmation is taking longer than expected. Keep this hash and check again." };
        txView(updated); persist(updated);
      }
    }
  } catch (error) {
    if (generation === state.generation) {
      const detail = walletError(error);
      txView({ status: "rejected", detail }); $("form-message").textContent = detail;
    }
  } finally { state.busy = false; actions(); }
}
function tab(selected) {
  for (const name of ["deposit", "withdraw"]) {
    $(name + "-tab").classList.toggle("active", name === selected);
    $(name + "-tab").setAttribute("aria-selected", String(name === selected));
    $(name + "-panel").classList.toggle("hidden", name !== selected);
  }
}
async function boot() {
  $("refresh-button").addEventListener("click", () => void refresh());
  $("deposit-tab").addEventListener("click", () => tab("deposit"));
  $("withdraw-tab").addEventListener("click", () => tab("withdraw"));
  $("deposit-panel").addEventListener("submit", (e) => { e.preventDefault(); void submit("deposit"); });
  $("withdraw-panel").addEventListener("submit", (e) => { e.preventDefault(); void submit("withdraw"); });
  $("withdraw-all-button").addEventListener("click", () => void submit("all"));
  $("check-transaction").addEventListener("click", () => void checkTransaction());
  $("deposit-amount").addEventListener("input", () => {
    try { $("deposit-preview").textContent = formatAmount(parseAmount($("deposit-amount").value)); }
    catch { $("deposit-preview").textContent = "0"; }
  });
  try {
    state.config = await api("/api/config");
    walletMenu.setBusy(false);
    $("network-badge").lastChild.textContent = state.config.chainName;
    $("setup-message").classList.toggle("hidden", state.config.configured);
    await refresh();
    if (window.ethereum) {
      window.ethereum.on?.("accountsChanged", (accounts) => void selectAccount(accounts).catch((error) => notice(error.message)));
      window.ethereum.on?.("chainChanged", () => {
        state.generation++; state.provider = null; clearPosition();
        state.items = []; state.cursor = null; state.historyBusy = false; renderHistory();
        notice("Wallet network changed. Open the wallet menu and choose Reconnect wallet.");
      });
      window.ethereum.on?.("disconnect", () => void selectAccount([]));
      const accounts = connectedAccounts(await window.ethereum.request({ method: "eth_accounts" }));
      if (accounts.length) await selectAccount(accounts, preferredAccount(accounts, state.config));
    }
  } catch (error) { notice(error.message); }
}
void boot();
