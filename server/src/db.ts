/**
 * SQLite persistence via better-sqlite3 (synchronous, fast, zero-config).
 *
 * Tables: `users`, `items` (closet), `purchases` (detected purchases awaiting
 * import), and `integrations` (per-user provider tokens, e.g. Gmail). Items and
 * purchases keep their flexible bits as columns so the schemas can evolve.
 *
 * To move to Postgres later, swap this module for a pg-backed implementation
 * exposing the same query helpers.
 */
import Database from 'better-sqlite3';

import { config } from './config';

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    ingest_alias  TEXT UNIQUE,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id         TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_items_user_updated
    ON items (user_id, updated_at);

  CREATE TABLE IF NOT EXISTS purchases (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    retailer     TEXT,
    brand        TEXT,
    title        TEXT NOT NULL,
    price        REAL,
    currency     TEXT,
    image_uri    TEXT,
    source       TEXT NOT NULL,            -- 'manual' | 'email' | 'gmail'
    status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'imported' | 'dismissed'
    external_id  TEXT,                      -- dedupe key
    purchased_at INTEGER,
    created_at   INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_user_status
    ON purchases (user_id, status);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_dedupe
    ON purchases (user_id, external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS integrations (
    user_id       TEXT NOT NULL,
    provider      TEXT NOT NULL,            -- 'gmail'
    access_token  TEXT,
    refresh_token TEXT,
    expires_at    INTEGER,
    last_sync_at  INTEGER,
    PRIMARY KEY (user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// --- Lightweight migration for databases created before ingest_alias existed.
const userCols = (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map((c) => c.name);
if (!userCols.includes('ingest_alias')) {
  db.exec('ALTER TABLE users ADD COLUMN ingest_alias TEXT');
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  ingest_alias: string | null;
  created_at: number;
}

export interface ItemRow {
  id: string;
  user_id: string;
  data: string;
  updated_at: number;
  deleted: number;
}

export interface PurchaseRow {
  id: string;
  user_id: string;
  retailer: string | null;
  brand: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  image_uri: string | null;
  source: string;
  status: string;
  external_id: string | null;
  purchased_at: number | null;
  created_at: number;
}

export interface IntegrationRow {
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  last_sync_at: number | null;
}
