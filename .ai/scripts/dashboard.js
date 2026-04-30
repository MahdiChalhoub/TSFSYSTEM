#!/usr/bin/env node
/**
 * Page Production Readiness — batch dashboard
 *
 * Walks every page.tsx under src/app, runs the cheap mechanical checks
 * (no tsc/eslint — too slow at scale), aggregates results, writes
 * .ai/PAGE_READINESS_DASHBOARD.md sorted worst-first by section.
 *
 * Companion to check_page_ready.js (per-page deep dive).
 *
 * Usage: node .ai/scripts/dashboard.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const appDir = path.join(projectRoot, 'src/app');
const tourDir = path.join(projectRoot, 'src/lib/tours/definitions');

if (!fs.existsSync(appDir)) {
    console.error('src/app not found. Run from project root.');
    process.exit(2);
}

const tourFiles = fs.existsSync(tourDir) ? fs.readdirSync(tourDir) : [];

// ─── Walk pages ──────────────────────────────────────────────
function findPages(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...findPages(p));
        else if (e.name === 'page.tsx') out.push(p);
    }
    return out;
}

function readSurface(pagePath) {
    const dir = path.dirname(pagePath);
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    const buckets = [pageContent];
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (full === pagePath) continue;
        if (!fs.statSync(full).isFile()) continue;
        if (!/\.(tsx|ts)$/.test(f)) continue;
        try { buckets.push(fs.readFileSync(full, 'utf8')); } catch (_e) { /* skip */ }
    }
    const compDir = path.join(dir, '_components');
    if (fs.existsSync(compDir)) {
        for (const f of fs.readdirSync(compDir)) {
            if (!/\.(tsx|ts)$/.test(f)) continue;
            try { buckets.push(fs.readFileSync(path.join(compDir, f), 'utf8')); } catch (_e) { /* skip */ }
        }
    }
    return { pageContent, full: buckets.join('\n') };
}

