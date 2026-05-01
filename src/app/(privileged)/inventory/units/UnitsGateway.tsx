'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary'

const MobileClient = dynamic(
    () => import('./mobile/MobileUnitsClient').then(m => m.MobileUnitsClient),
    { ssr: false, loading: () => <GatewaySkeleton /> }
)

const DesktopClient = dynamic(
    () => import('./UnitsClient'),
    { ssr: false, loading: () => <GatewaySkeleton /> }
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

type GatewayUnit = {
    id: number
    name: string
    code?: string
    short_name?: string
    type?: string
    base_unit?: number | null
    conversion_factor?: number
    needs_balance?: boolean
    product_count?: number
    package_count?: number
    [key: string]: unknown
}

export function UnitsGateway({ initialUnits }: { initialUnits: GatewayUnit[] }) {
    const isMobile = useIsMobile()
    return isMobile
        ? <MobileErrorBoundary><MobileClient initialUnits={initialUnits} /></MobileErrorBoundary>
        : <DesktopClient initialUnits={initialUnits} />
}
