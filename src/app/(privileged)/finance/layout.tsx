import { getCOASetupStatus } from '@/app/actions/finance/coa-setup'
import { FinanceSetupGuard } from '@/components/finance/setup-guard'

export default async function FinanceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    let setupState = { status: 'COMPLETED' }
    try {
        setupState = await getCOASetupStatus()
    } catch {
        // If we can't fetch setup state, assume completed to avoid blocking
    }

    return (
        <FinanceSetupGuard setupState={setupState}>
            {children}
        </FinanceSetupGuard>
    )
}
