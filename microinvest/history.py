"""Persistent index of confirmed events; canonical chain data remains authoritative."""
import re

from sqlalchemy import Column, Index, Integer, MetaData, String, Table, Text, and_, delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from web3 import Web3

from microinvest.chain import ApiError, address, units


class HistoryStore:
    def __init__(self, engine):
        self.engine = engine
        schema = MetaData()
        self.events = Table("history_events", schema,
            Column("chain_id", Integer, primary_key=True),
            Column("address", String(42), primary_key=True),
            Column("transaction_hash", String(66), primary_key=True),
            Column("log_index", Integer, primary_key=True),
            Column("wallet", String(42), nullable=False),
            Column("block_number", Integer, nullable=False),
            Column("block_hash", String(66), nullable=False),
            Column("event_type", String(12), nullable=False),
            Column("amount_wei", Text, nullable=False),
            Column("shares_after", Text, nullable=False),
            Column("timestamp", Integer, nullable=False))
        Index("ix_history_wallet_block", self.events.c.chain_id, self.events.c.address,
              self.events.c.wallet, self.events.c.block_number, self.events.c.log_index)
        self.ranges = Table("history_ranges", schema,
            Column("chain_id", Integer, primary_key=True),
            Column("address", String(42), primary_key=True),
            Column("wallet", String(42), primary_key=True),
            Column("start_block", Integer, primary_key=True),
            Column("end_block", Integer, primary_key=True),
            Column("end_hash", String(66), nullable=False))
        schema.create_all(engine)

    @staticmethod
    def scope(table, values):
        return and_(*(table.c[key] == value for key, value in values.items()))

    def coverage(self, values):
        with self.engine.connect() as connection:
            rows = connection.execute(select(self.ranges).where(self.scope(self.ranges, values))
                                      .order_by(self.ranges.c.start_block, self.ranges.c.end_block)).mappings().all()
        merged = []
        for row in rows:
            if merged and row["start_block"] <= merged[-1][1] + 1:
                merged[-1][1] = max(merged[-1][1], row["end_block"])
            else:
                merged.append([row["start_block"], row["end_block"]])
        return rows, merged

    def clear(self, values):
        with self.engine.begin() as connection:
            connection.execute(delete(self.events).where(self.scope(self.events, values)))
            connection.execute(delete(self.ranges).where(self.scope(self.ranges, values)))

    def save(self, values, items, start, end, end_hash):
        insert = pg_insert if self.engine.dialect.name == "postgresql" else sqlite_insert
        with self.engine.begin() as connection:
            for item in items:
                row = {**values, "transaction_hash": item["transactionHash"], "log_index": item["logIndex"],
                       "block_number": item["blockNumber"], "block_hash": item["blockHash"],
                       "event_type": item["type"], "amount_wei": item["amountWei"],
                       "shares_after": item["sharesAfter"], "timestamp": item["timestamp"]}
                statement = insert(self.events).values(**row)
                connection.execute(statement.on_conflict_do_update(
                    index_elements=[column.name for column in self.events.primary_key], set_=row))
            record = {**values, "start_block": start, "end_block": end, "end_hash": end_hash}
            statement = insert(self.ranges).values(**record)
            connection.execute(statement.on_conflict_do_update(
                index_elements=[column.name for column in self.ranges.primary_key], set_={"end_hash": end_hash}))

    def history(self, chain, wallet, cursor=None, limit=20):
        wallet = address(wallet)
        if not 1 <= limit <= 50:
            raise ApiError("invalid_limit", "History limit must be between 1 and 50.")
        before = None
        if cursor:
            if not re.fullmatch(r"[0-9]{1,12}:[0-9]{1,12}", cursor):
                raise ApiError("invalid_cursor", "The history cursor is invalid.")
            before = tuple(map(int, cursor.split(":")))
        chain.check()
        latest = chain.w3.eth.block_number
        deployment = chain.settings.deployment_block
        values = {"chain_id": chain.settings.chain_id, "address": chain.contract.address.lower(), "wallet": wallet.lower()}
        rows, coverage = self.coverage(values)
        if rows:
            checkpoint = max(rows, key=lambda row: row["end_block"])
            # A changed checkpoint invalidates the indexed fork; never reuse its events.
            if (checkpoint["end_block"] > latest or
                    Web3.to_hex(chain.w3.eth.get_block(checkpoint["end_block"])["hash"]) != checkpoint["end_hash"]):
                self.clear(values)
                coverage = []
        end = min(latest, before[0] - (1 if before[1] == 0 else 0)) if before else latest
        if end < deployment:
            return {"items": [], "nextCursor": None, "latestBlock": latest,
                    "scannedFrom": deployment, "scannedTo": end, "source": "database"}
        covered = next((span for span in coverage if span[0] <= end <= span[1]), None)
        if covered is None:
            start = max(deployment, end - chain.settings.page_blocks + 1)
            older = [span for span in coverage if span[1] < end]
            if older:
                start = max(start, max(span[1] for span in older) + 1)
            end_hash = Web3.to_hex(chain.w3.eth.get_block(end)["hash"])
            items = chain.history_events(wallet, start, end, latest)
            if Web3.to_hex(chain.w3.eth.get_block(end)["hash"]) != end_hash:
                raise ApiError("history_changed", "The chain changed during history synchronization. Please retry.", 503)
            self.save(values, items, start, end, end_hash)
            _, coverage = self.coverage(values)
            covered = next(span for span in coverage if span[0] <= end <= span[1])
        start = covered[0]
        conditions = [self.scope(self.events, values), self.events.c.block_number >= start, self.events.c.block_number <= end]
        if before:
            conditions.append(or_(self.events.c.block_number < before[0],
                                  and_(self.events.c.block_number == before[0], self.events.c.log_index < before[1])))
        with self.engine.connect() as connection:
            found = connection.execute(select(self.events).where(*conditions).order_by(
                self.events.c.block_number.desc(), self.events.c.log_index.desc()).limit(limit + 1)).mappings().all()
        items = [{"type": row["event_type"], "amountWei": row["amount_wei"], "amountEth": units(row["amount_wei"]),
                  "sharesAfter": row["shares_after"], "transactionHash": row["transaction_hash"],
                  "blockHash": row["block_hash"], "blockNumber": row["block_number"], "logIndex": row["log_index"],
                  "timestamp": row["timestamp"], "confirmations": latest - row["block_number"] + 1}
                 for row in found[:limit]]
        if len(found) > limit:
            next_cursor = f"{items[-1]['blockNumber']}:{items[-1]['logIndex']}"
        else:
            next_cursor = f"{start}:0" if start > deployment else None
        return {"items": items, "nextCursor": next_cursor, "latestBlock": latest,
                "scannedFrom": start, "scannedTo": end, "source": "database"}
