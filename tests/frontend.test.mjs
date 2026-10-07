import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAmount, formatAmount, walletError } from "../static/numbers.js";
import { latestActivity } from "../static/latest-activity.js";
describe("Exact user amounts", () => {
  it("preserves 1 wei and arbitrary valid fractional amounts", () => {
    assert.equal(parseAmount("0.000000000000000001"), 1n);
    assert.equal(parseAmount(".001"), 10n ** 15n);
    assert.equal(parseAmount(" 1.125 "), 1125000000000000000n);
    assert.equal(parseAmount("1000000"), 10n ** 24n);
  });
  it("rejects zero, negative, exponential, nonnumeric and over-precision inputs", () => {
    for (const input of ["", "0", "0.000", "-1", "1e-3", "NaN", "Infinity", "1,000", "1.0000000000000000001", "<script>"]) {
      assert.throws(() => parseAmount(input), input);
    }
  });
  it("round trips amounts beyond JavaScript's safe integer range", () => {
    for (const input of ["12345.000000000000000001", "0.000000000000000001", "99999.125"]) {
      assert.equal(formatAmount(parseAmount(input)), input);
    }
  });
  it("never exposes raw wallet errors and distinguishes declined and insufficient-funds requests", () => {
    assert.match(walletError({ code: 4001 }), /declined/);
    assert.match(walletError({ code: "INSUFFICIENT_FUNDS" }), /gas/);
    assert.doesNotMatch(walletError({ message: "https://private.example/secret" }), /secret/);
  });
});

describe("Latest confirmed activity across older ranges", () => {
  it("continues through empty ranges and fills the five newest records", async () => {
    const pages = [{ items: [], nextCursor: "90:0" }, { items: [5, 4], nextCursor: "80:0" }, { items: [3, 2, 1], nextCursor: "70:0" }];
    const calls = [];
    const result = await latestActivity(async (cursor, limit) => { calls.push([cursor, limit]); return pages.shift(); }, 5);
    assert.deepEqual(result.items, [5, 4, 3, 2, 1]);
    assert.deepEqual(calls, [[null, 5], ["90:0", 5], ["80:0", 3]]);
  });
  it("ends with fewer than five only after the complete range is exhausted", async () => {
    const pages = [{ items: [], nextCursor: "10:0" }, { items: [2, 1], nextCursor: null }];
    assert.deepEqual(await latestActivity(async () => pages.shift(), 5), { items: [2, 1], nextCursor: null });
  });
  it("discards responses after the selected wallet changes", async () => {
    let current = true;
    let rendered = false;
    const result = await latestActivity(async () => { current = false; return { items: [1], nextCursor: "10:0" }; }, 5,
      { isCurrent: () => current, onPage: () => { rendered = true; } });
    assert.equal(result, null); assert.equal(rendered, false);
  });
  it("does not treat a failed older query as an empty completed history", async () => {
    let calls = 0;
    await assert.rejects(latestActivity(async () => {
      if (calls++) throw new Error("RPC unavailable");
      return { items: [1], nextCursor: "10:0" };
    }, 5), /RPC unavailable/);
  });
  it("stops a non-advancing cursor instead of retrying forever", async () => {
    await assert.rejects(latestActivity(async () => ({ items: [], nextCursor: "10:0" }), 5), /did not advance/);
  });
});
