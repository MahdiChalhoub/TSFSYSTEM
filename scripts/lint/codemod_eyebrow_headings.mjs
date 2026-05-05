#!/usr/bin/env node
/**
 * Eyebrow-heading Codemod
 * ========================
 * Converts <h4>/<h5>/<h6> tags being misused as "eyebrow labels"
 * into <div> tags. Eyebrow = uppercase + wide tracking + small size,
 * which is a LABEL pattern, not a heading.
 *
 * Why this matters:
 *   - Headings have semantic meaning (h1 = page title, h2 = section).
 *   - An <h4 class="text-[10px] uppercase">SECTION LABEL</h4> is a
 *     screen-reader confusion + audit failure.
 *   - Real fix is to change the tag.
 *
 * Detection: <h4|h5|h6> with className containing BOTH `uppercase`
 * AND any tracking-w(ide|ider|idest) variant. Tag swapped to <div>;
 * className kept intact.
 *
 * Also strips text-[1..7px] anywhere — under 8px is a hard floor.
 */
import { promises as fs } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const srcDir = join(repoRoot, 'src')
const dryRun = process.argv.includes('--dry')

const IGNORE = ['/node_modules/', '/.next/', '/dist/', '/.git/', '/_archive/', '/ARCHIVE/', '/legacy/']
async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
        const p = join(dir, e.name)
        if (IGNORE.some(f => p.includes(f))) continue
        if (e.isDirectory()) yield* walk(p)
        else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) yield p
    }
}

// Match <h4|h5|h6 className="...uppercase...tracking-w..."> — both
// classes must be present (eyebrow signal). Captures the className
// content for re-emission.
const EYEBROW_OPEN = /<(h[456])(\s+[^>]*?)className=(?:"([^"]*)"|'([^']*)')([^>]*?)>/g
// And the matching close tag — naive but correct for these short blocks.
function isEyebrowClass(cls) {
    return /\buppercase\b/.test(cls) && /\btracking-w(ide|ider|idest)\b/.test(cls)
}

const TINY_TEXT = /\btext-\[[1-7]px\]\s*/g

let scanned = 0, swapped = 0, tinyStripped = 0
const filesTouched = new Set()

for await (const file of walk(srcDir)) {
    scanned++
    let text = await fs.readFile(file, 'utf8')
    let changed = false

    // Track h4/h5/h6 opens we converted so we can fix the matching close.
    const openTagSwaps = []  // [{ tag, openIndex, closeFinderRegex }]

    text = text.replace(EYEBROW_OPEN, (full, tag, beforeAttrs, dQ, sQ, afterAttrs) => {
        const cls = dQ ?? sQ
        if (!isEyebrowClass(cls)) return full
        // Replace tag with div, keep everything else.
        const quote = dQ !== undefined ? '"' : "'"
        openTagSwaps.push(tag)
        swapped++
        changed = true
        return `<div${beforeAttrs}className=${quote}${cls}${quote}${afterAttrs}>`
    })

    // For each open swap, find the matching close tag and rewrite to </div>.
    // We do them one at a time, in order, to handle multiple eyebrow
    // headings in the same file.
    for (const tag of openTagSwaps) {
        const closeRe = new RegExp(`</${tag}>`)
        text = text.replace(closeRe, '</div>')
    }

    // Strip 1-7px text anywhere.
    if (TINY_TEXT.test(text)) {
        const matches = text.match(TINY_TEXT)
        if (matches) tinyStripped += matches.length
        text = text.replace(TINY_TEXT, '')
        text = text.replace(/className=(["'])\s+/g, 'className=$1')
        changed = true
    }

    if (changed) {
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
console.log(C.bold('Eyebrow-heading Codemod') + (dryRun ? C.yellow('  [DRY RUN]') : C.green('  [WRITTEN]')))
console.log(C.dim(`  Scanned ${scanned} files. Touched ${filesTouched.size}.`))
console.log(`  ${C.yellow(String(swapped).padStart(4))}  <h4|h5|h6 uppercase tracking-w*> → <div>`)
console.log(`  ${C.yellow(String(tinyStripped).padStart(4))}  text-[1-7px] removed (under 8px floor)`)
