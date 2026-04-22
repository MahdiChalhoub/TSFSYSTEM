'use client'

/* ═══════════════════════════════════════════════════════════
 *  LayoutShellGateway — branches between desktop and mobile shell
 *  at render time based on viewport. Layout.tsx (server) fetches
 *  data once and hands it here; we pick which shell to render.
 *
 *  Initial render uses a server-side `initialIsMobile` hint (from
 *  User-Agent sniffing in layout.tsx) so phones don't briefly render
 *  the desktop Sidebar before the media-query check kicks in. After
 *  hydration, useIsMobile takes over with the accurate viewport size.
 *
 *  Note: MobileAdminShell is imported directly (not dynamic). A
 *  dynamic import with `loading: () => null` caused children to
 *  disappear during the chunk load, breaking navigation. The shell
 *  is small enough that the bundle-size win isn't worth the race.
 * ═══════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { TopHeader } from '@/components/admin/TopHeader'
import { AdminShell } from '@/components/admin/AdminShell'
import { PeriodWarningBanner } from '@/components/finance/period-warning-banner'
import { TaskReminderPopup } from '@/components/workspace/task-reminder-popup'
import { MobileAdminShell } from '@/components/mobile/shell/MobileAdminShell'

interface Props {
    user: any
    isSaas: boolean
    currentSlug: string
    sites: any[]
    organizations: any[]
    installedModuleCodes: string[]
    dynamicSidebarItems: any[]
    financialSettings: any
    initialIsMobile?: boolean
    children: React.ReactNode
}

const MOBILE_BREAKPOINT = 768

function useResolvedIsMobile(initial: boolean): boolean {
    const [isMobile, setIsMobile] = useState(initial)
    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
        const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        mql.addEventListener('change', onChange)
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        return () => mql.removeEventListener('change', onChange)
    }, [])
    return isMobile
}

export function LayoutShellGateway(props: Props) {
    const isMobile = useResolvedIsMobile(!!props.initialIsMobile)

    if (isMobile) {
        return (
            <MobileAdminShell
                user={props.user}
                organizations={props.organizations}
                currentSlug={props.currentSlug}>
                <PeriodWarningBanner isSuperuser={!!props.user?.is_superuser} />
                {props.children}
                <TaskReminderPopup />
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
                <PeriodWarningBanner isSuperuser={!!props.user?.is_superuser} />
                <AdminShell>{props.children}</AdminShell>
            </div>
            <TaskReminderPopup />
        </div>
    )
}
