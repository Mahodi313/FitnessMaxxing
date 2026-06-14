# Phase 11: Active Workout Re-skin (HIGH RISK — F13) - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 3 modified (+ 1 shared locales file) — this is a RESTYLE-IN-PLACE phase, no net-new screen files
**Analogs found:** 3 / 3 (all in-repo Forge precedents)

> **READ THIS FIRST — frozen write path (D-17).** This is a *presentational* re-skin over a FROZEN offline-first mutation path. The planner MUST assign every modified file as "restyle existing components in place," never "create new file." The mutation hooks, keyboard wiring, overlay timer/cold-start logic, and `mutate`-not-`mutateAsync` calls are LOAD-BEARING and must survive byte-for-byte. The "MUST NOT CHANGE" subsections below enumerate them per file. `npm run test:f13-brutal` is a DB-integrity check (not a UI test) — it only stays green if the mutation path is untouched.

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `app/app/(app)/workout/[sessionId].tsx` | screen (component, hot path) | event-driven (optimistic offline mutation) + request-response (RHF forms) | `app/app/(app)/(tabs)/index.tsx` (Phase 10 Forge re-skin precedent) + `app/components/active-session-banner.tsx` (timer + accent pill) + Forge primitives | role + flow match (same file gets restyled, not replaced) |
| `app/app/(app)/(tabs)/index.tsx` → `DraftResumeOverlay` subcomponent (~L516) | component (inline overlay) | event-driven (force-decision on orphan draft) | self (already 80% Forge; FDraftResumeOverlay reference) | exact — re-skin chrome only |
| `app/app/(app)/(tabs)/index.tsx` → saved-toast (~L477) | component (transient toast) | request-response (edge-triggered) | self (already FadeIn/FadeOut) + FSavedToast reference | exact — re-skin chrome only |
| `app/locales/{sv,en}.json` | config (i18n) | transform | `app/locales/en.json` flat-key convention (existing) | exact |

**Sub-components inside `workout/[sessionId].tsx` to restyle in place** (NOT new files): `WorkoutScreen`, `WorkoutBody`, `ExerciseCard`, `LoggedSetRow`, `EditableSetRow`, `LastValueChip`, `AvslutaOverlay`, `formatTargetChip` (logic kept). Add a new `formatElapsed` import/copy for the header timer (D-07).

---

## Shared Patterns (apply across ALL re-skinned surfaces)

### Forge tokens + light/dark parity (apply to every restyled surface)
**Source:** `app/tailwind.config.js` (forge.* block L37+; radius scale L84-88) + `app/components/active-session-banner.tsx`
**Apply to:** every `View`/`Pressable`/`Text` className in this phase.

Radius scale (use these classes, NOT arbitrary `rounded-[Npx]` — Tailwind 3 purges off-scale arbitrary classes per Phase 10 Pitfall 3):
```
rounded-forge-sm = 10px   rounded-forge-md = 14px
rounded-forge-lg = 20px   rounded-forge-xl = 28px
```
Parity idiom (base `-light` class + `dark:` DEFAULT sibling) — copied verbatim from active-session-banner L114:
```tsx
className="... bg-forge-accentSoft-light dark:bg-forge-accentSoft border-forge-border-light dark:border-forge-border ..."
```
Token classes available: `forge-bg`, `forge-surface`, `forge-surface2`, `forge-surface3`, `forge-accent`, `forge-accentSoft`, `forge-accentText`, `forge-success`, `forge-danger`, `forge-text`, `forge-text2`, `forge-text3`, `forge-border` — each with a `-light` base sibling.

### NativeWind box-decoration rule (MANDATORY — root cause of the Phase 10 "naked re-skin" bug)
**Source:** `app/app/(app)/(tabs)/index.tsx` L367-372 + memory `feedback_nativewind_box_deco_via_classname.md`
**Apply to:** every `Pressable` in this phase (✕-delete, Klart button, input fields, overlay buttons, back button, finish pill).

Box styling (bg / border / radius / size) goes in `className`; the inline `style()` callback carries ONLY shadow / opacity / animated values:
```tsx
<Pressable
  className="flex-row items-center gap-3.5 py-4 px-[18px] rounded-forge-md border bg-forge-surface-light dark:bg-forge-surface border-forge-border-light dark:border-forge-border"
  style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
>
```
The FIT-66 accent-shadow exception (when a filled-accent button needs a glow) goes in the style callback:
```tsx
style={({ pressed }) => [
  { shadowColor: "#FF5A1F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16 },
  pressed ? { opacity: 0.85 } : null,
]}
```

