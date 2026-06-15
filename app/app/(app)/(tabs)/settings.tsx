// app/app/(app)/(tabs)/settings.tsx
//
// Phase 9 Plan 09-02 (SET-01..09 + I18N-02): the full Forge Settings screen.
// Composed from the Phase-8 primitives (SettingsSection / SettingsRow /
// ForgeButton) + the re-skinned SegmentedControl. Section order per D-13:
//   Profile → Appearance (theme + language) → Workout (units + weekly goal)
//   → Notifications (haptics + notifications) → Sign-out.
//
// Every visible label routes through t() via useTranslation() so the language
// row's value re-renders text LIVE with no restart (D-12; never capture t in
// module scope). Theme reuses the existing fm:theme + setColorScheme wiring.
//
// Preference layer (all reads corrupt-tolerant via lib/prefs.ts catch-parse —
// T-09-06):
//   - Language (SET-05/I18N-02): chevron disclosure row → iOS ActionSheet
//     (System/Svenska/English) → fm:language. On select: i18n.changeLanguage(
//     resolveLanguage(next)) LIVE (D-12) then persists via setPref.
//     resolveLanguage returns only 'sv'|'en' (T-09-08). (UAT: mockup parity —
//     overrides D-10's segmented-control rendering, decision intact.)
//   - Units (SET-03): chevron disclosure row → iOS ActionSheet (Metric/Imperial)
//     → fm:units. NO retrofit (D-02); storage stays canonical kg;
//     profiles.preferred_unit left dormant (A3). (UAT: mockup parity — overrides
//     D-03's segmented-control + preview rendering, decision intact.)
//   - Weekly goal (SET-04/D-05): +/- stepper clamped 1..7 (default 3); optimistic
//     local set then persists to profiles.weekly_goal via own-row RLS write
//     (.eq id + .select().single() — verify returned row, T-09-07 / Pitfall 6).
//   - Haptics (SET-06/D-08): switch → fm:haptics (default ON). Gates ONLY net-new
//     Phase 9 haptic calls — no retrofit of existing call sites.
//   - Notifications (SET-07/D-07): switch → fm:notifications only. NO
//     expo-notifications, NO OS permission prompt this phase.
//
// Profile (SET-02/D-15): read-only gradient avatar (initials, or `user` icon
// when display_name is null) + display name + email; email-only when name null.
// NO chevron, NO edit flow.
//
// Sign-out (SET-09/D-16): useAuthStore.signOut() chain VERBATIM (V3/FIT-5
// cross-user cache isolation — do NOT alter), rendered as a danger-labelled
// secondary ForgeButton at the bottom. NO confirmation dialog.
//
// Optical (non-4-grid) values are inline style={{}} numbers, never arbitrary
// Tailwind classes (NativeWind 4 / Tailwind 3 purge).
//
// References:
//   - 09-PATTERNS.md §app/(app)/(tabs)/settings.tsx
//   - 09-UI-SPEC.md §Interaction Contract + §Color + §Copywriting + §Spacing
//   - 09-CONTEXT.md D-02/D-05/D-07/D-08/D-13/D-15/D-16
import { useEffect, useId, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useAuthStore } from "@/lib/auth-store";
import { supabase } from "@/lib/supabase";
import { getPref, setPref, type UnitPref } from "@/lib/prefs";
import {
  ensureNotificationPermission,
  getPermissionState,
  type PermissionState,
} from "@/lib/notifications";
import { useUnitStore } from "@/lib/units-store";
import i18n, { resolveLanguage, type LanguagePref } from "@/lib/i18n";
import { SegmentedControl } from "@/components/segmented-control";
import { SettingsRow, SettingsSection } from "@/components/ui/SettingsRow";
import { ForgeButton } from "@/components/ui/ForgeButton";
import { Icon } from "@/components/ui/Icon";

type ThemePref = "system" | "light" | "dark";

// Rest-duration presets (D-08 / TIMER-04 / RESEARCH Open-Q2): 1 / 1:30 / 2 / 3 /
// 5 min. The custom ("Anpassad") entry persists any positive number of seconds;
// every READ clamps via the fm:restSeconds catch-parse schema (T-14-08, 14-01),
// so a garbage/huge value can never produce a runaway timer.
const REST_PRESETS = [60, 90, 120, 180, 300] as const;

