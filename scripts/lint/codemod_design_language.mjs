#!/usr/bin/env node
/**
 * Design Language Codemod
 * ========================
 * Applies the SAFE mechanical replacements across the codebase.
 * Run as `node scripts/lint/codemod_design_language.mjs` (writes
 * changes in place) or `--dry` for a no-op preview.
 *
 * Only handles replacements that are 100% safe to apply mechanically:
 *
 *   1. Legacy theme tokens → canonical tokens
 *      var(--app-text-muted)     → var(--app-muted-foreground)
 *      var(--app-text-faint)     → var(--app-muted-foreground)
 *      var(--app-text)           → var(--app-foreground)            (word-boundary)
 *      theme-text-muted          → text-app-muted-foreground         (Tailwind class)
 *      theme-text                → text-app-foreground
 *      theme-bg                  → bg-app-bg
 *      app-text-faint            → app-muted-foreground               (var() inside style)
 *
 *   2. Drop gradient classes from titles + header icons
 *      bg-app-gradient-primary   → bg-app-primary
 *      bg-app-gradient-info      → bg-app-info
 *      bg-app-gradient-success   → bg-app-success
 *      bg-app-gradient-warning   → bg-app-warning
 *      bg-app-gradient-error     → bg-app-error
 *      bg-app-gradient-accent    → bg-app-primary
 *
 * What this codemod DOES NOT touch (needs human judgment):
 *   - Raw Tailwind palette colors (bg-blue-500 etc.) — picking the
 *     right `var(--app-*)` token depends on the surrounding intent.
 *   - Hardcoded grid-cols-N — picking minmax() width requires
 *     looking at content density per page.
 *   - Oversized titles (text-3xl/4xl) — could be page header (must
 *     reduce to text-lg md:text-xl) or a stat value (different fix).
 *   - `min-h-screen` — context-dependent.
 *
 * Run order:
 *   1. `node scripts/lint/codemod_design_language.mjs --dry`     ← preview
 *   2. `node scripts/lint/codemod_design_language.mjs`            ← apply
 *   3. `npm run lint:design`                                      ← verify count drop
 *   4. `git diff --stat`                                          ← review scope
 */
import { promises as fs } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcDir = join(repoRoot, 'src')
const dryRun = process.argv.includes('--dry')

