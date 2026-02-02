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
    const org = await (prisma.organization as any).create({
        data: {
            name: data.name,
            slug: data.slug,
            isActive: true
        }
    })
    revalidatePath('/admin/saas/organizations')
    return org
}

export async function toggleOrganizationStatus(id: string, currentStatus: boolean) {
    await (prisma.organization as any).update({
        where: { id },
        data: { isActive: !currentStatus }
    })
    revalidatePath('/admin/saas/organizations')
}
