/**
 * Kernel: Tenant Resolution Layer
 * 
 * Wraps existing tenant context logic into a clean Kernel API.
 * 
 * Usage:
 *   import { Kernel } from '@/kernel'
 *   const ctx = await Kernel.tenant.getContext()
 *   const slug = await Kernel.tenant.getSlug()
 */

import { getTenantContext } from '@/lib/erp-api';
import type { TenantContext } from './types';

/** Get full tenant context for the current request */
export async function getContext(): Promise<TenantContext> {
    const ctx = await getTenantContext();
    if (!ctx) {
        return { tenant: '', slug: '', orgId: null, orgName: null };
    }
    return {
        tenant: (ctx as any).tenant ?? '',
        slug: ctx.slug ?? '',
        orgId: (ctx as any).orgId ?? null,
        orgName: (ctx as any).orgName ?? null,
    };
}

/** Get the current tenant slug */
export async function getSlug(): Promise<string> {
    const ctx = await getContext();
    return ctx.slug;
}

/** Check if the current request is in SaaS admin context */
export async function isSaaSContext(): Promise<boolean> {
    const slug = await getSlug();
    return slug === 'saas';
}

/** Check if the current request has a valid organization context */
export async function hasOrganization(): Promise<boolean> {
    const ctx = await getContext();
    return ctx.orgId !== null;
}
