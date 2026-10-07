"""Package coursework deliverables, retaining provenance and excluding local secrets."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile
from datetime import datetime, timezone
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
NAME = "SC6113_G2608005K_JiChengyu"
OUTPUT = ROOT.parent / "submission"
INPUT = ROOT / "tmp/submission-inputs"
TOP_FILES = (
    "app.py", ".gitignore",
    ".env.example", "package.json", "pnpm-lock.yaml", "hardhat.config.ts",
    "requirements.txt", "requirements-dev.txt", "pytest.ini", "render.yaml", "deployments/sepolia.json",
)
SOURCE_DIRS = (
    "contracts", "contract", "microinvest", "templates", "static", "scripts",
    "test", "tests", "docs", ".github/workflows",
)
SUFFIXES = {
    ".py", ".ts", ".sol", ".mjs", ".js", ".html", ".css", ".svg", ".json", ".md",
    ".sql", ".yml", ".yaml", ".png", ".jpg",
}
FOLDERS = ("01_Final_Report", "02_Source_Code", "03_Database", "04_README", "05_Screenshots")
AUTHORING_FILES = {
    "scripts/collect-report-evidence.py", "scripts/collect-updated-report-evidence.py",
    "scripts/package-submission.py", "docs/evidence/report-build-2026-10-07.json",
}
REPORT_SECTIONS = (
    "Introduction", "Problem Statement", "Objectives", "System Architecture", "Technologies Used",
    "Smart Contract Design", "Application Design", "Implementation", "Testing and Results",
    "Challenges Encountered", "Limitations", "Future Improvements", "Conclusion",
)
BLOCKED_PARTS = {
    ".git", ".venv", "node_modules", "instance", "__pycache__", "tmp",
    "test-results", "cache", "artifacts", ".pytest_cache", ".pnpm-store",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(data):
    return (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def public_snapshot_sql(snapshot):
    """Reconstruct the covered public rows, never pretend to dump live PostgreSQL."""
    lines = [
        "-- Public API reconstruction, NOT a complete PostgreSQL dump.",
        "-- Capture: " + snapshot["capturedAtUtc"],
        "-- Import into a NEW database after schema.sql. Uncovered wallets/checkpoints are omitted.",
        "BEGIN;",
    ]
    project_by_id = {p["id"]: p for p in snapshot["investments"]}
    columns = "id,chain_id,address,deployment_block,transaction_hash,creator,name,description,search_text,created_at"
    for project in snapshot["investments"]:
        address = project["contractAddress"].lower()
        creator = project.get("creator")
        search_text = " ".join((project["name"], project["description"], address,
                                creator or "")).casefold()
        values = [project["id"], project["chainId"], address, project["deploymentBlock"],
                  project.get("transactionHash"), creator.lower() if creator else None,
                  project["name"], project["description"], search_text, project["createdAt"]]
        lines.append(f"INSERT INTO investments ({columns}) VALUES ({','.join(map(sql_value, values))});")
    event_columns = "chain_id,address,transaction_hash,log_index,wallet,block_number,block_hash,event_type,amount_wei,shares_after,timestamp"
    seen = set()
    for history in snapshot["histories"]:
        project = project_by_id[history["investmentId"]]
        for event in history["items"]:
            key = (project["id"], event["transactionHash"].lower(), event["logIndex"])
            if key in seen:
                continue
            seen.add(key)
            values = [project["chainId"], project["contractAddress"].lower(),
                      event["transactionHash"].lower(), event["logIndex"],
                      history["wallet"].lower(), event["blockNumber"], event["blockHash"],
                      event["type"], event["amountWei"], event["sharesAfter"], event["timestamp"]]
            lines.append(f"INSERT INTO history_events ({event_columns}) VALUES ({','.join(map(sql_value, values))});")
    lines.extend([
        "-- Advance generated IDs after restoring explicit directory IDs.",
        "SELECT setval(pg_get_serial_sequence('investments','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM investments;",
        "-- history_ranges stays empty: the application validates/backfills coverage from the chain.",
        "COMMIT;",
    ])
    return ("\n".join(lines) + "\n").encode("utf-8")


def postgres_export_sql(data):
    """Restore all exported application rows, including stored scan checkpoints."""
    base = public_snapshot_sql({"capturedAtUtc": "See PostgreSQL export validation evidence",
                                "investments": data["investments"], "histories": []}).decode("utf-8")
    project_inserts = [line for line in base.splitlines() if line.startswith("INSERT INTO investments ")]
    lines = ["-- Direct PostgreSQL application-data export for Sepolia (not a server backup).",
             "-- Import schema.sql first into a NEW database; all three exported application tables are included.",
             "BEGIN;", *project_inserts]
    columns = {
        "history_events": ("chain_id", "address", "transaction_hash", "log_index", "wallet", "block_number",
                           "block_hash", "event_type", "amount_wei", "shares_after", "timestamp"),
        "history_ranges": ("chain_id", "address", "wallet", "start_block", "end_block", "end_hash"),
    }
    for table, key in (("history_events", "confirmedEvents"), ("history_ranges", "historyRanges")):
        for row in data[key]:
            names = columns[table]
            values = ",".join(sql_value(row[name]) for name in names)
            lines.append(f"INSERT INTO {table} ({','.join(names)}) VALUES ({values});")
    lines.extend(["SELECT setval(pg_get_serial_sequence('investments','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM investments;",
                  "COMMIT;"])
    return ("\n".join(lines) + "\n").encode("utf-8")


def source_files():
    files = {name: (ROOT / name).read_bytes() for name in TOP_FILES}
    for directory in SOURCE_DIRS:
        for path in sorted((ROOT / directory).rglob("*")):
            relative = path.relative_to(ROOT)
            if not path.is_file() or set(relative.parts) & BLOCKED_PARTS:
                continue
            if path.is_symlink():
                raise ValueError("Symlink requires review: " + relative.as_posix())
            if path.name.startswith(".env") or path.suffix.lower() not in SUFFIXES:
                continue
            if relative.as_posix() in AUTHORING_FILES:
                continue
            files[relative.as_posix()] = path.read_bytes()
    return files


def check_secrets(files):
    # Compare active local secrets without ever displaying their values.
    values = []
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip("\"'")
            if not value:
                continue
            sensitive = any(term in key.upper() for term in ("PRIVATE_KEY", "PASSWORD", "SECRET", "DATABASE_URL"))
            if "RPC" in key.upper() and "://" in value:
                url = urlsplit(value)
                sensitive |= bool(url.username or url.password or url.query or url.path.strip("/"))
            if sensitive:
                values.append(value.encode("utf-8"))
                if "://" in value:
                    password = urlsplit(value).password
                    if password:
                        values.append(password.encode("utf-8"))
    for name, data in files.items():
        if any(value in data for value in values):
            raise ValueError("Local secret detected in selected file: " + name)
        for match in re.findall(rb"postgres(?:ql)?(?:\+psycopg)?://[^\s/'\"]+:[^\s@/'\"]+@[^\s'\"]+", data):
            parsed = urlsplit(match.decode("utf-8"))
            ci_fixture = (name.endswith(".github/workflows/ci.yml")
                          and parsed.hostname in {"127.0.0.1", "localhost", "postgres"}
                          and parsed.path.endswith("_test"))
            if not ci_fixture:
                raise ValueError("Credential-bearing database URL requires review: " + name)
        if re.search(rb"(?m)^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?$", data):
            raise ValueError("Private-key file requires review: " + name)
        if name.endswith(".zip"):
            from io import BytesIO
            with zipfile.ZipFile(BytesIO(data)) as nested:
                if nested.testzip() is not None:
                    raise ValueError("Nested source archive failed integrity check")
                check_secrets({name + "/" + n: nested.read(n) for n in nested.namelist() if not n.endswith("/")})


def submission_readme():
    """Keep the complete application guide with paths valid in the submitted layout."""
    guide = (ROOT / "README.md").read_text(encoding="utf-8")
    guide = guide.replace("[report](report/README.md)", "[report](../01_Final_Report/MicroInvest_Report.pdf)")
    guide = guide.replace("| docs/RENDER_UPDATE.md, USER_ACTIONS.md | Updated deployment and student actions |",
                          "| docs/RENDER_UPDATE.md | Updated deployment procedure |")
    guide = guide.replace("See [Plan.md](Plan.md), [architecture](docs/ARCHITECTURE.md), [testing](docs/TESTING.md) and [student actions](USER_ACTIONS.md).",
                          "See [architecture](docs/ARCHITECTURE.md) and [testing](docs/TESTING.md).")
    guide = guide.replace("The final PDF/source ZIP", "The final PDF")
    guide = re.sub(r"\]\((docs/[^)]+)\)", r"](../02_Source_Code/\1)", guide)
    guide = guide.replace("Open this repository root in VS Code.",
                          "Open the submitted 02_Source_Code folder in VS Code. Run all commands below from that folder.")
    preface = """# Submission guide

