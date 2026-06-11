# Phase 9: Auth, Settings & Preferences - Research

**Researched:** 2026-06-11
**Domain:** Expo SDK 54 preference layer (AsyncStorage + Zod), react-i18next live language override, kg↔lbs display helper, a Supabase `ALTER TABLE ADD COLUMN` migration, Forge re-skin of two RHF+Zod auth screens
**Confidence:** HIGH (every recommendation is grounded in code already in this repo; no new packages, no new patterns)

## Summary

Phase 9 is a **composition + wiring phase**, not a greenfield-discovery phase. CONTEXT.md locks 19 decisions, and the codebase already ships every primitive, pattern, and dependency this phase needs. The genuinely non-trivial integration points reduce to four, and for each the repo already contains a working precedent:

1. **Live i18n override** — `react-i18next@^17` + `i18next@^26` are already installed and wired (`app/lib/i18n.ts` + `LocaleBootstrap` in `app/app/_layout.tsx`). The `_forge-gallery.tsx` dev screen already calls `i18n.changeLanguage()` + persists `fm:language` live. The only real work is **extending the two-state `'sv'|'en'` machinery to the three-state `'system'|'sv'|'en'`** the Settings control needs, and resolving a **`fallbackLng` mismatch** between the code (`'sv'`) and D-11 (`'en'`). [VERIFIED: codebase grep]
2. **kg↔display helper** — a new pure module `app/lib/units.ts`; no dependency. The only edge-case discipline is lbs rounding to nearest 0.5 and tabular-nums formatting (`numStyle` from `lib.jsx`). [VERIFIED: CONTEXT.md D-01..D-03]
3. **`0007_profiles_weekly_goal.sql`** — a standard additive migration. `profiles` already has RLS + `using/with check` policies (migration `0001`), so the `ALTER TABLE ADD COLUMN` needs **no new policy** — existing `profiles` policies cover all columns. Co-commit `gen:types`, run `verify-deploy.ts`, extend `test-rls.ts`'s existing profiles block. [VERIFIED: migration 0001 + test-rls.ts]
4. **Prefs storage shape** — the established repo idiom is **per-key AsyncStorage reads with `z.enum/boolean.catch(default).parse()`** (see `fm:theme` in `settings.tsx`, `fm:language` in `LocaleBootstrap`). Recommend following it rather than introducing a persisted-Zustand store.

**Primary recommendation:** Extend `settings.tsx` in place using Phase 8 `SettingsSection`/`SettingsRow` + the re-skinned `SegmentedControl`; add `app/lib/units.ts` (pure helper) and a small `app/lib/prefs.ts` (typed read/write wrappers around the existing `fm:*` catch-parse idiom); add the three-state language resolver; land `0007` following DB conventions verbatim. No new npm packages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth re-skin (SKIN-01) | Browser/Client (RN screen) | — | Pure presentational; auth logic already lives in `supabase.auth.*` + RHF, unchanged (D-17) |
| Settings screen (SET-01) | Browser/Client (RN screen) | — | Composes Phase 8 primitives; no server round-trip except weekly-goal write |
| Theme / language / haptics / notifications / units prefs | Client (AsyncStorage) | — | Device-local prefs; no server persistence (matches `fm:theme`/`fm:language`) |
| Weekly goal (SET-04) | Database/Storage (`profiles.weekly_goal`) | Client (stepper UI) | Needs to survive reinstall + be read by Phase 12 Home ring across devices → server column, RLS-scoped |
| Language resolution (I18N-02) | Client (`expo-localization` + i18next) | — | `getLocales()` is a device API; resolution + `changeLanguage` are runtime client concerns |
| Sign-out (SET-09) | Client action → Auth API | Database (session revoke) | Existing `useAuthStore.signOut()` chain, unchanged |

## Standard Stack

**No new packages.** Every dependency this phase touches is already installed and pinned in `app/package.json`. Verified versions (from `app/package.json`, 2026-06-11):

### Core (already installed — do NOT install/bump)
| Library | Installed Version | Purpose This Phase | Provenance |
|---------|-------------------|--------------------|------------|
| `i18next` | `^26.3.1` | Translation engine; `changeLanguage()` drives live re-render | [VERIFIED: app/package.json] |
| `react-i18next` | `^17.0.8` | `useTranslation()` hook → components re-render on language change | [VERIFIED: app/package.json] |
| `expo-localization` | `~17.0.9` | `getLocales()[0].languageCode` for `System` resolution (D-11) | [VERIFIED: app/package.json] |
| `expo-haptics` | `~15.0.8` | Already installed; SET-06 only writes the **pref** + gates net-new calls (D-08) | [VERIFIED: app/package.json] |
| `@react-native-async-storage/async-storage` | `2.2.0` | `fm:*` pref persistence (units/haptics/notifications/language) | [VERIFIED: app/package.json] |
| `zod` | `^4.4.3` | `.enum/.boolean.catch(default).parse()` guards on every pref read | [VERIFIED: app/package.json] |
| `@supabase/supabase-js` | `^2.105.4` | weekly_goal read/write + existing auth | [VERIFIED: app/package.json] |
| `react-hook-form` | `^7.75.0` + `@hookform/resolvers@^5.2.2` | Auth screens — logic UNCHANGED (D-17) | [VERIFIED: app/package.json] |

