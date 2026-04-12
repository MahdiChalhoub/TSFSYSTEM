// @ts-nocheck
import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import MigrationPageClient from './MigrationPageClient'
import { erpFetch } from '@/lib/erp-api'

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

export default async function CoaMigrationPage() {
    const [accounts, templateList, templatesMap] = await Promise.all([
        getChartOfAccounts(true).catch(() => []),
        getTemplatesWithNames(),
        getAllTemplatesMap(),
    ])

    // Determine the current org's template origin (most common template_origin across accounts)
    const originCounts: Record<string, number> = {}
    for (const acc of accounts as any[]) {
        const o = acc.template_origin
        if (o) originCounts[o] = (originCounts[o] || 0) + 1
    }
    const currentTemplateKey = Object.entries(originCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-app-foreground mb-1">Account Migration</h1>
                <p className="text-app-muted-foreground text-sm tracking-widest uppercase">
                    Transform your chart of accounts without losing history
                </p>
            </div>
            <MigrationPageClient
                accounts={accounts}
                templatesMap={templatesMap}
                templateList={templateList}
                currentTemplateKey={currentTemplateKey || ''}
            />
        </div>
    )
}
