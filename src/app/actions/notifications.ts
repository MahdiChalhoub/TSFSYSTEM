'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ── Notification Preferences ─────────────────────────────────

export async function getNotificationPreferences() {
 return await erpFetch('notifications/preferences/')
}

export async function updateNotificationPreference(
 notification_type: string,
 channel: string,
 is_enabled: boolean
) {
 const result = await erpFetch('notifications/update-preference/', {
 method: 'POST',
 body: JSON.stringify({ notification_type, channel, is_enabled })
 })
 revalidatePath('/settings/notifications')
 return result
}

export async function getDeliveryLog() {
 return await erpFetch('notifications/delivery-log/')
}
