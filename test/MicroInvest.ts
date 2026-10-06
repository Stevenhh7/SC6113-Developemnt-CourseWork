import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import { network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";

const gas: Record<string, string> = {};
async function setup() {
  const { ethers } = await network.create();
  const [alice, bob] = await ethers.getSigners();
  const pool = await ethers.deployContract("MicroInvest");
  await pool.waitForDeployment();
  return { ethers, alice, bob, pool };
}
describe("MicroInvest funds and authorization", () => {
  it("accepts 1 wei with exact fractional shares and emits the investor event", async () => {
    const { pool, alice } = await setup();
    const receipt = await (await pool.deposit({ value: 1n })).wait();
    assert.equal(await pool.shares(alice.address), 1n);
    assert.equal(await pool.totalShares(), 1n);
    const event = pool.interface.parseLog(receipt!.logs[0]);
    assert.equal(event!.name, "Deposited");
    assert.equal(event!.args.investor, alice.address);
    assert.equal(event!.args.amountWei, 1n);
  });
  it("supports repeated deposits and independent investors", async () => {
    const { pool, alice, bob, ethers } = await setup();
    const receipt = await (await pool.deposit({ value: ethers.parseEther("0.01") })).wait();
    gas.deposit = receipt!.gasUsed.toString();
    await (await pool.deposit({ value: 7n })).wait();
    await (await pool.connect(bob).deposit({ value: 11n })).wait();
    assert.equal(await pool.shares(alice.address), ethers.parseEther("0.01") + 7n);
    assert.equal(await pool.shares(bob.address), 11n);
    assert.equal(await pool.totalShares(), ethers.parseEther("0.01") + 18n);
  });
  it("rejects zero deposits and zero withdrawals", async () => {
    const { pool } = await setup();
    await assert.rejects(pool.deposit({ value: 0n }), /ZeroAmount/);
    await assert.rejects(pool.withdraw(0n), /ZeroAmount/);
    await assert.rejects(pool.withdrawAll(), /ZeroAmount/);
  });
  it("redeems a fraction without charging a platform fee", async () => {
    const { pool, ethers, alice } = await setup();
    await (await pool.deposit({ value: 1000n })).wait();
    const before = await ethers.provider.getBalance(alice.address);
    const receipt = await (await pool.withdraw(333n)).wait();
    const afterBalance = await ethers.provider.getBalance(alice.address);
    assert.equal(afterBalance + receipt!.fee - before, 333n);
    assert.equal(await pool.shares(alice.address), 667n);
    assert.equal(await pool.totalShares(), 667n);
    gas.partialWithdrawal = receipt!.gasUsed.toString();
  });
  it("redeems all and permits a new deposit after exit", async () => {
    const { pool, alice } = await setup();
    await (await pool.deposit({ value: 999n })).wait();
    const receipt = await (await pool.withdrawAll()).wait();
    gas.fullWithdrawal = receipt!.gasUsed.toString();
    assert.equal(await pool.shares(alice.address), 0n);
    assert.equal(await pool.totalShares(), 0n);
    assert.equal(pool.interface.parseLog(receipt!.logs[0])!.name, "Withdrawn");
    await assert.rejects(pool.withdrawAll(), /ZeroAmount/);
    await (await pool.deposit({ value: 2n })).wait();
    assert.equal(await pool.shares(alice.address), 2n);
  });
  it("prevents another investor and the deployer from spending others' shares", async () => {
    const { pool, alice, bob } = await setup();
    await (await pool.connect(bob).deposit({ value: 100n })).wait();
    await assert.rejects(pool.withdraw(1n), /InsufficientShares/);
    assert.equal(await pool.shares(bob.address), 100n);
    assert.equal(await pool.shares(alice.address), 0n);
  });
  it("rejects excess withdrawals without changing balances", async () => {
    const { pool, alice } = await setup();
    await (await pool.deposit({ value: 10n })).wait();
    await assert.rejects(pool.withdraw(11n), /InsufficientShares/);
    assert.equal(await pool.shares(alice.address), 10n);
    assert.equal(await pool.totalShares(), 10n);
  });
  it("rolls back bookkeeping if the recipient rejects ETH", async () => {
    const { pool, ethers } = await setup();
    const rejector = await ethers.deployContract("RejectingReceiver", [await pool.getAddress()]);
    await (await rejector.fund({ value: 100n })).wait();
    await assert.rejects(rejector.redeem(), /TransferFailed/);
    assert.equal(await pool.shares(await rejector.getAddress()), 100n);
    assert.equal(await pool.totalShares(), 100n);
  });
  it("blocks nested withdrawals while allowing a normal withdrawal", async () => {
    const { pool, ethers } = await setup();
    await (await pool.deposit({ value: 200n })).wait();
    const attacker = await ethers.deployContract("ReentrantReceiver", [await pool.getAddress()]);
    await (await attacker.fund({ value: 100n })).wait();
    await (await attacker.redeem()).wait();
    assert.equal(await attacker.nestedSucceeded(), false);
    assert.equal(await pool.shares(await attacker.getAddress()), 0n);
    assert.equal(await ethers.provider.getBalance(await attacker.getAddress()), 100n);
    assert.equal(await pool.totalShares(), 200n);
  });
  it("does not credit forced ETH as shares or yield", async () => {
    const { pool, ethers, alice } = await setup();
    await (await pool.deposit({ value: 10n })).wait();
    await ethers.deployContract("ForcedEther", [await pool.getAddress()], { value: 20n });
    assert.equal(await pool.totalShares(), 10n);
    await (await pool.withdrawAll()).wait();
    assert.equal(await pool.shares(alice.address), 0n);
    assert.equal(await ethers.provider.getBalance(await pool.getAddress()), 20n);
  });
  it("has no owner, transfer, upgrade, or pause entry points and rejects plain transfers", async () => {
    const { pool, alice } = await setup();
    for (const name of ["owner", "transfer", "transferFrom", "pause", "upgradeTo"]) {
      assert.equal(pool.interface.hasFunction(name), false);
    }
    await assert.rejects(alice.sendTransaction({ to: await pool.getAddress(), value: 1n }));
  });
  it("preserves solvency through a deterministic sequence of multi-user operations", async () => {
    const { pool, ethers, alice, bob } = await setup();
    const signers = [alice, bob];
    const expected = [0n, 0n];
    for (let i = 0; i < 40; i++) {
      const index = i % 2;
      const amount = BigInt(i + 1);
      if (i % 3 === 0 && expected[index] > 0n) {
        const redeemed = expected[index] / 2n || 1n;
        await (await pool.connect(signers[index]).withdraw(redeemed)).wait();
        expected[index] -= redeemed;
      } else {
        await (await pool.connect(signers[index]).deposit({ value: amount })).wait();
        expected[index] += amount;
      }
      assert.equal(await pool.shares(signers[index].address), expected[index]);
      assert.equal(await pool.totalShares(), expected[0] + expected[1]);
      assert.equal(await ethers.provider.getBalance(await pool.getAddress()), expected[0] + expected[1]);
    }
  });
});
after(async () => {
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/contract-gas.json", JSON.stringify({ environment: "Hardhat local", compiler: "0.8.30", gas }, null, 2));
});
