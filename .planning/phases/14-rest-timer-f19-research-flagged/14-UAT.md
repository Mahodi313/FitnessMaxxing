---
status: testing
phase: 14-rest-timer-f19-research-flagged
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md, 14-04-SUMMARY.md]
started: 2026-06-15T18:54:11Z
updated: 2026-06-15T18:54:11Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Aktivera vilotimer + notisbehörighet
expected: |
  I Inställningar: slå PÅ "Vilotimer"-raden. iOS visar notis-behörighetsprompten
  in-context (D-13). Neka den → timern är ÄNDÅ aktiverad och en dämpad (INTE röd)
  hjälptext "Notiser av — vilan räknas ändå ner i appen." visas under raden (D-12).
  Om behörigheten är blockerad blir hjälptexten en tryckbar länk till iOS-inställningar.
awaiting: user response

## Tests

### 1. Aktivera vilotimer + notisbehörighet
expected: I Inställningar slå PÅ "Vilotimer". iOS-behörighetsprompten visas in-context (D-13). Neka → timern är ÄNDÅ aktiverad + dämpad (ej röd) helper "Notiser av — vilan räknas ändå ner i appen" (D-12). Blockerad → helper är länk till iOS-inställningar.
result: issue
reported: "kolla på inställningen det där ser inte ut att hålla kvalité standard. Du måste tänka på att andra kommer att använda den för en bättre design"
severity: cosmetic

### 2. Längdväljare + persistens över omstart
expected: Tryck på chevron/värdet på Vilotimer-raden → ActionSheet med presets (1 min / 1:30 / 2 min / 3 min / 5 min) + "Anpassad". Välj "3 min". Tvångsstäng och öppna appen igen → raden visar "På · 3 min" (fm:restSeconds sparat, TIMER-04).
result: [pending]

### 3. Banner-geometri + endast working-set startar vila
expected: Starta ett pass. Logga ett WORKING-set ("Klart") med timern på → en flytande nedräkningsbanner dyker upp högst upp UTAN att set-listan, input-raden eller Klart-knappen flyttar sig (D-01/TIMER-01). Logga sedan ett WARMUP-set → ingen vila startar (D-06).
result: [pending]

### 4. Bakgrundsreconcile (timestamp-baserad)
expected: Medan en vila räknar ner, lägg appen i bakgrunden ≥30s, återgå. M:SS visar den ÅTERSTÄLLDA återstående tiden (t.ex. 90s total, 30s i bakgrund → ~1:00 eller mindre), inte det frysta värdet (TIMER-02).
result: issue
reported: "Tiden räknar inte ner" — VILA-bannern frusen på 1:00 i förgrunden (sessions-pillen 0:23 tickar däremot)
severity: blocker

### 5. Bakgrundsnotis pingar (TIMER-03)
expected: Med timern på + behörighet beviljad, logga ett working-set, swipa hem (bakgrund), vänta tills vilan löper ut. Notisen "Vilan är slut" / "Rest is over" pingar på låsskärmen MEDAN appen är i bakgrunden. Innehållet är generisk text (ingen övning/vikt/reps — D-15).
result: [pending]

### 6. Tryck på notis → deep-link till rätt pass (inga dubbel-lyssnare)
expected: Tryck på bakgrundsnotisen → appen öppnar direkt (app)/workout/[sessionId] för SAMMA pass (D-15). Hot-reloada workout-skärmen 2-3 ggr och tryck igen → exakt EN route-push per tryck (ingen listener-stacking, Pitfall 7).
result: [pending]

### 7. Hoppa över / +30s avbryter schemalagd notis (TIMER-05)
expected: Starta en vila, tryck "Hoppa över" före den löper ut, bakgrunda och vänta förbi original-sluttiden → INGEN stale notis pingar. Upprepa med "+30s" → notisen pingar vid den FÖRLÄNGDA tiden, inte originalet.
result: [pending]

### 8. PR-banner → timer-banner handoff (D-04)
expected: Logga ett set som BÅDE är ett personbästa OCH startar en vila. PR-firandebannern spelas FÖRST (~3-4s), sedan tar timer-bannern toppslotten (D-04). Nedräkningen är korrekt utifrån logg-tid (inte off-by 3-4s — endTs sätts vid logg-tid).
result: [pending]

### 9. Reduce Motion — snap men numeral tickar ändå
expected: Aktivera Reduce Motion i iOS Hjälpmedel. Logga ett working-set med timern på → banner-entrén SNAPPAR (ingen translateY/scale-animation) men M:SS-numret tickar ändå ner korrekt och båda kontrollerna är tryckbara (D-19).
result: [pending]

### 10. Master-toggle gating-matris (SET-07 / D-14)
expected: Vilotimer PÅ + master-notiser PÅ + behörighet beviljad → notis FIRES. Master-notiser AV → INGEN notis (men in-app-nedräkning körs ändå). Vilotimer AV → ingen nedräkning OCH ingen notis. Behörighet NEKAD → ingen notis, in-app-nedräkning körs med deny-hint.
result: [pending]

## Summary

total: 10
passed: 0
issues: 2
pending: 8
skipped: 0
blocked: 0

## Gaps

