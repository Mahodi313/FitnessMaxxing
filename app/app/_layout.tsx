// app/app/_layout.tsx
import "../global.css";
import { useEffect } from "react";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { z } from "zod";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
// react-native-gesture-handler must be imported in the entry file so its
// native modules register before any GestureDetector descendant renders. The
// named import below triggers the module load — separately importing it for
// side-effects only is no longer required in v2.x.
// See https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

// LOAD-BEARING import order — see 04-RESEARCH.md §"Module-load order" + Pitfall 8.2.
// client.ts MUST execute first (registers all 13 setMutationDefaults), THEN
// persister.ts (creates the SHARED asyncStoragePersister; Plan 05-05 / FIT-8
// moved the imperative `persistQueryClient(...)` call OUT of this module — the
// PersistQueryClientProvider below now owns LOAD-side hydration so its
// onSuccess callback can flip the workout-screen hydration gate), THEN
// network.ts (wires NetInfo + AppState + the onlineManager.subscribe(
// resumePausedMutations) block that closes Pitfall 8.12 + the AppState
// background-flush via persistQueryClientSave). Reordering these breaks the
// offline-queue replay contract. Provider mount happens AFTER all module-load
// imports — so setMutationDefaults are guaranteed live before the onSuccess
// callback can possibly fire.
import { queryClient } from "@/lib/query/client";
import { asyncStoragePersister } from "@/lib/query/persister";
import "@/lib/query/network";
// i18next module-singleton init (Plan 08-01). MUST appear AFTER the
// @/lib/query/* side-effect imports above — those are LOAD-BEARING and must not
// be reordered (see header lines 18-29). This side-effect import runs
// i18n.init() before any JSX renders so t()/changeLanguage are live for the
// LocaleBootstrap gate below. (PATTERNS §_layout.tsx step 4 / CLAUDE.md.)
// eslint-disable-next-line import/no-duplicates -- LOAD-BEARING explicit side-effect form (PATTERNS §_layout.tsx step 4); kept separate from the default import below so the i18n.init() ordering vs @/lib/query/* is unambiguous.
import "@/lib/i18n";
// Default-import the same module for the i18n instance used in LocaleBootstrap's
// changeLanguage() call. The bundler caches the module, so this does NOT re-run
// init() — the side-effect import above already did. Keeping both forms makes
// the LOAD-BEARING side-effect explicit while giving LocaleBootstrap the handle.
// eslint-disable-next-line import/no-duplicates
import i18n from "@/lib/i18n";
// resolveLanguage (Plan 09-01): three-state fm:language pref → two-state engine
// language. Imported here so LocaleBootstrap can resolve a stored 'system' pref
// via the device locale instead of silently rewriting it to 'sv'.
// eslint-disable-next-line import/no-duplicates
import { resolveLanguage } from "@/lib/i18n";
import { usePersistenceStore } from "@/lib/persistence-store";
import { useFontStore } from "@/lib/font-store";
// FIT-111: live display-unit store + boot hydration. UnitsBootstrap reads
// fm:units once at boot and mirrors it into useUnitStore so every read-side
// screen re-renders on a Settings unit toggle (no restart). fm:units stays the
// durable source via getPref/setPref.
import { useUnitStore } from "@/lib/units-store";
import { getPref } from "@/lib/prefs";

// Importing useAuthStore here triggers the module-scope onAuthStateChange listener
// + getSession() init flow registered in app/lib/auth-store.ts. Order does not
// matter for correctness (listener registers exactly once on first import) but
// keeping this import near the top makes the side-effect explicit.
import { useAuthStore } from "@/lib/auth-store";

// ---- Module-level side-effects. Set once when module loads. ----

// Phase 3 D-04: hold the native splash until first session resolution. MUST be
// module scope (BEFORE any render); useEffect would fire too late and the
// splash would auto-hide before we get a chance to gate it. Per RESEARCH.md
// Pitfall §3 + docs.expo.dev/versions/latest/sdk/splash-screen.
//
// WR-03: Promise rejection is handled. If the splash already auto-hid because
// JS started slowly, preventAutoHideAsync rejects — safe to swallow because
// SplashScreenController will still call hideAsync() once auth resolves.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may have already auto-hidden if JS started slowly; safe to ignore.
});

