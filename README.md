# Gym Tracker

Personlig fitness-tracker för iPhone. Skapa träningsplaner, logga set/reps/vikt, se historik och progression.

## Stack
- **Frontend**: React Native (Expo) + TypeScript + Expo Router + NativeWind
- **Backend**: Supabase (Postgres + Auth + REST API)
- **AI SDLC**: [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) ovanpå Claude Code
- **Hosting**: Expo Go (utveckling) → EAS Build → App Store (senare)

## Hur du börjar (kort version)

1. Läs [SETUP.md](./SETUP.md) i sin helhet
2. Följ Fas 0–5 (Git, Node, Claude Code, GitHub-repo, GSD-installation, Supabase, Expo)
3. I Fas 6: klistra in [GSD_BOOTSTRAP_PROMPT.md](./GSD_BOOTSTRAP_PROMPT.md) i Claude Code
4. Sedan: kör `/gsd-discuss-phase 1` → `/gsd-plan-phase 1` → `/gsd-execute-phase 1` → `/gsd-verify-work 1`
5. Repeat för varje fas i din roadmap

## Filer i det här repot

### Setup-dokumentation (skrivet manuellt)
- [SETUP.md](./SETUP.md) — Steg-för-steg installationsguide. Börja här.
- [GSD_BOOTSTRAP_PROMPT.md](./GSD_BOOTSTRAP_PROMPT.md) — Prompten du klistrar in i Claude Code i Fas 6

### Referensdokument (matas till GSD)
- [PRD.md](./PRD.md) — Produktkrav: vad appen är, vilka flöden, vilka features
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Teknisk arkitektur, datamodell, RLS-policies, mappstruktur

### Genereras av GSD i Fas 6 och framåt (finns inte ännu)
- `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
- `.planning/research/`, `.planning/<fas>/`
- `.claude/skills/` (GSD-installationen)

### App-koden
- `app/` — Expo-projektet (skapas i Fas 5)

## Arbetsflöde

```
SETUP.md (en gång)
    ↓
GSD_BOOTSTRAP_PROMPT.md (en gång, i Claude Code)
    ↓
/gsd-new-project (genererar PROJECT, REQUIREMENTS, ROADMAP)
    ↓
För varje fas:
  /gsd-discuss-phase N  →  /gsd-plan-phase N  →  /gsd-execute-phase N  →  /gsd-verify-work N  →  /gsd-ship N
    ↓
/gsd-complete-milestone  →  /gsd-new-milestone (när V1 är klar)
```

## Status
🟡 Setup-fas — börja med SETUP.md
