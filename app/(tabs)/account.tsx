/**
 * Account — sign in / sign up when signed out, profile + sync status when in.
 * Signing in unlocks cloud closet sync (across devices) and the AI stylist.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SectionLabel } from '@/components/ui';
import { ApiError } from '@/api/client';
import { isApiConfigured } from '@/config';
import { useAuth } from '@/store/auth';
import { useCloset } from '@/store/closet';
import { colors, font, radius, space } from '@/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { status, user, signIn, signUp, signOut } = useAuth();
  const { items, syncing, syncNow } = useCloset();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password, displayName || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const content = () => {
    if (!isApiConfigured()) {
      return (
        <View style={styles.card}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
          <Text style={font.h3}>Offline mode</Text>
          <Text style={[font.bodyMuted, styles.center]}>
            No backend is configured, so your closet stays on this device and outfits use the
            on-device engine. Set EXPO_PUBLIC_API_URL to enable accounts, cloud sync, and the AI
            stylist.
          </Text>
        </View>
      );
    }

    if (status === 'loading') {
      return (
        <View style={styles.card}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }

    if (status === 'authed' && user) {
      return (
        <View style={{ gap: space.lg }}>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={font.h3}>{user.displayName ?? 'Signed in'}</Text>
            <Text style={font.bodyMuted}>{user.email}</Text>
          </View>

          <View style={styles.statsRow}>
            <Stat label="Items" value={String(items.length)} />
            <View style={styles.vline} />
            <Stat label="Cloud sync" value="On" />
          </View>

          <Button
            label={syncing ? 'Syncing…' : 'Sync now'}
            icon="cloud-upload-outline"
            variant="secondary"
            loading={syncing}
            onPress={syncNow}
          />
          <Button label="Sign out" icon="log-out-outline" variant="ghost" onPress={signOut} />
        </View>
      );
    }

    // Guest: auth form.
    return (
      <View style={{ gap: space.lg }}>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, mode === 'login' && styles.toggleActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Sign in</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === 'signup' && styles.toggleActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
              Create account
            </Text>
          </Pressable>
        </View>

        {mode === 'signup' ? (
          <View style={styles.field}>
            <SectionLabel>Name</SectionLabel>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <SectionLabel>Email</SectionLabel>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View style={styles.field}>
          <SectionLabel>Password</SectionLabel>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={mode === 'login' ? 'Sign in' : 'Create account'}
          icon="arrow-forward"
          loading={busy}
          disabled={!email || !password}
          onPress={submit}
        />
        <Text style={styles.fine}>
          Signing in syncs your closet to the cloud and unlocks the AI stylist.
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {content()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={font.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingTop: space.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  center: { textAlign: 'center', lineHeight: 21 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: colors.text },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  vline: { width: 1, backgroundColor: colors.border },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xs,
  },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm },
  toggleActive: { backgroundColor: colors.accentSoft },
  toggleText: { ...font.label, color: colors.textMuted },
  toggleTextActive: { color: colors.text },
  field: { gap: space.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    color: colors.text,
    fontSize: 15,
  },
  error: { ...font.caption, color: colors.danger },
  fine: { ...font.caption, textAlign: 'center', lineHeight: 17 },
});
