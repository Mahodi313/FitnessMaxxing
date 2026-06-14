# Phase 14: Rest Timer (F19) — RESEARCH-FLAGGED - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 11 (4 new, 7 modified)
**Analogs found:** 11 / 11 (every new/modified file has an in-repo analog)

> Read-side + fire-and-forget phase. The hot path (`addSet.mutate`) is sacred — every new behavior layers on top of existing, proven idioms. This map points each new file at the exact existing file + line range to copy from. The planner should reference these excerpts directly in each PLAN.md action.

---

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `app/lib/rest-timer.ts` | NEW | utility (pure logic) | transform | `app/lib/e1rm.ts` (+ `app/lib/units.ts`) | exact (pure number/string module) |
| `app/lib/rest-timer-store.ts` | NEW | store (Zustand) | event-driven | `app/lib/units-store.ts` | exact (plain `create`, no persist) |
| `app/lib/notifications.ts` | NEW | service (native-bound) | event-driven / I/O | `app/lib/query/network.ts` (AppState/sentinel) + `app/lib/prefs.ts` (fail-soft I/O) | role-match |
| `app/scripts/test-rest-timer.ts` | NEW | test | batch / transform | `app/scripts/test-units.ts` | exact (Case[] table + exit-code) |
| `app/components/ui/RestTimerBanner.tsx` | NEW | component | event-driven (display) | `app/components/ui/PrBanner.tsx` | exact (floating overlay banner, Reanimated motion) |
| `app/lib/prefs.ts` | MODIFY | config (typed pref) | CRUD (AsyncStorage) | self (`fm:notifications` / `fm:haptics` idiom) | exact |
| `app/app/(app)/workout/[sessionId].tsx` | MODIFY | screen (controller) | event-driven | self (PR-banner overlay `:469`, post-mutate haptic `:676`) | exact |
| `app/app/(app)/(tabs)/settings.tsx` | MODIFY | screen (controller) | request-response | self (`onNotificationsToggle` `:319`, `openUnitsSheet` `:281`) | exact |
| `app/app/_layout.tsx` | MODIFY | provider (module-scope wiring) | event-driven | `app/lib/query/network.ts` (globalThis sentinel) | role-match |
| `app/locales/{sv,en}.json` | MODIFY | config (i18n) | — | self (flat-key block `:187`) | exact |
| `app/package.json` + `app.json` | MODIFY | config | — | self (`test:units` script `:15`; plugins array `app.json:31`) | exact |

---

## Pattern Assignments

### `app/lib/rest-timer.ts` (NEW — utility, pure transform)

**Analog:** `app/lib/e1rm.ts` (structural twin) + `app/lib/units.ts` (Pitfall-5 guard precedent).

This is the unit-testable heart of the phase: `remainingMs`, `formatMSS`, `decideNotificationAction`, `shouldFireNotification`, and the +30s extend math. No React, no Expo, no native — Node-importable from `test-rest-timer.ts` (the same import contract `test-units.ts` uses against `units.ts`).

**Header-comment + pure-function idiom** (`e1rm.ts:1-52` — copy this structure verbatim, swap the formula):
```typescript
// app/lib/rest-timer.ts
//
// Phase 14 (Rest Timer, F19), Plan 14-0X. Pure rest-timer math — no React, no
// Expo, no Supabase, no side effects. Importable from both the banner/store and
// the Node `tsx` test script (mirrors lib/e1rm.ts + lib/units.ts pure-module
// structure).
//
// Decisions:
//   - TIMER-02: remaining is ALWAYS re-derived from an absolute endTs (ms epoch),
//     never a decrementing counter — Math.max(0, endTs - now) clamps at 0.
//   - D-02: +30s extends endTs by 30_000.
//   - D-14: shouldFireNotification gates on (timerOn && masterOn && permission).
```

**Pitfall-5 non-finite guard** — copy from `e1rm.ts:47-52` (every public fn clamps non-finite to a safe value):
```typescript
export function epley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0; // units.ts Pitfall-5 precedent
  if (weightKg <= 0) return 0;
  if (reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}
```
Apply the same guard shape to `remainingMs(endTs, now)` (clamp at 0; guard non-finite) and `formatMSS(ms)` (guard non-finite → `"0:00"`). RESEARCH §Pattern 2 gives the exact `Math.max(0, endTs - now)` / `Math.ceil(ms/1000)` body.

