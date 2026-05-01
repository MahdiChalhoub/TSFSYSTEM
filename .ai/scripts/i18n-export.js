#!/usr/bin/env node
/**
 * i18n-export — generate a translator-ready JSON of missing keys for a locale
 *
 * Usage:
 *   node .ai/scripts/i18n-export.js <locale>      # writes i18n-todo-<locale>.json
 *
 * Reads `src/translations/dictionaries.ts`, flattens the `en` dictionary and
 * the target locale's dictionary into dot-notation keys, and emits a JSON
 * file containing only keys present in `en` but missing from the target.
 *
 * The output format is friendly to non-technical translators:
 *   {
 *     "_meta": { ... stats + instructions ... },
 *     "finance.coa.title": { "en": "Chart of Accounts", "translation": "" },
 *     ...
 *   }
 *
 * Translators fill the `translation` field. Run `i18n-import.js` to merge.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DICT_PATH = path.join(process.cwd(), 'src/translations/dictionaries.ts');

// ─── Extract a top-level `export const NAME = {...}` object literal ──────
function extractObjectLiteral(text, name) {
    const startRe = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\{`);
    const m = startRe.exec(text);
    if (!m) return null;
    const open = m.index + m[0].length - 1; // position of `{`
    let i = open + 1;
    let depth = 1;
    let inStr = null;
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;
    while (i < text.length && depth > 0) {
        const c = text[i], n = text[i + 1];
        if (inLineComment) { if (c === '\n') inLineComment = false; i++; continue; }
        if (inBlockComment) { if (c === '*' && n === '/') { inBlockComment = false; i += 2; continue; } i++; continue; }
        if (escaped) { escaped = false; i++; continue; }
        if (inStr) {
            if (c === '\\') escaped = true;
            else if (c === inStr) inStr = null;
            i++; continue;
        }
        if (c === '/' && n === '/') { inLineComment = true; i += 2; continue; }
        if (c === '/' && n === '*') { inBlockComment = true; i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
    }
    return text.slice(open, i);
}

function loadDictionaries() {
    if (!fs.existsSync(DICT_PATH)) {
        console.error(`Not found: ${DICT_PATH}`);
        process.exit(2);
    }
    const text = fs.readFileSync(DICT_PATH, 'utf8');
    const literal = extractObjectLiteral(text, 'dictionaries');
    if (!literal) {
        console.error('Could not locate `export const dictionaries` in the file.');
        process.exit(2);
    }
    // eslint-disable-next-line no-eval
    return eval('(' + literal + ')');
}

function flatten(obj, prefix = '', out = {}) {
    if (!obj || typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') out[key] = v;
        else if (v && typeof v === 'object') flatten(v, key, out);
    }
    return out;
}

// ─── Main ────────────────────────────────────────────────────────────────
const target = process.argv[2];
if (!target) {
    console.error('Usage: node .ai/scripts/i18n-export.js <locale>');
    process.exit(1);
}

const dicts = loadDictionaries();
if (!dicts[target]) {
    console.error(`Unknown locale: "${target}".`);
    console.error(`Available locales: ${Object.keys(dicts).join(', ')}`);
    process.exit(1);
}

const enFlat = flatten(dicts.en);
const tgtFlat = flatten(dicts[target]);

const missing = {};
for (const [key, en] of Object.entries(enFlat)) {
    if (!(key in tgtFlat) || !tgtFlat[key]) {
        missing[key] = { en, translation: '' };
    }
}

const output = {
    _meta: {
        locale: target,
        generated_at: new Date().toISOString(),
        source_locale: 'en',
        source_keys_total: Object.keys(enFlat).length,
        target_keys_translated: Object.keys(tgtFlat).length,
        missing_keys: Object.keys(missing).length,
        coverage_percent: ((Object.keys(tgtFlat).length / Object.keys(enFlat).length) * 100).toFixed(1),
        instructions: [
            'Fill the `translation` field for each key below.',
            'Use the `en` value as the source of truth.',
            'Preserve placeholders like {count}, {name}, {period} — they will be replaced at runtime.',
            'Leave `translation` blank to keep falling back to English.',
            'When done, run: node .ai/scripts/i18n-import.js <this-file>',
        ],
    },
    ...missing,
};

const outFile = path.join(process.cwd(), `i18n-todo-${target}.json`);
fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
console.log(`  Source (en) keys      : ${Object.keys(enFlat).length}`);
console.log(`  Target (${target}) translated : ${Object.keys(tgtFlat).length}`);
console.log(`  Missing               : ${Object.keys(missing).length}`);
console.log(`  Coverage              : ${output._meta.coverage_percent}%`);
