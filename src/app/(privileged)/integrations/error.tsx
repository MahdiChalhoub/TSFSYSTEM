'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function IntegrationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="integrations" label="Integrations" icon="Plug" fallbackUrl="/integrations" accentColor="#0EA5E9" />
}
