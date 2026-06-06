/**
 * Closet — a responsive grid of all garments with a category filter. The "+"
 * routes to the add-item flow (photo → auto-tag), the core onboarding action.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemCard } from '@/components/ItemCard';
import { EmptyState } from '@/components/ui';
import { Button } from '@/components/ui';
import { useCloset } from '@/store/closet';
import { colors, font, radius, shadow, space } from '@/theme';
import type { Category } from '@/types';
import { CATEGORIES } from '@/types';

type Filter = 'all' | Category;

export default function ClosetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, loading } = useCloset();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');

  const numColumns = width >= 700 ? 3 : 2;
  const gap = space.md;
  const horizontalPadding = space.lg;
  const cardWidth = (width - horizontalPadding * 2 - gap * (numColumns - 1)) / numColumns;

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  const filters: Filter[] = ['all', ...CATEGORIES];

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((f) => {
            const active = f === filter;
            const count = f === 'all' ? items.length : items.filter((i) => i.category === f).length;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f}
                  {count > 0 ? `  ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {filtered.length === 0 && !loading ? (
        <EmptyState
          icon="grid-outline"
          title={filter === 'all' ? 'No clothes yet' : `No ${filter} items`}
          subtitle="Snap a photo of a garment and we'll auto-tag it for you."
          action={<Button label="Add clothing" icon="add" onPress={() => router.push('/add-item')} />}
        />
      ) : (
        <FlatList
          key={numColumns}
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap } : undefined}
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 96, gap },
          ]}
          renderItem={({ item }) => (
            <ItemCard item={item} width={cardWidth} onPress={() => router.push(`/item/${item.id}`)} />
          )}
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + space.lg }]}
        onPress={() => router.push('/add-item')}
      >
        <Ionicons name="add" size={28} color={colors.bg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterBar: { borderBottomWidth: 1, borderBottomColor: colors.border },
  filterRow: { gap: space.sm, padding: space.md, paddingHorizontal: space.lg },
  filterChip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  filterText: { ...font.label, color: colors.textMuted, textTransform: 'capitalize' },
  filterTextActive: { color: colors.text },
  list: { paddingTop: space.lg },
  fab: {
    position: 'absolute',
    right: space.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
});
