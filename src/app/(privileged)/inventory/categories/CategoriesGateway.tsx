// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'

const MobileClient = dynamic(
    () => import('./mobile/MobileCategoriesClient').then(m => m.MobileCategoriesClient),
    { ssr: false, loading: () => <GatewaySkeleton /> }
)

const DesktopClient = dynamic(
    () => import('./CategoriesClient').then(m => m.CategoriesClient),
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

export function CategoriesGateway({ initialCategories }: { initialCategories: any[] }) {
    const isMobile = useIsMobile()
    // useIsMobile starts as `false` (not undefined in current impl) — but it flips
    // to the correct value on first effect. Brief mismatch is acceptable.
    return isMobile
        ? <MobileClient initialCategories={initialCategories} />
        : <DesktopClient initialCategories={initialCategories} />
}
