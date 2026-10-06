import { shortAddress, walletError } from "./numbers.js";

export function connectedAccounts(accounts) {
  const seen = new Set();
  return (Array.isArray(accounts) ? accounts : []).filter(account => {
    if (typeof account !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(account) || seen.has(account.toLowerCase())) return false;
    seen.add(account.toLowerCase());
    return true;
  });
}
const preferenceKey = config => ["microinvest", config.chainId, config.contractAddress, "selected-account"].join(":");
export function preferredAccount(accounts, config) {
  let saved;
  try { saved = localStorage.getItem(preferenceKey(config)); } catch { /* Storage is optional. */ }
  return accounts.find(account => account.toLowerCase() === saved?.toLowerCase()) || accounts[0] || null;
}
export function rememberAccount(account, config) {
  try {
    if (account) localStorage.setItem(preferenceKey(config), account.toLowerCase());
    else localStorage.removeItem(preferenceKey(config));
  } catch { /* Account switching also works with storage disabled. */ }
}
export async function authorizeAccounts() {
  // Only a user click requests new permissions; opening the menu never prompts.
  await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  return connectedAccounts(await window.ethereum.request({ method: "eth_accounts" }));
}

export function createWalletMenu({ onConnect, onSelect, onManage, onError, onBusy = () => {} }) {
  const button = document.getElementById("connect-button");
  const menu = document.getElementById("wallet-menu");
  const list = document.getElementById("wallet-accounts");
  let accounts = [], selected = null, busy = true, pending = false;
  const items = () => [...menu.querySelectorAll("button:not(:disabled)")];
  function close(restoreFocus = false) {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus();
  }
  function lock() {
    button.disabled = busy || pending;
    for (const item of menu.querySelectorAll("button")) item.disabled = busy || pending;
    if (busy || pending) close();
  }
  async function run(action) {
    if (busy || pending) return;
    close(); pending = true; lock(); onBusy(true);
    try { await action(); }
    catch (error) {
      const code = error.code ?? error.error?.code;
      onError(code === -32601 || code === -32004 || code === 4200
        ? "Open MetaMask and connect another account to this site, then return here."
        : walletError(error));
    } finally { pending = false; onBusy(false); lock(); }
  }
  function setAccounts(value, wallet) {
    accounts = connectedAccounts(value);
    selected = accounts.find(account => account.toLowerCase() === wallet?.toLowerCase()) || accounts[0] || null;
    button.textContent = selected ? shortAddress(selected) : "Connect wallet";
    button.dataset.connected = String(Boolean(selected));
    button.setAttribute("aria-label", selected ? "Wallet " + selected + ", choose account" : "Connect wallet");
    if (!selected) close();
    list.replaceChildren();
    for (const account of accounts) {
      const active = account.toLowerCase() === selected?.toLowerCase();
      const item = document.createElement("button");
      item.type = "button"; item.className = "wallet-account";
      item.dataset.account = account;
      item.setAttribute("role", "menuitemradio"); item.setAttribute("aria-checked", String(active));
      const address = document.createElement("span"); address.textContent = shortAddress(account);
      const status = document.createElement("span"); status.className = "wallet-account-status";
      status.textContent = active ? "Selected ✓" : "Switch";
      const fullAddress = document.createElement("small"); fullAddress.textContent = account;
      item.append(address, status, fullAddress);
      item.addEventListener("click", () => void run(async () => {
        const fresh = connectedAccounts(await window.ethereum.request({ method: "eth_accounts" }));
        await onSelect(fresh, account);
      }));
      list.append(item);
    }
    lock();
  }
  button.addEventListener("click", () => {
    if (!selected) { void run(onConnect); return; }
    if (!menu.hidden) { close(); return; }
    menu.hidden = false; button.setAttribute("aria-expanded", "true");
    (menu.querySelector('[aria-checked="true"]') || items()[0])?.focus();
  });
  button.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" && selected && menu.hidden) { event.preventDefault(); button.click(); }
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); const choices = items(), index = choices.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
      choices[next]?.focus();
    }
  });
  document.addEventListener("pointerdown", event => { if (!button.parentElement.contains(event.target)) close(); });
  button.parentElement.addEventListener("focusout", event => { if (!button.parentElement.contains(event.relatedTarget)) close(); });
  document.getElementById("authorize-accounts").addEventListener("click", () => void run(onManage));
  document.getElementById("reconnect-wallet").addEventListener("click", () => void run(onConnect));
  return { setAccounts, setBusy(value) { busy = value; lock(); } };
}
