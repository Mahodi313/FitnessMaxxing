// app/components/ui/RestTimerBanner.tsx
//
// Phase 14 (Rest Timer, F19), Plan 14-04 — TIMER-01 / TIMER-02 / TIMER-05 /
// D-01 / D-02 / D-04 / D-19.
// The floating countdown banner that mounts ON TOP of the active-workout set
// list while a rest is running. It occupies the SAME absolute overlay slot the
// PR celebration banner uses (D-01 geometry rule — the set list, input row, and
// "Klart" never shift). Cloned wholesale from PrBanner.tsx (the floating-overlay
// banner precedent) — only the radius token, the +translateY motion, the
// display-only tick, and the two interactive controls differ.
//
// COUNTDOWN MECHANIC (TIMER-02 — the one rule that matters):
//   The M:SS numeral is RE-DERIVED every render as `formatMSS(remainingMs(endTs,
//   now))`, where `now` is reactive STATE refreshed by a 1s setInterval. It is
//   NEVER a decrementing second-counter — the value is always the clock-vs-endTs
//   delta, so a backgrounded JS thread that misses ticks reconciles instantly on
//   the next refresh. `now` is held in state (not a bare `Date.now()` read) so
//   the React Compiler tracks the clock as a reactive dependency and recomputes
//   the figure each tick — see the inline note at the `now` declaration. An
//   AppState 'active' listener refreshes `now` on foreground so the numeral is
//   correct the moment the app returns from background (the suspension reconcile).
//
// MOTION (§07 / UI-SPEC §Motion): spring damping 18 / stiffness 220 (the Forge
// §07 default, PrBanner :70). Enter = translateY 24→0 + scale 0.96→1 (PrBanner
// animates scale only — the timer banner extends the shared-value set with
// translateY per UI-SPEC). Under useReducedMotion() the banner SNAPS to final
// (opacity only, no translate/scale) but the numeral still ticks (D-19).
//
// CRITICAL — NativeWind 4 box-decoration rule (project MEMORY
// `feedback_nativewind_box_deco_via_classname` / FIT-116 / Phase 13 D-04):
// bg + radius live in `className` so the banner has an OPAQUE Forge surface base
// (the absolute overlay floats over opaque exercise cards — without an opaque
// fill the card title behind it bleeds through). border + shadow + the animated
// transform live in the inline `style`. NEVER put bg/radius/border-color in the
// style() callback — NativeWind 4 renders the box NAKED that way.
//
// COLOR (UI-SPEC §Color): the timer is NOT a destructive feature — it NEVER
// reads red/success. `[+30s]` (the affirmative "give me more time") = accent-soft
// fill. `[Hoppa över]` (a calm, friction-free exit) = neutral ghost (forge-text2
// on forge-surface2), NEVER forge-danger.
//
// References:
//   - app/components/ui/PrBanner.tsx (THE clone target — floating overlay, SPRING
//     :70-73, useReducedMotion snap :120-144, useEffect cleanup :137-140, opaque-
//     surface box-decoration-via-className :173-198, tabular-nums numeral :271-278)
//   - app/components/ui/SettingsRow.tsx :70 (the 44px hitSlop control idiom)
//   - app/lib/rest-timer.ts (remainingMs / formatMSS — 14-01; the display recompute)
//   - app/lib/rest-timer-store.ts (useRestTimerStore — 14-02; endTs + skip/extend)
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-UI-SPEC.md
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-RESEARCH.md §Pattern 2 / §Pitfall 2 / §Pitfall 5

import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";

import { formatMSS, remainingMs } from "@/lib/rest-timer";
import { useRestTimerStore } from "@/lib/rest-timer-store";

// §07 motion spec — damping 18 / stiffness 220 (PrBanner.tsx:71, Forge §07).
const SPRING = { damping: 18, stiffness: 220 } as const;

// Generous touch target (device-UAT: controls too small for wider fingers). The
// visual chip is ~42px tall with the padding below; 10px slop on each axis lifts
// the tappable area well past the iOS 44px floor.
const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/**
 * Notification content forwarded to the store's `extend()` so the reschedule
 * keeps the localized title/body (sessionId-only data payload, D-15). Supplied
 * by the consumer ([sessionId].tsx) so the i18n strings resolve at the route.
 */
export type RestNotificationContent = {
  title: string;
  body: string;
  sessionId: string;
};

