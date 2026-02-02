'use server'

import { prisma } from "@/lib/db"

export async function getChartOfAccountsList() {
    return await prisma.chartOfAccount.findMany({
        where: { isActive: true }, // Add checking for 'isLeaf' if schema has it? Or assume all can be posted to?
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, type: true }
    })
}

export async function getUsersList() {
    return await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true }
    })
}
