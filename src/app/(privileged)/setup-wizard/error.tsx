'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function SetupWizardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="setup_wizard" label="Setup Wizard" icon="Wand2" fallbackUrl="/setup-wizard" accentColor="var(--app-primary)" />
}
