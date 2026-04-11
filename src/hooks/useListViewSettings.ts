'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getUserListPreference, saveUserListPreference } from '@/app/actions/list-preferences'

/* ═══════════════════════════════════════════════════════
   useListViewSettings — persist list view preferences
   
   V2: Now enforces SaaS-level ListViewPolicy restrictions.
   
   3-Tier Architecture:
     1. SaaS Policy (ListViewPolicy) — what's ALLOWED
     2. Org Default (OrgListDefault)  — org admin defaults
     3. User Pref (UserListPreference) — user customization
   
   Usage:
     const settings = useListViewSettings('inventory_transfers', {
       columns: ['date','ref','qty','from','to','reason','driver'],
       pageSize: 25,
       sortKey: 'date',
       sortDir: 'desc',
     })
     
     // settings.visibleColumns  — string[] of visible column keys
     // settings.toggleColumn('driver') — show/hide a column
     // settings.isColumnAllowed('balance') — false if SaaS policy hides it
     // settings.allowedColumns — columns after policy filtering
     // settings.allowedFilters — filter keys not blocked by policy
     // settings.pageSize          — current page size
     // settings.setPageSize(50)
     // settings.sortKey / sortDir — current sort
     // settings.setSort('date', 'asc')
     // settings.filterPresets     — saved filter presets
     // settings.saveFilterPreset(name, values)
     // settings.deleteFilterPreset(name)
     // settings.reset()           — restore defaults
     // settings.policy            — raw SaaS policy object
   ═══════════════════════════════════════════════════════ */

export type ListViewDefaults = {
    /** All available column keys (order matters) */
    columns: string[]
    /** Default visible columns (subset of columns) */
    visibleColumns?: string[]
    /** Default page size */
    pageSize?: number
    /** Default sort column */
    sortKey?: string
    /** Default sort direction */
    sortDir?: 'asc' | 'desc'
    /** Filter keys available in this view */
    filterKeys?: string[]
}

export type FilterPreset = {
    name: string
    values: Record<string, string | boolean>
}

export type ListViewPolicy = {
    hidden_columns: string[]
    hidden_filters: string[]
    forced_columns: string[]
    max_page_size: number | null
    locked_sort: { key: string; dir: 'asc' | 'desc' } | null
    custom_labels: Record<string, string>
}

type StoredSettings = {
    visibleColumns: string[]
    pageSize: number
    sortKey: string
    sortDir: 'asc' | 'desc'
    filterPresets: FilterPreset[]
    columnOrder: string[]
}

const STORAGE_PREFIX = 'listview_'
const POLICY_CACHE_PREFIX = 'lvpolicy_'
const POLICY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function loadSettings(key: string): Partial<StoredSettings> | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key)
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

function saveSettings(key: string, settings: StoredSettings) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(settings))
    } catch { /* quota exceeded — silently fail */ }
}

/** Convert settings key to backend list_key format (e.g. 'pos_purchase-orders' → 'pos.purchase-orders') */
function toListKey(settingsKey: string): string {
    return settingsKey.replace(/_/g, '.')
}

function loadCachedPolicy(key: string): ListViewPolicy | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(POLICY_CACHE_PREFIX + key)
        if (!raw) return null
        const { policy, expires } = JSON.parse(raw)
        if (Date.now() > expires) {
            localStorage.removeItem(POLICY_CACHE_PREFIX + key)
            return null
        }
        return policy
    } catch { return null }
}

function saveCachedPolicy(key: string, policy: ListViewPolicy) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(POLICY_CACHE_PREFIX + key, JSON.stringify({
            policy,
            expires: Date.now() + POLICY_CACHE_TTL,
        }))
    } catch { /* ignore */ }
}

const EMPTY_POLICY: ListViewPolicy = {
    hidden_columns: [],
    hidden_filters: [],
    forced_columns: [],
    max_page_size: null,
    locked_sort: null,
    custom_labels: {},
}

