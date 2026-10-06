import { shortAddress } from "./numbers.js";

export function renderActivityRows(body, items, explorerUrl) {
  body.replaceChildren();
  for (const item of items) {
    const row = document.createElement("tr");
    const values = [item.type === "deposit" ? "↗ Deposit" : "↙ Redemption", item.amountEth + " ETH",
      new Date(item.timestamp * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })];
    for (const value of values) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
    row.firstElementChild.className = "action";
    const statusCell = document.createElement("td");
    const badge = document.createElement("span"); badge.className = "status-pill"; badge.textContent = "Confirmed";
    statusCell.append(badge); row.append(statusCell);
    const hashCell = document.createElement("td");
    const link = document.createElement("a"); link.textContent = shortAddress(item.transactionHash);
    if (explorerUrl) { link.href = explorerUrl + "/tx/" + item.transactionHash; link.target = "_blank"; link.rel = "noopener noreferrer"; }
    else link.title = item.transactionHash;
    hashCell.append(link); row.append(hashCell); body.append(row);
  }
}
