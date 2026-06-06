/**
 * Small shared UI primitives: Button, EmptyState, SectionLabel, Stepper, and
 * ChipSelect (single/multi). Kept together to avoid a sprawl of tiny files.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, font, radius, space } from '@/theme';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const tint = isPrimary ? colors.bg : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        isGhost && styles.btnGhost,
        (disabled || loading) && styles.btnDisabled,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
          <Text style={[styles.btnText, { color: tint }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      </View>
      <Text style={font.h3}>{title}</Text>
      {subtitle ? <Text style={[font.bodyMuted, styles.emptySub]}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Stepper({
  value,
  min = 1,
  max = 5,
  onChange,
  labels,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  labels?: Record<number, string>;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Ionicons name="remove" size={18} color={value <= min ? colors.textFaint : colors.text} />
      </Pressable>
      <View style={styles.stepValue}>
        <Text style={styles.stepNum}>{value}</Text>
        {labels?.[value] ? <Text style={font.caption}>{labels[value]}</Text> : null}
      </View>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Ionicons name="add" size={18} color={value >= max ? colors.textFaint : colors.text} />
      </Pressable>
    </View>
  );
}

export function ChipSelect<T extends string>({
  options,
  selected,
  onToggle,
  multi,
}: {
  options: { id: T; label: string }[];
  selected: T[];
  onToggle: (id: T) => void;
  multi?: boolean;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const active = selected.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
      {multi ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnSecondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnGhost: { backgroundColor: 'transparent' },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnText: { fontWeight: '700', fontSize: 15 },

  empty: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptySub: { textAlign: 'center', maxWidth: 280 },

  section: { ...font.caption, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.sm },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: { padding: space.md },
  stepValue: { alignItems: 'center', minWidth: 64, paddingVertical: space.xs },
  stepNum: { fontSize: 18, fontWeight: '800', color: colors.text },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...font.label, color: colors.textMuted },
  chipTextActive: { color: colors.bg },
});
