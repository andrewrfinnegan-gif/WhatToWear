/** Closet sync API calls. */
import { apiFetch } from '@/api/client';
import type { ClothingItem } from '@/types';

/** Wire format for a synced item: sync metadata + the opaque item payload. */
export interface SyncItem {
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: ClothingItem;
}

export interface SyncResponse {
  items: SyncItem[];
  serverTime: number;
}

export function syncCloset(since: number, items: SyncItem[]) {
  return apiFetch<SyncResponse>('/closet/sync', {
    method: 'POST',
    body: { since, items },
  });
}