export function useListViewSettings(settingsKey: string, defaults: ListViewDefaults) {
    const defaultVisible = defaults.visibleColumns || defaults.columns
    const defaultPageSize = defaults.pageSize || 25
    const defaultSortKey = defaults.sortKey || ''
    const defaultSortDir = defaults.sortDir || 'desc'

    const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisible)
    const [columnOrder, setColumnOrder] = useState<string[]>(defaults.columns)
    const [pageSize, setPageSizeState] = useState(defaultPageSize)
    const [sortKey, setSortKey] = useState(defaultSortKey)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
    const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
    const [loaded, setLoaded] = useState(false)
    const [policy, setPolicy] = useState<ListViewPolicy>(EMPTY_POLICY)
    const [policyLoaded, setPolicyLoaded] = useState(false)

    /* ─── Load SaaS policy ────────────────── */
    useEffect(() => {
        // Try cached first
        const cached = loadCachedPolicy(settingsKey)
        if (cached) {
            setPolicy(cached)
            setPolicyLoaded(true)
        }

        // Fetch fresh policy from server
        async function fetchPolicy() {
            try {
                const { getListViewPolicy } = await import('@/app/actions/listview-policies')
                const result = await getListViewPolicy(settingsKey)
                if (result) {
                    setPolicy(result)
                    saveCachedPolicy(settingsKey, result)
                }
            } catch {
                // Policy fetch failed — use empty policy (no restrictions)
            }
            setPolicyLoaded(true)
        }
        fetchPolicy()
    }, [settingsKey])

    /* ─── Load user settings from localStorage ── */
    useEffect(() => {
        const stored = loadSettings(settingsKey)
        if (stored) {
            if (stored.visibleColumns) setVisibleColumns(stored.visibleColumns)
            if (stored.columnOrder) setColumnOrder(stored.columnOrder)
            if (stored.pageSize) setPageSizeState(stored.pageSize)
            if (stored.sortKey !== undefined) setSortKey(stored.sortKey)
            if (stored.sortDir) setSortDir(stored.sortDir)
            if (stored.filterPresets) setFilterPresets(stored.filterPresets)
        }
        setLoaded(true)
    }, [settingsKey])

    /* Persist to localStorage on change */
    const persist = useCallback(() => {
        saveSettings(settingsKey, { visibleColumns, columnOrder, pageSize, sortKey, sortDir, filterPresets })
    }, [settingsKey, visibleColumns, columnOrder, pageSize, sortKey, sortDir, filterPresets])

    useEffect(() => { if (loaded) persist() }, [loaded, persist])

    /* ── Backend sync: debounced write-through ── */
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (!loaded) return
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(async () => {
            try {
                const listKey = toListKey(settingsKey)
                await saveUserListPreference(listKey, {
                    visible_columns: columnOrder.filter(c => visibleColumns.includes(c)),
                    default_filters: {},
                    page_size: pageSize,
                    sort_column: sortKey,
                    sort_direction: sortDir,
                })
            } catch { /* silent — localStorage is fallback */ }
        }, 1200) // 1.2s debounce
        return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
    }, [loaded, settingsKey, visibleColumns, columnOrder, pageSize, sortKey, sortDir])

    /* ── Backend sync: load on mount ── */
    useEffect(() => {
        async function loadFromBackend() {
            try {
                const listKey = toListKey(settingsKey)
                const pref = await getUserListPreference(listKey)
                if (!pref || pref.source === 'default') return
                const backendCols = pref.visible_columns || []
                if (backendCols.length === 0) return
                // Merge: backend order first, then remaining local columns
                const mergedOrder = [...backendCols]
                for (const c of defaults.columns) {
                    if (!mergedOrder.includes(c)) mergedOrder.push(c)
                }
                setVisibleColumns(backendCols)
                setColumnOrder(mergedOrder)
                if (pref.page_size) setPageSizeState(pref.page_size)
                if (pref.sort_column) setSortKey(pref.sort_column)
                if (pref.sort_direction) setSortDir(pref.sort_direction as 'asc' | 'desc')
            } catch { /* backend unavailable — use localStorage */ }
        }
        loadFromBackend()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsKey])

    /* ─── Policy-enforced derived values ──── */

    /** Columns allowed by SaaS policy (removes hidden columns) */
    const allowedColumns = useMemo(() => {
        return defaults.columns.filter(c => !policy.hidden_columns.includes(c))
    }, [defaults.columns, policy.hidden_columns])

    /** Visible columns after policy enforcement */
    const effectiveVisibleColumns = useMemo(() => {
        let cols = visibleColumns.filter(c => !policy.hidden_columns.includes(c))
        // Ensure forced columns are always visible
        for (const forced of policy.forced_columns) {
            if (!cols.includes(forced) && allowedColumns.includes(forced)) {
                cols.push(forced)
            }
        }
        return cols
    }, [visibleColumns, policy.hidden_columns, policy.forced_columns, allowedColumns])

    /** Filter keys allowed by policy */
    const allowedFilters = useMemo(() => {
        const allFilters = defaults.filterKeys || []
        return allFilters.filter(f => !policy.hidden_filters.includes(f))
    }, [defaults.filterKeys, policy.hidden_filters])

    /** Effective page size (capped by policy) */
    const effectivePageSize = useMemo(() => {
        if (policy.max_page_size && pageSize > policy.max_page_size) {
            return policy.max_page_size
        }
        return pageSize
    }, [pageSize, policy.max_page_size])

    /** Effective sort (overridden by policy's locked_sort) */
    const effectiveSortKey = policy.locked_sort?.key || sortKey
    const effectiveSortDir = policy.locked_sort?.dir || sortDir

    /* ─── Column visibility ───────────────── */
    const toggleColumn = useCallback((key: string) => {
        // Can't toggle hidden columns
        if (policy.hidden_columns.includes(key)) return
        // Can't hide forced columns
        if (policy.forced_columns.includes(key)) return

        setVisibleColumns(prev => {
            if (prev.includes(key)) {
                if (prev.length <= 1) return prev
                return prev.filter(k => k !== key)
            }
            return [...prev, key]
        })
    }, [policy.hidden_columns, policy.forced_columns])

    const showAllColumns = useCallback(() => {
        setVisibleColumns(allowedColumns)
    }, [allowedColumns])

    const isColumnVisible = useCallback((key: string) => {
        if (policy.hidden_columns.includes(key)) return false
        return effectiveVisibleColumns.includes(key)
    }, [effectiveVisibleColumns, policy.hidden_columns])

    const isColumnAllowed = useCallback((key: string) => {
        return !policy.hidden_columns.includes(key)
    }, [policy.hidden_columns])

    const isColumnForced = useCallback((key: string) => {
        return policy.forced_columns.includes(key)
    }, [policy.forced_columns])

    const isFilterAllowed = useCallback((key: string) => {
        return !policy.hidden_filters.includes(key)
    }, [policy.hidden_filters])

    /** Get custom label for a column (or original label) */
    const getColumnLabel = useCallback((key: string, defaultLabel: string) => {
        return policy.custom_labels[key] || defaultLabel
    }, [policy.custom_labels])

    /* ─── Column reordering ───────────────── */
    const moveColumn = useCallback((key: string, direction: 'up' | 'down') => {
        setColumnOrder(prev => {
            const idx = prev.indexOf(key)
            if (idx < 0) return prev
            const newIdx = direction === 'up' ? Math.max(0, idx - 1) : Math.min(prev.length - 1, idx + 1)
            const next = [...prev]
                ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
            return next
        })
    }, [])

    /* ─── Page size ───────────────────────── */
    const setPageSize = useCallback((size: number) => {
        const capped = policy.max_page_size ? Math.min(size, policy.max_page_size) : size
        setPageSizeState(capped)
    }, [policy.max_page_size])

    /* ─── Sorting ─────────────────────────── */
    const setSort = useCallback((key: string, dir?: 'asc' | 'desc') => {
        // If sort is locked by policy, don't allow changes
        if (policy.locked_sort) return

        if (key === sortKey && !dir) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(dir || 'asc')
        }
    }, [sortKey, policy.locked_sort])

    /* ─── Filter presets ──────────────────── */
    const saveFilterPreset = useCallback((name: string, values: Record<string, string | boolean>) => {
        // Remove any filter values that are blocked by policy
        const filtered: Record<string, string | boolean> = {}
        for (const [k, v] of Object.entries(values)) {
            if (!policy.hidden_filters.includes(k)) {
                filtered[k] = v
            }
        }
        setFilterPresets(prev => {
            const existing = prev.findIndex(p => p.name === name)
            if (existing >= 0) {
                const next = [...prev]
                next[existing] = { name, values: filtered }
                return next
            }
            return [...prev, { name, values: filtered }]
        })
    }, [policy.hidden_filters])

    const deleteFilterPreset = useCallback((name: string) => {
        setFilterPresets(prev => prev.filter(p => p.name !== name))
    }, [])

    /* ─── Reset ───────────────────────────── */
    const reset = useCallback(() => {
        setVisibleColumns(defaultVisible.filter(c => !policy.hidden_columns.includes(c)))
        setColumnOrder(defaults.columns)
        setPageSizeState(defaultPageSize)
        setSortKey(defaultSortKey)
        setSortDir(defaultSortDir)
        setFilterPresets([])
    }, [defaults.columns, defaultVisible, defaultPageSize, defaultSortKey, defaultSortDir, policy.hidden_columns])

    return {
        /* Column visibility (policy-enforced) */
        visibleColumns: effectiveVisibleColumns,
        toggleColumn,
        showAllColumns,
        isColumnVisible,
        isColumnAllowed,
        isColumnForced,
        allColumns: defaults.columns,
        allowedColumns,
        /* Column order */
        columnOrder,
        moveColumn,
        setColumnOrder,
        /* Page size (policy-capped) */
        pageSize: effectivePageSize,
        setPageSize,
        /* Sorting (policy-lockable) */
        sortKey: effectiveSortKey,
        sortDir: effectiveSortDir,
        setSort,
        isSortLocked: !!policy.locked_sort,
        /* Filters (policy-enforced) */
        allowedFilters,
        isFilterAllowed,
        filterPresets,
        saveFilterPreset,
        deleteFilterPreset,
        /* Labels */
        getColumnLabel,
        /* Policy info */
        policy,
        policyLoaded,
        /* Reset */
        reset,
        loaded: loaded && policyLoaded,
    }
}
