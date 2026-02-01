'use server'

import { prisma } from "@/lib/db"

export async function getContactsByType(type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER') {
    return await prisma.contact.findMany({
        where: { type },
        orderBy: { name: 'asc' }
    })
}

export async function searchContacts(query: string) {
    return await prisma.contact.findMany({
        where: {
            OR: [
                { name: { contains: query } },
                { email: { contains: query } },
                { phone: { contains: query } }
            ]
        },
        take: 20
    })
}
