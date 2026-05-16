# Phase 7: V1 Polish Cut — Specification

**Created:** 2026-05-15
**Ambiguity score:** 0.13 (gate: ≤ 0.20)
**Requirements:** 6 locked

## Goal

Användare kan logga RPE (1-10, valfri) per set, lägga textanteckningar per pass, och välja temaläge (System/Ljust/Mörkt) i Inställningar — V1 är cut-redo för 4-veckors personlig validering.

## Background

Phase 6 levererade F9 + F10 (historik-lista, session-detail, exercise-chart). Phase 7 stänger de återstående V1-kraven F11 + F12 + F15-toggle utan att röra schemat — alla DB-kolumner finns sen Phase 2 (`exercise_sets.rpe numeric(3,1)`, `exercise_sets.notes text`, `workout_sessions.notes text`); endast UI saknas. Settings-fliken är en placeholder (`(tabs)/settings.tsx:39` — `"Mer kommer i Phase 7."`). Dark mode följer iOS via `useColorScheme()` utan manuell override. SetFormSchema och SessionFormSchema har redan `rpe`/`notes`-fält med "Phase 7 wires UI"-kommentarer (`sets.ts:62`, `sessions.ts:27`). När Phase 7 stänger börjar 4-veckors personlig soak-validering mot PRD §8.

## Requirements

1. **RPE inline-input på workout-loggning**: Användare kan logga RPE valfritt per set utan extra steg.
   - Current: `workout/[sessionId].tsx` inline-raden är `[Vikt] [Reps] [Klart]` (lines 476-554); `setFormSchema.rpe` finns men har ingen UI-binding
   - Target: Inline-raden blir `[Vikt] [Reps] [RPE (valfri)] [Klart]`; RPE-fältet är visuellt-valfritt; tomt → `set.rpe = null`; ifyllt decimaltal 0-10 → `set.rpe = numeriskt`
   - Acceptance: (a) Klart utan att röra RPE-fältet → Supabase-rad har `rpe IS NULL`; (b) Klart med RPE=8.5 → rad har `rpe = 8.5`; (c) RPE > 10 eller < 0 rejects med Zod-felmeddelande inline; (d) decimaler accepteras (numeric(3,1) på server)

2. **RPE-visning i session-history**: Loggade set i historiken visar RPE när det finns.
   - Current: `history/[sessionId].tsx` set-rader (lines 585-594) renderar bara `Set N: {weight} × {reps}`; `rpe`-data ignoreras
   - Target: Set-rader visar `Set N: {weight} × {reps} · RPE {rpe}` när `set.rpe IS NOT NULL`; oförändrat format när null
   - Acceptance: Pass med 3 set (2 med rpe=8, 1 med rpe=null) → history-vy visar RPE-suffix på de 2 första, inget på det tredje

3. **Pass-anteckning i AvslutaOverlay**: Användare kan skriva en anteckning innan pass avslutas.
   - Current: `workout/[sessionId].tsx` AvslutaOverlay (lines 806-917) har titel + bekräftelsetext + Fortsätt/Avsluta-knappar; ingen anteckningsinmatning
   - Target: AvslutaOverlay innehåller TextInput (multi-line, max 500 tecken) ovanför knapparna med placeholder t.ex. "Anteckningar (valfri)"; värdet skickas i `useFinishSession.mutate`-payloaden som `notes`-fält
   - Acceptance: (a) Avsluta med text → `workout_sessions.notes` lagrar texten; (b) Avsluta utan input → `notes IS NULL`; (c) > 500 tecken rejects via schema

4. **Pass-anteckning visning + redigering i session-history**: Användare kan läsa och ändra pass-anteckningar i efterhand.
   - Current: `history/[sessionId].tsx` renderar inte `session.notes`
   - Target: När `session.notes IS NOT NULL` renderas texten i ett textblock ovanför SummaryHeader-chiparna; en pen-/redigera-affordance öppnar en inline-overlay med TextInput förfylld; spara → notes uppdateras (tom text → null); offline-edit replayas via paused-mutation-pattern (Phase 4)
   - Acceptance: (a) Pass med `notes='X'` visar 'X' i detail-vyn; (b) tap-redigera → ändra till 'Y' → spara → DB-raden uppdaterad; (c) töm fältet och spara → `notes IS NULL`; (d) airplane-mode-edit replayas på reconnect

