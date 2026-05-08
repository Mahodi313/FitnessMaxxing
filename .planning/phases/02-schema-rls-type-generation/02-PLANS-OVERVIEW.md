# Phase 2 — Plan Summary

> Läsbar översikt över vad `/gsd:plan-phase 02` har planerat. Skriv inte ny kod här — det är en orientering du läser innan `/gsd:execute-phase 02`.

**Skapad:** 2026-05-08
**Status:** Plans verified (plan-checker iteration 2 → VERIFICATION PASSED)
**Nästa kommando:** `/gsd:execute-phase 02`

---

## Vad Phase 2 levererar

Efter Phase 2 har du:
1. **6 tabeller live i Supabase** (`profiles`, `exercises`, `workout_plans`, `plan_exercises`, `workout_sessions`, `exercise_sets`) med RLS aktiverat och korrigerade policies (errata från ARCHITECTURE.md §4 fixade).
2. **Ett bevis på att RLS faktiskt isolerar användare** — `npm run test:rls` exit 0 visar att User B inte kan läsa eller skriva User A:s data.
3. **TypeScript-typer som matchar live-schemat** (`app/types/database.ts`) och en typad Supabase-klient (`createClient<Database>(...)`).
4. **Phase 1-skelettet borttaget** — `phase1ConnectTest` och `_phase1_smoke`-tabellen är borta.
5. **Dokumentation som speglar verkligheten** — `ARCHITECTURE.md §4/§5`, `STATE.md`, och `CLAUDE.md` "Database conventions" är uppdaterade.

Allt detta täcker requirement **F17** (`set_type` ENUM som schema-only) plus de 5 success criteria-punkterna från `ROADMAP.md` Phase 2.

---

## De 6 vågorna — vad händer i varje

```
Wave 1  →  Wave 2  →  Wave 3 [BLOCKING]  →  Wave 4  →  Wave 5  →  Wave 6
 setup     skriv SQL    push live           types      bevisa     dokumentera
                                                       RLS
```

### Wave 1 — `02-01-PLAN.md` — CLI-bootstrap & preflight
**Pausar för dig?** Ja (credentials).

Initierar Supabase CLI:n i repot (`supabase init`, `supabase link`), lägger in `tsx` som devDep, lägger till två npm-scripts (`gen:types`, `test:rls`), och lägger placeholder-rader i `app/.env.example`. Sen pausar exekveraren och ber dig kopiera service-role-nyckeln från Supabase-dashboarden till `app/.env.local`.

**Du behöver i förväg:** DB-lösenordet till ditt Supabase-projekt + förmågan att antingen göra `supabase login` eller sätta `SUPABASE_ACCESS_TOKEN`.

### Wave 2 — `02-02-PLAN.md` — Skriv migration-filen
**Pausar för dig?** Nej (helt automatisk).

Författar `app/supabase/migrations/0001_initial_schema.sql` — en enda fil som innehåller alla 6 tabeller, 4 index, `set_type` ENUM-typen, RLS-aktivering, alla policies (med både `using` OCH `with check` på skrivbara — det här är PITFALLS 2.5-erratan som fixas), och `handle_new_user`-triggern (med `SECURITY DEFINER set search_path = ''`).

**Filen är på disk men inte pushad än.** Grep-gates kontrollerar att SQL:en är korrekt *före* deployment.

### Wave 3 — `02-03-PLAN.md` — `[BLOCKING]` push till live + sanity
**Pausar för dig?** Ja (DB-lösenord + Studio-titt).

Kör `cd app && npx supabase db push --yes`. Detta är det enda steget som faktiskt rör Supabase. Direkt efter körs `supabase db diff` som ska skriva "No schema changes found" (= filen och remote stämmer). Sen pausar exekveraren och ber dig öppna Supabase Studio och bekräfta att:
- Alla 6 tabeller har gröna "RLS enabled"-badges
- `handle_new_user`-funktionen finns
- `on_auth_user_created`-triggern finns
- `set_type` ENUM-typen finns

**Varför `[BLOCKING]`?** För att Wave 4 genererar TypeScript-typer från **applicerat live-schema** — inte från SQL-filen. Om vi hoppar över push:en passerar `tsc --noEmit` ändå (false positive) eftersom typerna kommer från config, inte från databasen.

### Wave 4 — `02-04-PLAN.md` — Type-generering & typed klient
**Pausar för dig?** Nej.

Kör `npm run gen:types` som producerar `app/types/database.ts`. Byter `app/lib/supabase.ts` från `createClient(...)` till `createClient<Database>(...)`. Tar bort `phase1ConnectTest`-funktionen från `supabase.ts` och dess `useEffect`-anrop i `app/app/_layout.tsx`. Verifierar med `npx tsc --noEmit` exit 0.

**Effekt:** Phase 4+ får full TypeScript-completion när de skriver `supabase.from('exercise_sets').select(...)` — t.ex. `set_type` typas som `'working' | 'warmup' | 'dropset' | 'failure'`.

### Wave 5 — `02-05-PLAN.md` — Cross-user RLS-test
**Pausar för dig?** Nej.

Författar `app/scripts/test-rls.ts` — ett Node-only script som med service-role-nyckeln seedar två testanvändare (`rls-test-a@…local`, `rls-test-b@…local`), och försöker som User A läsa/skriva User B:s rader på alla 5 user-scoped tabeller. Inkluderar **det avgörande regression-testet för PITFALLS 2.5-erratan**: kan User A skapa en `plan_exercise` som pekar på User B:s `workout_plan`? Om `with check` saknades → ja → test fallerar.

