'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function MarketplaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="marketplace" label="Marketplace" icon="Store" fallbackUrl="/marketplace" accentColor="var(--app-warning, #F97316)" />
}