// seconds → a compact human label ("2 min" / "1:30"). Whole minutes render as
// "{n} min"; a non-whole minute renders as M:SS (tabular-friendly). Mirrors the
// UI-SPEC §Copywriting row-value shape. Pure — no i18n unit word for "min" since
// the design specimen uses the bare "min" token in both locales.
function formatRestLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "2 min"; // safe default mirror
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (s === 0) return `${m} min`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 56px gradient avatar (brand gradFrom→gradTo) with initials, or a `user` icon
// when display_name is null. react-native-svg engine (same as AppIcon) — NO new
// dependency; NativeWind cannot render a gradient fill.
function ProfileAvatar({ initials }: { initials: string | null }) {
  const id = useId();
  const size = 56;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Defs>
          <LinearGradient
            id={id}
            x1="0"
            y1="0"
            x2={size}
            y2={size}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#FF7A2E" />
            <Stop offset="1" stopColor="#FF2D55" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={size}
          height={size}
          rx={size / 2}
          ry={size / 2}
          fill={`url(#${id})`}
        />
      </Svg>
      {initials ? (
        <Text
          className="text-white"
          style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.3 }}
        >
          {initials}
        </Text>
      ) : (
        <Icon name="user" size={26} color="#FFFFFF" strokeWidth={2} />
      )}
    </View>
  );
}

