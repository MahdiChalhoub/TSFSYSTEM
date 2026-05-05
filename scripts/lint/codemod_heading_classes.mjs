#!/usr/bin/env node
/**
 * Heading-class Codemod
 * =====================
 * Strips Tailwind text-/font-/tracking- overrides from <h1>/<h2>/<h3>
 * elements so they fall back to the canonical typography scale defined
 * in globals.css + app-theme-engine.css.
 *
 * Why: 149 pages were rolling their own size + weight on h1, bypassing
 * the system. We just anchored the canonical scale (h1 = 18px / 700,
 * h2 = 16px, h3 = 15px). Stripping the class overrides lets the bare
 * <h1> render exactly the canonical style.
 *
 * What gets stripped from <h1>/<h2>/<h3> className:
 *   - text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl}        and md: variants
 *   - text-[Npx]                                          and md: variants
 *   - font-{normal,medium,semibold,bold,extrabold,black}  and md: variants
 *   - tracking-{tighter,tight,normal,wide,wider,widest}   and md: variants
 *   - leading-{none,tight,snug,normal,relaxed,loose}      and md: variants
 *   - text-app-foreground (the canonical h1 already has color)
 *
 * What gets KEPT (intentionally):
 *   - Layout classes (truncate, flex, items-, gap-, w-, etc)
 *   - Color classes other than text-app-foreground (page-specific accents)
 *   - hover: / focus: variants
 *   - inline italic / underline (semantic emphasis)
 *
 * Run as `node scripts/lint/codemod_heading_classes.mjs --dry` first.
 */
import { promises as fs } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcDir = join(repoRoot, 'src')
const dryRun = process.argv.includes('--dry')

// Tokens we want to strip from h1/h2/h3 className strings. Each pattern
// is anchored to "word boundaries" inside the className value so we
// don't accidentally chew into utility classes that happen to contain
// these substrings (e.g. `text-app-info` is preserved, only
// `text-app-foreground` is stripped).
const STRIP_TOKENS = [
    // Tailwind preset sizes (with optional responsive prefix).
    /\b(?:sm|md|lg|xl|2xl):text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
    /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
    // Arbitrary px sizes — `text-[18px]` etc.
    /\b(?:sm|md|lg|xl|2xl):text-\[\d+(?:\.\d+)?px\]/g,
    /\btext-\[\d+(?:\.\d+)?px\]/g,
    // Font weights.
    /\b(?:sm|md|lg|xl|2xl):font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
    /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
    // Tracking + leading.
    /\b(?:sm|md|lg|xl|2xl):tracking-(?:tighter|tight|normal|wide|wider|widest)\b/g,
    /\btracking-(?:tighter|tight|normal|wide|wider|widest)\b/g,
    /\b(?:sm|md|lg|xl|2xl):leading-(?:none|tight|snug|normal|relaxed|loose)\b/g,
    /\bleading-(?:none|tight|snug|normal|relaxed|loose)\b/g,
    // Foreground color — the canonical h1 already sets this.
    /\btext-app-foreground\b/g,
]

const IGNORE_PATH_FRAGMENTS = [
    '/node_modules/', '/.next/', '/dist/', '/build/', '/.git/',
    '/_archive/', '/ARCHIVE/', '/legacy/',
    '/storefront/themes/',          // own typography
    '/(auth)/', '/(public)/',       // full-bleed auth
    '/ui-kit/',                     // demos every variant
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

// Match opening tags <h1 ...>, <h2 ...>, <h3 ...> and capture the
// className attribute value. We process className="..." only — the
// rare {clsx(...)} / template literal forms get skipped (manual edit
// territory). The regex is conservative on purpose.
const HEADING_TAG = /<(h[123])(\s+[^>]*?)className=(?:"([^"]*)"|'([^']*)')([^>]*?)>/g

function stripFrom(className) {
    let out = className
    for (const pat of STRIP_TOKENS) {
        out = out.replace(pat, '')
    }
    // Collapse double spaces left behind by the strips.
    out = out.replace(/\s+/g, ' ').trim()
    return out
}

let scanned = 0
let strippedTokens = 0
const filesTouched = new Set()

for await (const file of walk(srcDir)) {
    scanned++
    const text = await fs.readFile(file, 'utf8')
    let updated = text
    let fileTouched = false

    updated = updated.replace(HEADING_TAG, (full, tag, beforeAttrs, dquoted, squoted, afterAttrs) => {
        const original = dquoted ?? squoted
        const cleaned = stripFrom(original)
        if (cleaned === original) return full

        // Count tokens removed for the report.
        for (const pat of STRIP_TOKENS) {
            const matches = original.match(pat)
            if (matches) strippedTokens += matches.length
        }

        fileTouched = true
        // If className is now empty, drop the attribute entirely.
        if (!cleaned) {
            return `<${tag}${beforeAttrs}${afterAttrs}>`.replace(/\s+/g, ' ').replace(/\s+>$/, '>')
        }
        // Preserve the original quote style.
        const quote = dquoted !== undefined ? '"' : "'"
        return `<${tag}${beforeAttrs}className=${quote}${cleaned}${quote}${afterAttrs}>`
    })

    if (fileTouched) {
        filesTouched.add(file)
        if (!dryRun) await fs.writeFile(file, updated, 'utf8')
    }
}

const C = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim:  (s) => `\x1b[2m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    green:  (s) => `\x1b[32m${s}\x1b[0m`,
}

console.log()
console.log(C.bold('Heading-class Codemod') + (dryRun ? C.yellow('  [DRY RUN]') : C.green('  [WRITTEN]')))
console.log(C.dim(`  Scanned ${scanned} files.`))
console.log(C.dim(`  Touched ${filesTouched.size} files.`))
console.log(C.dim(`  Stripped ${strippedTokens} tokens from <h1>/<h2>/<h3> classes.`))
console.log()
if (dryRun) console.log(C.dim('Re-run without --dry to apply.'))
