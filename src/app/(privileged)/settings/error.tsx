'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="settings" label="Settings" icon="Settings" fallbackUrl="/settings" accentColor="var(--app-muted-foreground)" />
}
