'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function ClientPortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="client_portal" label="Client Portal" icon="ExternalLink" fallbackUrl="/client_portal" accentColor="var(--app-info, #14B8A6)" />
}