// focusManager + onlineManager + onlineManager.subscribe(resumePausedMutations)
// are wired in @/lib/query/network.ts (imported above for side-effects).

/**
 * Render-side splash hide controller. When status flips out of 'loading',
 * fires SplashScreen.hideAsync() in an effect (post-commit) so React 19
 * concurrent renders that get thrown away don't leave the splash hidden
 * over no content. WR-02: native bridge call moved out of render.
 */
function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  // Plan 08-02 (DSGN-02): extend the splash gate so it also waits for the
  // self-hosted fonts to load AND the saved locale to apply. Both flags flip
  // fail-open (FontBootstrap / LocaleBootstrap), so this gate cannot hang.
  const fontsReady = useFontStore((s) => s.fontsReady);
  const localeReady = useFontStore((s) => s.localeReady);
  useEffect(() => {
    if (status !== "loading" && fontsReady && localeReady) {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden / not visible — safe to ignore.
      });
    }
  }, [status, fontsReady, localeReady]);
  return null;
}

/**
 * Reads AsyncStorage('fm:theme') during the splash-hold window and applies
 * setColorScheme so the user's saved theme preference is active from the
 * first rendered frame. Fires in parallel with the auth-status splash gate
 * (SplashScreenController) — does NOT block splash hiding. On IO error or
 * corrupt/missing value, silent fallback to NativeWind's default 'system'.
 * Implements D-T2 + T-07-01 mitigation (Zod enum-catch parse).
 */
function ThemeBootstrap() {
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    void AsyncStorage.getItem("fm:theme")
      .then((v) => {
        const parsed = z
          .enum(["system", "light", "dark"])
          .catch("system")
          .parse(v);
        setColorScheme(parsed);
      })
      .catch(() => {
        console.warn("[theme] AsyncStorage read failed — defaulting to system");
      });
  }, [setColorScheme]);
  return null;
}

/**
 * Loads the 4 self-hosted Forge font faces (Inter Display R/SB/B + JetBrains
 * Mono Regular) via expo-font during the splash-hold window, then flips
 * fontsReady (DSGN-02). FAIL-OPEN: setFontsReady(true) on BOTH success AND
 * failure (D-05 / RESEARCH Pitfall 7) — a missing/corrupt font face must never
 * hang the splash forever. Each family key here is the exact NativeWind
 * fontFamily token from tailwind.config.js (Task 1). No D-05 standard-Inter
 * fallback was needed — all 3 real Inter Display weights are bundled (Task 2).
 */
function FontBootstrap() {
  const setFontsReady = useFontStore((s) => s.setFontsReady);
  useEffect(() => {
    void Font.loadAsync({
      InterDisplay: require("../assets/fonts/InterDisplay-Regular.otf"),
      "InterDisplay-SemiBold": require("../assets/fonts/InterDisplay-SemiBold.otf"),
      "InterDisplay-Bold": require("../assets/fonts/InterDisplay-Bold.otf"),
      JetBrainsMono: require("../assets/fonts/JetBrainsMono-Regular.ttf"),
    })
      .then(() => setFontsReady(true))
      .catch(() => setFontsReady(true)); // FAIL-OPEN — D-05 / Pitfall 7
  }, [setFontsReady]);
  return null;
}

/**
 * Applies the user's saved language override (fm:language) before the splash
 * clears, then flips localeReady (I18N-01). Reuses ThemeBootstrap's exact
 * corrupt-value-tolerant idiom — a tampered/garbage value falls back to the
 * default and never throws (T-09-06 / T-08-03).
 *
 * Phase 9 (Plan 09-02, RESEARCH Pitfall 2): the pref is THREE-STATE
 * (`system | sv | en`). The enum is widened to include `"system"` (default
 * `"system"`) and the parsed pref is piped through `resolveLanguage()` before
 * `i18n.changeLanguage()` — so a stored `'system'` resolves via the device
 * locale (D-11) instead of being silently rewritten to `'sv'` on cold launch.
 * resolveLanguage returns only the `'sv'|'en'` literal union, so no free text
 * reaches the engine (T-09-08).
 *
 * FAIL-OPEN via .finally(): localeReady flips on success AND IO failure so a
 * read error / corrupt pref can never hang the splash (T-09-09 / Pitfall 7).
 */
