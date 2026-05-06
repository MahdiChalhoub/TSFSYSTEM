import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API endpoint for i18n translation coverage report.
 * Reads message files and compares keys across locales.
 *
 * GET /api/i18n-coverage
 */

const MESSAGES_DIR = path.resolve(process.cwd(), 'messages');
const SOURCE_LOCALE = 'en';

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

export async function GET() {
    try {
        const locales = fs.readdirSync(MESSAGES_DIR)
            .filter(f => fs.statSync(path.join(MESSAGES_DIR, f)).isDirectory());

        const targetLocales = locales.filter(l => l !== SOURCE_LOCALE);
        const sourceDir = path.join(MESSAGES_DIR, SOURCE_LOCALE);

        if (!fs.existsSync(sourceDir)) {
            return NextResponse.json({ error: 'Source locale not found' }, { status: 404 });
        }

        const namespaces = fs.readdirSync(sourceDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));

        // Gather source keys
        let totalSourceKeys = 0;
        const sourceKeysByNs: Record<string, string[]> = {};

        for (const ns of namespaces) {
            const filePath = path.join(sourceDir, `${ns}.json`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const keys = flattenKeys(data);
            sourceKeysByNs[ns] = keys;
            totalSourceKeys += keys.length;
        }

        // Compare each target locale
        const localeReports = targetLocales.map(locale => {
            const nsCoverages = namespaces.map(ns => {
                const sourceKeys = sourceKeysByNs[ns];
                const targetPath = path.join(MESSAGES_DIR, locale, `${ns}.json`);
                const targetData = fs.existsSync(targetPath)
                    ? JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
                    : {};

                const missingKeys: string[] = [];
                let translatedCount = 0;

                for (const key of sourceKeys) {
                    const val = getValueByPath(targetData, key);
                    if (val === undefined || val === null || val === '') {
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

            const totalTranslated = nsCoverages.reduce((s, n) => s + n.translatedKeys, 0);
            const totalMissing = nsCoverages.reduce((s, n) => s + n.missingKeys.length, 0);

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

        return NextResponse.json({
            source: SOURCE_LOCALE,
            sourceKeyCount: totalSourceKeys,
            locales: localeReports,
        });
    } catch (error) {
        console.error('[i18n-coverage] Error generating report:', error);
        return NextResponse.json({ error: 'Failed to generate coverage report' }, { status: 500 });
    }
}
