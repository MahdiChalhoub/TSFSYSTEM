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
}
