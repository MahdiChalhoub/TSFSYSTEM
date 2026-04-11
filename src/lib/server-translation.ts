import { cookies as nextCookies } from 'next/headers';
import { dictionaries, Locale } from '../translations/dictionaries';

/**
 * Server-side translation utility for TSFSYSTEM.
 * Retrieves the locale from 'app_lang' cookie or defaults to 'en'.
 */
export async function getTranslation() {
    const cookieStore = await nextCookies();
    const localeRaw = cookieStore.get('app_lang')?.value as Locale;
    const locale = (localeRaw && dictionaries[localeRaw]) ? localeRaw : 'en';

    /**
     * Translate a key using dot notation
     */
    const t = (path: string): string => {
        const parts = path.split('.');
        let result: any = dictionaries[locale];

        for (const part of parts) {
            if (result && typeof result === 'object' && part in result) {
                result = result[part];
            } else {
                return path; // Fallback
            }
        }

        return typeof result === 'string' ? result : path;
    };

    return { t, locale };
}
