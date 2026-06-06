/** Data access for detected purchases, plus ingestion from a parsed receipt. */
import { randomUUID } from 'node:crypto';

import { db, type PurchaseRow } from '../db';
import type { ParsedReceipt } from './parser';

export type PurchaseSource = 'manual' | 'email' | 'gmail';

export interface PublicPurchase {
  id: string;
  retailer: string | null;
  brand: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  imageUri: string | null;
  source: string;
  status: string;
  purchasedAt: number | null;
  createdAt: number;
}

export function toPublic(row: PurchaseRow): PublicPurchase {
  return {
    id: row.id,
    retailer: row.retailer,
    brand: row.brand,
    title: row.title,
    price: row.price,
    currency: row.currency,
    imageUri: row.image_uri,
    source: row.source,
    status: row.status,
    purchasedAt: row.purchased_at,
    createdAt: row.created_at,
  };
}

const insertStmt = db.prepare(
  `INSERT OR IGNORE INTO purchases
     (id, user_id, retailer, brand, title, price, currency, image_uri, source, status, external_id, purchased_at, created_at)
   VALUES
     (@id, @user_id, @retailer, @brand, @title, @price, @currency, @image_uri, @source, 'pending', @external_id, @purchased_at, @created_at)`,
);

/**
 * Insert all line items from a parsed receipt for a user. Returns the number of
 * newly-inserted purchases (duplicates are ignored via the dedupe index).
 */
export function ingestReceipt(userId: string, receipt: ParsedReceipt, source: PurchaseSource): number {
  const now = Date.now();
  const insertMany = db.transaction((items: ParsedReceipt['items']) => {
    let inserted = 0;
    for (const item of items) {
      const externalId = `${receipt.retailer ?? 'r'}|${receipt.orderId ?? ''}|${item.title}`.slice(0, 300);
      const result = insertStmt.run({
        id: randomUUID(),
        user_id: userId,
        retailer: receipt.retailer ?? null,
        brand: item.brand ?? receipt.retailer ?? null,
        title: item.title,
        price: item.price ?? null,
        currency: receipt.currency,
        image_uri: item.imageUri ?? null,
        source,
        external_id: externalId,
        purchased_at: receipt.purchasedAt,
        created_at: now,
      });
      inserted += result.changes;
    }
    return inserted;
  });
  return insertMany(receipt.items);
}

export function listPurchases(userId: string, status?: string): PublicPurchase[] {
  const rows = (
    status
      ? db
          .prepare('SELECT * FROM purchases WHERE user_id = ? AND status = ? ORDER BY purchased_at DESC, created_at DESC')
          .all(userId, status)
      : db
          .prepare('SELECT * FROM purchases WHERE user_id = ? ORDER BY purchased_at DESC, created_at DESC')
          .all(userId)
  ) as PurchaseRow[];
  return rows.map(toPublic);
}

export function setPurchaseStatus(userId: string, id: string, status: 'imported' | 'dismissed' | 'pending'): boolean {
  const result = db
    .prepare('UPDATE purchases SET status = ? WHERE id = ? AND user_id = ?')
    .run(status, id, userId);
  return result.changes > 0;
}
