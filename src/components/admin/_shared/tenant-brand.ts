/**
 * Tenant branding — the bits of the current Organization we need to stamp on
 * print-outs. Fetched once per session from /api/organizations/me/, cached at
 * module scope so every PrintDialog open is instant.
 *
 * Fields mirror the Organization model subset that's useful on paper: name,
 * logo URL, contact + address. Settings.print_* keys let a tenant override
 * the letterhead without a code change (future-proofing).
 */

import { erpFetch } from '@/lib/erp-api';

export interface TenantBrand {
    name: string;
    logo?: string | null;
    businessEmail?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    /** Optional per-tenant print footer note, e.g. a trade register line. */
    printFooterNote?: string | null;
}

let cached: TenantBrand | null = null;
let inflight: Promise<TenantBrand | null> | null = null;

/** Fetch tenant brand once; subsequent callers share the resolved promise. */
export async function getTenantBrand(): Promise<TenantBrand | null> {
    if (cached) return cached;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const data: any = await erpFetch('organizations/me/');
            const settings = data?.settings || {};
            const brand: TenantBrand = {
                name: data?.name || '',
                logo: data?.logo || null,
                businessEmail: data?.business_email || null,
                phone: data?.phone || null,
                website: data?.website || null,
                address: data?.address || null,
                city: data?.city || null,
                state: data?.state || null,
                zipCode: data?.zip_code || null,
                country: data?.country || null,
                printFooterNote: settings?.print_footer_note || null,
            };
            cached = brand;
            return brand;
        } catch {
            return null;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** Single-line address like `123 Main St, Beirut, LB 1107`. */
export function formatAddress(b: TenantBrand): string {
    return [b.address, b.city, b.state, b.zipCode, b.country]
        .filter(Boolean)
        .join(', ');
}
