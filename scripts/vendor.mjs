import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const ethersRoot = dirname(dirname(require.resolve("ethers")));
await mkdir("static/vendor", { recursive: true });
await copyFile(join(ethersRoot, "dist/ethers.umd.min.js"), "static/vendor/ethers.umd.min.js");
await copyFile(join(ethersRoot, "LICENSE.md"), "static/vendor/ethers.LICENSE.md");
console.log("Vendored ethers.js locally. Render needs Python only.");
