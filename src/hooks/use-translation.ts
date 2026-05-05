import { useState, useEffect } from 'react';
import { dictionaries, Locale, RTL_LOCALES } from '../translations/dictionaries';

/**
 * Lightweight i18n hook for TSFSYSTEM. Multi-locale, with English fallback.
 *
 * Lookup order for any key:
 *   1. dictionaries[currentLocale][...key]
 *   2. dictionaries.en[...key]            ← guarantees the UI never blanks out
 *   3. the key itself                      ← last-resort hint to translators
 *
 * This means: adding a new locale never breaks the UI. Half-translated locales
 * silently fall through to English; finished locales render natively.
 */
export function useTranslation() {
    const [locale, setLocale] = useState<Locale>('en');

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const cookies = document.cookie.split('; ');
        const langCookie = cookies.find(row => row.startsWith('app_lang='));
        if (langCookie) {
            const val = langCookie.split('=')[1] as Locale;
            if (dictionaries[val]) setLocale(val);
        }

        // Subscribe to cross-component locale changes — switchLocale() in
        // any other useTranslation() instance dispatches `app-lang-change`,
        // and every subscriber updates its own state without a page reload.
        const onLangChange = (e: Event) => {
            const code = (e as CustomEvent<string>).detail;
            if (code && dictionaries[code as Locale]) setLocale(code as Locale);
        };
        window.addEventListener('app-lang-change', onLangChange);
        return () => window.removeEventListener('app-lang-change', onLangChange);
    }, []);

    // Reflect direction on <html> when locale changes (RTL for ar, etc.)
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const dir = (RTL_LOCALES as readonly string[]).includes(locale) ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('dir', dir);
        document.documentElement.setAttribute('lang', locale);
    }, [locale]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function lookup(dict: any, parts: string[]): string | undefined {
        let cur: unknown = dict;
        for (const part of parts) {
            if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
                cur = (cur as Record<string, unknown>)[part];
            } else {
                return undefined;
            }
        }
        return typeof cur === 'string' ? cur : undefined;
    }

    /**
     * Translate a key using dot notation (e.g., 'crm.followup_board').
     * Falls back to English, then to the key itself.
     */
    const t = (path: string): string => {
        const parts = path.split('.');
        const localized = lookup(dictionaries[locale], parts);
        if (localized !== undefined) return localized;
        const fallback = lookup(dictionaries.en, parts);
        if (fallback !== undefined) return fallback;
        return path;
    };

    const switchLocale = (newLocale: Locale) => {
        if (typeof document === 'undefined') return;
        document.cookie = `app_lang=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
        setLocale(newLocale);
        // Notify any other useTranslation() consumers in this tab so they
        // update without a reload. The dictionary is purely client-side,
        // so no full reload is needed — setting state re-renders every
        // subscriber. The custom event covers cross-component instances
        // (each useTranslation() call has its own state).
        window.dispatchEvent(new CustomEvent('app-lang-change', { detail: newLocale }));
    };

    const isRtl = (RTL_LOCALES as readonly string[]).includes(locale);

    return { t, locale, switchLocale, isRtl };
}