5. **Tema-toggle i Inställningar (3 lägen, omedelbar applicering, AsyncStorage-persisterat)**: Användare kan välja temaläge oavsett iOS-systeminställning.
   - Current: `(tabs)/settings.tsx:39` är en placeholder med texten "Mer kommer i Phase 7."; appen följer iOS-tema via `useColorScheme()` i alla NativeWind `dark:`-varianter; ingen override-mekanism
   - Target: Inställningar-fliken får en sektion "Tema" med segmenterad kontroll `[System | Ljust | Mörkt]` (samma komponent-konvention som Phase 6 `segmented-control.tsx`); valet sparas under nyckel `fm:theme` i AsyncStorage; en ThemeProvider (eller motsv. mekanism via NativeWind colorScheme-API) säkerställer att hela appen följer valet utan app-restart; default = "System" vid första app-start eller saknad lagrad värde
   - Acceptance: (a) Välj "Mörkt" på en iPhone med "Ljust" iOS → appen blir mörk inom 1 sek utan restart; (b) kill app → reopen → temat persisterar; (c) Välj "System" → appen följer iOS igen omedelbart; (d) clear AsyncStorage → första öppning visar "System"-läget

6. **Core-flow ≤ 2 min (V1-cut UAT-gate)**: Hela kärnflödet är friktionsfritt nog för 4-veckors soak-validering.
   - Current: Phase 5 F13 brutal-test mäter set-log ≤3 sek per set; ingen end-to-end-flödesmätning finns
   - Target: En användare med en redan-skapad plan kan: starta pass → logga 3 set → avsluta (med eller utan anteckning) → öppna historik-fliken → öppna passet — på ≤2 min utan fel
   - Acceptance: Manuell UAT med kronometer; 3 av 3 körningar ≤2 min utan att stöta på UI-bugg

## Boundaries

**In scope:**
- F11 inline RPE-fält på workout-screen + RPE-visning i session-history
- F12 pass-anteckning i AvslutaOverlay + visning/redigering i session-history
- F15 manuell tema-toggle (System/Ljust/Mörkt) i Settings + AsyncStorage-persistens + omedelbar applicering utan restart
- Core-flow ≤2 min UAT-mätning
- Phase-level closeout (gsd-secure-phase 7 + gsd-verify-work 7) → V1 cut → 4-veckors soak start

**Out of scope:**
- Per-set anteckningar UI (`exercise_sets.notes`-kolumnen) — PRD F12 säger ordagrant "per pass"; per-set kvar för V1.1 om soak-validering visar tydligt behov
- RPE i F10-chart-routens "Senaste 10 passen"-rader (`exercise/[exerciseId]/chart.tsx`) — chart-route är read-only analytics; RPE-tillägg där har låg värde mot verifieringskostnad, kvar för V1.1
- RPE under tap-to-edit-läget på redan loggat set — V1 levererar bara inline-input + history-visning; retroaktiv RPE-edit är V1.1 polish
- Apple Sign-In (F14), F17-UI set-typ-toggling, F18 PR-detection, F19 vilo-timer — alla redan deferred till V1.1 per ROADMAP
- F1.1 email-confirmation deep-link handler — redan deferred till V1.1 per Phase 3 UAT
- App Store-launch prep (EAS Build, TestFlight, store-listing) — V2 enligt PROJECT.md
- Schema-migreringar — Phase 2 har redan landat rpe + notes-kolumnerna; ingen 00XX_*.sql-fil ska skapas i Phase 7
- AsyncStorage-failure-recovery UI — vid read-fel default:as till "System" tyst (loggas men ej surfaceas till användare)

## Constraints

