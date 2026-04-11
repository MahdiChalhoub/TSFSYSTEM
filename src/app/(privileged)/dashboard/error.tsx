'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="dashboard" label="Dashboard" icon="BarChart3" fallbackUrl="/dashboard" fallbackLabel="Reload Dashboard" accentColor="var(--app-primary)" />
}
