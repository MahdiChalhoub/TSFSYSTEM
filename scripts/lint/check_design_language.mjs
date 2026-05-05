#!/usr/bin/env node
/**
 * Design Language Lint
 * ====================
 * Scans every .tsx file under src/ for violations of the rules
 * documented in .agents/workflows/design-language.md and prints a
 * report. Run as `node scripts/lint/check_design_language.mjs` or
 * via `npm run lint:design`.
 *
 * Exit code 0 = clean, 1 = violations found. CI can run the same
 * command and fail builds on regressions.
 *
 * Why a separate audit (not just an ESLint plugin):
 *   - ESLint's no-restricted-syntax can match string literals but
 *     can't bound size limits ("no text-3xl/4xl/5xl on a tag with
 *     role=heading"), grid template patterns, or context.
 *   - This script reports per-rule counts so we can prioritise the
 *     rules to fix first and track progress over time.
 *   - It runs in <1s on the full repo with no plugin install.
 *
 * See `.eslintrc` for the eslint-side companion rules that catch
 * the simpler patterns inline in the editor.
 */
import { promises as fs } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcDir = join(repoRoot, 'src')

// Each rule has:
//   pattern: a RegExp matched per line
//   message: shown to the operator
//   exempt:  optional path-prefix list of files allowed to violate
//            (e.g. legacy archives we haven't migrated yet)
const RULES = [
    {
        id: 'tw-color-palette',
        pattern: /\b(?:bg|text|border|ring|from|to|via|outline|fill|stroke|placeholder|caret|accent|decoration|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:[1-9]00|50|950)\b/,
        message: 'Raw Tailwind palette color. Use CSS variables: var(--app-primary), var(--app-info, #3b82f6), etc.',
    },
    {
        id: 'oversized-title',
        pattern: /\b(?:text-2xl|text-3xl|text-4xl|text-5xl|text-6xl|text-7xl|text-8xl|text-9xl)\b/,
        message: 'Page titles must use text-lg md:text-xl per design-language §2/§15. Larger sizes are forbidden.',
    },
    {
        id: 'hardcoded-grid-cols',
        pattern: /\bgrid-cols-(?:1|2|3|4|5|6|7|8|9|10|11|12)\b(?!\s*\/\/\s*OK)/,
        message: 'Hardcoded grid-cols-N. Use auto-fit: style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}.',
    },
    {
        id: 'gradient-on-text-or-icon',
        pattern: /\b(?:bg-gradient-to-(?:t|b|r|l|tr|tl|br|bl)|bg-clip-text|bg-app-gradient-)/,
        message: 'Gradients on titles or header icons are forbidden (§17). Use flat var(--app-primary) on icon, theme tokens on titles.',
    },
    {
        id: 'legacy-tokens',
        // Word boundaries on BOTH sides to avoid matching inside custom
        // class names like `theme-text-sm` (which is a different util).
        // `var(--app-text\b)` only matches the exact CSS variable, not
        // hyphenated suffixes like --app-text-foo.
        pattern: /\b(?:theme-text(?:-muted)?|theme-bg|app-text-faint|app-text-muted|app-bg-(?!color\b)\w+)\b(?!-)|var\(--app-text\b(?!-)/,
        message: 'Legacy theme token. Use --app-foreground / --app-muted-foreground / --app-surface / --app-bg.',
    },
    {
        id: 'min-h-screen-on-page',
        // Catches `min-h-screen` on the page wrapper. Allowed on full-bleed
        // overlays only. The lint flags every occurrence — operator marks
        // false positives with `// design-ok: full-bleed`.
        pattern: /\bmin-h-screen\b(?!.*\/\/\s*design-ok)/,
        message: 'min-h-screen breaks the flex sidebar layout. Use h-full + max-h-[calc(100vh-Nrem)] (§1).',
        exempt: ['src/app/login', 'src/app/(public)', 'src/app/error.tsx'],
    },
    {
        id: 'inline-style-block',
        pattern: /<style\b/,
        message: '<style> blocks bypass the design system. Use Tailwind classes + var(--app-*) tokens only.',
    },
    {
        id: 'tiny-text',
        pattern: /\btext-\[(?:[1-7])px\]/,
        message: 'Text under 8px is forbidden (§15). Minimum is 9px for badges, 11px for body, 12px for forms.',
    },
    {
        id: 'font-light',
        pattern: /\bfont-(?:thin|extralight|light)\b/,
        message: 'font-light/extralight/thin is unreadable on dark or light themes (§15). Minimum is font-medium.',
    },
]

const IGNORE_PATH_FRAGMENTS = [
    '/node_modules/',
    '/.next/',
    '/dist/',
    '/build/',
    '/__tests__/',
    '/.git/',
    '/ARCHIVE/',          // Legacy archives — out of scope.
    '/_archive/',         // POS layouts archive (lowercase variant).
    '/legacy/',           // Same.
    '/_design.tsx',       // The primitives file IS the design system.
    '/storefront/themes/', // Themed storefronts have their own design system.
    '/ui-kit/',           // UI kit deliberately demos every variant.
    '/(auth)/',           // Auth pages are full-bleed by design.
    '/(public)/',         // Public landing pages are full-bleed by design.
]

async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
        const p = join(dir, e.name)
        if (IGNORE_PATH_FRAGMENTS.some(frag => p.includes(frag))) continue
        if (e.isDirectory()) yield* walk(p)
        else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) yield p
    }
}

