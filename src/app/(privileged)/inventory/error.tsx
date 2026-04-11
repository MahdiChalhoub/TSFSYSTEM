'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="inventory" label="Inventory" icon="PackageOpen" fallbackUrl="/inventory/stock-ledger" fallbackLabel="Back to Stock Ledger" accentColor="#F97316" />
}
