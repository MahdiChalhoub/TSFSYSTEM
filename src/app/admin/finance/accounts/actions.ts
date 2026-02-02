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

import { erpFetch } from "@/lib/erp-api"

export async function getFinancialAccounts() {
    try {
        return await erpFetch('accounts/')
    } catch (error) {
        console.error("Failed to fetch financial accounts:", error)
        return []
    }
}

export async function createFinancialAccount(data: FinancialAccountInput) {
    try {
        const result = await erpFetch('accounts/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        revalidatePath('/admin/finance/accounts')
        return { success: true, id: result.id, ledgerCode: result.ledger_code }
    } catch (error: any) {
        console.error("Failed to create financial account:", error)
        throw error
    }
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