// Weekly-goal +/- stepper (D-05). Icon-only buttons carry a11y labels + ≥44px
// targets; FIT-66-safe pressed feedback via style callback. Tabular-nums value.
function GoalStepper({
  value,
  onChange,
  incrementLabel,
  decrementLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  incrementLabel: string;
  decrementLabel: string;
}) {
  const { colorScheme } = useColorScheme();
  const ink = colorScheme === "dark" ? "#FF5A1F" : "#E14E10";
  // 46px circular accent-soft buttons (bigger, clearly tappable, matches the
  // accent-soft icon-tile motif). FIT-66: pressed feedback via style callback.
  const btn =
    "items-center justify-center rounded-full bg-forge-accentSoft-light dark:bg-forge-accentSoft";
  return (
    <View className="flex-row items-center gap-4">
      <Pressable
        onPress={() => onChange(value - 1)}
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={btn}
        style={({ pressed }) => [
          { width: 46, height: 46 },
          pressed ? { opacity: 0.7 } : null,
        ]}
      >
        {/* Crisp minus BAR (a View, not a text glyph) — matches the plus icon's
            stroke weight so − and + read as a matched pair. */}
        <View
          style={{ width: 18, height: 2.6, borderRadius: 2, backgroundColor: ink }}
        />
      </Pressable>
      <Text
        className="text-forge-text-light dark:text-forge-text"
        style={{
          fontSize: 20,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          minWidth: 26,
          textAlign: "center",
        }}
      >
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        accessibilityRole="button"
        accessibilityLabel={incrementLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={btn}
        style={({ pressed }) => [
          { width: 46, height: 46 },
          pressed ? { opacity: 0.7 } : null,
        ]}
      >
        <Icon name="plus" size={20} color={ink} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

export default function SettingsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setColorScheme } = useColorScheme();

  const email = useAuthStore((s) => s.session?.user.email);
  const userId = useAuthStore((s) => s.session?.user.id);
  const signOut = useAuthStore((s) => s.signOut);

  // ---- Theme (SET-08) — existing fm:theme wiring, live setColorScheme. ----
  const [theme, setTheme] = useState<ThemePref>("system");
  // ---- Language (SET-05/I18N-02) — fm:language three-state. ----
  const [language, setLanguage] = useState<LanguagePref>("system");
  // ---- Units (SET-03) — fm:units via the reactive store (FIT-111). Reading
  // from useUnitStore (instead of a local useState seeded once by getPref) means
  // a toggle here flips every read-side subscriber live, mirroring how the
  // LANGUAGE control propagates live via i18n.changeLanguage. ----
  const units = useUnitStore((s) => s.unit);
  // ---- Notifications + haptics switches (SET-06/SET-07). ----
  const [haptics, setHaptics] = useState(true);
  const [notifications, setNotifications] = useState(false);
  // ---- Rest timer (TIMER-04 / D-08..D-13). enable (default OFF) + duration
  // (default 120s) + current OS permission state for the denied helper (D-12). --
  const [restTimerEnabled, setRestTimerEnabled] = useState(false);
  const [restSeconds, setRestSeconds] = useState(120);
  const [permState, setPermState] = useState<PermissionState>("denied");
  // ---- Profile (SET-02) + Weekly goal (SET-04). ----
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [goal, setGoal] = useState(3);

  // Load theme (existing idiom) + all fm:* prefs on mount (corrupt-tolerant).
  useEffect(() => {
    void AsyncStorage.getItem("fm:theme").then((v) => {
      const parsed = z.enum(["system", "light", "dark"]).catch("system").parse(v);
      setTheme(parsed);
      setColorScheme(parsed);
    });
    void getPref("fm:language").then(setLanguage);
    // fm:units is hydrated into useUnitStore at boot (UnitsBootstrap) and read
    // reactively above — no local seed needed here (FIT-111).
    void getPref("fm:haptics").then(setHaptics);
    void getPref("fm:notifications").then(setNotifications);
    // Rest timer: hydrate enable + duration prefs and the current (read-only) OS
    // permission state so the row + denied helper reflect reality on mount (D-11).
    void getPref("fm:restTimerEnabled").then(setRestTimerEnabled);
    void getPref("fm:restSeconds").then(setRestSeconds);
    void getPermissionState().then(setPermState);
  }, [setColorScheme]);

  // Load profile (display_name + weekly_goal) — own-row read (RLS).
  useEffect(() => {
    if (!userId) return;
    void Promise.resolve(
      supabase
        .from("profiles")
        .select("display_name, weekly_goal")
        .eq("id", userId)
        .single(),
    )
      .then(({ data, error }) => {
        // WR-03: surface the error branch — a transient RLS/network failure
        // resolves with data === null and must not silently leave stale
        // optimistic defaults (name=null / goal=3) with no signal.
        if (error) {
          console.warn("[settings] profile load failed", error.message);
          return;
        }
        if (!data) return;
        setDisplayName(data.display_name ?? null);
        if (typeof data.weekly_goal === "number") setGoal(data.weekly_goal);
      })
      .catch((e) => console.warn("[settings] profile load threw", e));
  }, [userId]);

  const onThemeChange = (value: ThemePref) => {
    setTheme(value);
    setColorScheme(value);
    void AsyncStorage.setItem("fm:theme", value).catch(() => {
      console.warn("[settings] AsyncStorage write failed — theme not persisted");
    });
  };

  const onLanguageChange = (value: LanguagePref) => {
    setLanguage(value);
    // LIVE re-render (D-12) — only 'sv'|'en' reach the engine (T-09-08).
    void i18n.changeLanguage(resolveLanguage(value));
    setPref("fm:language", value);
  };

  const onUnitsChange = (value: UnitPref) => {
    // The store action owns BOTH the live state flip (every subscriber
    // re-renders) AND the setPref("fm:units") persist (FIT-111).
    useUnitStore.getState().setUnit(value);
  };

  // Units row → iOS ActionSheet picker (mockup: tap row → väljare). V1 is
  // iOS-only (locked), so ActionSheetIOS is the correct native picker.
  const openUnitsSheet = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t("metric"), t("imperial"), t("cancel")],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) onUnitsChange("metric");
        else if (index === 1) onUnitsChange("imperial");
      },
    );
  };

  // Language row → iOS ActionSheet picker. Language MUST still switch LIVE
  // (D-12) — onLanguageChange calls i18n.changeLanguage on selection.
  const openLanguageSheet = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t("system"), "Svenska", "English", t("cancel")],
        cancelButtonIndex: 3,
      },
      (index) => {
        if (index === 0) onLanguageChange("system");
        else if (index === 1) onLanguageChange("sv");
        else if (index === 2) onLanguageChange("en");
      },
    );
  };

  // Display value for the Language disclosure row (current choice).
  const languageValue =
    language === "system" ? t("system") : language === "sv" ? "Svenska" : "English";

  const onHapticsToggle = (next: boolean) => {
    setHaptics(next);
    setPref("fm:haptics", next);
  };

  const onNotificationsToggle = (next: boolean) => {
    setNotifications(next);
    setPref("fm:notifications", next);
  };

  // Rest-timer enable toggle WITH the in-context permission prompt (D-13). On
  // ENABLE we fire the OS prompt once, reflect granted/denied/blocked into the
  // row, then ALWAYS enable the timer regardless of the grant — D-12: the in-app
  // countdown works even when notifications are denied (it only loses the
  // backgrounded ping). On DISABLE we just persist OFF (no prompt).
  const onRestTimerToggle = async (next: boolean) => {
    if (next) {
      const state = await ensureNotificationPermission(); // D-13 in-context ask
      setPermState(state);
    }
    setRestTimerEnabled(next);
    setPref("fm:restTimerEnabled", next);
  };

  // Persist a chosen duration (preset or custom) to fm:restSeconds. The catch-
  // parse schema (14-01) clamps any out-of-range stored value on READ, so this
  // only ever writes a positive integer second-count (T-14-08).
  const applyRestSeconds = (sec: number) => {
    setRestSeconds(sec);
    setPref("fm:restSeconds", sec);
  };

  // Custom ("Anpassad") entry (D-08). Alert.prompt is iOS-only (V1 is iOS-locked,
  // same constraint as the ActionSheet pickers above). The numeric input is
  // interpreted as MINUTES (the duration picker speaks in minutes); we coerce to
  // seconds, guard non-finite / <=0, and clamp to a sane 1..60 min ceiling before
  // persisting — defence-in-depth on top of the read-side catch-parse (T-14-08).
  const openRestCustomEntry = () => {
    Alert.prompt(
      t("restCustom"),
      t("restDuration"),
      (raw) => {
        const minutes = Number((raw ?? "").replace(",", ".").trim());
        if (!Number.isFinite(minutes) || minutes <= 0) return; // ignore garbage
        const clampedMin = Math.min(60, minutes);
        applyRestSeconds(Math.round(clampedMin * 60));
      },
      "plain-text",
      "",
      "number-pad",
    );
  };

  // Weekly-goal stepper: clamp 1..7 (D-05), optimistic local set, then persist
  // own-row to profiles.weekly_goal (T-09-07 — .eq id + verify returned row).
  const onGoalChange = (next: number) => {
    const clamped = Math.min(7, Math.max(1, next));
    if (clamped === goal) return; // no-op at clamp boundary
    const previous = goal;
    setGoal(clamped); // optimistic
    if (!userId) return;
    void supabase
      .from("profiles")
      .update({ weekly_goal: clamped })
      .eq("id", userId)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          // Roll back optimistic update on RLS/write failure — but ONLY if a
          // later tap hasn't already superseded this write (last-writer-wins
          // race: a failed early write must not resurrect a stale value the
          // user has since advanced past). WR-02.
          setGoal((cur) => (cur === clamped ? previous : cur));
          console.warn("[settings] weekly_goal persist failed — rolled back");
        }
      });
  };

  // Profile avatar initials from display_name (or null → user icon).
  const initials = displayName
    ? displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") || null
    : null;

  return (
    <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* H1 settings title (inset 8px 20px 20px). */}
        <Text
          className="text-3xl text-forge-text-light dark:text-forge-text"
          style={{
            fontWeight: "700",
            letterSpacing: -1.2,
            paddingTop: 8,
            paddingLeft: 20,
            paddingBottom: 20,
          }}
        >
          {t("settings")}
        </Text>

        {/* ── Profile (SET-02, read-only D-15) ── */}
        <SettingsSection>
          <View
            className="flex-row items-center gap-3"
            style={{ paddingVertical: 18, paddingHorizontal: 20 }}
          >
            <ProfileAvatar initials={initials} />
            <View className="flex-1">
              {displayName ? (
                <>
                  <Text
                    className="text-forge-text-light dark:text-forge-text"
                    style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.3 }}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {email ? (
                    <Text
                      className="text-forge-text2-light dark:text-forge-text2"
                      style={{ fontSize: 14, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text
                  className="text-forge-text-light dark:text-forge-text"
                  style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.3 }}
                  numberOfLines={1}
                >
                  {email ?? ""}
                </Text>
              )}
            </View>
          </View>
        </SettingsSection>

        {/* ── Appearance (theme + language) ── */}
        <SettingsSection label={t("appearance")}>
          <SettingsRow
            icon="spark"
            label={t("theme")}
            control={
              <SegmentedControl<ThemePref>
                options={[
                  { label: t("system"), value: "system" },
                  { label: t("light"), value: "light" },
                  { label: t("dark"), value: "dark" },
                ]}
                value={theme}
                onChange={onThemeChange}
                accessibilityLabel={t("theme")}
                compact
              />
            }
          />
          {/* Language → chevron disclosure → iOS ActionSheet (mockup parity).
              Live-switches on selection (D-12). */}
          <SettingsRow
            icon="globe"
            label={t("language")}
            last
            value={languageValue}
            chevron
            onPress={openLanguageSheet}
          />
        </SettingsSection>

        {/* ── Workout (units + weekly goal) ── */}
        <SettingsSection label={t("workoutPrefs")}>
          {/* Units → chevron disclosure → iOS ActionSheet (mockup parity).
              Storage stays canonical kg (D-02, no retrofit). */}
          <SettingsRow
            icon="scale"
            label={t("units")}
            value={units === "metric" ? t("metric") : t("imperial")}
            chevron
            onPress={openUnitsSheet}
          />
          <SettingsRow
            icon="barbell"
            label={t("weeklyGoal")}
            last
            subtitle={t("sessionsPerWeek")}
            control={
              <GoalStepper
                value={goal}
                onChange={onGoalChange}
                incrementLabel={t("increment")}
                decrementLabel={t("decrement")}
              />
            }
          />
        </SettingsSection>

        {/* ── Notifications (haptics + notifications + rest timer) ── */}
        <SettingsSection label={t("notifications")}>
          <SettingsRow
            icon="spark"
            label={t("haptics")}
            toggle
            toggleValue={haptics}
            onToggle={onHapticsToggle}
          />
          {/* Rest timer MASTER ENABLE (TIMER-04 / D-13). A clean single-control
              toggle row — the duration is its own revealed sub-row below, matching
              the Forge settings vocabulary (a row is a toggle OR a value+chevron
              disclosure, never both crammed together). */}
          <SettingsRow
            icon="clock"
            label={t("restTimer")}
            subtitle={t("restSubtitle")}
            toggle
            toggleValue={restTimerEnabled}
            onToggle={onRestTimerToggle}
          />
          {restTimerEnabled ? (
            <>
              {/* Inline quick-pick duration chips (TIMER-04) — change the rest
                  time with ONE tap, no sheet. Mono + tabular-nums so the figures
                  never reflow. Selected = forge-accent fill + accentText; others
                  = forge-surface2. Tap → applyRestSeconds (persists fm:restSeconds
                  immediately). */}
              <View
                className="border-b border-forge-border-light dark:border-forge-border"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}
              >
                <View className="flex-row" style={{ gap: 8 }}>
                  {REST_PRESETS.map((sec) => {
                    const selected = restSeconds === sec;
                    return (
                      <Pressable
                        key={sec}
                        onPress={() => applyRestSeconds(sec)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={formatRestLabel(sec)}
                        // Vertical-only hitSlop (no horizontal — chips are
                        // adjacent; horizontal slop would overlap neighbours).
                        hitSlop={{ top: 8, bottom: 8 }}
                        className={`flex-1 items-center justify-center rounded-full ${
                          selected
                            ? "bg-forge-accent-light dark:bg-forge-accent"
                            : "bg-forge-surface2-light dark:bg-forge-surface2"
                        }`}
                        style={({ pressed }) => [
                          { height: 44 }, // iOS 44pt tap-target floor
                          pressed ? { opacity: 0.7 } : null,
                        ]}
                      >
                        <Text
                          className={`font-mono ${
                            selected
                              ? "text-forge-accentText-light dark:text-forge-accentText"
                              : "text-forge-text-light dark:text-forge-text"
                          }`}
                          style={{ fontSize: 13, fontVariant: ["tabular-nums"] }}
                        >
                          {formatRestLabel(sec)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {/* Anpassad tid — dashed outline (forge-borderStrong). When the
                    current duration is NOT a preset, the button reads
                    "Anpassad · {label}" in accent to surface the active custom
                    value. Opens the numeric Alert.prompt (openRestCustomEntry). */}
                {(() => {
                  const isPreset = (
                    REST_PRESETS as readonly number[]
                  ).includes(restSeconds);
                  return (
                    <Pressable
                      onPress={openRestCustomEntry}
                      accessibilityRole="button"
                      accessibilityLabel={t("restCustomTime")}
                      className={`items-center justify-center rounded-forge-md border border-dashed ${
                        isPreset
                          ? "border-forge-borderStrong-light dark:border-forge-borderStrong"
                          : "border-forge-accent-light dark:border-forge-accent"
                      }`}
                      style={({ pressed }) => [
                        { height: 48 },
                        pressed ? { opacity: 0.7 } : null,
                      ]}
                    >
                      <Text
                        className={
                          isPreset
                            ? "text-forge-text2-light dark:text-forge-text2"
                            : "font-mono text-forge-accent-light dark:text-forge-accent"
                        }
                        style={{
                          fontSize: 14,
                          ...(isPreset
                            ? null
                            : { fontVariant: ["tabular-nums"] }),
                        }}
                      >
                        {isPreset
                          ? t("restCustomTime")
                          : `${t("restCustom")} · ${formatRestLabel(restSeconds)}`}
                      </Text>
                    </Pressable>
                  );
                })()}
              </View>
              {/* Avisering toggle — nested under the chips (icon-less). This is the
                  fm:notifications master gate, contextualized to the rest timer
                  (the only OS notification this app sends, SET-07 / D-14). */}
              <SettingsRow
                label={t("restNotify")}
                toggle
                toggleValue={notifications}
                onToggle={onNotificationsToggle}
                last={permState === "granted"}
              />
              {/* D-12 denied-permission helper: muted caption (NOT danger red),
                  indented under the rows. Blocked → tappable → iOS Settings. */}
              {permState !== "granted" ? (
                <Pressable
                  onPress={
                    permState === "blocked"
                      ? () => {
                          void Linking.openSettings();
                        }
                      : undefined
                  }
                  disabled={permState !== "blocked"}
                  accessibilityRole={permState === "blocked" ? "button" : "text"}
                  style={({ pressed }) =>
                    pressed && permState === "blocked" ? { opacity: 0.6 } : null
                  }
                  className="flex-row items-center gap-3 py-[10px] pl-4 pr-4"
                >
                  <View className="h-7 w-7" />
                  <Text className="flex-1 text-[13px] text-forge-text2-light dark:text-forge-text2">
                    {t("restNoPermission")}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <SettingsRow
              icon="bell"
              label={t("notifications")}
              last
              toggle
              toggleValue={notifications}
              onToggle={onNotificationsToggle}
            />
          )}
        </SettingsSection>

        {/* ── Sign-out (SET-09, D-16) — verbatim chain, no confirm ── */}
        {__DEV__ ? (
          <View style={{ marginBottom: 12 }}>
            <Pressable
              onPress={() => router.push("/_forge-gallery")}
              accessibilityRole="button"
              accessibilityLabel="Open Forge gallery (dev)"
              className="w-full items-center justify-center rounded-forge-md border border-forge-border-light py-4 dark:border-forge-border"
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
            >
              <Text className="text-forge-text-light dark:text-forge-text" style={{ fontWeight: "600" }}>
                🔧 Forge Gallery (dev)
              </Text>
            </Pressable>
          </View>
        ) : null}
        <ForgeButton
          label={t("signOut")}
          variant="destructive"
          size="md"
          fullWidth
          onPress={signOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
