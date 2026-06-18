# Phase 14: Rest Timer (F19) — RESEARCH-FLAGGED - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 14-Rest Timer (F19) — RESEARCH-FLAGGED
**Areas discussed:** Countdown-UI i passet, Auto-start & trigger, Vilotid-konfiguration, Permission & notis-beteende

---

## Countdown-UI i passet

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Flytande pill nedtill | Kompakt pill fixerad längst ner ovanför Klart-zonen | |
| Topp-banner (som PR) | Återanvänder PR-bannerns flytande topp-position (rad 462) | ✓ |
| Inline i aktivt kort | Inuti övningskortet mellan set-lista och inmatningsrad | |

**User's choice:** Topp-banner (som PR)
**Notes:** Konsekvent med befintligt overlay-mönster; löste kollisionen med PR-bannern separat (se nedan).

### Kontroller

| Option | Description | Selected |
|--------|-------------|----------|
| Hoppa över | Avslutar vilan + avbryter notis (TIMER-05) | ✓ (via följdfråga) |
| +30s | Lägger till tid, schemalägger om notisen | ✓ |
| Pausa/återuppta | Fryser nedräkningen | |
| Tap öppnar/stänger inget | Ren info + Hoppa över | |

**User's choice:** +30s (multiselect) → följdfråga klargjorde "Lägg ändå till Hoppa över"
**Notes:** Användaren valde först bara +30s; TIMER-05 kräver tidig-avbryt, så en klargörande fråga ställdes. Resultat: banner har både [Hoppa över] + [+30s], och att logga nästa set avbryter också.

### Tidig avbrytning (TIMER-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Nästa set avbryter (ingen knapp) | Bara logga nästa set avbryter | |
| Lägg ändå till Hoppa över | Både [Hoppa över] + [+30s]; nästa set avbryter också | ✓ |
| Tap på bannern avfärdar | Tap någonstans avbryter | |

**User's choice:** Lägg ändå till Hoppa över

### PR-krock (delad topp-position)

| Option | Description | Selected |
|--------|-------------|----------|
| PR först, timer efter | PR-firande ~3–4s, sedan tar timer-bannern över; timern startar logiskt direkt | ✓ |
| Stapla båda | Båda staplas vertikalt i overlay-stacken | |
| Timern vinner alltid | Timer-banner har företräde; PR-firande visas inte | |

**User's choice:** PR först, timer efter
**Notes:** Timern startar logiskt direkt (timestamp) så nedräkning/notis blir korrekta; bara den visuella bannern skjuts upp.

---

## Auto-start & trigger

### Auto-start

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-start på varje Klart | Varje loggat arbetsset startar vilan automatiskt | ✓ |
| Auto-start om föregående vila är slut | Startar inte om en vila redan pågår | |
| Manuell start | Separat "Starta vila"-knapp | |

**User's choice:** Auto-start på varje Klart

### Set-typer

| Option | Description | Selected |
|--------|-------------|----------|
| Bara arbetsset (working) | Vila startar bara efter arbetsset | ✓ |
| Alla set | Varje loggat set startar vila | |
| Alla utom uppvärmning | Arbetsset + dropset/failure | |

**User's choice:** Bara arbetsset (working)
**Notes:** Konsekvent med PR-detektionens working-only-regel (Phase 13 D-03).

### Snabbt set (vila pågår)

| Option | Description | Selected |
|--------|-------------|----------|
| Starta om vilan | Nytt set avbryter gammal vila + notis, startar fräsch full tid | ✓ |
| Behåll pågående vila | Första vilan fortsätter orörd | |

**User's choice:** Starta om vilan ("senaste setet styr")

---

## Vilotid-konfiguration

### Tid-väljare

| Option | Description | Selected |
|--------|-------------|----------|
| Förinställda val | Fasta val (60/90/120/180s …) | |
| Stegare (±15s) | +/− stegare i 15s-steg | |
| Förinställda + egen tid | Förinställda plus "Anpassad" | ✓ |

