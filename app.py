"""Flask entry point for local development and Gunicorn on Render."""
import json
import os
from functools import wraps
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from microinvest.chain import ApiError, ChainService, Settings, address
from microinvest.catalog import Catalog, metadata_input, registration_message, registration_signer

ROOT = Path(__file__).resolve().parent


def create_app(overrides=None, service=None):
    load_dotenv(ROOT / ".env")
    app = Flask(__name__)
    app.config.update(
        CHAIN_ID=int(os.getenv("CHAIN_ID", "11155111")),
        RPC_URL=os.getenv("RPC_URL", ""),
        CONTRACT_ADDRESS=os.getenv("CONTRACT_ADDRESS", ""),
        DEPLOYMENT_BLOCK=os.getenv("DEPLOYMENT_BLOCK", ""),
        LOCAL_DEVELOPMENT=os.getenv("LOCAL_DEVELOPMENT", "false").lower() == "true",
        RPC_TIMEOUT=int(os.getenv("RPC_TIMEOUT", "10")),
        LOG_CHUNK_SIZE=int(os.getenv("LOG_CHUNK_SIZE", "1000")),
        HISTORY_PAGE_BLOCKS=int(os.getenv("HISTORY_PAGE_BLOCKS", "5000")),
        DATABASE_URL=os.getenv("DATABASE_URL", ""),
        MAX_CONTENT_LENGTH=16384,
    )
    if overrides:
        app.config.update(overrides)
    chain_id = app.config["CHAIN_ID"]
    if chain_id != 11155111 and not (chain_id == 31337 and app.config["LOCAL_DEVELOPMENT"]):
        raise ValueError("MicroInvest supports Sepolia, or explicit local development only.")
    if not 1 <= app.config["LOG_CHUNK_SIZE"] <= 1000 or not 1 <= app.config["HISTORY_PAGE_BLOCKS"] <= 10000:
        raise ValueError("Invalid history query limits.")
    manifest_path = ROOT / "deployments" / ("localhost.json" if chain_id == 31337 else "sepolia.json")
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    configured_address = app.config["CONTRACT_ADDRESS"] or manifest.get("address", "")
    deployment_block = app.config["DEPLOYMENT_BLOCK"]
    if deployment_block == "":
        deployment_block = manifest.get("deploymentBlock")
    deployment_block = int(deployment_block) if deployment_block is not None else None
    if deployment_block is not None and deployment_block < 0:
        raise ValueError("DEPLOYMENT_BLOCK must not be negative.")
    if configured_address:
        configured_address = address(configured_address)
        if int(configured_address, 16) == 0:
            raise ValueError("CONTRACT_ADDRESS cannot be zero.")
    artifact_path = ROOT / "contract" / "MicroInvest.json"
    artifact = json.loads(artifact_path.read_text()) if artifact_path.exists() else None
    settings = Settings(chain_id, app.config["RPC_URL"], configured_address, deployment_block,
                        app.config["RPC_TIMEOUT"], app.config["LOG_CHUNK_SIZE"], app.config["HISTORY_PAGE_BLOCKS"])
    chain = service or (ChainService(settings, artifact) if artifact else None)
    app.extensions["chain"] = chain
    ready = bool(configured_address and deployment_block is not None and settings.rpc_url and artifact)
    database_url = app.config["DATABASE_URL"]
    if app.config.get("TESTING") and "DATABASE_URL" not in (overrides or {}):
        database_url = "sqlite://"
    if os.getenv("RENDER", "").lower() == "true" and not app.config.get("TESTING"):
        if not database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
            raise RuntimeError("Set DATABASE_URL to a persistent PostgreSQL database on Render.")
    if not database_url:
        if not app.config.get("TESTING"):
            (ROOT / "instance").mkdir(exist_ok=True)
        database_url = "sqlite:///" + (ROOT / "instance" / "catalog.sqlite3").as_posix()
    try:
        catalog = Catalog(database_url)
        if configured_address and deployment_block is not None:
            is_manifest = configured_address.lower() == manifest.get("address", "").lower()
            catalog.seed({"address": configured_address, "deploymentBlock": deployment_block,
                          "transactionHash": manifest.get("transactionHash") if is_manifest else None,
                          "deployer": manifest.get("deployer") if is_manifest else None}, chain_id)
    except (SQLAlchemyError, ValueError):
        raise RuntimeError("The investment database could not be initialized. Check DATABASE_URL and connectivity.") from None
    app.extensions["catalog"] = catalog

    def selected_investment():
        value = request.args.get("investment")
        if value is None:
            return None
        if not value.isascii() or not value.isdigit() or not 1 <= int(value) <= 2147483647:
            raise ApiError("invalid_investment", "Select a valid investment ID.")
        return catalog.get(int(value), chain_id)

    def selected_chain():
        project = selected_investment()
        return chain.for_pool(project["contractAddress"], project["deploymentBlock"]) if project else chain

    def chain_route(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            if chain is None:
                raise ApiError("artifact_missing", "The contract artifact is missing. Run the compile command.", 503)
            try:
                return jsonify(function(*args, **kwargs))
            except (ApiError, HTTPException):
                raise
            except SQLAlchemyError:
                raise
            except Exception as error:
                # Provider exception strings can contain an API key: never return or log them.
                app.logger.warning("Chain request failed: %s", type(error).__name__)
                raise ApiError("rpc_unavailable", "The blockchain query could not be completed. Please retry.", 503) from None
        return wrapper

    @app.get("/")
    def index():
        return render_template("explore.html")

    @app.get("/investments/<int:project_id>")
    def investment_page(project_id):
        return render_template("index.html", investment=catalog.get(project_id, chain_id))

    @app.get("/investments/<int:project_id>/activity")
    def investment_activity(project_id):
        return render_template("activity.html", investment=catalog.get(project_id, chain_id))

    @app.get("/activity")
    def activity_page():
        return render_template("activity.html", investment=None)

    @app.get("/deploy")
    def deployment_page():
        return render_template("deploy.html")

    @app.get("/healthz")
    def health():
        return jsonify(status="ok", app="MicroInvest", configured=ready)

    @app.get("/api/config")
    def config():
        project = selected_investment()
        pool_address = project["contractAddress"] if project else configured_address
        pool_block = project["deploymentBlock"] if project else deployment_block
        return jsonify(
            appName="MicroInvest", chainId=chain_id, chainName="Sepolia" if chain_id == 11155111 else "Local Hardhat",
            chainHex=hex(chain_id), contractAddress=pool_address,
            deploymentBlock=pool_block, configured=bool(pool_address and pool_block is not None and settings.rpc_url and artifact),
            deploymentReady=bool(settings.rpc_url and artifact), investment=project,
            explorerUrl="https://sepolia.etherscan.io" if chain_id == 11155111 else None,
            abi=artifact["abi"] if artifact else [],
        )

    @app.get("/api/artifact")
    def public_artifact():
        if artifact is None:
            raise ApiError("artifact_missing", "Run the contract compile command first.", 503)
        return jsonify(artifact)

    @app.get("/api/pool")
    @chain_route
    def pool():
        return selected_chain().pool()

    @app.get("/api/position/<wallet>")
    @chain_route
    def position(wallet):
        return selected_chain().position(wallet)

    @app.get("/api/history/<wallet>")
    @chain_route
    def history(wallet):
        try:
            limit = int(request.args.get("limit", "20"))
        except ValueError:
            raise ApiError("invalid_limit", "History limit must be an integer.") from None
        return selected_chain().history(wallet, request.args.get("cursor"), limit)

    @app.get("/api/transactions/<value>")
    @chain_route
    def transaction(value):
        return selected_chain().transaction(value)

    @app.get("/api/investments")
    def investments():
        try:
            page = int(request.args.get("page", "1"))
            limit = int(request.args.get("limit", "12"))
        except ValueError:
            raise ApiError("invalid_search", "Page and limit must be integers.") from None
        return jsonify(catalog.search(request.args.get("q", ""), chain_id, page, limit,
                                      request.args.get("creator")))

    @app.get("/api/investments/<int:project_id>")
    def investment(project_id):
        return jsonify(catalog.get(project_id, chain_id))

    @app.post("/api/investments/registration-message")
    def project_message():
        data = request.get_json()
        return jsonify(message=registration_message(data, chain_id, request.host_url.rstrip("/")))

    @app.post("/api/investments")
    @chain_route
    def register_investment():
        data = request.get_json()
        normalized = metadata_input(data)
        signer = registration_signer(data, chain_id, request.host_url.rstrip("/"))
        deployment = chain.deployment(normalized["transactionHash"])
        if signer.lower() != deployment["deployer"].lower():
            raise ApiError("not_deployer", "Only the wallet that deployed this contract can register it.", 403)
        return catalog.add(normalized, deployment, chain_id)

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        app.logger.warning("Catalog request failed: %s", type(error).__name__)
        return jsonify(error={"code": "catalog_unavailable", "message": "The investment directory is unavailable. Please retry."}), 503

    @app.errorhandler(ApiError)
    def api_error(error):
        return jsonify(error={"code": error.code, "message": error.message}), error.status

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith("/api/"):
            return jsonify(error={"code": "http_error", "message": error.description}), error.code
        return error

    @app.after_request
    def response_headers(response):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    return app


app = create_app()
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
