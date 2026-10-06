import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAmount, formatAmount, walletError } from "../static/numbers.js";
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