- truth: "Vilo-nedräkningen tickar ner i förgrunden (M:SS minskar varje sekund)"
  status: resolved  # User confirmed on device 2026-06-15: "Det funkar nu!" (foreground tick; background-reconcile Test 4 still pending device test)
  reason: "User reported: 'Tiden räknar inte ner' — VILA-bannern frusen på 1:00 medan sessions-pillen 0:23 tickar"
  severity: blocker
  test: 4
  root_cause: "React Compiler (app.json experiments.reactCompiler: true) memoiserar figure = formatMSS(remainingMs(endTs, Date.now())) på dess enda reaktiva input (endTs). Date.now() behandlas som icke-reaktiv konstant, så ett oanvänt tick-state som tvingar re-render serverar den CACHADE figuren. Bannern re-renderas varje sekund men visar 1:00 fryst."
  artifacts:
    - path: "app/components/ui/RestTimerBanner.tsx"
      issue: "Oanvänt `tick`-state + bare Date.now()-läsning i render → React Compiler cachar figuren keyad på endTs"
  missing:
    - "Härled figuren från reaktivt `now`-state som intervallet uppdaterar (setNow(Date.now()) varje sekund + på AppState 'active')"
  fix_applied: "RestTimerBanner.tsx — `const [now, setNow] = useState(() => Date.now())`; forceTick = () => setNow(Date.now()); remaining = remainingMs(endTs, now). tsc 0, lint 0. Awaiting device re-verify."
  debug_session: ""

- truth: "Vilotimer-inställningen (och dess yta) håller produktklass design"
  status: failed
  reason: "User reported: 'kolla på inställningen det där ser inte ut att hålla kvalité standard. Du måste tänka på att andra kommer att använda den för en bättre design'"
  severity: cosmetic
  test: 1
  root_cause: "Vilotimer-raden uppfann en dubbel-kontroll (enable-Toggle + 'På · 1 min ›' value+chevron i samma rad) som INTE finns i Forge-designkällan — forge-screens.jsx SettingsRow är ALLTID antingen en toggle ELLER en value+chevron-disclosure, aldrig båda. Den trängda raden bröt mot systemets vokabulär → kändes off-brand bredvid de rena Haptik/Notiser-togglarna."
  artifacts:
    - path: "app/app/(app)/(tabs)/settings.tsx"
      issue: "Dubbel-kontroll-rad bröt mot Forge SettingsRow-vokabulären"
    - path: "app/components/ui/SettingsRow.tsx"
      issue: "icon var obligatorisk → ingen nästlad sub-rad möjlig"
  missing:
    - "Vilotimer = ren master-toggle-rad; längden = egen avslöjad value+chevron sub-rad (iOS 'enable, then configure'); permission-helper = nästlad caption"
  fix_applied: "SettingsRow.icon gjord valfri (icon-less → indenterad nästlad rad). NOTISER omstrukturerad: Vilotimer ren toggle, revealed 'Vilotid 1 min ›'-sub-rad öppnar längdsheet, denied-helper nästlad caption. Berör hela sektionens konsekvens. tsc 0, lint 0. Awaiting device re-verify."
  debug_session: ""

- truth: "Tidsväljaren håller produktklass Forge-design (inte en rå iOS-systemsheet)"
  status: failed
  reason: "User reported (device-UAT 2026-06-15): 'Jag gillar inte heller den som man väljer tid på' — picker var raw ActionSheetIOS, generiska grå systempiller, ingen Forge-identitet."
  severity: cosmetic
  test: 2
  root_cause: "14-03 klonade Units-radens ActionSheetIOS-idiom — en native systemsheet, off-brand i en annars helt custom-designad app."
  artifacts:
    - path: "app/app/(app)/(tabs)/settings.tsx"
      issue: "openRestDurationSheet använde ActionSheetIOS"
  missing:
    - "Custom Forge-bottom-sheet: mörk yta, grabber, riktiga rader, accent-check på vald tid, Anpassad-rad"
  fix_applied: "ITERATION 2 (user-spec): inline quick-pick chips ersätter sheeten helt — 5 mono+tabular preset-chips (vald=forge-accent fyll), 'Anpassad tid' streckad knapp→Alert.prompt (visar 'Anpassad · X' accent när custom). SettingsRow.icon valfri behålls; master-toggle fick subtitle 'Räkna ner vilan mellan set'; 'Avisering när vilan är slut'-toggle nästlad under chipsen, bell-rad när av. RestDurationSheet.tsx BORTTAGEN (redundant). tsc 0, lint 0, i18n 205/205. Awaiting device verify."
  debug_session: ""

- truth: "VILA-countdown-bannern håller produktklass design"
  status: failed
  reason: "User reported (device-UAT 2026-06-15): 'Jag gillar inte designen så mycket på den modulen som räknar ner.'"
  severity: cosmetic
  test: 3
  root_cause: "Bannern är platt — bara numeral + två kontroller, ingen visuell känsla för hur mycket vila som återstår (UI-SPEC rad 95/112 förutsåg en uttunnande accent-progressindikator som hoppades över)."
  artifacts:
    - path: "app/components/ui/RestTimerBanner.tsx"
      issue: "Ingen progressindikator; platt hierarki"
  missing:
    - "Uttunnande accent-progressbar (UI-SPEC rad 95/112) + stramare hierarki"
  fix_applied: "RestTimerBanner.tsx: pulsande forge-accent live-prick (7×7, 1.6s, reduce-motion-static) före VILA-eyebrow; uttunnande 3px progressrail i botten (forge-border-spår + forge-accent-fyll = remaining/total, total fångas vid endTs-byte, clipas av inner overflow-hidden via outer/inner wrapper så skuggan inte klipps); 'Hoppa över' → outline-ghost (forge-borderStrong, transparent); '+30 s' behåller accentSoft. tsc 0, lint 0. Awaiting device verify."
  debug_session: ""
