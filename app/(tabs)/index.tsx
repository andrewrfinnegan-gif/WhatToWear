/**
 * Today — the core loop. Reads weather + chosen occasion, asks the recommender
 * for outfits (Claude stylist with rules-engine fallback), and lets the user
 * pick one to "wear", which feeds rotation back into future suggestions.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OccasionPicker } from '@/components/OccasionPicker';
import { OutfitCard } from '@/components/OutfitCard';
import { WeatherBanner } from '@/components/WeatherBanner';
import { Button, EmptyState } from '@/components/ui';
import { isClaudeConfigured } from '@/config';
import { recommendOutfits, type RecommendResult } from '@/services/recommend';
import { getCurrentWeather } from '@/services/weather';
import { useCloset } from '@/store/closet';
import { colors, font, radius, space } from '@/theme';
import type { Occasion, Weather } from '@/types';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, loading: closetLoading, markWorn } = useCloset();

  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [occasion, setOccasion] = useState<Occasion>('casual');
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      setWeather(await getCurrentWeather());
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const generate = useCallback(async () => {
    if (!weather) return;
    setGenerating(true);
    try {
      setResult(await recommendOutfits(items, occasion, weather, 3));
    } finally {
      setGenerating(false);
    }
  }, [items, occasion, weather]);

  // Auto-generate once weather + closet are ready, and whenever occasion changes.
  useEffect(() => {
    if (weather && !closetLoading && items.length > 0) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, occasion, closetLoading]);

  const onWear = (ids: string[]) => {
    markWorn(ids);
  };

  const hasCloset = items.length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={
        <RefreshControl refreshing={weatherLoading} onRefresh={loadWeather} tintColor={colors.accent} />
      }
    >
      <Text style={styles.title}>What to wear</Text>
      <Text style={styles.subtitle}>Pick a setting and get outfits from your closet.</Text>

      <WeatherBanner weather={weather} loading={weatherLoading} />

      <View style={styles.pickerRow}>
        <OccasionPicker value={occasion} onChange={setOccasion} />
      </View>

      {!isClaudeConfigured() ? (
        <View style={styles.note}>
          <Ionicons name="information-circle" size={15} color={colors.textMuted} />
          <Text style={styles.noteText}>
            Smart-match engine active. Add an Anthropic API key to enable the AI stylist.
          </Text>
        </View>
      ) : null}

      {result?.aiError ? (
        <View style={styles.note}>
          <Ionicons name="warning" size={15} color={colors.warning} />
          <Text style={styles.noteText}>Stylist unavailable, used smart match. ({result.aiError})</Text>
        </View>
      ) : null}

      {!hasCloset && !closetLoading ? (
        <EmptyState
          icon="shirt-outline"
          title="Your closet is empty"
          subtitle="Add a few clothes to start getting outfit suggestions."
          action={<Button label="Add clothing" icon="add" onPress={() => router.push('/add-item')} />}
        />
      ) : (
        <View style={styles.results}>
          <View style={styles.resultsHeader}>
            <Text style={font.h3}>
              {generating ? 'Styling…' : result?.usedAi ? 'Stylist picks' : 'Suggested outfits'}
            </Text>
            <Button
              label="Reshuffle"
              icon="refresh"
              variant="ghost"
              onPress={generate}
              loading={generating}
            />
          </View>

          {result && result.outfits.length === 0 && !generating ? (
            <EmptyState
              icon="sad-outline"
              title="No outfits for this setting"
              subtitle={`You don't have enough ${occasion} items yet. Try another setting or add more clothes.`}
              action={<Button label="Add clothing" icon="add" onPress={() => router.push('/add-item')} />}
            />
          ) : (
            result?.outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                onWear={() => onWear(outfit.itemIds)}
                onPressItem={(id) => router.push(`/item/${id}`)}
              />
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingTop: space.xxl, gap: space.lg },
  title: { ...font.h1 },
  subtitle: { ...font.bodyMuted, marginTop: -space.sm },
  pickerRow: { marginHorizontal: -space.lg, paddingHorizontal: space.lg },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: { ...font.caption, flex: 1 },
  results: { gap: space.lg },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