Student: **Ji Chengyu, G2608005K**. Project: **MicroInvest**.

The five sibling folders match the coursework deliverables:

| Required deliverable | Location |
| --- | --- |
| Final report (5-8 pages, PDF) | [8-page PDF, including references](../01_Final_Report/MicroInvest_Report.pdf) |
| Source code | ../02_Source_Code/ (open this folder as the project root) |
| Smart contract (.sol) | ../02_Source_Code/contracts/MicroInvest.sol |
| Python backend | ../02_Source_Code/app.py and microinvest/ |
| HTML/CSS/JavaScript | ../02_Source_Code/templates/ and static/ |
| Database | ../03_Database/ (schema, final application export and restoration SQL) |
| README | This file; setup, operation, deployment and tests follow below |
| Screenshots | ../05_Screenshots/ (originals, report crops and provenance) |

[Requirements comparison](REQUIREMENTS_COMPARISON.md) maps the Word requirements to the supplied material. No video is required. The report is supplied as PDF only.

All application files remain together under 02_Source_Code; the other four folders are submission materials. The hosted service remains https://sc6113-developemnt-coursework.onrender.com/.

To run this copy, enter **02_Source_Code** first, create a virtual environment, install requirements and copy .env.example to your own private .env. For Render, upload/use 02_Source_Code as the project root (or set Root Directory to 02_Source_Code if the five-folder submission layout is used as a repository). The original application repository still uses its repository root.

