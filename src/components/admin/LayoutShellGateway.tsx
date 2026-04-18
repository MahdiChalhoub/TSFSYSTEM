// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  LayoutShellGateway — branches between desktop and mobile shell
 *  at render time based on viewport. Layout.tsx (server) fetches
 *  data once and hands it here; we pick which shell to render.
 * ═══════════════════════════════════════════════════════════ */

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/use-mobile'
import { Sidebar } from '@/components/admin/Sidebar'
import { TopHeader } from '@/components/admin/TopHeader'
import { AdminShell } from '@/components/admin/AdminShell'
import { PeriodWarningBanner } from '@/components/finance/period-warning-banner'

const MobileAdminShell = dynamic(
    () => import('@/components/mobile/shell/MobileAdminShell').then(m => m.MobileAdminShell),
    { ssr: false, loading: () => null }
)

interface Props {
    user: any
    isSaas: boolean
    currentSlug: string
    sites: any[]
    organizations: any[]
    installedModuleCodes: string[]
    dynamicSidebarItems: any[]
    financialSettings: any
    children: React.ReactNode
}

export function LayoutShellGateway(props: Props) {
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <MobileAdminShell
                user={props.user}
                organizations={props.organizations}
                currentSlug={props.currentSlug}>
                <PeriodWarningBanner />
                {props.children}
            </MobileAdminShell>
        )
    }

    // Desktop shell — identical layout to what was in layout.tsx before
    return (
        <div className="flex h-screen overflow-hidden font-sans" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>
            <Sidebar
                isSaas={props.isSaas}
                isSuperuser={props.user?.is_superuser || false}
                dualViewEnabled={(props.user?.is_superuser) || (props.financialSettings?.dualView || false)}
                initialModuleCodes={props.installedModuleCodes}
                initialDynamicItems={props.dynamicSidebarItems}
            />
            <div className="flex-1 flex flex-col min-w-0">
                <TopHeader sites={props.sites} organizations={props.organizations} currentSlug={props.currentSlug} user={props.user} />
                <PeriodWarningBanner />
                <AdminShell>{props.children}</AdminShell>
            </div>
        </div>
    )
}
