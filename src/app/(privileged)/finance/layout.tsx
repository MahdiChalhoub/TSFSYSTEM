import { getCOASetupStatus } from '@/app/actions/finance/coa-setup'
import { FinanceSetupGuard } from '@/components/finance/setup-guard'

export default async function FinanceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Default to COMPLETED so finance is fully accessible if status check fails.
    // This is the safe default — it never blocks users unnecessarily.
    let setupStatus = 'COMPLETED'

    try {
        const state = await getCOASetupStatus()
        if (state && state.status) {
            setupStatus = state.status
        }
    } catch {
        // Backend not ready, no tenant context, or new endpoint not deployed yet.
        // Default to COMPLETED to avoid blocking the entire finance module.
    }

    return (
        <FinanceSetupGuard setupState={{ status: setupStatus }}>
            {children}
        </FinanceSetupGuard>
    )
}
