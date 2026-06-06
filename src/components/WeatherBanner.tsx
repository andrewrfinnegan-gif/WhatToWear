/**
 * Compact weather header: temperature, condition, location, and the day's
 * high/low. Drives the user's mental model of why outfits are suggested.
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { Weather } from '@/types';
import { colors, font, radius, space } from '@/theme';

interface Props {
  weather: Weather | null;
  loading: boolean;
}

function iconFor(code: number, isDay: boolean): keyof typeof Ionicons.glyphMap {
  if (code === 0) return isDay ? 'sunny' : 'moon';
  if (code <= 3) return isDay ? 'partly-sunny' : 'cloudy-night';
  if (code <= 48) return 'cloud';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rainy';
  if (code <= 86) return 'snow';
  return 'thunderstorm';
}

export function WeatherBanner({ weather, loading }: Props) {
  if (loading && !weather) {
    return (
      <View style={[styles.banner, styles.center]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={font.bodyMuted}>Getting local weather…</Text>
      </View>
    );
  }
  if (!weather) {
    return (
      <View style={[styles.banner, styles.center]}>
        <Ionicons name="cloud-offline" size={18} color={colors.textMuted} />
        <Text style={font.bodyMuted}>Weather unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <Ionicons name={iconFor(weather.conditionCode, weather.isDay)} size={34} color={colors.accent} />
      <View style={styles.center2}>
        <Text style={styles.temp}>{weather.tempF}°F</Text>
        <Text style={styles.cond}>{weather.condition}</Text>
      </View>
      <View style={styles.right}>
        {weather.locationName ? (
          <View style={styles.locRow}>
            <Ionicons name="location" size={12} color={colors.textMuted} />
            <Text style={font.caption}>{weather.locationName}</Text>
          </View>
        ) : null}
        <Text style={font.caption}>
          H {weather.highC * 0 + Math.round((weather.highC * 9) / 5 + 32)}° · L{' '}
          {Math.round((weather.lowC * 9) / 5 + 32)}°
        </Text>
        {weather.precipitationProb >= 30 ? (
          <View style={styles.locRow}>
            <Ionicons name="umbrella" size={12} color={colors.accent} />
            <Text style={font.caption}>{weather.precipitationProb}%</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  center: { justifyContent: 'center' },
  center2: { flex: 1 },
  temp: { fontSize: 26, fontWeight: '800', color: colors.text },
  cond: { ...font.bodyMuted },
  right: { alignItems: 'flex-end', gap: 2 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