### Forge primitives — import paths + exact props
**Source:** `app/components/ui/index.ts` (barrel) + `ForgeButton.tsx` / `ForgeCard.tsx` / `ForgeField.tsx` / `Icon.tsx`
**Apply to:** prefer these over hand-rolled Pressables wherever the shape fits.
```tsx
import { ForgeButton, ForgeCard, ForgeField, Icon } from "@/components/ui";
```
- **`ForgeButton`** — `{ label, variant?: "primary"|"secondary"|"ghost"|"destructive", size?: "lg"|"md"|"sm", icon?: IconName, iconPosition?: "leading"|"trailing", loading?, disabled?, fullWidth?, onPress }`. `primary` = filled accent + auto accent-shadow. `destructive` = transparent + danger text/border (the draft-resume "End session", D-16). Sizes: lg=58px, md=52px, sm=36px (no native 50px — see note below).
- **`ForgeCard`** — `{ children, padding?: "sm"|"md"|"lg", radius?: "md"|"lg"|"xl", tint?: "surface"|"accentSoft", interactive?, onPress }`. Non-interactive renders a plain bordered `View`. Use for the exercise-card shell.
- **`ForgeField`** — controlled TextInput, `{ value, onChangeText, placeholder?, icon?, keyboardType?, state?: "default"|"focused"|"error", multiline?, accessibilityLabel? }`. **DOES NOT expose** `inputMode` / `selectTextOnFocus` / `returnKeyType` / the display-value-with-unit-label layout (D-10). **→ For the hot-path set-input row, do NOT swap to ForgeField** — restyle the existing raw `TextInput` (the keyboard wiring must be preserved, see D-17). ForgeField is only viable for the Avsluta notes textarea (`multiline`) where wiring is simpler.
- **`Icon`** — `{ name: IconName, size, color, strokeWidth? }`. Confirmed available names this phase needs: `chevronLeft`, `check`, `checkCircle`, `clock`, `play`, `trash`, `close` (the ✕ delete), `list` (empty-state). **`trophy` exists but is OMITTED per D-06** — do not render it on the workout screen or the success rows.

### Haptics gate (MOTN-05 / D-12) — read pref, gate ONLY the haptic
**Source:** `app/lib/prefs.ts` `getPref` (L75) + `app/app/(app)/(tabs)/settings.tsx` L224 + `expo-haptics@~15.0.8` (installed)
**Apply to:** the new set-logged feedback in `ExerciseCard.onKlart` / `onSuccess`.
```tsx
import * as Haptics from "expo-haptics";
import { getPref } from "@/lib/prefs";

// fire-and-forget, NEVER awaited before the optimistic mutate (F13)
void getPref("fm:haptics").then((on) => {
  if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
});
```
`getPref("fm:haptics")` resolves a real `boolean` (default `true`, corrupt-tolerant via Zod `.catch`). The Reanimated VISUAL animation is NOT gated — only this `impactAsync` call is.

### Reanimated 4 motion (MOTN-01 / MOTN-04 / D-11) — already wired, no new dep
**Source:** `react-native-reanimated@~4.1.1` (installed) + `app/app/(app)/(tabs)/index.tsx` L56/L479 (toast `FadeIn/FadeOut` precedent) + `app/app/(app)/exercise/[exerciseId]/chart.tsx` L66 (`useSharedValue` precedent)
**Apply to:** set-logged row entrance + check-scale (MOTN-01); overlay backdrop+card spring (MOTN-04).
- Existing repo precedent for layout-animation entrance is the declarative `Animated.View entering={FadeIn.duration(200)}` (index.tsx L479). For the set-logged "slide in from bottom + check scale 0.8→1," use `SlideInDown`/an `entering` animation or a `useSharedValue` + `withSpring` per Claude's Discretion (D-11). Default spring curve from spec §07: **damping 18, stiffness 220**, ~220-240ms.
- Motion is fire-and-forget; it must NEVER block or precede `addSet.mutate` / `finishSession.mutate`.

---

## Pattern Assignments

### `app/app/(app)/workout/[sessionId].tsx` (screen, hot path)

**Primary analogs:** `app/app/(app)/(tabs)/index.tsx` (Phase 10 Forge re-skin idiom — TOKENS hex map, inline-overlay, FlatList card styling), `app/components/active-session-banner.tsx` (timer + accent pill), `app/design v2/Sources/design/forge-screens.jsx` `FWorkout` L335-545 (visual target).

