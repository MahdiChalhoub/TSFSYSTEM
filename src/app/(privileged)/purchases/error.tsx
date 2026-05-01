'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function PurchasesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="purchases" label="Purchases" icon="PackageCheck" fallbackUrl="/purchases" accentColor="var(--app-accent, #8B5CF6)" />
}
