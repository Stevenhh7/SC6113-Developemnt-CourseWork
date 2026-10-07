// Automated EIP-1193 wallet simulation against a real local Hardhat chain.
// This verifies UI/contract/backend integration; it is not a real MetaMask/Sepolia session.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { JsonRpcProvider, ContractFactory, Contract, HDNodeWallet, getBytes } from "ethers";
import { resolve } from "node:path";

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
  await mkdir("test-results", {recursive:true});
  const databaseUrl = "sqlite:///" + resolve("test-results/catalog-" + Date.now() + ".sqlite3").replaceAll("\\", "/");
  const environment = { DATABASE_URL: databaseUrl, CHAIN_ID:"31337", LOCAL_DEVELOPMENT:"true", RPC_URL:rpc,
    CONTRACT_ADDRESS:await contract.getAddress(), DEPLOYMENT_BLOCK:String(receipt.blockNumber),
    PORT:"5081", RPC_TIMEOUT:"2", HISTORY_PAGE_BLOCKS:"5000", LOG_CHUNK_SIZE:"1000" };
  let server = launch(python, ["app.py"], environment);
  await waitForServer(origin + "/healthz", server);
  assert.equal((await (await fetch(origin+"/api/pool")).json()).principalWei, "0");
  mark("Flask verifies deployed bytecode and serves real chain data");
  const seeded = (await (await fetch(origin + "/api/investments")).json()).items[0];
  const overview = origin + seeded.url;
  const signingWallets = [0,1].map(index => HDNodeWallet.fromPhrase("test test test test test test test test test test test junk", undefined, "m/44\'/60\'/0\'/0/" + index));
  assert.equal(signingWallets[0].address, await signer.getAddress());
  const channel = process.env.BROWSER_CHANNEL || (process.platform === "win32" && !existsSync(chromium.executablePath()) && existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe") ? "msedge" : undefined);
  browser = await chromium.launch({headless:true, channel});
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const consoleErrors = [];
  page.on("pageerror", error=>consoleErrors.push(String(error)));
  await page.exposeFunction("localWalletRpc", async payload => {
    try {
      if (payload.method === "personal_sign") {
        const account = signingWallets.find(candidate => candidate.address.toLowerCase() === payload.params[1].toLowerCase());
        if (!account) throw new Error("Unknown simulated signing account");
        return {result: await account.signMessage(getBytes(payload.params[0]))};
      }
      return {result:await provider.send(payload.method, payload.params||[])};
    }
    catch (error) { return {error:{code:error.code,message:error.shortMessage||error.message}}; }
  });
  await page.addInitScript(({wallet, otherWallet}) => {
    const handlers = {};
    let accounts=sessionStorage.getItem("test-permitted-accounts")==="all"?[wallet,otherWallet]:[wallet], connected=false, chain="0x7a69";
    window.ethereum = {
      isMetaMask:true,
      on(name,handler){ (handlers[name] ||= []).push(handler); },
      async request(payload) {
        if(payload.method==="eth_accounts") return connected?accounts:[];
        if(payload.method==="eth_requestAccounts"){connected=true;return accounts;}
        if(payload.method==="wallet_requestPermissions"){
          if(window.rejectNextPermissions){window.rejectNextPermissions=false;const e=new Error("User declined");e.code=4001;throw e;}
          accounts=[wallet,otherWallet];connected=true;sessionStorage.setItem("test-permitted-accounts","all");
          for(const h of handlers.accountsChanged||[])h(accounts);
          return [{parentCapability:"eth_accounts"}];
        }
        if(payload.method==="eth_chainId") return chain;
        if(payload.method==="wallet_switchEthereumChain"){chain=payload.params[0].chainId;return null;}
        if(payload.method==="personal_sign" && window.rejectNextRegistration){window.rejectNextRegistration=false;const e=new Error("User declined");e.code=4001;throw e;}
        if(payload.method==="eth_sendTransaction" && window.rejectNextWalletRequest){window.rejectNextWalletRequest=false;const e=new Error("User declined");e.code=4001;throw e;}
        const value=await window.localWalletRpc(payload);
        if(value.error){const e=new Error(value.error.message);e.code=value.error.code;throw e;}
        return value.result;
      }
    };
    window.changeWallet=(wallet)=>{accounts=wallet?[wallet]:[];connected=Boolean(wallet);for(const h of handlers.accountsChanged||[])h(accounts);};
    window.changeNetwork=(value)=>{chain=value;for(const h of handlers.chainChanged||[])h(value);};
  }, {wallet:await signer.getAddress(),otherWallet:await other.getAddress()});
  await page.goto(overview);
  await page.locator("#connect-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  mark("Wallet connection and initial position");
  await page.locator("#connect-button").click();
  await page.locator("#wallet-menu").waitFor({state:"visible"});
  assert.equal(await page.locator(".wallet-account").count(),1);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#wallet-menu").isVisible(),false);
  await page.locator("#connect-button").press("ArrowDown");
  await page.locator("#authorize-accounts").click();
  await waitUntil(()=>page.locator("#connect-button").isEnabled());
  await page.locator("#connect-button").click();
  assert.equal(await page.locator(".wallet-account").count(),2);
  await page.locator('.wallet-account[data-account="'+await other.getAddress()+'"]').click();
  await waitUntil(async()=>(await page.locator("#account-label").textContent()).toLowerCase()===(await other.getAddress()).toLowerCase() && await page.locator("#owned-shares").textContent()==="0");
  await page.locator("#connect-button").click();
  assert.equal(await page.locator('[aria-checked="true"]').getAttribute("data-account"),await other.getAddress());
  await page.locator('.wallet-account[data-account="'+await signer.getAddress()+'"]').click();
  await waitUntil(()=>page.locator("#deposit-button").isEnabled());
  await page.locator("#connect-button").click();
  await page.evaluate(()=>window.rejectNextPermissions=true);
  await page.locator("#authorize-accounts").click();
  await waitUntil(async()=>(await page.locator("#page-message").textContent()).includes("declined"));
  assert.equal((await page.locator("#account-label").textContent()).toLowerCase(),(await signer.getAddress()).toLowerCase());
  mark("Wallet menu lists permitted accounts, supports keyboard control and preserves selection on permission rejection");
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
  await page.locator("#reconnect-wallet").click();
  await waitUntil(()=>page.locator("#deposit-button").isEnabled());
  mark("Wrong network disables writes and reconnection restores them");
  server.kill(); await new Promise(resolve=>server.once("exit",resolve));
  server=launch(python,["app.py"],environment); await waitForServer(origin+"/healthz",server);
  await page.reload();
  await page.locator("#connect-button").click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===3);
  mark("Backend restart restores positions and history directly from chain");
  for (let i=1; i<=18; i++) await (await contract.deposit({value:BigInt(i)})).wait();
  await page.locator("#refresh-button").click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===5);
  const complete = (await (await fetch(origin+"/api/history/"+await signer.getAddress()+"?limit=50")).json()).items;
  assert.equal(complete.length,21);
  const displayed = await page.locator("#history-body tr td:last-child a").allTextContents();
  const shortHash = hash=>hash.slice(0,6)+"…"+hash.slice(-4);
  assert.deepEqual(displayed,complete.slice(0,5).map(item=>shortHash(item.transactionHash)));
  assert.equal(await page.locator("#load-history").count(),0);
  mark("Overview displays only the newest five confirmed records");
  await provider.send("hardhat_mine", ["0x1770"]);
  assert.equal((await (await fetch(origin+"/api/history/"+await signer.getAddress()+"?limit=5")).json()).items.length,0);
  await page.reload();
  await page.locator("#connect-button").click();
  await waitUntil(async()=>(await page.locator("#history-state").textContent()).includes("Showing 5 latest"));
  assert.deepEqual(await page.locator("#history-body tr td:last-child a").allTextContents(),displayed);
  mark("Overview restores the latest five after 6000 inactive blocks without requiring new transactions");
  await page.locator("#view-all-activity").click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===20);
  assert.match(page.url(),/\/investments\/\d+\/activity\?wallet=/);
  await page.locator("#load-history").click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===21);
  assert.deepEqual(await page.locator("#history-body tr td:last-child a").allTextContents(),complete.map(item=>shortHash(item.transactionHash)));
  assert.equal(await page.locator("#load-history").isVisible(),false);
  await page.locator("#refresh-activity").click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===20);
  await page.evaluate(wallet=>window.changeWallet(wallet),await other.getAddress());
  await waitUntil(async()=>await page.locator("#history-body tr").count()===0);
  assert.match(await page.locator("#activity-account").textContent(),new RegExp(await other.getAddress(),"i"));
  await page.evaluate(wallet=>window.changeWallet(wallet),await signer.getAddress());
  await waitUntil(async()=>await page.locator("#history-body tr").count()===20);
  await page.locator("#connect-button").click();
  await page.locator("#authorize-accounts").click();
  await waitUntil(()=>page.locator("#connect-button").isEnabled());
  await page.locator("#connect-button").click();
  await page.locator('.wallet-account[data-account="'+await other.getAddress()+'"]').click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===0);
  assert.match(page.url(),new RegExp(await other.getAddress(),"i"));
  await page.locator("#connect-button").click();
  await page.locator('.wallet-account[data-account="'+await signer.getAddress()+'"]').click();
  await waitUntil(async()=>await page.locator("#history-body tr").count()===20);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  mark("All-activity page preserves the wallet, paginates every record and handles refresh/account changes");
  mark("All-activity wallet menu switches the viewed account and updates its URL");
  await (await contract.withdrawAll()).wait();
  await page.goto(overview);
  await page.locator("#connect-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  await page.locator("#connect-button").click();
  await page.locator("#authorize-accounts").click();
  await waitUntil(()=>page.locator("#connect-button").isEnabled());
  await page.locator("#connect-button").click();
  const menuBounds=await page.locator("#wallet-menu").boundingBox();
  assert.ok(menuBounds.x>=0 && menuBounds.x+menuBounds.width<=390);
  await page.locator('.wallet-account[data-account="'+await other.getAddress()+'"]').click();
  await waitUntil(()=>page.locator("#deposit-button").isEnabled());
  await page.locator("#deposit-amount").fill("0.000000000000000017");
  await page.locator("#deposit-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0.000000000000000017");
  assert.equal(await contract.shares(await other.getAddress()),17n);
  assert.equal(await contract.shares(await signer.getAddress()),0n);
  await page.locator("#withdraw-tab").click();
  await page.locator("#withdraw-all-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  assert.equal(await contract.shares(await other.getAddress()),0n);
  await page.reload();
  await page.locator("#connect-button").click();
  await waitUntil(async()=>(await page.locator("#account-label").textContent()).toLowerCase()===(await other.getAddress()).toLowerCase() && await page.locator("#owned-shares").textContent()==="0");
  await waitUntil(async()=>await page.locator("#history-body tr").count()===2);
  await page.evaluate(()=>sessionStorage.removeItem("test-permitted-accounts"));
  await page.reload();
  await page.locator("#connect-button").click();
  await waitUntil(async()=>(await page.locator("#account-label").textContent()).toLowerCase()===(await signer.getAddress()).toLowerCase() && await page.locator("#owned-shares").textContent()==="0");
  mark("Reload remembers an authorized selection and falls back when that account is no longer exposed");
  await page.locator("#connect-button").click();
  await page.locator('.wallet-account[data-account="'+await signer.getAddress()+'"]').click();
  await waitUntil(()=>page.locator("#deposit-button").isEnabled());
  mark("Second permitted account signs deposits and redemptions without relying on the first eth_accounts entry");
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  mark("Mobile layout does not overflow");
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(origin+"/deploy");
  await page.locator("#connect-button").click();
  await waitUntil(()=>page.locator("#deploy-contract").isEnabled());
  const blockBeforeInvalid = await provider.getBlockNumber();
  await page.locator("#deploy-contract").click();
  assert.match(await page.locator("#deploy-status").textContent(),/Enter a name/);
  assert.equal(await provider.getBlockNumber(), blockBeforeInvalid);
  await page.locator("#investment-name").fill("Solar Learning Pool");
  await page.locator("#investment-description").fill("Beginner education about solar energy and small contributions.");
  await page.locator("#deploy-contract").click();
  await waitUntil(async()=>await page.locator("#result-title").textContent()==="Investment published");
  const firstUrl = await page.locator("#open-investment").getAttribute("href");
  const firstProject = await (await fetch(origin+"/api/investments/"+firstUrl.split("/").at(-1))).json();
  assert.equal(firstProject.creator,await signer.getAddress());
  assert.notEqual(firstProject.contractAddress, await contract.getAddress());
  mark("Browser creates and registers a named independent investment through wallet deployment and signature");
  await page.locator("#create-another").click();
  await page.locator("#connect-button").click();
  await page.locator("#authorize-accounts").click();
  await waitUntil(()=>page.locator("#connect-button").isEnabled());
  await page.locator("#connect-button").click();
  await page.locator('.wallet-account[data-account="'+await other.getAddress()+'"]').click();
  await page.locator("#investment-name").fill("Community Solar Pool");
  await page.locator("#investment-description").fill("Community education about clean energy.");
  await page.evaluate(()=>window.rejectNextRegistration=true);
  await page.locator("#deploy-contract").click();
  await waitUntil(async()=>(await page.locator("#deploy-status").textContent()).includes("declined"));
  const confirmedHash = await page.locator("#deploy-tx").textContent();
  assert.equal(await page.locator("#deploy-contract").isDisabled(),true);
  await page.reload();
  await page.locator("#deploy-result").waitFor({state:"visible"});
  assert.equal(await page.locator("#deploy-tx").textContent(),confirmedHash);
  await page.locator("#connect-button").click();
  await waitUntil(()=>page.locator("#register-investment").isEnabled());
  await page.locator("#register-investment").click();
  await waitUntil(async()=>await page.locator("#result-title").textContent()==="Investment published");
  const secondUrl = await page.locator("#open-investment").getAttribute("href");
  const secondProject = await (await fetch(origin+"/api/investments/"+secondUrl.split("/").at(-1))).json();
  assert.equal(secondProject.creator,await other.getAddress());
  assert.equal(secondProject.transactionHash,confirmedHash);
  mark("Second account creates a project; rejected registration survives reload and retries the same contract");
  await page.goto(origin);
  await page.locator("#project-search").fill("solar");
  await page.locator("#search-form button").click();
  await waitUntil(async()=>await page.locator(".project-card").count()===2);
  await page.locator("#connect-button").click();
  await page.locator("#my-investments").check();
  await waitUntil(async()=>await page.locator(".project-card").count()===1);
  assert.match(await page.locator(".project-card h3").textContent(),/Community/);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  mark("Search matches name and description, filters by creator, and fits a mobile viewport");
  await page.screenshot({path:"test-results/explore-mobile.png",fullPage:true});
  const pools = [firstProject,secondProject].map(project=>new Contract(project.contractAddress,artifact.abi,signer));
  for (const [index,url] of [firstUrl,secondUrl].entries()) {
    await page.goto(origin+url);
    await page.locator("#connect-button").click();
    await waitUntil(()=>page.locator("#deposit-button").isEnabled());
    assert.equal((await page.locator("#account-label").textContent()).toLowerCase(),(await signer.getAddress()).toLowerCase());
    await page.locator("#deposit-amount").fill(index===0?"0.005":"0.002");
    await page.locator("#deposit-button").click();
    await waitUntil(async()=>await page.locator("#owned-shares").textContent()===(index===0?"0.005":"0.002"));
    assert.equal(await page.locator("#history-body tr").count(),1);
    assert.match(await page.locator("#view-all-activity").getAttribute("href"),new RegExp(url+"/activity"));
  }
  assert.equal(await pools[0].shares(await signer.getAddress()),5000000000000000n);
  assert.equal(await pools[1].shares(await signer.getAddress()),2000000000000000n);
  assert.equal(await contract.shares(await signer.getAddress()),0n);
  await page.goto(origin+firstUrl);
  await page.locator("#connect-button").click();
  await waitUntil(()=>page.locator("#deposit-button").isEnabled());
  await page.locator("#withdraw-tab").click();
  await page.locator("#withdraw-all-button").click();
  await waitUntil(async()=>await page.locator("#owned-shares").textContent()==="0");
  assert.equal(await pools[1].shares(await signer.getAddress()),2000000000000000n);
  mark("Projects isolate balances, writes and event history; a participant can invest in another creator's pool");
  server.kill(); await new Promise(resolve=>server.once("exit",resolve));
  server = launch(python,["app.py"],environment); await waitForServer(origin+"/healthz",server);
  const persisted = (await (await fetch(origin+"/api/investments?q=solar")).json()).items;
  assert.equal(persisted.length,2);
  assert.ok(persisted.some(item=>item.id===firstProject.id));
  assert.ok(persisted.some(item=>item.id===secondProject.id));
  mark("Project names, IDs and contract addresses persist across a Flask restart");
  await page.goto(overview);
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
} catch (error) {
  if (browser) {
    const current = browser.contexts()[0]?.pages()[0];
    if (current) {
      console.error("Browser failure context:", JSON.stringify({url:current.url(), status:await current.locator("#deploy-status").textContent().catch(()=>null), message:await current.locator("#page-message").textContent().catch(()=>null)}));
      await current.screenshot({path:"test-results/browser-failure.png",fullPage:true}).catch(()=>{});
    }
  }
  throw error;
} finally {
  if(browser) await browser.close();
  for(const child of children) if(child.exitCode===null) child.kill();
}
