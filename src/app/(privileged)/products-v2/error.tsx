'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function ProductsV2Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="products_v2" label="Products V2" icon="Box" fallbackUrl="/products-v2" accentColor="#EC4899" />
}
