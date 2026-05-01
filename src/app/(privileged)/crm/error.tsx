'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="crm" label="CRM" icon="Users" fallbackUrl="/crm/contacts" accentColor="var(--app-accent, #6366F1)" />
}
