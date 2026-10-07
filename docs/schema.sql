-- PostgreSQL schema matching microinvest/catalog.py.
-- The application creates this table on first startup; do not run this twice.
-- Project metadata and confirmed-event index; custody and current share balances stay on-chain.
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

-- Confirmed chain events, indexed separately from project names and balances.
CREATE TABLE history_events (
    chain_id INTEGER NOT NULL,
    address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,
    wallet VARCHAR(42) NOT NULL,
    block_number INTEGER NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    event_type VARCHAR(12) NOT NULL,
    amount_wei TEXT NOT NULL,
    shares_after TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (chain_id, address, transaction_hash, log_index)
);
CREATE INDEX ix_history_wallet_block ON history_events
    (chain_id, address, wallet, block_number, log_index);

-- Persist scanned ranges/checkpoints, including empty ranges, across restarts.
CREATE TABLE history_ranges (
    chain_id INTEGER NOT NULL,
    address VARCHAR(42) NOT NULL,
    wallet VARCHAR(42) NOT NULL,
    start_block INTEGER NOT NULL,
    end_block INTEGER NOT NULL,
    end_hash VARCHAR(66) NOT NULL,
    PRIMARY KEY (chain_id, address, wallet, start_block, end_block)
);
