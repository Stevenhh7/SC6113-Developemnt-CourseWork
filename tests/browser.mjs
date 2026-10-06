// Automated EIP-1193 wallet simulation against a real local Hardhat chain.
// This verifies UI/contract/backend integration; it is not a real MetaMask/Sepolia session.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { JsonRpcProvider, ContractFactory } from "ethers";

const rpc = "http://127.0.0.1:18545";
const origin = "http://127.0.0.1:5081";
const python = process.env.PYTHON_BIN || (process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const children = [];
const launch = (executable, args, env={}) => {
  const child = spawn(executable, args, { env: { ...process.env, ...env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stdout.on("data", b => { log = (log + b).slice(-10000); });
  child.stderr.on("data", b => { log = (log + b).slice(-10000); });
  child.on("error", e => { log += String(e); }); child.getLog = () => log;
  children.push(child); return child;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitUntil(check, timeout=30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(150); }
  throw new Error("Timed out waiting for UI state: " + String(check));
}
async function waitForServer(url, child) {
  for (let i=0; i<80; i++) {
    if (child.exitCode !== null) throw new Error("Test service exited: " + child.getLog());
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(250);
  }
  throw new Error("Test service did not start: " + child.getLog());
}
let browser;
const results = [];
const mark = value => { results.push(value); console.log("PASS " + value); };
try {
  if (!existsSync(python)) throw new Error("Create the .venv and install requirements-dev.txt first.");
  const node = launch(process.execPath, ["node_modules/hardhat/dist/src/cli.js", "node", "--hostname", "127.0.0.1", "--port", "18545"]);
  // A GET to the JSON-RPC root is not a valid JSON-RPC request, so probe with POST.
  for (let i=0; i<80; i++) {
    try {
      const r = await fetch(rpc, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_chainId",params:[]}) });
      if ((await r.json()).result === "0x7a69") break;
    } catch {}
    if (i===79 || node.exitCode !== null) throw new Error("Hardhat node did not start: " + node.getLog());
    await delay(250);
  }
  const provider = new JsonRpcProvider(rpc);
  const signer = await provider.getSigner(0), other = await provider.getSigner(1);
  const artifact = JSON.parse(await readFile("contract/MicroInvest.json", "utf8"));
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
  const receipt = await contract.deploymentTransaction().wait();
  const environment = { CHAIN_ID:"31337", LOCAL_DEVELOPMENT:"true", RPC_URL:rpc,
    CONTRACT_ADDRESS:await contract.getAddress(), DEPLOYMENT_BLOCK:String(receipt.blockNumber),
    PORT:"5081", RPC_TIMEOUT:"2", HISTORY_PAGE_BLOCKS:"5000", LOG_CHUNK_SIZE:"1000" };
  let server = launch(python, ["app.py"], environment);
  await waitForServer(origin + "/healthz", server);
  assert.equal((await (await fetch(origin+"/api/pool")).json()).principalWei, "0");
  mark("Flask verifies deployed bytecode and serves real chain data");
  const channel = process.env.BROWSER_CHANNEL || (process.platform === "win32" && !existsSync(chromium.executablePath()) && existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") ? "msedge" : undefined);
  browser = await chromium.launch({headless:true, channel});
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const consoleErrors = [];
  page.on("pageerror", error=>consoleErrors.push(String(error)));
  await page.exposeFunction("localWalletRpc", async payload => {
    try { return {result:await provider.send(payload.method, payload.params||[])}; }
    catch (error) { return {error:{code:error.code,message:error.shortMessage||error.message}}; }
  });
  await page.addInitScript(({wallet}) => {
    const handlers = {};
    let accounts=[wallet], connected=false, chain="0x7a69";
    window.ethereum = {
      isMetaMask:true,
      on(name,handler){ (handlers[name] ||= []).push(handler); },
      async request(payload) {
        if(payload.method==="eth_accounts") return connected?accounts:[];
        if(payload.method==="eth_requestAccounts"){connected=true;return accounts;}
        if(payload.method==="eth_chainId") return chain;
        if(payload.method==="wallet_switchEthereumChain"){chain=payload.params[0].chainId;return null;}
        if(payload.method==="eth_sendTransaction" && window.rejectNextWalletRequest){window.rejectNextWalletRequest=false;const e=new Error("User declined");e.code=4001;throw e;}
        const value=await window.localWalletRpc(payload);
        if(value.error){const e=new Error(value.error.message);e.code=value.error.code;throw e;}
        return value.result;
      }
    };
    window.changeWallet=(wallet)=>{accounts=wallet?[wallet]:[];connected=Boolean(wallet);for(const h of handlers.accountsChanged||[])h(accounts);};
    window.changeNetwork=(value)=>{chain=value;for(const h of handlers.chainChanged||[])h(value);};
  }, {wallet:await signer.getAddress()});
  await page.goto(origin);
  await page.locator("#connect-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  mark("Wallet connection and initial position");
  await page.locator("#deposit-amount").fill("0");
  await page.locator("#deposit-button").click();
  await waitUntil(async()=>(await page.locator("#form-message").textContent()).includes("greater than zero"));
  await page.locator("#deposit-amount").fill("0.003");
  await page.locator("#deposit-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0.003");
  assert.match(await page.locator("#transaction-status").textContent(), /confirmed/);
  mark("Input validation, deposit, mined confirmation and exact shares");
  await page.locator("#withdraw-tab").click();
  await page.locator("#withdraw-amount").fill("0.004");
  await page.locator("#withdraw-button").click();
  await waitUntil(async()=>(await page.locator("#form-message").textContent()).includes("exceeds"));
  await page.locator("#withdraw-amount").fill("0.001");
  await page.locator("#withdraw-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0.002");
  mark("Excess withdrawal rejection and partial redemption");
  await page.evaluate(wallet=>window.changeWallet(wallet),await other.getAddress());
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  assert.equal(await page.locator("#history-body tr").count(),0);
  await page.evaluate(wallet=>window.changeWallet(wallet),await signer.getAddress());
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0.002");
  mark("Account switching isolates positions and histories");
  await page.locator("#withdraw-all-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  await waitUntil(async()=>await page.locator("#history-body tr").count()===3);
  mark("Full exit and event-backed history");
  await page.locator("#deposit-tab").click();
  await page.evaluate(()=>window.rejectNextWalletRequest=true);
  await page.locator("#deposit-amount").fill("0.001");
  await page.locator("#deposit-button").click();
  await waitUntil(async()=>(await page.locator("#transaction-status").textContent()).includes("declined"));
  assert.equal(await contract.totalShares(),0n);
  mark("Wallet rejection does not report success or alter chain state");
  await page.evaluate(()=>window.changeNetwork("0x1"));
  await waitUntil(()=>page.locator("#deposit-button").isDisabled());
  await page.locator("#connect-button").click();
  await waitUntil(()=>page.locator("#deposit-button").isEnabled());
  mark("Wrong network disables writes and reconnection restores them");
  server.kill(); await new Promise(resolve=>server.once("exit",resolve));
  server=launch(python,["app.py"],environment); await waitForServer(origin+"/healthz",server);
  await page.reload();
  await page.locator("#connect-button").click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===3);
  mark("Backend restart restores history from chain without a database");
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  mark("Mobile layout does not overflow");
  await page.goto(origin+"/deploy");
  await page.locator("#deploy-connect").click();
  await page.locator("#deploy-contract").click();
  await page.locator("#deploy-result").waitFor({state:"visible",timeout:30000});
  assert.match(await page.locator("#deploy-env").textContent(),/CONTRACT_ADDRESS=0x/);
  mark("Browser wallet deployment produces confirmed address and deployment block");
  await page.goto(origin);
  await page.locator("#connect-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  node.kill(); await new Promise(resolve=>node.once("exit",resolve));
  await page.locator("#refresh-button").click();
  await waitUntil(async()=>(await page.locator("#page-message").textContent()).includes("could not be completed"));
  assert.equal(await page.locator("#owned-shares").textContent(),"—");
  assert.equal(await page.locator("#deposit-button").isDisabled(),true);
  mark("RPC failure becomes an explicit error and disables writes");
  assert.deepEqual(consoleErrors,[]);
  mark("No browser script errors");
  await mkdir("test-results",{recursive:true});
  await writeFile("test-results/browser.json",JSON.stringify({environment:"local Hardhat + Flask + simulated EIP-1193 wallet",checks:results},null,2));
} finally {
  if(browser) await browser.close();
  for(const child of children) if(child.exitCode===null) child.kill();
}
