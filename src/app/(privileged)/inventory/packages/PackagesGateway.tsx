'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary'

const MobileClient = dynamic(
    () => import('./mobile/MobilePackagesClient').then(m => m.MobilePackagesClient),
    { ssr: false, loading: () => <GatewaySkeleton /> },
)

const DesktopClient = dynamic(
    () => import('./PackagesClient'),
    { ssr: false, loading: () => <GatewaySkeleton /> },
)

function GatewaySkeleton() {
    return (
        <div className="flex flex-col p-4 gap-3 animate-pulse" style={{ height: 'calc(100dvh - 6rem)' }}>
            <div className="h-10 w-1/2 rounded-lg bg-app-surface/40" />
            <div className="h-14 rounded-xl bg-app-surface/30" />
            <div className="h-10 rounded-xl bg-app-surface/30" />
            <div className="flex-1 space-y-2">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-app-surface/20" />
                ))}
            </div>
        </div>
    )
}

type PageProps = React.ComponentProps<typeof DesktopClient>

export function PackagesGateway(props: PageProps) {
    const isMobile = useIsMobile()
    return isMobile
        ? <MobileErrorBoundary><MobileClient {...props} /></MobileErrorBoundary>
        : <DesktopClient {...props} />
}
