#!/usr/bin/env node
/**
 * i18n-import — merge filled translations back into dictionaries.ts
 *
 * Usage:
 *   node .ai/scripts/i18n-import.js i18n-todo-<locale>.json [--write]
 *
 * Without --write: dry-run. Prints what would change, writes the proposed
 *                  rewritten locale block to `i18n-merge-<locale>.preview.ts`
 *                  for the engineer to inspect.
 * With --write   : applies the merge to `src/translations/dictionaries.ts`
 *                  in-place, replacing the target locale's full block.
 *
 * Behavior:
 *  - Keys with empty `translation` are skipped (locale stays falling back to en).
 *  - Existing non-empty values in the target locale are preserved unless the
 *    JSON provides a non-empty translation for that key.
 *  - Other locales' blocks are untouched — only the target locale is rewritten.
 *  - Object-literal formatting is normalized; comments inside the block are
 *    not preserved (a known trade-off; export/import is the system of record).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DICT_PATH = path.join(process.cwd(), 'src/translations/dictionaries.ts');

function extractObjectLiteralRange(text, name) {
    const startRe = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\{`);
    const m = startRe.exec(text);
    if (!m) return null;
    const open = m.index + m[0].length - 1;
    let i = open + 1, depth = 1, inStr = null, escaped = false, lineC = false, blockC = false;
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
    return { start: open, end: i, body: text.slice(open, i) };
}

// Find the range of `<locale>: { ... }` inside the dictionaries body.
function findLocaleBlockRange(dictText, locale) {
    // Locate `<locale>: {` at depth 1 inside the dictionaries object. Naive
    // search is fine because locale keys are unique top-level identifiers.
    const localeRe = new RegExp(`\\n\\s*${locale}\\s*:\\s*\\{`);
    const m = localeRe.exec(dictText);
    if (!m) return null;
    const open = m.index + m[0].length - 1; // position of `{`
    let i = open + 1, depth = 1, inStr = null, escaped = false, lineC = false, blockC = false;
    while (i < dictText.length && depth > 0) {
        const c = dictText[i], n = dictText[i + 1];
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
    return { start: open, end: i }; // body includes outer braces
}

function setDeep(obj, dottedKey, value) {
    const parts = dottedKey.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
}

const SAFE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function serialize(obj, depth = 0) {
    const pad = '    '.repeat(depth);
    const pad2 = '    '.repeat(depth + 1);
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (obj === null || obj === undefined) return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(v => serialize(v, depth + 1)).join(', ') + ']';
    }
    if (typeof obj === 'object') {
        const entries = Object.entries(obj);
        if (entries.length === 0) return '{}';
        const lines = ['{'];
        for (const [k, v] of entries) {
            const key = SAFE_KEY_RE.test(k) ? k : JSON.stringify(k);
            lines.push(`${pad2}${key}: ${serialize(v, depth + 1)},`);
        }
        lines.push(`${pad}}`);
        return lines.join('\n');
    }
    return JSON.stringify(obj);
}

// ─── Args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const fileArg = argv.find(a => !a.startsWith('--'));
const writeFlag = argv.includes('--write');

if (!fileArg) {
    console.error('Usage: node .ai/scripts/i18n-import.js <i18n-todo-LOCALE.json> [--write]');
    process.exit(1);
}
if (!fs.existsSync(fileArg)) {
    console.error(`Not found: ${fileArg}`);
    process.exit(2);
}

const filled = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
const meta = filled._meta;
if (!meta || !meta.locale) {
    console.error('Input file is missing `_meta.locale`. Was it produced by i18n-export.js?');
    process.exit(2);
}
const locale = meta.locale;

// ─── Load dictionaries.ts ────────────────────────────────────────────────
const dictText = fs.readFileSync(DICT_PATH, 'utf8');
const dictRange = extractObjectLiteralRange(dictText, 'dictionaries');
if (!dictRange) {
    console.error('Could not parse dictionaries from ' + DICT_PATH);
    process.exit(2);
}
// eslint-disable-next-line no-eval
const dicts = eval('(' + dictRange.body + ')');
if (!dicts[locale]) {
    console.error(`Locale "${locale}" does not exist in the dictionary. Add an empty {} block first.`);
    process.exit(2);
}

// ─── Apply translations ──────────────────────────────────────────────────
const localeObj = dicts[locale];
let merged = 0;
let skippedEmpty = 0;
let skippedExisting = 0;

for (const [key, payload] of Object.entries(filled)) {
    if (key === '_meta') continue;
    const translation = payload && payload.translation;
    if (!translation) { skippedEmpty++; continue; }
    // Don't overwrite a non-empty existing value silently — keep the existing
    // one and log it. Translators usually only see "missing" keys via export,
    // so this guards against re-imports that include now-translated keys.
    const parts = key.split('.');
    let cur = localeObj;
    let exists = true;
    for (let i = 0; i < parts.length && exists; i++) {
        if (cur && typeof cur === 'object' && parts[i] in cur) cur = cur[parts[i]];
        else exists = false;
    }
    if (exists && typeof cur === 'string' && cur.length > 0 && cur !== translation) {
        skippedExisting++;
        continue;
    }
    setDeep(localeObj, key, translation);
    merged++;
}

// ─── Emit the new locale block ───────────────────────────────────────────
const newBlock = serialize(localeObj, 1); // start at depth 1 (inside `dictionaries = { ... }`)

console.log('');
console.log(`i18n-import — locale: ${locale}`);
console.log(`  Merged              : ${merged}`);
console.log(`  Skipped (empty)     : ${skippedEmpty}`);
console.log(`  Skipped (already set): ${skippedExisting}`);
console.log('');

if (!writeFlag) {
    const previewPath = path.join(process.cwd(), `i18n-merge-${locale}.preview.ts`);
    const preview = `// Preview of the new "${locale}" block — review then re-run with --write to apply.\n` +
        `// Generated: ${new Date().toISOString()}\n\n` +
        `export const ${locale} = ${newBlock};\n`;
    fs.writeFileSync(previewPath, preview);
    console.log(`DRY RUN — wrote preview to ${path.relative(process.cwd(), previewPath)}`);
    console.log(`Re-run with --write to apply the merge to ${path.relative(process.cwd(), DICT_PATH)}.`);
    process.exit(0);
}

// ─── Apply: replace the locale's block inside dictionaries.ts ────────────
const localeRange = findLocaleBlockRange(dictText.slice(dictRange.start, dictRange.end), locale);
if (!localeRange) {
    console.error(`Could not locate "${locale}: { ... }" inside the dictionaries object.`);
    console.error(`Tip: ensure the locale exists as an empty block before running --write.`);
    process.exit(3);
}
// Map back to absolute offsets in the file.
const absStart = dictRange.start + localeRange.start;
const absEnd = dictRange.start + localeRange.end;
const before = dictText.slice(0, absStart);
const after = dictText.slice(absEnd);
// Re-indent the new block to fit (it's depth-1 inside dictionaries).
const replacement = newBlock;
const newText = before + replacement + after;
fs.writeFileSync(DICT_PATH, newText);
console.log(`Wrote ${path.relative(process.cwd(), DICT_PATH)}`);
console.log(`Run "tsc --noEmit" to confirm the file still type-checks.`);
