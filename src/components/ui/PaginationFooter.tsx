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
  totalItems, activeFilterCount, currentPage, totalPages, pageSize,
  onPageChange, onPageSizeChange, pageSizeOptions = [25, 50, 100], showAll = true,
}: PaginationFooterProps) {
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
      {/* Left: info */}
      <span>
        {totalItems} result{totalItems !== 1 ? 's' : ''}
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
