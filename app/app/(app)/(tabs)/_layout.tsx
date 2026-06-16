// app/app/(app)/(tabs)/_layout.tsx
//
// Phase 10 Plan 05 (SKIN-07 / I18N-05): Forge re-skin of the bottom tab bar
// → the Forge TabBar (lib.jsx line 580 / forge-screens.jsx). APPEARANCE-ONLY
// change — routes, OfflineBanner placement, and tab behavior are preserved.
//
// Planner's-call (10-PATTERNS.md tab-bar assignment): we style the LIVE
// expo-router <Tabs> by supplying a custom `tabBar` renderer (ForgeTabBar) that
// draws the Forge floating bar from the design tokens. This keeps the real
// expo-router navigation state machine (the standalone Phase-8 TabBar shell is
// gallery-only per OQ-5 and is NOT wired in — wiring it would mean re-deriving
// navigation state, a behavior change outside this phase's boundary).
//
// Forge spec (10-UI-SPEC line 162):
//   - active   = text-forge-accent + icon strokeWidth 2 + label weight 600
//   - inactive = text-forge-text3 + icon strokeWidth 1.6 + label weight 500
//   - floating bg-forge-tabBg, paddingTop 10 / paddingBottom 28
//   - icons: Planer=barbell (content icon, never gradient), Historik=clock,
//     Inställningar=settings (Forge Icon set, NOT Ionicons)
//   - labels t('plans') / t('history') / t('settings') (exist)
//   - LIGHT + DARK parity REQUIRED (SKIN-07) — useColorScheme() for raw colors.
//
// OfflineBanner mounts ABOVE <Tabs>, INSIDE SafeAreaView edges={['top']} so the
// banner sits below the status bar but above the tab content (Phase 4 — UI-SPEC
// §Visuals OfflineBanner). The ActiveSessionBanner sits below it (Phase 5
// carry-forward). Neither placement changes — appearance-only re-skin.
//
// NO <Redirect> guard here — the parent (app)/_layout.tsx already protects the
// route group (Phase 3 D-08). headerShown:false because each tab screen renders
// its own SafeAreaView + heading.
//
// References:
//   - app/design v2/Sources/design/lib.jsx TabBar (line 580)
//   - .planning/phases/10-plans-exercises-re-skin/10-UI-SPEC.md §Interaction Contract (tab bar) / §Color
//   - 10-PATTERNS.md tab-bar assignment + SP-5/SP-6
//   - app/components/ui/TabBar.tsx (Phase 8 shell — token reference)

import { useEffect } from "react";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Icon, type IconName } from "@/components/ui";
import { OfflineBanner } from "@/components/offline-banner";
import { ActiveSessionBanner } from "@/components/active-session-banner";

// route name → Forge content icon (barbell is a CONTENT icon, never gradient).
const ROUTE_ICON: Record<string, IconName> = {
  index: "barbell",
  history: "clock",
  settings: "settings",
};

// route name → locale key (labels exist from prior phases).
const ROUTE_LABEL_KEY: Record<string, string> = {
  index: "plans",
  history: "history",
  settings: "settings",
};

// §07 motion spec — the default Forge curve (damping 18 / stiffness 220),
// copied verbatim from PrBanner.tsx:71 / index.tsx:587. Shared by the tab-icon
// scale worklet below.
const SPRING = { damping: 18, stiffness: 220 } as const;

// ── ForgeTabButton — one tab item, owning its own animation hooks ────────────
// Extracted out of the `state.routes.map(...)` body so each tab's
// useSharedValue/useEffect/useAnimatedStyle live in their own component
// instance (Rules of Hooks — hooks must never be called inside a .map callback,
// 15-RESEARCH Pitfall 5). On tab switch the active tab's icon springs from
// scale 0.92 → 1 on the Reanimated UI thread (D-07 / Forge §07 motion-table);
// this is purely presentational and never touches the log-a-set hot path (D-08).
type ForgeTabButtonProps = {
  iconName: IconName;
  label: string;
  isActive: boolean;
  /** Raw Icon stroke color (already light/dark-resolved by the parent). */
  color: string;
  onPress: () => void;
};

function ForgeTabButton({
  iconName,
  label,
  isActive,
  color,
  onPress,
}: ForgeTabButtonProps) {
  // UI-thread icon-scale worklet: 0.92 (inactive) ↔ 1 (active), §07 spring.
  const scale = useSharedValue(isActive ? 1 : 0.92);
  useEffect(() => {
    scale.value = withSpring(isActive ? 1 : 0.92, SPRING);
  }, [isActive, scale]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      className="flex-1 items-center gap-1"
      // FIT-66 — pressed feedback via style callback, never active:opacity-*.
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      <Animated.View style={iconStyle}>
        <Icon
          name={iconName}
          size={24}
          color={color}
          strokeWidth={isActive ? 2 : 1.6}
        />
      </Animated.View>
      <Text
        className={`text-[10.5px] ${
          isActive
            ? "text-forge-accent-light dark:text-forge-accent"
            : "text-forge-text3-light dark:text-forge-text3"
        }`}
        style={{
          fontWeight: isActive ? "600" : "500",
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── ForgeTabBar — custom tabBar renderer styled to the Forge spec ────────────
// Drives the live expo-router navigation state (state.index, navigation.navigate)
// but paints the Forge floating bar. Light + dark parity via useColorScheme()
// for the raw Icon stroke color (the bar surface + labels use token classes).
// Each tab is a ForgeTabButton child so per-tab animation hooks are isolated.
function ForgeTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const accent = isDark ? "#FF5A1F" : "#E14E10";
  const text3 = isDark ? "rgba(255,255,255,0.38)" : "#8B8B8B";

  return (
    <View
      className="flex-row border-t border-forge-border-light bg-forge-tabBg-light dark:border-forge-border dark:bg-forge-tabBg"
      style={{ paddingTop: 10, paddingBottom: 28 }}
    >
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const iconName = ROUTE_ICON[route.name] ?? "barbell";
        const labelKey = ROUTE_LABEL_KEY[route.name] ?? route.name;
        const color = isActive ? accent : text3;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <ForgeTabButton
            key={route.key}
            iconName={iconName}
            label={t(labelKey)}
            isActive={isActive}
            color={color}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-forge-bg-light dark:bg-forge-bg"
    >
      <OfflineBanner />
      <ActiveSessionBanner />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <ForgeTabBar {...props} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </SafeAreaView>
  );
}
