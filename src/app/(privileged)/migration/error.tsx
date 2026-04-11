'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function MigrationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="migration" label="Migration" icon="Database" fallbackUrl="/migration" accentColor="#F59E0B" />
}
