// @ts-nocheck
import { erpFetch } from '@/lib/erp-api'
import TemplatesPageClient from './TemplatesPageClient'

async function getTemplatesWithNames(): Promise<{ key: string; name: string }[]> {
    try {
        const data = await erpFetch('coa/templates/')
        return Array.isArray(data) ? data.map((t: any) => ({ key: t.key, name: t.name || t.key })) : []
    } catch {
        return []
    }
}

async function getAllTemplatesMap(): Promise<Record<string, any>> {
    try {
        const data = await erpFetch('coa/templates/')
        const result: Record<string, any> = {}
        if (Array.isArray(data)) {
            for (const t of data) { result[t.key] = t.accounts }
        }
        return result
    } catch {
        return {}
    }
}

export default async function TemplatesLibraryPage() {
    const [templateList, templatesMap] = await Promise.all([
        getTemplatesWithNames(),
        getAllTemplatesMap(),
    ])
    return <TemplatesPageClient templateList={templateList} templatesMap={templatesMap} />
}
