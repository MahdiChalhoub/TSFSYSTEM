'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function HrError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="hr" label="HR" icon="UserCog" fallbackUrl="/hr" accentColor="#0EA5E9" />
}
