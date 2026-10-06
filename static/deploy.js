import { walletError, shortAddress } from "./numbers.js";
const $ = (id) => document.getElementById(id);
let config, artifact, provider, wallet, result, busy = false;
async function load(path) {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Setup could not be loaded.");
  return body;
}
async function connect() {
  if (!window.ethereum) { $("deploy-status").textContent = "Install or enable MetaMask and reload this page."; return; }
  try {
    const chain = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    if (chain !== config.chainId) {
      try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainHex }] }); }
      catch (error) {
        if (error.code !== 4902 || config.chainId !== 11155111) throw error;
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
          chainId: config.chainHex, chainName: "Sepolia", nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }] });
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: config.chainHex }] });
      }
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    wallet = accounts[0]; provider = new window.ethers.BrowserProvider(window.ethereum, "any");
    $("deploy-connect").textContent = shortAddress(wallet);
    $("deploy-contract").disabled = !artifact;
    $("deploy-status").textContent = "Connected. Deploy only when you are ready to create a new pool.";
  } catch (error) { $("deploy-status").textContent = walletError(error); }
}
async function deploy() {
  if (busy || !wallet || !artifact) return;
  const deployingWallet = wallet;
  busy = true; $("deploy-contract").disabled = true; $("deploy-connect").disabled = true;
  $("deploy-result").classList.add("hidden");
  try {
    const chain = Number.parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (chain !== config.chainId || accounts[0]?.toLowerCase() !== wallet.toLowerCase()) throw new Error("Wallet changed");
    const signer = await provider.getSigner(wallet);
    const factory = new window.ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    $("deploy-status").textContent = "Review and approve the deployment transaction in MetaMask.";
    const contract = await factory.deploy();
    const tx = contract.deploymentTransaction();
    $("deploy-status").textContent = "Deployment submitted. Waiting for confirmation. Keep the transaction hash if this takes longer.";
    $("deploy-tx").textContent = tx.hash;
    if (config.explorerUrl) $("deploy-tx").href = config.explorerUrl + "/tx/" + tx.hash;
    const receipt = await tx.wait(1, 180000);
    if (!receipt || receipt.status !== 1) throw new Error("Deployment failed");
    result = { name: config.chainId === 11155111 ? "sepolia" : "localhost",
      chainId: config.chainId, address: await contract.getAddress(), deploymentBlock: receipt.blockNumber,
      transactionHash: receipt.hash, deployer: deployingWallet, compiler: artifact.compiler };
    $("deploy-env").textContent = "CHAIN_ID=" + result.chainId + "\nCONTRACT_ADDRESS=" + result.address + "\nDEPLOYMENT_BLOCK=" + result.deploymentBlock;
    $("deploy-result").classList.remove("hidden");
    $("deploy-status").textContent = "Confirmed. Save the deployment settings below.";
  } catch (error) {
    $("deploy-status").textContent = error.code === "TIMEOUT"
      ? "Confirmation timed out. Check the displayed transaction hash in your wallet or explorer before deploying again."
      : walletError(error);
  } finally { busy = false; $("deploy-contract").disabled = !wallet; $("deploy-connect").disabled = false; }
}
$("deploy-connect").addEventListener("click", connect);
$("deploy-contract").addEventListener("click", deploy);
$("copy-deployment").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("deploy-env").textContent); $("deploy-status").textContent = "Settings copied."; }
  catch { $("deploy-status").textContent = "Select and copy the settings manually."; }
});
$("download-deployment").addEventListener("click", () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2) + "\n"], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = result.name + ".json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
  [config, artifact] = await Promise.all([load("/api/config"), load("/api/artifact")]);
  $("deploy-connect").disabled = false;
  $("deploy-network").textContent = "Target network: " + config.chainName + " · Contract: MicroInvest · No constructor arguments";
  window.ethereum?.on?.("accountsChanged", () => { wallet = null; $("deploy-contract").disabled = true; $("deploy-connect").textContent = "Reconnect MetaMask"; });
  window.ethereum?.on?.("chainChanged", () => { wallet = null; $("deploy-contract").disabled = true; $("deploy-connect").textContent = "Reconnect MetaMask"; });
} catch (error) { $("deploy-status").textContent = error.message; $("deploy-connect").disabled = true; }
