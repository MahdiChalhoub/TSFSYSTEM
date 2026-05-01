'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function ApprovalsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="approvals" label="Approvals" icon="CheckCircle" fallbackUrl="/approvals" accentColor="var(--app-primary, #10B981)" />
}
