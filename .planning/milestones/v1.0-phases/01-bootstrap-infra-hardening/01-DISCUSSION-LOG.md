# Phase 1: Bootstrap & Infra Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 1-Bootstrap & Infra Hardening
**Areas discussed:** Scaffold-strategi, Provider-scaffold-gräns, Mapp- & route-konventioner

**Gray-area selection (multiSelect):**
| Option | Description | Selected |
|--------|-------------|----------|
| Scaffold-strategi | Reset eller behåll Expo-scaffolden? | ✓ |
| Smoke-test omfattning | Bara "Hello FitnessMaxxing" eller även dark-toggle + Supabase env-läs i UI? | |
| Provider-scaffold-gräns | TanStack/NetInfo/Supabase wirad i Phase 1 eller per-fas? | ✓ |
| Mapp- & route-konventioner | `lib/`, `features/`, `(auth)`/`(app)` nu eller organiskt? | ✓ |

---

## Scaffold-strategi

### Q1 — Hur ska vi hantera det befintliga Expo-scaffolden?
| Option | Description | Selected |
|--------|-------------|----------|
| Reset — fläka ut allt | Kör `npm run reset-project` (flyttar demo till `app-example/`); ren start | ✓ |
| Behåll, bygg ovanpå | Låt scaffolden ligga; ersätt bara `(tabs)/index.tsx`; städa gradvis | |
| Selektiv städning | Behåll layout-skelett, ta bort hello-wave/parallax/themed-* nu | |

**User's choice:** Reset — fläka ut allt
**Notes:** Tydligt val för ren start; CLAUDE.md + research/ är tillräcklig referens.

### Q2 — Vad gör vi med `app-example/`-mappen efter reset?
| Option | Description | Selected |
|--------|-------------|----------|
| Radera direkt | Rensa bort; ingen demo-cruft i repo | ✓ |
| Behåll men gitignore | Behåll lokalt för referens, lägg i `.gitignore` | |
| Behåll & committa | Referens-bibliotek i repo | |

**User's choice:** Radera direkt