#### MUST NOT CHANGE (D-17 frozen write path — restyle around these, never touch)
- **Imports/hooks L69-90:** `useAddSet/useUpdateSet/useRemoveSet` (scope-bound to `session:${sessionId}`), `useFinishSession`, `useSetsForSessionQuery`, `useSessionQuery`, `useLastValueQuery`, `usePersistenceStore`.
- **Hydration gate L145-158** (`if (!hydrated)`) and **loading gate L163-174** (`if (!session)`) — keep the early-returns; re-skin only their inner JSX (Forge tokens + i18n `t("restoringWorkout")` / `t("loading")`, D-13/D-14). The `Stack.Screen` inside them must flip to `headerShown:false` (D-09).
- **`useFocusEffect` cleanup L119-125** (overlay reset on blur) and **LoggedSetRow L628-632** (edit-mode reset on blur).
- **`onKlart` L377-410:** `addSet.mutate({...}, { onSuccess })` — keep `mutate` (NOT `mutateAsync`), keep the payload shape, keep `reset()` prefill in `onSuccess`. ADD the haptic + visual trigger here, fire-and-forget (D-11/D-12), AFTER the `mutate` call.
- **RHF wiring L349-373** (`useForm` `mode:"onSubmit"`, `defaultValues` prefill, the `useEffect` re-hydrate on prefill change) and **prefill logic L339-344** (`sessionPrefill ?? f7Prefill`). Untouched.
- **All `TextInput` keyboard props** (L489-494, L523-528, L558-564): `keyboardType="decimal-pad"/"number-pad"`, `inputMode`, `returnKeyType="done"`, `selectTextOnFocus`, `autoCorrect/autoCapitalize`. PRESERVE on the restyled fields (D-10). This is why the input row restyles the raw `TextInput`, NOT swaps to `ForgeField`.
- **`AvslutaOverlay` keyboard-height listener L865-881** + the `justifyContent`/`paddingBottom = keyboardHeight + 16` logic L932-934 (UAT 2026-05-16 fix) — PRESERVE. Restyle the inner card only.
- **`finishSession.mutate` L895-906** in `handleConfirm` — keep `mutate`, keep `notes` in payload, keep synchronous `onFinish()` navigation after.
- **Second `<OfflineBanner />` instance L206** — keep mounted.
- **`useLocalSearchParams` narrowing L111-113** (sessionId array-guard) — keep.

#### Header — current vs target (D-07/D-09)
**Current** (restyle target): `Stack.Screen` with `headerShown:true, title:"Pass"` + `headerRight` Avsluta Pressable, L182-200.
**Target** — flip to `headerShown:false`, render in-content Forge header. Reference `FWorkout` L341-360:
```jsx
// FWorkout header reference (forge-screens.jsx L341-360):
//   left  : 40px circle, surface bg + border, chevronLeft icon (back)
//   center: accentSoft pill, 6px accent dot + "42:18" timer (13px, tabular, accent)
//   right : 36px accent pill button, accentText label "Finish/Avsluta"
```
Timer logic to copy — **`formatElapsed` from `active-session-banner.tsx` L39-46** (mm:ss / h:mm:ss), driven by a `setInterval(1000)` ticker off `session.started_at` (banner L63-69 shows the exact `now`/`setInterval` pattern):
```tsx
const startedAt = session?.started_at;
const [now, setNow] = useState(() => Date.now());
useEffect(() => {
  if (!startedAt) return;
  setNow(Date.now());
  const interval = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(interval);
}, [startedAt]);
const timer = startedAt ? formatElapsed(now - new Date(startedAt).getTime()) : null;
```
Timer pill ink uses `style={{ fontVariant: ["tabular-nums"] }}` (banner L122) for figure alignment.

#### Per-card progress dots (D-02) — replaces the "3/4 set klart" counter chip
**Current** (delete): counter chip L414-461 (`counterChipText` green/grey pill).
**Target** — `FWorkout` L373-387 dot strip: flex row of `6px`-tall bars (`flex:1`, `borderRadius:3`), `done`=accent fill, `current`=accentSoft fill + accent border, `remaining`=surface2 fill, trailing "N / M" counter (`text2`, tabular). Drop the "Övning 1/6" global label and "Up next" card (D-01). Keep `formatTargetChip` (L1018) for the plan-target chip if retained.