Database data was exported from the final Render PostgreSQL application in a read-only session: **2 investments, 10 stored confirmed events and 9 synchronization ranges**. See ../03_Database/README.md. This is an application-table export, not a PostgreSQL server backup. Current funds and redemption rights remain on Sepolia.

Local credentials, private keys, virtual environments, node_modules, caches, test/demo databases and report editing/compilation files are excluded. Course filename, upload platform and deadline instructions remain authoritative.

---

"""
    return (preface + guide).encode("utf-8")


def requirements_comparison():
    return """# Comparison with the coursework Word requirements

Source: SC6113 Individual Assignment(1).docx, Sections III, VI-X. Student: Ji Chengyu, G2608005K.

## X. Deliverables

| Word requirement | Submitted material | Check |
| --- | --- | --- |
| Final Report (5-8 pages, PDF) | 01_Final_Report/MicroInvest_Report.pdf | 8 pages including references; all 13 required sections |
| Source Code | 02_Source_Code/ | Single runnable project folder |
| Smart Contract (.sol) | 02_Source_Code/contracts/MicroInvest.sol | Solidity business contract, plus adversarial test actors |
| Python/Node.js files | 02_Source_Code/app.py, microinvest/, scripts/ | Flask Python backend; Node.js development tooling retained |
| HTML/CSS/JavaScript files | 02_Source_Code/templates/, static/ | HTML templates, CSS, JavaScript and vendored ethers/license |
| Database (if applicable) | 03_Database/ | PostgreSQL schema, direct final JSON export and restoration SQL |
| README file | 04_README/README.md | Setup, operation, deployment, configuration and tests |
| Screenshots | 05_Screenshots/ | 12 original captures plus 3 report crops; captions/hashes in manifest.json |
| No video recording needed | No video included | Matches instruction |

