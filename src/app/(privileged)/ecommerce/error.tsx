'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function EcommerceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="ecommerce" label="eCommerce" icon="Globe" fallbackUrl="/ecommerce" accentColor="#F97316" />
}
