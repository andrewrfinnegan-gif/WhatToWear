/**
 * SQLite persistence via better-sqlite3 (synchronous, fast, zero-config).
 *
 * Two tables: `users` and `items`. Items are stored as a JSON blob plus the
 * sync columns (updated_at, deleted) so the closet schema can evolve without
 * migrations while still supporting delta sync and soft-delete tombstones.
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
`);

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: number;
}

export interface ItemRow {
  id: string;
  user_id: string;
  data: string;
  updated_at: number;
  deleted: number;
}
