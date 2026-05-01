'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"

export async function getDashboardStats() {
    try {
        return await erpFetch('activities/dashboard_stats/')
    } catch {
        return { due_today: 0, overdue: 0, upcoming: 0, completed_today: 0 }
    }
}

export async function getMyTasks(mode: string = 'my_tasks') {
    try {
        const data = await erpFetch(`activities/?mode=${mode}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (error) {
        handleAuthError(error)
        return []
    }
}