function LocaleBootstrap() {
  const setLocaleReady = useFontStore((s) => s.setLocaleReady);
  useEffect(() => {
    void AsyncStorage.getItem("fm:language")
      .then((v) => {
        const pref = z.enum(["system", "sv", "en"]).catch("system").parse(v);
        return i18n.changeLanguage(resolveLanguage(pref));
      })
      .catch(() => {
        // IO error reading fm:language — i18n keeps its init language; the
        // .finally below still clears the splash gate.
      })
      .finally(() => setLocaleReady(true));
  }, [setLocaleReady]);
  return null;
}

/**
 * FIT-111: reads fm:units during the splash-hold window and mirrors it into
 * useUnitStore so the read-side screens render the correct unit from the first
 * frame. ThemeBootstrap precedent — fires in parallel with the auth-status
 * splash gate and does NOT block splash hiding (the "metric" default renders
 * fine pre-hydration; the correct unit flips in on the next tick, so this is
 * NOT added to the splash-ready gate). getPref is corrupt-tolerant
 * (z.enum(...).catch("metric")) so a tampered fm:units never throws.
 */
function UnitsBootstrap() {
  useEffect(() => {
    void getPref("fm:units").then((u) => useUnitStore.getState().hydrate(u));
  }, []);
  return null;
}

/**
 * Stack.Protected gates (app) and (auth) groups by session presence.
 * While status === 'loading', renders null so the native splash continues to
 * cover the screen (RESEARCH.md Pitfall §5 — prevents the empty-navigator
 * blank flash).
 */
function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const status = useAuthStore((s) => s.status);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (status === "loading") return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // contentStyle puts the dark/light backdrop behind every root-level
        // screen ((app), (auth)) so brief animation frames don't flash white.
        // The (app)/_layout.tsx Stack already sets its own contentStyle for
        // pushes within (app); this one covers the root push between groups.
        contentStyle: { backgroundColor: isDark ? "#111827" : "#FFFFFF" },
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // GestureHandlerRootView wraps the entire app so descendants of any screen
  // (e.g., DraggableFlatList in plans/[id].tsx) can use GestureDetector without
  // triggering the "must be a descendant of GestureHandlerRootView" runtime
  // error. flex: 1 is required — without it children collapse to zero size.
  //
  // backgroundColor: the BOTTOM-MOST backdrop of the entire app. Any pixel
  // visible during a navigation/animation transition that isn't covered by a
  // screen falls through to this color. Without it iOS shows white. UAT
  // 2026-05-10: white flash visible when pushing from (tabs) -> plans/[id] —
  // the (app) Stack's contentStyle alone wasn't enough because the root
  // Stack's screen container had no bg color set.
  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: isDark ? "#111827" : "#FFFFFF",
      }}
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          maxAge: 1000 * 60 * 60 * 24, // 24h per Phase 1 D-08
        }}
        onSuccess={() => {
          // Plan 05-05 / FIT-8: flip the hydration-ready signal so the
          // workout-screen render gate stops showing "Återställer pass…"
          // and renders the normal session loading → WorkoutBody flow.
          usePersistenceStore.getState().setHydrated(true);
        }}
        onError={() => {
          // T-05-05-01: surface persister adapter failures so a silent
          // AsyncStorage crash doesn't leave the screen stuck on
          // "Återställer pass…". The store still flips so the gate clears
          // (degraded but unblocked UX — same trade-off the original
          // imperative persistQueryClient call made).
          console.warn("[persistence] hydration failed — proceeding without cache restore");
          usePersistenceStore.getState().setHydrated(true);
        }}
      >
        <ThemeBootstrap />
        <FontBootstrap />
        <LocaleBootstrap />
        <UnitsBootstrap />
        <SplashScreenController />
        <RootNavigator />
        <StatusBar style={isDark ? "light" : "dark"} />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
