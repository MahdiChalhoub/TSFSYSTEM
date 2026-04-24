'use client'

/**
 * useDajingoPageState — Universal List Page State Engine
 * ========================================================
 * Encapsulates ALL shared state management for Dajingo Pro V2 list pages:
 *
 *  - Search + searchRef
 *  - Focus mode
 *  - Filter visibility + active count
 *  - Column visibility + ordering + SaaS policy enforcement
 *  - Filter panel visibility
 *  - Customize panel visibility
 *  - Pagination (currentPage, pageSize, totalPages, paginate())
 *  - Row selection (selectedIds, toggleSelect, toggleSelectAll)
 *  - Keyboard shortcuts (Ctrl+K → search, Ctrl+Q → focus)
 *
 * Usage:
 *   const state = useDajingoPageState({ moduleKey: 'inventory_products', columns: ALL_COLUMNS })
 *   // Then spread onto DajingoPageShell + DajingoListView
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getListViewPolicy } from '@/app/actions/listview-policies'
import type { DajingoColumnDef, DajingoPagination } from '@/components/common/DajingoListView'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

export interface DajingoPageStateConfig {
  /** Module key for SaaS ListViewPolicy resolve + localStorage isolation */
  moduleKey: string
  /** SaaS policy key — defaults to moduleKey */
  policyKey?: string
  /** Column definitions array (ALL_COLUMNS from your _lib/constants) */
  columns: DajingoColumnDef[]
  /** Default column visibility map — if omitted, derived from columns[].defaultVisible */
  defaultVisibleCols?: Record<string, boolean>
  /** Default filter visibility map */
  defaultVisibleFilters?: Record<string, boolean>
  /** Initial page size (default 50) */
  initialPageSize?: number
  /** Initial filters state for external filter tracking */
  initialFilters?: Record<string, any>
}

