import { erpFetch } from '@/lib/erp-api'
import TemplatesPageClient from './TemplatesPageClient'

// Fetch from the rich db-templates endpoint
async function getDbTemplates(): Promise<any[]> {
    try {
        const data = await erpFetch('coa/db-templates/')
        return Array.isArray(data) ? data : []
    } catch {
        return []
    }
}

async function getTemplateDetail(key: string): Promise<any> {
    try {
        return await erpFetch(`coa/db-templates/${key}/`)
    } catch {
        return null
    }
}

export default async function TemplatesLibraryPage() {
    const templates = await getDbTemplates()

    // Fetch full accounts for each template in parallel
    const details = await Promise.all(
        templates.map(t => getTemplateDetail(t.key))
    )

    const templatesMap: Record<string, any> = {}
    for (const d of details) {
        if (d && d.key) {
            templatesMap[d.key] = d
        }
    }

    return <TemplatesPageClient templates={templates} templatesMap={templatesMap} />
}
