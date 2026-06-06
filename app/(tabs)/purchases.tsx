/**
 * Purchases — auto-populate the closet from phone purchases. Shows a feed of
 * recent purchases (mock standing in for a payments/receipts integration); one
 * tap infers garment attributes and files it into the closet, no photo or
 * manual entry required.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { inferFromPurchase, MOCK_PURCHASE_FEED, type PurchaseRecord } from '@/services/purchases';
import { useCloset } from '@/store/closet';
import { colors, font, radius, space } from '@/theme';

export default function PurchasesScreen() {
  const insets = useSafeAreaInsets();
  const { addItem, items } = useCloset();
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());

  const importPurchase = async (record: PurchaseRecord) => {
    setImporting(record.id);
    try {
      const inferred = await inferFromPurchase(record);
      addItem({
        ...inferred,
        imageUri: record.imageUri,
        source: 'purchase',
      });
      setImported((prev) => new Set(prev).add(record.id));
    } finally {
      setImporting(null);
    }
  };

  const purchaseCount = items.filter((i) => i.source === 'purchase').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
    >
      <View style={styles.hero}>
        <Ionicons name="sparkles" size={20} color={colors.accent} />
        <Text style={font.h3}>Auto-fill your closet</Text>
        <Text style={[font.bodyMuted, styles.heroText]}>
          New clothing purchases show up here. Import them in one tap — we infer the type, colors,
          and how dressy they are, so you skip the photo and the typing.
        </Text>
        {purchaseCount > 0 ? (
          <View style={styles.statPill}>
            <Text style={styles.statText}>{purchaseCount} imported from purchases</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.section}>Recent purchases</Text>

      {MOCK_PURCHASE_FEED.map((record) => {
        const done = imported.has(record.id);
        const busy = importing === record.id;
        return (
          <View key={record.id} style={styles.row}>
            <View style={styles.thumb}>
              <Ionicons name="bag-handle" size={22} color={colors.textMuted} />
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {record.title}
              </Text>
              <Text style={font.caption}>
                {record.retailer} · {record.currency} {record.price.toFixed(2)}
              </Text>
            </View>
            {done ? (
              <View style={styles.doneTag}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.doneText}>Added</Text>
              </View>
            ) : busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Button label="Import" icon="add" variant="secondary" onPress={() => importPurchase(record)} />
            )}
          </View>
        );
      })}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={15} color={colors.textFaint} />
        <Text style={styles.footerText}>
          In the full app this connects to Apple/Google Pay and retailer order emails to detect
          clothing automatically.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  heroText: { lineHeight: 21 },
  statPill: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  statText: { ...font.caption, color: colors.text },
  section: { ...font.caption, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { ...font.label },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  doneText: { ...font.caption, color: colors.success },
  footer: { flexDirection: 'row', gap: space.sm, marginTop: space.md, paddingHorizontal: space.xs },
  footerText: { ...font.caption, flex: 1, color: colors.textFaint, lineHeight: 17 },
});
