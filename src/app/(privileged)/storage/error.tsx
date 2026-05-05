'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function StorageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="storage" label="Storage" icon="HardDrive" fallbackUrl="/storage" accentColor="var(--app-muted-foreground, #64748B)" />
}
