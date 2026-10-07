import json
from unittest.mock import MagicMock

import pytest
from hexbytes import HexBytes
from sqlalchemy import func, select

from microinvest.catalog import Catalog
from microinvest.chain import ApiError, ChainService, Settings, ROOT
from microinvest.history import HistoryStore

POOL = "0x" + "11" * 20
WALLET = "0x" + "22" * 20
OTHER = "0x" + "33" * 20
ARTIFACT = json.loads((ROOT / "contract/MicroInvest.json").read_text())


def event(block, index=0):
    return {"blockNumber": block, "logIndex": index, "blockHash": "0x" + f"{block:064x}",
            "transactionHash": "0x" + f"{block * 100 + index:064x}", "type": "deposit",
            "amountWei": "1", "sharesAfter": "0.000000000000000001", "timestamp": 1700000000 + block}


def chain_for(events, pool=POOL):
    chain = ChainService(Settings(31337, "http://localhost:8545", pool, 10, page_blocks=3), ARTIFACT)
    chain.w3 = MagicMock()
    chain.w3.eth.chain_id = 31337
    chain.w3.eth.block_number = 20
    chain.w3.eth.get_code.return_value = HexBytes(ARTIFACT["deployedBytecode"])
    chain.w3.eth.get_block.side_effect = lambda block: {"hash": HexBytes("0x" + f"{block:064x}")}
    chain.history_events = MagicMock(side_effect=lambda wallet, start, end, latest:
        [item for item in events.get(wallet.lower(), []) if start <= item["blockNumber"] <= end])
    return chain


def test_empty_ranges_backfill_persist_and_new_blocks_sync_incrementally(tmp_path):
    url = "sqlite:///" + (tmp_path / "history.sqlite3").as_posix()
    catalog = Catalog(url)
    store = HistoryStore(catalog.engine)
    events = {WALLET: [event(16, 4), event(16, 3), event(15), event(14), event(13), event(11)]}
    chain = chain_for(events)
    first = store.history(chain, WALLET, limit=5)
    assert first["items"] == [] and first["nextCursor"] == "18:0"
    second = store.history(chain, WALLET, first["nextCursor"], 5)
    third = store.history(chain, WALLET, second["nextCursor"], 2)
    expected = [item["transactionHash"] for item in events[WALLET][:5]]
    assert [item["transactionHash"] for item in second["items"] + third["items"]] == expected
    calls = chain.history_events.call_count
    catalog.engine.dispose()
    reopened = Catalog(url)
    store = HistoryStore(reopened.engine)
    cached = store.history(chain, WALLET, limit=5)
    assert [item["transactionHash"] for item in cached["items"]] == expected
    assert cached["source"] == "database" and chain.history_events.call_count == calls
    chain.w3.eth.block_number = 21
    events[WALLET].insert(0, event(21))
    newer = store.history(chain, WALLET, limit=5)
    assert newer["items"][0]["blockNumber"] == 21
    assert chain.history_events.call_args.args[1:3] == (21, 21)
    reopened.engine.dispose()


def test_index_keeps_all_same_block_events_and_idempotent_upserts():
    catalog = Catalog("sqlite://")
    store = HistoryStore(catalog.engine)
    chain = chain_for({WALLET: [event(20, index) for index in range(8)]})
    cursor, items = None, []
    for _ in range(4):
        page = store.history(chain, WALLET, cursor, 2)
        items.extend(page["items"])
        cursor = page["nextCursor"]
    assert [item["logIndex"] for item in items] == list(range(7, -1, -1))
    assert chain.history_events.call_count == 1
    values = {"chain_id": 31337, "address": POOL, "wallet": WALLET}
    store.save(values, items, 18, 20, "0x" + f"{20:064x}")
    with catalog.engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(store.events)) == 8


def test_history_is_isolated_by_pool_and_wallet():
    catalog = Catalog("sqlite://")
    store = HistoryStore(catalog.engine)
    first = chain_for({WALLET: [event(20, 1)], OTHER: [event(20, 2)]})
    second = chain_for({WALLET: [event(20, 3)]}, "0x" + "44" * 20)
    assert store.history(first, WALLET)["items"][0]["logIndex"] == 1
    assert store.history(first, OTHER)["items"][0]["logIndex"] == 2
    assert store.history(second, WALLET)["items"][0]["logIndex"] == 3
    assert store.history(first, WALLET)["items"][0]["logIndex"] == 1


def test_changed_canonical_checkpoint_replaces_orphaned_events():
    catalog = Catalog("sqlite://")
    store = HistoryStore(catalog.engine)
    events = {WALLET: [event(20, 1)]}
    chain = chain_for(events)
    original = store.history(chain, WALLET)["items"][0]["transactionHash"]
    chain.w3.eth.get_block.side_effect = lambda block: {"hash": HexBytes("0x" + "ff" * 32)}
    events[WALLET] = [{**event(20, 2), "blockHash": "0x" + "ff" * 32}]
    changed = store.history(chain, WALLET)["items"]
    assert all(item["transactionHash"] != original for item in changed)
    with catalog.engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(store.events)) == 1


def test_failed_sync_keeps_stored_history_and_does_not_claim_an_empty_result():
    catalog = Catalog("sqlite://")
    store = HistoryStore(catalog.engine)
    chain = chain_for({WALLET: [event(20)]})
    store.history(chain, WALLET)
    chain.w3.eth.get_block.side_effect = RuntimeError("RPC failure")
    with pytest.raises(RuntimeError, match="RPC failure"):
        store.history(chain, WALLET)
    with catalog.engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(store.events)) == 1


def test_chain_change_during_sync_is_not_saved():
    catalog = Catalog("sqlite://")
    store = HistoryStore(catalog.engine)
    chain = chain_for({WALLET: [event(20)]})
    chain.w3.eth.get_block.side_effect = [{"hash": HexBytes("0x" + "00" * 32)}, {"hash": HexBytes("0x" + "ff" * 32)}]
    with pytest.raises(ApiError, match="changed during history"):
        store.history(chain, WALLET)
    with catalog.engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(store.events)) == 0
