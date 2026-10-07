import { walletError } from "./numbers.js";
import { renderActivityRows } from "./activity-table.js";
import { scopedApi, activityPath } from "./investment-context.js";
import { createWalletMenu, connectedAccounts, authorizeAccounts, preferredAccount, rememberAccount } from "./wallet-menu.js";

const $ = id => document.getElementById(id);
const state = { config: null, wallet: null, connectedWallet: null, items: [], cursor: null, busy: false, failed: false, generation: 0 };
const walletMenu = createWalletMenu({ onConnect: connect, onSelect: chooseAccount,
  onManage: async () => { const selected = state.connectedWallet; await chooseAccount(await authorizeAccounts(), selected); }, onError: notice });
async function chooseAccount(value, selected = null) {
  const accounts = connectedAccounts(value);
  state.connectedWallet = accounts.find(account => account.toLowerCase() === selected?.toLowerCase()) || accounts[0] || null;
  walletMenu.setAccounts(accounts, state.connectedWallet);
  rememberAccount(state.connectedWallet, state.config);
  await selectWallet(state.connectedWallet);
}
function notice(message = "") {
  $("page-message").textContent = message;
  $("page-message").classList.toggle("hidden", !message);
}
async function api(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(scopedApi(path), { signal: controller.signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Activity could not be loaded. Please retry.");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The query timed out. Please retry.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function render() {
  renderActivityRows($("history-body"), state.items, state.config?.explorerUrl);
  $("activity-account").textContent = state.wallet ? "Viewing activity for " + state.wallet : "Connect your wallet to view its history.";
  $("history-empty").classList.toggle("hidden", state.items.length > 0);
  $("history-empty").textContent = state.busy ? "Loading confirmed activity…"
    : state.failed ? "Activity is unavailable. Press refresh to retry."
    : !state.wallet ? "Connect your wallet to see your activity."
    : state.cursor ? "No activity in this block range. Load an older range to continue." : "No confirmed activity yet.";
  $("load-history").classList.toggle("hidden", !state.cursor);
  $("load-history").disabled = state.busy;
  $("refresh-activity").disabled = !state.wallet || !state.config?.configured || state.busy;
}
async function loadHistory(reset = false) {
  if (state.busy || !state.wallet || !state.config?.configured || (!reset && !state.cursor)) return;
  const wallet = state.wallet, generation = state.generation;
  const cursor = reset ? null : state.cursor;
  state.busy = true; state.failed = false;
  if (reset) { state.items = []; state.cursor = null; }
  render(); notice();
  $("history-state").textContent = "Reading on-chain activity…";
  try {
    const result = await api("/api/history/" + wallet + "?limit=20" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
    if (generation !== state.generation) return;
    state.items = reset ? result.items : [...state.items, ...result.items];
    state.cursor = result.nextCursor;
    $("history-state").textContent = state.items.length + " record" + (state.items.length === 1 ? "" : "s") + " loaded · "
      + (state.cursor ? "Older activity available" : "All activity loaded");
  } catch (error) {
    if (generation !== state.generation) return;
    state.failed = true;
    notice(error.message);
    $("history-state").textContent = "Activity query unavailable. Retry with refresh or load older activity.";
  } finally {
    if (generation === state.generation) { state.busy = false; render(); }
  }
}
async function selectWallet(wallet) {
  state.generation++; state.wallet = null; state.items = []; state.cursor = null; state.busy = false; state.failed = false;
  $("history-state").textContent = "";
  render();
  if (!wallet) { notice(); window.history.replaceState(null, "", activityPath); return; }
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) { notice("Enter a valid Ethereum wallet address."); return; }
  state.wallet = wallet; render();
  window.history.replaceState(null, "", activityPath + "?wallet=" + encodeURIComponent(wallet));
  await loadHistory(true);
}
async function connect() {
  if (!window.ethereum) { notice("MetaMask was not found. Install or enable MetaMask, then reload this page."); return; }
  try {
    const accounts = connectedAccounts(await window.ethereum.request({ method: "eth_requestAccounts" }));
    await chooseAccount(accounts, preferredAccount(accounts, state.config));
  } catch (error) { notice(walletError(error)); }
}
$("refresh-activity").addEventListener("click", () => void loadHistory(true));
$("load-history").addEventListener("click", () => void loadHistory());
try {
  state.config = await api("/api/config");
  $("network-badge").lastChild.textContent = state.config.chainName;
  walletMenu.setBusy(false);
  if (!state.config.configured) notice("The pool is not configured yet. Return to the overview to complete setup.");
  window.ethereum?.on?.("accountsChanged", accounts => void chooseAccount(accounts).catch(error => notice(walletError(error))));
  window.ethereum?.on?.("disconnect", () => void chooseAccount([]));
  const requestedWallet = new URLSearchParams(window.location.search).get("wallet");
  const accounts = window.ethereum ? connectedAccounts(await window.ethereum.request({ method: "eth_accounts" })) : [];
  state.connectedWallet = preferredAccount(accounts, state.config);
  walletMenu.setAccounts(accounts, state.connectedWallet);
  if (requestedWallet) await selectWallet(requestedWallet);
  else if (state.connectedWallet) await chooseAccount(accounts, state.connectedWallet);
} catch (error) { notice(error.message); }
