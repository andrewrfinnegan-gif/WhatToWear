/**
 * Horizontal selector for the setting the user is dressing for.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { Occasion } from '@/types';
import { OCCASIONS } from '@/types';
import { colors, font, radius, space } from '@/theme';

interface Props {
  value: Occasion;
  onChange: (o: Occasion) => void;
}

export function OccasionPicker({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {OCCASIONS.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Ionicons
              name={o.icon as keyof typeof Ionicons.glyphMap}
              size={15}
              color={active ? colors.bg : colors.textMuted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { ...font.label, color: colors.textMuted },
  labelActive: { color: colors.bg },
});
