'use server'

import { erpFetch } from "@/lib/erp-fetch"

export async function getKernelInfo() {
 const res = await erpFetch('kernel/')
 if (!res.ok) {
 const error = await res.json().catch(() => ({ error: 'Failed to fetch kernel info' }))
 return { error: error.error || error.detail || 'Unknown error' }
 }
 return res.json()
}

export async function getKernelVersion() {
 const res = await erpFetch('kernel/version/')
 if (!res.ok) {
 return { version: 'Unknown' }
 }
 return res.json()
}

export async function stageKernelUpdate(formData: FormData) {
 const res = await erpFetch('kernel/stage/', {
 method: 'POST',
 body: formData,
 })
 if (!res.ok) {
 const error = await res.json().catch(() => ({ error: 'Failed to stage update' }))
 return { error: error.error || error.detail || 'Unknown error' }
 }
 return res.json()
}

export async function applyKernelUpdate(updateId: number) {
 const res = await erpFetch(`/api/kernel/${updateId}/apply/`, {
 method: 'POST',
 })
 if (!res.ok) {
 const error = await res.json().catch(() => ({ error: 'Failed to apply update' }))
 return { error: error.error || error.detail || 'Unknown error' }
 }
 return res.json()
}
