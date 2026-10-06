import { readFile, writeFile, mkdir } from "node:fs/promises";
const artifact = JSON.parse(await readFile("artifacts/contracts/MicroInvest.sol/MicroInvest.json", "utf8"));
await mkdir("contract", { recursive: true });
await writeFile("contract/MicroInvest.json", JSON.stringify({
  contractName: artifact.contractName, abi: artifact.abi, bytecode: artifact.bytecode,
  deployedBytecode: artifact.deployedBytecode, compiler: "0.8.30",
}, null, 2) + "\n");
console.log("Exported contract/MicroInvest.json for Flask and wallet deployment.");