Kör också `git grep "service_role\|SERVICE_ROLE"` audit-gate som verifierar att nyckeln inte smitit in under `app/lib/` eller `app/app/`.

**Detta är hela poängen med Phase 2.** Utan denna fil har du inget automatiskt sätt att fånga om en framtida migration glömmer `with check`.

### Wave 6 — `02-06-PLAN.md` — Doc-rekonciliering
**Pausar för dig?** Nej.

Uppdaterar `ARCHITECTURE.md §4` så RLS-policys speglar deployed verklighet, `§5` så F7/F10-queries filtrerar `set_type='working'` istället för det borttagna `is_warmup=false`. Flippar errata-noten i `STATE.md` från "ej fixad" till "fixad". Lägger till "Database conventions"-sub-sektion i `CLAUDE.md` (per D-18) som låser in spelreglerna för framtida migrations: alla schema-ändringar går genom `supabase/migrations/`, varje skrivbar policy har både `using` och `with check`, varje `auth.uid()` är wrappad, `gen:types` körs efter varje migration.

---

## Var pausar exekveringen för dig?

Två gånger:

| Wave | Plan | Vad du gör | Hur lång tid |
|------|------|------------|--------------|
| 1 | 02-01 Task 3 | Klistra in service-role-nyckeln i `.env.local` | ~2 min |
| 3 | 02-03 Task 1 | Ange DB-lösenord till `supabase db push`, sen titta i Studio | ~5 min |

Resten är automatiskt. Total active-time från dig: ~10 min spridda över exekveringen.

---

## Hur du vet att Phase 2 är klar

När `/gsd:execute-phase 02` är klar ska detta gälla:

```bash
cd app

# 1. Schema är på live-projekt utan drift:
npx supabase db diff
# → "No schema changes found"

# 2. RLS isolerar användare:
npm run test:rls
# → exit 0; per-tabell-loggar visar alla assertions OK

# 3. TypeScript kompilerar mot genererade typer:
npx tsc --noEmit
# → exit 0; inga fel

# 4. Service-role-nyckeln är inte i klient-koden:
git grep "service_role\|SERVICE_ROLE"
# → Endast träffar i: app/scripts/test-rls.ts, app/.env.example, .planning/, CLAUDE.md

# 5. Phase 1-skelettet är borta:
git grep "phase1ConnectTest\|_phase1_smoke"
# → Inga träffar (förutom eventuellt i .planning/phases/01-... arkivet)
```

Plus: i Supabase Studio ska alla 6 tabeller visa "RLS enabled"-badge.

---

## Risker att vara medveten om

1. **DB-lösenordet är obligatoriskt för push.** Phase 2 kan inte slutföras utan att du har det. Hämta från Project Settings → Database → Connection string innan du startar exekvering.
2. **Service-role-nyckeln aldrig i klient.** Audit-gaten i Wave 5 fångar det automatiskt, men var vaksam när du klistrar credentials.
3. **`supabase gen types` kräver inloggning eller PAT.** Om du inte gjort `supabase login` än så kommer Wave 4 fela. Förbered: kör `npx supabase login` en gång (öppnar webbläsare) eller skapa en PAT i dashboard → Account → Access Tokens.
4. **Studio är read-only från Phase 2 framåt.** D-18 låser in detta i CLAUDE.md. Schema-ändringar måste gå via nya migration-filer (0002_…, 0003_…) — aldrig direkt i Studio. Om du råkar göra en Studio-ändring så kommer `supabase db diff` larma vid nästa körning.

---

## Filer i denna phase-mapp (vad var och en är till för)

| Fil | Roll | Vem skrev den |
|-----|------|---------------|
| `02-CONTEXT.md` | 18 låsta beslut + canonical refs (gospel-input) | Du via `/gsd:discuss-phase` |
| `02-DISCUSSION-LOG.md` | Q&A-protokoll från discuss-fasen | `/gsd:discuss-phase` |
| `02-RESEARCH.md` | Teknisk research (CLI-flaggor, korrigerad SQL verbatim, valideringskarta) | `gsd-phase-researcher` |
| `02-VALIDATION.md` | Nyquist-validering (vilka kommandon → vilka kriterier) | Orchestrator från template |
| `02-PATTERNS.md` | Karta över 12 berörda filer + närmaste analog | `gsd-pattern-mapper` |
| `02-01-PLAN.md` | Wave 1 — CLI-bootstrap (pausar) | `gsd-planner` |
| `02-02-PLAN.md` | Wave 2 — skriv migration-fil | `gsd-planner` |
| `02-03-PLAN.md` | Wave 3 — `[BLOCKING]` push (pausar) | `gsd-planner` |
| `02-04-PLAN.md` | Wave 4 — types + typed klient | `gsd-planner` |
| `02-05-PLAN.md` | Wave 5 — cross-user RLS-test | `gsd-planner` |
| `02-06-PLAN.md` | Wave 6 — doc-rekonciliering | `gsd-planner` |
| `02-PLAN-SUMMARY.md` | **Den här filen** — läsbar översikt | Orchestrator (efter request) |

Efter `/gsd:execute-phase 02` kommer ytterligare filer dyka upp:
- `02-VERIFICATION.md` — verifierar att success criteria S1–S5 + F17 faktiskt levererats
- `02-SUMMARY.md` — vad som faktiskt byggdes (skiljer sig potentiellt från planen om avvikelser uppstod)
- `02-LEARNINGS.md` — ev. överraskningar / lärdomar att bära in i framtida phases
