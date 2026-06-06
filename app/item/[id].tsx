/**
 * Item detail — large preview, attributes, and actions (favorite, delete).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GarmentThumb } from '@/components/GarmentThumb';
import { Button } from '@/components/ui';
import { useCloset } from '@/store/closet';
import { colors, font, radius, space } from '@/theme';
import { OCCASIONS } from '@/types';
import { colorToHex } from '@/utils/colorMap';

const FORMALITY_LABELS = ['', 'Very casual', 'Casual', 'Smart', 'Dressy', 'Black tie'];
const WARMTH_LABELS = ['', 'Very light', 'Light', 'Medium', 'Warm', 'Heavy'];

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getItem, toggleFavorite, removeItem } = useCloset();

  const item = id ? getItem(id) : undefined;

  if (!item) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={font.bodyMuted}>Item not found.</Text>
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert('Remove item', `Remove "${item.name}" from your closet?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeItem(item.id);
          router.back();
        },
      },
    ]);
  };

  const occasionLabels = item.occasions
    .map((o) => OCCASIONS.find((x) => x.id === o)?.label ?? o)
    .join(', ');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
    >
      <View style={styles.hero}>
        <GarmentThumb item={item} size={220} rounded="xl" />
      </View>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={font.h2}>{item.name}</Text>
          <Text style={[font.bodyMuted, { textTransform: 'capitalize' }]}>
            {item.subtype ? `${item.subtype} · ` : ''}
            {item.category}
            {item.brand ? ` · ${item.brand}` : ''}
          </Text>
        </View>
        <Button
          label=""
          icon={item.favorite ? 'heart' : 'heart-outline'}
          variant="secondary"
          onPress={() => toggleFavorite(item.id)}
          style={styles.heartBtn}
        />
      </View>

      {item.colors.length ? (
        <View style={styles.swatches}>
          {item.colors.map((c) => (
            <View key={c} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: colorToHex(c) }]} />
              <Text style={[font.caption, { textTransform: 'capitalize' }]}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.statsCard}>
        <Stat label="Formality" value={FORMALITY_LABELS[item.formality]} icon="sparkles-outline" />
        <View style={styles.divider} />
        <Stat label="Warmth" value={WARMTH_LABELS[item.warmth]} icon="thermometer-outline" />
        <View style={styles.divider} />
        <Stat label="Good for" value={occasionLabels} icon="calendar-outline" />
        {item.source === 'purchase' ? (
          <>
            <View style={styles.divider} />
            <Stat label="Source" value="Imported from purchase" icon="bag-handle-outline" />
          </>
        ) : null}
      </View>

      <Button label="Remove from closet" icon="trash-outline" variant="ghost" onPress={confirmDelete} />
    </ScrollView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', paddingVertical: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heartBtn: { paddingHorizontal: space.md },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  statLabel: { ...font.bodyMuted, width: 90 },
  statValue: { ...font.label, flex: 1, textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: colors.border },
});
