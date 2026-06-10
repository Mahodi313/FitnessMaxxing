// app/app/(app)/_forge-gallery.tsx
//
// Phase 8 (Forge Foundation), Plan 08-05 — DSGN-01..06 / I18N-01 / I18N-04.
// The dev-only Forge component gallery: the single new visible surface in this
// phase and the manual-UAT test surface (D-06 / D-07). It renders every token,
// the type scale, every primitive × variant × size, the static Skia ring +
// sparkline, the brand components, and an sv↔en toggle — in both light and dark.
//
// GATING (OQ-6 / 08-RESEARCH.md Pitfall 6 / 08-PATTERNS.md §_forge-gallery.tsx):
//   - The file lives at (app)/_forge-gallery — OUTSIDE (tabs)/ — so it is a Stack
//     sibling, NEVER a tab child; it never appears in the live tab bar.
//   - In expo-router v6 only `_layout` (and `+html/+api/+middleware`) filenames
//     are excluded from routing; a `_forge-gallery` file IS a regular route, so
//     it is reachable in dev via `router.push('/_forge-gallery')` (see SUMMARY).
//   - The whole screen body is __DEV__-guarded: a release build renders only a
//     tiny "dev only" notice and no sample surface (T-08-10 defense-in-depth).
//
// i18n (T-08-11): the sv↔en toggle calls i18n.changeLanguage with a hardcoded
// 'sv' | 'en' literal union — no free text into the engine.
//
// The gallery's own section/swatch labels are dev-only scaffolding and are
// EXEMPT from the i18n copy contract (08-UI-SPEC.md §Copywriting).
//
// Screen shell: ScrollView + SafeAreaView + useColorScheme, copied from
// app/app/(app)/(tabs)/settings.tsx + exercise/[exerciseId]/chart.tsx (lines 48-50).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §Verification Surface
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §_forge-gallery.tsx
//   - .planning/phases/08-forge-foundation/08-RESEARCH.md §Pitfall 6
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { fmtDate, fmtNum, tnum } from "@/lib/utils/format";
import {
  AppIcon,
  ForgeButton,
  type ForgeButtonSize,
  type ForgeButtonVariant,
  ForgeCard,
  ForgeChip,
  ForgeField,
  ForgeStat,
  Logo,
  ProgressRing,
  SettingsRow,
  SettingsSection,
  Sparkline,
  TabBar,
  type TabKey,
} from "@/components/ui";

// A copy of the tnum readonly tuple into a mutable array so RN's TextStyle
// fontVariant (mutable FontVariant[]) type-checks — the same use-site bridge
// Plan 04 established (08-04-SUMMARY.md), keeping format.ts untouched.
const TNUM = { fontVariant: [...tnum.fontVariant] };

