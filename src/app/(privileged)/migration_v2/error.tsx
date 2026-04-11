'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function MigrationV2Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="migration_v2" label="Migration V2" icon="Database" fallbackUrl="/migration_v2" accentColor="#F59E0B" />
}