> **Note on CLAUDE.md version table:** CLAUDE.md (training-data-era research) does not list `i18next`/`react-i18next` versions; the live `package.json` shows `i18next@26` + `react-i18next@17`, both newer and both supporting the live-re-render-on-`changeLanguage` behavior this phase relies on. Trust `package.json`, not the CLAUDE.md stack table, for these two. [VERIFIED: app/package.json]

### Supporting (NEW files to author — no installs)
| Module | Purpose | Pattern Source |
|--------|---------|----------------|
| `app/lib/units.ts` | Canonical-kg → display (kg or lbs nearest-0.5) + format string | new pure module (D-02) |
| `app/lib/prefs.ts` (recommended) | Typed `getPref/setPref` wrappers around the `fm:*` catch-parse idiom | mirrors `settings.tsx` `fm:theme` + `LocaleBootstrap` `fm:language` |
| `app/lib/i18n-resolve.ts` *or* a helper inside `i18n.ts` | `resolveLanguage('system'\|'sv'\|'en') → 'sv'\|'en'` via `getLocales()` (D-11) | new; uses already-imported `expo-localization` |
| `app/supabase/migrations/0007_profiles_weekly_goal.sql` | `weekly_goal int NOT NULL DEFAULT 3 CHECK (BETWEEN 1 AND 7)` | mirrors `0001` conventions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-key `fm:*` reads | Persisted Zustand store (`zustand/middleware persist`) | **Rejected** — repo has zero persisted-Zustand precedent; `font-store`/`persistence-store` are explicitly non-persisted per-launch flags. A persist store adds a hydration race vs splash + a new serialization surface. Per-key reads match `fm:theme`/`fm:language` exactly and the discuss-phase left this to planner discretion. Use a thin `prefs.ts` for DRY, not a reactive store. |
| New `units` npm lib (e.g. `convert-units`) | hand-rolled `app/lib/units.ts` | A single `kg * 2.2046226218` + round-to-0.5 needs no dependency; an install would be slopcheck/peer-dep surface for ~6 lines. Hand-roll. |
| `weekly_goal` as a `fm:*` AsyncStorage pref | `profiles.weekly_goal` column | Locked D-04 — must survive reinstall and be readable server-side by Phase 12 Home ring. Column is correct. |

**Installation:** None. (`expo-notifications` explicitly NOT installed — Phase 14, per D-07.)

## Package Legitimacy Audit

> Not applicable — Phase 9 installs **zero** external packages. All dependencies are pre-existing and pinned in `app/package.json` (verified 2026-06-11). New code is first-party modules + one SQL migration. slopcheck/registry verification is moot.

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs)
**Packages flagged as suspicious [SUS]:** none (no installs)

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  App cold launch        │  app/app/_layout.tsx (root)                 │
  ──────────────────────▶│   import "@/lib/i18n"  (init, lng=device)   │
                         │   <LocaleBootstrap/> reads fm:language ──────┼──┐
                         │     → resolveLanguage() → changeLanguage()   │  │ (EXTEND
                         │     → setLocaleReady(true) (fail-open)       │  │  to 3-state)
                         └─────────────────────────────────────────────┘  │
                                                                           │
  User taps Settings tab                                                   ▼
  ───────────────────────▶ app/app/(app)/(tabs)/settings.tsx        ┌──────────────┐
                                                                    │ AsyncStorage │
   ┌── Profile (read-only) ◀── useAuthStore.session.user.email      │  fm:theme    │
   │                       ◀── profiles.display_name (query)        │  fm:language │
   │                                                                │  fm:units    │
   ├── Appearance:                                                  │  fm:haptics  │
   │     Theme  SegmentedControl ─ setColorScheme() + write ───────▶│  fm:notif…   │
   │     Language SegmentedControl ─ resolveLanguage() ─────────┐   └──────────────┘
   │                          → i18n.changeLanguage() (LIVE)    │  every read:
   │                          → write fm:language               │  z.enum/.boolean
   │                                                            │   .catch(def).parse
   ├── Workout:                                                 │
   │     Units SegmentedControl ─ write fm:units ───────────────┘
   │       (display via lib/units.ts: kg→lbs nearest 0.5)
   │     Weekly goal +/- stepper ──── clamp 1..7 ──────────────────┐
   │                                                               ▼
   │                                          ┌──────────────────────────────┐
   │                                          │ Supabase profiles.weekly_goal│
   │                                          │  (RLS: own row; 0007 migrate)│
   │                                          └──────────────────────────────┘
   ├── Notifications: haptics switch → fm:haptics ; notif switch → fm:notifications
   │       (NO expo-notifications, NO OS prompt — D-07)
   │
   └── Sign out  ForgeButton(secondary, danger label)
         → useAuthStore.signOut() → queryClient.clear()
         → supabase.auth.signOut() → Stack.Protected re-eval (no imperative nav)

  useTranslation() in EVERY screen ── re-renders on changeLanguage() ──▶ LIVE text swap
