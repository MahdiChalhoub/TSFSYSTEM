'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"


// ── Stock Alerts ─────────────────────────────────────────────

export async function getStockAlerts(status?: string, alertType?: string, severity?: string) {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (alertType) params.append('alert_type', alertType)
    if (severity) params.append('severity', severity)
    const qs = params.toString()
    return await erpFetch(`stock-alerts/${qs ? `?${qs}` : ''}`)
}

export async function getStockAlert(id: number | string) {
    return await erpFetch(`stock-alerts/${id}/`)
}

export async function acknowledgeAlert(id: number | string) {
    const result = await erpFetch(`stock-alerts/${id}/acknowledge/`, { method: 'POST' })
    revalidatePath('/inventory/alerts')
    return result
}

export async function resolveAlert(id: number | string, note?: string) {
    const result = await erpFetch(`stock-alerts/${id}/resolve/`, {
        method: 'POST',
        body: JSON.stringify({ note: note || '' })
    })
    revalidatePath('/inventory/alerts')
    return result
}

export async function snoozeAlert(id: number | string, until: string) {
    const result = await erpFetch(`stock-alerts/${id}/snooze/`, {
        method: 'POST',
        body: JSON.stringify({ until })
    })
    revalidatePath('/inventory/alerts')
    return result
}

export async function scanAllStock() {
    const result = await erpFetch('stock-alerts/scan-all/', { method: 'POST' })
    revalidatePath('/inventory/alerts')
    return result
}

export async function getAlertDashboard() {
    return await erpFetch('stock-alerts/dashboard/')
}
