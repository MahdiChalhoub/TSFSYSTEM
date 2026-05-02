'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileErrorBoundary } from '@/components/mobile/MobileErrorBoundary'

const MobileClient = dynamic(
    () => import('./mobile/MobileCOAClient').then(m => m.MobileCOAClient),
    { ssr: false, loading: () => <GatewaySkeleton /> }
)

const DesktopClient = dynamic(
    () => import('./viewer').then(m => m.ChartOfAccountsViewer),
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
                    <div key={i} className="h-14 rounded-xl bg-app-surface/20" />
                ))}
            </div>
        </div>
    )
}

export function COAGateway({ accounts, orgCurrencies = [] }: { accounts: any[]; orgCurrencies?: any[] }) {
    const isMobile = useIsMobile()
    return isMobile
        ? <MobileErrorBoundary><MobileClient accounts={accounts} orgCurrencies={orgCurrencies} /></MobileErrorBoundary>
        : <DesktopClient accounts={accounts} orgCurrencies={orgCurrencies} />
}
