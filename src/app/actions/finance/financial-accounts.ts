'use server'

import { prisma } from "@/lib/db"

export async function getFinancialAccounts() {
    return await prisma.financialAccount.findMany({
        where: {}, // maybe isActive? Schema doesn't have isActive on FinancialAccount unless I missed it.
        orderBy: { name: 'asc' }
    })
}
