// File: app/scripts/check-i18n-coverage.ts
//
// i18n COVERAGE gate for Phase 15 (Bilingual & Release Hardening), Plan 15-01.
//
// Proves (D-01 / I18N-03 automated half):
//   1. Every statically-resolvable t('literal') key referenced in
//      app/app/** + app/components/** exists in app/locales/sv.json (top-level
//      flat key) OR begins with an allow-listed nested-namespace prefix
//      (exercise.* / equip.* — runtime-concatenated, see NESTED_PREFIXES).
//   2. No user-visible JSX text literal bypasses t(): JSX text children that
//      contain letters and are NOT {t(...)} / {variable} / pure punctuation are
//      flagged as untranslated.
//
// This is the orthogonal sibling of check-locale-parity.ts: parity proves
// sv↔en symmetry; this proves t()-call coverage + no hardcoded copy. Both run
// as hard CI gates (D-03). A missing key here would render a Swedish fallback
// (or the raw key) on a screen we believe is fully translated — a silent UX
// regression this gate catches at build time.
//
// ── Hardcoded-string exclusion list (Assertion 2 — RESEARCH Pitfall 3) ──
// The JSX-literal flag deliberately IGNORES strings that are not user copy:
//   - testID="..."                         (test hooks, never rendered)
//   - icon name="..." props                (@expo/vector-icons / Ionicons glyph ids)
//   - key="..."                            (React list keys)
//   - href="..." / route literals          (expo-router paths)
//   - className="..." / style string values (NativeWind / RN style tokens)
//   - console.* arguments                   (dev logging)
//   - format(...) date-pattern strings      (date-fns patterns, e.g. "dd MMM")
//   - single-glyph punctuation              (× — · etc — decorative, not copy)
//
// ── Dynamic-key call sites (RESEARCH Pitfall 2 — NOT resolved, by design) ──
// The literal-only regex t\(\s*['"]...['"] naturally SKIPS t(variable) and
// t(exerciseNameKey(...)) / t('exercise.' + seed_key + '.name'). That is
// correct: their runtime values are guaranteed-covered (static tab labels in
// sv.json; exercise.* / equip.* under NESTED_PREFIXES). Do NOT attempt to
// resolve dynamic args — an AST would not solve this either.
//
// Exit code: 0 when coverage is complete; 1 (after printing the missing keys +
// flagged hardcoded literals) when a gap exists.
//
// Run via: cd app && npm run test:i18n-coverage
//   (which expands to: tsx scripts/check-i18n-coverage.ts)
//
// This script is Node-only — it is NEVER imported from a Metro-bundled path.
// (CLAUDE.md service-role isolation: `git grep "service_role"` must stay clean;
// this scan reads .tsx source + sv.json only — no .env.local, no Supabase key.)
//
// References:
//   - app/scripts/check-locale-parity.ts (Node-only header + sv.json import + exit-code gate — cloned)
//   - app/scripts/test-rls.ts (Node-only tsx-script header convention)
//   - .planning/phases/15-bilingual-release-hardening/15-RESEARCH.md §Pattern 1 + Pitfalls 1/2/3
//   - .planning/phases/15-bilingual-release-hardening/15-PATTERNS.md §check-i18n-coverage.ts

import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sv from "../locales/sv.json";

// sv.json is the assertion source: ~205 flat top-level keys + 2 nested objects.
const flatKeys = new Set(Object.keys(sv));

// Nested namespaces addressed by runtime-concatenated keys
// (t('exercise.' + seed_key + '.name'), t('equip.' + equipment)). A flat-key
// existence check WOULD false-fail these, so allow-list their prefixes
// (RESEARCH Pitfall 1). Adding a new nested namespace to sv.json requires
// adding its prefix here.
const NESTED_PREFIXES = ["exercise.", "equip."];

function keyIsCovered(key: string): boolean {
  if (flatKeys.has(key)) return true;
  return NESTED_PREFIXES.some((p) => key.startsWith(p));
}

// ── Enumerate the source surface ──────────────────────────────────────────
// app/app/**/*.tsx + app/components/**/*.tsx, resolved relative to this script
// (scripts/ → app/). node 22+ ships fs.globSync; this repo runs node 24.
// EXCLUDE _forge-gallery.tsx — it is the __DEV__-only Forge component gallery
// (never user-facing, label strings are component-name demos, PATTERNS §UAT).
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED_FILES = ["app/(app)/_forge-gallery.tsx"];
const files = [
  ...globSync("app/**/*.tsx", { cwd: appRoot }),
  ...globSync("components/**/*.tsx", { cwd: appRoot }),
]
  .filter((rel) => !EXCLUDED_FILES.includes(rel.split(path.sep).join("/")))
  .map((rel) => path.join(appRoot, rel));

