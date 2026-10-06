import { network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";

const { ethers } = await network.create();
const chainId = Number((await ethers.provider.getNetwork()).chainId);
if (![31337, 11155111].includes(chainId)) throw new Error("Only localhost and Sepolia are supported.");
const [signer] = await ethers.getSigners();
if (!signer) throw new Error("No deployment signer. Use the wallet deployment page, or set DEPLOYER_PRIVATE_KEY locally.");
const pool = await ethers.deployContract("MicroInvest");
await pool.waitForDeployment();
const receipt = await pool.deploymentTransaction()!.wait();
if (!receipt || receipt.status !== 1) throw new Error("Deployment did not succeed.");
const name = chainId === 11155111 ? "sepolia" : "localhost";
const record = {
  name, chainId, address: await pool.getAddress(), deploymentBlock: receipt.blockNumber,
  transactionHash: receipt.hash, deployer: signer.address, compiler: "0.8.30",
};
await mkdir("deployments", { recursive: true });
await writeFile("deployments/" + name + ".json", JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify(record, null, 2));
console.log("Set CONTRACT_ADDRESS and DEPLOYMENT_BLOCK in Flask/Render environment.");
