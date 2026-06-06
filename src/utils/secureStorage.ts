/**
 * Platform-safe secure storage. Uses expo-secure-store (Keychain/Keystore) on
 * native; falls back to AsyncStorage on web where SecureStore is unavailable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export async function getSecure(key: string): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

export async function setSecure(key: string, value: string): Promise<void> {
  if (isWeb) await AsyncStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export async function deleteSecure(key: string): Promise<void> {
  if (isWeb) await AsyncStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
