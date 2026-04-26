import type { ReactNode } from 'react'
import type { PrintColumn } from '@/components/admin/_shared/PrintDialog'
import type { ColumnSpec, PreviewColumn } from '@/components/admin/_shared/GenericCsvImportDialog'

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
    /**
     * Escape hatch: when provided, the template renders this instead of the
     * default button/link. Lets a single secondaryActions entry produce a
     * dropdown menu, custom control, etc. Keep the outer shape similar to
     * the default button so the toolbar stays visually consistent.
     */
    render?: () => ReactNode
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

/* ── Declarative data-tools primitives ───────────────────────────── */

/** Column definition for CSV / Excel exports. */
export interface ExportColumn {
    key: string
    label: string
    /** Custom formatter — defaults to `String(item[key] ?? '')` */
    format?: (item: any) => string | number
}

/** Declarative print config — drives the unified PrintDialog. */
export interface DataToolsPrintConfig {
    title: string
    subtitle?: string
    prefKey?: string
    columns: PrintColumn[]
    /** Map each data item to a flat row object keyed by column.key */
    rowMapper: (item: any) => Record<string, any>
    /** Optional pre-print sort field (sorts ascending on this key) */
    sortBy?: string
    filterLine?: string
}

/** Declarative import config — drives the unified GenericCsvImportDialog. */
export interface DataToolsImportConfig {
    /** Singular noun, e.g. "brand", "category". */
    entity: string
    /** Plural noun — defaults to entity + 's'. */
    entityPlural?: string
    /** POST endpoint path (e.g. "brands/", "parfums/"). */
    endpoint: string
    /** Column specs shown in the tutorial's column table. */
    columns: ColumnSpec[]
    /** Full sample CSV text (header + a few rows). */
    sampleCsv: string
    /** Preview table columns. */
    previewColumns: PreviewColumn[]
    /** Map a parsed row to the JSON body posted to the endpoint. */
    buildPayload: (row: Record<string, string>) => Record<string, any>
    /** Optional extra tutorial hint text. */
    tip?: ReactNode
}

/**
 * Data toolbox — Export / Import / Print affordances for a master-data page.
 *
 * **Declarative mode** (preferred): supply `exportColumns`, `print`, and/or
 * `import`. The shell auto-generates all handlers, state, and modal UI
 * internally. Any improvement to the engine propagates to every page.
 *
 * **Legacy callback mode** (backward compat): supply `onExport`, `onPrint`,
 * etc. The shell calls them as-is. Both modes can coexist — explicit
 * callbacks override the declarative engine for that action.
 */
export interface DataToolsConfig {
    /** Menu-header override (e.g. "Brand Data"). */
    title?: string

    /* ── Declarative shape (auto-generates handlers) ── */

    /** Export column definitions — drives BOTH CSV and Excel exports.
     *  Omit to hide export actions (unless legacy `onExport` is set). */
    exportColumns?: ExportColumn[]
    /** Filename prefix for export files (e.g. "brands"). Defaults to page title. */
    exportFilename?: string
    /** Print config — omit to hide print action (unless legacy `onPrint` is set). */
    print?: DataToolsPrintConfig
    /** Import config — omit to hide import action (unless legacy `onImport` is set). */
    import?: DataToolsImportConfig

    /* ── Legacy callback shape (backward compat) ── */

    onExport?: () => void
    onExportExcel?: () => void
    onImport?: () => void
    onPrint?: () => void
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
    /** Export / Import / Print affordances — rendered as one unified dropdown
     *  in the toolbar. Leave a handler out to hide that row. */
    dataTools?: DataToolsConfig
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

/* ── Declarative bulk-move primitives ───────────────────────────── */

/** Declarative config for the built-in bulk-move dialog.
 *  When provided, TreeMasterPage auto-renders a Move button in the
 *  bulk-action bar and handles the full move lifecycle internally.
 */
export interface BulkMoveConfig {
    /** Label for the target entity, e.g. "category", "group". */
    targetLabel: string
    /** API field name to PATCH, e.g. "parent", "category". */
    field: string
    /** API endpoint prefix — items are PATCHed at `{endpoint}/{id}/`.
     *  e.g. "inventory/categories" → PATCH /inventory/categories/42/ */
    endpoint: string
    /** Available move targets. */
    targets: Array<{ id: number; name: string; path?: string }>
    /** When true, adds a "None" / root option that sets field to null. */
    allowNull?: boolean
    /** Label for the null option (default: "— None —"). */
    nullLabel?: string
}
