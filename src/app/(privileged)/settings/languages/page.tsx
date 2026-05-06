'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Globe, Check, ChevronRight, Languages, BarChart3, FileJson, ArrowRight } from 'lucide-react';
import { setLocaleAction, getSupportedLocalesAction } from '@/app/actions/settings/locale';

interface LocaleInfo {
    code: string;
    name: string;
    nativeName: string;
    dir: 'ltr' | 'rtl';
    flag: string;
    active: boolean;
}

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

interface CoverageReport {
    source: string;
    sourceKeyCount: number;
    locales: LocaleCoverage[];
}

const LOCALE_COLORS: Record<string, string> = {
    en: 'var(--app-success, #22c55e)',
    fr: 'var(--app-info, #3b82f6)',
    ar: 'var(--app-warning, #f59e0b)',
};

export default function LanguagesPage() {
    const t = useTranslations('Common');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [locales, setLocales] = useState<LocaleInfo[]>([]);
    const [currentLocale, setCurrentLocale] = useState('en');
    const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
    const [coverageLoading, setCoverageLoading] = useState(true);

    useEffect(() => {
        // Load locale list
        getSupportedLocalesAction().then(data => {
            setLocales(data.locales);
            setCurrentLocale(data.current);
        });

        // Load coverage report via API
        fetch('/api/i18n-coverage')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) setCoverageReport(data);
            })
            .catch(() => {})
            .finally(() => setCoverageLoading(false));
    }, []);

    const handleLocaleChange = (code: string) => {
        startTransition(async () => {
            await setLocaleAction(code);
            setCurrentLocale(code);
            router.refresh();
        });
    };

    const getColor = (locale: string) => LOCALE_COLORS[locale] || 'var(--app-primary)';

    return (
        <div style={{ padding: 'var(--layout-container-padding, 1.5rem)', maxWidth: 960 }}>
            {/* ── Header ── */}
            <div style={{ marginBottom: 'var(--layout-section-spacing, 1.75rem)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 'var(--card-radius, 0.75rem)',
                        background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-dark, var(--app-primary)))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px var(--app-primary-glow, rgba(0,0,0,0.2))',
                    }}>
                        <Globe size={20} color="white" />
                    </div>
                    <div>
                        <h1>Languages & Localization</h1>
                        <p className="app-page-subtitle">Manage translations and track coverage across all languages</p>
                    </div>
                </div>
            </div>

            {/* ── Language Selector ── */}
            <div style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--card-radius, 0.75rem)',
                padding: 'var(--card-padding, 1.25rem)',
                marginBottom: 'var(--layout-section-spacing, 1.75rem)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Languages size={16} style={{ color: 'var(--app-primary)' }} />
                    <h2 style={{ margin: 0 }}>Active Language</h2>
                </div>
                <p style={{ color: 'var(--app-muted-foreground)', fontSize: '0.8125rem', marginBottom: '1rem', marginTop: 0 }}>
                    Choose your preferred language. The entire interface will update immediately.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {locales.map(locale => (
                        <button
                            key={locale.code}
                            onClick={() => handleLocaleChange(locale.code)}
                            disabled={isPending}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.875rem 1rem',
                                borderRadius: 'var(--card-radius, 0.75rem)',
                                border: locale.code === currentLocale
                                    ? `2px solid var(--app-primary)`
                                    : '1px solid var(--app-border)',
                                background: locale.code === currentLocale
                                    ? 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))'
                                    : 'var(--app-surface)',
                                cursor: isPending ? 'wait' : 'pointer',
                                transition: 'all 0.2s ease',
                                textAlign: 'left' as const,
                                width: '100%',
                                color: 'var(--app-foreground)',
                            }}
                            onMouseEnter={e => {
                                if (locale.code !== currentLocale) {
                                    e.currentTarget.style.borderColor = 'var(--app-primary)';
                                    e.currentTarget.style.background = 'var(--app-surface-hover)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (locale.code !== currentLocale) {
                                    e.currentTarget.style.borderColor = 'var(--app-border)';
                                    e.currentTarget.style.background = 'var(--app-surface)';
                                }
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>{locale.flag}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{locale.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>
                                    {locale.nativeName} • {locale.dir.toUpperCase()}
                                </div>
                            </div>
                            {locale.code === currentLocale && (
                                <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: 'var(--app-primary)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Check size={14} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Coverage Dashboard ── */}
            <div style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--card-radius, 0.75rem)',
                padding: 'var(--card-padding, 1.25rem)',
                marginBottom: 'var(--layout-section-spacing, 1.75rem)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <BarChart3 size={16} style={{ color: 'var(--app-primary)' }} />
                    <h2 style={{ margin: 0 }}>Translation Coverage</h2>
                </div>
                <p style={{ color: 'var(--app-muted-foreground)', fontSize: '0.8125rem', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
                    {coverageReport
                        ? `${coverageReport.sourceKeyCount} translatable keys across ${coverageReport.locales.length + 1} languages`
                        : 'Loading coverage data...'
                    }
                </p>

                {coverageLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--app-muted-foreground)' }}>
                        {t('loading')}
                    </div>
                ) : coverageReport ? (
                    <>
                        {/* Overall bars */}
                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                            {/* Source locale */}
                            <div style={{
                                padding: '0.875rem 1rem',
                                borderRadius: 'var(--button-radius, 0.5rem)',
                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 6%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                                        🇬🇧 English (Source)
                                    </span>
                                    <span style={{
                                        fontWeight: 800, fontSize: '0.875rem',
                                        color: 'var(--app-success, #22c55e)',
                                    }}>100%</span>
                                </div>
                                <div style={{
                                    height: 8, borderRadius: 4,
                                    background: 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', width: '100%', borderRadius: 4,
                                        background: 'var(--app-success, #22c55e)',
                                    }} />
                                </div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--app-muted-foreground)', marginTop: '0.375rem' }}>
                                    {coverageReport.sourceKeyCount} keys • Source of truth
                                </div>
                            </div>

                            {coverageReport.locales.map(loc => (
                                <div key={loc.locale} style={{
                                    padding: '0.875rem 1rem',
                                    borderRadius: 'var(--button-radius, 0.5rem)',
                                    background: `color-mix(in srgb, ${getColor(loc.locale)} 6%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${getColor(loc.locale)} 20%, transparent)`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                                            {locales.find(l => l.code === loc.locale)?.flag || '🌐'}{' '}
                                            {locales.find(l => l.code === loc.locale)?.name || loc.locale}
                                        </span>
                                        <span style={{
                                            fontWeight: 800, fontSize: '0.875rem',
                                            color: getColor(loc.locale),
                                        }}>{loc.coverage}%</span>
                                    </div>
                                    <div style={{
                                        height: 8, borderRadius: 4,
                                        background: `color-mix(in srgb, ${getColor(loc.locale)} 15%, transparent)`,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${loc.coverage}%`,
                                            borderRadius: 4,
                                            background: getColor(loc.locale),
                                            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--app-muted-foreground)', marginTop: '0.375rem' }}>
                                        {loc.totalTranslated}/{loc.totalSourceKeys} keys translated • {loc.totalMissing} missing
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Namespace breakdown */}
                        <div>
                            <h3 style={{ margin: '0 0 0.75rem 0' }}>By Namespace</h3>
                            <div style={{
                                borderRadius: 'var(--button-radius, 0.5rem)',
                                border: '1px solid var(--app-border)',
                                overflow: 'hidden',
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--app-surface-hover)' }}>
                                            <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted-foreground)' }}>
                                                <FileJson size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} />
                                                Namespace
                                            </th>
                                            <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted-foreground)' }}>
                                                Keys
                                            </th>
                                            {coverageReport.locales.map(loc => (
                                                <th key={loc.locale} style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted-foreground)' }}>
                                                    {locales.find(l => l.code === loc.locale)?.flag || '🌐'} {loc.locale.toUpperCase()}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(coverageReport.locales[0]?.namespaces || []).map((ns, idx) => (
                                            <tr key={ns.namespace} style={{
                                                borderTop: idx > 0 ? '1px solid var(--app-border)' : undefined,
                                            }}>
                                                <td style={{ padding: '0.625rem 1rem', fontWeight: 600 }}>
                                                    {ns.namespace}
                                                </td>
                                                <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', color: 'var(--app-muted-foreground)' }}>
                                                    {ns.sourceKeys}
                                                </td>
                                                {coverageReport.locales.map(loc => {
                                                    const nsCov = loc.namespaces.find(n => n.namespace === ns.namespace);
                                                    const pct = nsCov?.coverage ?? 0;
                                                    return (
                                                        <td key={loc.locale} style={{
                                                            padding: '0.625rem 0.75rem',
                                                            textAlign: 'center',
                                                            fontWeight: 700,
                                                            color: pct === 100 ? 'var(--app-success, #22c55e)'
                                                                : pct > 50 ? getColor(loc.locale)
                                                                    : 'var(--app-error, #ef4444)',
                                                        }}>
                                                            {pct}%
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{
                        textAlign: 'center', padding: '2rem',
                        color: 'var(--app-muted-foreground)',
                        borderRadius: 'var(--button-radius, 0.5rem)',
                        border: '1px dashed var(--app-border)',
                    }}>
                        <p style={{ margin: '0 0 0.5rem 0' }}>Coverage API not available</p>
                        <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>npx tsx scripts/i18n-coverage.ts</code>
                    </div>
                )}
            </div>

            {/* ── Info Card ── */}
            <div style={{
                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, var(--app-surface))',
                border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                borderRadius: 'var(--card-radius, 0.75rem)',
                padding: '1rem 1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <ArrowRight size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                </div>
                <div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600 }}>
                        Translations are stored in <code style={{ fontSize: '0.75rem' }}>messages/</code> directory
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>
                        Run <code>npx tsx scripts/i18n-coverage.ts</code> to check coverage from CLI. Add new namespaces as modules are migrated.
                    </p>
                </div>
            </div>
        </div>
    );
}