**The D-14 gate predicate** (pure boolean — the cleanest unit-test target, RESEARCH §Validation Architecture):
```typescript
export function shouldFireNotification(timerOn: boolean, masterOn: boolean, permissionGranted: boolean): boolean {
  return timerOn && masterOn && permissionGranted; // D-14
}
```

---

### `app/lib/rest-timer-store.ts` (NEW — Zustand store, event-driven)

**Analog:** `app/lib/units-store.ts` (exact shape — plain `create`, NO persist middleware, NO subscribeWithSelector).

The single owner of `{ endTs, durationMs, notificationId, exerciseId }` + actions. RESEARCH §Pattern 2 recommends the store over a colocated hook so timer state survives banner unmount and is reachable from `_layout.tsx`'s notification-tap reconcile.

**Store skeleton** — copy `units-store.ts:34-57` (the `create<State>((set) => ({...}))` shape, the header "WHY A STORE" comment, and the durable-vs-mirror split):
```typescript
import { create } from "zustand";

type RestTimerState = {
  endTs: number | null;        // absolute ms epoch — authoritative (TIMER-02)
  notificationId: string | null;
  // actions mutate state + call into lib/notifications.ts (the native I/O side)
  start: (durationMs: number, exerciseId: string) => void;   // D-05/D-07
  extend: () => void;          // D-02 (+30s): endTs += 30_000, reschedule
  skip: () => void;            // D-02/TIMER-05: cancel + clear
  finish: () => void;          // session-end discretion default: cancel + clear
};

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  endTs: null,
  notificationId: null,
  start: (durationMs, exerciseId) => { /* set endTs; schedule; store id */ },
  // ...
}));
```
**Critical (units-store.ts:11-16 precedent):** plain `create`, no persist — timer state is transient OS-clock-backed, not a durable pref. The durable pieces (`fm:restSeconds`, `fm:restTimerEnabled`) live in `prefs.ts`, not here. The `getState()` call-from-outside-React pattern (`units-store.ts` used as `useUnitStore.getState().setUnit(...)` in `_layout.tsx:202` and `settings.tsx:276`) is exactly how `onKlart` fires `useRestTimerStore.getState().start(...)`.

---

### `app/lib/notifications.ts` (NEW — service, native-bound I/O)

**Analog:** `app/lib/query/network.ts` (the AppState-listener + globalThis Fast-Refresh sentinel idiom) + `app/lib/prefs.ts` (fail-soft `void …catch(console.warn)` I/O contract).

Thin wrapper over `expo-notifications`: `schedule(endTs, content)` → returns id, `cancel(id)`, `requestPermission()`, `getPermissionState()`. RESEARCH §Pattern 1 + §Pattern 4 give the exact `expo-notifications` API calls.

**Fail-soft async I/O** — copy the `prefs.ts:85-96` `setPref` shape (every write is voided + `.catch`-warned, never throws into the UI):
```typescript
void AsyncStorage.setItem(key, stored).catch(() => {
  console.warn(`[prefs] AsyncStorage write failed — ${key} not persisted`);
});
```
Apply identically: a `scheduleNotificationAsync` failure must warn-and-swallow (the in-app countdown still runs — D-12 graceful degradation), never reject into `onKlart`'s fire-and-forget block.

**Permission state machine** — RESEARCH §Pattern 4 (`getPermissionsAsync().canAskAgain === false` = blocked). This is native-bound, so it is NOT in `rest-timer.ts` (keep `rest-timer.ts` Node-pure); the pure GATE predicate (`shouldFireNotification`) lives in `rest-timer.ts`, the native permission READ lives here.

---

### `app/scripts/test-rest-timer.ts` (NEW — test, Case[] table)

**Analog:** `app/scripts/test-units.ts` (exact skeleton — Case[] table + loop + exit-code).

Imports ONLY `rest-timer.ts` (pure) — never the store, banner, or notifications (those are native/UAT). Covers TIMER-01 decision, TIMER-02 math, TIMER-04 schema round-trip, TIMER-05 reschedule-decision, SET-07 gate.

