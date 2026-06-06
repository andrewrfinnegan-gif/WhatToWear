/**
 * A recommended outfit: a horizontal strip of its garments, the stylist
 * rationale, a fit score, and a "Wear this" action that records the choice.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GarmentThumb } from '@/components/GarmentThumb';
import type { Outfit } from '@/types';
import { colors, font, radius, shadow, space } from '@/theme';

interface Props {
  outfit: Outfit;
  onWear?: () => void;
  onPressItem?: (id: string) => void;
}

export function OutfitCard({ outfit, onWear, onPressItem }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons
            name={outfit.aiGenerated ? 'sparkles' : 'options'}
            size={12}
            color={outfit.aiGenerated ? colors.accent : colors.textMuted}
          />
          <Text style={styles.badgeText}>
            {outfit.aiGenerated ? 'Stylist pick' : 'Smart match'}
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreText}>{outfit.score}</Text>
          <Text style={styles.scoreLabel}>fit</Text>
        </View>
      </View>

      <View style={styles.strip}>
        {outfit.items.map((item) => (
          <Pressable key={item.id} onPress={() => onPressItem?.(item.id)}>
            <GarmentThumb item={item} size={72} rounded="md" />
          </Pressable>
        ))}
      </View>

      <Text style={styles.rationale}>{outfit.rationale}</Text>

      <Pressable style={styles.wearBtn} onPress={onWear}>
        <Ionicons name="checkmark-circle" size={18} color={colors.bg} />
        <Text style={styles.wearText}>Wear this</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
    ...shadow.card,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  badgeText: { ...font.caption, color: colors.text },
  score: { alignItems: 'center' },
  scoreText: { fontSize: 20, fontWeight: '800', color: colors.success },
  scoreLabel: { ...font.caption, marginTop: -2 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rationale: { ...font.bodyMuted, lineHeight: 21 },
  wearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.accent,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  wearText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
});
