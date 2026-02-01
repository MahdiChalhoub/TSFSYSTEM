'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function calculateProductPrice(productId: number, customerGroupId?: number) {
    // 1. Get Product Baseline
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { productGroup: true }
    })

    if (!product) throw new Error('Product not found')

    // Default Price (Fallback)
    let finalPrice = Number(product.sellingPriceTTC)
    let appliedRule = null

    // 2. Find Applicable Rules
    // Priority: Specific Customer Group > General Promotion > Default

    const rules = await prisma.pricingRule.findMany({
        where: {
            OR: [
                { productId: productId },
                { productGroupId: product.productGroupId },
                { categoryId: product.categoryId }
            ],
            // If customerGroupId provided, filter for it OR null (global rules)
            // This logic needs refinement based on specific priority requirements
        },
        orderBy: { priority: 'desc' },
        include: { priceList: true }
    })

    // 3. Apply Highest Priority Rule (Simplified Logic)
    for (const rule of rules) {
        // Skip if customer group mismatch
        if (rule.customerGroupId && rule.customerGroupId !== customerGroupId) continue

        // Apply logic
        if (rule.adjustmentType === 'FIXED_PRICE') {
            finalPrice = Number(rule.value)
        } else if (rule.adjustmentType === 'PERCENTAGE') {
            // Assuming discount percentage
            finalPrice = finalPrice * (1 - (Number(rule.value) / 100))
        } else if (rule.adjustmentType === 'FIXED_DISCOUNT') {
            finalPrice = finalPrice - Number(rule.value)
        }

        appliedRule = rule
        break // Stop after highest priority rule applied
    }

    return {
        basePrice: Number(product.sellingPriceTTC),
        finalPrice: Math.max(0, finalPrice), // No negative prices
        appliedRule: appliedRule
    }
}

export async function getPriceLists() {
    return await prisma.priceList.findMany({
        include: { rules: true }
    })
}

export async function createPriceList(name: string) {
    await prisma.priceList.create({
        data: { name }
    })
    revalidatePath('/admin/finance/pricing')
}
