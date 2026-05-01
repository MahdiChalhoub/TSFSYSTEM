#!/usr/bin/env node
/**
 * i18n-add-locale — provision a new locale end-to-end in one command
 *
 * Usage:
 *   node .ai/scripts/i18n-add-locale.js <code> [--name "Native"] [--flag 🇽🇽] [--rtl]
 *
 * Examples:
 *   node .ai/scripts/i18n-add-locale.js de --name "Deutsch" --flag 🇩🇪
 *   node .ai/scripts/i18n-add-locale.js zh --name "中文"     --flag 🇨🇳
 *   node .ai/scripts/i18n-add-locale.js he --name "עברית"  --flag 🇮🇱 --rtl
 *
 * What it does (atomically, in-file):
 *   1. Validates the locale code (ISO-639-style: 2–3 letters, optional -REGION)
 *   2. Adds an empty `<code>: {}` block to the `dictionaries` const
 *   3. Appends an entry to the `LOCALES` catalogue
 *   4. Adds the code to `RTL_LOCALES` if --rtl was given
 *
 * After running:
 *   • `tsc --noEmit`           — should still pass (empty block is valid)
 *   • `LanguageSwitcher`       — picks up the new flag automatically
 *   • `i18n-status.js`         — shows the new locale at 0% coverage
 *   • `i18n-export.js <code>`  — produces the full translator package
 *
 * Skips: editing if the locale already exists. No-op + clear message.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DICT_PATH = path.join(process.cwd(), 'src/translations/dictionaries.ts');

// ─── Args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const positionals = argv.filter(a => !a.startsWith('--'));
const code = positionals[0];

function flag(name) {
    const idx = argv.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    const next = argv[idx + 1];
    if (!next || next.startsWith('--')) return true; // boolean
    return next;
}

if (!code) {
    console.error('Usage: node .ai/scripts/i18n-add-locale.js <code> [--name "Native"] [--flag 🇽🇽] [--rtl]');
    process.exit(1);
}
if (!/^[a-z]{2,3}(-[A-Z][A-Za-z]+)?$/.test(code)) {
    console.error(`Invalid locale code: "${code}". Use ISO-639 (e.g. de, zh, fr-CA, zh-Hant).`);
    process.exit(1);
}

const name = flag('name') || code;
const flagEmoji = flag('flag') || '🌐';
const isRtl = flag('rtl') === true;

// ─── Read & sanity-check ────────────────────────────────────────────────
if (!fs.existsSync(DICT_PATH)) {
    console.error(`Not found: ${DICT_PATH}`);
    process.exit(2);
}
let text = fs.readFileSync(DICT_PATH, 'utf8');

// Refuse if locale already exists.
const existsRe = new RegExp(`(^|[\\s\\{,])${code}\\s*:\\s*\\{`, 'm');
if (existsRe.test(text)) {
    console.error(`Locale "${code}" already exists in ${path.relative(process.cwd(), DICT_PATH)}. Aborting.`);
    process.exit(0);
}

// ─── Step 1: append `<code>: {}` before the closing `}` of `dictionaries = { ... };` ──
function findDictClose(text) {
    const re = /export\s+const\s+dictionaries\s*=\s*\{/;
    const m = re.exec(text);
    if (!m) return -1;
    let i = m.index + m[0].length;
    let depth = 1, inStr = null, escaped = false, lineC = false, blockC = false;
    while (i < text.length && depth > 0) {
        const c = text[i], n = text[i + 1];
        if (lineC) { if (c === '\n') lineC = false; i++; continue; }
        if (blockC) { if (c === '*' && n === '/') { blockC = false; i += 2; continue; } i++; continue; }
        if (escaped) { escaped = false; i++; continue; }
        if (inStr) {
            if (c === '\\') escaped = true;
            else if (c === inStr) inStr = null;
            i++; continue;
        }
        if (c === '/' && n === '/') { lineC = true; i += 2; continue; }
        if (c === '/' && n === '*') { blockC = true; i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
    }
    return depth === 0 ? i - 1 : -1; // index of matching `}`
}

const closeIdx = findDictClose(text);
if (closeIdx < 0) {
    console.error('Could not locate the closing `}` of `dictionaries = { ... }`.');
    process.exit(2);
}

// Walk back to find the last non-whitespace character; ensure it ends with `,`
// before our insertion. If it ends with `}` (last locale's close), we need a
// trailing comma after it.
let backIdx = closeIdx - 1;
while (backIdx > 0 && /\s/.test(text[backIdx])) backIdx--;
const lastChar = text[backIdx];
const needsComma = lastChar !== ',' && lastChar !== '{';

const insertion =
    (needsComma ? ',' : '') +
    `\n    // ════ ${code.toUpperCase()} — added ${new Date().toISOString().slice(0, 10)} (empty; falls back to English) ════\n` +
    `    ${code}: {},\n`;

text = text.slice(0, closeIdx) + insertion + text.slice(closeIdx);

// ─── Step 2: add to LOCALES catalogue ────────────────────────────────────
// Find `export const LOCALES = [` and the matching `]`, then append before `]`.
function findArrayClose(text, name) {
    const re = new RegExp(`export\\s+const\\s+${name}\\s*:[^=]*=\\s*\\[`);
    let m = re.exec(text);
    if (!m) {
        // Tolerate untyped declaration too: `export const NAME = [`
        const re2 = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[`);
        m = re2.exec(text);
        if (!m) return null;
    }
    let i = m.index + m[0].length;
    let depth = 1, inStr = null, escaped = false;
    while (i < text.length && depth > 0) {
        const c = text[i];
        if (escaped) { escaped = false; i++; continue; }
        if (inStr) {
            if (c === '\\') escaped = true;
            else if (c === inStr) inStr = null;
            i++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
        if (c === '[') depth++;
        else if (c === ']') depth--;
        i++;
    }
    return depth === 0 ? { open: m.index + m[0].length - 1, close: i - 1 } : null;
}

const localesRange = findArrayClose(text, 'LOCALES');
if (!localesRange) {
    console.warn('Warning: could not find LOCALES array — added locale to dictionaries but not to switcher catalogue.');
} else {
    // Insert just before the `]`. Walk back to ensure trailing comma sanity.
    let bIdx = localesRange.close - 1;
    while (bIdx > 0 && /\s/.test(text[bIdx])) bIdx--;
    const lastArrChar = text[bIdx];
    const arrNeedsComma = lastArrChar !== ',' && lastArrChar !== '[';
    const dirVal = isRtl ? 'rtl' : 'ltr';
    const entry =
        (arrNeedsComma ? ',' : '') +
        `\n    { id: ${JSON.stringify(code)}, name: ${JSON.stringify(name)}, flag: ${JSON.stringify(flagEmoji)}, dir: ${JSON.stringify(dirVal)} },\n`;
    text = text.slice(0, localesRange.close) + entry + text.slice(localesRange.close);
}

// ─── Step 3: add to RTL_LOCALES if --rtl ────────────────────────────────
if (isRtl) {
    const rtlRange = findArrayClose(text, 'RTL_LOCALES');
    if (!rtlRange) {
        console.warn('Warning: could not find RTL_LOCALES array — locale added but RTL flag not set.');
    } else {
        const inner = text.slice(rtlRange.open + 1, rtlRange.close).trim();
        const isEmpty = inner.length === 0 || /^,?\s*$/.test(inner);
        const arrEntry = (isEmpty ? '' : ', ') + JSON.stringify(code);
        text = text.slice(0, rtlRange.close) + arrEntry + text.slice(rtlRange.close);
    }
}

// ─── Write ───────────────────────────────────────────────────────────────
fs.writeFileSync(DICT_PATH, text);

console.log(`✓ Added locale "${code}" (${name}) ${flagEmoji}${isRtl ? '  (RTL)' : ''}`);
console.log(`  in ${path.relative(process.cwd(), DICT_PATH)}`);
console.log('');
console.log('Next steps:');
console.log(`  ./node_modules/.bin/tsc --noEmit                       # verify`);
console.log(`  node .ai/scripts/i18n-export.js ${code}                       # generate translator package`);
console.log(`  # … translator fills i18n-todo-${code}.json …`);
console.log(`  node .ai/scripts/i18n-import.js i18n-todo-${code}.json --write   # apply`);
