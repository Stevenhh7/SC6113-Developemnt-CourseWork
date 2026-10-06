"""Read public deployment evidence. This script never signs or submits transactions."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://sc6113-developemnt-coursework.onrender.com"
WALLET = "0xc63A507a39C37CB4C752BA56408138386D06146f"
HASHES = [
    "0x0304792edcd32dc589e6e5c7756f86fdc33a283c295b78772a8e323b4d490798",
    "0xcb3ebbe7044daf65d6129d01cb936cfaa9ccc8553b347ebccbe13a09b477804e",
    "0xe47ab65933833624b02fddd362fcce5ade0c734d1626790b3239831ff4f06e9a",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=BASE)
    parser.add_argument("--output", type=Path, default=ROOT / "docs/evidence/live-validation-2026-10-07.json")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    paths = ["/", "/healthz", "/api/config", "/api/pool", "/api/position/" + WALLET,
             "/api/history/" + WALLET + "?limit=50"]
    paths += ["/api/transactions/" + value for value in HASHES]

    def read(path):
        start = time.perf_counter()
        request = urllib.request.Request(base + path, headers={"User-Agent": "MicroInvest-coursework-evidence"})
        with urllib.request.urlopen(request, timeout=40) as response:
            body = response.read().decode("utf-8")
            if path == "/":
                data = {"walletMenu": 'id="wallet-menu"' in body,
                        "fullActivityLink": "View all activity" in body,
                        "title": body.split("<title>")[1].split("</title>")[0]}
            else:
                data = json.loads(body)
                if path == "/api/config":
                    data.pop("abi", None)
            return {"url": base + path, "httpStatus": response.status,
                    "queriedAtUtc": datetime.now(timezone.utc).isoformat(),
                    "elapsedSeconds": round(time.perf_counter() - start, 3), "data": data}

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = dict(zip(paths, executor.map(read, paths)))
    deployment = json.loads((ROOT / "deployments/sepolia.json").read_text(encoding="utf-8"))
    config = results["/api/config"]["data"]
    assert config["chainId"] == 11155111
    assert config["contractAddress"].lower() == deployment["address"].lower()
    assert results["/api/pool"]["data"]["solvent"] is True
    assert all(results["/api/transactions/" + value]["data"]["status"] == "success" for value in HASHES)
    evidence = {"verification": "Read-only HTTPS checks against the public Render application",
                "studentAcceptance": {"date": "2026-10-07", "environment": "Render + MetaMask + Sepolia",
                                      "result": "Student reported all functional tests passed"},
                "baseUrl": base, "participant": WALLET, "deployment": deployment, "requests": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    for path, result in results.items():
        print(result["httpStatus"], path)
    print("Saved", args.output)


if __name__ == "__main__":
    main()
