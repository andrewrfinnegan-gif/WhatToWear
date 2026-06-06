/**
 * Closet sync. The client and server exchange item deltas keyed by `updatedAt`.
 *
 *   POST /closet/sync  { since, items: SyncItem[] }
 *     -> applies incoming items with last-write-wins (an incoming change only
 *        overwrites if its updatedAt >= the stored one), then returns every
 *        server item changed since `since` so the client can merge.
 *
 *   GET /closet  -> full snapshot of non-deleted items (handy for fresh logins).
 *
 * Items are opaque JSON blobs to the server; only id/updatedAt/deleted matter
 * for sync, which keeps the wardrobe schema flexible.
 */
import { Router } from 'express';
import { z } from 'zod';

import { db, type ItemRow } from '../db';
import { requireAuth, type AuthedRequest } from '../auth/middleware';

export const closetRouter = Router();
closetRouter.use(requireAuth);

const syncItemSchema = z.object({
  id: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean().optional().default(false),
  data: z.record(z.string(), z.unknown()),
});

const syncSchema = z.object({
  since: z.number().int().nonnegative().optional().default(0),
  items: z.array(syncItemSchema).max(1000).optional().default([]),
});

type SyncItem = z.infer<typeof syncItemSchema>;

function rowToSyncItem(row: ItemRow): SyncItem {
  return {
    id: row.id,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
    data: JSON.parse(row.data) as Record<string, unknown>,
  };
}

closetRouter.post('/sync', (req: AuthedRequest, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid sync payload' });
    return;
  }
  const userId = req.userId!;
  const { since, items } = parsed.data;

  const getExisting = db.prepare('SELECT updated_at FROM items WHERE id = ? AND user_id = ?');
  const upsert = db.prepare(
    `INSERT INTO items (id, user_id, data, updated_at, deleted)
     VALUES (@id, @user_id, @data, @updated_at, @deleted)
     ON CONFLICT(id, user_id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at,
       deleted = excluded.deleted`,
  );

  // Apply all incoming changes atomically, honoring last-write-wins.
  const applyAll = db.transaction((incoming: SyncItem[]) => {
    for (const item of incoming) {
      const existing = getExisting.get(item.id, userId) as { updated_at: number } | undefined;
      if (existing && existing.updated_at > item.updatedAt) continue; // stored is newer
      upsert.run({
        id: item.id,
        user_id: userId,
        data: JSON.stringify(item.data),
        updated_at: item.updatedAt,
        deleted: item.deleted ? 1 : 0,
      });
    }
  });
  applyAll(items);

  // Return everything changed since the client's checkpoint (tombstones included).
  const changed = db
    .prepare('SELECT * FROM items WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC')
    .all(userId, since) as ItemRow[];

  res.json({ items: changed.map(rowToSyncItem), serverTime: Date.now() });
});

closetRouter.get('/', (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM items WHERE user_id = ? AND deleted = 0 ORDER BY updated_at DESC')
    .all(req.userId) as ItemRow[];
  res.json({ items: rows.map(rowToSyncItem), serverTime: Date.now() });
});
