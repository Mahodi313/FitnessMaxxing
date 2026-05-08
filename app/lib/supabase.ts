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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN har ingen URL-bar
  },
});

// Foreground/background handling — auto-refresh bara när appen är aktiv (per Recipe §A).
AppState.addEventListener("change", (state) => {
  if (Platform.OS === "web") return; // SecureStore finns inte på web; vi är iOS-only ändå
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/**
 * Phase 1 connect-test (D-07). Bevisar funktionellt att klient + nätverk + auth-headers
 * funkar mot riktiga Supabase-endpoint utan att kräva en faktisk tabell.
 *
 * Förväntad utfall: error med kod "PGRST205" eller liknande "table not found"-shape
 * (tabellen `_phase1_smoke` finns inte). Det bevisar att:
 *   1. Network-rundresan funkar
 *   2. Auth-headers (apikey + Authorization) accepteras av Supabase
 *   3. Klient-konfigen är rätt
 *
 * Anropas en gång från app/_layout.tsx i useEffect. Tas bort senast i Phase 2 när
 * riktiga tabeller finns.
 */
export async function phase1ConnectTest() {
  try {
    const { data, error, status } = await supabase
      .from("_phase1_smoke")
      .select("*")
      .limit(0);
    // eslint-disable-next-line no-console
    console.log("[phase1-connect-test]", {
      ok: status >= 200 && status < 500, // 4xx is also "klient + nätverk funkar"
      status,
      errorCode: error?.code,
      errorMessage: error?.message,
      dataLength: Array.isArray(data) ? data.length : null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[phase1-connect-test] FAILED", e);
  }
}
