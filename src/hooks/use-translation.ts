import { useState, useEffect } from 'react';
import { dictionaries, Locale } from '../translations/dictionaries';

/**
 * Lightweight i18n hook for TSFSYSTEM.
 * Supports English and French with a simple dot-notation access.
 * Defaults to 'en' to maintain consistency across the app.
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

    /**
     * Translate a key using dot notation (e.g., 'crm.followup_board')
     */
    const t = (path: string): string => {
        const parts = path.split('.');
        let result: any = dictionaries[locale];

        for (const part of parts) {
            if (result && typeof result === 'object' && part in result) {
                result = result[part];
            } else {
                return path; // Fallback: return the key itself
            }
        }

        return typeof result === 'string' ? result : path;
    };

    const switchLocale = (newLocale: Locale) => {
        if (typeof document === 'undefined') return;
        setLocale(newLocale);
        document.cookie = `app_lang=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
        // Reloading ensures all components (including server-side rendered ones)
        // pick up the new language context if we choose to pass it to the backend.
        window.location.reload();
    };

    return { t, locale, switchLocale };
}
