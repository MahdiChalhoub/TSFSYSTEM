#!/usr/bin/env node
/**
 * i18n-status — coverage report across all locales
 *
 * Usage:
 *   node .ai/scripts/i18n-status.js
 *
 * Prints a per-locale table of: total source keys / translated / missing /
 * coverage %, plus a per-namespace breakdown for the most common gaps.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DICT_PATH = path.join(process.cwd(), 'src/translations/dictionaries.ts');

// (Same extractor as i18n-export.js — duplicated to keep scripts standalone.)
function extractObjectLiteral(text, name) {
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
    return text.slice(open, i);
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

const text = fs.readFileSync(DICT_PATH, 'utf8');
const literal = extractObjectLiteral(text, 'dictionaries');
// eslint-disable-next-line no-eval
const dicts = eval('(' + literal + ')');

const en = flatten(dicts.en);
const enKeys = Object.keys(en);
const enTotal = enKeys.length;

// ─── Top-line table ──────────────────────────────────────────────────────
const isTTY = process.stdout.isTTY;
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = s => c('1', s);
const green = s => c('32', s);
const yellow = s => c('33', s);
const red = s => c('31', s);
const dim = s => c('2', s);

console.log('');
console.log(bold('i18n coverage report'));
console.log(dim(`source: ${path.relative(process.cwd(), DICT_PATH)}`));
console.log(dim(`generated: ${new Date().toISOString()}`));
console.log('');

console.log(bold('Per-locale coverage'));
console.log('─'.repeat(64));
console.log(`  ${'Locale'.padEnd(8)} ${'Translated'.padStart(10)} ${'Missing'.padStart(10)} ${'Coverage'.padStart(10)}`);
console.log('─'.repeat(64));

const locales = Object.keys(dicts);
const stats = {};
for (const loc of locales) {
    const flat = flatten(dicts[loc]);
    const translated = enKeys.filter(k => flat[k] && flat[k].length > 0).length;
    const missing = enTotal - translated;
    const coverage = (translated / enTotal) * 100;
    stats[loc] = { translated, missing, coverage, flat };

    const covStr = `${coverage.toFixed(1)}%`.padStart(10);
    const colored = coverage >= 95 ? green(covStr) : coverage >= 50 ? yellow(covStr) : red(covStr);
    const isSrc = loc === 'en' ? dim(' (src)') : '';
    console.log(
        `  ${loc.padEnd(8)}${isSrc} ${String(translated).padStart(10)} ${String(missing).padStart(10)} ${colored}`
    );
}
console.log('─'.repeat(64));
console.log(`  ${dim('Total source keys:')} ${bold(enTotal)}`);
console.log('');

// ─── Per-namespace breakdown — only for under-covered locales ───────────
function topLevelNamespaces(flat) {
    const groups = {};
    for (const key of Object.keys(flat)) {
        // Group at module level (e.g., common / finance / inventory). For sub-
        // pages we go one deeper (e.g., finance.coa, finance.coa_templates_page)
        // so a translator can target one page at a time.
        const parts = key.split('.');
        const ns = parts.length >= 3 ? parts.slice(0, 2).join('.') : parts[0];
        groups[ns] = (groups[ns] || 0) + 1;
    }
    return groups;
}
const enNs = topLevelNamespaces(en);

for (const loc of locales) {
    if (loc === 'en') continue;
    if (stats[loc].coverage >= 99) continue;
    console.log(bold(`Top-namespace gaps for ${loc}`));
    console.log('─'.repeat(64));
    const tgtNs = topLevelNamespaces(stats[loc].flat);
    const rows = Object.entries(enNs).map(([ns, total]) => {
        const have = tgtNs[ns] || 0;
        const miss = total - have;
        const pct = total > 0 ? (have / total) * 100 : 0;
        return { ns, total, have, miss, pct };
    }).sort((a, b) => b.miss - a.miss);
    for (const r of rows) {
        if (r.miss === 0) continue;
        const pctStr = `${r.pct.toFixed(0)}%`.padStart(5);
        const colored = r.pct >= 95 ? green(pctStr) : r.pct >= 50 ? yellow(pctStr) : red(pctStr);
        console.log(`  ${r.ns.padEnd(38)}  ${String(r.have).padStart(4)}/${String(r.total).padEnd(4)}  ${colored}`);
    }
    console.log('');
}

console.log(dim('next: node .ai/scripts/i18n-export.js <locale>'));
console.log('');
