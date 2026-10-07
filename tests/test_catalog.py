import json
from unittest.mock import MagicMock

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from hexbytes import HexBytes
from sqlalchemy.exc import OperationalError
from web3 import Web3
from web3.exceptions import TransactionNotFound

from app import create_app
from microinvest.catalog import Catalog, registration_message
from microinvest.chain import ApiError, ChainService, Settings, ROOT

ARTIFACT = json.loads((ROOT / "contract/MicroInvest.json").read_text())
LEGACY = "0x" + "11" * 20
POOL = "0x" + "33" * 20
HASH = "0x" + "aa" * 32
# Ephemeral local test identity; never a participant's signing key.
OWNER = Account.create()
OTHER = Account.create()
DATA = {"name": "Green Energy Pool", "description": "Education about solar energy and small contributions.", "transactionHash": HASH}


@pytest.fixture
def setup():
    chain = ChainService(Settings(31337, "http://localhost:8545", LEGACY, 10), ARTIFACT)
    chain.w3 = MagicMock()
    chain.w3.eth.chain_id = 31337
    chain.w3.eth.get_code.return_value = HexBytes(ARTIFACT["deployedBytecode"])
    chain.w3.eth.get_transaction.return_value = {"to": None, "from": OWNER.address, "input": HexBytes(ARTIFACT["bytecode"])}
    chain.w3.eth.get_transaction_receipt.return_value = {"status": 1, "contractAddress": POOL, "blockNumber": 20}
    app = create_app({"TESTING": True, "CHAIN_ID": 31337, "LOCAL_DEVELOPMENT": True,
                      "RPC_URL": "http://localhost:8545", "CONTRACT_ADDRESS": LEGACY, "DEPLOYMENT_BLOCK": 10}, chain)
    return app, app.test_client(), chain


def signed(data=DATA, owner=OWNER, origin="http://localhost", chain_id=31337):
    signature = owner.sign_message(encode_defunct(text=registration_message(data, chain_id, origin))).signature.hex()
    return {**data, "signature": "0x" + signature.removeprefix("0x")}


def test_signed_registration_is_idempotent_and_has_a_detail_page(setup):
    app, client, chain = setup
    message = client.post("/api/investments/registration-message", json=DATA).json["message"]
    assert message == registration_message(DATA, 31337, "http://localhost")
    registered = client.post("/api/investments", json=signed())
    assert registered.status_code == 200
    project = registered.json
    assert project["creator"] == OWNER.address and project["contractAddress"].lower() == POOL.lower()
    assert client.post("/api/investments", json=signed()).json["id"] == project["id"]
    assert client.get(project["url"]).status_code == 200
    assert client.get(project["url"] + "/activity").status_code == 200
    assert client.get("/api/config?investment=" + str(project["id"])).json["contractAddress"] == project["contractAddress"]
    assert len(client.get("/api/investments?q=solar").json["items"]) == 1
    assert client.get("/api/investments?creator=" + OWNER.address).json["items"][0]["id"] == project["id"]
    assert client.get("/api/investments?creator=" + OTHER.address).json["total"] == 0


@pytest.mark.parametrize("change", ["name", "description", "transactionHash"])
def test_signed_metadata_cannot_be_changed(setup, change):
    _, client, _ = setup
    data = signed()
    data[change] = "Tampered name" if change != "transactionHash" else "0x" + "bb" * 32
    response = client.post("/api/investments", json=data)
    assert response.status_code == 403
    assert client.get("/api/investments?q=energy").json["total"] == 0


def test_only_the_deployer_can_register_and_signature_is_origin_and_network_bound(setup):
    _, client, _ = setup
    for data in (signed(owner=OTHER), signed(origin="https://other.example"), signed(chain_id=11155111)):
        assert client.post("/api/investments", json=data).status_code == 403
    assert client.post("/api/investments", json={**DATA, "signature": "bad"}).status_code == 400
    assert client.post("/api/investments", json={**DATA, "signature": "0x" + "00" * 65}).status_code == 400
    assert client.post("/api/investments", json=DATA).status_code == 400


