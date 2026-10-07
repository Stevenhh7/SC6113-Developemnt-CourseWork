import { walletError } from "./numbers.js";
import { createWalletMenu, connectedAccounts, authorizeAccounts, preferredAccount, rememberAccount } from "./wallet-menu.js";
const $ = id => document.getElementById(id);
let config, artifact, provider, wallet, result = null, busy = false;
const key = () => "microinvest:pending-deployment:" + config.chainId;
const menu = createWalletMenu({ onConnect: connect, onSelect: chooseAccount,
  onManage: async () => chooseAccount(await authorizeAccounts(), wallet), onError: status });
function status(message) { $("deploy-status").textContent = message; }
async function api(path, data) {
  const response = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(35000), ...(data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "The project could not be registered. Retry with the same deployment.");
  return body;
}
function controls() {
  $("deploy-contract").disabled = busy || !wallet || !artifact || !config?.deploymentReady || Boolean(result);
  $("register-investment").disabled = busy || !wallet || !result || Boolean(result.id) || Boolean(result.failed);
  for (const id of ["investment-name", "investment-description"]) $(id).disabled = busy || Boolean(result);
  menu.setBusy(busy || !config);
}
function save() { try { if (result) localStorage.setItem(key(), JSON.stringify(result)); else localStorage.removeItem(key()); } catch { /* The downloadable record remains available. */ } }
function showResult() {
  $("deploy-result").classList.toggle("hidden", !result);
  if (!result) return;
  $("result-title").textContent = result.id ? "Investment published" : result.failed ? "Deployment failed or cancelled" : result.deploymentBlock ? "Deployment confirmed" : "Deployment submitted";
  $("deploy-env").textContent = "Name: " + result.projectName + "\nContract: " + result.address + "\nDeployment transaction: " + result.transactionHash
    + (result.deploymentBlock ? "\nDeployment block: " + result.deploymentBlock : "") + (result.id ? "\nInvestment ID: " + result.id : "");
  $("deploy-tx").textContent = result.transactionHash;
  if (config.explorerUrl) $("deploy-tx").href = config.explorerUrl + "/tx/" + result.transactionHash;
  $("open-investment").classList.toggle("hidden", !result.id);
  $("register-investment").classList.toggle("hidden", Boolean(result.id || result.failed));
  $("create-another").classList.toggle("hidden", !result.id && !result.failed);
  if (result.id) { $("open-investment").href = "/investments/" + result.id; $("registration-note").textContent = "Your project is now searchable. Participants can open its page to deposit or redeem their own principal."; }
  controls();
}
async function network() {
  if (Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16) === config.chainId) return;
  try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainHex }] }); }
  catch (error) {
    if (error.code !== 4902 || config.chainId !== 11155111) throw error;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: config.chainHex, chainName: "Sepolia", nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"] }] });
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainHex }] });
  }
}
async function chooseAccount(value, selected = null) {
  const accounts = connectedAccounts(value);
  wallet = accounts.find(account => account.toLowerCase() === selected?.toLowerCase()) || accounts[0] || null;
  provider = wallet ? new window.ethers.BrowserProvider(window.ethereum, "any") : null;
  menu.setAccounts(accounts, wallet);
  if (wallet) rememberAccount(wallet, config);
  controls();
}
async function connect() {
  if (!window.ethereum) { status("Install or enable MetaMask and reload."); return; }
  try {
    await network();
    const accounts = connectedAccounts(await window.ethereum.request({ method: "eth_requestAccounts" }));
    await chooseAccount(accounts, preferredAccount(accounts, config)); status("Connected. Deployment uses test ETH for gas; registration is a message signature.");
  } catch (error) { status(walletError(error)); }
}
async function verifyWallet(expected) {
  if (!wallet || wallet.toLowerCase() !== expected.toLowerCase()) throw new Error("Select the wallet that deployed this investment, then retry registration.");
  const accounts = connectedAccounts(await window.ethereum.request({ method: "eth_accounts" }));
  const chain = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
  if (chain !== config.chainId || !accounts.some(account => account.toLowerCase() === expected.toLowerCase())) throw new Error("Wallet changed. Reconnect to the target network.");
}
async function publish() {
  await verifyWallet(result.deployer);
  const data = { name: result.projectName, description: result.description, transactionHash: result.transactionHash };
  const response = await api("/api/investments/registration-message", data);
  await verifyWallet(result.deployer);
  status("Approve the registration message in MetaMask. This signature does not move funds or spend gas.");
  const signature = await (await provider.getSigner(result.deployer)).signMessage(response.message);
  const project = await api("/api/investments", { ...data, signature });
  result = { ...result, id: project.id, deploymentBlock: project.deploymentBlock };
  try { localStorage.removeItem(key()); } catch { /* Registration is already persistent on the server. */ }
  showResult(); status("Investment published. Open its page or find it by name in Explore.");
}
async function deploy() {
  if (busy || !wallet || !artifact || result) return;
  const name = $("investment-name").value.trim(), description = $("investment-description").value.trim();
  if (!name || name.length > 120 || !description || description.length > 2000) { status("Enter a name (up to 120 characters) and a description (up to 2000 characters)."); return; }
  const deployer = wallet;
  busy = true; controls();
  try {
    await verifyWallet(deployer);
    const signer = await provider.getSigner(deployer);
    status("Approve the contract deployment in MetaMask. Each project gets an independent pool.");
    const contract = await new window.ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
    const tx = contract.deploymentTransaction();
    result = { chainId: config.chainId, projectName: name, description, transactionHash: tx.hash, address: await contract.getAddress(), deployer, deploymentBlock: null };
    save(); showResult(); status("Deployment submitted. Waiting for confirmation; keep the displayed hash.");
    let receipt;
    try { receipt = await tx.wait(1, 180000); }
    catch (error) {
      if (error.code === "TRANSACTION_REPLACED") {
        if (error.cancelled || error.receipt?.status !== 1 || !error.receipt.contractAddress) { result.failed = true; save(); showResult(); throw new Error("Deployment was cancelled or reverted. Check the transaction before creating another investment."); }
        receipt = error.receipt; result.transactionHash = error.replacement.hash; result.address = receipt.contractAddress;
      } else { if (error.receipt?.status === 0) { result.failed = true; save(); showResult(); } throw error; }
    }
    if (!receipt || receipt.status !== 1) { result.failed = true; save(); showResult(); throw new Error("Deployment failed. Check the transaction in the explorer."); }
    result.deploymentBlock = receipt.blockNumber; save(); showResult(); await publish();
  } catch (error) { status(result ? "Keep this deployment record: " + (error.message || walletError(error)) : walletError(error)); }
  finally { busy = false; controls(); }
}
$("create-investment").addEventListener("submit", event => { event.preventDefault(); void deploy(); });
$("register-investment").addEventListener("click", async () => {
  if (busy || !result) return;
  busy = true; controls();
  try { await publish(); } catch (error) { status(error.message || walletError(error)); }
  finally { busy = false; controls(); }
});
$("create-another").addEventListener("click", () => { result = null; save(); $("create-investment").reset(); $("deploy-tx").textContent = ""; $("deploy-result").classList.add("hidden"); status("Enter the details for your next investment."); controls(); });
$("download-deployment").addEventListener("click", () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "investment-" + result.address + ".json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
  [config, artifact] = await Promise.all([api("/api/config"), api("/api/artifact")]);
  $("network-badge").lastChild.textContent = config.chainName;
  $("deploy-network").textContent = "Network: " + config.chainName + " · Independent MicroInvest contract";
  if (!config.deploymentReady) status("The server needs its RPC URL configured before project registration is available.");
  try {
    const saved = JSON.parse(localStorage.getItem(key()) || "null");
    if (saved?.chainId === config.chainId && /^0x[0-9a-fA-F]{64}$/.test(saved.transactionHash) && /^0x[0-9a-fA-F]{40}$/.test(saved.address) && typeof saved.projectName === "string" && typeof saved.description === "string" && /^0x[0-9a-fA-F]{40}$/.test(saved.deployer)) {
      result = saved; $("investment-name").value = saved.projectName; $("investment-description").value = saved.description; showResult(); status("Recovered your deployment. Connect the deploying wallet and retry registration.");
    }
  } catch { /* Invalid local state cannot register a contract. */ }
  window.ethereum?.on?.("accountsChanged", accounts => void chooseAccount(accounts).catch(error => status(error.message)));
  window.ethereum?.on?.("chainChanged", () => { wallet = null; provider = null; menu.setAccounts([], null); controls(); status("Network changed. Reconnect before continuing."); });
  window.ethereum?.on?.("disconnect", () => void chooseAccount([]));
  const accounts = window.ethereum ? connectedAccounts(await window.ethereum.request({ method: "eth_accounts" })) : [];
  await chooseAccount(accounts, preferredAccount(accounts, config));
} catch (error) { status(error.message); }