function ruleAppliesTo(rule, relPath) {
    if (!rule.exempt) return true
    return !rule.exempt.some(p => relPath.startsWith(p))
}

const violations = []  // { rule, file, line, snippet }
let scanned = 0

for await (const file of walk(srcDir)) {
    scanned++
    const text = await fs.readFile(file, 'utf8')
    const relPath = relative(repoRoot, file)
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('// design-ok')) continue   // explicit opt-out
        for (const rule of RULES) {
            if (!ruleAppliesTo(rule, relPath)) continue
            if (rule.pattern.test(line)) {
                violations.push({
                    rule: rule.id,
                    message: rule.message,
                    file: relPath,
                    line: i + 1,
                    snippet: line.trim().slice(0, 100),
                })
            }
        }
    }
}

// Group by rule for the summary.
const byRule = new Map()
for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, [])
    byRule.get(v.rule).push(v)
}

const C = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
}

console.log()
console.log(C.bold(`Design Language Lint`) + C.dim(`  (scanned ${scanned} files)`))
console.log(C.dim(`  Rules: ${RULES.map(r => r.id).join(', ')}`))
console.log()

if (violations.length === 0) {
    console.log(C.green('✓ Clean — no design-language violations.'))
    process.exit(0)
}

// Per-rule summary first (ordered by count desc).
const sorted = [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)
for (const [ruleId, vs] of sorted) {
    const rule = RULES.find(r => r.id === ruleId)
    console.log(`${C.red('✗')} ${C.bold(ruleId.padEnd(28))} ${C.yellow(String(vs.length).padStart(5))} violations`)
    console.log(C.dim(`   ${rule.message}`))
}

console.log()
console.log(C.bold(`Top offenders by file:`))

// Top 15 worst files.
const byFile = new Map()
for (const v of violations) {
    byFile.set(v.file, (byFile.get(v.file) || 0) + 1)
}
const worst = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
for (const [file, count] of worst) {
    console.log(`  ${C.yellow(String(count).padStart(4))}  ${file}`)
}

console.log()
console.log(C.bold(`First 25 detail rows`) + C.dim(` (run with --all for full list)`))

const showAll = process.argv.includes('--all')
const slice = showAll ? violations : violations.slice(0, 25)
for (const v of slice) {
    console.log(`  ${C.dim(v.file + ':' + v.line)}  ${C.yellow(v.rule)}`)
    console.log(`    ${C.dim(v.snippet)}`)
}
if (!showAll && violations.length > 25) {
    console.log(C.dim(`  … +${violations.length - 25} more (re-run with --all)`))
}

console.log()
console.log(C.red(`✗ ${violations.length} total violation${violations.length === 1 ? '' : 's'} across ${byFile.size} file${byFile.size === 1 ? '' : 's'}.`))
process.exit(1)
