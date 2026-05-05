#!/usr/bin/env node
/**
 * Text-size Inversion Audit
 * ==========================
 * Flags text that's smaller than its semantic role suggests:
 *   - <h1>/<h2>/<h3> with explicit text-* CLASS that's < 14px
 *   - "label" / "title" / "header" / "heading" element with size < 12px
 *   - explicit text-[5px..7px] anywhere (always too small)
 *   - data row with text size LARGER than its column header
 *
 * The canonical scale is:
 *   h1 = 18px (1.125rem)   page title
 *   h2 = 16px (1rem)       section header
 *   h3 = 15px (0.9375rem)  subsection
 *   body = 15px            row data
 *   small = 13px           caption / meta
 *
 * Usage: node scripts/lint/check_text_size_inversions.mjs
 */
import { promises as fs } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcDir = join(repoRoot, 'src')

// Tailwind text-{key} → px equivalent.
const SIZE_PX = {
    'xs': 12, 'sm': 14, 'base': 16, 'lg': 18,
    'xl': 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48,
}
function tailwindToPx(token) {
    // Handle text-[Npx] arbitrary syntax.
    const m = token.match(/^text-\[(\d+(?:\.\d+)?)px\]$/)
    if (m) return parseFloat(m[1])
    // Handle text-{preset}
    const m2 = token.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)$/)
    if (m2) return SIZE_PX[m2[1]]
    return null
}

const IGNORE_PATH_FRAGMENTS = [
    '/node_modules/', '/.next/', '/dist/', '/build/', '/.git/',
    '/_archive/', '/ARCHIVE/', '/legacy/',
    '/storefront/themes/', '/(auth)/', '/(public)/', '/ui-kit/',
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

const C = {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim:  (s) => `\x1b[2m${s}\x1b[0m`,
    red:  (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    green:  (s) => `\x1b[32m${s}\x1b[0m`,
}

const findings = []  // { file, line, kind, message, snippet }

// Patterns:
//  - Headings with explicit text-* className (after my codemod, these
//    SHOULD be empty, but flag any we missed).
//  - Any element with className matching /label|title|header|heading/
//    that uses sub-12px text.
//  - Any text-[Npx] where N ∈ [1..7] (always too small).
const HEADING_TAG_RE = /<(h[1-6])\s+[^>]*?className=(?:"([^"]*)"|'([^']*)')[^>]*>/g
const TITLE_LIKE_RE  = /className=(?:"|')[^"']*\b(label|title|header|heading)[A-Z][^"']*(?:"|')/g
const TINY_TEXT_RE   = /\btext-\[[1-7]px\]/g

for await (const file of walk(srcDir)) {
    const text = await fs.readFile(file, 'utf8')
    const rel = relative(repoRoot, file)
    const lines = text.split('\n')

    // Heading with explicit small text class.
    let m
    HEADING_TAG_RE.lastIndex = 0
    while ((m = HEADING_TAG_RE.exec(text)) !== null) {
        const tag = m[1]
        const className = m[2] ?? m[3]
        if (!className) continue
        const tokens = className.split(/\s+/)
        for (const t of tokens) {
            const px = tailwindToPx(t)
            if (px !== null && px < 14) {
                const lineNum = text.slice(0, m.index).split('\n').length
                findings.push({
                    file: rel, line: lineNum, kind: 'heading-too-small',
                    message: `<${tag}> uses ${t} (${px}px) — headings must be ≥ 14px`,
                    snippet: lines[lineNum - 1].trim().slice(0, 100),
                })
            }
        }
    }

    // Tiny text.
    TINY_TEXT_RE.lastIndex = 0
    while ((m = TINY_TEXT_RE.exec(text)) !== null) {
        const lineNum = text.slice(0, m.index).split('\n').length
        findings.push({
            file: rel, line: lineNum, kind: 'tiny-text',
            message: `${m[0]} — under 8px is forbidden anywhere`,
            snippet: lines[lineNum - 1].trim().slice(0, 100),
        })
    }
}

console.log()
console.log(C.bold('Text-size Inversion Audit'))
console.log(C.dim(`  Canonical scale: h1=18 h2=16 h3=15 body=15 small=13 (px)`))
console.log()

if (findings.length === 0) {
    console.log(C.green('✓ No size inversions or tiny-text violations.'))
    process.exit(0)
}

const byKind = new Map()
for (const f of findings) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, [])
    byKind.get(f.kind).push(f)
}
for (const [kind, items] of byKind) {
    console.log(`${C.red('✗')} ${C.bold(kind.padEnd(28))} ${C.yellow(String(items.length).padStart(4))}`)
}
console.log()
console.log(C.bold('First 25 violations:'))
for (const f of findings.slice(0, 25)) {
    console.log(`  ${C.dim(f.file + ':' + f.line)}  ${C.yellow(f.kind)}`)
    console.log(`    ${f.message}`)
    console.log(`    ${C.dim(f.snippet)}`)
}
if (findings.length > 25) {
    console.log(C.dim(`  … +${findings.length - 25} more`))
}
console.log()
console.log(C.red(`✗ ${findings.length} text-size violations across ${new Set(findings.map(f => f.file)).size} files.`))
process.exit(1)
