'use server'

import { revalidatePath } from 'next/cache'

/**
 * COA Templates — Database-Driven
 * All template data is stored in the database (COATemplate model).
 * Seeded via: python manage.py seed_coa_templates
 * 
 * The frontend reads templates from the API, never from hardcoded data.
 */

export async function importChartOfAccountsTemplate(templateKey: string, options?: { reset?: boolean }) {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch('coa/apply_template/', {
            method: 'POST',
            body: JSON.stringify({
                template_key: templateKey,
                reset: options?.reset || false
            })
        })

        try {
            revalidatePath('/finance/chart-of-accounts')
        } catch (e) {
            // Ignore
        }
        return { success: true }
    } catch (error) {
        console.error(`[COA_TEMPLATE] Import failed:`, error)
        throw error
    }
}

export async function getAllTemplates(): Promise<Record<string, any>> {
    const { erpFetch } = await import('@/lib/erp-api')
    const data = await erpFetch('coa/templates/')

    // Transform array response into {key: accounts} map for the viewer
    const result: Record<string, any> = {}
    for (const template of data) {
        result[template.key] = template.accounts
    }
    return result
}

export async function getTemplatePreview(templateKey: string) {
    const templates = await getAllTemplates()
    return templates[templateKey] || []
}

/**
 * MAPPING TOOL (Advanced)
 * Moves all balances from old accounts to new ones and deactivates old ones.
 */
export async function migrateBalances(data: { mappings: Record<string, any>[], description: string }) {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('coa/migrate/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    } catch (error) {
        console.error(`[COA_MIGRATE] Migration failed:`, error)
        throw error
    }
}