// Section wrapper — dev-only scaffolding heading + body (exempt from i18n).
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-8 gap-3">
      <Text
        className="text-[11px] text-forge-text3-light dark:text-forge-text3"
        style={{
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// ── Section 1: color swatches ──────────────────────────────────────────────
// Each entry pairs a `-light` base bg class with its `dark:` DEFAULT sibling so
// the swatch flips with the theme (DSGN-01). `text` swatches add a border so
// white-on-white / black-on-black stays visible.
const SWATCHES: { label: string; bg: string }[] = [
  { label: "bg", bg: "bg-forge-bg-light dark:bg-forge-bg" },
  { label: "surface", bg: "bg-forge-surface-light dark:bg-forge-surface" },
  { label: "surface2", bg: "bg-forge-surface2-light dark:bg-forge-surface2" },
  { label: "surface3", bg: "bg-forge-surface3-light dark:bg-forge-surface3" },
  { label: "text", bg: "bg-forge-text-light dark:bg-forge-text" },
  { label: "text2", bg: "bg-forge-text2-light dark:bg-forge-text2" },
  { label: "text3", bg: "bg-forge-text3-light dark:bg-forge-text3" },
  { label: "accent", bg: "bg-forge-accent-light dark:bg-forge-accent" },
  {
    label: "accentSoft",
    bg: "bg-forge-accentSoft-light dark:bg-forge-accentSoft",
  },
  { label: "success", bg: "bg-forge-success-light dark:bg-forge-success" },
  { label: "danger", bg: "bg-forge-danger-light dark:bg-forge-danger" },
  { label: "border", bg: "bg-forge-border-light dark:bg-forge-border" },
];

function ColorSwatches() {
  return (
    <View className="flex-row flex-wrap gap-3">
      {SWATCHES.map((s) => (
        <View key={s.label} className="w-[72px] items-center gap-1">
          <View
            className={`h-14 w-14 rounded-forge-md border border-forge-border-light dark:border-forge-border ${s.bg}`}
          />
          <Text className="text-[10px] text-forge-text2-light dark:text-forge-text2">
            {s.label}
          </Text>
        </View>
      ))}
      {/* Brand gradient swatch — rendered with the AppIcon squircle engine. */}
      <View className="w-[72px] items-center gap-1">
        <AppIcon size={56} />
        <Text className="text-[10px] text-forge-text2-light dark:text-forge-text2">
          gradient
        </Text>
      </View>
    </View>
  );
}

// ── Section 2: type scale ──────────────────────────────────────────────────
function TypeScale() {
  return (
    <View className="gap-2">
      <Text className="font-display text-[28px] text-forge-text-light dark:text-forge-text">
        Display Regular
      </Text>
      <Text className="font-display-semibold text-[28px] text-forge-text-light dark:text-forge-text">
        Display SemiBold
      </Text>
      <Text className="font-display-bold text-[28px] text-forge-text-light dark:text-forge-text">
        Display Bold
      </Text>
      <Text className="font-mono text-[16px] text-forge-text-light dark:text-forge-text">
        JetBrains Mono 105 × 6
      </Text>

      {/* Tabular-numeral alignment proof: right-aligned column of numbers using
          font-display-bold + tnum so the digits line up column-for-column. */}
      <View className="mt-2 self-start gap-0.5">
        {["1 234,5", "98,0", "1 000,0", "42,5", "7,5"].map((n) => (
          <Text
            key={n}
            className="font-display-bold text-right text-[20px] text-forge-text-light dark:text-forge-text"
            style={TNUM}
          >
            {n}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Section 3: component matrix ────────────────────────────────────────────
const BUTTON_VARIANTS: ForgeButtonVariant[] = [
  "primary",
  "secondary",
  "ghost",
  "destructive",
];
const BUTTON_SIZES: ForgeButtonSize[] = ["lg", "md", "sm"];

function ComponentMatrix() {
  const [fieldValue, setFieldValue] = useState("");
  const [notes, setNotes] = useState("");
  const [toggleOn, setToggleOn] = useState(true);

  return (
    <View className="gap-5">
      {/* ForgeButton — 4 variants × 3 sizes. */}
      <View className="gap-3">
        {BUTTON_VARIANTS.map((variant) => (
          <View key={variant} className="flex-row flex-wrap items-center gap-2">
            {BUTTON_SIZES.map((size) => (
              <ForgeButton
                key={`${variant}-${size}`}
                label={`${variant}/${size}`}
                variant={variant}
                size={size}
              />
            ))}
          </View>
        ))}
        <ForgeButton label="loading" variant="primary" loading fullWidth />
        <ForgeButton label="icon" variant="secondary" icon="plus" />
      </View>

      {/* ForgeField — default / focused / error / multiline. */}
      <View className="gap-2">
        <ForgeField
          value={fieldValue}
          onChangeText={setFieldValue}
          placeholder="default"
          icon="user"
          state="default"
        />
        <ForgeField
          value={fieldValue}
          onChangeText={setFieldValue}
          placeholder="focused"
          state="focused"
        />
        <ForgeField
          value={fieldValue}
          onChangeText={setFieldValue}
          placeholder="error"
          state="error"
        />
        <ForgeField
          value={notes}
          onChangeText={setNotes}
          placeholder="multiline"
          multiline
        />
      </View>

      {/* ForgeCard — surface + accentSoft + interactive. */}
      <View className="gap-2">
        <ForgeCard>
          <Text className="text-[15px] text-forge-text-light dark:text-forge-text">
            ForgeCard surface
          </Text>
        </ForgeCard>
        <ForgeCard tint="accentSoft">
          <Text className="text-[15px] text-forge-text-light dark:text-forge-text">
            ForgeCard accentSoft
          </Text>
        </ForgeCard>
        <ForgeCard interactive accessibilityLabel="Interactive card">
          <Text className="text-[15px] text-forge-text-light dark:text-forge-text">
            ForgeCard interactive
          </Text>
        </ForgeCard>
      </View>

      {/* ForgeStat — sm / md / lg, one with a delta pill. */}
      <View className="flex-row flex-wrap gap-6">
        <ForgeStat label="Volume" value="1 234" unit="kg" size="sm" />
        <ForgeStat label="Sessions" value="12" size="md" />
        <ForgeStat
          label="1RM"
          value="142,5"
          unit="kg"
          size="lg"
          delta={{ value: "+5,0", direction: "up" }}
        />
      </View>

      {/* ForgeChip — 3 variants. */}
      <View className="flex-row flex-wrap gap-2">
        <ForgeChip>default</ForgeChip>
        <ForgeChip variant="accent" icon="spark">
          accent
        </ForgeChip>
        <ForgeChip variant="success" icon="check">
          success
        </ForgeChip>
      </View>

      {/* SettingsSection wrapping SettingsRow rows (chevron / value / toggle). */}
      <SettingsSection label="Settings">
        <SettingsRow icon="bell" label="Notifications" chevron />
        <SettingsRow icon="globe" label="Language" value="English" chevron />
        <SettingsRow
          icon="scale"
          label="Haptics"
          toggle
          toggleValue={toggleOn}
          onToggle={setToggleOn}
          last
        />
      </SettingsSection>
    </View>
  );
}

// ── Section 4: brand + Skia ────────────────────────────────────────────────
function BrandAndSkia() {
  return (
    <View className="gap-5">
      <View className="flex-row flex-wrap items-center gap-6">
        <View className="items-center gap-1">
          <Logo size={56} variant="gradient" />
          <Text className="text-[10px] text-forge-text2-light dark:text-forge-text2">
            Logo gradient
          </Text>
        </View>
        {/* white Logo sits on a dark tile so it is visible in both themes */}
        <View className="items-center gap-1">
          <View className="h-16 w-16 items-center justify-center rounded-forge-md bg-forge-surface3-light dark:bg-forge-surface3">
            <Logo size={40} variant="white" />
          </View>
          <Text className="text-[10px] text-forge-text2-light dark:text-forge-text2">
            Logo white
          </Text>
        </View>
        <View className="items-center gap-1">
          <AppIcon size={56} />
          <Text className="text-[10px] text-forge-text2-light dark:text-forge-text2">
            AppIcon
          </Text>
        </View>
      </View>

      {/* ProgressRing at 0.25 / 0.7 / 1.0 (the 1.0 ring uses the brand gradient
          + a center label). */}
      <View className="flex-row flex-wrap items-center gap-6">
        <ProgressRing size={72} value={0.25} />
        <ProgressRing size={72} value={0.7} />
        <ProgressRing size={72} value={1} gradient={["#FF7A2E", "#FF2D55"]}>
          <Text className="font-display-bold text-[16px] text-forge-text-light dark:text-forge-text">
            100%
          </Text>
        </ProgressRing>
      </View>

      {/* Sparkline with sample data. */}
      <Sparkline
        data={[40, 52, 48, 61, 55, 70, 66, 82, 78, 95]}
        width={260}
        height={56}
      />
    </View>
  );
}

// ── Section 5: i18n ────────────────────────────────────────────────────────
// Mirror settings.tsx theme persistence (onChange, lines 54-62): apply the
// change live AND persist it so LocaleBootstrap (_layout.tsx) re-applies the
// override on the next cold launch (WR-01). The 'sv' | 'en' literal union is
// the only thing ever written — no free text into AsyncStorage either.
function setLanguage(lang: "sv" | "en") {
  void i18n.changeLanguage(lang);
  void AsyncStorage.setItem("fm:language", lang).catch(() => {
    console.warn(
      "[i18n] AsyncStorage write failed — language not persisted",
    );
  });
}

function I18nSection() {
  const { t, i18n: instance } = useTranslation();
  const active = (instance.language?.startsWith("en") ? "en" : "sv") as
    | "sv"
    | "en";
  // A fixed reference date so the formatting proof is deterministic.
  const sampleDate = new Date(2026, 5, 10);

  return (
    <View className="gap-3">
      {/* sv↔en toggle — hardcoded literal union into changeLanguage (T-08-11). */}
      <View className="flex-row gap-2">
        <ForgeButton
          label="Svenska"
          variant={active === "sv" ? "primary" : "secondary"}
          size="sm"
          onPress={() => setLanguage("sv")}
        />
        <ForgeButton
          label="English"
          variant={active === "en" ? "primary" : "secondary"}
          size="sm"
          onPress={() => setLanguage("en")}
        />
      </View>

      {/* Sample t() strings — flip live with the toggle above (I18N-01). */}
      <View className="gap-1">
        <Text className="text-[15px] text-forge-text-light dark:text-forge-text">
          {t("signIn")} · {t("startSession")} · {t("createPlan")}
        </Text>
        <Text className="text-[15px] text-forge-text2-light dark:text-forge-text2">
          {t("noPlans")} — {t("noPlansSub")}
        </Text>
      </View>

      {/* Locale-aware number + date formatting (I18N-04). */}
      <View className="gap-1">
        <Text
          className="font-mono text-[15px] text-forge-text-light dark:text-forge-text"
          style={TNUM}
        >
          {fmtNum(1234.5, active)}
        </Text>
        <Text className="text-[15px] text-forge-text-light dark:text-forge-text">
          {fmtDate(sampleDate, active)}
        </Text>
        <Text className="text-[12px] text-forge-text3-light dark:text-forge-text3">
          active locale: {active}
        </Text>
      </View>
    </View>
  );
}

// ── TabBar shell demo (standalone, OQ-5 — NOT the live tab bar) ─────────────
function TabBarDemo() {
  const [active, setActive] = useState<TabKey>("plans");
  return (
    <View className="overflow-hidden rounded-forge-lg border border-forge-border-light dark:border-forge-border">
      <TabBar active={active} onSelect={setActive} />
    </View>
  );
}

export default function ForgeGallery() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // __DEV__ guard (OQ-6 / T-08-10): in a release build the gallery renders only
  // a notice and no sample surface.
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-[15px] text-forge-text2-light dark:text-forge-text2">
            Forge gallery is dev-only.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-forge-bg-light dark:bg-forge-bg">
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Forge Gallery",
          headerStyle: { backgroundColor: isDark ? "#000000" : "#FAFAF7" },
          headerTintColor: isDark ? "#FFFFFF" : "#0A0A0A",
        }}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <Text className="mb-6 font-display-bold text-[32px] text-forge-text-light dark:text-forge-text">
          Forge
        </Text>

        <Section title="01 · Color">
          <ColorSwatches />
        </Section>

        <Section title="02 · Type">
          <TypeScale />
        </Section>

        <Section title="03 · Components">
          <ComponentMatrix />
        </Section>

        <Section title="04 · Brand + Skia">
          <BrandAndSkia />
        </Section>

        <Section title="05 · i18n">
          <I18nSection />
        </Section>

        <Section title="06 · TabBar shell (gallery-only)">
          <TabBarDemo />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
