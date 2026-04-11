'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function ProductsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="products" label="Products" icon="Box" fallbackUrl="/products" accentColor="#EC4899" />
}