**Case[] table + matcher + exit-code** — copy `test-units.ts:22-29, 100-123` verbatim, swap the cases:
```typescript
type Case = {
  name: string;
  actual: number | string;
  expected: number | string;
  tol?: number; // optional float tolerance (Object.is would never match floats)
};

const cases: Case[] = [
  { name: "remainingMs(1000, 0) === 1000", actual: remainingMs(1000, 0), expected: 1000 },
  { name: "remainingMs(0, 1000) === 0 (clamped)", actual: remainingMs(0, 1000), expected: 0 },
  { name: "formatMSS(90000) === '1:30'", actual: formatMSS(90000), expected: "1:30" },
  { name: "shouldFireNotification(true,true,true) === true", actual: String(shouldFireNotification(true,true,true)), expected: "true" },
  { name: "shouldFireNotification(true,false,true) === false", actual: String(shouldFireNotification(true,false,true)), expected: "false" },
  // ...TIMER-05 decideNotificationAction cases
];

let failed = 0;
function matches(c: Case): boolean {
  if (c.tol !== undefined && typeof c.actual === "number" && typeof c.expected === "number") {
    return Math.abs(c.actual - c.expected) <= c.tol;
  }
  return Object.is(c.actual, c.expected);
}
for (const c of cases) { /* PASS/FAIL print, failed++ */ }
if (failed > 0) { console.error(`\n${failed} of ${cases.length} cases FAILED`); process.exit(1); }
console.log(`\nAll ${cases.length} cases passed.`); process.exit(0);
```

**package.json script** — copy `package.json:15` (`"test:units": "tsx scripts/test-units.ts"`):
```json
"test:rest-timer": "tsx scripts/test-rest-timer.ts",
```

---

### `app/components/ui/RestTimerBanner.tsx` (NEW — component, floating overlay)

**Analog:** `app/components/ui/PrBanner.tsx` (exact — floating overlay banner, Reanimated entry, `useReducedMotion` snap, opaque-surface rule, hit-target controls). No timer component exists in the Forge design source — compose from this precedent + Forge primitives.

