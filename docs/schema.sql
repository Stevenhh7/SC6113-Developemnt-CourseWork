-- PostgreSQL schema matching microinvest/catalog.py.
-- The application creates this table on first startup; do not run this twice.
-- Project metadata only: funds, share balances and business events stay on-chain.
CREATE TABLE investments (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER NOT NULL,
    address VARCHAR(42) NOT NULL,
    deployment_block INTEGER NOT NULL,
    transaction_hash VARCHAR(66),
    creator VARCHAR(42),
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    search_text TEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    UNIQUE (chain_id, address),
    UNIQUE (chain_id, transaction_hash)
);
