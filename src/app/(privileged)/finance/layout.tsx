import { getCOASetupStatus } from '@/app/actions/finance/coa-setup'
import { FinanceSetupGuard } from '@/components/finance/setup-guard'
// Period warning banner is now in the main privileged layout (shows everywhere)

export default async function FinanceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    let setupStatus = 'COMPLETED'

    try {
        const state = await getCOASetupStatus()
        if (state && state.status) {
            setupStatus = state.status
        }
    } catch {
        // Default to COMPLETED to avoid blocking the entire finance module.
    }

    return (
        <FinanceSetupGuard setupState={{ status: setupStatus }}>
            {children}
        </FinanceSetupGuard>
    )
}
