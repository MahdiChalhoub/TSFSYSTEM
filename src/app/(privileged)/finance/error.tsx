'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="finance" label="Finance" icon="Wallet" fallbackUrl="/finance/account-book" fallbackLabel="Back to Ledger" accentColor="#EF4444" />
}
