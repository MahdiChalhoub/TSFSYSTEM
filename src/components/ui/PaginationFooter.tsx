'use client'

/**
 * Pagination Footer
 * ==================
 * Smart pagination with page numbers, ellipsis truncation, and page-size selector.
 * Reusable — no domain-specific logic.
 */

import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationFooterProps {
  totalItems: number
  /** True total in the data source. When > `totalItems`, the footer renders
   *  "X of Y in catalog" so the user sees real database size, not just the
   *  loaded slice. Optional — defaults to `totalItems` (no extra hint). */
  totalAvailable?: number
  activeFilterCount: number
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  showAll?: boolean
}

export const PaginationFooter = React.memo(function PaginationFooter({
  totalItems, totalAvailable, activeFilterCount, currentPage, totalPages, pageSize,
  onPageChange, onPageSizeChange, pageSizeOptions = [25, 50, 100], showAll = true,
}: PaginationFooterProps) {
  const showCatalogSize = typeof totalAvailable === 'number' && totalAvailable > totalItems
  // Visible window — clearer than just "X results" when the page is paginated.
  // E.g. pageSize=25, totalItems=52, currentPage=1 → "Showing 1–25 of 52".
  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIdx = Math.min(currentPage * pageSize, totalItems)
  const isPaginated = totalPages > 1
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex-shrink-0 px-3 py-2 border-t border-app-border/50 text-[10px] font-bold text-app-muted-foreground flex items-center justify-between gap-2 flex-wrap"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
      {/* Left: info — "Showing X–Y of Z" makes the visible-vs-total split obvious. */}
      <span>
        {isPaginated ? (
          <>Showing <strong className="text-app-foreground">{startIdx}–{endIdx}</strong> of {totalItems}</>
        ) : (
          <>{totalItems} result{totalItems !== 1 ? 's' : ''}</>
        )}
        {showCatalogSize && (
          <span className="opacity-70" title={`${totalAvailable} total in catalog — refine filters or load more to see all`}>
            {' '}of {totalAvailable} in catalog
          </span>
        )}
        {activeFilterCount > 0 && <span> · {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}</span>}
      </span>

      {/* Center: page numbers */}
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage <= 1}
          className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20 transition-all" title="First page">
          <ChevronsLeft size={12} />
        </button>
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
          className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20 transition-all" title="Previous">
          <ChevronLeft size={12} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dot-${i}`} className="px-1 text-app-muted-foreground/50">…</span>
          ) : (
            <button key={p} onClick={() => onPageChange(p)}
              className={`min-w-[24px] h-6 rounded-md text-[10px] font-bold transition-all ${p === currentPage
                ? 'bg-app-primary text-white shadow-sm'
                : 'hover:bg-app-surface border border-transparent hover:border-app-border/50'
                }`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}
          className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20 transition-all" title="Next">
          <ChevronRight size={12} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages}
          className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20 transition-all" title="Last page">
          <ChevronsRight size={12} />
        </button>
      </div>

      {/* Right: page size */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider">Show:</span>
        {pageSizeOptions.map(n => (
          <button key={n} onClick={() => onPageSizeChange(n)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${pageSize === n ? 'bg-app-primary text-white' : 'hover:bg-app-surface border border-app-border/50'}`}>
            {n}
          </button>
        ))}
        {showAll && (
          <button onClick={() => onPageSizeChange(totalItems || 999999)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${pageSize >= totalItems ? 'bg-app-primary text-white' : 'hover:bg-app-surface border border-app-border/50'}`}>
            All
          </button>
        )}
      </div>
    </div>
  )
})
