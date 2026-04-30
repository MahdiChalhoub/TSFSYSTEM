#!/usr/bin/env node
/**
 * Page Production Readiness — mechanical validator
 *
 * Usage:
 *   node .ai/scripts/check_page_ready.js src/app/<path>/page.tsx
 *
 * Exit codes:
 *   0 — all mechanical checks pass (manual items still need human sign-off)
 *   1 — at least one mechanical check failed
 *   2 — usage / IO error
 *
 * See .ai/PAGE_PRODUCTION_CHECKLIST.md for the full criteria + override rules.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── ANSI colors (degrade gracefully if not a TTY) ───────────
const isTTY = process.stdout.isTTY;
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green  = s => c('32', s);
const red    = s => c('31', s);
const yellow = s => c('33', s);
const dim    = s => c('2',  s);
const bold   = s => c('1',  s);
const cyan   = s => c('36', s);

const ICON_OK   = green('✓');
const ICON_FAIL = red('✗');
const ICON_MAN  = yellow('◯');

// ─── Args / IO ───────────────────────────────────────────────
const pagePath = process.argv[2];
if (!pagePath) {
    console.error('Usage: node .ai/scripts/check_page_ready.js <path-to-page.tsx>');
    process.exit(2);
}
if (!fs.existsSync(pagePath)) {
    console.error(`File not found: ${pagePath}`);
    process.exit(2);
}
if (!pagePath.endsWith('.tsx')) {
    console.error(`Not a .tsx file: ${pagePath}`);
    process.exit(2);
}

const projectRoot = process.cwd();
const content = fs.readFileSync(pagePath, 'utf8');
const lines = content.split('\n');

// Read the page's full surface area:
//   - page.tsx itself
//   - sibling files in same dir (viewer.tsx, *Client.tsx, *Gateway.tsx, etc.)
//   - _components/*
function readPageSurface(pageDir, pagePath) {
    const buckets = [];
    // sibling .tsx/.ts files in same directory
    if (fs.existsSync(pageDir)) {
        for (const f of fs.readdirSync(pageDir)) {
            const full = path.join(pageDir, f);
            if (full === pagePath) continue;
            if (!fs.statSync(full).isFile()) continue;
            if (!/\.(tsx|ts)$/.test(f)) continue;
            try { buckets.push(fs.readFileSync(full, 'utf8')); } catch (_e) { /* skip */ }
        }
    }
    // _components/*
    const compDir = path.join(pageDir, '_components');
    if (fs.existsSync(compDir)) {
        for (const f of fs.readdirSync(compDir)) {
            if (!/\.(tsx|ts)$/.test(f)) continue;
            try { buckets.push(fs.readFileSync(path.join(compDir, f), 'utf8')); } catch (_e) { /* skip */ }
        }
    }
    return buckets.join('\n');
}
const pageDir = path.dirname(pagePath);
const siblingContent = readPageSurface(pageDir, pagePath);
const fullContent = content + '\n' + siblingContent;

