"""Read-only Ethereum queries. Wallets sign writes; this service holds no keys."""
import json
import re
from dataclasses import dataclass, replace
from pathlib import Path

from web3 import Web3
from web3.exceptions import TransactionNotFound
from web3._utils.events import get_event_data

ROOT = Path(__file__).resolve().parents[1]


class ApiError(Exception):
    def __init__(self, code, message, status=400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def address(value):
    if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", value):
        raise ApiError("invalid_address", "Enter a valid Ethereum wallet address.")
    return Web3.to_checksum_address(value)


def tx_hash(value):
    if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{64}", value):
        raise ApiError("invalid_hash", "Enter a valid transaction hash.")
    return value


def units(value):
    """Exact decimal formatting, without a floating-point conversion."""
    whole, fraction = divmod(int(value), 10**18)
    return str(whole) + ("." + f"{fraction:018d}".rstrip("0") if fraction else "")


@dataclass
class Settings:
    chain_id: int
    rpc_url: str
    contract_address: str
    deployment_block: int | None
    timeout: int = 10
    chunk: int = 1000
    page_blocks: int = 5000


class ChainService:
    def __init__(self, settings, artifact, provider=None):
        self.settings = settings
        self.artifact = artifact
        self.w3 = Web3(provider or Web3.HTTPProvider(
            settings.rpc_url, request_kwargs={"timeout": settings.timeout}
        ))
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(settings.contract_address) if settings.contract_address else None,
            abi=artifact["abi"],
        )
        self.event_abis = {
            Web3.to_hex(Web3.keccak(text=f"{item['name']}(address,uint256,uint256)")): item
            for item in artifact["abi"] if item["type"] == "event"
        }

    def for_pool(self, contract_address, deployment_block):
        if (contract_address.lower() == self.settings.contract_address.lower()
                and deployment_block == self.settings.deployment_block):
            return self
        return ChainService(replace(self.settings, contract_address=address(contract_address),
                                   deployment_block=deployment_block), self.artifact, self.w3.provider)

    def deployment(self, value):
        value = tx_hash(value)
        if not self.settings.rpc_url:
            raise ApiError("setup_required", "Configure the server RPC URL before creating an investment.", 503)
        if self.w3.eth.chain_id != self.settings.chain_id:
            raise ApiError("wrong_rpc_network", "The server RPC network does not match the configured network.", 503)
        try:
            transaction = self.w3.eth.get_transaction(value)
            receipt = self.w3.eth.get_transaction_receipt(value)
        except TransactionNotFound:
            raise ApiError("deployment_pending", "The deployment is not confirmed yet. Retry registration with this hash.", 409) from None
        if transaction["to"] or receipt["status"] != 1 or not receipt.get("contractAddress"):
            raise ApiError("invalid_deployment", "Supply a successful direct MicroInvest deployment transaction.")
        payload = transaction.get("input", transaction.get("data", b""))
        payload = payload if isinstance(payload, str) else Web3.to_hex(payload)
        deployed = address(receipt["contractAddress"])
        if (payload.lower() != self.artifact["bytecode"].lower()
                or Web3.to_hex(self.w3.eth.get_code(deployed)).lower() != self.artifact["deployedBytecode"].lower()):
            raise ApiError("wrong_contract", "This deployment does not match the supported MicroInvest contract.")
        return {"address": deployed, "deploymentBlock": receipt["blockNumber"],
                "deployer": address(transaction["from"]), "transactionHash": value.lower()}

    def check(self):
        if not self.settings.rpc_url or not self.settings.contract_address or self.settings.deployment_block is None:
            raise ApiError("setup_required", "Deploy the contract and configure its address, deployment block and RPC URL.", 503)
        if self.w3.eth.chain_id != self.settings.chain_id:
            raise ApiError("wrong_rpc_network", "The server RPC network does not match the configured network.", 503)
        code = self.w3.eth.get_code(self.contract.address)
        if Web3.to_hex(code).lower() != self.artifact["deployedBytecode"].lower():
            raise ApiError("wrong_contract", "The configured address does not contain the expected MicroInvest contract.", 503)

    def pool(self):
        self.check()
        block = self.w3.eth.block_number
        total = self.contract.functions.totalShares().call(block_identifier=block)
        actual = self.w3.eth.get_balance(self.contract.address, block_identifier=block)
        return {
            "blockNumber": block, "totalSharesUnits": str(total), "totalShares": units(total),
            "principalWei": str(total), "principalEth": units(total),
            "contractBalanceWei": str(actual), "excessWei": str(max(0, actual - total)),
            "solvent": actual >= total,
        }

    def position(self, wallet):
        wallet = address(wallet)
        self.check()
        block = self.w3.eth.block_number
        owned = self.contract.functions.shares(wallet).call(block_identifier=block)
        balance = self.w3.eth.get_balance(wallet, block_identifier=block)
        return {
            "address": wallet, "blockNumber": block,
            "sharesUnits": str(owned), "shares": units(owned),
            "redeemableWei": str(owned), "redeemableEth": units(owned),
            "walletBalanceWei": str(balance), "walletBalanceEth": units(balance),
        }

    def history(self, wallet, cursor=None, limit=20):
        wallet = address(wallet)
        if not 1 <= limit <= 50:
            raise ApiError("invalid_limit", "History limit must be between 1 and 50.")
        before = None
        if cursor:
            if not re.fullmatch(r"[0-9]{1,12}:[0-9]{1,12}", cursor):
                raise ApiError("invalid_cursor", "The history cursor is invalid.")
            before = tuple(map(int, cursor.split(":")))
        self.check()
        latest = self.w3.eth.block_number
        end = min(latest, before[0]) if before else latest
        deployment = self.settings.deployment_block
        if end < deployment:
            return {"items": [], "nextCursor": None, "latestBlock": latest,
                    "scannedFrom": deployment, "scannedTo": end}
        start = max(deployment, end - self.settings.page_blocks + 1)
        logs = []
        investor_topic = "0x" + wallet[2:].lower().rjust(64, "0")
        for first in range(start, end + 1, self.settings.chunk):
            logs.extend(self.w3.eth.get_logs({
                "address": self.contract.address,
                "fromBlock": first, "toBlock": min(end, first + self.settings.chunk - 1),
                "topics": [list(self.event_abis), investor_topic],
            }))
        logs.sort(key=lambda log: (log["blockNumber"], log["logIndex"]), reverse=True)
        if before:
            logs = [log for log in logs if (log["blockNumber"], log["logIndex"]) < before]
        chosen = logs[:limit]
        blocks = {}
        items = []
        for log in chosen:
            event = get_event_data(self.w3.codec, self.event_abis[Web3.to_hex(log["topics"][0])], log)
            number = log["blockNumber"]
            if number not in blocks:
                blocks[number] = self.w3.eth.get_block(number)["timestamp"]
            items.append({
                "type": "deposit" if event["event"] == "Deposited" else "withdrawal",
                "amountWei": str(event["args"]["amountWei"]), "amountEth": units(event["args"]["amountWei"]),
                "sharesAfter": units(event["args"]["sharesAfter"]),
                "transactionHash": Web3.to_hex(log["transactionHash"]),
                "blockNumber": number, "logIndex": log["logIndex"], "timestamp": blocks[number],
                "confirmations": latest - number + 1,
            })
        if len(logs) > limit:
            last = chosen[-1]
            next_cursor = f"{last['blockNumber']}:{last['logIndex']}"
        else:
            next_cursor = f"{start}:0" if start > deployment else None
        return {
            "items": items, "nextCursor": next_cursor, "latestBlock": latest,
            "scannedFrom": start, "scannedTo": end,
        }

    def transaction(self, value):
        value = tx_hash(value)
        self.check()
        try:
            transaction = self.w3.eth.get_transaction(value)
        except TransactionNotFound:
            return {"hash": value, "status": "not_found", "message": "Not visible to this RPC yet. Try again."}
        if not transaction["to"] or transaction["to"].lower() != self.contract.address.lower():
            raise ApiError("unrelated_transaction", "This transaction does not target the configured MicroInvest pool.")
        try:
            receipt = self.w3.eth.get_transaction_receipt(value)
        except TransactionNotFound:
            return {"hash": value, "status": "pending", "from": transaction["from"]}
        latest = self.w3.eth.block_number
        status = "success" if receipt["status"] == 1 else "failed"
        return {
            "hash": value, "status": status, "blockNumber": receipt["blockNumber"],
            "confirmations": max(0, latest - receipt["blockNumber"] + 1),
            "gasUsed": str(receipt["gasUsed"]),
            "gasCostWei": str(receipt["gasUsed"] * receipt["effectiveGasPrice"]),
            "from": transaction["from"],
        }