**User's choice:** Förinställda + egen tid

### Omfattning (scope-känslig)

| Option | Description | Selected |
|--------|-------------|----------|
| En global standard | En vilotid för alla övningar (TIMER-04 som skrivet) | |
| Global + per-övningsöverstyrning | Per-övning egen vilotid | (valdes först) |

**User's choice:** Global + per-övningsöverstyrning → omdirigerades (scope creep) → **Global nu, per-övning som egen fas**
**Notes:** Per-övning är en ny kapabilitet utöver TIMER-04 (kräver `plan_exercises`-schemaändring + UI + sync). Byggaren flaggade scope-glidning; användaren valde att leverera global standard nu och deferra per-övning till egen framtida fas (kräver ROADMAP/REQUIREMENTS-utökning).

---

## Permission & notis-beteende

### Permission-modell

| Option | Description | Selected |
|--------|-------------|----------|
| Vilotimer kräver permission; in-app fungerar ändå | Nekas → in-app-nedräkning funkar, ingen bakgrundsnotis | ✓ |
| Vilotimer kräver permission; annars avstängd | Raden blockerad tills permission ges | |
| Återanvänd generella notis-togglen | En enda notis-grind | |

**User's choice:** Vilotimer kräver permission; in-app fungerar ändå

### Prompt-timing

| Option | Description | Selected |
|--------|-------------|----------|
| När vilotimern slås på i Settings | Prompt i lugnt sammanhang | ✓ |
| Vid första auto-starten i ett pass | Avbryter hot-path | |
| Vid första appstart/onboarding | Frånkopplat, låg grant-rate | |

**User's choice:** När vilotimern slås på i Settings

### Två reglage (Aviseringar-toggle vs vilotimer)

| Option | Description | Selected |
|--------|-------------|----------|
| Generell toggle = master-grind | Notis fyrar bara om vilotimer PÅ + Aviseringar PÅ | ✓ |
| Vilotimern är oberoende | Egen på/av + permission, frånkopplad | |
| Generella togglen blir vilotimer-togglen | Slå ihop dem | |

**User's choice:** Generell toggle = master-grind
**Notes:** In-app-nedräkningen påverkas inte av master-togglen — bara OS-notisen gated.

### Notisinnehåll

| Option | Description | Selected |
|--------|-------------|----------|
| Text: 'Vilan är slut' | Enkel i18n-titel + text, ingen övningsdata | ✓ |
| Ljud + vibration | Standardljud + vibration (respekterar fm:haptics) | ✓ |
| Tap öppnar passet | Deep-link till workout/[sessionId] | ✓ |
| Tyst notis (ingen ljud) | Diskret, inget ljud | |

**User's choice:** Text + Ljud/vibration + Tap öppnar passet (multiselect)

---

## Claude's Discretion

- Exakt preset-lista för väljaren + custom-input-mekanism (D-08).
- Timestamp-rekoncilieringsmekanism (TIMER-02) — RESEARCH-FLAGGED.
- `expo-notifications` schedule/cancel/reschedule + Expo Go SDK 54-beteende — RESEARCH-FLAGGED.
- Permission-status-visning i Settings-raden (denied/blocked, deep-link till iOS Settings).
- Banner enter/exit-motion (§07 + reduce-motion snap).
- `t()`-nyckelnamn för nya strängar.
- Beteende när passet avslutas medan en vila pågår (default: avbryt pending vila + notis).
- Exakt default-värde bekräftat till 2 min (120s) från mocken.

## Deferred Ideas

- Per-övnings vilotid-överstyrning (egen framtida fas; kräver schemaändring).
- Pausa/återuppta-kontroll (övervägd, ej vald).
- Reduce-motion som in-app-pref (OS-setting only).
- Rikare notisinnehåll (övningsnamn/nästa-set-hint på låsskärm).
- Remote push-notiser (out of scope, lokala notiser only).