```

### Recommended Project Structure (net-new / modified)
```
app/
├── app/
│   ├── (auth)/sign-in.tsx          # RE-SKIN to Forge (logic unchanged, D-17)
│   ├── (auth)/sign-up.tsx          # RE-SKIN to Forge (logic unchanged)
│   ├── (app)/(tabs)/settings.tsx   # EXTEND: full Settings screen (D-13 order)
│   └── _layout.tsx                 # MODIFY LocaleBootstrap → 3-state resolver
├── lib/
│   ├── units.ts                    # NEW — kg↔display helper (D-01)
│   ├── prefs.ts                    # NEW (recommended) — typed fm:* read/write
│   ├── i18n.ts                     # MODIFY — fallbackLng + resolveLanguage export
│   └── schemas/                    # (auth schemas already exist — unchanged)
├── locales/{sv,en}.json            # ADD 6 new keys (parity gate)
├── supabase/migrations/
│   └── 0007_profiles_weekly_goal.sql   # NEW
├── types/database.ts               # REGEN via gen:types (co-commit)
└── scripts/test-rls.ts             # EXTEND profiles block: weekly_goal column
```

### Pattern 1: `fm:*` pref read with corrupt-tolerant Zod guard
**What:** Every preference read parses through `z.<schema>.catch(default).parse(value)` so a tampered/garbage/null AsyncStorage value can never throw — it silently falls back to the default. This is the **established repo idiom** and a documented security mitigation (T-08-03/T-08-04).
**When to use:** Every `fm:units`, `fm:haptics`, `fm:notifications`, `fm:language` read.
**Example:**
```typescript
// Source: app/app/(app)/(tabs)/settings.tsx (fm:theme) + app/app/_layout.tsx (fm:language)
// [VERIFIED: codebase]
const theme = z.enum(["system", "light", "dark"]).catch("system").parse(v);   // existing
const units = z.enum(["metric", "imperial"]).catch("metric").parse(v);        // new, same idiom
const haptics = z.boolean().catch(true).parse(JSON.parse(v ?? "true"));       // default ON (D-08)
```
> **Boolean storage note:** AsyncStorage stores strings. For the two switches, store `"true"`/`"false"` and parse with `z.enum(["true","false"]).catch("true").transform(s => s === "true")` (avoids `JSON.parse` throwing on a corrupt value before `.catch` can fire). Planner's call on exact shape — keep it inside `prefs.ts`.

### Pattern 2: Three-state language resolution (the real new logic)
**What:** `fm:language` stores `'system'|'sv'|'en'`. `'system'` must resolve at apply-time via `expo-localization`: Swedish device → `'sv'`, anything else → `'en'` (D-11). `'sv'`/`'en'` pass through.
**When to use:** In `LocaleBootstrap` (cold-launch) AND in the Settings language `onChange` (live).
**Example:**
```typescript
// Source: NEW — composes expo-localization (already imported in i18n.ts) + D-11
// [CITED: CONTEXT.md D-10/D-11/D-12]
import * as Localization from "expo-localization";

export type LanguagePref = "system" | "sv" | "en";

export function resolveLanguage(pref: LanguagePref): "sv" | "en" {
  if (pref === "sv" || pref === "en") return pref;
  // 'system': Swedish device → sv, else English fallback (only 2 bundled langs)
  return Localization.getLocales()[0]?.languageCode === "sv" ? "sv" : "en";
}

// On change (Settings) — mirrors _forge-gallery.tsx setLanguage pattern:
function onLanguageChange(pref: LanguagePref) {
  void i18n.changeLanguage(resolveLanguage(pref));   // LIVE — every useTranslation re-renders
  void AsyncStorage.setItem("fm:language", pref).catch(() => { /* warn */ });
}
```

### Pattern 3: Live re-render on `changeLanguage`
**What:** `react-i18next`'s `useTranslation()` subscribes each consuming component to i18next's `languageChanged` event; calling `i18n.changeLanguage(lng)` triggers a re-render of every component using `t()` — **no app restart, no remount** (D-12). [CITED: react-i18next docs — useTranslation re-renders on languageChanged] [VERIFIED: `_forge-gallery.tsx` already does exactly this in-repo]
**Gotcha:** Components that captured a `t` value in a non-reactive context (module scope, a `useMemo` with empty deps, a `useRef`) will NOT update. All Phase 9 strings must call `t()` inside render via `useTranslation()`. The auth screens currently hold **hardcoded Swedish strings** (`"Logga in"`, `"Email"`, `"Inget konto?"` — see `sign-in.tsx` lines 124–263) — the re-skin must route these through `t()` so the live language toggle affects them too.

### Pattern 4: `kg → display` conversion/format helper
```typescript
// Source: NEW app/lib/units.ts — [CITED: CONTEXT.md D-01]
const KG_PER_LB = 0.45359237;            // exact; lbs = kg / KG_PER_LB
const roundHalf = (n: number) => Math.round(n * 2) / 2;   // nearest 0.5

export type UnitPref = "metric" | "imperial";