- **Inga schema-migreringar i Phase 7**: `app/supabase/migrations/`-mappen ska vara oförändrad efter denna fas — alla kolumner finns sen Phase 2 (0001_initial_schema.sql lines 72-83)
- **Theme-applicering utan restart**: Tema-toggle MÅSTE applicera omedelbart; NativeWind 4 + Tailwind 3-stacken (CLAUDE.md TL;DR) stödjer detta via colorScheme override-mekanismer
- **AsyncStorage-nyckel-prefix**: `fm:` (jfr auth-store-konvention); tema-nyckel = `fm:theme`; värden = `'system' | 'light' | 'dark'`
- **RPE-validering**: 0-10 inklusive decimaler (kolumnen är `numeric(3,1)` på server)
- **Notes-validering**: Båda `setFormSchema.notes` och `sessionFormSchema.notes` har redan `z.string().max(500)` — UI får inte tillåta längre input
- **Performance — F13 fortsatt grön**: Inline-RPE-fält får inte sakta ner set-loggning under 3-sek-gränsen mätt av Phase 5 brutal-test (`npm run test:f13-brutal`)
- **Security — service-role-audit oförändrat**: `git grep "service_role\|SERVICE_ROLE"` ska bara matcha `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, och `CLAUDE.md` (Phase 2 security convention)
- **Security — RLS oförändrat**: Phase 7 berör inga RLS-policys; `npm run test:rls` ska fortsätta vara grön utan ändringar (no new user-scoped tables)
- **CLAUDE.md branching**: Phase-arbete sker på `gsd/phase-07-v1-polish-cut`-branch via PR mot dev; aldrig direktcommit mot dev/main

## Acceptance Criteria

- [ ] Inline-raden i `workout/[sessionId].tsx` renderar `[Vikt] [Reps] [RPE (valfri)] [Klart]` — RPE-fältet är synligt
- [ ] Klart utan att fylla RPE → set landar med `rpe IS NULL` i `exercise_sets`
- [ ] Klart med RPE=8.5 → set landar med `rpe=8.5` (decimaltal accepteras)
- [ ] RPE > 10 eller < 0 rejects med inline-felmeddelande via Zod-schema
- [ ] `history/[sessionId].tsx` visar `· RPE {rpe}`-suffix på set-rader där `rpe IS NOT NULL`; suffix saknas där `rpe IS NULL`
- [ ] AvslutaOverlay i `workout/[sessionId].tsx` innehåller TextInput för anteckning; submit fångar texten i `finishSession.mutate`-payloaden
- [ ] Avsluta utan att fylla anteckning → `workout_sessions.notes IS NULL`
- [ ] Avsluta med text → `workout_sessions.notes` lagrar texten exakt
- [ ] `history/[sessionId].tsx` renderar `session.notes` i textblock när det finns
- [ ] Redigera-affordance i `history/[sessionId].tsx` öppnar inline-overlay med förfylld text; spara uppdaterar raden; töm fältet sparar `NULL`
- [ ] Settings-fliken (`(tabs)/settings.tsx`) visar segmenterad kontroll `[System | Ljust | Mörkt]`
- [ ] Välj "Mörkt" på iPhone med "Ljust" iOS-tema → appen blir mörk inom 1 sek utan restart
- [ ] Kill app → reopen → tema persisterar i AsyncStorage under `fm:theme`
- [ ] Default vid första app-start (eller saknad AsyncStorage-värde) = "System"
- [ ] Core-flow UAT: plan → starta pass → 3 set → avsluta → historik → öppna pass på ≤2 min × 3 körningar utan fel
- [ ] `app/supabase/migrations/`-mappen oförändrad i Phase 7 (inga nya 00XX_*.sql-filer)
- [ ] Service-role-audit: `git grep "service_role\|SERVICE_ROLE"` matchar bara `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, `CLAUDE.md`
- [ ] `npm run test:rls` förblir grön (29+ assertions; ingen ny tabell)
- [ ] Phase 5 F13 brutal-test (`npm run test:f13-brutal`) förblir grön efter inline-RPE-tillägg

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                         |
|--------------------|-------|------|--------|-----------------------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      | 3 features + UAT-flödesgate konkretiserade   |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | Per-set notes + RPE-i-chart explicit deferred V1.1 |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Storage (AsyncStorage), lägen (3), zero-schema-migration, F13-perf-gate alla låsta |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 19 pass/fail-checkboxar                       |
| **Ambiguity**      | 0.13  | ≤0.20| ✓      | Gate passed                                   |

Status: ✓ = met minimum

## Interview Log

| Round | Perspective     | Question summary                                        | Decision locked                                                                  |
|-------|-----------------|---------------------------------------------------------|----------------------------------------------------------------------------------|
| 1     | Researcher      | Baseline: vad finns i schemat vs UI idag?              | F11+F12-schema finns sen Phase 2; bara UI saknas; ingen dark-mode-toggle finns idag |
| 1     | Simplifier      | RPE-input-placering? Notes-scope? Toggle-lägen+storage? | RPE inline + visuellt-valfritt; notes per-pass only (per-set V1.1); 3 lägen + AsyncStorage |
| 2     | Boundary Keeper | Visning av RPE i history/chart? Notes-edit-yta? Toggle-design? | RPE i history-set-rader men EJ chart-top-sets (V1.1); notes captureras i AvslutaOverlay + editerbar i history; toggle = segmented control (matchar Phase 6 conventions) |

*Decisions auto-selected by Claude per användarmandat ("välj det bästa för långsiktigt"): per-set notes deferred V1.1, RPE-i-chart deferred V1.1, AsyncStorage över expo-secure-store, 3-lägen-toggle, segmented control över list-radio.*

---

*Phase: 07-v1-polish-cut*
*Spec created: 2026-05-15*
*Next step: /gsd-discuss-phase 7 — implementation decisions (NativeWind colorScheme override mekanism, ThemeProvider-struktur, RPE-input-validering-UX, notes-edit-overlay-mönster)*
