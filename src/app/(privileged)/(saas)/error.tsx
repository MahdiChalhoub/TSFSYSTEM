'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function SaasError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="saas" label="SaaS Admin" icon="Building2" fallbackUrl="/dashboard" accentColor="var(--app-primary)" />
}
