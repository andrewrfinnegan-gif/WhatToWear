/**
 * Closet state: a Context-backed store persisted to AsyncStorage.
 *
 * Keeps the full item list in memory for instant filtering/recommendation and
 * writes through to disk on every mutation. Seeds a small starter wardrobe on
 * first launch so the recommendation flow is demonstrable immediately.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ClothingItem } from '@/types';
import { SEED_ITEMS } from '@/store/seed';

const STORAGE_KEY = 'whattowear/closet/v1';
const SEEDED_KEY = 'whattowear/seeded/v1';

interface ClosetContextValue {
  items: ClothingItem[];
  loading: boolean;
  addItem: (item: Omit<ClothingItem, 'id' | 'createdAt'> & Partial<Pick<ClothingItem, 'id' | 'createdAt'>>) => ClothingItem;
  updateItem: (id: string, patch: Partial<ClothingItem>) => void;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  markWorn: (ids: string[]) => void;
  getItem: (id: string) => ClothingItem | undefined;
}

const ClosetContext = createContext<ClosetContextValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ClosetProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Hydrate from disk (seeding once on first ever launch).
  useEffect(() => {
    (async () => {
      try {
        const [rawItems, seeded] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SEEDED_KEY),
        ]);
        if (rawItems) {
          setItems(JSON.parse(rawItems) as ClothingItem[]);
        } else if (!seeded) {
          setItems(SEED_ITEMS);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ITEMS));
          await AsyncStorage.setItem(SEEDED_KEY, '1');
        }
      } catch {
        // Corrupt storage shouldn't brick the app; start empty.
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Write-through persistence whenever items change (after initial load).
  const persist = useCallback((next: ClothingItem[]) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addItem = useCallback<ClosetContextValue['addItem']>(
    (item) => {
      const full: ClothingItem = {
        ...item,
        id: item.id ?? makeId(),
        createdAt: item.createdAt ?? Date.now(),
      };
      setItems((prev) => {
        const next = [full, ...prev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return full;
    },
    [],
  );

  const updateItem = useCallback<ClosetContextValue['updateItem']>((id, patch) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeItem = useCallback<ClosetContextValue['removeItem']>((id) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleFavorite = useCallback<ClosetContextValue['toggleFavorite']>((id) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const markWorn = useCallback<ClosetContextValue['markWorn']>((ids) => {
    const now = Date.now();
    const idSet = new Set(ids);
    setItems((prev) => {
      const next = prev.map((i) => (idSet.has(i.id) ? { ...i, lastWornAt: now } : i));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getItem = useCallback<ClosetContextValue['getItem']>(
    (id) => items.find((i) => i.id === id),
    [items],
  );

  const value = useMemo<ClosetContextValue>(
    () => ({
      items,
      loading,
      addItem,
      updateItem,
      removeItem,
      toggleFavorite,
      markWorn,
      getItem,
    }),
    [items, loading, addItem, updateItem, removeItem, toggleFavorite, markWorn, getItem],
  );

  return <ClosetContext.Provider value={value}>{children}</ClosetContext.Provider>;
}

export function useCloset(): ClosetContextValue {
  const ctx = useContext(ClosetContext);
  if (!ctx) throw new Error('useCloset must be used within a ClosetProvider');
  return ctx;
}

// Re-export so callers can clear data in a settings/dev flow if needed.
export { STORAGE_KEY, SEEDED_KEY };
