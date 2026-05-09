// app/lib/supabase.ts
//
// Supabase-klient med LargeSecureStore-wrapper:
// - AES-256-krypterad blob lagras i AsyncStorage (no size limit)
// - 256-bit AES-nyckel lagras i expo-secure-store (2048-byte cap är inget problem för en 32-byte hex-string)
// Per CLAUDE.md Critical Recipe §A. Se PITFALLS §2.4 för varför ren AsyncStorage inte räcker.

import "react-native-get-random-values"; // MÅSTE vara FIRST import — polyfill:ar crypto.getRandomValues för aes-js
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppState, Platform } from "react-native";

// Runtime-guard per PITFALLS §2.6 — fail loudly om env saknas, inte silent.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Skapa app/.env.local med " +
      "EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY (se app/.env.example).",
  );
}

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey),
    );
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return await this._decrypt(key, encrypted);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string) {
    // Delete the AES key first so a crash between the two ops can't leave an
    // orphaned key for a blob that's already gone. The undecryptable blob is
    // harmless and gets cleaned up next time setItem runs for this key.
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN har ingen URL-bar
  },
});

// Foreground/background handling — auto-refresh bara när appen är aktiv (per Recipe §A).
//
// WR-05: keep a ref to the subscription so Fast Refresh can dispose the previous
// listener before this module re-evaluates. Without the dispose hook, every
// save during dev registers a new AppState listener and the previous ones leak,
// firing startAutoRefresh/stopAutoRefresh N times per state change.
const appStateSub = AppState.addEventListener("change", (state) => {
  if (Platform.OS === "web") return; // SecureStore finns inte på web; vi är iOS-only ändå
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

if (__DEV__) {
  const hot = (module as { hot?: { dispose: (cb: () => void) => void } }).hot;
  hot?.dispose(() => appStateSub.remove());
}
