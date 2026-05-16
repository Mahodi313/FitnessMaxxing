# Milestones

## v1.0 — MVP (Shipped: 2026-05-16)

**Delivered:** A personal iOS gym tracker where logging a set instantly shows your last value on the same exercise, and never loses a set — even through airplane mode + force-quit + battery-pull.

**Stats:**
- 7 phases · 33 plans · 80 tasks
- 413 commits over 9 days (2026-05-07 → 2026-05-16)
- ~15.2k LOC of TypeScript/TSX in `app/`
- Tech stack pinned: Expo SDK 54 · React Native 0.81 · TypeScript 5.9 · NativeWind 4 + Tailwind 3 · TanStack Query 5 · Zustand 5 · react-hook-form 7 + Zod 4 · Supabase (Postgres + Auth + RLS) · Skia 2 + Victory Native XL 41

**Key accomplishments:**

1. **Phase 1 — Bootstrap & Infra Hardening** (3 plans, 2026-05-08): Locked stack installed via `npx expo install` with correct pins (NativeWind 4 + Tailwind 3 trippel, Reanimated 4, Skia 2); NativeWind smoke-test renders on iPhone via Expo Go; dark-mode `dark:` variant convention established from line 1.
2. **Phase 2 — Schema, RLS & Type Generation** (6 plans, 2026-05-09): 6-table Postgres schema deployed to Supabase remote with errata-fixed RLS (`with check` + wrapped `(select auth.uid())`); 27/27 STRIDE threats SECURED; `set_type` ENUM + `handle_new_user` trigger; cross-user RLS test harness (`scripts/test-rls.ts`) + Windows-without-Docker drift verifier (`scripts/verify-deploy.ts`).
3. **Phase 3 — Auth & Persistent Session** (4 plans, 2026-05-09): Sign-up + sign-in wired to `LargeSecureStore` (AES-encrypted session blob in AsyncStorage with key in `expo-secure-store`); session survives app-restart; root `Stack.Protected` + `(app)` group `<Redirect>` defense-in-depth. UAT 9/11 pass; F1.1 email-confirmation deep-link deferred to V1.1 (FIT-46).
4. **Phase 4 — Plans, Exercises & Offline-Queue Plumbing** (4 plans, 2026-05-10): Create/edit/archive plans, add custom exercises, drag-to-reorder; offline-first via TanStack Query mutation queue with `resumePausedMutations` on reconnect, client-generated UUIDs (FK-safe), two-phase reorder algorithm under shared `scope.id="plan:${planId}"` for serial replay. Airplane-mode UAT signed off `approved`. F2 + F3 + F4 closed end-to-end.
5. **Phase 5 — Active Workout Hot Path (F13 lives or dies)** (7 plans, 2026-05-14): Set logging during a workout: ≤3s from button press to local persistence (verified by `npm run test:f13-brutal`), set-position-aligned "last value" display, survives airplane mode + force-quit + battery-pull through 25-set sessions; draft-session recovery on cold start; `set_number` UNIQUE-trigger + dedupe migration to prevent duplicate writes; Swedish-locale decimal separator (`,` → `.`). F5 + F6 + F7 + F8 + F13 closed.
6. **Phase 6 — History & Read-Side Polish** (4 plans, 2026-05-15): Workout history list (paginated InfiniteQuery on `get_session_summaries` RPC), per-session detail view with set-rows, per-exercise progression chart (max-weight + total-volume) via Victory Native XL on Skia 2; cross-user delete-cascade RLS hardened; chart RPCs server-side aggregated for performance. F8 + F9 + F10 closed.
7. **Phase 7 — V1 Polish Cut** (5 plans, 2026-05-16): F11 inline RPE input on workout set-row + RPE suffix in history detail; F12 session notes capture in `AvslutaOverlay` + view+edit in history-detail with FIFO offline-replay scope (T-07-03 contract); F15 3-mode theme toggle (System/Ljust/Mörkt) with AsyncStorage persistence + `ThemeBootstrap` mounted before SplashScreenController; signed-off iPhone UAT incl. NON-OPTIONAL T-07-03 hardware verification (3-iteration keyboard-avoidance hotfix discovered + fixed during UAT). 20/20 STRIDE threats SECURED.

**Architecture patterns established (carried forward to V1.1+):**

- **FIFO mutation scope per resource** — `useFinishSession` / `useDeleteSession` / `useUpdateSessionNotes` (and the parallel `plan:${id}` family) share `scope.id` so paused mutations replay in issuance order across reconnect, no orphan rows.
- **Inline-overlay UX (NOT modal portals)** — all confirm/destructive/edit overlays render inline inside their host screen (PATTERNS landmine #3); freezeOnBlur cleanup + gesture-handler stay coherent.
- **Direct iOS keyboard measurement** — multi-line `TextInput` overlays use `Keyboard.addListener('keyboardWillShow')` rather than `KeyboardAvoidingView`, which was unreliable inside absolute-positioned backdrops on iOS 26.
- **Migration-as-truth** — schema changes ship as numbered SQL migrations; Studio is read-only; `verify-deploy.ts` introspects `pg_catalog` directly to confirm deploys (Windows-without-Docker substitute for `supabase db diff`).
- **Type-gen runs after every schema migration** — `app/types/database.ts` regenerated from live remote; typed Supabase client (`createClient<Database>`) everywhere including Node scripts.
- **Encrypted session storage** — `LargeSecureStore` wraps `expo-secure-store` + AES so JWT sessions exceeding the 2048-byte SecureStore limit are still encrypted at rest in AsyncStorage.

**Discipline metrics:**

- 79 STRIDE threats verified across phases 2–7 with `threats_open: 0` per phase.
- Cross-user RLS regression test harness extended every phase that ships a new user-scoped table (currently 30+ assertions covering all 6 tables + Phase 5 dedupe + Phase 6 delete-cascade + Phase 6 chart RPC RLS).
- F13 brutal-test (`npm run test:f13-brutal`) — "a logged set must never be lost" — runs as a regression gate at the start of every subsequent phase.
- Per-phase `gsd-code-review` + `gsd-secure-phase` + `gsd-verify-work` gates before phase advancement.
- Per-phase `0X-HUMAN-UAT.md` script for UI-heavy phases (4, 5, 7) executed on real iPhone hardware before phase.complete.

**Requirements:** 15/15 V1 requirements validated (F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F15 convention+toggle, F17 schema). F1.1 email-confirmation deep-link captured for V1.1 (FIT-46) but is not a V1 requirement.

**Known deferred items at close:** 0. Pre-close audit (`gsd-sdk query audit-open`) returned 0 open items after the chore commit `8126c43` resolved 6 status-flag artifacts (FIT-5 debug session moved to resolved/, stale quick-task removed, UAT status strings normalized to `complete`, Phase 7 verification status flipped to `verified` with attestation acceptance recorded).

**What's next:** 4-week personal soak validation (PRD §8) starts 2026-05-17. Tolerance: ≤1 bug/week, all workouts logged paperlessly. Soak outcome gates the App Store path (V1.1 → TestFlight) vs. continued private use.

---
