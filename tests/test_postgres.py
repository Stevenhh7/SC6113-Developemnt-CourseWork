"""Optional real PostgreSQL integration; CI supplies a disposable test database."""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from microinvest.catalog import Catalog
from microinvest.chain import ApiError


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="No disposable PostgreSQL test database configured")
def test_postgresql_registration_search_restart_and_concurrent_seed():
    value = os.environ["TEST_DATABASE_URL"]
    if value.startswith(("postgres://", "postgresql://")):
        value = "postgresql+psycopg://" + value.split("://", 1)[1]
    url = make_url(value)
    assert url.drivername == "postgresql+psycopg" and url.database.endswith("_test"), "Use a dedicated database ending in _test"
    schema = "catalog_test_" + uuid.uuid4().hex
    engine = create_engine(url)
    scoped_url = url.update_query_dict({"options": "-c search_path=" + schema}).render_as_string(hide_password=False)
    store = None
    with engine.begin() as connection:
        connection.execute(text("CREATE SCHEMA " + schema))
    try:
        store = Catalog(scoped_url)
        deployment = {"address": "0x" + "33" * 20, "deploymentBlock": 20,
                      "deployer": "0x" + "44" * 20, "transactionHash": "0x" + "aa" * 32}
        with ThreadPoolExecutor(max_workers=4) as workers:
            list(workers.map(lambda _: store.seed(deployment, 11155111), range(8)))
        assert store.search("", 11155111)["total"] == 1
        metadata = {"name": "投资 Solar 100%", "description": "Small community contributions"}
        other = {**deployment, "address": "0x" + "55" * 20, "transactionHash": "0x" + "bb" * 32}
        project = store.add(metadata, other, 11155111)
        assert store.add(metadata, other, 11155111)["id"] == project["id"]
        with pytest.raises(ApiError, match="different project details"):
            store.add({**metadata, "name": "Rename"}, other, 11155111)
        assert store.search("投资 solar %", 11155111)["items"][0]["id"] == project["id"]
        assert store.search("", 31337)["total"] == 0
        assert store.search("", 11155111, 1, 1)["nextPage"] == 2
        store.engine.dispose()
        store = Catalog(scoped_url)
        assert store.get(project["id"], 11155111) == project
    finally:
        if store is not None:
            store.engine.dispose()
        with engine.begin() as connection:
            connection.execute(text("DROP SCHEMA " + schema + " CASCADE"))
        engine.dispose()
