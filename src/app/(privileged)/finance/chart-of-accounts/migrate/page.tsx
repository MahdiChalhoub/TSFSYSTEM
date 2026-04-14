import { erpFetch } from '@/lib/erp-api'
import MigrationPageClient from './MigrationPageClient'

async function getTemplatesWithNames(): Promise<{ key: string; name: string }[]> {
    try {
        const data = await erpFetch('coa/templates/')
        return Array.isArray(data) ? data.map((t: any) => ({ key: t.key, name: t.name || t.key })) : []
    } catch {
        return []
    }
}

async function getCOAStatusData() {
    try {
        return await erpFetch('coa/coa_status/')
    } catch {
        return null
    }
}

export default async function CoaMigrationPage() {
    const [templateList, coaStatus] = await Promise.all([
        getTemplatesWithNames(),
        getCOAStatusData(),
    ])

    return (
        <MigrationPageClient
            templateList={templateList}
            currentTemplateKey={coaStatus?.current_template || ''}
            accountCount={coaStatus?.account_count || 0}
            journalEntryCount={coaStatus?.journal_entry_count || 0}
            hasData={coaStatus?.has_data || false}
        />
    )
}