LaTeX sources, source ZIPs and compilation instructions are excluded from the submission. The local editable report is preserved outside this package.

## IX. Report structure

All required headings appear in the submitted PDF:

1. Introduction
2. Problem Statement
3. Objectives
4. System Architecture
5. Technologies Used
6. Smart Contract Design
7. Application Design
8. Implementation
9. Testing and Results
10. Challenges Encountered
11. Limitations
12. Future Improvements
13. Conclusion

## III and VI. Project and functional requirements

| Requirement | Implementation/evidence |
| --- | --- |
| Financial DApp | Beginner micro-investment pools, fixed fractional shares and anytime principal redemption; report Sections 1-3 |
| Solidity contract validation | contracts/MicroInvest.sol validates positive deposits and caller-owned redemptions; report Section 6 |
| MetaMask connection | static/wallet.js, account menu and 02-wallet.png |
| Friendly web interface | templates/, static/styles.css; named project search, independent detail and activity pages |
| Flask or Node.js backend | app.py and microinvest/ provide Flask routes, registration, search and chain reads |
| Blockchain transactions and records | Deployments/deposits/redemptions on Sepolia; successful receipts/events in docs/evidence/ |
| Confirmation and history | Project-scoped status/history, latest five preview, complete activity pages and PostgreSQL event index |
| Input validation and error handling | Amount, signature, deployment, context and RPC validation; invalid-input screenshot and test evidence |

Source paths in this table are relative to 02_Source_Code unless a screenshot is named.

## VII. Security considerations

The Word explicitly includes security considerations. The report and source cover authentication/authorization (caller-bound redemption and deployer-signed metadata), input validation, guarded withdrawals and failed-transfer rollback, private-key protection, fixed-size operations/gas observations, and public-data privacy/ethics. No commercial audit, real-money safety certification or load benchmark is claimed. See PDF Sections 6, 8, 9 and 11, and 02_Source_Code/docs/TESTING.md.

## VIII. Testing

| Required test area | Supplied results |
| --- | --- |
| Successful transactions | Confirmed deposit/partial/full redemption receipts; 03-history.png, 06-redemption.png and 12-current-history.jpg |
| Invalid input handling | 04-invalid-input.png and automated validation cases |
| Wallet connection | 02-wallet.png; local browser account/permission checks and student-reported actual MetaMask acceptance |
| Smart contract deployment | 01-deployment.png, actual receipts and current independent project detail |
| Screenshots of results | 05_Screenshots/manifest.json describes each original/crop and observation time |

Observed automated results: 12 unchanged-contract tests, 54 backend cases, 9 frontend tests and 24 browser checks. The dedicated PostgreSQL test was skipped locally; no unobserved CI success or hosted restart experiment is claimed. Successful final PostgreSQL export is separate evidence. Student acceptance, local simulated-wallet tests and independent public API/receipt checks are distinguished in the report.

## Submission checks

