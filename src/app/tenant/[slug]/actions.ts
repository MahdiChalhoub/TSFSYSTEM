'use server'

import { prisma } from "@/lib/db"

/**
 * Fetches organization data by slug to establish tenant context.
 * Used for routing, branding, and security isolation.
 */
export async function getOrganizationBySlug(slug: string) {
    try {
        const org = await (prisma.organization as any).findUnique({
            where: { slug },
            include: {
                _count: {
                    select: { sites: true, users: true }
                }
            }
        })

        if (!org) return null
        if (!org.isActive) return { ...org, error: "ACCOUNT_SUSPENDED" }

        return org
    } catch (error) {
        console.error("[TENANT_CONTEXT] Failed to fetch org:", error)
        return null
    }
}

/**
 * Validates if the current request is coming from a valid tenant.
 */
export async function validateTenantAccess(slug: string) {
    const org = await getOrganizationBySlug(slug)
    if (!org || (org as any).error) return false
    return true
}
