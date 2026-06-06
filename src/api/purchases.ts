/** Purchases + Gmail integration API calls. */
import { apiFetch } from '@/api/client';

export interface Purchase {
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

export function listPurchases(status: 'pending' | 'imported' | 'dismissed' = 'pending') {
  return apiFetch<{ purchases: Purchase[] }>(`/purchases?status=${status}`);
}

/** Manually paste/forward a receipt for parsing + storage. */
export function parseReceipt(input: { from?: string; subject?: string; text?: string; html?: string }) {
  return apiFetch<{ inserted: number; receipt: { items: number }; purchases: Purchase[] }>(
    '/purchases/parse',
    { method: 'POST', body: input },
  );
}

export function importPurchase(id: string) {
  return apiFetch<{ ok: true }>(`/purchases/${id}/import`, { method: 'POST' });
}

export function dismissPurchase(id: string) {
  return apiFetch<{ ok: true }>(`/purchases/${id}/dismiss`, { method: 'POST' });
}

// --- Gmail integration ---

export function gmailStatus() {
  return apiFetch<{ configured: boolean; connected: boolean; lastSyncAt?: number | null }>(
    '/integrations/gmail/status',
  );
}

export function gmailAuthUrl() {
  return apiFetch<{ url: string }>('/integrations/gmail/auth-url');
}

export function gmailSync() {
  return apiFetch<{ ok: true; scanned: number; inserted: number }>('/integrations/gmail/sync', {
    method: 'POST',
  });
}
