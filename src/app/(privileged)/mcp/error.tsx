'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function McpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="mcp" label="Intelligence" icon="Brain" fallbackUrl="/mcp" accentColor="var(--app-accent, #8B5CF6)" />
}