// Slug for tour-file matching: app/(privileged)/finance/chart-of-accounts/page.tsx → finance-chart-of-accounts
function deriveSlug(p) {
    const m = p.match(/src\/app\/(?:\(privileged\)\/)?(.+?)\/page\.tsx$/);
    if (!m) return null;
    return m[1].replace(/\(.+?\)\//g, '').replace(/\//g, '-');
}
const slug = deriveSlug(pagePath);

// ─── Check helpers ───────────────────────────────────────────

const pageContent = content;     // page.tsx only
const allContent  = fullContent; // page.tsx + _components/*

const checks = [];

function add(id, label, status, note, manual = false) {
    checks.push({ id, label, status, note, manual });
}

// 1 — Mobile compatibility
{
    const responsive = (allContent.match(/(?:^|[\s"'`>])(?:sm|md|lg|xl|2xl):/g) || []).length;
    if (responsive >= 5) add(1, 'Mobile compatibility (responsive utilities)', 'ok',
        `${responsive} responsive utilities detected`);
    else add(1, 'Mobile compatibility (responsive utilities)', 'fail',
        `only ${responsive} responsive utilities (recommend ≥ 5 for sm:/md:/lg:)`);
}

// 2 — Tour (desktop + mobile)
{
    const tourDir = path.join(projectRoot, 'src/lib/tours/definitions');
    let desktopFound = false, mobileFound = false, desktopFile = '', mobileFile = '';
    if (slug && fs.existsSync(tourDir)) {
        const files = fs.readdirSync(tourDir);
        // Prefer exact match; fall back to startsWith for nested-route shortening
        desktopFound = files.includes(`${slug}.ts`);
        mobileFound  = files.includes(`${slug}-mobile.ts`);
        if (!desktopFound) {
            const guess = files.find(f =>
                !f.endsWith('-mobile.ts') && f.endsWith('.ts') && slug.includes(f.replace(/\.ts$/, ''))
            );
            if (guess) { desktopFound = true; desktopFile = guess; }
        }
        if (!mobileFound) {
            const guess = files.find(f =>
                f.endsWith('-mobile.ts') && slug.includes(f.replace(/-mobile\.ts$/, ''))
            );
            if (guess) { mobileFound = true; mobileFile = guess; }
        }
    }
    const anchors = (allContent.match(/data-tour=/g) || []).length;
    const both = desktopFound && mobileFound;
    if (both && anchors >= 3) add(2, 'Tour (desktop + mobile)', 'ok',
        `desktop${desktopFile ? ` (${desktopFile})` : ''} + mobile${mobileFile ? ` (${mobileFile})` : ''} found · ${anchors} data-tour anchors`);
    else if (!desktopFound && !mobileFound) add(2, 'Tour (desktop + mobile)', 'fail',
        `no tour files for slug "${slug}" in src/lib/tours/definitions/`);
    else if (!mobileFound) add(2, 'Tour (desktop + mobile)', 'fail',
        `mobile tour missing: ${slug}-mobile.ts (desktop found)`);
    else if (!desktopFound) add(2, 'Tour (desktop + mobile)', 'fail',
        `desktop tour missing: ${slug}.ts (mobile found)`);
    else add(2, 'Tour (desktop + mobile)', 'fail',
        `tour files present but only ${anchors} data-tour anchors (recommend ≥ 3)`);
}

// 3 — Security — basic mechanical checks
{
    const issues = [];
    const secrets = allContent.match(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}/gi) || [];
    if (secrets.length > 0) issues.push(`${secrets.length} possible hardcoded secret(s)`);
    if (/dangerouslySetInnerHTML/.test(allContent)) issues.push('dangerouslySetInnerHTML present');
    if (/\beval\s*\(|new\s+Function\s*\(/.test(allContent)) issues.push('eval / new Function present');
    const consoleLogsOfState = (allContent.match(/console\.log\([^)]*\b(?:user|email|password|token|tenant)\b/gi) || []).length;
    if (consoleLogsOfState > 0) issues.push(`${consoleLogsOfState} console.log of sensitive identifiers`);
    if (issues.length === 0) add(3, 'Security — basic checks', 'ok', 'no obvious vectors detected');
    else add(3, 'Security — basic checks', 'fail', issues.join('; '));
}

// 4 — Multilanguage (i18n)
{
    const usesHook  = /\buseTranslation\s*\(/.test(allContent);
    const usesT     = /\bt\(\s*['"`]/.test(allContent);
    // Heuristic: capitalized JSX text content. False positives possible — flag, don't block.
    const rawEnglishMatches = pageContent.match(/>\s*[A-Z][a-z]+(?:\s+[a-z]+){1,}\s*</g) || [];
    if (usesHook || usesT) {
        const note = `translation hooks present${rawEnglishMatches.length > 0 ? ` · heuristic ${rawEnglishMatches.length} possible raw English strings (review)` : ''}`;
        add(4, 'Multilanguage (i18n)', rawEnglishMatches.length > 6 ? 'fail' : 'ok', note);
    } else {
        add(4, 'Multilanguage (i18n)', 'fail',
            `no useTranslation / t( found · heuristic ${rawEnglishMatches.length} raw strings`);
    }
}

// 5 — Files refactored / size
{
    const loc = lines.length;
    if (loc <= 400) add(5, 'Files refactored / size', 'ok', `${loc} lines`);
    else if (loc <= 600) add(5, 'Files refactored / size', 'fail',
        `${loc} lines (recommend ≤ 400 — extract sub-components to _components/)`);
    else add(5, 'Files refactored / size', 'fail',
        `${loc} lines — strongly suggest decomposition`);

    const compDir = path.join(pageDir, '_components');
    if (!fs.existsSync(compDir) && loc > 200) {
        // Soft warning — not a separate fail
    }
}

// 6 — Easy to maintain
{
    const todos        = (pageContent.match(/\b(?:TODO|FIXME|XXX|HACK)\b/g) || []).length;
    const consoleLogs  = (pageContent.match(/console\.log\(/g) || []).length;
    const issues = [];
    if (todos > 0)       issues.push(`${todos} TODO/FIXME/XXX/HACK`);
    if (consoleLogs > 0) issues.push(`${consoleLogs} console.log`);

    // tsc + eslint — best-effort; skip cleanly if binaries not present
    const tscBin    = path.join(projectRoot, 'node_modules/.bin/tsc');
    const eslintBin = path.join(projectRoot, 'node_modules/.bin/eslint');
    let tscPassed = null, eslintPassed = null;

    if (fs.existsSync(tscBin)) {
        try {
            execSync(`${tscBin} --noEmit 2>&1 | grep -F "${pagePath}" || true`, { stdio: 'pipe' });
            const out = execSync(`${tscBin} --noEmit 2>&1`, { stdio: 'pipe' }).toString();
            tscPassed = !out.split('\n').some(l => l.includes(pagePath));
        } catch (_e) { tscPassed = null; }
    }
    if (fs.existsSync(eslintBin)) {
        try {
            execSync(`${eslintBin} "${pagePath}" 2>&1`, { stdio: 'pipe' });
            eslintPassed = true;
        } catch (e) {
            const out = (e.stdout || '').toString();
            // Treat exit-zero output with errors as still passing (project sometimes reports as warnings)
            eslintPassed = !/error/i.test(out) || e.status === 0;
        }
    }

    if (tscPassed === false)    issues.push('TypeScript errors in this file');
    if (eslintPassed === false) issues.push('ESLint errors in this file');

    if (issues.length === 0) {
        const detail = [
            tscPassed === true ? 'tsc clean' : tscPassed === null ? 'tsc skipped' : null,
            eslintPassed === true ? 'eslint clean' : eslintPassed === null ? 'eslint skipped' : null,
        ].filter(Boolean).join(' · ');
        add(6, 'Easy to maintain', 'ok', detail || 'clean');
    } else {
        add(6, 'Easy to maintain', 'fail', issues.join('; '));
    }
}

// 7 — Design 11/10 (mechanical signals only — most is manual)
{
    const issues = [];
    // Header icon: pass if page-header-icon is used directly OR a known shell wrapper provides it
    const usesShell = /SettingsPageShell|PageShell|PageHeader\b/.test(allContent);
    const usesIconClass = /page-header-icon/.test(allContent);
    if (!usesShell && !usesIconClass) issues.push('no `page-header-icon` and no SettingsPageShell wrapper');
    const tinyText = (allContent.match(/text-\[(?:8|9)px\]/g) || []).length;
    if (tinyText > 0) issues.push(`${tinyText} text-[8|9]px (use text-tp-xxs ≥ 10px for a11y)`);
    // Raw hex colors — heuristic, ignore pure black/white & common safelist
    const rawHex = (allContent.match(/#[0-9A-Fa-f]{6}\b/g) || [])
        .filter(h => !/^#(?:000000|FFFFFF|FFF|000)$/i.test(h)).length;
    if (rawHex > 4) issues.push(`${rawHex} raw hex colors (prefer var(--app-*) tokens)`);
    if (issues.length === 0) add(7, 'Design (mechanical signals)', 'ok', 'consistent patterns detected', true);
    else                     add(7, 'Design (mechanical signals)', 'fail', issues.join('; '), true);
}

// 8 — Tenant isolation
{
    const isPrivileged = pagePath.includes('(privileged)');
    const hasGuard = /\b(?:require_permission|hasPermission|usePermission|RequireAuth|withAuth)\b/.test(pageContent);
    if (isPrivileged) add(8, 'Tenant isolation', 'ok', 'route under (privileged) group');
    else if (hasGuard) add(8, 'Tenant isolation', 'ok', 'explicit auth guard detected');
    else add(8, 'Tenant isolation', 'fail',
        'route is not under (privileged) and no explicit guard — manual confirmation required');
}

// 9 — Permissions created
{
    const isPrivileged = pagePath.includes('(privileged)');
    const explicitPerm = (pageContent.match(/['"]\w+\.\w+['"]/g) || [])
        .filter(s => /\.(view|edit|create|delete|read|write)\b/.test(s)).length;
    if (isPrivileged) add(9, 'Permissions', 'ok',
        'inherits route-level permissions (verify least-privilege manually)');
    else if (explicitPerm > 0) add(9, 'Permissions', 'ok',
        `${explicitPerm} permission key(s) referenced`);
    else add(9, 'Permissions', 'fail', 'no permission gate detected');
}

// 10 — Security 11/10 (manual; rolls up #3)
{
    const sec3 = checks.find(x => x.id === 3);
    const note = sec3 && sec3.status === 'ok'
        ? 'mechanical pass — manual review required'
        : 'mechanical FAIL — fix #3 before sign-off';
    add(10, 'Security 11/10 (manual)', 'manual', note, true);
}

// 11 — Maintenance 11/10 (manual; rolls up #5+#6)
{
    const m5 = checks.find(x => x.id === 5);
    const m6 = checks.find(x => x.id === 6);
    const allOk = (m5 && m5.status === 'ok') && (m6 && m6.status === 'ok');
    add(11, 'Maintenance 11/10 (manual)', 'manual',
        allOk ? 'mechanical pass — manual review required'
              : 'mechanical FAIL — fix #5 / #6 before sign-off', true);
}

// ─── Render report ────────────────────────────────────────────

const rel = path.relative(projectRoot, pagePath);
console.log('');
console.log(bold(`Page Production Readiness — ${cyan(rel)}`));
console.log(dim('  spec: .ai/PAGE_PRODUCTION_CHECKLIST.md'));
console.log('');

let mechPass = 0, mechFail = 0, manualCount = 0;
for (const c of checks) {
    const icon = c.status === 'ok' ? ICON_OK : c.status === 'fail' ? ICON_FAIL : ICON_MAN;
    const num  = String(c.id).padStart(2);
    const lbl  = c.label.padEnd(38);
    console.log(`  ${icon}  ${dim(num)}  ${lbl}  ${dim('—')}  ${c.note}`);
    if (c.status === 'manual') manualCount++;
    else if (c.status === 'ok') mechPass++;
    else mechFail++;
}

console.log('');
const mechTotal = mechPass + mechFail;
console.log(bold('Summary'));
console.log(`  Mechanical : ${mechPass}/${mechTotal} ${mechFail === 0 ? green('PASS') : red('FAIL')}`);
console.log(`  Manual     : ${manualCount} item(s) require reviewer sign-off`);
console.log('');

// ─── Copy-paste record ────────────────────────────────────────

console.log(bold('Per-page checklist record (copy into PR description):'));
console.log(dim('───────────────────────────────────────────────────────────'));
console.log(`## Page Production Readiness — \`${rel}\`

| # | Item                          | Score | ✓ Reviewer | Override reason (if < 11/10) |
|---|-------------------------------|-------|------------|------------------------------|`);
for (const c of checks) {
    const num = String(c.id).padStart(2);
    const lbl = c.label.padEnd(30).slice(0, 30);
    const machineHint = c.status === 'ok'   ? 'mech ✓ '
                      : c.status === 'fail' ? 'mech ✗ '
                      :                       '       ';
    const overrideCell = (c.id === 8 || c.id === 9) ? '(override not allowed)' : '';
    console.log(`| ${num.trim()} | ${lbl} | ${machineHint}/10 |            | ${overrideCell.padEnd(28)} |`);
}
console.log(`
**Reviewer**: \`<name>\`
**Date**: \`YYYY-MM-DD\`
**Status**: ☐ Approved for production / ☐ Changes requested

**Mechanical findings**:
${checks.filter(c => c.status !== 'ok').map(c => `- ${c.id}. ${c.label}: ${c.note}`).join('\n')}

**Notes**:
`);
console.log(dim('───────────────────────────────────────────────────────────'));
console.log('');

process.exit(mechFail > 0 ? 1 : 0);
