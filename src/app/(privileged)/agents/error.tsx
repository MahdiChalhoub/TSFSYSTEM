'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function AgentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="agents" label="Agents" icon="Bot" fallbackUrl="/agents" accentColor="var(--app-accent, #8B5CF6)" />
}
