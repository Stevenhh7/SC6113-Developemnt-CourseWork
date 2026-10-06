export const WEI = 10n ** 18n;
const MAX_UINT256 = (1n << 256n) - 1n;

export function parseAmount(value) {
  const input = String(value).trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(input)) {
    throw new Error("Enter a positive ETH amount using digits and a decimal point.");
  }
  const [whole = "", fraction = ""] = input.split(".");
  if (fraction.length > 18) throw new Error("ETH supports at most 18 decimal places.");
  if (whole.length > 78) throw new Error("This amount is outside the supported range.");
  const amount = BigInt(whole || "0") * WEI + BigInt(fraction.padEnd(18, "0") || "0");
  if (amount <= 0n) throw new Error("The amount must be greater than zero.");
  if (amount > MAX_UINT256) throw new Error("This amount is outside the supported range.");
  return amount;
}

export function formatAmount(value) {
  const amount = BigInt(value);
  const fraction = (amount % WEI).toString().padStart(18, "0").replace(/0+$/, "");
  return (amount / WEI).toString() + (fraction ? "." + fraction : "");
}

export function shortAddress(value) {
  return value ? value.slice(0, 6) + "…" + value.slice(-4) : "";
}

export function walletError(error) {
  const code = error?.code ?? error?.info?.error?.code;
  const text = String(error?.shortMessage || error?.message || "");
  if (code === 4001 || code === "ACTION_REJECTED") return "You declined the wallet request. Nothing was submitted.";
  if (code === -32002) return "A wallet request is already open. Check MetaMask.";
  if (code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(text)) return "Your wallet needs enough test ETH for the amount and network gas.";
  if (/InsufficientShares/.test(text)) return "This amount exceeds your current shares. Refresh your position.";
  if (/ZeroAmount/.test(text)) return "The amount must be greater than zero.";
  if (/TransferFailed/.test(text)) return "The receiving wallet rejected the transfer. Your shares were not deducted.";
  if (code === "CALL_EXCEPTION") return "The contract rejected this operation. Refresh your position and check the amount.";
  return "The wallet operation could not be completed. Check your connection and try again.";
}
