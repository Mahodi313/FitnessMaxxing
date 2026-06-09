# Requirements: FitnessMaxxing — Milestone v2.0 "Forge Redesign"

**Defined:** 2026-06-09
**Core Value:** Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.

> v2.0 rewrites the UI to the Forge design system and adds dashboard, PR celebration, rest timer, and English — without touching v1's offline-first write path or the F13 "never lose a set" guarantee. Design source: `app/design v2/Sources/design/`. App Store launch (Apple Sign-In/TestFlight) is a later milestone.

## v2.0 Requirements

### Design System (DSGN)

- [ ] **DSGN-01**: Forge color tokens (light + dark) from `THEMES.forge` are defined in `tailwind.config.js` and consumable as NativeWind classes
- [ ] **DSGN-02**: Custom type system (Inter Display + Inter + JetBrains Mono) loads via expo-font with splash held until ready
- [ ] **DSGN-03**: Stat numerals render with tabular-nums (tnum/ss01) so figures align
- [ ] **DSGN-04**: Forge component library exists (ForgeButton, ForgeField, ForgeCard, ForgeStat) and is theme-token-driven
- [ ] **DSGN-05**: ProgressRing and Sparkline render via the installed Skia (no new charting dependency)
- [ ] **DSGN-06**: Ascend brand logo + app icon render in gradient and white variants

### Screen Re-skin (SKIN)

- [ ] **SKIN-01**: Auth screens (sign-in, sign-up) match the Forge design in light + dark
- [ ] **SKIN-02**: Plans list / Home, plan detail, and new-plan screens match the Forge design
- [ ] **SKIN-03**: Exercise picker (browse + create-new) and plan-exercise edit screens match the Forge design
- [ ] **SKIN-04**: Active-workout screen matches the Forge design with the set log, input row, and progress dots
- [ ] **SKIN-05**: The three session overlays (finish, draft-resume, saved-toast) and the active-session banner match the Forge design and stay inline-rendered (no modal portals)
- [ ] **SKIN-06**: History list, session detail, and exercise chart screens match the Forge design
- [ ] **SKIN-07**: Tab bar matches the Forge design (Planer / Historik / Inställningar) in light + dark
- [ ] **SKIN-08**: Re-skin introduces no regression to the ≤3s log-set budget or F13 (`npm run test:f13-brutal` stays green)

### Settings & Preferences (SET)

- [ ] **SET-01**: User can open a Settings screen from the tab bar
- [ ] **SET-02**: User can view their profile (display name, email) on the Settings screen
- [ ] **SET-03**: User can choose units (Metric kg / Imperial lbs); all weights display in the chosen unit while stored canonically in kg
- [ ] **SET-04**: User can set a weekly session goal that drives the Home activity ring (persisted to `profiles.weekly_goal`)
- [ ] **SET-05**: User can switch app language (Swedish / English), overriding the device locale
- [ ] **SET-06**: User can toggle haptics on/off (device-local pref)
- [ ] **SET-07**: User can toggle notifications on/off (device-local pref, gated by OS permission)
- [ ] **SET-08**: User can choose theme (System / Light / Dark) on the Settings screen (re-skin of existing F15 toggle)
- [ ] **SET-09**: User can sign out from the Settings screen

### Home Dashboard (DASH)

- [ ] **DASH-01**: Home shows an activity ring of sessions-this-week against the weekly goal
- [ ] **DASH-02**: Home shows the current training streak
- [ ] **DASH-03**: Home shows this week's total volume with the change vs the prior week
- [ ] **DASH-04**: Home shows a volume sparkline trend
- [ ] **DASH-05**: Dashboard aggregates come from RLS-scoped read-side RPCs and render an empty state for new users

### PR Celebration (PR)

- [ ] **PR-01**: A logged set that beats the prior best e1RM (Epley) for that exercise is detected as a personal best, computed client-side so it works offline
- [ ] **PR-02**: A PR set is marked with a trophy in the active-workout set list
- [ ] **PR-03**: A PR shows a celebration banner (with gradient-sweep animation) during the workout
- [ ] **PR-04**: PR sessions are marked with a trophy in history; session detail and chart surface PR/e1RM
- [ ] **PR-05**: The exercise chart shows estimated 1RM with the change over the selected range

### Rest Timer (TIMER)

- [ ] **TIMER-01**: Completing a set ("Klart") can auto-start a rest countdown
- [ ] **TIMER-02**: The rest countdown is visible and continues correctly after the app is backgrounded (reconciled from a stored timestamp, not a JS timer)
- [ ] **TIMER-03**: A local notification fires when the rest period ends, including when the app is backgrounded
- [ ] **TIMER-04**: The user can configure a default rest duration and enable/disable the timer in Settings
- [ ] **TIMER-05**: Dismissing or starting the next set early cancels the scheduled rest notification

### Internationalization (I18N)

- [ ] **I18N-01**: All app UI text renders from translation resources (sv.json / en.json), not hardcoded strings
- [ ] **I18N-02**: App language follows the device locale by default and the Settings override
- [ ] **I18N-03**: Both Swedish and English are complete with no missing keys across every screen
- [ ] **I18N-04**: Dates and numbers format per the active locale (Swedish decimal handling preserved)
- [ ] **I18N-05**: User-created content (plan/exercise names, notes) is stored as written and never auto-translated

### Motion & Haptics (MOTN)

- [ ] **MOTN-01**: Logging a set plays the set-logged animation + haptic without breaching the ≤3s budget
- [ ] **MOTN-02**: The Home activity ring animates its fill on mount
- [ ] **MOTN-03**: The exercise chart line draws on mount
- [ ] **MOTN-04**: Overlays/sheets animate per the design motion table while staying inline-rendered
- [ ] **MOTN-05**: Haptics respect the Settings haptics toggle

## Future Requirements (later milestone)

### App Store Launch
- **STORE-01**: Apple Sign-In (F14 / FIT-45)
- **STORE-02**: TestFlight build via EAS (Windows-only dev credential flow)
- **STORE-03**: Email-confirmation deep-link handler (F1.1 / FIT-46)
- **STORE-04**: Reworked App-Store-grade DB design for expanded user/account data

### Deferred features
- **SETT-FUTURE**: Set-type toggling under active workout (F17-UI; schema exists since Phase 2)
- **THEME-FUTURE**: Alternate themes (Atlas / Volt) — Forge only for v2.0

## Out of Scope

| Feature | Reason |
|---------|--------|
| Apple Sign-In / TestFlight | Requires Apple Developer tools — separate later milestone |
| Auto-translating user content | Two-language storage per record; unnecessary for a personal tool (I18N-05) |
| `is_pr` persisted column | PR is derivable client-side from sets; avoids schema + sync complexity |
| Atlas / Volt alternate themes | Forge is the chosen direction for v2.0 |
| Tailwind v4 upgrade | Breaks NativeWind 4 — stay on v3 |
| Android variant in codebase | iOS-first; design is token-driven and Android-ready when greenlit |
| Remote push notifications | Local notifications only (Expo Go SDK 54); rest timer needs no remote push |

## Traceability

Populated during roadmap creation (Step 10).

| Requirement | Phase | Status |
|-------------|-------|--------|
| (filled by roadmap) | — | Pending |

**Coverage:**
- v2.0 requirements: 43 total
- Mapped to phases: (filled by roadmap)
- Unmapped: (filled by roadmap)

---
*Requirements defined: 2026-06-09*
*Last updated: 2026-06-09 after initial v2.0 definition*
