'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SiteState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
    };
};

export async function getSites() {
    return await prisma.site.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { warehouses: true, users: true }
            }
        }
    });
}

/**
 * Ensures at least one site exists and links all orphan records to it.
 * This is vital for migrating existing data to the Multi-Site architecture.
 */
export async function initializeMultiSite() {
    try {
        let mainSite = await prisma.site.findFirst({
            where: { OR: [{ name: 'Main Store' }, { code: 'MAIN' }] }
        });

        if (!mainSite) {
            mainSite = await prisma.site.create({
                data: {
                    name: 'Main Store',
                    code: 'MAIN',
                    isActive: true
                }
            });
        }

        const siteId = mainSite.id;

        // Link Orphan Records
        await prisma.warehouse.updateMany({ where: { siteId: null }, data: { siteId } });
        await prisma.user.updateMany({ where: { homeSiteId: null }, data: { homeSiteId: siteId } });
        await prisma.order.updateMany({ where: { siteId: null }, data: { siteId } });
        await prisma.transaction.updateMany({ where: { siteId: null }, data: { siteId } });
        await prisma.journalEntry.updateMany({ where: { siteId: null }, data: { siteId } });
        await prisma.financialAccount.updateMany({ where: { siteId: null }, data: { siteId } });

        return { success: true, siteId };
    } catch (e: any) {
        console.error("Failed to initialize Multi-Site:", e);
        return { success: false, message: e.message };
    }
}

export async function createSite(prevState: SiteState, formData: FormData): Promise<SiteState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const phone = formData.get('phone') as string;
    const vatNumber = formData.get('vatNumber') as string;
    const isActive = formData.get('isActive') === 'on';

    if (!name || name.length < 2) {
        return { message: 'Validation Error', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await prisma.site.create({
            data: {
                name,
                code: code?.toUpperCase(),
                address,
                city,
                phone,
                vatNumber,
                isActive
            }
        });

        revalidatePath('/admin/settings/sites');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message };
    }
}

export async function updateSite(id: number, prevState: SiteState, formData: FormData): Promise<SiteState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const phone = formData.get('phone') as string;
    const vatNumber = formData.get('vatNumber') as string;
    const isActive = formData.get('isActive') === 'on';

    try {
        await prisma.site.update({
            where: { id },
            data: {
                name,
                code: code?.toUpperCase(),
                address,
                city,
                phone,
                vatNumber,
                isActive
            }
        });

        revalidatePath('/admin/settings/sites');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message };
    }
}

export async function deleteSite(id: number) {
    try {
        // Check for dependencies
        const count = await prisma.site.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { warehouses: true, orders: true }
                }
            }
        });

        if (count?._count.warehouses || count?._count.orders) {
            throw new Error("Cannot delete site with active warehouses or orders. Please move or delete them first.");
        }

        await prisma.site.delete({ where: { id } });
        revalidatePath('/admin/settings/sites');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
