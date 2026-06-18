---
phase: 10
slug: plans-exercises-re-skin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 10-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `tsx`-run standalone Node scripts (no Jest/Vitest in repo — verified package.json) |
| **Config file** | none — scripts in `app/scripts/*.ts`, run via `npm run test:*` (cwd `app/`) |
| **Quick run command** | `npm run test:exercise-schemas` (Zod schema unit) + `npm run lint` |
| **Full suite command** | `npm run test:rls && npm run test:f13-brutal && npm run check:locale-parity` |
| **Estimated runtime** | ~30–60 seconds (RLS cross-user + f13-brutal dominate) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` + the relevant `test:*-schemas` quick script.
- **After every plan wave:** Run `npm run test:rls && npm run test:f13-brutal && npm run check:locale-parity`.
- **Phase gate (post-migration):** `npm run gen:types` (clean diff committed) → `npx tsx --env-file=.env.local scripts/verify-deploy.ts` (all assertions PASS) → full suite green → device UAT light+dark → `/gsd:verify-work`.
- **Before `/gsd:verify-work`:** Full suite must be green.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

| Req ID | Behavior | Wave | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|----------|------|------------|-----------|-------------------|-------------|--------|
| SKIN-02 | Hard-delete preserves history; A cannot delete B's plan | — | T-10-* | RLS / cross-user | `npm run test:rls` (extend with seed_key + re-affirm plan-delete) | ✅ test-rls.ts (extend) | ⬜ pending |
| SKIN-02 | FK still `ON DELETE SET NULL` (confdeltype='n') | — | T-10-* | deploy assertion | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` (add FK + column check) | ✅ verify-deploy.ts (extend) | ⬜ pending |
| SKIN-03 | `seed_key` column exists + RLS covers it | — | T-10-* | RLS / deploy | `npm run test:rls` + verify-deploy | ✅ (extend both) | ⬜ pending |
| SKIN-03 | Muscle-group map resolves sv/en → key, unknown → other | 0 | — | unit | `npm run test:muscle-group` (tsx over `resolveMuscleGroupKey`) | ❌ W0 | ⬜ pending |
| SKIN-03 | exercise form schema accepts muscle-group key + seed_key shape | — | — | unit | `npm run test:exercise-schemas` (extend) | ✅ (extend) | ⬜ pending |
| I18N-05 | sv↔en key parity after new per-screen + seed keys | — | — | parity | `npm run check:locale-parity` | ✅ check-locale-parity.ts | ⬜ pending |
| SKIN-08 | F13 hot path no-regression | — | — | brutal integration | `npm run test:f13-brutal` | ✅ | ⬜ pending |
| SKIN-07 | Tab bar light + dark | — | — | manual UAT (Expo Go) | device screenshot round (light + dark) | manual-only — UI | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/scripts/test-muscle-group.ts` — unit-tests `resolveMuscleGroupKey` (covers SKIN-03 D-03; sv/en → key, unknown → `other`)
- [ ] `app/scripts/test-rls.ts` — add `exercises.seed_key` cross-user block + re-affirm plan hard-delete cross-user (extend, not new file)
- [ ] `app/scripts/verify-deploy.ts` — add column-existence (`exercises.seed_key`, `workout_sessions.plan_name_snapshot`) + FK `confdeltype='n'` assertion for `workout_sessions_plan_id_fkey` (extend)
- [ ] `app/scripts/test-exercise-schemas.ts` — extend for muscle-group-key + seed_key shape (extend)
- [ ] No framework install needed — `tsx` already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All re-skinned screens match Forge in light + dark | SKIN-02/03/07 | Visual fidelity / device feel is not assertable in Node | Expo Go on iPhone: open each screen (plans list, plan detail, new-plan, picker + create-new, plan-exercise edit, tab bar) in light then dark; compare to UI-SPEC + forge-screens.jsx |
| Tab bar matches design light + dark | SKIN-07 | OS-rendered chrome, visual | Toggle system theme; verify Planer/Historik/Inställningar bar |
| Hard-delete confirmation flow + history reads sensibly post-delete | SKIN-02 | End-to-end device flow | Delete a plan that has logged sessions; confirm history still lists those sessions with snapshot/`— ingen plan` |
| First-run seed lands (~15–20 exercises, bilingual) | SKIN-03 | First-launch AsyncStorage flag behavior | Fresh install / clear `fm:exercises_seeded`; verify picker populated; flip sv↔en and confirm seed names/equipment translate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (muscle-group unit + extended RLS/deploy/schema scripts)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
