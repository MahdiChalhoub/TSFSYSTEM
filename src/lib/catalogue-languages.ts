'use client';

/**
 * Tenant-wide list of catalogue locales.
 * Stored in Organization.settings.catalogue_languages on the backend.
 * The /inventory/categories form renders one translation input per code.
 */

import { erpFetch } from '@/lib/erp-api';

export type LocaleCode = string; // free-form, ISO 639-1 recommended

const KNOWN_LABELS: Record<string, { label: string; rtl?: boolean; placeholder: string }> = {
    fr: { label: 'Nom (FR)', placeholder: 'e.g. Boissons' },
    ar: { label: 'الاسم (AR)', placeholder: 'مثال: المشروبات', rtl: true },
    en: { label: 'Name (EN)', placeholder: 'e.g. Beverages' },
    es: { label: 'Nombre (ES)', placeholder: 'e.g. Bebidas' },
    de: { label: 'Name (DE)', placeholder: 'e.g. Getränke' },
    it: { label: 'Nome (IT)', placeholder: 'e.g. Bevande' },
    pt: { label: 'Nome (PT)', placeholder: 'e.g. Bebidas' },
    nl: { label: 'Naam (NL)', placeholder: 'e.g. Dranken' },
    tr: { label: 'İsim (TR)', placeholder: 'ör. İçecekler' },
    ru: { label: 'Название (RU)', placeholder: 'например, Напитки' },
    zh: { label: '名称 (ZH)', placeholder: '例如：饮料' },
    ja: { label: '名前 (JA)', placeholder: '例：飲み物' },
    he: { label: 'שם (HE)', placeholder: 'למשל: משקאות', rtl: true },
    fa: { label: 'نام (FA)', placeholder: 'مثال: نوشیدنی‌ها', rtl: true },
    ur: { label: 'نام (UR)', placeholder: 'مثال: مشروبات', rtl: true },
};

export function labelFor(code: LocaleCode): string {
    return KNOWN_LABELS[code]?.label ?? `Name (${code.toUpperCase()})`;
}
export function placeholderFor(code: LocaleCode): string {
    return KNOWN_LABELS[code]?.placeholder ?? '';
}
export function isRTL(code: LocaleCode): boolean {
    return !!KNOWN_LABELS[code]?.rtl;
}

export async function getCatalogueLanguages(): Promise<LocaleCode[]> {
    try {
        const res: any = await erpFetch('inventory/categories/catalogue-languages/');
        return Array.isArray(res?.languages) ? res.languages : ['fr', 'ar'];
    } catch {
        return ['fr', 'ar'];
    }
}

export async function setCatalogueLanguages(codes: LocaleCode[]): Promise<LocaleCode[]> {
    const res: any = await erpFetch('inventory/categories/catalogue-languages/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languages: codes }),
    });
    return Array.isArray(res?.languages) ? res.languages : codes;
}

/** Rich shape — locale code plus the list of OrgCountry FK ids the language
 *  is restricted to. Empty country_ids = "active in every enabled country". */
export interface CatalogueLanguageEntry {
    code: LocaleCode;
    country_ids: number[];
}

export async function getCatalogueLanguageEntries(): Promise<CatalogueLanguageEntry[]> {
    try {
        const res: any = await erpFetch('inventory/categories/catalogue-languages/');
        if (Array.isArray(res?.entries)) return res.entries;
        if (Array.isArray(res?.languages)) {
            return res.languages.map((c: string) => ({ code: c, country_ids: [] as number[] }));
        }
    } catch { /* fall through */ }
    return [{ code: 'fr', country_ids: [] }, { code: 'ar', country_ids: [] }];
}

export async function setCatalogueLanguageEntries(entries: CatalogueLanguageEntry[]): Promise<CatalogueLanguageEntry[]> {
    const res: any = await erpFetch('inventory/categories/catalogue-languages/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
    });
    return Array.isArray(res?.entries) ? res.entries : entries;
}
