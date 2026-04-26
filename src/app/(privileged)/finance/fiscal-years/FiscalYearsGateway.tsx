'use client'

/**
 * Routing gateway: same data, two viewers — mobile vs desktop. Mirrors
 * the COAGateway pattern. Both viewers receive the same `initialYears`
 * payload from the server component; the gateway picks based on the
 * `useIsMobile` hook (viewport width < 768).
 */
import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary'

// Desktop viewer — heavy, dynamic-imported so mobile users don't pay for it.
const DesktopViewer = dynamic(
    () => import('./viewer').then(m => m.default),
    { ssr: false, loading: () => <Skeleton /> },
)

const MobileClient = dynamic(
    () => import('./mobile/MobileFiscalYearsClient').then(m => m.MobileFiscalYearsClient),
    { ssr: false, loading: () => <Skeleton /> },
)

function Skeleton() {
    return (
        <div className="flex flex-col p-4 gap-3 animate-pulse" style={{ height: 'calc(100dvh - 6rem)' }}>
            <div className="h-10 w-1/2 rounded-lg bg-app-surface/40" />
            <div className="h-14 rounded-xl bg-app-surface/30" />
            <div className="flex-1 space-y-2">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-app-surface/20" />
                ))}
            </div>
        </div>
    )
}

export function FiscalYearsGateway({ initialYears }: { initialYears: any[] }) {
    const isMobile = useIsMobile()
    return isMobile
        ? <MobileErrorBoundary><MobileClient initialYears={initialYears} /></MobileErrorBoundary>
        : <DesktopViewer initialYears={initialYears} />
}
