// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary'

const MobileClient = dynamic(
    () => import('./mobile/MobileMigrateClient').then(m => m.MobileMigrateClient),
    { ssr: false, loading: () => <Skeleton /> }
)

const DesktopClient = dynamic(
    () => import('./MigrationPageClient'),
    { ssr: false, loading: () => <Skeleton /> }
)

function Skeleton() {
    return (
        <div className="flex flex-col p-4 gap-3 animate-pulse" style={{ height: 'calc(100dvh - 6rem)' }}>
            <div className="h-10 w-1/2 rounded-lg bg-app-surface/40" />
            <div className="h-28 rounded-2xl bg-app-surface/30" />
            <div className="h-28 rounded-2xl bg-app-surface/30" />
            <div className="h-14 rounded-2xl bg-app-surface/20" />
        </div>
    )
}

export function MigrateGateway(props: any) {
    const isMobile = useIsMobile()
    return isMobile
        ? <MobileErrorBoundary><MobileClient {...props} /></MobileErrorBoundary>
        : <DesktopClient {...props} />
}
