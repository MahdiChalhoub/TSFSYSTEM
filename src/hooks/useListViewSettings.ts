'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

/* ═══════════════════════════════════════════════════════
   useListViewSettings — persist list view preferences
   
   Usage:
     const settings = useListViewSettings('inventory_transfers', {
       columns: ['date','ref','qty','from','to','reason','driver'],
       pageSize: 25,
       sortKey: 'date',
       sortDir: 'desc',
     })
     
     // settings.visibleColumns  — string[] of visible column keys
     // settings.toggleColumn('driver') — show/hide a column
     // settings.pageSize          — current page size
     // settings.setPageSize(50)
     // settings.sortKey / sortDir — current sort
     // settings.setSort('date', 'asc')
     // settings.filterPresets     — saved filter presets
     // settings.saveFilterPreset(name, values)
     // settings.deleteFilterPreset(name)
     // settings.reset()           — restore defaults
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
}

export type FilterPreset = {
    name: string
    values: Record<string, string | boolean>
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

    /* Load from localStorage on mount */
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

    /* ─── Column visibility ───────────────── */
    const toggleColumn = useCallback((key: string) => {
        setVisibleColumns(prev => {
            if (prev.includes(key)) {
                // Don't allow hiding all columns
                if (prev.length <= 1) return prev
                return prev.filter(k => k !== key)
            }
            return [...prev, key]
        })
    }, [])

    const showAllColumns = useCallback(() => {
        setVisibleColumns(defaults.columns)
    }, [defaults.columns])

    const isColumnVisible = useCallback((key: string) => {
        return visibleColumns.includes(key)
    }, [visibleColumns])

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
        setPageSizeState(size)
    }, [])

    /* ─── Sorting ─────────────────────────── */
    const setSort = useCallback((key: string, dir?: 'asc' | 'desc') => {
        if (key === sortKey && !dir) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(dir || 'asc')
        }
    }, [sortKey])

    /* ─── Filter presets ──────────────────── */
    const saveFilterPreset = useCallback((name: string, values: Record<string, string | boolean>) => {
        setFilterPresets(prev => {
            const existing = prev.findIndex(p => p.name === name)
            if (existing >= 0) {
                const next = [...prev]
                next[existing] = { name, values }
                return next
            }
            return [...prev, { name, values }]
        })
    }, [])

    const deleteFilterPreset = useCallback((name: string) => {
        setFilterPresets(prev => prev.filter(p => p.name !== name))
    }, [])

    /* ─── Reset ───────────────────────────── */
    const reset = useCallback(() => {
        setVisibleColumns(defaultVisible)
        setColumnOrder(defaults.columns)
        setPageSizeState(defaultPageSize)
        setSortKey(defaultSortKey)
        setSortDir(defaultSortDir)
        setFilterPresets([])
    }, [defaults.columns, defaultVisible, defaultPageSize, defaultSortKey, defaultSortDir])

    return {
        /* Column visibility */
        visibleColumns,
        toggleColumn,
        showAllColumns,
        isColumnVisible,
        allColumns: defaults.columns,
        /* Column order */
        columnOrder,
        moveColumn,
        /* Page size */
        pageSize,
        setPageSize,
        /* Sorting */
        sortKey,
        sortDir,
        setSort,
        /* Filter presets */
        filterPresets,
        saveFilterPreset,
        deleteFilterPreset,
        /* Reset */
        reset,
        loaded,
    }
}
