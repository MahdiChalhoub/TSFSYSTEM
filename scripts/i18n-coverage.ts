#!/usr/bin/env node
/**
 * TSFSYSTEM i18n Coverage Report
 * ===============================
 * Compares all translation keys in the source locale (en) against
 * each target locale and generates a coverage report.
 *
 * Usage:
 *   npx tsx scripts/i18n-coverage.ts          # human-readable table
 *   npx tsx scripts/i18n-coverage.ts --json    # JSON output for dashboard
 */

import fs from 'fs';
import path from 'path';

const MESSAGES_DIR = path.resolve(process.cwd(), 'messages');
const SOURCE_LOCALE = 'en';
const JSON_MODE = process.argv.includes('--json');

// ── Helpers ──

function getLocales(): string[] {
    return fs.readdirSync(MESSAGES_DIR)
        .filter(f => fs.statSync(path.join(MESSAGES_DIR, f)).isDirectory());
}

function getNamespaces(locale: string): string[] {
    const dir = path.join(MESSAGES_DIR, locale);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
}

function loadMessages(locale: string, namespace: string): Record<string, any> {
    const filePath = path.join(MESSAGES_DIR, locale, `${namespace}.json`);
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...flattenKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function getValueByPath(obj: Record<string, any>, keyPath: string): any {
    const parts = keyPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
}

// ── Main ──

interface NamespaceCoverage {
    namespace: string;
    sourceKeys: number;
    translatedKeys: number;
    missingKeys: string[];
    coverage: number;
}

interface LocaleCoverage {
    locale: string;
    totalSourceKeys: number;
    totalTranslated: number;
    totalMissing: number;
    coverage: number;
    namespaces: NamespaceCoverage[];
}

function generateReport(): { source: string; sourceKeyCount: number; locales: LocaleCoverage[] } {
    const locales = getLocales().filter(l => l !== SOURCE_LOCALE);
    const sourceNamespaces = getNamespaces(SOURCE_LOCALE);

    // Count total source keys
    let totalSourceKeys = 0;
    const sourceKeysByNamespace: Record<string, string[]> = {};

    for (const ns of sourceNamespaces) {
        const messages = loadMessages(SOURCE_LOCALE, ns);
        const keys = flattenKeys(messages);
        sourceKeysByNamespace[ns] = keys;
        totalSourceKeys += keys.length;
    }

    const localeReports: LocaleCoverage[] = locales.map(locale => {
        const nsCoverages: NamespaceCoverage[] = sourceNamespaces.map(ns => {
            const sourceKeys = sourceKeysByNamespace[ns];
            const targetMessages = loadMessages(locale, ns);
            const targetKeys = flattenKeys(targetMessages);

            const missingKeys: string[] = [];
            let translatedCount = 0;

            for (const key of sourceKeys) {
                const targetValue = getValueByPath(targetMessages, key);
                if (targetValue === undefined || targetValue === null || targetValue === '') {
                    missingKeys.push(key);
                } else {
                    translatedCount++;
                }
            }

            return {
                namespace: ns,
                sourceKeys: sourceKeys.length,
                translatedKeys: translatedCount,
                missingKeys,
                coverage: sourceKeys.length > 0
                    ? Math.round((translatedCount / sourceKeys.length) * 100)
                    : 100,
            };
        });

        const totalTranslated = nsCoverages.reduce((sum, ns) => sum + ns.translatedKeys, 0);
        const totalMissing = nsCoverages.reduce((sum, ns) => sum + ns.missingKeys.length, 0);

        return {
            locale,
            totalSourceKeys,
            totalTranslated,
            totalMissing,
            coverage: totalSourceKeys > 0
                ? Math.round((totalTranslated / totalSourceKeys) * 100)
                : 100,
            namespaces: nsCoverages,
        };
    });

    return {
        source: SOURCE_LOCALE,
        sourceKeyCount: totalSourceKeys,
        locales: localeReports,
    };
}

// ── Output ──

function progressBar(pct: number, width = 20): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

const LOCALE_FLAGS: Record<string, string> = {
    en: '🇬🇧',
    fr: '🇫🇷',
    ar: '🇸🇦',
};

function printHumanReport() {
    const report = generateReport();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  TSFSYSTEM i18n COVERAGE REPORT                             ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Source: ${report.source} (${report.sourceKeyCount} keys)${' '.repeat(Math.max(0, 40 - String(report.sourceKeyCount).length))}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');

    for (const loc of report.locales) {
        const flag = LOCALE_FLAGS[loc.locale] || '🌐';
        console.log(`║  ${flag} ${loc.locale.toUpperCase().padEnd(4)} ${progressBar(loc.coverage)} ${String(loc.coverage).padStart(3)}%  (${loc.totalTranslated}/${loc.totalSourceKeys})${' '.repeat(Math.max(0, 14 - String(loc.totalTranslated).length - String(loc.totalSourceKeys).length))}║`);
    }

    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  BY NAMESPACE:                                               ║');
    console.log('║  ┌────────────────┬──────┬──────┐                            ║');

    const allLocales = report.locales.map(l => l.locale);
    const header = '║  │ Namespace      │ ' + allLocales.map(l => l.padEnd(4)).join(' │ ') + ' │';
    console.log(header + ' '.repeat(Math.max(0, 63 - header.length)) + '║');
    console.log('║  ├────────────────┼──────┼──────┤                            ║');

    const namespaces = report.locales[0]?.namespaces || [];
    for (const ns of namespaces) {
        const cols = allLocales.map(locale => {
            const locReport = report.locales.find(l => l.locale === locale);
            const nsCov = locReport?.namespaces.find(n => n.namespace === ns.namespace);
            return `${String(nsCov?.coverage ?? 0).padStart(3)}%`;
        });
        const row = `║  │ ${ns.namespace.padEnd(14)} │ ${cols.join(' │ ')} │`;
        console.log(row + ' '.repeat(Math.max(0, 63 - row.length)) + '║');
    }

    console.log('║  └────────────────┴──────┴──────┘                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
}

// ── Entry point ──

if (JSON_MODE) {
    const report = generateReport();
    console.log(JSON.stringify(report, null, 2));
} else {
    printHumanReport();
}