// Each rule: pattern (RegExp with /g flag), replacement string, label.
// Apply order matters when one rule's output could match another's input —
// here legacy tokens are independent of gradient-drop, so order is free.
const RULES = [
    // 1) Legacy CSS-variable tokens (inside style="..." or template literals)
    {
        pattern: /--app-text-muted\b/g,
        replace: '--app-muted-foreground',
        label: 'var token: --app-text-muted → --app-muted-foreground',
    },
    {
        pattern: /--app-text-faint\b/g,
        replace: '--app-muted-foreground',
        label: 'var token: --app-text-faint → --app-muted-foreground',
    },
    {
        // Word-boundary so we don't catch --app-text-muted/faint AGAIN.
        // The negative lookahead excludes -muted, -faint, and any other
        // hyphenated suffix.
        pattern: /--app-text\b(?!-)/g,
        replace: '--app-foreground',
        label: 'var token: --app-text → --app-foreground',
    },
    // 2) Legacy Tailwind classes
    {
        pattern: /\btheme-text-muted\b/g,
        replace: 'text-app-muted-foreground',
        label: 'class: theme-text-muted → text-app-muted-foreground',
    },
    {
        pattern: /\btheme-text\b(?!-)/g,
        replace: 'text-app-foreground',
        label: 'class: theme-text → text-app-foreground',
    },
    {
        pattern: /\btheme-bg\b(?!-)/g,
        replace: 'bg-app-bg',
        label: 'class: theme-bg → bg-app-bg',
    },
    {
        pattern: /\bapp-text-faint\b/g,
        replace: 'app-muted-foreground',
        label: 'class: app-text-faint → app-muted-foreground',
    },
    // Tailwind utilities built from the OLD token names. Once the CSS
    // variable rename happened (--app-text-muted → --app-muted-foreground),
    // every `text-app-text-muted` / `bg-app-text-muted` / `border-app-text-muted`
    // class points at a deleted variable. Rename them to match.
    {
        pattern: /\b(text|bg|border|ring|fill|stroke|outline|placeholder|caret|accent|decoration|divide|from|to|via)-app-text-muted\b/g,
        replace: '$1-app-muted-foreground',
        label: 'tw util: -app-text-muted → -app-muted-foreground',
    },
    {
        pattern: /\b(text|bg|border|ring|fill|stroke|outline|placeholder|caret|accent|decoration|divide|from|to|via)-app-text-faint\b/g,
        replace: '$1-app-muted-foreground',
        label: 'tw util: -app-text-faint → -app-muted-foreground',
    },
    {
        // Negative lookahead protects -muted/-faint that were renamed above.
        pattern: /\b(text|bg|border|ring|fill|stroke|outline|placeholder|caret|accent|decoration|divide|from|to|via)-app-text\b(?!-)/g,
        replace: '$1-app-foreground',
        label: 'tw util: -app-text → -app-foreground',
    },
    // 3) Drop gradient utility classes — flat fills with the matching token.
    //    These are the bg-app-gradient-* helpers used for icons/headers,
    //    which design-language §17 forbids.
    {
        pattern: /\bbg-app-gradient-primary\b/g,
        replace: 'bg-app-primary',
        label: 'gradient: bg-app-gradient-primary → bg-app-primary',
    },
    {
        pattern: /\bbg-app-gradient-info\b/g,
        replace: 'bg-app-info',
        label: 'gradient: bg-app-gradient-info → bg-app-info',
    },
    {
        pattern: /\bbg-app-gradient-success\b/g,
        replace: 'bg-app-success',
        label: 'gradient: bg-app-gradient-success → bg-app-success',
    },
    {
        pattern: /\bbg-app-gradient-warning\b/g,
        replace: 'bg-app-warning',
        label: 'gradient: bg-app-gradient-warning → bg-app-warning',
    },
    {
        pattern: /\bbg-app-gradient-error\b/g,
        replace: 'bg-app-error',
        label: 'gradient: bg-app-gradient-error → bg-app-error',
    },
    {
        pattern: /\bbg-app-gradient-accent\b/g,
        replace: 'bg-app-primary',
        label: 'gradient: bg-app-gradient-accent → bg-app-primary',
    },
]

const IGNORE_PATH_FRAGMENTS = [
    '/node_modules/',
    '/.next/',
    '/dist/',
    '/build/',
    '/.git/',
    '/_archive/',
    '/ARCHIVE/',
    '/legacy/',
]

async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
        const p = join(dir, e.name)
        if (IGNORE_PATH_FRAGMENTS.some(frag => p.includes(frag))) continue
        if (e.isDirectory()) yield* walk(p)
        else if (
            e.name.endsWith('.tsx') ||
            e.name.endsWith('.ts')  ||
            e.name.endsWith('.css') ||
            e.name.endsWith('.scss')
        ) yield p
    }
}

const counts = new Map()  // rule.label → number of replacements
const filesTouched = new Set()
let scanned = 0

for await (const file of walk(srcDir)) {
    scanned++
    let text = await fs.readFile(file, 'utf8')
    let changedThisFile = false

    for (const rule of RULES) {
        // Match-count first so we know what changed (replace() doesn't
        // tell us how many it replaced).
        const matches = text.match(rule.pattern)
        if (matches) {
            counts.set(rule.label, (counts.get(rule.label) || 0) + matches.length)
            text = text.replace(rule.pattern, rule.replace)
            changedThisFile = true
        }
    }

    if (changedThisFile) {
        filesTouched.add(file)
        if (!dryRun) await fs.writeFile(file, text, 'utf8')
    }
}

const C = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim:  (s) => `\x1b[2m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    green:  (s) => `\x1b[32m${s}\x1b[0m`,
}

console.log()
console.log(C.bold(`Design Language Codemod`) + (dryRun ? C.yellow('  [DRY RUN]') : C.green('  [WRITTEN]')))
console.log(C.dim(`  Scanned ${scanned} files. Changed ${filesTouched.size} files.`))
console.log()

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
let total = 0
for (const [label, n] of sorted) {
    console.log(`  ${C.yellow(String(n).padStart(5))}  ${label}`)
    total += n
}

console.log()
console.log(C.bold(`Total replacements:`) + ` ${C.green(String(total))}`)
if (dryRun) {
    console.log(C.dim(`Re-run without --dry to apply.`))
}
