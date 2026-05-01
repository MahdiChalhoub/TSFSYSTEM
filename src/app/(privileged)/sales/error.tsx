'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function SalesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="sales" label="Sales" icon="ShoppingCart" fallbackUrl="/sales" accentColor="var(--app-primary, #10B981)" />
}
