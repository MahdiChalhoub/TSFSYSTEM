'use client'

/**
 * DajingoPageShell — Universal List Page Shell
 * ==============================================
 * Encapsulates the full "Dajingo Pro V2" page layout:
 *
 *  NORMAL MODE:
 *  ┌─ Title Row ─────────────────────────────────────────────┐
 *  │ [icon-box] Title               [CTA] [Refresh] [Focus] │
 *  │            subtitle stats                               │
 *  ├─ KPI Strip ─────────────────────────────────────────────┤
 *  │ [stat] [stat] [stat] [stat]                             │
 *  ├─ Filter Panel (optional) ───────────────────────────────┤
 *  │ renderFilters()                                         │
 *  ├─ children (DajingoListView + CustomizePanel) ───────────┤
 *  │ ...                                                     │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  FOCUS MODE:
 *  ┌─ Compact Header ───────────────────────────────────────┐
 *  │ [icon] Label X/Y  [search]  [Filters] [Minimize]      │
 *  ├─ Filter Panel (optional) ──────────────────────────────┤
 *  ├─ children ─────────────────────────────────────────────┤
 *  └────────────────────────────────────────────────────────┘
 *
 * Usage:
 *  <DajingoPageShell
 *    title="Product Master"
 *    icon={<Package size={20} />}
 *    subtitle={`${stats.total} Products · ${stats.combos} Combos`}
 *    kpiStats={[{ label: 'Total', value: 100, icon: ..., color: '...' }]}
 *    primaryAction={{ label: 'New Product', icon: <Plus size={14} />, onClick: () => {} }}
 *    renderFilters={() => <FiltersPanel ... />}
 *    {...state}
 *  >
 *    <DajingoListView ... />
 *  </DajingoPageShell>
 */

import React from 'react'
import {
  Search, SlidersHorizontal,
  Maximize2, Minimize2, RefreshCcw,
} from 'lucide-react'
import { KPIStrip, type KPIStat } from '@/components/ui/KPIStrip'
import { DataMenu } from '@/components/admin/_shared/DataMenu'
import type { DataToolsConfig } from '@/components/templates/master-page-config'
import { useDataToolsEngine } from '@/components/templates/useDataToolsEngine'


/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

export interface DajingoPageShellAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

export interface DajingoPageShellProps {
  /* ── Identity ── */
  title: string
  icon: React.ReactNode
  subtitle?: string
  entityLabel?: string

  /* ── KPI ── */
  kpiStats?: KPIStat[]

  /* ── Primary action ── */
  primaryAction?: DajingoPageShellAction
  /** Slot for extra action buttons (refresh is automatic if onRefresh given) */
  secondaryActions?: React.ReactNode

  /* ── Search binding ── */
  search: string
  onSearchChange: (v: string) => void
  searchRef?: React.RefObject<HTMLInputElement | null>
  searchPlaceholder?: string

  /* ── Counts for focus mode display ── */
  filteredCount: number
  totalCount: number

  /* ── Focus mode ── */
  focusMode: boolean
  onFocusModeChange: (v: boolean) => void

  /* ── Filter panel ── */
  showFilters: boolean
  onToggleFilters: () => void
  activeFilterCount: number

  /* ── Refresh ── */
  onRefresh?: () => void

  /* ── Filter panel slot ── */
  renderFilters?: () => React.ReactNode

  /* ── Height mode ── */
  className?: string

  /* ── Declarative DataTools (export / import / print) ── */
  dataTools?: DataToolsConfig
  /** Source dataset for declarative export/print. */
  data?: any[]

  /* ── Children = DajingoListView + CustomizePanel ── */
  children: React.ReactNode
}


/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */

export function DajingoPageShell({
  title, icon, subtitle, entityLabel,
  kpiStats,
  primaryAction, secondaryActions,
  search, onSearchChange, searchRef, searchPlaceholder,
  filteredCount, totalCount,
  focusMode, onFocusModeChange,
  showFilters, onToggleFilters, activeFilterCount,
  onRefresh,
  renderFilters,
  className,
  dataTools, data,
  children,
}: DajingoPageShellProps) {

  /* ── Declarative DataTools engine ── */
  const { menuCallbacks: dtMenuCallbacks, modals: dtModals } = useDataToolsEngine({
    dataTools,
    data,
    titleFallback: title,
  })

  return (
    <div className={`flex flex-col animate-in fade-in duration-300 transition-all ${className || 'h-full min-h-0'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

        {focusMode ? (
          /* ══════════════════════════════════════════════════════
           *  FOCUS MODE — Compact inline header
           * ══════════════════════════════════════════════════════ */
          <div className="flex items-center gap-2">
            {/* Mini icon + label + count */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                {React.isValidElement(icon)
                  ? React.cloneElement(icon as React.ReactElement<any>, { size: 14, className: 'text-white' })
                  : icon}
              </div>
              <span className="text-tp-md font-bold text-app-foreground hidden sm:inline">{title}</span>
              <span className="text-tp-xs font-bold text-app-muted-foreground">{filteredCount}/{totalCount}</span>
            </div>

            {/* Search */}
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder || 'Search...'}
                className="w-full pl-8 pr-3 py-1.5 text-tp-md bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={onToggleFilters}
              className={`flex items-center gap-1 text-tp-sm font-bold px-2 py-1.5 rounded-lg border transition-all flex-shrink-0 ${
                showFilters
                  ? 'border-app-primary text-app-primary bg-app-primary/5'
                  : 'border-app-border text-app-muted-foreground'
              }`}
            >
              <SlidersHorizontal size={13} />
              {activeFilterCount > 0 && (
                <span className="text-tp-xxs font-bold bg-app-primary text-white px-1.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Minimize */}
            <button
              onClick={() => onFocusModeChange(false)}
              className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"
            >
              <Minimize2 size={13} />
            </button>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════
           *  NORMAL MODE — Full header + KPI + filters
           * ══════════════════════════════════════════════════════ */
          <>
            {/* ── Title Row ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="page-header-icon bg-app-primary"
                  style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                >
                  {icon}
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">{title}</h1>
                  {subtitle && (
                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Action Buttons ── */}
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {primaryAction && (
                  <button
                    onClick={primaryAction.onClick}
                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                  >
                    {primaryAction.icon}
                    <span className="hidden sm:inline">{primaryAction.label}</span>
                  </button>
                )}
                {dtMenuCallbacks && (
                  <DataMenu
                    onExport={dtMenuCallbacks.onExport}
                    onExportExcel={dtMenuCallbacks.onExportExcel}
                    onImport={dtMenuCallbacks.onImport}
                    onPrint={dtMenuCallbacks.onPrint}
                    title={dtMenuCallbacks.title}
                  />
                )}
                {secondaryActions}
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    title="Refresh"
                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                  >
                    <RefreshCcw size={13} />
                  </button>
                )}
                <button
                  onClick={() => onFocusModeChange(true)}
                  title="Focus mode — Ctrl+Q"
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>

            {/* ── KPI Strip ── */}
            {kpiStats && kpiStats.length > 0 && <KPIStrip stats={kpiStats} />}

            {/* ── Filter Panel (normal mode) ── */}
            {renderFilters && renderFilters()}
          </>
        )}

        {/* ── Filter Panel (focus mode) ── */}
        {focusMode && renderFilters && renderFilters()}
      </div>

      {/* ── Main Content: DajingoListView + CustomizePanel ── */}
      {children}

      {/* ── DataTools engine modals (Print + Import) ── */}
      {dtModals}
    </div>
  )
}