#### Logged-set table (D-03/D-04/D-05) — replaces `LoggedSetRow`'s row + swipe
**Current** (restyle): `LoggedSetRow` L618-695 (Ionicons checkmark + "Set N" + "w × r", wrapped in `ReanimatedSwipeable` for swipe-delete).
**Target** — `FWorkout` L415-466 set-table: grid `32px 1fr 1fr 56px 36px` (# · weight · reps · RPE · action), 10px uppercase column headers (L421-433), set-number badge = accent circle w/ accentText numeral (L441-446), display-font numerals + `kg` unit suffix (L447-449), RPE always-rendered with muted `–` when null (D-05). **REMOVE `ReanimatedSwipeable`** — replace with a trailing `<Icon name="close" />` ✕-delete (D-04), muted `text2/text3`, `hitSlop` to 44px, `accessibilityLabel={t("removeSet")}`. **Tap row still enters `EditableSetRow`** (preserve the `setIsEditing(true)` → `EditableSetRow` flow L637-654). Success column = plain `<Icon name="checkCircle" color={forge-success} />` (NO trophy — D-06).
- `removeSet.mutate({ id, session_id })` L657 unchanged; `updateSet.mutate` L643-648 unchanged. Restyle `EditableSetRow` L700-796 to Forge tokens but keep its RHF/keyboard wiring.
- Can drop `GestureHandlerRootView`/`ReanimatedSwipeable` imports (L56-57) once swipe is gone.

#### Set-input row (D-10) — restyle raw TextInputs, preserve wiring
**Current** (restyle): the always-visible input row L478-591 (3 `TextInput` + "Klart" Pressable).
**Target** — `FWorkout` L468-495 + `ForgeInput` L526-545: accent-tinted card footer (`rgba(accent,0.04-0.05)` bg), "SET N" accent uppercase label + "Förra: {w} × {r}" prev-value (L473-479), grid `1fr 1fr 60px` of 56px fields where each field shows a **large display value (~22px) with a small uppercase unit label underneath** (KG/REPS/RPE), then a full-width **50px** accent "Klart/Done" button with a leading check icon (L486-494).
- 50px CTA height is a *component* height (UI-SPEC Spacing exception) — `ForgeButton` has no 50px size; use a hand-rolled Pressable with box styling in className (`h-[50px] rounded-forge-md bg-forge-accent-light dark:bg-forge-accent w-full`) + `Icon name="check"` + `t("done")`, OR `ForgeButton size="md"` (52px) if the 2px is acceptable. Per Claude's Discretion.
- The "Förra:" prev-value is the existing `LastValueChip` (L802-824) data — fold it into the input-row header per the mock instead of the separate chip below.

#### Avsluta finish overlay (D-08/D-15/D-16) — restyle `AvslutaOverlay` in place
**Current** (restyle): `AvslutaOverlay` L843-1012 (absolute scrim Pressable + inner card, notes TextInput + counter, Fortsätt/Avsluta buttons).
**Target** — `FFinishOverlay` L1590-1700 + `FFOStat` L1684-1701: trophy-block hero (gradient icon block — this is the overlay's OWN icon, NOT the omitted PR banner; use `LinearGradient` like index.tsx L199-213, `Icon name="trophy"` IS allowed here per the layout note), 26px display heading, body copy, notes textarea + "N/500" counter (keep existing notes state/counter L967-985), **NEW 3-cell stats row** (D-08): `{N} set` / `{Σ w×r} kg` / `{MM:SS} min` derived client-side from `setsData` already in scope (`loggedSetCount` + reduce over sets + elapsed since `started_at`). Buttons: neutral "Fortsätt/Continue" (`surface3`) + accent "Avsluta/Finish" (filled accent + check, D-16 — NOT red).
- PRESERVE: backdrop-tap dismiss (`onPress={onCancel}` L937), inner-Pressable touch-claim (L947-950), keyboard-height lift (L932-934), notes-reset-on-unmount (L859).
- ADD MOTN-04 spring: backdrop opacity 0→0.5 + card translateY 24→0 (damping 18 / stiffness 220), inline-rendered (no Modal portal — D-15).

#### Empty-state (D-13) + loading copy (D-14)
**Current** (restyle): `WorkoutBody` empty-state L247-269 (Ionicons `list-outline` + hardcoded Swedish + blue Pressable).
**Target** — Forge tokens: `<Icon name="list" />` in a surface2 tile (mirror index.tsx empty-state L305-357 structure), `t("nothingToLog")` heading + `t("nothingToLogBody")` body + a `ForgeButton variant="primary"` back button. i18n the loading screens too (`t("restoringWorkout")`, `t("loading")`).

#### i18n sweep (D-14)
Replace ALL hardcoded literals (`"Pass"`, `"Avsluta"`, `"Vikt"`, `"Reps"`, `"Klart"`, `"Ta bort"`, `"Avsluta passet?"`, `"Förra:"`, `"Anteckningar (valfri)"`, empty/loading copy, etc.) with `t()` calls. Add `useTranslation()` (the screen does not import it yet) — copy the pattern from `active-session-banner.tsx` L31/L51 (`import { useTranslation } from "react-i18next"; const { t } = useTranslation();`). Add flat keys to `app/locales/{sv,en}.json` per the Copywriting Contract table (UI-SPEC L117-137).

---

### `app/app/(app)/(tabs)/index.tsx` — DraftResumeOverlay + saved-toast (chrome only)

**Analog:** self (already 80% Forge) + `FDraftResumeOverlay` L1817-1928 / `FSavedToast` L1933+ references.

#### MUST NOT CHANGE (offline-critical logic — restyle chrome only, lines 25-27 warn this)
- **Cold-start detection L121-133** (`coldStartSessionId` state capture, `isColdStartDraft`, `shouldShowDraftOverlay`).
- **Toast edge-trigger L139-148** (`previousActiveRef` transition watcher, 2s `setTimeout`).
- **`DraftResumeOverlay.handleAvslutaSession` L532-542** (`finishSession.mutate` NOT `mutateAsync`, `onDismiss()` after).
- **`onStartShouldSetResponder` touch-claim L553** and the **NO-onPress backdrop** (force-decision, no dismiss — L549-551).

#### DraftResumeOverlay restyle (D-16) — target `FDraftResumeOverlay` L1817-1928
Current overlay (L516-623) already uses `tk` token map + a meta-less 2-button row. Bring it to the full mock: pulsing-dot icon block (L1850-1865), meta strip with `clock` icon + plan name + "{N} set" + "Live" pill (L1876-1901), then **primary "Återuppta/Resume" (accent + `play` icon, full-width 56px, L1905-1914)** ABOVE **secondary "Avsluta sessionen/End session" (DANGER ghost — transparent bg, `danger` text, border, L1915-1922)**. The current code colors "End session" as neutral `surface2` (L587) — **change it to danger ghost per D-16** (`ForgeButton variant="destructive"` is the exact match). Add MOTN-04 spring entrance.

#### Saved-toast restyle (D-11 spring) — target `FSavedToast` L1933+
Current toast (L477-505) is a `surface` pill with `Icon name="check"` accent. Mock target = **success-colored pill** (`forge-success` bg, white check in a translucent circle, L1943-1958), bottom-centered above tab bar. Keep the `Animated.View entering={FadeIn} exiting={FadeOut}` wrapper (L478-480) — optionally upgrade to the MOTN-04 spring. Copy `t("sessionSaved")` unchanged.

---

### `app/locales/{sv,en}.json` (config, i18n)

**Analog:** existing flat-key structure (`en.json` L130-153 shows the convention — flat top-level keys, no nesting, 1:1 sv/en parity).
Add the new workout/overlay keys (flat, both files) per the UI-SPEC Copywriting Contract. New keys to add (names per Claude's Discretion / Phase 8 D-10 flat convention): `done`, `finish`, `weight`, `reps`, `rpe`, `setN` (or interpolated `"Set {{n}}"`), `previous` (interpolated `"Förra: {{w}} × {{r}}"`), `removeSet`, `finishWorkoutQ`, `finishBody` (interpolated `{{count}}`/`{{time}}`), `continue`, `nothingToLog`, `nothingToLogBody`, `restoringWorkout`, `loading`, `finishError`, plus the finish-stats cell labels (`sets`, reuse `kg`, `min`). Note `resume`/`finishSession`/`resumeSession`/`sessionSaved`/`exercises` ALREADY exist (used by index.tsx + banner) — reuse, do not duplicate.

---

## No Analog Found

None — every surface in this phase has a strong in-repo Forge precedent. The only genuinely *new* visual element is the finish-overlay 3-cell stats row (D-08), and even that maps 1:1 to `FFOStat` (forge-screens.jsx L1684-1701) + the existing `ForgeStat` primitive shape; the data derivation is trivial client-side reduction over `useSetsForSessionQuery` data already in scope.

---

## Metadata

**Analog search scope:** `app/app/(app)/workout/`, `app/app/(app)/(tabs)/`, `app/components/`, `app/components/ui/`, `app/lib/`, `app/locales/`, `app/design v2/Sources/design/`
**Files scanned:** workout/[sessionId].tsx, active-session-banner.tsx, (tabs)/index.tsx, ui/{index,ForgeButton,ForgeCard,ForgeField,Icon}, lib/prefs.ts, settings.tsx, locales/en.json, forge-screens.jsx (FWorkout/ForgeInput/FFinishOverlay/FFOStat/FDraftResumeOverlay/FSavedToast), tailwind.config.js
**Stack verified:** `expo-haptics@~15.0.8` + `react-native-reanimated@~4.1.1` both installed — no new dep for D-11/D-12.
**Pattern extraction date:** 2026-06-13
