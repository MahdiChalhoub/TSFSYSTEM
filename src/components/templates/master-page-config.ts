import type { ReactNode } from 'react'

/* ═══════════════════════════════════════════════════════════
 *  Shared page-config surface for desktop TreeMasterPage and
 *  mobile MobileMasterPage. Both shells accept MasterPageConfig;
 *  each extends it with shell-specific additions (columnHeaders
 *  on desktop, onRefresh on mobile).
 * ═══════════════════════════════════════════════════════════ */

export interface KPI {
    label: string
    value: number | string
    icon: ReactNode
    color: string
    /**
     * Optional filter key. When set, the KPI renders as a clickable button.
     * Clicking it calls config.onKpiFilterChange(filterKey) on the master
     * shell — toggling the filter on/off. Parent is responsible for applying
     * the actual filter to its data.
     */
    filterKey?: string
    /** True when this KPI is the currently-active filter. Controlled by parent. */
    active?: boolean
    /** Optional tooltip hint. */
    hint?: string
}

export interface ActionButton {
    label: string
    icon: ReactNode
    onClick?: () => void
    href?: string
    active?: boolean
    activeColor?: string
    dataTour?: string
}

export interface PrimaryAction {
    label: string
    icon: ReactNode
    onClick: () => void
    dataTour?: string
}

export interface MasterPageConfig {
    title: string
    subtitle: string
    icon: ReactNode
    iconColor: string
    kpis: KPI[]
    searchPlaceholder?: string
    primaryAction: PrimaryAction
    secondaryActions?: ActionButton[]
    footerLeft?: ReactNode
    /**
     * Optional refresh handler. Mobile shell binds it to pull-to-refresh;
     * desktop shell renders a refresh button in the header.
     */
    onRefresh?: () => void | Promise<void>
    /**
     * Fires when the user clicks a KPI whose `filterKey` is set. Returns
     * the clicked key, or `null` when the same KPI is clicked again (toggle off).
     */
    onKpiFilterChange?: (key: string | null) => void
}
