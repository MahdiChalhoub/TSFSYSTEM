// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary'

const MobileClient = dynamic(
    () => import('./mobile/MobileLedgerClient').then(m => m.MobileLedgerClient),
    { ssr: false, loading: () => <Skeleton /> }
)

const DesktopClient = dynamic(
    () => import('./manager'),
    { ssr: false, loading: () => <Skeleton /> }
)

function Skeleton() {
    return (
        <div className="flex flex-col p-4 gap-3 animate-pulse" style={{ height: 'calc(100dvh - 6rem)' }}>
            <div className="h-10 w-1/2 rounded-lg bg-app-surface/40" />
            <div className="h-14 rounded-xl bg-app-surface/30" />
            <div className="flex-1 space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-app-surface/20" />
                ))}
            </div>
        </div>
    )
}

export function LedgerGateway() {
    const isMobile = useIsMobile()
    return isMobile
        ? <MobileErrorBoundary><MobileClient /></MobileErrorBoundary>
        : <DesktopClient />
}