/** Canonical kg → display number in the chosen unit. kg passes through unrounded. */
export function toDisplayWeight(kg: number, unit: UnitPref): number {
  return unit === "imperial" ? roundHalf(kg / KG_PER_LB) : kg;
}

/** Display string incl. unit suffix. Strips trailing .0 for clean dense rows. */
export function formatWeight(kg: number, unit: UnitPref): string {
  const v = toDisplayWeight(kg, unit);
  const s = Number.isInteger(v) ? String(v) : String(v);  // 220.5 stays, 100 → "100"
  return `${s} ${unit === "imperial" ? "lb" : "kg"}`;
}
```
> Render numerals with the `numStyle` tabular-nums style from `lib.jsx` (DSGN-03) so display values don't jitter column width. The helper returns data; the screen applies the font style.

### Pattern 5: `0007` additive migration (no new policy needed)
```sql
-- app/supabase/migrations/0007_profiles_weekly_goal.sql — [CITED: CLAUDE.md DB conventions + migration 0001]
-- profiles already has RLS enabled + own-row using/with-check policies (0001 lines 96, 110-113).
-- ADD COLUMN is covered by the existing policies — NO new policy required.
alter table public.profiles
  add column weekly_goal int not null default 3 check (weekly_goal between 1 and 7);
```

### Anti-Patterns to Avoid
- **`active:opacity-*` / `shadow-*` NativeWind classes** — FIT-66: these route through `react-native-css-interop@0.2.3`'s upgrade-warning recursion and crash outside a NavigationContainer. Use `style={({pressed})=>…}` callbacks + explicit iOS shadow objects (Phase 8 primitives already do this; the re-skinned `SegmentedControl` must too). [VERIFIED: segmented-control.tsx FIT-66 comment]
- **Arbitrary Tailwind classes for optical values** (`gap-[14px]`, `p-[28px]`) — NativeWind 4 on Tailwind 3 purges non-scale arbitrary values; use inline `style={{}}` numbers (UI-SPEC §Spacing implementation note). [VERIFIED: 09-UI-SPEC.md]
- **Writing free text into `i18n.changeLanguage()`** — only the `'sv'|'en'` literal union after `resolveLanguage()` (T-08-11). [VERIFIED: _forge-gallery.tsx]
- **`placeholder:text-*` class on TextInput** — use the native `placeholderTextColor` prop (ForgeField already does). [VERIFIED: ForgeField.tsx]
- **Editing schema in Supabase Studio** — migration-as-truth; Studio is read-only from Phase 2. [VERIFIED: CLAUDE.md]
- **Retrofitting existing weight-display / haptic call sites** — OUT of scope (Phases 11/12). Apply helper/gate only to net-new Phase 9 surfaces (D-02/D-08).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings rows / sections | Custom row/section JSX | `SettingsRow` / `SettingsSection` (Phase 8) | Already token-correct, light+dark parity, a11y, FIT-66-safe toggle built in |
| 3-state / 2-state selector | New toggle | `SegmentedControl` (re-skinned to Forge) | Generic, typed, a11y tablist; reused for theme/language/units |
| Primary/secondary buttons + loading spinner | Custom Pressable | `ForgeButton` (`loading` prop = built-in `ActivityIndicator`, D-19) | Variant/size enums, accent shadow, disabled state already correct |
| Text inputs (auth re-skin) | Raw TextInput styling | `ForgeField` (`state: default\|focused\|error`) | Border-state machine + placeholderTextColor + a11y label fallback done |
| iOS-style switch | New switch | `SettingsRow toggle` (44×26 custom Toggle) | FIT-66-safe; matches spec dims |
| Translation reactivity | Manual event bus / context | `useTranslation()` from react-i18next | Subscribes to `languageChanged`, re-renders for free |
| Locale key drift detection | Manual review | `npm run check:locale-parity` (existing) | Fails build if sv/en key sets diverge |
| Schema drift verification | `supabase db diff` (needs Docker) | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | Windows-no-Docker path; queries live pg_catalog (D-04/CLAUDE.md) |

**Key insight:** Phase 8 deliberately shipped this primitive library so Phase 9 is pure composition. The only genuinely new *logic* is `resolveLanguage`, `units.ts`, and the `0007` migration — everything visual is assembly.

## Runtime State Inventory

> Phase 9 is additive/greenfield-on-top, not a rename/refactor. This section is included because it introduces a new persisted DB column + new AsyncStorage keys.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (DB) | `profiles.weekly_goal` is NEW; existing rows get `DEFAULT 3` automatically. `profiles.preferred_unit` ALREADY EXISTS (`0001`, default `'kg'`) but is **unused by the `fm:units` client pref** — D-01/D-02 store the unit pref in `fm:units` AsyncStorage, NOT in `preferred_unit`. | Confirm with planner: `fm:units` (client) is the source of truth this phase; `profiles.preferred_unit` stays dormant (do NOT wire it — would be a second source of truth). No migration to `preferred_unit`. |
| Live service config | None — no n8n/Datadog/external service holds Phase 9 state. | None — verified: prefs are device-local + one Supabase column. |
| OS-registered state | None — no Task Scheduler / launchd / notification registration (expo-notifications deferred to Phase 14). | None. |
| Secrets/env vars | None new. weekly_goal uses existing anon-key + RLS path; no new key. | None. |
| Build artifacts | `app/types/database.ts` becomes stale the moment `0007` deploys — must regen via `npm run gen:types` in the SAME commit (CLAUDE.md). | Run `gen:types`, commit `database.ts` with the migration. |
| New AsyncStorage keys | `fm:units`, `fm:haptics`, `fm:notifications` are net-new; `fm:language`/`fm:theme` already exist. No migration of existing values needed (defaults apply on first read via `.catch()`). | None — `.catch(default)` makes first-read self-healing. |

**The canonical question — after every file is updated, what runtime state persists the old shape?** Only `database.ts` (regenerate) and, conceptually, the dormant `preferred_unit` column (intentionally left untouched — flag to planner so it isn't "helpfully" wired up).

## Common Pitfalls

### Pitfall 1: `fallbackLng` mismatch between code and D-11
**What goes wrong:** `app/lib/i18n.ts` line 42 sets `fallbackLng: "sv"` and `lng: getLocales()[0]?.languageCode ?? "sv"`. D-11 specifies the **System fallback for non-Swedish locales is English** (`fallbackLng: 'en'` semantics). With the current code, a German-locale device would init to `sv`, not `en`.
**Why it happens:** Phase 8 set Swedish as the *app default* language; D-11 redefines the **System-resolution** rule for Phase 9.
**How to avoid:** Reconcile explicitly. Recommended: keep i18next's `fallbackLng` for the *missing-key* fallback (Swedish is the authored primary, so `'sv'` as key-fallback is arguably fine), but make the **`'system'` device-resolution** (`resolveLanguage`) the authority for *which language to display* — and that returns `'en'` for non-`sv` devices per D-11. Do NOT rely on i18next's `fallbackLng` to implement D-11; implement D-11 in `resolveLanguage()`. The planner must decide whether to also flip `i18n.ts`'s `lng`/`fallbackLng` init values; surface this as an explicit task.
**Warning signs:** A non-Swedish-locale device on `System` shows Swedish instead of English.

### Pitfall 2: `LocaleBootstrap` is hardcoded two-state
**What goes wrong:** `app/app/_layout.tsx` `LocaleBootstrap` parses `z.enum(["sv","en"]).catch("sv")` — it cannot store/apply `'system'`. If Settings writes `fm:language = 'system'`, the next cold launch's `.catch("sv")` silently rewrites the user's intent to Swedish.
**Why it happens:** Phase 8 built the bootstrap before the three-state control existed.
**How to avoid:** Extend the bootstrap enum to `["system","sv","en"]` and pipe through `resolveLanguage()` before `changeLanguage()`. This is a **required edit**, not optional.
**Warning signs:** Setting language to System persists, but after force-quit/relaunch the device shows Swedish regardless of locale.

### Pitfall 3: Hardcoded Swedish in the auth screens won't react to language toggle
**What goes wrong:** `sign-in.tsx`/`sign-up.tsx` render literal Swedish (`"Logga in"`, `"Email"`, error copy). Re-skinning visually but leaving literals means the live language toggle (D-12) doesn't affect auth.
**How to avoid:** Route all auth copy through `t()` against the existing keys (`signIn`, `email`, `password`, `noAccount`, `welcome`, `welcomeSub`, `signingIn`). Keys already exist in both locales — no new auth keys needed. Error-banner copy is currently inline Swedish strings; the re-skin should map them to `t()` too (planner: confirm whether server-error copy gets keys this phase or stays inline per D-17 "copy unchanged" — D-17 says copy unchanged, so inline server-error literals MAY stay, but the visible labels must use `t()` to satisfy I18N + live toggle).
**Warning signs:** Toggle to English; auth screen stays Swedish.

### Pitfall 4: New i18n keys break the parity gate
**What goes wrong:** Adding `weeklyGoal` to `sv.json` but forgetting `en.json` (or vice-versa) → `check:locale-parity` exits 1 in CI.
**How to avoid:** Add all 6 new keys to BOTH files in the same edit: `weeklyGoal`, `sessionsPerWeek`, `showPassword`, `hidePassword`, `increment`, `decrement` (sv + en per UI-SPEC §Copywriting "New keys"). Run `npm run check:locale-parity` locally before commit.
**Warning signs:** `FAIL — sv/en locale key sets diverge.`

### Pitfall 5: lbs rounding and integer formatting
**What goes wrong:** Naive `kg * 2.2046` produces noisy decimals (`220.46226 lb`); D-01 wants nearest 0.5 (`220.5 lb`). And `100 kg` should show `100`, not `100.0`.
**How to avoid:** `Math.round(lbs * 2) / 2` for the half-step; conditional integer formatting. Edge cases to test: `0 → "0 kg"/"0 lb"`, very large (`500 kg → 1102.5 lb`), already-half values, negative guard (weights are ≥0 by schema but the helper should not crash on 0/NaN — return `0` for non-finite input).
**Warning signs:** Set rows show `100.0 kg` or `220.46226 lb`.

### Pitfall 6: weekly_goal write needs an authenticated, RLS-scoped update
**What goes wrong:** Writing `weekly_goal` via an unscoped `update` could 0-row silently (RLS) if the `id = auth.uid()` filter is wrong.
**How to avoid:** `supabase.from("profiles").update({ weekly_goal }).eq("id", session.user.id)` — the existing `profiles` update policy (`(select auth.uid()) = id`, with check) permits exactly the own-row update. Verify the write returns the updated row (`.select().single()`), don't fire-and-forget. Optimistic UI is fine (stepper clamps 1–7 client-side first), but persist on change.
**Warning signs:** Stepper value resets after navigating away (write silently dropped).

## Code Examples

### Settings language row (composes everything)
```typescript
// Source: composes settings.tsx theme idiom + resolveLanguage + SegmentedControl
// [VERIFIED: idiom from settings.tsx lines 54-62]
const { i18n } = useTranslation();
const [lang, setLang] = useState<LanguagePref>("system");