export type RestTimerBannerProps = {
  /** Notification content for the +30s reschedule (D-02 / D-15). */
  content: RestNotificationContent;
  /** Banner width in px (kept for parity with the PrBanner overlay slot). */
  width: number;
};

export function RestTimerBanner({ content }: RestTimerBannerProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Authoritative timer state (TIMER-02). The numeral is derived from endTs,
  // never stored as a decrementing counter.
  const endTs = useRestTimerStore((s) => s.endTs);

  // Display-only re-render driver (RESEARCH §Pattern 2 / §Pitfall 2): a 1s
  // interval refreshes `now` so the figure re-derives against the live clock.
  // There is intentionally NO stored decrementing second-count — the figure is
  // always `endTs − now`, derived, never mutated.
  //
  // CRITICAL — React Compiler (app.json experiments.reactCompiler: true):
  // `now` MUST be reactive STATE, not an unused tick + `Date.now()` read inside
  // render. The compiler memoizes the figure keyed on its reactive inputs only;
  // a bare `Date.now()` is a non-reactive constant, so an unused-tick re-render
  // would serve the CACHED figure (frozen at the start value, FIT device-UAT).
  // Storing `now` in state makes the clock a tracked dependency → recomputes
  // every tick under the compiler AND without it.
  const [now, setNow] = useState(() => Date.now());
  const forceTick = () => setNow(Date.now());

  // Total rest length for the depleting progress rail (UI-SPEC §Color line 95 /
  // §Motion line 112). Captured as the remaining time the moment endTs changes —
  // the store does not expose a duration (D-24: store logic unchanged), so the
  // snapshot at each transition is the rail's denominator. A fresh rest resets it
  // to the full duration; a +30s extend grows endTs so the snapshot refills the
  // rail proportionally. Reactive state → the width recomputes under the compiler.
  const [totalMs, setTotalMs] = useState(0);

  // MOTION (PrBanner precedent). Hooks run unconditionally (rules-of-hooks) —
  // the early `endTs === null` return happens AFTER all hooks.
  const reduced = useReducedMotion();
  const translateY = useSharedValue(24); // 24 → 0 entry (UI-SPEC §Motion)
  const scale = useSharedValue(0.96); // 0.96 → 1 entry
  // Live "rest in progress" pulse on the eyebrow dot (calm 1.6s breathe). Static
  // under reduce-motion (D-19).
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      // D-19: snap to final — banner still renders + ticks, no animation.
      translateY.value = 0;
      scale.value = 1;
    } else {
      translateY.value = withSpring(0, SPRING);
      scale.value = withSpring(1, SPRING);
    }
  }, [reduced, translateY, scale]);

  // Display-only 1s tick — bound to endTs so it restarts on a fresh rest and
  // tears down when the rest clears. Mirror PrBanner's cleanup discipline.
  useEffect(() => {
    if (endTs == null) return;
    const id = setInterval(forceTick, 1000);
    return () => clearInterval(id);
  }, [endTs]);

  // Capture the rail's total when the rest's endTs changes (new rest / +30s).
  useEffect(() => {
    if (endTs == null) {
      setTotalMs(0);
      return;
    }
    setTotalMs(Math.max(0, endTs - Date.now()));
  }, [endTs]);

  // Eyebrow dot pulse: opacity 1 → 0.4 → 1 over 1.6s, looped. Reduce-motion → 1.
  useEffect(() => {
    if (reduced) {
      pulse.value = 1;
    } else {
      pulse.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    }
  }, [reduced, pulse]);

  // AppState reconcile (TIMER-02): a return-from-background forces one re-render
  // so the numeral re-derives from endTs (the JS interval may have been
  // suspended while backgrounded). globalThis-sentinel teardown is unnecessary
  // here — this is a component-scoped listener removed on unmount.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") forceTick();
    });
    return () => sub.remove();
  }, []);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // No rest running → no banner (TIMER-02). AFTER all hooks (rules-of-hooks).
  if (endTs == null) return null;

  // The live figure — RE-DERIVED from endTs every render (TIMER-02). Never a
  // decrementing counter (Pitfall 2). At 0 the banner exits (foreground) — the
  // store clears endTs via skip/finish; a reached-zero foreground rest is a
  // caller concern, but we still render "0:00" gracefully until then.
  const remaining = remainingMs(endTs, now);
  const figure = formatMSS(remaining);
  // Depleting rail fraction (clamped 0..1). totalMs is the captured start length.
  const progress =
    totalMs > 0 ? Math.min(1, Math.max(0, remaining / totalMs)) : 0;

  return (
    // OUTER surface (box-decoration rule): OPAQUE Forge card bg + 20px radius
    // (forge-lg) in className; border + float shadow + animated transform in the
    // inline style. The opaque fill stops the card title behind it bleeding
    // through (FIT-116 / Phase 13 D-04).
    // OUTER wrapper: float shadow + 20px radius (for the shadow shape) + the
    // animated transform. No bg/overflow here so the shadow is never clipped.
    <Animated.View
      style={[
        {
          borderRadius: 20,
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        bannerStyle,
      ]}
      accessibilityRole="timer"
      accessibilityLabel={`${t("restLabel")} ${figure}`}
    >
      {/* INNER clipped surface (box-decoration rule): OPAQUE Forge bg + 20px
          radius in className; overflow-hidden so the bottom progress rail clips
          to the rounded corners; hairline border inline. */}
      <View
        className="overflow-hidden rounded-[20px] bg-forge-surface-light dark:bg-forge-surface"
        style={{
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
        }}
      >
        <View
          className="flex-row items-center"
          style={{ paddingVertical: 12, paddingHorizontal: 20, gap: 16 }}
        >
          {/* Left: eyebrow (pulsing live-dot + VILA) + the live M:SS numeral. */}
          <View style={{ flex: 1 }}>
            {/* Eyebrow row — a calm pulsing accent dot signals "rest running",
                then the uppercased tracked "VILA" label (muted forge-text2). */}
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Animated.View
                className="rounded-full bg-forge-accent-light dark:bg-forge-accent"
                style={[{ width: 7, height: 7 }, dotStyle]}
              />
              <Text
                className="font-display-bold text-forge-text2-light dark:text-forge-text2"
                style={{
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {t("restLabel")}
              </Text>
            </View>
          {/* Countdown numeral — 32px mono 700, tabular so M:SS width never
              reflows each second (DSGN-03 / UI-SPEC §Typography). React Native
              locks tabular figures via `fontVariant: ["tabular-nums"]` (the web
              CSS fontVariantNumeric / fontFeatureSettings props do NOT exist on a
              RN TextStyle — PrBanner.tsx:276 uses the same fontVariant idiom). */}
          <Text
            className="font-mono text-forge-text-light dark:text-forge-text"
            style={{
              fontSize: 32,
              fontWeight: "700",
              letterSpacing: -1,
              marginTop: 2,
              fontVariant: ["tabular-nums"],
            }}
          >
            {figure}
          </Text>
        </View>

        {/* Right: the two controls. [Hoppa över] (neutral ghost) then [+30s]
            (accent-soft affirmative). Both 44px hit-target via hitSlop. */}
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {/* [Hoppa över] — OUTLINE ghost (transparent fill + forge-borderStrong
              hairline), NEVER danger red (UI-SPEC §Color: skipping is a calm
              exit). Border in className per the NativeWind-4 box-decoration rule. */}
          <Pressable
            onPress={() => useRestTimerStore.getState().skip()}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t("restSkip")}
            className="rounded-full border border-forge-borderStrong-light px-7 py-[18px] dark:border-forge-borderStrong"
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
          >
            <Text
              className="font-display text-forge-text2-light dark:text-forge-text2"
              style={{ fontSize: 17 }}
            >
              {t("restSkip")}
            </Text>
          </Pressable>

          {/* [+30s] — accent-soft fill (the affirmative "more time" action). */}
          <Pressable
            onPress={() => useRestTimerStore.getState().extend(content)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t("restAdd30")}
            className="rounded-full bg-forge-accentSoft-light px-7 py-[18px] dark:bg-forge-accentSoft"
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
          >
            <Text
              className="font-display-bold text-forge-accent-light dark:text-forge-accent"
              style={{ fontSize: 17 }}
            >
              {t("restAdd30")}
            </Text>
          </Pressable>
        </View>
        </View>

        {/* Depleting progress rail (UI-SPEC §Color line 95 / §Motion line 112):
            a 3px track in forge-border with an accent fill of width =
            remaining/total. Re-derived each tick; the inner overflow-hidden clips
            it to the card's rounded bottom corners. */}
        <View
          className="bg-forge-border-light dark:bg-forge-border"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3 }}
        >
          <View
            className="bg-forge-accent-light dark:bg-forge-accent"
            style={{ height: 3, width: `${progress * 100}%` }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

export default RestTimerBanner;
