"""Export public project metadata for coursework; excludes database credentials."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import app
from sqlalchemy import select

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, help="Destination JSON file")
parser.add_argument("--include-history", action="store_true", help="Also export indexed public events and synchronization ranges")
options = parser.parse_args()
items = []
page = 1
catalog = app.extensions["catalog"]
while True:
    result = catalog.search("", app.config["CHAIN_ID"], page, 50)
    items.extend(result["items"])
    if result["nextPage"] is None:
        break
    page = result["nextPage"]
destination = Path(options.output)
destination.parent.mkdir(parents=True, exist_ok=True)
data = {"chainId": app.config["CHAIN_ID"], "investments": items}
if options.include_history:
    history = app.extensions["history"]
    with catalog.engine.connect() as connection:
        for key, table in (("confirmedEvents", history.events), ("historyRanges", history.ranges)):
            data[key] = [dict(row) for row in connection.execute(select(table).where(
                table.c.chain_id == app.config["CHAIN_ID"])).mappings()]
destination.write_text(json.dumps(data,
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Exported {len(items)} public investments to {destination.name}.")
