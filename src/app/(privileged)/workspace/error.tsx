'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="workspace" label="Workspace" icon="Layout" fallbackUrl="/workspace" accentColor="#6366F1" />
}
