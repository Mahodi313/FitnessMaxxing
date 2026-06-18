// app/lib/utils/format.ts
//
// Phase 8 (Forge Foundation), Plan 08-01. Locale-aware number + date
// formatting (I18N-04) and the tabular-numeral style helper (DSGN-03).
//
//   - fmtNum: Intl.NumberFormat — Hermes ships Intl natively on iOS, so NO
//     polyfill is needed. sv-SE → "1 234,5" (space-grouped, comma decimal);
//     en-US → "1,234.5". Deliberately replaces lib.jsx's
//     `toLocaleString('sv-SE').replace(/,/g,' ')` hack, which mangles decimal
//     commas (RESEARCH §State-of-the-Art).
//   - fmtDate: date-fns `format` with the sv / enUS locale objects (same
//     date-fns/locale import idiom already used in
//     app/app/(app)/exercise/[exerciseId]/chart.tsx).
//   - tnum: RN Text style enabling tabular figures. DSGN-03 requires numeral
//     ALIGNMENT on stat/numeric cells; `fontVariant: ['tabular-nums']`
//     delivers it. RN does NOT support the web-only `fontFeatureSettings`
//     '"ss01"' stylistic set — that cosmetic refinement is intentionally
//     dropped (alignment is the testable requirement).
//
// References:
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §format.ts
//   - .planning/phases/08-forge-foundation/08-RESEARCH.md §"Number / date
//     formatting", §"Tabular numerals in RN"

import { format } from "date-fns";
import { enUS, sv } from "date-fns/locale";

export type AppLocale = "sv" | "en";

export const fmtNum = (n: number, locale: AppLocale): string =>
  new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-US").format(n);

export const fmtDate = (
  d: Date,
  locale: AppLocale,
  fmt = "d MMM yyyy",
): string => format(d, fmt, { locale: locale === "sv" ? sv : enUS });

// DSGN-03 tabular numerals — apply to stat/numeric <Text> cells for alignment.
export const tnum = { fontVariant: ["tabular-nums"] as const };
