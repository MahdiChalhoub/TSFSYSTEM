'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getExpiryAlerts(severity?: string, acknowledged = false) {
 const params = new URLSearchParams()
 if (severity) params.set('severity', severity)
 if (acknowledged) params.set('acknowledged', 'true')
 const qs = params.toString() ? `?${params.toString()}` : ''
 return await erpFetch(`inventory/expiry-alerts/${qs}`)
}

export async function scanForExpiry() {
 const result = await erpFetch('inventory/scan-expiry/', {
 method: 'POST',
 body: JSON.stringify({})
 })
 revalidatePath('/inventory/expiry-alerts')
 return result
}

export async function acknowledgeAlert(alertId: number) {
 const result = await erpFetch('inventory/acknowledge-alert/', {
 method: 'POST',
 body: JSON.stringify({ alert_id: alertId })
 })
 revalidatePath('/inventory/expiry-alerts')
 return result
}