The ZIP and extracted copy have exactly five deliverable folders, no source files loose at package root, no LaTeX/nested ZIP/video, all required source categories, database rows and screenshots, and no active local credentials. File hashes are in SUBMISSION_MANIFEST.json. Packaging does not upload coursework or push repository changes.
""".encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, default=INPUT / "database-public-api-snapshot-2026-10-07.json")
    parser.add_argument("--postgres-export", type=Path, default=INPUT / "catalog-postgres-export.json",
                        help="Reviewed export obtained from the final PostgreSQL database")
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
    if snapshot["chainId"] != 11155111 or not snapshot["investments"]:
        raise ValueError("A nonempty Sepolia public snapshot is required")
    source = source_files()
    # Check the original source paths before prefixing, including the harmless CI test fixture.
    check_secrets(source)
    source["docs/DEPLOYMENT.md"] = source["docs/DEPLOYMENT.md"].replace(
        b"`report/screenshots/`", b"`../../05_Screenshots/`")
    source["docs/TESTING.md"] = source["docs/TESTING.md"].replace(
        b"Run commands are in README.", b"Run commands are in ../../04_README/README.md.")
    export_evidence = json.loads(source["docs/evidence/database-export-2026-10-08.json"])
    export_evidence["exportFile"] = "03_Database/catalog-postgres-export.json"
    source["docs/evidence/database-export-2026-10-08.json"] = json_bytes(export_evidence)
    files = {"02_Source_Code/" + name: data for name, data in source.items()}

    build = json.loads((ROOT / "docs/evidence/report-build-2026-10-07.json").read_text(encoding="utf-8"))
    pdf = (ROOT / "report/MicroInvest_Report.pdf").read_bytes()
    if digest(pdf) != build["pdfSha256"] or build["pages"] != 8 or tuple(build["sectionTitles"]) != REPORT_SECTIONS:
        raise ValueError("Report differs from the verified eight-page/13-section report")
    try:
        from io import BytesIO
        from pypdf import PdfReader
        report = PdfReader(BytesIO(pdf))
        text = "\n".join(page.extract_text() for page in report.pages)
        if len(report.pages) != 8 or not all(
                re.search(rf"(?m)^\s*{i}\s+{re.escape(title)}\s*$", text)
                for i, title in enumerate(REPORT_SECTIONS, 1)):
            raise ValueError("PDF page count or required headings do not match the Word requirements")
    except ImportError:
        pass  # PDF hash binds to the previously recorded full visual/page/heading validation.
    files["01_Final_Report/MicroInvest_Report.pdf"] = pdf
    files["04_README/REPORT_VALIDATION.json"] = json_bytes({
        "pdf": "01_Final_Report/MicroInvest_Report.pdf", "pages": 8,
        "includesReferencesInPageCount": True, "requiredSections": list(REPORT_SECTIONS),
        "pdfSha256": digest(pdf), "visualReview": build["visualReview"],
        "visuallyReviewedPages": build["visuallyReviewedPages"], "reportFormat": "PDF only",
    })

    direct_export = json.loads(args.postgres_export.read_text(encoding="utf-8"))
    if direct_export.get("chainId") != 11155111 or not all(
            isinstance(direct_export.get(key), list) for key in ("investments", "confirmedEvents", "historyRanges")):
        raise ValueError("Provide the final Sepolia --include-history export, not a local demo file")
    expected = {p["contractAddress"].lower() for p in snapshot["investments"]}
    actual = {p["contractAddress"].lower() for p in direct_export["investments"]}
    if not expected <= actual:
        raise ValueError("The final export omits publicly verified projects")
    export_bytes = args.postgres_export.read_bytes()
    if digest(export_bytes) != export_evidence["sha256"]:
        raise ValueError("Final database export hash differs from its reviewed provenance")
    counts = {key: len(direct_export[key]) for key in ("investments", "confirmedEvents", "historyRanges")}
    if counts != export_evidence["counts"]:
        raise ValueError("Database row counts differ from their reviewed evidence")
    files["03_Database/catalog-postgres-export.json"] = export_bytes
    files["03_Database/catalog-postgres-data.sql"] = postgres_export_sql(direct_export)
    files["03_Database/schema.sql"] = source["docs/schema.sql"]
    files["03_Database/README.md"] = f"""# Database deliverable

