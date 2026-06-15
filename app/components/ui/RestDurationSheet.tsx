// app/components/ui/RestDurationSheet.tsx
//
// Phase 14 (Rest Timer, F19) — device-UAT design iteration (2026-06-15).
// A custom Forge-skinned bottom sheet for picking the rest duration, REPLACING
// the raw iOS `ActionSheetIOS` the picker shipped with. The native action sheet
// rendered as generic translucent system pills with zero Forge identity — jarring
// in an otherwise fully custom-designed app (device-UAT: "jag gillar inte den som
// man väljer tid på"). This sheet is dark Forge surface, a grabber, real rows with
// an accent check on the selected value, and an "Anpassad…" action row.
//
// INLINE-OVERLAY, NOT a Modal portal (project convention D-22 / AvslutaOverlay
// [sessionId].tsx:1432): a RN Modal collapses NativeWind/flex layout here, so the
// established pattern is an absolute-fill overlay rendered inline at the screen
// root with the layout primitives styled via explicit RN `style` (NativeWind only
// on inner row content). The parent gates mount (`{open && <RestDurationSheet/>}`);
// entry animates on mount, dismissal simply unmounts (matches AvslutaOverlay).
//
// MOTION (Forge §07 — LOCKED): backdrop opacity 0→0.5 + card translateY spring
// (damping 18 / stiffness 220, the same shared spring AvslutaOverlay / PrBanner /
// RestTimerBanner use). Reduce-motion → snap to final (no translate), per D-19.
//
// COLOR: the selected row reads an accent check (never red — picking a duration is
// not destructive). Surface + radius live in `className` (NativeWind-4 box-
// decoration rule, FIT-116); shadow + animated transform live inline.

import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";

import { Icon } from "./Icon";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 220 } as const;
const ACCENT = "#E14E10";

export type RestDurationOption = {
  /** Stored value in seconds (matches fm:restSeconds). */
  seconds: number;
  /** Display label ("1 min" / "1:30"). */
  label: string;
};

export type RestDurationSheetProps = {
  /** The currently-persisted duration (seconds) — gets the accent check. */
  selectedSeconds: number;
  /** Preset rows, in display order. */
  options: RestDurationOption[];
  /** Sheet title (t("restDuration") → "Vilotid"). */
  title: string;
  /** Custom-entry row label (t("restCustom") → "Anpassad"). */
  customLabel: string;
  /** Pick a preset → persist + close. */
  onSelect: (seconds: number) => void;
  /** Open the custom numeric entry → close this sheet. */
  onCustom: () => void;
  /** Backdrop tap / after a pick → unmount. */
  onClose: () => void;
};

export function RestDurationSheet({
  selectedSeconds,
  options,
  title,
  customLabel,
  onSelect,
  onCustom,
  onClose,
}: RestDurationSheetProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const reduced = useReducedMotion();

  const backdropOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(420); // off-screen below → springs up

  useEffect(() => {
    if (reduced) {
      backdropOpacity.value = 0.5;
      cardTranslateY.value = 0;
    } else {
      backdropOpacity.value = withSpring(0.5, SPRING);
      cardTranslateY.value = withSpring(0, SPRING);
    }
  }, [reduced, backdropOpacity, cardTranslateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${backdropOpacity.value})`,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const pick = (seconds: number) => {
    onSelect(seconds);
    onClose();
  };

  return (
    <AnimatedPressable
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "flex-end",
          zIndex: 2000,
        },
        backdropStyle,
      ]}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {/* Inner Pressable claims the touch so a tap on the card never falls
          through to the backdrop dismiss (PATTERNS landmine #6 / AvslutaOverlay). */}
      <Pressable onPress={() => {}}>
        {/* Edge-to-edge sheet, rounded top only (forge-xl 28px). Opaque Forge
            surface + radius in className; shadow + animated transform inline. */}
        <Animated.View
          className="rounded-t-forge-xl bg-forge-surface-light dark:bg-forge-surface"
          style={[
            cardStyle,
            {
              paddingBottom: insets.bottom + 12,
              borderTopWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.07)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: isDark ? 0.4 : 0.14,
              shadowRadius: 24,
              elevation: 12,
            },
          ]}
        >
          {/* Grabber. */}
          <View className="items-center" style={{ paddingTop: 8 }}>
            <View
              className="rounded-full bg-forge-border-light dark:bg-forge-surface3"
              style={{ width: 36, height: 5 }}
            />
          </View>

          {/* Title — centered, muted tracked eyebrow (matches section headers). */}
          <Text
            className="text-center text-forge-text2-light dark:text-forge-text2"
            style={{
              fontSize: 12,
              fontWeight: "600",
              letterSpacing: 1,
              textTransform: "uppercase",
              paddingTop: 14,
              paddingBottom: 10,
            }}
          >
            {title}
          </Text>

          {/* Preset rows + the Anpassad action row. */}
          <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
            {options.map((opt) => {
              const selected = opt.seconds === selectedSeconds;
              return (
                <Pressable
                  key={opt.seconds}
                  onPress={() => pick(opt.seconds)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.label}
                  className="flex-row items-center justify-between rounded-forge-md px-4"
                  style={({ pressed }) => [
                    { height: 54 },
                    pressed
                      ? {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.04)",
                        }
                      : null,
                  ]}
                >
                  <Text
                    className={
                      selected
                        ? "text-forge-accent-light dark:text-forge-accent"
                        : "text-forge-text-light dark:text-forge-text"
                    }
                    style={{ fontSize: 17, fontWeight: selected ? "700" : "500" }}
                  >
                    {opt.label}
                  </Text>
                  {selected ? (
                    <Icon name="check" size={20} color={ACCENT} strokeWidth={2.4} />
                  ) : null}
                </Pressable>
              );
            })}

            {/* Hairline separating presets from the custom action. */}
            <View
              className="bg-forge-border-light dark:bg-forge-border"
              style={{ height: 1, marginVertical: 6, marginHorizontal: 4 }}
            />

            {/* Anpassad… — opens the numeric entry (chevron signals "more"). */}
            <Pressable
              onPress={() => {
                onCustom();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={customLabel}
              className="flex-row items-center justify-between rounded-forge-md px-4"
              style={({ pressed }) => [
                { height: 54 },
                pressed
                  ? {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.04)",
                    }
                  : null,
              ]}
            >
              <Text
                className="text-forge-text-light dark:text-forge-text"
                style={{ fontSize: 17, fontWeight: "500" }}
              >
                {customLabel}
              </Text>
              <Icon
                name="chevronRight"
                size={18}
                color={isDark ? "rgba(255,255,255,0.5)" : "#8B8B8B"}
              />
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </AnimatedPressable>
  );
}

export default RestDurationSheet;