function deriveSlug(p) {
    const m = p.match(/src\/app\/(?:\(.+?\)\/)?(.+?)\/page\.tsx$/);
    if (!m) return null;
    return m[1].replace(/\(.+?\)\//g, '').replace(/\//g, '-');
}

// ─── Score one page (8 mechanical items) ─────────────────────
function score(pagePath) {
    const { pageContent, full } = readSurface(pagePath);
    const slug = deriveSlug(pagePath);
    const isPriv = pagePath.includes('(privileged)');
    const lines = pageContent.split('\n').length;
    const fail = [];

    // 1 — mobile responsive utilities
    const responsive = (full.match(/(?:^|[\s"'`>])(?:sm|md|lg|xl|2xl):/g) || []).length;
    if (responsive < 5) fail.push('mobile');

    // 2 — tour pair + anchors
    const desktop = slug && tourFiles.includes(`${slug}.ts`);
    const mobile  = slug && tourFiles.includes(`${slug}-mobile.ts`);
    const anchors = (full.match(/data-tour=/g) || []).length;
    if (!(desktop && mobile && anchors >= 3)) fail.push('tour');

    // 3 — security basics
    if (/dangerouslySetInnerHTML/.test(full) || /\beval\s*\(|new\s+Function\s*\(/.test(full)) fail.push('sec');

    // 4 — i18n
    if (!/\buseTranslation\s*\(|\bt\(\s*['"`]/.test(full)) fail.push('i18n');

    // 5 — file size
    if (lines > 400) fail.push('size');

    // 6 — TODO / console
    const todos = (pageContent.match(/\b(?:TODO|FIXME|XXX|HACK)\b/g) || []).length;
    const cl    = (pageContent.match(/console\.log\(/g) || []).length;
    if (todos > 0 || cl > 0) fail.push('todo');

    // 7 — design signals
    const usesShell = /SettingsPageShell|PageShell|PageHeader\b/.test(full);
    const usesIcon  = /page-header-icon/.test(full);
    const tinyText  = (full.match(/text-\[(?:8|9)px\]/g) || []).length;
    const stripped  = full.replace(/var\(\s*--[\w-]+\s*,\s*#[0-9A-Fa-f]{3,6}\s*\)/g, 'var(_)');
    const rawHex    = (stripped.match(/#[0-9A-Fa-f]{6}\b/g) || [])
        .filter(h => !/^#(?:000000|FFFFFF)$/i.test(h)).length;
    if (!(usesShell || usesIcon) || tinyText > 0 || rawHex > 4) fail.push('design');

    // 8 — tenancy + perms (treated as one mechanical bucket: under (privileged) or has explicit guard)
    const hasGuard = /\b(?:require_permission|hasPermission|usePermission)\b/.test(full);
    if (!isPriv && !hasGuard) fail.push('auth');

    const total = 8;
    const pass = total - fail.length;
    return { pass, total, fail, lines, slug };
}

// ─── Sectioning ──────────────────────────────────────────────
function sectionOf(pagePath) {
    // src/app/(privileged)/finance/<...>/page.tsx → "(privileged) · finance"
    // src/app/landing/page.tsx                    → "(public) · landing"
    const rel = path.relative(appDir, pagePath);
    const parts = rel.split(path.sep);
    let group = '(public)';
    let idx = 0;
    if (parts[0] && parts[0].startsWith('(') && parts[0].endsWith(')')) {
        group = parts[0];
        idx = 1;
    }
    const top = parts[idx] || '(root)';
    return `${group} · ${top}`;
}

// ─── Run ─────────────────────────────────────────────────────
const start = Date.now();
const pages = findPages(appDir).sort();
const rows = pages.map(p => {
    try { return { path: p, ...score(p), section: sectionOf(p) }; }
    catch (e) { return { path: p, pass: 0, total: 8, fail: ['error'], lines: 0, section: sectionOf(p), error: e.message }; }
});
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

// Group
const bySection = {};
for (const r of rows) {
    bySection[r.section] = bySection[r.section] || [];
    bySection[r.section].push(r);
}

// Aggregate
const fullPass = rows.filter(r => r.pass === r.total).length;
const avg = rows.length ? (rows.reduce((s, r) => s + r.pass, 0) / rows.length) : 0;
const gapCounts = {};
for (const r of rows) for (const f of r.fail) gapCounts[f] = (gapCounts[f] || 0) + 1;

const gapName = {
    mobile: 'Mobile responsive',
    tour:   'Tour (desktop+mobile+anchors)',
    sec:    'Security basics',
    i18n:   'i18n usage',
    size:   'File size ≤ 400 LOC',
    todo:   'TODO/FIXME/console.log',
    design: 'Design signals (shell/text/hex)',
    auth:   'Tenancy/permissions',
    error:  'Scan error',
};

// ─── Render markdown ─────────────────────────────────────────
let md = '';
md += `# Page Production Readiness Dashboard\n\n`;
md += `**Generated**: ${new Date().toISOString()}\n`;
md += `**Pages scanned**: ${rows.length}\n`;
md += `**Scan time**: ${elapsed}s\n\n`;
md += `> Mechanical checks only (no tsc / eslint). For per-page deep dive run\n`;
md += `> \`node .ai/scripts/check_page_ready.js <path>\`. Manual review items\n`;
md += `> (#10 security 11/10, #11 maintenance 11/10) are not in this dashboard.\n\n`;
md += `---\n\n## Summary\n\n`;
md += `- Ship-ready (**8 / 8** mechanical): **${fullPass}** of ${rows.length} pages — ${(fullPass / rows.length * 100).toFixed(1)}%\n`;
md += `- Average score: **${avg.toFixed(2)} / 8**\n`;
md += `- Pages with **0 / 8** (worst): ${rows.filter(r => r.pass === 0).length}\n`;
md += `- Pages with **≥ 6 / 8** (close): ${rows.filter(r => r.pass >= 6).length}\n\n`;

md += `## Most common gaps\n\n`;
md += `| Gap | Pages affected | % of total |\n|---|---:|---:|\n`;
for (const [k, v] of Object.entries(gapCounts).sort((a, b) => b[1] - a[1])) {
    md += `| ${gapName[k] || k} | ${v} | ${(v / rows.length * 100).toFixed(1)}% |\n`;
}
md += `\n## Worst 30 pages overall\n\n`;
md += `| Score | Page | Gaps | LOC |\n|---|---|---|---:|\n`;
const worst = rows.slice().sort((a, b) => a.pass - b.pass || b.lines - a.lines).slice(0, 30);
for (const r of worst) {
    const rel = path.relative(projectRoot, r.path);
    const gaps = r.fail.map(f => gapName[f] || f).join(', ') || '—';
    md += `| ${r.pass}/${r.total} | \`${rel}\` | ${gaps} | ${r.lines} |\n`;
}

// Per-section
md += `\n---\n\n## By section\n\n`;
for (const [section, list] of Object.entries(bySection).sort()) {
    const sectionAvg = (list.reduce((s, r) => s + r.pass, 0) / list.length).toFixed(2);
    const sectionFull = list.filter(r => r.pass === r.total).length;
    md += `### ${section}  ·  ${list.length} page${list.length !== 1 ? 's' : ''}  ·  avg ${sectionAvg}/8  ·  ${sectionFull} ship-ready\n\n`;
    md += `| Score | Page | Gaps | LOC |\n|---|---|---|---:|\n`;
    for (const r of list.sort((a, b) => a.pass - b.pass || a.path.localeCompare(b.path))) {
        const rel = path.relative(appDir, r.path);
        const gaps = r.fail.map(f => gapName[f] || f).join(', ') || '—';
        const score = r.pass === r.total ? `**${r.pass}/${r.total}**` : `${r.pass}/${r.total}`;
        md += `| ${score} | \`${rel}\` | ${gaps} | ${r.lines} |\n`;
    }
    md += `\n`;
}

const out = path.join(projectRoot, '.ai/PAGE_READINESS_DASHBOARD.md');
fs.writeFileSync(out, md);

console.log(`Wrote ${path.relative(projectRoot, out)}`);
console.log(`Scanned ${rows.length} pages in ${elapsed}s`);
console.log(`Ship-ready: ${fullPass} (${(fullPass / rows.length * 100).toFixed(1)}%) · avg ${avg.toFixed(2)}/8`);
console.log('');
console.log('Top gaps:');
for (const [k, v] of Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  ${gapName[k] || k}: ${v}`);
}
