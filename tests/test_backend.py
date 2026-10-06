import json
from unittest.mock import MagicMock

import pytest
from eth_abi import encode
from hexbytes import HexBytes
from web3 import Web3
from web3.exceptions import TransactionNotFound

from app import create_app
from microinvest.chain import ApiError, ChainService, Settings, ROOT, address, units

ADDRESS = "0x" + "11" * 20
WALLET = "0x" + "22" * 20
HASH = "0x" + "ab" * 32
ARTIFACT = json.loads((ROOT / "contract/MicroInvest.json").read_text())


@pytest.fixture
def service():
    result = ChainService(Settings(31337, "http://localhost:8545", ADDRESS, 10, page_blocks=3), ARTIFACT)
    result.w3 = MagicMock()
    result.w3.codec = Web3().codec
    result.w3.eth.chain_id = 31337
    result.w3.eth.block_number = 10
    result.w3.eth.get_code.return_value = HexBytes(ARTIFACT["deployedBytecode"])
    return result


@pytest.fixture
def client(service):
    app = create_app({
        "TESTING": True, "CHAIN_ID": 31337, "LOCAL_DEVELOPMENT": True,
        "RPC_URL": "https://example.invalid/api/private-secret",
        "CONTRACT_ADDRESS": ADDRESS, "DEPLOYMENT_BLOCK": 10,
    }, service)
    return app.test_client()


def test_configuration_never_exposes_rpc_keys(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json["configured"]
    assert "private-secret" not in response.text
    assert "RPC_URL" not in response.text


def test_setup_without_config_is_explicit():
    app = create_app({"TESTING": True, "RPC_URL": "", "CONTRACT_ADDRESS": "",
                      "DEPLOYMENT_BLOCK": "", "CHAIN_ID": 11155111, "LOCAL_DEVELOPMENT": False})
    client = app.test_client()
    assert client.get("/healthz").status_code == 200
    assert not client.get("/api/config").json["configured"]
    assert client.get("/api/pool").status_code == 503
    assert client.get("/").status_code == 200
    assert client.get("/activity").status_code == 200
    assert client.get("/deploy").status_code == 200


@pytest.mark.parametrize("value", ["x", "0x123", "<script>", "1" * 40])
def test_bad_wallet_addresses_do_not_query_rpc(client, service, value):
    response = client.get("/api/position/" + value)
    assert response.status_code == 400
    service.w3.eth.get_code.assert_not_called()


@pytest.mark.parametrize("value", ["no", "0x12"])
def test_bad_transaction_hashes(client, value):
    assert client.get("/api/transactions/" + value).status_code == 400


def test_invalid_history_pagination(client):
    assert client.get("/api/history/" + WALLET + "?limit=abc").status_code == 400
    assert client.get("/api/history/" + WALLET + "?limit=0").status_code == 400
    assert client.get("/api/history/" + WALLET + "?limit=51").status_code == 400
    assert client.get("/api/history/" + WALLET + "?cursor=-1").status_code == 400


def test_upstream_error_is_sanitized_and_not_a_zero_position(client, service):
    service.w3.eth.get_code.side_effect = RuntimeError("API key: private-secret")
    response = client.get("/api/position/" + WALLET)
    assert response.status_code == 503
    assert response.json["error"]["code"] == "rpc_unavailable"
    assert "private-secret" not in response.text
    assert "shares" not in response.json


def test_wrong_network_and_wrong_contract_are_rejected(service):
    service.w3.eth.chain_id = 1
    with pytest.raises(ApiError, match="RPC network"):
        service.check()
    service.w3.eth.chain_id = 31337
    service.w3.eth.get_code.return_value = HexBytes("0x1234")
    with pytest.raises(ApiError, match="expected MicroInvest"):
        service.check()


def test_production_cannot_use_mainnet_or_accidentally_use_local_chain():
    with pytest.raises(ValueError, match="Sepolia"):
        create_app({"CHAIN_ID": 1})
    with pytest.raises(ValueError, match="Sepolia"):
        create_app({"CHAIN_ID": 31337, "LOCAL_DEVELOPMENT": False})


def test_unknown_pending_failed_and_success_receipts(service):
    service.w3.eth.get_transaction.side_effect = TransactionNotFound("Not found")
    assert service.transaction(HASH)["status"] == "not_found"
    service.w3.eth.get_transaction.side_effect = None
    service.w3.eth.get_transaction.return_value = {"to": ADDRESS, "from": WALLET}
    service.w3.eth.get_transaction_receipt.side_effect = TransactionNotFound("Pending")
    assert service.transaction(HASH)["status"] == "pending"
    service.w3.eth.get_transaction_receipt.side_effect = None
    receipt = {"status": 0, "blockNumber": 10, "gasUsed": 21000, "effectiveGasPrice": 100}
    service.w3.eth.get_transaction_receipt.return_value = receipt
    assert service.transaction(HASH)["status"] == "failed"
    receipt["status"] = 1
    assert service.transaction(HASH)["gasCostWei"] == "2100000"
    assert service.transaction(HASH)["status"] == "success"
    service.w3.eth.get_transaction.return_value = {"to": WALLET}
    with pytest.raises(ApiError, match="does not target"):
        service.transaction(HASH)


def event_log(index, block=10):
    return {
        "address": Web3.to_checksum_address(ADDRESS),
        "topics": [Web3.keccak(text="Deposited(address,uint256,uint256)"), HexBytes("0x" + WALLET[2:].rjust(64, "0"))],
        "data": HexBytes(encode(["uint256", "uint256"], [index + 1, index + 1])),
        "blockNumber": block, "logIndex": index, "transactionIndex": index,
        "transactionHash": HexBytes("0x" + f"{index:064x}"), "blockHash": HexBytes("0x" + "ff" * 32),
    }


def test_history_cursor_never_skips_same_block_events(service):
    service.w3.eth.get_logs.return_value = [event_log(i) for i in range(5)]
    service.w3.eth.get_block.return_value = {"timestamp": 1700000000}
    first = service.history(WALLET, limit=2)
    second = service.history(WALLET, cursor=first["nextCursor"], limit=2)
    third = service.history(WALLET, cursor=second["nextCursor"], limit=2)
    assert [x["logIndex"] for page in [first, second, third] for x in page["items"]] == [4, 3, 2, 1, 0]
    assert third["nextCursor"] is None
    assert first["items"][0]["amountWei"] == "5"
    assert first["items"][0]["amountEth"] == "0.000000000000000005"


def test_empty_recent_range_keeps_an_older_range_cursor(service):
    service.w3.eth.block_number = 30
    service.w3.eth.get_logs.return_value = []
    result = service.history(WALLET)
    assert result["items"] == []
    assert result["nextCursor"] == "28:0"
    assert result["scannedFrom"] == 28


def test_exact_decimal_formatting():
    assert units(1) == "0.000000000000000001"
    assert units(10**18) == "1"
    assert units(12345000000000000001) == "12.345000000000000001"


def test_security_headers_and_read_only_apis(client):
    result = client.get("/")
    assert "frame-ancestors 'none'" in result.headers["Content-Security-Policy"]
    assert result.headers["X-Content-Type-Options"] == "nosniff"
    assert client.post("/api/pool").status_code == 405
    assert client.get("/api/config").headers["Cache-Control"] == "no-store"
