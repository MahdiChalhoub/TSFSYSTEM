'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function PlatformDashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="platform_dashboard" label="Platform" icon="LayoutDashboard" fallbackUrl="/platform-dashboard" accentColor="var(--app-primary)" />
}
