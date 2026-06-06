/**
 * Purchases — real purchase integration. Detected clothing purchases (from
 * forwarded receipts, the inbound-email webhook, or a connected Gmail inbox)
 * appear here; one tap infers attributes and files them into the closet.
 *
 * Requires a backend + sign-in (purchases live in your account). Offline/guest
 * users see a prompt to connect.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState } from '@/components/ui';
import { ApiError } from '@/api/client';
import {
  dismissPurchase,
  gmailAuthUrl,
  gmailStatus,
  gmailSync,
  importPurchase,
  listPurchases,
  parseReceipt,
  type Purchase,
} from '@/api/purchases';
import { isApiConfigured } from '@/config';
import { inferFromPurchase } from '@/services/purchases';
import { useAuth } from '@/store/auth';
import { useCloset } from '@/store/closet';
import { colors, font, radius, space } from '@/theme';

export default function PurchasesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, user } = useAuth();
  const { addItem } = useCloset();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasting, setPasting] = useState(false);

  const [gmail, setGmail] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== 'authed') return;
    setLoading(true);
    setError(null);
    try {
      const [{ purchases: list }, gm] = await Promise.all([
        listPurchases('pending'),
        gmailStatus().catch(() => null),
      ]);
      setPurchases(list);
      setGmail(gm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load purchases');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onImport = async (p: Purchase) => {
    setBusyId(p.id);
    try {
      const inferred = await inferFromPurchase({ title: p.title, brand: p.brand });
      addItem({ ...inferred, imageUri: p.imageUri ?? undefined, source: 'purchase' });
      await importPurchase(p.id);
      setPurchases((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setBusyId(null);
    }
  };

  const onDismiss = async (p: Purchase) => {
    setBusyId(p.id);
    try {
      await dismissPurchase(p.id);
      setPurchases((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  const onPaste = async () => {
    if (!pasteText.trim()) return;
    setPasting(true);
    setError(null);
    try {
      const looksHtml = /<[a-z][\s\S]*>/i.test(pasteText);
      const res = await parseReceipt(looksHtml ? { html: pasteText } : { text: pasteText });
      setPurchases(res.purchases);
      setPasteText('');
      setPasteOpen(false);
      if (res.inserted === 0) setError('No new clothing items found in that receipt.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not parse that receipt');
    } finally {
      setPasting(false);
    }
  };

  const onConnectGmail = async () => {
    setGmailBusy(true);
    try {
      const { url } = await gmailAuthUrl();
      await Linking.openURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start Gmail connect');
    } finally {
      setGmailBusy(false);
    }
  };

  const onSyncGmail = async () => {
    setGmailBusy(true);
    setError(null);
    try {
      const { inserted } = await gmailSync();
      await refresh();
      if (inserted === 0) setError('No new clothing purchases found in your inbox.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gmail sync failed');
    } finally {
      setGmailBusy(false);
    }
  };

  // --- Gated states ---------------------------------------------------------
  if (!isApiConfigured()) {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Purchases need a backend"
          subtitle="Set EXPO_PUBLIC_API_URL and sign in to auto-fill your closet from purchases."
        />
      </View>
    );
  }
  if (status !== 'authed') {
    return (
      <View style={styles.gate}>
        <EmptyState
          icon="person-circle-outline"
          title="Sign in to auto-fill your closet"
          subtitle="Connect your account to import clothing purchases automatically."
          action={<Button label="Go to Account" icon="arrow-forward" onPress={() => router.push('/account')} />}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
    >
      <View style={styles.hero}>
        <Ionicons name="sparkles" size={20} color={colors.accent} />
        <Text style={font.h3}>Auto-fill your closet</Text>
        <Text style={[font.bodyMuted, styles.heroText]}>
          Clothing you buy shows up here. Import in one tap — we infer the type, colors, and how
          dressy it is, so you skip the photo and the typing.
        </Text>

        {user?.ingestAddress ? (
          <View style={styles.addrBox}>
            <Text style={font.caption}>Forward order emails to:</Text>
            <Text style={styles.addr} selectable>
              {user.ingestAddress}
            </Text>
          </View>
        ) : (
          <Text style={[font.caption, { marginTop: space.sm }]}>
            Forwarding address appears once the server sets an ingest domain.
          </Text>
        )}
      </View>

      {/* Connect inbox */}
      {gmail?.configured ? (
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name="mail" size={20} color={colors.accent} />
          </View>
          <View style={styles.info}>
            <Text style={font.label}>{gmail.connected ? 'Gmail connected' : 'Connect Gmail'}</Text>
            <Text style={font.caption}>
              {gmail.connected ? 'Scan your inbox for new orders' : 'Auto-detect order emails'}
            </Text>
          </View>
          <Button
            label={gmail.connected ? 'Sync' : 'Connect'}
            icon={gmail.connected ? 'refresh' : 'link'}
            variant="secondary"
            loading={gmailBusy}
            onPress={gmail.connected ? onSyncGmail : onConnectGmail}
          />
        </View>
      ) : null}

      {/* Paste a receipt */}
      {pasteOpen ? (
        <View style={styles.pasteCard}>
          <Text style={font.label}>Paste a receipt</Text>
          <Text style={font.caption}>Paste the text or HTML of an order confirmation email.</Text>
          <TextInput
            style={styles.pasteInput}
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="Paste receipt contents…"
            placeholderTextColor={colors.textFaint}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.pasteActions}>
            <Button label="Cancel" variant="ghost" onPress={() => setPasteOpen(false)} style={styles.flex} />
            <Button label="Parse" icon="search" loading={pasting} onPress={onPaste} style={styles.flex} />
          </View>
        </View>
      ) : (
        <Button label="Paste a receipt" icon="clipboard-outline" variant="secondary" onPress={() => setPasteOpen(true)} />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.listHeader}>
        <Text style={styles.section}>Pending ({purchases.length})</Text>
        <Button label="Refresh" icon="refresh" variant="ghost" onPress={refresh} loading={loading} />
      </View>

      {purchases.length === 0 && !loading ? (
        <EmptyState
          icon="bag-handle-outline"
          title="No pending purchases"
          subtitle="Forward an order email, paste a receipt, or connect your inbox to see purchases here."
        />
      ) : (
        purchases.map((p) => {
          const busy = busyId === p.id;
          return (
            <View key={p.id} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="bag-handle" size={20} color={colors.textMuted} />
              </View>
              <View style={styles.info}>
                <Text style={font.label} numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={font.caption}>
                  {[p.retailer ?? p.brand, p.price != null ? `${p.currency ?? ''} ${p.price.toFixed(2)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                  {p.source !== 'manual' ? `  ·  ${p.source}` : ''}
                </Text>
              </View>
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <View style={styles.rowActions}>
                  <Button label="" icon="close" variant="ghost" onPress={() => onDismiss(p)} style={styles.iconBtn} />
                  <Button label="Add" icon="add" variant="secondary" onPress={() => onImport(p)} />
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={15} color={colors.textFaint} />
        <Text style={styles.footerText}>
          Note: Apple/Google Pay don&apos;t expose what you bought, so WhatToWear reads order emails
          (forward, inbound webhook, or Gmail) to detect the actual garments.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  gate: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
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
  addrBox: {
    marginTop: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  addr: { ...font.label, color: colors.accent },
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  iconBtn: { paddingHorizontal: space.sm },
  pasteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  pasteInput: {
    minHeight: 120,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
    color: colors.text,
    fontSize: 14,
  },
  pasteActions: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  error: { ...font.caption, color: colors.danger },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  section: { ...font.caption, textTransform: 'uppercase', letterSpacing: 0.6 },
  footer: { flexDirection: 'row', gap: space.sm, marginTop: space.md, paddingHorizontal: space.xs },
  footerText: { ...font.caption, flex: 1, color: colors.textFaint, lineHeight: 17 },
});
