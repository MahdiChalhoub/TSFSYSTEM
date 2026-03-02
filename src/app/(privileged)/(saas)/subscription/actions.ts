'use server'

import { revalidatePath } from "next/cache"
import { erpFetch } from "@/lib/erp-api"

export async function getSubscriptionPlans() {
 try {
 return await erpFetch('saas/plans/')
 } catch (error: unknown) {
 console.error("Error fetching plans:", error);
 return []
 }
}

export async function subscribeToPlan(planId: string) {
 try {
 const result = await erpFetch(`saas/plans/${planId}/subscribe/`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' }
 })
 revalidatePath('/subscription')
 revalidatePath('/dashboard')
 return result
 } catch (error: unknown) {
 console.error("Subscription failed:", error);
 throw error;
 }
}