Direct final Render PostgreSQL application data, exported over TLS in a read-only session. Sepolia chain ID: 11155111.

- schema.sql: PostgreSQL structure matching the submitted application.
- catalog-postgres-export.json: exact reviewed application-data export; {counts['investments']} investment rows, {counts['confirmedEvents']} stored confirmed events and {counts['historyRanges']} synchronization ranges.
- catalog-postgres-data.sql: inserts all these exported rows and advances generated investment IDs.

## Restore into a new PostgreSQL database

Use a new empty database. With psql and your own PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD configured privately, run from this 03_Database folder:

```sh
psql -v ON_ERROR_STOP=1 -f schema.sql
psql -v ON_ERROR_STOP=1 -f catalog-postgres-data.sql
```

Then configure DATABASE_URL privately in ../02_Source_Code/.env and run the application from 02_Source_Code. Preserve its Sepolia chain configuration. The application revalidates synchronization checkpoints against Sepolia when queried. Do not restore the sample into an existing catalog or a local-chain demo.

The export covers all stored Sepolia application metadata/event/range rows at export time; it does not claim that every chain event has been indexed. Search text is reconstructed from the exported public metadata. This is not a full PostgreSQL server backup, and excludes server roles, credentials and wallet keys. Funds, current balances and redemption rights remain on-chain. Export provenance is in ../02_Source_Code/docs/evidence/database-export-2026-10-08.json.
""".encode("utf-8")

    screenshot_manifest = json.loads((ROOT / "report/screenshots/manifest.json").read_text(encoding="utf-8"))
    for capture in screenshot_manifest["screenshots"]:
        for asset in (capture, *capture.get("derivatives", [])):
            data = (ROOT / "report/screenshots" / asset["file"]).read_bytes()
            if digest(data) != asset["sha256"]:
                raise ValueError("Screenshot differs from its provenance: " + asset["file"])
            files["05_Screenshots/" + asset["file"]] = data
    files["05_Screenshots/manifest.json"] = json_bytes(screenshot_manifest)
    files["05_Screenshots/README.md"] = """# Screenshots

Twelve original captures and three faithful report crops are retained. manifest.json lists captions, capture sources/dates, image sizes, SHA-256 hashes, report inclusion and crop provenance.

- 01: successful Sepolia contract deployment.
- 02: connected wallet and authorized account menu.
- 03 / 06: confirmed transaction history and redemption leaving zero holdings.
- 04: rejection of negative input.
- 07 / 08: original backend API and hosted deployment evidence.
- 09 / 10 / 11: updated keyword search, title/explanation creation form and independent project detail.
- 12 / 13: updated persistent history and successful Render deployment.

