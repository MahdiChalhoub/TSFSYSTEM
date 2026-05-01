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
        setLocale(newLocale);
        document.cookie = `app_lang=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
        // Reloading ensures all components (including server-side rendered ones)
        // pick up the new language context if we choose to pass it to the backend.
        window.location.reload();
    };

    const isRtl = (RTL_LOCALES as readonly string[]).includes(locale);

    return { t, locale, switchLocale, isRtl };
}
