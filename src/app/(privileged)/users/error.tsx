'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function UsersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="users" label="Users" icon="Shield" fallbackUrl="/users" accentColor="var(--app-accent, #6366F1)" />
}
