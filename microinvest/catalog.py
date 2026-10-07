"""Persistent project directory; investment balances remain exclusively on-chain."""
import json
from datetime import datetime, timezone

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys.exceptions import BadSignature
from sqlalchemy import (Column, Integer, MetaData, String, Table, Text, UniqueConstraint,
                        and_, case, create_engine, func, insert, or_, select)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool

from microinvest.chain import ApiError, address, tx_hash


def metadata_input(data):
    if not isinstance(data, dict):
        raise ApiError("invalid_project", "Supply a project name, description and deployment transaction.")
    result = {}
    for key, maximum in (("name", 120), ("description", 2000)):
        value = data.get(key)
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum:
            raise ApiError("invalid_project", f"{key.capitalize()} must contain 1 to {maximum} characters.")
        value = value.strip()
        if any(ord(char) < 32 and char not in "\n\t" for char in value):
            raise ApiError("invalid_project", "Project text contains unsupported control characters.")
        result[key] = value
    result["transactionHash"] = tx_hash(data.get("transactionHash")).lower()
    return result


def registration_message(data, chain_id, origin):
    return "Register a MicroInvest investment (no transfer of funds)\n" + json.dumps(
        {"origin": origin, "chainId": chain_id, **metadata_input(data)},
        ensure_ascii=False, sort_keys=True, indent=2,
    )


def registration_signer(data, chain_id, origin):
    signature = data.get("signature")
    if not isinstance(signature, str) or len(signature) not in (130, 132):
        raise ApiError("invalid_signature", "Approve the project registration message in the deploying wallet.")
    try:
        return address(Account.recover_message(
            encode_defunct(text=registration_message(data, chain_id, origin)), signature=signature))
    except (ValueError, TypeError, BadSignature):
        raise ApiError("invalid_signature", "The project registration signature is invalid.") from None


class Catalog:
    def __init__(self, url):
        if url.startswith(("postgres://", "postgresql://")):
            url = "postgresql+psycopg://" + url.split("://", 1)[1]
        if not url.startswith(("postgresql+psycopg://", "sqlite://")):
            raise ValueError("DATABASE_URL must identify PostgreSQL or a local SQLite database.")
        options = {"pool_pre_ping": True}
        if url in ("sqlite://", "sqlite:///:memory:"):
            options.update(poolclass=StaticPool, connect_args={"check_same_thread": False})
        elif url.startswith("postgresql"):
            options["connect_args"] = {"connect_timeout": 10}
        self.engine = create_engine(url, **options)
        schema = MetaData()
        self.projects = Table("investments", schema,
            Column("id", Integer, primary_key=True),
            Column("chain_id", Integer, nullable=False),
            Column("address", String(42), nullable=False),
            Column("deployment_block", Integer, nullable=False),
            Column("transaction_hash", String(66)),
            Column("creator", String(42)),
            Column("name", String(120), nullable=False),
            Column("description", Text, nullable=False),
            Column("search_text", Text, nullable=False),
            Column("created_at", String(32), nullable=False),
            UniqueConstraint("chain_id", "address"),
            UniqueConstraint("chain_id", "transaction_hash"))
        schema.create_all(self.engine)

    @staticmethod
    def public(row):
        return {"id": row["id"], "name": row["name"], "description": row["description"],
                "chainId": row["chain_id"], "contractAddress": address(row["address"]),
                "deploymentBlock": row["deployment_block"], "transactionHash": row["transaction_hash"],
                "creator": address(row["creator"]) if row["creator"] else None,
                "createdAt": row["created_at"], "url": f"/investments/{row['id']}"}

    def get(self, project_id, chain_id):
        with self.engine.connect() as connection:
            row = connection.execute(select(self.projects).where(
                self.projects.c.id == project_id, self.projects.c.chain_id == chain_id)).mappings().first()
        if row is None:
            raise ApiError("investment_not_found", "This investment was not found on the selected network.", 404)
        return self.public(row)

    def add(self, data, deployment, chain_id):
        values = {"chain_id": chain_id, "address": address(deployment["address"]).lower(),
                  "deployment_block": deployment["deploymentBlock"],
                  "transaction_hash": deployment.get("transactionHash"),
                  "creator": address(deployment["deployer"]).lower() if deployment.get("deployer") else None,
                  "name": data["name"], "description": data["description"],
                  "search_text": " ".join((data["name"], data["description"], deployment["address"],
                                            deployment.get("deployer") or "")).casefold(),
                  "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        try:
            with self.engine.begin() as connection:
                result = connection.execute(insert(self.projects).values(**values))
                project_id = result.inserted_primary_key[0]
        except IntegrityError:
            with self.engine.connect() as connection:
                row = connection.execute(select(self.projects).where(
                    self.projects.c.chain_id == chain_id, self.projects.c.address == values["address"])).mappings().first()
            if row is None or any(row[key] != values[key] for key in ("name", "description", "transaction_hash", "creator")):
                raise ApiError("already_registered", "This contract is already registered with different project details.", 409) from None
            project_id = row["id"]
        return self.get(project_id, chain_id)

    def seed(self, deployment, chain_id):
        with self.engine.connect() as connection:
            exists = connection.execute(select(self.projects.c.id).where(
                self.projects.c.chain_id == chain_id,
                self.projects.c.address == deployment["address"].lower())).first()
        if not exists:
            self.add({"name": "Original MicroInvest Pool", "description":
                      "The original educational pool. Deposit test ETH, own exact fractional shares and redeem principal anytime."},
                     deployment, chain_id)

    def search(self, query, chain_id, page=1, limit=12, creator=None):
        if not isinstance(query, str) or len(query) > 200 or not 1 <= page <= 100000 or not 1 <= limit <= 50:
            raise ApiError("invalid_search", "Use up to 200 search characters and a valid page/limit.")
        conditions = [self.projects.c.chain_id == chain_id]
        if creator:
            conditions.append(self.projects.c.creator == address(creator).lower())
        query = query.strip().casefold()
        ordering = [self.projects.c.id.desc()]
        if query:
            text = and_(*(self.projects.c.search_text.contains(term, autoescape=True) for term in query.split()))
            if query.isascii() and query.isdigit() and len(query) <= 10:
                text = or_(text, self.projects.c.id == int(query))
                ordering.insert(0, case((self.projects.c.id == int(query), 0), else_=1))
            conditions.append(text)
        with self.engine.connect() as connection:
            total = connection.scalar(select(func.count()).select_from(self.projects).where(*conditions))
            rows = connection.execute(select(self.projects).where(*conditions)
                .order_by(*ordering).offset((page - 1) * limit).limit(limit)).mappings().all()
        return {"items": [self.public(row) for row in rows], "total": total, "page": page,
                "nextPage": page + 1 if page * limit < total else None}
