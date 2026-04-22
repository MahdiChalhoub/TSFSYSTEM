import type { ReactNode } from 'react'

/* ═══════════════════════════════════════════════════════════
 *  Shared page-config surface for desktop TreeMasterPage and
 *  mobile MobileMasterPage. Both shells accept MasterPageConfig;
 *  each extends it with shell-specific additions (columnHeaders
 *  on desktop, onRefresh on mobile).
 * ═══════════════════════════════════════════════════════════ */

export interface KPI {
    label: string
    /**
     * Either a literal value, or a function that receives the template's
     * filtered view + the full dataset. Functions let KPIs stay reactive
     * to search / KPI filters without the consumer tracking state.
     */
    value: number | string | ((filtered: any[], all: any[]) => number | string)
    icon: ReactNode
    color: string
    /**
     * Optional filter key. When set, the KPI renders as a clickable button.
     * The template owns the filter state — clicking toggles it, and the
     * reserved key `'all'` clears both search and filter.
     * Pair with `config.kpiPredicates[filterKey]` for the actual predicate.
     */
    filterKey?: string
    /**
     * Legacy override for active state. When `kpiPredicates` are passed to
     * the template, it manages active-state automatically — leave unset.
     */
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

export interface EmptyStateConfig {
    icon?: ReactNode
    title?: string | ((hasSearch: boolean) => string)
    subtitle?: string | ((hasSearch: boolean) => string)
    actionLabel?: string
}

export interface MasterPageConfig {
    title: string
    subtitle: string | ((filtered: any[], all: any[]) => string)
    icon: ReactNode
    iconColor: string
    kpis: KPI[]
    searchPlaceholder?: string
    primaryAction: PrimaryAction
    secondaryActions?: ActionButton[]
    footerLeft?: ReactNode | ((filtered: any[], all: any[]) => ReactNode)
    /**
     * Optional refresh handler. Mobile shell binds it to pull-to-refresh;
     * desktop shell renders a refresh button in the header.
     */
    onRefresh?: () => void | Promise<void>
    /**
     * Legacy hook — fires on KPI filter click. Only call-back consumers
     * that don't pass `kpiPredicates` need to wire this. When `kpiPredicates`
     * is set the template owns the filter state internally.
     */
    onKpiFilterChange?: (key: string | null) => void

    /* ── Single-source-of-truth inputs (opt-in) ─────────────────────
     * Pass `data` to let the template own search + KPI filtering +
     * tree building + empty-state. Consumers become pure view code
     * over the render-prop `tree` / `filteredData`.
     */
    /** Source dataset. When set, template owns filtering and tree build. */
    data?: any[]
    /** Fields matched by the search input. Defaults to ['name','code','short_name']. */
    searchFields?: string[]
    /**
     * Predicate map keyed by KPI.filterKey. Each predicate receives
     * the item and the full dataset (useful for leaf/root detection).
     * Special key `'all'` is reserved and handled internally (clears filters).
     */
    kpiPredicates?: Record<string, (item: any, allData: any[]) => boolean>
    /** Parent-id field name for tree building. Defaults to 'parent'. */
    treeParentKey?: string
    /** Config for the automatic empty-state panel shown when tree is empty. */
    emptyState?: EmptyStateConfig
}