@pytest.mark.parametrize("case", ["pending", "reverted", "ordinary_transfer", "wrong_input", "wrong_runtime", "wrong_network"])
def test_only_confirmed_supported_deployments_are_registered(setup, case):
    _, client, chain = setup
    if case == "pending":
        chain.w3.eth.get_transaction_receipt.side_effect = TransactionNotFound("pending")
    elif case == "reverted":
        chain.w3.eth.get_transaction_receipt.return_value["status"] = 0
    elif case == "ordinary_transfer":
        chain.w3.eth.get_transaction.return_value["to"] = LEGACY
    elif case == "wrong_input":
        chain.w3.eth.get_transaction.return_value["input"] = HexBytes("0x1234")
    elif case == "wrong_runtime":
        chain.w3.eth.get_code.return_value = HexBytes("0x1234")
    elif case == "wrong_network":
        chain.w3.eth.chain_id = 1
    assert client.post("/api/investments", json=signed()).status_code in (400, 409, 503)
    assert client.get("/api/investments?q=energy").json["total"] == 0


def test_duplicate_contract_cannot_be_renamed_and_unknown_project_does_not_fall_back(setup):
    _, client, _ = setup
    project = client.post("/api/investments", json=signed()).json
    assert client.post("/api/investments", json=signed({**DATA, "name": "Different"})).status_code == 409
    assert client.get("/api/pool?investment=99999").status_code == 404
    assert client.get("/investments/99999").status_code == 404
    assert client.get("/api/config?investment=xyz").status_code == 400
    assert client.get("/api/config?investment=0").status_code == 400


@pytest.mark.parametrize("data", [None, {}, {**DATA, "name": ""}, {**DATA, "description": ""}, {**DATA, "name": "a" * 121}, {**DATA, "description": "a" * 2001}, {**DATA, "name": "bad\x00text"}])
def test_metadata_validation_runs_before_rpc(setup, data):
    _, client, chain = setup
    assert client.post("/api/investments", json=data).status_code in (400, 415)
    chain.w3.eth.get_transaction.assert_not_called()


def test_catalog_restart_unicode_literals_pagination_and_network_isolation(tmp_path):
    url = "sqlite:///" + (tmp_path / "catalog.sqlite3").as_posix()
    store = Catalog(url)
    for number, name in enumerate(("投资新手", "100% Education", "STRASSE", "Duplicate", "Duplicate"), 1):
        store.add({"name": name, "description": "Beginner keyword solar"},
                  {"address": "0x" + f"{number:040x}", "deploymentBlock": number, "deployer": OWNER.address}, 31337)
    store.engine.dispose()
    restarted = Catalog(url)
    assert restarted.search("投资", 31337)["total"] == 1
    assert restarted.search("%", 31337)["total"] == 1
    assert restarted.search("strasse", 31337)["total"] == 1
    assert restarted.search("duplicate", 31337)["total"] == 2
    assert restarted.search("solar beginner", 31337)["total"] == 5
    assert restarted.search("", 11155111)["total"] == 0
    first, second = restarted.search("", 31337, 1, 3), restarted.search("", 31337, 2, 3)
    assert first["nextPage"] == 2 and second["nextPage"] is None
    assert len({item["id"] for item in first["items"] + second["items"]}) == 5
    assert restarted.search("1", 31337)["items"][0]["id"] == 1


def test_database_failures_do_not_expose_credentials(setup):
    app, client, _ = setup
    app.extensions["catalog"].search = MagicMock(side_effect=OperationalError("private-password", {}, Exception("private-password")))
    response = client.get("/api/investments")
    assert response.status_code == 503 and "private-password" not in response.text


@pytest.mark.parametrize("query", ["page=0", "page=x", "limit=0", "limit=51", "creator=bad", "q=" + "a" * 201])
def test_directory_query_validation(setup, query):
    _, client, _ = setup
    assert client.get("/api/investments?" + query).status_code == 400


@pytest.mark.parametrize("url", ["", "sqlite://", "sqlite:///ephemeral.sqlite3"])
def test_render_requires_postgresql_before_any_database_write(monkeypatch, url):
    monkeypatch.setenv("RENDER", "true")
    with pytest.raises(RuntimeError, match="persistent PostgreSQL"):
        create_app({"DATABASE_URL": url})
