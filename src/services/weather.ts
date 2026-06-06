/**
 * Weather via Open-Meteo (free, keyless). Location comes from expo-location;
 * if the user denies permission we fall back to a sensible default so the app
 * still works. Reverse-geocoding for a friendly place name is best-effort.
 */
import * as Location from 'expo-location';

import type { Weather } from '@/types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Fallback coordinates (New York City) when location is unavailable.
const FALLBACK = { latitude: 40.7128, longitude: -74.006, name: 'Default location' };

/** Map WMO weather codes to a short human label. */
export function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

async function resolveLocation(): Promise<{ latitude: number; longitude: number; name?: string }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return FALLBACK;

    const pos = await Location.getLastKnownPositionAsync() ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!pos) return FALLBACK;

    let name: string | undefined;
    try {
      const places = await Location.reverseGeocodeAsync(pos.coords);
      name = places[0]?.city ?? places[0]?.region ?? undefined;
    } catch {
      // reverse geocode is non-critical
    }
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, name };
  } catch {
    return FALLBACK;
  }
}

/** Fetch current conditions + today's high/low for the user's location. */
export async function getCurrentWeather(): Promise<Weather> {
  const loc = await resolveLocation();

  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: '1',
  });

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  const data = await res.json();

  const current = data.current ?? {};
  const daily = data.daily ?? {};
  const tempC = Number(current.temperature_2m ?? 18);
  const feelsLikeC = Number(current.apparent_temperature ?? tempC);
  const code = Number(current.weather_code ?? 0);

  return {
    tempC: Math.round(tempC),
    tempF: cToF(tempC),
    feelsLikeC: Math.round(feelsLikeC),
    conditionCode: code,
    condition: describeWeatherCode(code),
    precipitationProb: Number(daily.precipitation_probability_max?.[0] ?? 0),
    windKph: Math.round(Number(current.wind_speed_10m ?? 0)),
    isDay: Number(current.is_day ?? 1) === 1,
    highC: Math.round(Number(daily.temperature_2m_max?.[0] ?? tempC)),
    lowC: Math.round(Number(daily.temperature_2m_min?.[0] ?? tempC)),
    locationName: loc.name ?? FALLBACK.name,
    fetchedAt: Date.now(),
  };
}

/**
 * Target garment warmth (1–5) for the given feels-like temperature.
 * Used by the rules engine to pick weather-appropriate layers.
 */
export function targetWarmthForTemp(feelsLikeC: number): number {
  if (feelsLikeC >= 28) return 1; // hot
  if (feelsLikeC >= 21) return 2; // warm
  if (feelsLikeC >= 13) return 3; // mild
  if (feelsLikeC >= 5) return 4; // cold
  return 5; // freezing
}

/** Whether conditions warrant outerwear / rain consideration. */
export function needsOuterwear(weather: Weather): boolean {
  return weather.feelsLikeC < 15 || weather.precipitationProb >= 50 || weather.windKph >= 30;
}
