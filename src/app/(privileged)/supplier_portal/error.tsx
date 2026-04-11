'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function SupplierPortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="supplier_portal" label="Supplier Portal" icon="Handshake" fallbackUrl="/supplier_portal" accentColor="#0EA5E9" />
}
