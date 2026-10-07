"""Read public hosted evidence for the current report; never sign transactions."""
import concurrent.futures
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import time
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
BASE = "https://sc6113-developemnt-coursework.onrender.com"
WALLET = "0xc63A507a39C37CB4C752BA56408138386D06146f"
PATHS = ["/healthz", "/api/investments", "/api/investments?q=test1",
         "/api/investments/2", "/api/pool?investment=1", "/api/pool?investment=2",
         f"/api/history/{WALLET}?investment=1&limit=5",
         f"/api/history/{WALLET}?investment=1&limit=50", "/static/latest-activity.js"]


def read(path):
    separator = "&" if "?" in path else "?"
    request = urllib.request.Request(BASE + path + separator + "_verify=" + str(time.time_ns()),
                                     headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=25) as response:
        raw = response.read()
        body = ({"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
                if path.startswith("/static/") else json.loads(raw))
        return {"path": path, "status": response.status, "data": body}


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        responses = list(pool.map(read, PATHS))
    result = {"checkedAtUtc": datetime.now(timezone.utc).isoformat(), "baseUrl": BASE,
              "sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT,
                                                        text=True).strip(),
              "studentAcceptance": "Student reported successful testing of the updated Render application after redeployment on 7 October 2026.",
              "scope": "Read-only live APIs and static-file verification; no wallet actions, load test, or hosted restart test performed by the collector.",
              "responses": responses}
    destination = ROOT / "docs/evidence/live-multi-investment-2026-10-07.json"
    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(destination), "responses": len(responses),
                      "historySource": next(row["data"].get("source") for row in responses
                                            if "limit=5" in row["path"]),
                      "historyRows": next(len(row["data"]["items"]) for row in responses
                                          if "limit=50" in row["path"])}))