export interface DajingoPageStateReturn {
  /* ── Search ── */
  search: string
  setSearch: (v: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>

  /* ── Focus mode ── */
  focusMode: boolean
  setFocusMode: (v: boolean) => void

  /* ── Filter panel ── */
  showFilters: boolean
  setShowFilters: (v: boolean) => void

  /* ── Customize panel ── */
  showCustomize: boolean
  setShowCustomize: (v: boolean) => void

  /* ── Columns ── */
  visibleColumns: Record<string, boolean>
  setVisibleColumns: (v: Record<string, boolean>) => void
  effectiveVisibleColumns: Record<string, boolean>
  columnOrder: string[]
  setColumnOrder: (o: string[]) => void

  /* ── Filter visibility (customize panel) ── */
  visibleFilters: Record<string, boolean>
  setVisibleFilters: (v: Record<string, boolean>) => void

  /* ── SaaS Policy ── */
  policyHiddenColumns: Set<string>
  policyHiddenFilters: Set<string>

  /* ── Selection ── */
  selectedIds: Set<number>
  setSelectedIds: (ids: Set<number>) => void
  toggleSelect: (id: number | string) => void
  isAllPageSelected: (pageData: any[]) => boolean
  toggleSelectAll: (pageData: any[]) => void

  /* ── Pagination ── */
  currentPage: number
  totalPages: number
  pageSize: number
  setCurrentPage: (p: number) => void
  setPageSize: (s: number) => void
  paginate: <T>(filtered: T[]) => T[]
  buildPagination: (filteredCount: number, activeFilterCount: number) => DajingoPagination

  /* ── Module key ── */
  moduleKey: string
}


/* ═══════════════════════════════════════════════════════════
 *  HOOK
 * ═══════════════════════════════════════════════════════════ */

export function useDajingoPageState(config: DajingoPageStateConfig): DajingoPageStateReturn {
  const { moduleKey, policyKey, columns, initialPageSize = 50 } = config

  // Derive defaults from column defs if not provided
  const defaultVC = useMemo(() => {
    if (config.defaultVisibleCols) return config.defaultVisibleCols
    const m: Record<string, boolean> = {}
    columns.forEach(c => { m[c.key] = c.defaultVisible })
    return m
  }, [columns, config.defaultVisibleCols])

  const defaultVF = useMemo(() => config.defaultVisibleFilters || {}, [config.defaultVisibleFilters])
  const defaultOrder = useMemo(() => columns.map(c => c.key), [columns])

  // ── Search ──
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  // ── Focus mode ──
  const [focusMode, setFocusMode] = useState(false)

  // ── Filter panel ──
  const [showFilters, setShowFilters] = useState(false)

  // ── Customize panel ──
  const [showCustomize, setShowCustomize] = useState(false)

  // ── Columns ──
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVC)
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultOrder)

  // ── Filter visibility ──
  const [visibleFilters, setVisibleFilters] = useState<Record<string, boolean>>(defaultVF)

  // ── SaaS Policy ──
  const [policyHiddenColumns, setPolicyHiddenColumns] = useState<Set<string>>(new Set())
  const [policyHiddenFilters, setPolicyHiddenFilters] = useState<Set<string>>(new Set())

  useEffect(() => {
    const key = policyKey || moduleKey
    getListViewPolicy(key).then(policy => {
      if (policy) {
        if (policy.hidden_columns?.length) setPolicyHiddenColumns(new Set(policy.hidden_columns))
        if (policy.hidden_filters?.length) setPolicyHiddenFilters(new Set(policy.hidden_filters))
      }
    }).catch(() => { /* no policy — allow everything */ })
  }, [moduleKey, policyKey])

  // Effective columns: user prefs minus policy-hidden
  const effectiveVisibleColumns = useMemo<Record<string, boolean>>(() => {
    if (policyHiddenColumns.size === 0) return visibleColumns
    const eff = { ...visibleColumns }
    for (const key of policyHiddenColumns) eff[key] = false
    return eff
  }, [visibleColumns, policyHiddenColumns])

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggleSelect = useCallback((id: number | string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const numId = typeof id === 'string' ? parseInt(id, 10) : id
      if (next.has(numId)) next.delete(numId); else next.add(numId)
      return next
    })
  }, [])

  const isAllPageSelected = useCallback((pageData: any[]): boolean => {
    return pageData.length > 0 && pageData.every(r => selectedIds.has(r.id))
  }, [selectedIds])

  const toggleSelectAll = useCallback((pageData: any[]) => {
    if (isAllPageSelected(pageData)) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageData.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageData.forEach(r => next.add(r.id))
        return next
      })
    }
  }, [isAllPageSelected])

  // ── Pagination ──
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1) }, [search])

  const paginate = useCallback(<T,>(filtered: T[]): T[] => {
    const tp = Math.max(1, Math.ceil(filtered.length / pageSize))
    const cp = Math.min(currentPage, tp)
    const start = (cp - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [currentPage, pageSize])

  const totalPages = 1 // Caller should compute from filtered.length; this is a fallback

  const buildPagination = useCallback((filteredCount: number, activeFilterCount: number): DajingoPagination => {
    const tp = Math.max(1, Math.ceil(filteredCount / pageSize))
    const cp = Math.min(currentPage, tp)
    return {
      totalItems: filteredCount,
      activeFilterCount,
      currentPage: cp,
      totalPages: tp,
      pageSize,
      onPageChange: setCurrentPage,
      onPageSizeChange: (n: number) => { setPageSize(n); setCurrentPage(1) },
    }
  }, [currentPage, pageSize])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
        e.preventDefault()
        setFocusMode(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return {
    // Search
    search, setSearch, searchRef,
    // Focus mode
    focusMode, setFocusMode,
    // Filter panel
    showFilters, setShowFilters,
    // Customize panel
    showCustomize, setShowCustomize,
    // Columns
    visibleColumns, setVisibleColumns, effectiveVisibleColumns,
    columnOrder, setColumnOrder,
    // Filter visibility
    visibleFilters, setVisibleFilters,
    // SaaS policy
    policyHiddenColumns, policyHiddenFilters,
    // Selection
    selectedIds, setSelectedIds, toggleSelect, isAllPageSelected, toggleSelectAll,
    // Pagination
    currentPage, totalPages, pageSize, setCurrentPage, setPageSize,
    paginate, buildPagination,
    // Module key
    moduleKey,
  }
}
