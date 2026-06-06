/**
 * Grid card for a single closet item: thumbnail, name, and a small meta row.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GarmentThumb } from '@/components/GarmentThumb';
import type { ClothingItem } from '@/types';
import { colors, font, radius, space } from '@/theme';

interface Props {
  item: ClothingItem;
  width: number;
  onPress?: () => void;
}

export function ItemCard({ item, width, onPress }: Props) {
  return (
    <Pressable style={[styles.card, { width }]} onPress={onPress}>
      <GarmentThumb item={item} size={width - space.md * 2} rounded="md" />
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.row}>
          <Text style={styles.sub} numberOfLines={1}>
            {item.category}
          </Text>
          {item.favorite ? (
            <Ionicons name="heart" size={13} color={colors.danger} />
          ) : null}
          {item.source === 'purchase' ? (
            <Ionicons name="bag-handle" size={13} color={colors.accent} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: { marginTop: space.sm, gap: 2 },
  name: { ...font.label },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sub: { ...font.caption, flex: 1, textTransform: 'capitalize' },
});
