import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

/**
 * TSFSYSTEM i18n Request Configuration
 * =====================================
 * Resolves the current user's locale from the `tsf-locale` cookie
 * and loads the corresponding namespace JSON files.
 *
 * Cookie-based (no URL routing) — fits our subdomain multi-tenancy
 * where adding [locale] path segments would break every URL.
 *
 * Namespaces are merged into a flat messages object so components
 * can use `useTranslations('Sidebar')` or `useTranslations('Common')`.
 */

export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export default getRequestConfig(async () => {
    const store = await cookies();
    const raw = store.get('tsf-locale')?.value || DEFAULT_LOCALE;
    const locale: SupportedLocale = SUPPORTED_LOCALES.includes(raw as SupportedLocale)
        ? (raw as SupportedLocale)
        : DEFAULT_LOCALE;

    // ── Load all namespace files for this locale ──
    // Each namespace is a separate JSON file under messages/{locale}/
    // Add new namespaces here as modules are migrated to i18n.
    const [common, sidebar] = await Promise.all([
        import(`../../messages/${locale}/common.json`).then(m => m.default).catch(() => ({})),
        import(`../../messages/${locale}/sidebar.json`).then(m => m.default).catch(() => ({})),
    ]);

    return {
        locale,
        messages: {
            ...common,
            ...sidebar,
        },
    };
});
