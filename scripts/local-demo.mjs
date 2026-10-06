// Starts only local services. Optional funding uses Hardhat's unlocked local accounts.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, parseEther } from "ethers";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const rpc = "http://127.0.0.1:8545";
const python = process.env.PYTHON_BIN || (process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const wallet = process.argv[2];
const children = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanup = () => { for (const child of children) if (child.exitCode === null) child.kill(); };
const launch = (program, args, env = {}, visible = false) => {
  const child = spawn(program, args, { windowsHide: true, env: { ...process.env, ...env },
    stdio: visible ? "inherit" : ["ignore", "ignore", "pipe"] });
  child.diagnostic = "";
  child.stderr?.on("data", chunk => { child.diagnostic = (child.diagnostic + chunk).slice(-2000); });
  child.on("error", error => { child.diagnostic = error.message; });
  children.push(child);
  return child;
};
const completed = child => new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error(child.diagnostic || "Local process exited.")));
});

process.once("SIGINT", () => { cleanup(); process.exit(0); });
process.once("SIGTERM", () => { cleanup(); process.exit(0); });
try {
  if (!existsSync(python)) throw new Error("Create .venv and install requirements-dev.txt first (see README.md).");
  if (wallet && !/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("Optional argument must be your public wallet address.");
  for (const url of [rpc, "http://127.0.0.1:5000/healthz"]) {
    let occupied = false;
    try { await fetch(url, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
    if (occupied) throw new Error("A service already uses port " + new URL(url).port + ". Stop it before starting the demo.");
  }
  const node = launch(process.execPath, ["node_modules/hardhat/dist/src/cli.js", "node", "--hostname", "127.0.0.1"]);
  let started = false;
  for (let i = 0; i < 80; i++) {
    if (node.exitCode !== null) throw new Error(node.diagnostic || "Hardhat could not start.");
    try {
      const response = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
      if ((await response.json()).result === "0x7a69") { started = true; break; }
    } catch {}
    await delay(250);
  }
  if (!started) throw new Error("The local chain did not become ready.");
  await completed(launch(process.execPath, ["node_modules/hardhat/dist/src/cli.js", "run", "scripts/deploy.ts", "--network", "localhost"]));
  const deployment = JSON.parse(await readFile("deployments/localhost.json", "utf8"));
  if (wallet) {
    const provider = new JsonRpcProvider(rpc);
    if ((await provider.getNetwork()).chainId !== 31337n) throw new Error("Funding is allowed only on the local chain.");
    const faucet = await provider.getSigner(0);
    await (await faucet.sendTransaction({ to: wallet, value: parseEther("10") })).wait();
    provider.destroy();
    console.log("Funded public wallet " + wallet + " with 10 local test ETH.");
  }
  const web = launch(python, ["app.py"], { CHAIN_ID: "31337", LOCAL_DEVELOPMENT: "true", RPC_URL: rpc,
    CONTRACT_ADDRESS: deployment.address, DEPLOYMENT_BLOCK: String(deployment.deploymentBlock), PORT: "5000" }, true);
  console.log("MicroInvest local demo: http://127.0.0.1:5000");
  console.log("MetaMask local network: RPC " + rpc + ", chain ID 31337, currency ETH.");
  console.log("Stopping the demo resets the local chain. Sepolia data is unaffected. Press Ctrl+C to stop.");
  await completed(web);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { cleanup(); }
