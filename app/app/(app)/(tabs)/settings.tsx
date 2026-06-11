// app/app/(app)/(tabs)/settings.tsx
//
// Phase 9 Plan 09-02 (SET-01..09 + I18N-02): the full Forge Settings screen.
// Composed from the Phase-8 primitives (SettingsSection / SettingsRow /
// ForgeButton) + the re-skinned SegmentedControl. Section order per D-13:
//   Profile → Appearance (theme + language) → Workout (units + weekly goal)
//   → Notifications (haptics + notifications) → Sign-out.
//
// Every visible label routes through t() via useTranslation() so the language
// SegmentedControl re-renders text LIVE with no restart (D-12; never capture t
// in module scope). Theme reuses the existing fm:theme + setColorScheme wiring.
//
// Preference layer (all reads corrupt-tolerant via lib/prefs.ts catch-parse —
// T-09-06):
//   - Language (SET-05/I18N-02): 3-state System/Svenska/English → fm:language;
//     onChange calls i18n.changeLanguage(resolveLanguage(next)) LIVE (D-12) then
//     persists via setPref. resolveLanguage returns only 'sv'|'en' (T-09-08).
//   - Units (SET-03): 2-state Metric/Imperial → fm:units; net-new weight values
//     display via formatWeight/toDisplayWeight (lib/units.ts). NO retrofit (D-02);
//     storage stays canonical kg; profiles.preferred_unit left dormant (A3).
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
import { Pressable, ScrollView, Text, View } from "react-native";
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
import i18n, { resolveLanguage, type LanguagePref } from "@/lib/i18n";
import { formatWeight } from "@/lib/units";
import { SegmentedControl } from "@/components/segmented-control";
import { SettingsRow, SettingsSection } from "@/components/ui/SettingsRow";
import { ForgeButton } from "@/components/ui/ForgeButton";
import { Icon } from "@/components/ui/Icon";

type ThemePref = "system" | "light" | "dark";

// Sample weight (canonical kg) shown next to the Units control as a live
// conversion preview — exercises the lib/units.ts helper on a net-new Phase 9
// surface without retrofitting any existing weight screen (D-02). 100kg is the
// helper's documented round-trip case (→ 220.5 lb in imperial).
const UNIT_PREVIEW_KG = 100;

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
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={() => onChange(value - 1)}
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="items-center justify-center rounded-forge-sm border border-forge-borderStrong-light bg-forge-surface3-light dark:border-forge-borderStrong dark:bg-forge-surface3"
        style={({ pressed }) => [
          { width: 44, height: 44 },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        {/* No `minus` glyph in the Icon set — render the U+2212 minus sign in
            the accent ink (matches the `+` Icon weight). */}
        <Text style={{ color: ink, fontSize: 22, fontWeight: "700", lineHeight: 24 }}>
          −
        </Text>
      </Pressable>
      <Text
        className="text-forge-text-light dark:text-forge-text"
        style={{
          fontSize: 18,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          minWidth: 22,
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
        className="items-center justify-center rounded-forge-sm border border-forge-borderStrong-light bg-forge-surface3-light dark:border-forge-borderStrong dark:bg-forge-surface3"
        style={({ pressed }) => [
          { width: 44, height: 44 },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <Icon name="plus" size={18} color={ink} strokeWidth={2.2} />
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
  // ---- Units (SET-03) — fm:units. ----
  const [units, setUnits] = useState<UnitPref>("metric");
  // ---- Notifications + haptics switches (SET-06/SET-07). ----
  const [haptics, setHaptics] = useState(true);
  const [notifications, setNotifications] = useState(false);
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
    void getPref("fm:units").then(setUnits);
    void getPref("fm:haptics").then(setHaptics);
    void getPref("fm:notifications").then(setNotifications);
  }, [setColorScheme]);

  // Load profile (display_name + weekly_goal) — own-row read (RLS).
  useEffect(() => {
    if (!userId) return;
    void supabase
      .from("profiles")
      .select("display_name, weekly_goal")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? null);
        if (typeof data.weekly_goal === "number") setGoal(data.weekly_goal);
      });
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
    setUnits(value);
    setPref("fm:units", value);
  };

  const onHapticsToggle = (next: boolean) => {
    setHaptics(next);
    setPref("fm:haptics", next);
  };

  const onNotificationsToggle = (next: boolean) => {
    setNotifications(next);
    setPref("fm:notifications", next);
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
          // Roll back optimistic update on RLS/write failure.
          setGoal(previous);
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
              />
            }
          />
          <SettingsRow
            icon="globe"
            label={t("language")}
            last
            control={
              <SegmentedControl<LanguagePref>
                options={[
                  { label: t("system"), value: "system" },
                  { label: "Svenska", value: "sv" },
                  { label: "English", value: "en" },
                ]}
                value={language}
                onChange={onLanguageChange}
                accessibilityLabel={t("language")}
              />
            }
          />
        </SettingsSection>

        {/* ── Workout (units + weekly goal) ── */}
        <SettingsSection label={t("workoutPrefs")}>
          <SettingsRow
            icon="scale"
            label={t("units")}
            // Live preview of the chosen unit on a net-new Phase 9 weight
            // surface — formatWeight converts the canonical-kg sample (100kg →
            // "220.5 lb" in imperial). DSGN-03 tabular-nums via the row value
            // style; storage stays kg (D-02, no retrofit).
            value={formatWeight(UNIT_PREVIEW_KG, units)}
            control={
              <SegmentedControl<UnitPref>
                options={[
                  { label: t("metric"), value: "metric" },
                  { label: t("imperial"), value: "imperial" },
                ]}
                value={units}
                onChange={onUnitsChange}
                accessibilityLabel={t("units")}
              />
            }
          />
          <SettingsRow
            icon="barbell"
            label={t("weeklyGoal")}
            last
            value={t("sessionsPerWeek")}
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

        {/* ── Notifications (haptics + notifications) ── */}
        <SettingsSection label={t("notifications")}>
          <SettingsRow
            icon="spark"
            label={t("haptics")}
            toggle
            toggleValue={haptics}
            onToggle={onHapticsToggle}
          />
          <SettingsRow
            icon="bell"
            label={t("notifications")}
            last
            toggle
            toggleValue={notifications}
            onToggle={onNotificationsToggle}
          />
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
          variant="secondary"
          size="md"
          fullWidth
          onPress={signOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