**Motion + reduce-motion snap** — copy `PrBanner.tsx:70-73, 120-144`:
```typescript
const SPRING = { damping: 18, stiffness: 220 } as const; // Forge §07 default
const reduced = useReducedMotion();
const scale = useSharedValue(0.96); // 0.96 → 1 entry
useEffect(() => {
  if (reduced) { scale.value = 1; }                 // D-19: snap to final, still renders
  else { scale.value = withSpring(1, SPRING); }
}, [reduced, scale]);
const bannerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
```
UI-SPEC §Motion specifies `translateY 24→0 + scale 0.96→1` for the timer banner (vs PrBanner's scale-only) — extend the shared value set, keep the spring + reduce-motion branch identical.

**OPAQUE surface base (FIT-116 — Phase 13 D-04)** — copy `PrBanner.tsx:173-198`: bg + radius in `className`, border + shadow in inline `style` (NativeWind 4 box-decoration rule, project MEMORY `feedback_nativewind_box_deco_via_classname`):
```typescript
<Animated.View
  className="rounded-[16px] bg-forge-surface-light dark:bg-forge-surface"  // OPAQUE base — card title can't bleed through
  style={[{ borderWidth: 1, borderColor: ..., shadowColor: "#000", shadowOpacity: ..., shadowRadius: 12, elevation: 6 }, bannerStyle]}
>
```
UI-SPEC §Spacing says the timer banner uses `forge-lg` (20px) radius (vs PrBanner's 16px) — swap the radius token, keep everything else.

**tabular-nums countdown numeral** — copy `PrBanner.tsx:271-278` (the `fontVariant: ["tabular-nums"]` idiom); UI-SPEC §Typography mandates `tnum`/`ss01` so the `M:SS` width never reflows each second.

**Display-only tick** (NEW vs PrBanner's auto-dismiss timer) — RESEARCH §Pattern 2: a 1s `setInterval` that only bumps a `tick` state to force re-render; `remaining` is recomputed `remainingMs(endTs, Date.now())` each render, NEVER decremented. Mirror PrBanner's `useEffect` cleanup discipline (`:137-140`).

**44px hit-target controls** (`[Hoppa över]` / `[+30s]`) — UI-SPEC §Spacing exception; use `hitSlop` like `SettingsRow.tsx:70` Toggle (`hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}`). `[+30s]` = accent-soft fill, `[Hoppa över]` = neutral ghost (UI-SPEC §Color reserved-for list).

---

### `app/lib/prefs.ts` (MODIFY — config, typed pref)

**Analog:** itself — the `fm:notifications` / `fm:haptics` enum-catch idiom (`prefs.ts:46-69`). The `String(value)` serializer at `:90-92` already explicitly anticipates `fm:restSeconds`.

**Add two keys.** Numeric `fm:restSeconds` (default 120, D-10) + boolean `fm:restTimerEnabled` (default OFF, mirror `fm:notifications`):
```typescript
// fm:restSeconds — numeric. z.coerce.number over the stored STRING; .catch(120)
// keeps the read throw-free over null/garbage (T-09-01 lineage). RESEARCH §prefs.ts.
const restSecondsSchema = z.coerce.number().int().positive().catch(120);
// fm:restTimerEnabled — boolean, default OFF. EXACT fm:notifications enum-catch
// idiom (prefs.ts:50-53) — booleans stored as "true"/"false" strings, never JSON.
const restTimerEnabledSchema = z
  .enum(["true", "false"])
  .catch("false")
  .transform((s) => s === "true");
```
**Wire into `PrefMap` (`:56-61`) AND `SCHEMAS` (`:64-69`)** — add `"fm:restSeconds": number` and `"fm:restTimerEnabled": boolean` to both. The generic `getPref`/`setPref` (`:75-96`) then handle them with zero further change — the `String(value)` branch already serializes a number correctly (that's the `:86-90` comment's whole point).

**Critical (prefs.ts:15-18 header):** booleans are stored as `"true"`/`"false"` STRINGS, never `JSON.parse`'d — `JSON.parse` throws on garbage BEFORE `.catch` fires. The enum-catch-transform is the throw-free equivalent. `fm:restSeconds` uses `z.coerce.number(...).catch(120)` for the same total-over-`unknown` guarantee.

---

### `app/app/(app)/workout/[sessionId].tsx` (MODIFY — screen, hot path)

**Analog:** itself — the PR-banner overlay stack (`:469-491`) + the post-mutate fire-and-forget haptic block (`:676-678`).

**Auto-start hook — fire-and-forget AFTER `addSet.mutate`** (D-05/D-06). Copy the placement + voided-promise discipline of `:676-678`, place the new block right after it (RESEARCH §Pattern 3):
```typescript
// EXISTING, copy this shape (:676-678):
void getPref("fm:haptics").then((on) => {
  if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
});

// NEW — same fire-and-forget contract, AFTER the mutate, NEVER awaited (D-05):
void getPref("fm:restTimerEnabled").then((enabled) => {
  if (!enabled) return;
  void getPref("fm:restSeconds").then((sec) => {
    useRestTimerStore.getState().start(sec * 1000, planExercise.exercise_id);
  });
});
```
`onKlart` only ever logs `set_type: "working"` (`:650`), so D-06 (working-sets-only) holds for free — same as the PR-detection block's comment at `:698-699`. **F13 contract:** never await this; never move it before/into `addSet.mutate`. `npm run test:f13-brutal` must stay green (known amber FIT-107 is environmental).

**Floating banner in the overlay stack** (D-01/D-04). Copy the `position:"absolute"` + `pointerEvents="box-none"` overlay block at `:469-491` — the timer banner mounts in the SAME slot the PrBanner uses:
```typescript
{banners.length > 0 && overlayWidth > 0 && (
  <View pointerEvents="box-none" style={{ position: "absolute", top: 12, left: 16, right: 16 }}>
    {/* PrBanner stack */}
  </View>
)}
```
**D-04 handoff:** when a set is both a PR and starts a rest, the PrBanner occupies the top slot first (~600ms+dwell), then the RestTimerBanner takes it. The timer's `endTs` is set at log-time regardless (logical start ≠ visual mount). Single banner in the top slot at a time — coordinate via the existing `banners` state / a derived "is a PR banner showing" check. **Geometry rule (D-01, same as PR D-09):** absolute overlay, `pointerEvents="box-none"`, NEVER in the flex flow — the set list / input row / Klart never shift.

---

### `app/app/(app)/(tabs)/settings.tsx` (MODIFY — screen)

**Analog:** itself — `onNotificationsToggle` (`:319-322`) + `openUnitsSheet` ActionSheetIOS picker (`:281-292`) + the mount-load `getPref` block (`:229-230`) + the SettingsRow JSX (`:488-495`).

**State + mount-load** — copy `:213-214` + `:229-230`:
```typescript
const [restTimerEnabled, setRestTimerEnabled] = useState(false);
const [restSeconds, setRestSeconds] = useState(120);
// in the mount useEffect (:220-231):
void getPref("fm:restTimerEnabled").then(setRestTimerEnabled);
void getPref("fm:restSeconds").then(setRestSeconds);
```

**Enable toggle WITH permission prompt (D-13)** — extend the `onNotificationsToggle` shape (`:319-322`) with the RESEARCH §Pattern 4 permission flow:
```typescript
// EXISTING shape (:319-322):
const onNotificationsToggle = (next: boolean) => {
  setNotifications(next);
  setPref("fm:notifications", next);
};

// NEW — same set-state-then-persist shape, PLUS in-context permission prompt on enable (D-13):
const onRestTimerToggle = async (next: boolean) => {
  if (next) {
    const state = await ensureNotificationPermission(); // lib/notifications.ts (RESEARCH Pattern 4)
    // reflect granted/denied/blocked into the row; D-12: enable anyway (in-app countdown works)
  }
  setRestTimerEnabled(next);
  setPref("fm:restTimerEnabled", next);
};
```

**Duration picker** — copy the `openUnitsSheet` ActionSheetIOS idiom (`:281-292`); RESEARCH Open-Q 2 recommends presets `60/90/120/180/300` + "Anpassad". V1 is iOS-locked so ActionSheetIOS is the correct native picker (`:280` comment):
```typescript
ActionSheetIOS.showActionSheetWithOptions(
  { options: ["1 min", "1:30", "2 min", "3 min", "5 min", t("restCustom"), t("cancel")], cancelButtonIndex: 6 },
  (index) => { /* map index → seconds → setPref("fm:restSeconds", …) */ },
);
```

**The rows** — copy `:488-495`. The `restTimer` row is a `chevron` disclosure (value `"På · 2 min"` / `"Av"`, D-08/D-10/D-11); the existing `notifications` bell row (`:488-495`) is unchanged (master gate, D-14 — wiring only). Both live in or beside the existing `notifications` SettingsSection (`:480`). Use `value={restTimerEnabled ? t("on") + " · " + dur : t("off")}` + `chevron onPress={openRestDurationSheet}`.

---

### `app/app/_layout.tsx` (MODIFY — provider, module-scope wiring)

**Analog:** `app/lib/query/network.ts` (the globalThis Fast-Refresh sentinel — `network.ts:96-112`). RESEARCH §Pattern 5 + §Pitfall 7.

**`setNotificationHandler` + `addNotificationResponseReceivedListener`** at module scope, guarded by a globalThis sentinel exactly like `APPSTATE_BGFLUSH_KEY`. Copy `network.ts:96-112`:
```typescript
// EXISTING precedent (network.ts:96-112) — copy this sentinel pattern:
const APPSTATE_BGFLUSH_KEY = "__fitnessmaxxing_appstate_bgflush_sub__";
const globalRef = globalThis as unknown as Record<string, { remove: () => void } | undefined>;
if (globalRef[APPSTATE_BGFLUSH_KEY]) { globalRef[APPSTATE_BGFLUSH_KEY].remove(); }
const sub = AppState.addEventListener(...);
globalRef[APPSTATE_BGFLUSH_KEY] = sub;
```
Apply identically to the notification-response listener (a NEW sentinel key, e.g. `__fitnessmaxxing_notif_response_sub__`) so Fast Refresh doesn't stack listeners (Pitfall 7 — N taps → N route pushes). RESEARCH §Pattern 5 gives the `setNotificationHandler` body (`shouldShowBanner`/`shouldShowList`, NOT deprecated `shouldShowAlert`).

**Tap deep-link (M4 anti-phishing, D-15):** route ONLY into the in-app `(app)` group, never `Linking.openURL`. Validate `data.sessionId` is a non-empty string before `router.push(`/(app)/workout/${sessionId}`)`. Wiring style mirrors the existing side-effect imports in `_layout.tsx:31-65` — either an `import "@/lib/notifications-wiring"` side-effect module (cleanest; mirrors `import "@/lib/query/network"` at `:33`) or a Bootstrap component (mirrors `UnitsBootstrap` `:200-205`). Planner's call.

---

### `app/locales/{sv,en}.json` + `app/lib/i18n.ts` (MODIFY — i18n)

**Analog:** `sv.json:187-194` (the flat-key Settings block — `restTimer` already exists at `:188`). `i18n.ts` needs NO change (it already loads both files; flat keys auto-resolve — `i18n.ts:37-46`).

**Add flat keys at sv+en parity** (UI-SPEC §Copywriting, planner finalizes key names). Insert beside the existing `restTimer`/`notifications`/`haptics` block (`sv.json:187-189`):
```json
"restAdd30": "+30 s",
"restSkip": "Hoppa över",
"restLabel": "Vila",
"restDuration": "Vilotid",
"restCustom": "Anpassad",
"restNoPermission": "Notiser av — vilan räknas ändå ner i appen.",
"restDoneTitle": "Vilan är slut",
"restDoneBody": "Dags för nästa set.",
"on": "På",
"off": "Av"
```
en parity: `Skip rest` / `Rest` / `Rest duration` / `Custom` / `Notifications off — rest still counts down in the app.` / `Rest is over` / `Time for your next set.` / `On` / `Off`. **Parity gate (Phase 8 D-10):** every key MUST exist in BOTH files. Reuse existing `cancel` (`:194`) for the ActionSheet cancel button.

---

### `app/package.json` + `app.json` (MODIFY — config)

**Analog:** `package.json:15` (test-script idiom) + `app.json:31-47` (plugins array).

**`package.json`:** add `"test:rest-timer": "tsx scripts/test-rest-timer.ts"` beside `:15`. Install via `npx expo install expo-notifications` (NOT `npm install` — pulls SDK-56 `latest`; CLAUDE.md SDK-54 pinning + RESEARCH §Pitfall 1). Resolves `~0.32.17`.

**`app.json`:** add `expo-notifications` to the `plugins` array (`:31-47`), following the existing entry shape (`"expo-secure-store"`, `"expo-localization"` are bare-string entries; the config-plugin form takes an options object like `expo-splash-screen` at `:33-44` if icon/sound config is needed — RESEARCH §Runtime State says no prebuild needed for Expo Go SDK 54, so a bare or minimal entry suffices).

---

## Shared Patterns

### Fire-and-forget after `addSet.mutate` (F13-sacred)
**Source:** `app/app/(app)/workout/[sessionId].tsx:676-678` (the `void getPref("fm:haptics").then(...)` block).
**Apply to:** the auto-start hook in `onKlart`.
Never await; never precede the mutate. All inputs already in memory → pure CPU off the write path. `npm run test:f13-brutal` stays green.
```typescript
void getPref("fm:haptics").then((on) => {
  if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
});
```

### globalThis Fast-Refresh sentinel for module-scope listeners
**Source:** `app/lib/query/network.ts:96-112` (`APPSTATE_BGFLUSH_KEY`).
**Apply to:** `_layout.tsx` notification-response listener (a `subscribe`/`addEventListener` that APPENDS, not replaces — must be torn down on hot reload).
```typescript
const KEY = "__fitnessmaxxing_<name>__";
const ref = globalThis as unknown as Record<string, { remove: () => void } | undefined>;
if (ref[KEY]) ref[KEY].remove();
const sub = /* addEventListener / addNotificationResponseReceivedListener */;
ref[KEY] = sub;
```

### Typed corrupt-tolerant `fm:*` pref (Zod `.catch(default).parse()`)
**Source:** `app/lib/prefs.ts:44-96`.
**Apply to:** `fm:restSeconds` (`z.coerce.number().int().positive().catch(120)`) + `fm:restTimerEnabled` (`z.enum(["true","false"]).catch("false").transform(...)`).
Total over `unknown` — never throws on null/tampered/garbage (T-09-01). Booleans stored as strings, never `JSON.parse`'d.

### Fail-soft async I/O (`void … .catch(console.warn)`)
**Source:** `app/lib/prefs.ts:85-96` (`setPref`).
**Apply to:** `lib/notifications.ts` schedule/cancel calls — a native failure warns + swallows; the in-app countdown still runs (D-12).

### Reanimated entry + reduce-motion snap (Forge §07)
**Source:** `app/components/ui/PrBanner.tsx:70-73, 120-144`.
**Apply to:** `RestTimerBanner.tsx` (extend the shared-value set with `translateY`; keep `SPRING = { damping: 18, stiffness: 220 }` + the `useReducedMotion()` snap branch).

### NativeWind 4 box-decoration via className
**Source:** `app/components/ui/PrBanner.tsx:173-198` + project MEMORY `feedback_nativewind_box_deco_via_classname`.
**Apply to:** `RestTimerBanner.tsx` — bg/radius/border-color in `className`; shadow/elevation/animated transform in inline `style`. The banner needs an OPAQUE `bg-forge-surface` base or the card title bleeds through (FIT-116 / Phase 13 D-04).

### Zustand store as cross-React-tree owner (`getState()` from outside React)
**Source:** `app/lib/units-store.ts:48-57` (used via `useUnitStore.getState().setUnit(...)` in `settings.tsx:276` + `_layout.tsx:202`).
**Apply to:** `rest-timer-store.ts` — `useRestTimerStore.getState().start(...)` from `onKlart`, `.finish()` from session-end, `.skip()`/`.extend()` from banner controls.

### ActionSheetIOS picker (iOS-locked native picker)
**Source:** `app/app/(app)/(tabs)/settings.tsx:281-292` (`openUnitsSheet`).
**Apply to:** the rest-duration picker (presets + "Anpassad").

---

## No Analog Found

None. Every new/modified file has a direct in-repo analog. The only genuinely NEW dependency is `expo-notifications` (first-party Expo module), and its usage patterns (schedule/cancel/permission/handler/response-listener) are fully specified in RESEARCH §Pattern 1/4/5 — the planner should treat RESEARCH's `expo-notifications` excerpts as the API reference and this repo's AppState/sentinel/fail-soft idioms as the integration shape.

---

## Metadata

**Analog search scope:** `app/lib/`, `app/lib/query/`, `app/components/ui/`, `app/scripts/`, `app/app/(app)/workout/`, `app/app/(app)/(tabs)/`, `app/app/_layout.tsx`, `app/locales/`, `app/package.json`, `app/app.json`.
**Files read (analogs):** `prefs.ts`, `query/network.ts`, `scripts/test-units.ts`, `lib/e1rm.ts`, `components/ui/PrBanner.tsx`, `components/ui/SettingsRow.tsx`, `lib/units-store.ts`, `lib/i18n.ts`, `app/_layout.tsx`, `(app)/workout/[sessionId].tsx` (overlay + onKlart ranges), `(tabs)/settings.tsx` (state/toggle/picker ranges), `locales/sv.json`, `app.json`, `package.json`.
**Pattern extraction date:** 2026-06-14

## PATTERN MAPPING COMPLETE

**Phase:** 14 - Rest Timer (F19) — RESEARCH-FLAGGED
**Files classified:** 11
**Analogs found:** 11 / 11

### Coverage
- Files with exact analog: 9
- Files with role-match analog: 2 (`notifications.ts`, `_layout.tsx` wiring)
- Files with no analog: 0

### Key Patterns Identified
- Pure-logic math (`rest-timer.ts`) copies the `e1rm.ts`/`units.ts` header + Pitfall-5 guard structure; unit-tested via the `test-units.ts` Case[]-table + exit-code skeleton.
- The rest-timer banner copies `PrBanner.tsx` wholesale (floating absolute overlay, Reanimated spring + reduce-motion snap, OPAQUE-surface FIT-116 rule, tabular-nums numeral, box-decoration-via-className) — only the radius token, translateY motion, and the display-only tick differ.
- Auto-start is the EXACT fire-and-forget-after-`addSet.mutate` shape as the existing `fm:haptics` block (`[sessionId].tsx:676`); F13 hot path + `test:f13-brutal` untouched by design.
- `fm:restSeconds` + `fm:restTimerEnabled` slot into `prefs.ts` via the established `.catch(default).parse()` enum/coerce idiom (the `String()` serializer at `:90` already anticipated the numeric pref).
- Module-scope notification wiring in `_layout.tsx` reuses the `network.ts` globalThis Fast-Refresh sentinel; the store is a plain-`create` Zustand owner cloned from `units-store.ts`.

### File Created
`.planning/phases/14-rest-timer-f19-research-flagged/14-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Each new/modified file points at a concrete analog file + line range. Planner can now reference these excerpts directly in PLAN.md action sections.