// ── Assertion 1: t('literal') key coverage ─────────────────────────────────
// Literal-only — single OR double quote, no template literals, no variables.
const T_LITERAL = /\bt\(\s*['"]([^'"]+)['"]/g;

type MissingKey = { key: string; file: string };
const missingKeys: MissingKey[] = [];
const seenMissing = new Set<string>();

// ── Assertion 2: hardcoded user-visible JSX text ───────────────────────────
// JSX text children that contain a letter and are not wrapped in an expression.
// We scan line-by-line for `>text<` runs between JSX tags.
const JSX_TEXT = />([^<>{}]+)</g;
// Strings that are NOT user copy (exclusion list — see header).
const EXCLUDED_ATTR = /\b(testID|name|key|href|className|style|accessibilityRole|placeholder)\s*=\s*['"]/;
const HAS_LETTER = /[A-Za-zÀ-ÿ]/;
// Pure-punctuation / decorative single glyphs (×, —, ·, /, |, %, etc.) — never copy.
const PUNCT_ONLY = /^[\s×—·•/|%·.,:;–\-+()[\]{}#@*…→←]*$/;
// JS-expression artifacts: the `>(...)<` regex can straddle a comparison /
// logical operator that is NOT JSX text (e.g. `idx >= 0 && idx < arr.length`
// matches as `= 0 && idx`). Real JSX copy never contains these operators.
const EXPR_ARTIFACT = /(&&|\|\||==|=>|>=|<=|\?\?|\bidx\b|\.length\b|=\s)/;

type Flagged = { text: string; file: string; line: number };
const flagged: Flagged[] = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const relFile = path.relative(appRoot, file).split(path.sep).join("/");

  // Assertion 1 — collect every literal t() key.
  for (const m of src.matchAll(T_LITERAL)) {
    const key = m[1];
    if (!keyIsCovered(key)) {
      const dedupe = `${key}::${relFile}`;
      if (!seenMissing.has(dedupe)) {
        seenMissing.add(dedupe);
        missingKeys.push({ key, file: relFile });
      }
    }
  }

  // Assertion 2 — flag hardcoded user-visible JSX text.
  const lines = src.split("\n");
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    // Skip comment lines and lines that are clearly attribute assignments
    // (testID, icon name, className, etc.) — those carry non-copy strings.
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) return;
    if (EXCLUDED_ATTR.test(line)) return;
    if (line.includes("console.")) return;
    if (line.includes("format(")) return;

    for (const m of rawLine.matchAll(JSX_TEXT)) {
      const text = m[1].trim();
      if (text.length === 0) continue;
      if (!HAS_LETTER.test(text)) continue; // numbers / punctuation only
      if (PUNCT_ONLY.test(text)) continue;
      if (EXPR_ARTIFACT.test(m[1])) continue; // straddled a JS comparison/logical op, not JSX text
      // Expression children ({t(...)}, {variable}) never reach this regex
      // because it excludes `{` / `}`. Any letter-bearing run here is a raw
      // JSX text literal that bypassed t().
      flagged.push({ text, file: relFile, line: i + 1 });
    }
  });
}

// ── Exit-code gate (cloned shape from check-locale-parity.ts) ───────────────
if (missingKeys.length === 0 && flagged.length === 0) {
  console.log(
    `PASS — i18n coverage complete (${files.length} files scanned, ${flatKeys.size} flat keys + ${NESTED_PREFIXES.join("/")} namespaces).`,
  );
  process.exit(0);
}

console.error("FAIL — i18n coverage gap detected.");
if (missingKeys.length > 0) {
  console.error(`\n  Missing t() keys (${missingKeys.length}) — not in sv.json and not a nested namespace:`);
  for (const { key, file } of missingKeys) {
    console.error(`    "${key}"  (${file})`);
  }
}
if (flagged.length > 0) {
  console.error(`\n  Hardcoded JSX text literals (${flagged.length}) — wrap in t() or add to exclusion list:`);
  for (const { text, file, line } of flagged) {
    console.error(`    "${text}"  (${file}:${line})`);
  }
}
process.exit(1);
