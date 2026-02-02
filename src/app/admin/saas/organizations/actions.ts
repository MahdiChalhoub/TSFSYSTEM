'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function getOrganizations() {
    return await (prisma.organization as any).findMany({
        include: {
            _count: {
                select: { sites: true, users: true }
            }
        },
        orderBy: { name: 'asc' }
    })
}

export async function createOrganization(data: { name: string, slug: string }) {
    try {
        return await prisma.$transaction(async (tx) => {
            // 1. Root Organization
            const org = await (tx.organization as any).create({
                data: {
                    name: data.name,
                    slug: data.slug,
                    isActive: true
                }
            })

            // 2. Default Site (Main Branch)
            const site = await tx.site.create({
                data: {
                    name: "Main Branch",
                    code: "MAIN",
                    address: "To be defined",
                    organizationId: org.id
                }
            })

            // 3. Initial Chart of Accounts Skeleton
            const coreAccounts = [
                { code: '1000', name: 'ASSETS', type: 'ASSET' },
                { code: '2000', name: 'LIABILITIES', type: 'LIABILITY' },
                { code: '3000', name: 'EQUITY', type: 'EQUITY' },
                { code: '4000', name: 'REVENUE', type: 'REVENUE' },
                { code: '5000', name: 'EXPENSES', type: 'EXPENSE' },
            ]

            for (const acc of coreAccounts) {
                await (tx.chartOfAccount as any).create({
                    data: {
                        code: acc.code,
                        name: acc.name,
                        type: acc.type,
                        organizationId: org.id
                    }
                })
            }

            revalidatePath('/admin/saas/organizations')
            revalidatePath('/admin/saas/dashboard')
            return org
        })
    } catch (error: any) {
        console.error("CRITICAL: Organization Provisioning Failed", error);
        throw error;
    }
}

export async function toggleOrganizationStatus(id: string, currentStatus: boolean) {
    await (prisma.organization as any).update({
        where: { id },
        data: { isActive: !currentStatus }
    })
    revalidatePath('/admin/saas/organizations')
}