useEffect(() => {
  void AsyncStorage.getItem("fm:language").then((v) => {
    setLang(z.enum(["system","sv","en"]).catch("system").parse(v));
  });
}, []);

const onLang = (next: LanguagePref) => {
  setLang(next);
  void i18n.changeLanguage(resolveLanguage(next));                  // live
  void AsyncStorage.setItem("fm:language", next).catch(() => {});   // persist
};
```

### Weekly-goal stepper persist
```typescript
// [VERIFIED: profiles update policy from migration 0001 lines 112-113]
const onGoalChange = async (next: number) => {
  const goal = Math.min(7, Math.max(1, next));        // clamp 1..7 (D-05)
  setGoal(goal);                                       // optimistic
  await supabase.from("profiles").update({ weekly_goal: goal })
    .eq("id", session.user.id).select().single();
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `i18next@~23` + `react-i18next@~13` (CLAUDE.md-era assumption) | `i18next@^26.3.1` + `react-i18next@^17.0.8` (live in repo) | already installed | `useTranslation` live-re-render semantics unchanged; the major-version jump is transparent for the flat-namespace `t()` usage here |
| Two-state `'sv'\|'en'` locale (Phase 8) | Three-state `'system'\|'sv'\|'en'` (Phase 9 D-10) | this phase | Requires extending `LocaleBootstrap` + adding `resolveLanguage` |
| `preferred_unit` column (Phase 1 schema, unused) | `fm:units` AsyncStorage pref (Phase 9 D-01) | this phase | Client-local pref is source of truth; column stays dormant |

**Deprecated/outdated:**
- Do NOT trust CLAUDE.md's stack table for i18next/react-i18next versions — it predates the installed `@26`/`@17`. `package.json` is authoritative.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | i18next/react-i18next live-re-render on `changeLanguage` works identically in `@26`/`@17` as in earlier majors | Pattern 3 | LOW — `_forge-gallery.tsx` already exercises this exact path in-repo at these versions; if it regressed, the gallery would already be broken |
| A2 | Storing switch bools as `"true"`/`"false"` strings + enum-catch is the cleanest fit for the `fm:*` idiom | Pattern 1 | LOW — alternative is `z.boolean()` over `JSON.parse`; both work, this is a shape preference left to planner |
| A3 | `profiles.preferred_unit` should stay dormant (not be wired to `fm:units`) | Runtime State Inventory | MEDIUM — if the team later wants cross-device unit sync, they'd want the column; D-01/D-02 clearly scope units as a client pref this phase, so leaving it dormant is correct for Phase 9 but flag for future |
| A4 | D-17 "copy unchanged" permits inline server-error literals to remain while visible labels move to `t()` | Pitfall 3 | LOW-MEDIUM — planner should confirm; if all copy must be keyed, add server-error keys too |

## Open Questions

1. **Does `i18n.ts`'s init `lng`/`fallbackLng` need to change to satisfy D-11?**
   - What we know: `resolveLanguage()` can fully implement D-11 at apply-time without touching init.
   - What's unclear: whether the team also wants the *cold-launch-before-bootstrap* flash to honor D-11 (init currently uses device `languageCode ?? "sv"`).
   - Recommendation: implement D-11 in `resolveLanguage()` + extend `LocaleBootstrap`; leave i18next `fallbackLng: "sv"` as the **missing-key** fallback (Swedish is the authored primary). Make this an explicit planner decision/task.

2. **Server-error copy: keyed or inline?**
   - What we know: D-17 says auth copy is unchanged; visible labels must use `t()` for the live toggle.
   - Recommendation: visible labels → `t()` (existing keys); server-error literals → planner's call (inline is defensible under D-17). Surface in plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (remote) | `0007` migration + weekly_goal write + test:rls | ✓ | project `mokmiuifpdzwnceufduu` (gen:types script) | — |
| `tsx` | verify-deploy.ts, test-rls.ts, check:locale-parity | ✓ | `^4.21.0` (devDep) | — |
| `npx supabase` CLI (gen:types) | type regen after `0007` | ✓ (used by `gen:types` script) | via npx | — |
| Docker | NOT required — `verify-deploy.ts` queries pg_catalog directly | ✗ (intentional) | — | `verify-deploy.ts` (D-04, CLAUDE.md) |
| `.env.local` (anon + service-role keys) | test:rls cross-user assertions | assumed ✓ (existing tests depend on it) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Docker absent by design — use `verify-deploy.ts` for drift, never `supabase db diff`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Bespoke `tsx` assertion scripts** (no Jest/Vitest in repo) — exit-code 0/1, run via `npm run test:*`. Plus `expo lint` + `tsc`. |
| Config file | none — each `scripts/test-*.ts` is self-contained (header convention from `test-rls.ts`) |
| Quick run command | `cd app && npm run lint && npx tsc --noEmit` (per-task) |
| Full suite command | `cd app && npm run check:locale-parity && npm run test:rls && npm run test:f13-brutal` |
| Schema test runner | `tsx --env-file=.env.local scripts/<name>.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-03 | kg→lbs nearest-0.5 + format edge cases (0, large, integer strip) | unit | `tsx scripts/test-units.ts` | ❌ Wave 0 |
| I18N-02 / SET-05 | `resolveLanguage('system'\|'sv'\|'en')` returns correct lang for sv vs non-sv locale | unit | `tsx scripts/test-locale-resolve.ts` | ❌ Wave 0 |
| SET-05 | New i18n keys present in BOTH locales | parity | `npm run check:locale-parity` | ✅ existing |
| SET-04 | `0007` deployed: column exists, type, NOT NULL, CHECK 1..7, RLS still on | migration/schema | `tsx --env-file=.env.local scripts/verify-deploy.ts` | ✅ existing (extend coverage) |
| SET-04 | Cross-user: A cannot UPDATE B's `weekly_goal`; own-row update succeeds | RLS | `npm run test:rls` | ✅ existing (extend profiles block) |
| SET-01..09 | Settings renders, controls persist, sign-out flow | manual UAT (device) | — (Expo Go) | manual |
| SKIN-01 | Auth re-skin visual parity light+dark | manual UAT (device) | — | manual |
| F13 regression | Hot path untouched | regression | `npm run test:f13-brutal` | ✅ existing |
| all | typecheck + lint | static | `npx tsc --noEmit && expo lint` | ✅ existing |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && expo lint` + the relevant new unit script (`test-units` / `test-locale-resolve`).
- **Per wave merge:** `check:locale-parity` + `test:rls` (after `0007`) + `verify-deploy.ts`.
- **Phase gate:** full suite green + `test:f13-brutal` green before `/gsd:verify-work`; manual device UAT for SET-01..09 + SKIN-01 (presentational — not auto-testable).

### Wave 0 Gaps
- [ ] `app/scripts/test-units.ts` — covers SET-03 (kg passthrough; 100kg→220.5lb; 0; large; integer-strip; non-finite guard). Pure, no env needed.
- [ ] `app/scripts/test-locale-resolve.ts` — covers I18N-02 (`resolveLanguage` for sv-device→sv, en-device→en, de-device→en, explicit 'sv'/'en' passthrough). Mock `getLocales()` or inject the languageCode as a param to keep it pure/testable.
- [ ] Add `test:units` + `test:locale-resolve` script entries to `app/package.json`.
- [ ] Extend `scripts/test-rls.ts` profiles block: add `A cannot UPDATE B's profile (weekly_goal)` assertion + an own-row `weekly_goal` update success assertion.
- [ ] Add 6 new keys to `sv.json` + `en.json` (parity gate covers, but the keys themselves are the gap).

*(Recommendation: make `units.ts` and `resolveLanguage` **pure and dependency-injectable** — pass `languageCode` into the resolver rather than calling `getLocales()` inside it — so both are testable in a Node `tsx` script without an Expo runtime.)*

## Security Domain

### Applicable ASVS Categories (Level 1, per config security_asvs_level)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth re-skin only — logic UNCHANGED (D-17); existing `signInWithPassword` + generic invalid-credentials copy (V2.1.4) preserved |
| V3 Session Management | yes | Sign-out keeps existing `signOut()`→`queryClient.clear()`→`asyncStoragePersister.removeClient()` chain (FIT-5 cross-user cache isolation) — do not regress |
| V4 Access Control | yes | `weekly_goal` write scoped by existing `profiles` RLS own-row policy (`(select auth.uid()) = id` + with check); cross-user test extends test-rls.ts (API1/BOLA) |
| V5 Input Validation | yes | Every `fm:*` read through `z.enum/boolean.catch(default).parse()`; stepper clamps 1..7 client-side AND DB `CHECK (1..7)` defense-in-depth; `changeLanguage` only fed `'sv'\|'en'` literal union (T-08-11) |
| V6 Cryptography | no | No new crypto; auth tokens stay in existing LargeSecureStore (untouched) |
| V8 Data Protection | yes | Prefs are non-sensitive (theme/units/goal/toggles) — plain AsyncStorage acceptable; no PII added to AsyncStorage |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `fm:*` AsyncStorage value (e.g. jailbreak edit) | Tampering | `.catch(default).parse()` — garbage falls back, never throws (T-08-03) |
| BOLA: user A writes user B's `weekly_goal` | Elevation / Info-disclosure | RLS own-row policy + cross-user `test:rls` assertion (API1) |
| Free text injected into i18next `changeLanguage` | Tampering | literal `'sv'\|'en'` union only after `resolveLanguage` (T-08-11) |
| Splash-gate hang from corrupt locale pref | DoS | `LocaleBootstrap` fail-open `.finally(setLocaleReady(true))` — preserve when extending to 3-state |
| Stale cross-user cache after sign-out | Info-disclosure | existing `removeClient()` chain — do NOT alter sign-out logic (D-16) |
| `expo-notifications` permission prompt for unused feature | Privacy / over-permission | D-07: store pref only, NO install, NO prompt this phase |

**Threat IDs for PLAN.md:** the planner must author a `<threat_model>` STRIDE register `T-09-*` per CLAUDE.md per-phase contract; the rows above seed it. `gsd-secure-phase 9` must close it to `threats_open: 0`.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked** (Expo + Supabase + TS) — no new runtime deps; Phase 9 adds zero packages. ✓
- **iOS-only V1** — all UI iOS-targeted (shadows via iOS style objects, no Android elevation). ✓
- **Migration-as-truth** — `0007` is a numbered SQL file; Studio read-only; `gen:types` co-commit; `verify-deploy.ts` after push. ✓
- **RLS pairs with policies / `using`+`with check` / `(select auth.uid())`** — `0007` is ADD COLUMN on an already-RLS'd, already-policied table → no new policy, existing policies cover it; do NOT add a redundant/looser policy. ✓
- **Drift verification on Windows-without-Docker** — `verify-deploy.ts`, never `db diff`. ✓
- **Cross-user verification is a gate** — extend `test-rls.ts` profiles block for `weekly_goal`. ✓
- **`gen:types` after every schema migration**, commit `database.ts` in the same commit; hand-editing forbidden. ✓
- **Service-role isolation** — unchanged; no new service-role usage. ✓
- **Security per-phase contract** — PLAN.md needs a `<threat_model>` STRIDE register (`T-09-*`); `gsd-secure-phase 9` closes it. ✓
- **All external data via Zod** — every `fm:*` read + any Supabase `profiles` response (weekly_goal) parsed/validated, not bare-cast. ✓
- **Sessions via expo-secure-store** — untouched (sign-out reuses existing chain). ✓
- **Branching** — work on `gsd/phase-09-...`, PR to `dev`; never commit direct to dev/main. ✓
- **Linear** — sync via `linear:sync-phase --phase 9` after planning; tag commits with sub-issue IDs. ✓

## Sources

### Primary (HIGH confidence)
- `app/package.json` — installed versions (i18next@26, react-i18next@17, expo-localization@17, zod@4, etc.) [VERIFIED]
- `app/app/(app)/(tabs)/settings.tsx` — `fm:theme` catch-parse idiom; theme SegmentedControl; sign-out [VERIFIED]
- `app/lib/i18n.ts` + `app/app/_layout.tsx` (LocaleBootstrap) — i18n init, `fallbackLng:"sv"`, two-state `fm:language` bootstrap [VERIFIED]
- `app/app/(app)/_forge-gallery.tsx` — in-repo `changeLanguage` + `fm:language` persist precedent [VERIFIED]
- `app/supabase/migrations/0001_initial_schema.sql` — `profiles` table, RLS, own-row policies, `preferred_unit` column [VERIFIED]
- `app/scripts/test-rls.ts` — profiles cross-user assertion block to extend [VERIFIED]
- `app/scripts/verify-deploy.ts` + `check-locale-parity.ts` — existing gates [VERIFIED]
- `app/components/ui/{SettingsRow,ForgeButton,ForgeField}.tsx` + `segmented-control.tsx` — Phase 8 primitives + FIT-66 constraints [VERIFIED]
- `app/types/database.ts` — `profiles` shape (no `weekly_goal` yet) [VERIFIED]
- `09-CONTEXT.md` (D-01..D-19) + `09-UI-SPEC.md` + CLAUDE.md DB/security conventions [CITED]

### Secondary (MEDIUM confidence)
- react-i18next `useTranslation` re-render-on-`languageChanged` behavior [CITED: react-i18next docs] — corroborated by in-repo `_forge-gallery.tsx`

### Tertiary (LOW confidence)
- none — all claims grounded in repo code or locked CONTEXT/CLAUDE decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from `package.json`; zero new installs.
- Architecture: HIGH — every pattern has an in-repo precedent (theme, gallery i18n, migration 0001, Phase 8 primitives).
- Pitfalls: HIGH — the `fallbackLng` mismatch and two-state `LocaleBootstrap` are observed facts in current code, not speculation.
- Validation: HIGH — existing `tsx` script + lint + tsc framework; two new pure unit scripts cleanly fill the gaps.

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable — no fast-moving external deps; all pinned)
