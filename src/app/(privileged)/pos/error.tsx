'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function PosError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="pos" label="Point of Sale" icon="Monitor" fallbackUrl="/pos" accentColor="#F59E0B" />
}