Images are observations at the documented times, not current balances. The creation-form capture illustrates the form and submitted no transaction. Nine captures are used in the final PDF; unused original evidence remains available here.
""".encode("utf-8")
    files["04_README/README.md"] = submission_readme()
    files["04_README/REQUIREMENTS_COMPARISON.md"] = requirements_comparison()

    required = (
        "02_Source_Code/app.py", "02_Source_Code/contract/MicroInvest.json",
        "02_Source_Code/contracts/MicroInvest.sol", "02_Source_Code/deployments/sepolia.json",
        "02_Source_Code/static/vendor/ethers.umd.min.js", "02_Source_Code/static/vendor/ethers.LICENSE.md",
        "02_Source_Code/.env.example", "01_Final_Report/MicroInvest_Report.pdf", "04_README/README.md",
        "03_Database/schema.sql", "03_Database/catalog-postgres-export.json", "03_Database/catalog-postgres-data.sql",
        "05_Screenshots/01-deployment.png", "05_Screenshots/02-wallet.png", "05_Screenshots/04-invalid-input.png",
        "05_Screenshots/06-redemption.png", "05_Screenshots/12-current-history.jpg", "05_Screenshots/13-render-updated.png",
    )
    if not all(name in files for name in required):
        raise ValueError("A required deliverable is missing")
    forbidden_suffixes = {".tex", ".zip", ".aux", ".log", ".out", ".toc", ".mp4", ".mov", ".avi", ".webm"}
    if {Path(name).parts[0] for name in files} != set(FOLDERS) or any(
            len(Path(name).parts) < 2 or Path(name).suffix.lower() in forbidden_suffixes for name in files):
        raise ValueError("All materials must be in the five deliverable folders, with PDF-only report and no video")
    check_secrets(files)
    manifest = {
        "package": NAME, "student": {"name": "Ji Chengyu", "studentId": "G2608005K"},
        "builtAtUtc": datetime.now(timezone.utc).isoformat(), "timezone": "Asia/Shanghai",
        "deliverableFolders": list(FOLDERS), "sourceProjectRoot": "02_Source_Code",
        "reportFormat": "PDF only", "reportPagesIncludingReferences": 8,
        "requiredReportSections": list(REPORT_SECTIONS), "finalPostgreSqlExportIncluded": True,
        "databaseRows": counts, "originalScreenshots": len(screenshot_manifest["screenshots"]),
        "screenshotImagesIncludingCrops": sum(Path(n).suffix.lower() in {".png", ".jpg"} for n in files),
        "missingItems": [],
        "excludes": sorted(BLOCKED_PARTS) + [".env and active credentials", "local databases",
                                             "LaTeX source/ZIP/compilation files", "plans and student handoff notes", "video"],
        "files": [{"path": name, "bytes": len(data), "sha256": digest(data)} for name, data in sorted(files.items())],
    }
    files["04_README/SUBMISSION_MANIFEST.json"] = json_bytes(manifest)
    OUTPUT.mkdir(exist_ok=True)
    archive = OUTPUT / (NAME + "_Submission.zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for folder in FOLDERS:
            z.writestr(NAME + "/" + folder + "/", b"")
        for name, data in sorted(files.items()):
            z.writestr(NAME + "/" + name, data)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError("ZIP integrity validation failed")
        for item in manifest["files"]:
            if digest(z.read(NAME + "/" + item["path"])) != item["sha256"]:
                raise ValueError("ZIP file hash mismatch")
        if any(set(Path(name).parts) & BLOCKED_PARTS for name in z.namelist()):
            raise ValueError("Excluded path entered the archive")

    # Also supply the same organized folders for direct review under submission/.
    directory = OUTPUT
    directory.mkdir(exist_ok=True)
    existing_files = {p.relative_to(directory).as_posix() for folder in FOLDERS
                      for p in (directory / folder).rglob("*") if p.is_file()}
    if existing_files - files.keys():
        raise ValueError("Review existing unpacked folder before replacing unknown files")
    for name, data in files.items():
        target = directory / name
        if not target.resolve().is_relative_to(OUTPUT.resolve()) or target.is_symlink():
            raise ValueError("Unsafe destination path")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        if digest(target.read_bytes()) != digest(data):
            raise ValueError("Unpacked file hash mismatch")
    summary = {
        "archive": archive.name, "directory": directory.name, "bytes": archive.stat().st_size,
        "sha256": digest(archive.read_bytes()), "files": len(files), "zipIntegrity": "passed",
        "allFileHashes": "verified", "unpackedFileHashes": "verified", "folders": list(FOLDERS),
        "noLooseSourceFiles": True, "reportPages": 8, "requiredReportSections": 13,
        "reportFormat": "PDF only", "noLatexOrNestedZipOrVideo": True,
        "finalPostgreSqlExportIncluded": True, "databaseRows": counts, "missingItems": [],
    }
    INPUT.mkdir(parents=True, exist_ok=True)
    (INPUT / "PACKAGE_VALIDATION.json").write_bytes(json_bytes(summary))
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