### Q3 — Vad ska initial `app/app/index.tsx` visa?
| Option | Description | Selected |
|--------|-------------|----------|
| Bara smoke-text | `<Text className="text-2xl text-blue-500 dark:text-blue-300">Hello FitnessMaxxing</Text>` | ✓ |
| Smoke + status-rad | Smoke + visa env-vars-prefix (verifierar #4 visuellt) | |
| Smoke + manuell tema-toggle | Smoke + toggle-knapp (preview Phase 7-toggle) | |

**User's choice:** Bara smoke-text
**Notes:** Höll Phase 1-acceptansen smal — env-vars-verifiering hanteras via Supabase connect-test (D-07), inte UI.

### Q4 — Behöver vi en egen `useColorScheme`-wrapper?
| Option | Description | Selected |
|--------|-------------|----------|
| Använd `useColorScheme` direkt | Importera från `react-native` när det behövs; ingen `hooks/`-mapp | ✓ |
| Lägg en tom `lib/theme.ts` | Placeholder för manual-toggle-logik senare | |
| Skip helt nu, hantera i Phase 7 | Phase 1 rör inte tema-hooks alls | |

**User's choice:** Använd `useColorScheme` direkt

---

## Provider-scaffold-gräns

### Q1 — Vilka NPM-paket installeras i Phase 1?
| Option | Description | Selected |
|--------|-------------|----------|
| Hela locked-stacken nu | Alla paket från CLAUDE.md TL;DR-tabellen | ✓ |
| Bara bootstrap-essentiella | NativeWind + Tailwind + prettier; lägg till resten just-in-time | |
| Mellanväg | NativeWind + Tailwind + Supabase-klienten + secure-store; resten senare | |

**User's choice:** Hela locked-stacken nu
**Notes:** Senare faser ska bara skriva kod — inga install-vagnar i feature-faser.

### Q2 — Vilka providers/listeners wiras i `_layout.tsx`?
| Option | Description | Selected |
|--------|-------------|----------|
| Allt från STACK.md-receptet | QueryClientProvider + AppState focus + NetInfo online runt `<Stack/>` | ✓ |
| Bara QueryClientProvider | QueryClient + Provider; skip AppState/NetInfo tills Phase 4 | |
| Inga providers nu | Installera men lämna `<Stack/>`-only; senare faser wirar | |

**User's choice:** Allt från STACK.md-receptet

### Q3 — Skapa `lib/supabase.ts` med LargeSecureStore i Phase 1?
| Option | Description | Selected |
|--------|-------------|----------|
| Ja, skapa & connect-test | LargeSecureStore + lätt connect-test bevisar success criteria #4 funktionellt | ✓ |
| Skapa filen, ingen connect-test | LargeSecureStore på plats, men ingen anrops-verifiering | |
| Skip helt nu | Bara att env-vars laddas räcker; Phase 3 skapar klienten | |

**User's choice:** Ja, skapa & connect-test

### Q4 — TanStack Query persister wira i Phase 1?
| Option | Description | Selected |
|--------|-------------|----------|
| Wira nu, default config | AsyncStorage-persister, 24h `maxAge` default | ✓ |
| Vänta till Phase 4 | Lägg persister när offline-kö-strategin avgörs | |
| Du bestämmer | Claude väljer | |

**User's choice:** Wira nu, default config

---

## Mapp- & route-konventioner

### Q1 — `(auth)` och `(app)` route-grupperna i Phase 1?
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-skapa skelett | (auth)/_layout.tsx + (app)/_layout.tsx + Stack.Protected redan nu | |
| Vänta till Phase 3 | Bara `app/app/index.tsx` + reset-default `_layout.tsx` i Phase 1 | ✓ |
| Bara `(app)`-skelettet | Tabs-placeholder för (app); (auth) väntar | |

**User's choice:** Vänta till Phase 3
**Notes:** Undviker premature scaffolding — Phase 3 har naturligt en `_layout.tsx`-pass när auth-state finns att skydda mot.

### Q2 — Mappstruktur utöver `app/lib/`?
| Option | Description | Selected |
|--------|-------------|----------|
| Flat: lib/ + components/ | Cross-cutting i lib/, delade UI i components/ | |
| Feature-folders från start | lib/ + features/<domain>/ etablerat innan första feature byggs | |
| Du bestämmer Phase 4 | Bara lib/ i Phase 1; folder-konvention senare | ✓ |

**User's choice:** Du bestämmer Phase 4
**Notes:** Phase 1 etablerar bara `app/lib/`; resten växer organiskt när faktiskt behov finns.

### Q3 — Filnamn-konvention?
| Option | Description | Selected |
|--------|-------------|----------|
| Kebab-case för allt | Konsekvent med scaffold och Expo Router-routes | ✓ |
| PascalCase för komponenter | Routes kebab, komponenter PascalCase, hooks camelCase | |
| Du bestämmer | Claude väljer | |

**User's choice:** Kebab-case för allt

### Q4 — Path-aliaset `@/...`?
| Option | Description | Selected |
|--------|-------------|----------|
| Behåll `@/` = app-root | Standard Expo-konvention; redan i tsconfig | ✓ |
| Lokala lägg-till för `@/lib`, `@/components` | Specifika alias-er för tydlighet | |
| Ta bort, använd relativa | Inga alias | |

**User's choice:** Behåll `@/` = app-root

---

## Claude's Discretion

- Exakt formatering av smoke-test-vyn (klasser, layout-detaljer) så länge dark-mode-konventionen är synlig.
- Exakt URL/syntax för Supabase connect-test (vad som mest pålitligt bevisar nätverk + headers).
- Exakta `gcTime`/`staleTime`-defaults i QueryClient.

## Deferred Ideas

- `(auth)`/`(app)` route-grupp-skelett → Phase 3
- Feature-folder-konvention (`features/<domain>/`) → Phase 4
- Dark-mode toggle-UI → Phase 7 (F15)
- Egen `useColorScheme`-wrapper / `lib/theme.ts` → Phase 7 om manual-override
- Error-boundary, splash-screen-customization, CI-skelett → Phase 7 / V1.1
