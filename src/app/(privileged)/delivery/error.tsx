'use client'
import { ModuleErrorBoundary } from '@/components/errors/ModuleErrorBoundary'
export default function DeliveryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ModuleErrorBoundary error={error} reset={reset} scope="delivery" label="Delivery" icon="Truck" fallbackUrl="/delivery" accentColor="var(--app-info, #14B8A6)" />
}
