'use server'

import { revalidatePath } from "next/cache"
import { erpFetch } from "@/lib/erp-api"

export async function getPlans() {
    try {
        // Fetch URL matches backend endpoint
        return await erpFetch('saas/plans/')
    } catch (error: unknown) {
        console.error("[SaaS] Error fetching subscription plans:", error);
        return []
    }
}

export async function getPlanCategories() {
    try {
        return await erpFetch('saas/plans/categories/')
    } catch (error: unknown) {
        console.error("[SaaS] Error fetching plan categories:", error);
        return []
    }
}

export async function createPlan(data: Record<string, any>) {
    try {
        const result = await erpFetch('saas/plans/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/subscription-plans')
        return result
    } catch (error: unknown) {
        console.error("[SaaS] Created plan failed:", error);
        throw error;
    }
}

export async function createPlanCategory(data: Record<string, any>) {
    try {
        const result = await erpFetch('saas/plans/categories/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/subscription-plans')
        return result
    } catch (error: unknown) {
        console.error("[SaaS] Created plan category failed:", error);
        throw error;
    }
}
