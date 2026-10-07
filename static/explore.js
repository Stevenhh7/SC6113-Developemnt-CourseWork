import { shortAddress, walletError } from "./numbers.js";
import { createWalletMenu, connectedAccounts, authorizeAccounts, preferredAccount, rememberAccount } from "./wallet-menu.js";
const $ = id => document.getElementById(id);
const state = { config: null, wallet: null, page: 1, next: null, busy: false, generation: 0 };
const menu = createWalletMenu({ onConnect: connect, onSelect: selectAccount,
  onManage: async () => selectAccount(await authorizeAccounts(), state.wallet), onError: notice });
function notice(message = "") { $("page-message").textContent = message; $("page-message").classList.toggle("hidden", !message); }
async function api(path) {
  const response = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(35000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "The investment directory could not be loaded.");
  return data;
}
function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function card(project) {
  const article = element("article", "", "card project-card");
  article.append(element("p", "INVESTMENT #" + project.id, "eyebrow"), element("h3", project.name),
    element("p", project.description, "project-summary"), element("p", "Contract " + shortAddress(project.contractAddress), "muted"));
  const link = element("a", "View investment →", "button secondary small"); link.href = "/investments/" + project.id;
  article.append(link); return article;
}
async function search(reset = true) {
  if (reset) state.page = 1;
  const generation = ++state.generation, query = $("project-search").value.trim();
  if ($("my-investments").checked && !state.wallet) {
    state.busy = false; state.next = null;
    $("previous-projects").disabled = $("next-projects").disabled = true;
    $("results-state").textContent = "Connect your wallet to use this filter.";
    notice("Connect your wallet to find projects you created."); return;
  }
  state.busy = true; notice(); $("results-state").textContent = "Searching investments…";
  $("previous-projects").disabled = $("next-projects").disabled = true;
  const params = new URLSearchParams({ q: query, page: String(state.page) });
  if ($("my-investments").checked) params.set("creator", state.wallet);
  try {
    const result = await api("/api/investments?" + params);
    if (generation !== state.generation) return;
    $("project-list").replaceChildren(...result.items.map(card));
    $("projects-empty").classList.toggle("hidden", result.items.length > 0);
    $("results-state").textContent = result.total + " investment" + (result.total === 1 ? "" : "s") + " found";
    state.next = result.nextPage; $("project-page").textContent = "Page " + state.page;
    window.history.replaceState(null, "", query ? "/?q=" + encodeURIComponent(query) : "/");
  } catch (error) {
    if (generation === state.generation) { state.next = null; notice(error.name === "TimeoutError" ? "The directory took too long to respond. Please retry." : error.message); $("results-state").textContent = "Search unavailable. Press Search to retry."; }
  } finally {
    if (generation === state.generation) { state.busy = false; $("previous-projects").disabled = state.page <= 1; $("next-projects").disabled = !state.next; }
  }
}
async function selectAccount(value, selected = null) {
  const accounts = connectedAccounts(value);
  state.wallet = accounts.find(account => account.toLowerCase() === selected?.toLowerCase()) || accounts[0] || null;
  menu.setAccounts(accounts, state.wallet); rememberAccount(state.wallet, state.config);
  if (!state.wallet) $("my-investments").checked = false;
  await search();
}
async function connect() {
  if (!window.ethereum) { notice("MetaMask was not found. Install or enable it, then reload."); return; }
  try { const accounts = connectedAccounts(await window.ethereum.request({ method: "eth_requestAccounts" })); await selectAccount(accounts, preferredAccount(accounts, state.config)); }
  catch (error) { notice(walletError(error)); }
}
$("search-form").addEventListener("submit", event => { event.preventDefault(); void search(); });
$("my-investments").addEventListener("change", () => void search());
$("previous-projects").addEventListener("click", () => { if (!state.busy && state.page > 1) { state.page--; void search(false); } });
$("next-projects").addEventListener("click", () => { if (!state.busy && state.next) { state.page = state.next; void search(false); } });
$("project-search").value = new URLSearchParams(window.location.search).get("q") || "";
try {
  state.config = await api("/api/config"); menu.setBusy(false); $("network-badge").lastChild.textContent = state.config.chainName;
  window.ethereum?.on?.("accountsChanged", accounts => void selectAccount(accounts).catch(error => notice(error.message)));
  window.ethereum?.on?.("disconnect", () => void selectAccount([]));
  const accounts = window.ethereum ? connectedAccounts(await window.ethereum.request({ method: "eth_accounts" })) : [];
  if (accounts.length) await selectAccount(accounts, preferredAccount(accounts, state.config)); else await search();
} catch (error) { notice(error.message); }
