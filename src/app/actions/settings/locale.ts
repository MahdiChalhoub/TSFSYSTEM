'use server';

import { cookies } from 'next/headers';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/i18n/request';
import type { SupportedLocale } from '@/i18n/request';

/**
 * Get the current user's locale from the cookie.
 */
export async function getLocaleAction(): Promise<SupportedLocale> {
    const store = await cookies();
    const raw = store.get('tsf-locale')?.value || DEFAULT_LOCALE;
    return SUPPORTED_LOCALES.includes(raw as SupportedLocale)
        ? (raw as SupportedLocale)
        : DEFAULT_LOCALE;
}

/**
 * Set the user's preferred locale.
 * Writes a `tsf-locale` cookie that's read by the i18n request config.
 */
export async function setLocaleAction(locale: string): Promise<{ success: boolean; locale: string }> {
    if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
        return { success: false, locale: DEFAULT_LOCALE };
    }

    const store = await cookies();
    store.set('tsf-locale', locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
        httpOnly: false, // Readable by client JS for instant UI updates
    });

    return { success: true, locale };
}

/**
 * Get all supported locales with display names.
 */
export async function getSupportedLocalesAction() {
    const LOCALE_META: Record<SupportedLocale, { name: string; nativeName: string; dir: 'ltr' | 'rtl'; flag: string }> = {
        en: { name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧' },
        fr: { name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
        ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
    };

    const current = await getLocaleAction();

    return {
        current,
        locales: SUPPORTED_LOCALES.map(code => ({
            code,
            ...LOCALE_META[code],
            active: code === current,
        })),
    };
}
