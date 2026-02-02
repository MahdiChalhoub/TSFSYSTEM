'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export type FinancialAccountInput = {
    name: string
    type: 'CASH' | 'BANK' | 'MOBILE'
    currency: string
    siteId?: number | null
}

import { serialize } from "@/lib/utils"

export async function getFinancialAccounts() {
    const accounts = await prisma.financialAccount.findMany({
        include: {
            site: true,
            ledgerAccount: true,
            assignedUsers: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' }
    })
    return serialize(accounts)
}

export async function createFinancialAccount(data: FinancialAccountInput) {
    // 1. Find Parent COA dynamically by SubType (CASH, BANK, MOBILE)
    const parent = await prisma.chartOfAccount.findFirst({
        where: { subType: data.type }
    });

    if (!parent) {
        throw new Error(`Accounting System Error: No Chart of Account found with subType "${data.type}". Please ensure your COA has a root account marked with this subType.`);
    }

    const parentCode = parent.code;

    const result = await prisma.$transaction(async (tx) => {
        // 2. Generate Next Code (e.g. 5700.001)
        const children = await tx.chartOfAccount.findMany({
            where: { code: { startsWith: `${parentCode}.` } },
            orderBy: { code: 'desc' },
            take: 1
        });

        let nextSuffix = 1;
        if (children.length > 0) {
            const lastCode = children[0].code;
            const parts = lastCode.split('.');
            const lastNum = parseInt(parts[parts.length - 1]);
            nextSuffix = isNaN(lastNum) ? 1 : lastNum + 1;
        }
        const nextCode = `${parentCode}.${nextSuffix.toString().padStart(3, '0')}`;

        // 3. Create Ledger Account Automatically
        const ledgerAccount = await tx.chartOfAccount.create({
            data: {
                code: nextCode,
                name: data.name,
                type: 'ASSET',
                parentId: parent.id,
                isSystemOnly: true,
                isActive: true,
                balance: 0
            }
        });

        // 4. Create Financial Account linked to it
        const financialAccount = await tx.financialAccount.create({
            data: {
                name: data.name,
                type: data.type,
                currency: data.currency,
                siteId: data.siteId,
                ledgerAccountId: ledgerAccount.id
            }
        });

        return { success: true, id: financialAccount.id, ledgerCode: nextCode };
    });

    revalidatePath('/admin/finance/accounts')
    return result;
}

export async function assignUserToAccount(userId: number, accountId: number) {
    await prisma.user.update({
        where: { id: userId },
        data: { cashRegisterId: accountId }
    })

    revalidatePath('/admin/finance/accounts')
    return { success: true }
}

export async function unassignUser(userId: number) {
    await prisma.user.update({
        where: { id: userId },
        data: { cashRegisterId: null }
    })

    revalidatePath('/admin/finance/accounts')
    return { success: true }
}

export async function deleteFinancialAccount(id: number) {
    const txCount = await prisma.transaction.count({
        where: { accountId: id }
    })
    if (txCount > 0) throw new Error("Cannot delete account with existing transactions.")

    await prisma.financialAccount.delete({ where: { id } })
    revalidatePath('/admin/finance/accounts')
    return { success: true }
}
