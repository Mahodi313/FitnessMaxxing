---
phase: 09-auth-settings-preferences
plan: 03
subsystem: auth
tags: [auth, sign-in, sign-up, forge, forgefield, react-hook-form, zod, display_name, supabase-trigger]

# Dependency graph
requires:
  - phase: 09-01
    provides: "bilingual i18n keys + resolveLanguage (live language reaches auth)"
  - phase: 08-forge-foundation
    provides: "ForgeField, ForgeButton, Icon, Logo primitives + forge.* tokens"
  - phase: 03
    provides: "RHF+Zod auth schemas, error.code mapping, signUp/signInWithPassword flow"
provides:
  - "Forge-reskinned sign-in + sign-up screens (light/dark, live i18n labels)"
  - "ForgeField integrated password eye toggle (trailing, inside field) + constant border width"
  - "Sign-up Name field stored to profiles.display_name via handle_new_user metadata (migration 0008)"
  - "Stable keyboard layout (fixed margins, no focus bunching)"
affects: [profile-display, future-forgot-password-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ForgeField secureToggle: integrated trailing eye as a flex child (no absolute positioning)"
    - "handle_new_user reads raw_user_meta_data->>'display_name' to populate profiles.display_name atomically at signup"
    - "Auth screens use fixed margins (not marginTop:auto spacers) for keyboard-stable layout"

key-files:
  created:
    - "app/supabase/migrations/0008_handle_new_user_display_name.sql"
  modified:
    - "app/app/(auth)/sign-in.tsx — Forge re-skin + secureToggle + stable layout"
    - "app/app/(auth)/sign-up.tsx — Forge re-skin + Name field + display_name metadata + stable layout"
    - "app/components/ui/ForgeField.tsx — constant border + integrated secureToggle eye"
    - "app/lib/schemas/auth.ts — signUpSchema gains name (trim, 1..80)"

key-decisions:
  - "D-17 (pure re-skin) extended by UAT: added a Name field to sign-up + stored it to profiles.display_name. Justified by the FSignUp mockup (which has a Name field) and the user's explicit request. RHF+Zod, error.code mapping, and all other copy/logic remain unchanged."
  - "Name storage is atomic via the trigger (migration 0008) reading signUp options.data.display_name from auth metadata — no new column (display_name existed since 0001), no client-side second write."
  - "Eye toggle moved INTO ForgeField (trailing flex child) — fixes the mispositioned/below-field rendering of the old absolute Pressable."
  - "ForgeField border is constant border-2 in all states — focusing no longer resizes the box (no layout shift)."
  - "Auth screens use fixed margins instead of marginTop:auto spacers — the hero no longer bunches toward the fields when the keyboard opens."

patterns-established:
  - "ForgeField secureToggle: self-owned visibility + trailing eye, a11y show/hide labels."
  - "Trigger-fed profile field: form metadata → handle_new_user → profiles column, bounded by a Zod max() at the form boundary."

requirements-completed: [SKIN-01, I18N-02]

# Metrics
duration: ~70min
completed: 2026-06-11
---

# Phase 9 Plan 03: Forge Auth Re-skin Summary

**Forge-reskinned sign-in/sign-up with live-i18n labels, an integrated in-field password eye, a sign-up Name field stored atomically to profiles.display_name, and a keyboard-stable layout — Phase-3 RHF+Zod logic and copy preserved.**

## Performance

- **Duration:** ~70 min (incl. device-UAT iteration)
- **Completed:** 2026-06-11
- **Tasks:** 2 build tasks + Task 3 device UAT (approved after iteration)
- **Files modified:** 4 + 1 migration

## Accomplishments
- Re-skinned both auth screens to Forge (ForgeField/ForgeButton, brand mark, hero, t()-routed labels) in light + dark, with live language switching reaching auth (D-12).
- Integrated the password eye toggle into ForgeField (inside the field, right-aligned, centered) and made the field border constant width (no focus shift).
- Added a Name field to sign-up and wired it through to `profiles.display_name` via migration 0008 (handle_new_user reads signup metadata).
- Stabilised the keyboard layout (fixed margins) so the heading no longer bunches toward the fields on focus.
- Preserved all Phase-3 validation, error.code mapping, the Pitfall §6 info-banner path, and copy (D-17).

## Task Commits
1. **Re-skin sign-in** — `eae1ef1` (feat)
2. **Re-skin sign-up (mirror)** — `52f304b` (feat)
3. **Device UAT** — approved after the fixes below.

### Device-UAT iteration (Task 3)
- `29f853b` integrate eye toggle into ForgeField + add sign-up Name field
- `f17c6e4` store sign-up display_name via handle_new_user trigger (0008)
- `5e71d76` stable auth layout (fixed margins, no keyboard bunching)

## Files Created/Modified
- `app/supabase/migrations/0008_handle_new_user_display_name.sql` — trigger reads `raw_user_meta_data->>'display_name'` → `profiles.display_name` (no new column/policy; SECURITY DEFINER, search_path='').
- `app/app/(auth)/sign-in.tsx` — Forge re-skin; ForgeField secureToggle; fixed-margin layout.
- `app/app/(auth)/sign-up.tsx` — + Name field (RHF Controller, inline error); signUp passes `options.data.display_name`; fixed-margin layout.
- `app/components/ui/ForgeField.tsx` — constant border-2; integrated secureToggle eye (trailing flex child, FIT-66-safe).
- `app/lib/schemas/auth.ts` — `signUpSchema.name = z.string().trim().min(1).max(80)`.

## Deviations
- **D-17 extended (UAT):** sign-up now collects + stores a name (display_name). Mockup-driven + user-requested; all other auth logic/copy unchanged.

## Known gaps (not in scope this phase)
- **Forgot-password flow** is a non-functional label only (no reset/magic-link flow built in V1).
- **First/last-name split** deferred → Linear FIT-84.
- Password strength meter + CTA arrow glyphs from the mockup — not implemented (separate follow-ups).

## Self-Check: PASSED
- Gates green at finalization: `tsc --noEmit`, `expo lint`, `check:locale-parity` (100 keys), `test:rls` (incl. cross-user) all pass; migration 0008 deployed live + verify-deploy confirmed handle_new_user DEFINER/search_path.
- Device UAT (light/dark, both locales) approved by the user.
- FIT-66 preserved (no `active:*`/`shadow-*` classes; pressed feedback via style callbacks).
