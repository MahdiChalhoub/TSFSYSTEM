import { getCOASetupStatus } from '@/app/actions/finance/coa-setup'
import { COASetupWizard } from './wizard'

async function getAccountCount(): Promise<number> {
    try {
        // Use dynamic import to avoid server component issues
        const { erpFetch } = await import('@/lib/erp-api')
        const data = await erpFetch('finance/chart-of-accounts/')
        if (Array.isArray(data)) return data.length
        if (data?.results) return data.results.length
        if (data?.count !== undefined) return data.count
        return 0
    } catch {
        return 0
    }
}

export default async function COASetupPage() {
    let setupState = { status: 'NOT_STARTED' as const, selectedTemplate: null, importedAt: null, postingRulesConfigured: false, migrationNeeded: false, migrationCompleted: false, completedAt: null }
    let accountCount = 0

    try {
        setupState = await getCOASetupStatus()
    } catch { /* default state */ }

    try {
        accountCount = await getAccountCount()
    } catch { /* 0 accounts */ }

    return <COASetupWizard initialState={setupState} existingAccountCount={accountCount} />
}
