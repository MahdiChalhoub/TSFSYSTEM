'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getAssets() {
    return await erpFetch('assets/')
}

export async function getAsset(id: number) {
    return await erpFetch(`assets/${id}/`)
}

export async function getAssetSchedule(id: number) {
    return await erpFetch(`assets/${id}/schedule/`)
}

export type AssetInput = {
    name: string
    description?: string
    category: string
    purchase_value: number
    purchase_date: string
    useful_life_years: number
    residual_value?: number
    depreciation_method?: string
    source_account_id?: number
    asset_coa_id?: number
    depreciation_expense_coa_id?: number
    accumulated_depreciation_coa_id?: number
    scope?: string
}

export async function createAsset(data: AssetInput) {
    try {
        const asset = await erpFetch('assets/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/assets')
        return { success: true, id: asset.id }
    } catch (e: unknown) {
        console.error("Create Asset Failed", e)
        throw e
    }
}

export async function postDepreciation(assetId: number, scheduleId: number) {
    try {
        const result = await erpFetch(`assets/${assetId}/depreciate/${scheduleId}/`, {
            method: 'POST'
        })
        revalidatePath('/finance/assets')
        return { success: true, data: result }
    } catch (e: unknown) {
        console.error("Post Depreciation Failed", e)
        throw e
    }
}
