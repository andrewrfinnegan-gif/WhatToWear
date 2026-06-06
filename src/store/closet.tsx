/**
 * Closet state: a Context-backed store persisted to AsyncStorage, with optional
 * cloud sync when the user is signed in.
 *
 * - Holds the full item list (including soft-delete tombstones) in memory for
 *   instant filtering; `items` exposes only live (non-deleted) items.
 * - Every mutation stamps `updatedAt` and write-through persists locally.
 * - When authenticated, changes are pushed and remote changes pulled via a
 *   delta sync using last-write-wins on `updatedAt`. Works offline; syncs on
 *   sign-in and after each mutation (debounced).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { syncCloset, type SyncItem } from '@/api/closet';
import { useAuth } from '@/store/auth';
import { SEED_ITEMS } from '@/store/seed';
import type { ClothingItem } from '@/types';

const STORAGE_KEY = 'whattowear/closet/v1';
const SEEDED_KEY = 'whattowear/seeded/v1';
const LASTSYNC_KEY = 'whattowear/lastSync/v1';

interface ClosetContextValue {
  items: ClothingItem[];
  loading: boolean;
  syncing: boolean;
  addItem: (
    item: Omit<ClothingItem, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<ClothingItem, 'id' | 'createdAt' | 'updatedAt'>>,
  ) => ClothingItem;
  updateItem: (id: string, patch: Partial<ClothingItem>) => void;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  markWorn: (ids: string[]) => void;
  getItem: (id: string) => ClothingItem | undefined;
  syncNow: () => Promise<void>;
}

const ClosetContext = createContext<ClosetContextValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ClosetProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  // `all` includes tombstones; `items` (exposed) filters them out.
  const [all, setAll] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Refs to avoid stale closures inside async sync and debounce timers.
  const allRef = useRef<ClothingItem[]>([]);
  const lastSyncRef = useRef(0);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlight = useRef(false);

  const commit = useCallback((next: ClothingItem[]) => {
    allRef.current = next;
    setAll(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Hydrate from disk (seeding once on first ever launch).
  useEffect(() => {
    (async () => {
      try {
        const [rawItems, seeded, rawLastSync] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SEEDED_KEY),
          AsyncStorage.getItem(LASTSYNC_KEY),
        ]);
        lastSyncRef.current = rawLastSync ? Number(rawLastSync) : 0;
        if (rawItems) {
          const parsed = JSON.parse(rawItems) as ClothingItem[];
          allRef.current = parsed;
          setAll(parsed);
        } else if (!seeded) {
          allRef.current = SEED_ITEMS;
          setAll(SEED_ITEMS);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ITEMS));
          await AsyncStorage.setItem(SEEDED_KEY, '1');
        }
      } catch {
        allRef.current = [];
        setAll([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Merge a remote item into the local set using last-write-wins. */
  const mergeRemote = useCallback(
    (remote: SyncItem[]) => {
      if (remote.length === 0) return;
      const map = new Map(allRef.current.map((i) => [i.id, i]));
      for (const r of remote) {
        const local = map.get(r.id);
        if (!local || r.updatedAt >= local.updatedAt) {
          map.set(r.id, { ...r.data, id: r.id, updatedAt: r.updatedAt, deleted: r.deleted });
        }
      }
      commit(Array.from(map.values()));
    },
    [commit],
  );

  const syncNow = useCallback(async () => {
    if (status !== 'authed' || syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const since = lastSyncRef.current;
      const changed: SyncItem[] = allRef.current
        .filter((i) => i.updatedAt > since)
        .map((i) => ({ id: i.id, updatedAt: i.updatedAt, deleted: !!i.deleted, data: i }));
      const res = await syncCloset(since, changed);
      mergeRemote(res.items);
      lastSyncRef.current = res.serverTime;
      await AsyncStorage.setItem(LASTSYNC_KEY, String(res.serverTime));
    } catch {
      // Offline or transient error; will retry on next mutation/sign-in.
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [status, mergeRemote]);

  /** Push local changes shortly after a mutation, coalescing rapid edits. */
  const scheduleSync = useCallback(() => {
    if (status !== 'authed') return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncNow();
    }, 800);
  }, [status, syncNow]);

  // Sync when the user signs in (or on first authed load).
  useEffect(() => {
    if (status === 'authed' && !loading) syncNow();
  }, [status, loading, syncNow]);

  const mutate = useCallback(
    (next: ClothingItem[]) => {
      commit(next);
      scheduleSync();
    },
    [commit, scheduleSync],
  );

  const addItem = useCallback<ClosetContextValue['addItem']>(
    (item) => {
      const now = Date.now();
      const full: ClothingItem = {
        ...item,
        id: item.id ?? makeId(),
        createdAt: item.createdAt ?? now,
        updatedAt: now,
      };
      mutate([full, ...allRef.current]);
      return full;
    },
    [mutate],
  );

  const updateItem = useCallback<ClosetContextValue['updateItem']>(
    (id, patch) => {
      const now = Date.now();
      mutate(allRef.current.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now } : i)));
    },
    [mutate],
  );

  // Soft-delete so the deletion syncs as a tombstone.
  const removeItem = useCallback<ClosetContextValue['removeItem']>(
    (id) => {
      const now = Date.now();
      mutate(allRef.current.map((i) => (i.id === id ? { ...i, deleted: true, updatedAt: now } : i)));
    },
    [mutate],
  );

  const toggleFavorite = useCallback<ClosetContextValue['toggleFavorite']>(
    (id) => {
      const now = Date.now();
      mutate(
        allRef.current.map((i) => (i.id === id ? { ...i, favorite: !i.favorite, updatedAt: now } : i)),
      );
    },
    [mutate],
  );

  const markWorn = useCallback<ClosetContextValue['markWorn']>(
    (ids) => {
      const now = Date.now();
      const idSet = new Set(ids);
      mutate(
        allRef.current.map((i) => (idSet.has(i.id) ? { ...i, lastWornAt: now, updatedAt: now } : i)),
      );
    },
    [mutate],
  );

  // Live (non-deleted) items, newest first.
  const items = useMemo(() => all.filter((i) => !i.deleted), [all]);

  const getItem = useCallback<ClosetContextValue['getItem']>(
    (id) => items.find((i) => i.id === id),
    [items],
  );

  const value = useMemo<ClosetContextValue>(
    () => ({
      items,
      loading,
      syncing,
      addItem,
      updateItem,
      removeItem,
      toggleFavorite,
      markWorn,
      getItem,
      syncNow,
    }),
    [items, loading, syncing, addItem, updateItem, removeItem, toggleFavorite, markWorn, getItem, syncNow],
  );

  return <ClosetContext.Provider value={value}>{children}</ClosetContext.Provider>;
}

export function useCloset(): ClosetContextValue {
  const ctx = useContext(ClosetContext);
  if (!ctx) throw new Error('useCloset must be used within a ClosetProvider');
  return ctx;
}

export { STORAGE_KEY, SEEDED_KEY, LASTSYNC_KEY };
