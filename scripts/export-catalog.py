"""Export public project metadata for coursework; excludes database credentials."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import app

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, help="Destination JSON file")
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
destination.write_text(json.dumps({"chainId": app.config["CHAIN_ID"], "investments": items},
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Exported {len(items)} public investments to {destination.name}.")
