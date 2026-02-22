'use client'

import React, { useState, useCallback } from 'react'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Filter, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

/* ═══════════════════════════════════════════════════════
   TypicalFilter — Reusable filter bar for any list page
   
   Usage:
     <TypicalFilter
       filters={[
         { key: 'status', label: 'Status', type: 'select',
           options: [{ value: 'active', label: 'Active' }] },
         { key: 'date', label: 'Date', type: 'date' },
       ]}
       values={{ status: 'active' }}
       onChange={(key, value) => ...}
       search={{ placeholder: 'Search...', value: '', onChange: v => ... }}
       moreFilters={[
         { key: 'brand', label: 'Brand', type: 'select', options: [...] },
       ]}
       onReset={() => ...}
     />
   ═══════════════════════════════════════════════════════ */

/* ─── Types ──────────────────────────────────────────── */

export type FilterItemType = 'select' | 'date' | 'text' | 'checkbox'

export type FilterItem = {
    key: string
    label: string
    type: FilterItemType
    /** Options for select type */
    options?: { value: string; label: string }[]
    /** Placeholder text */
    placeholder?: string
}

export type SearchConfig = {
    placeholder?: string
    value: string
    onChange: (value: string) => void
}

export type TypicalFilterProps = {
    /** Primary filters shown in the top bar */
    filters?: FilterItem[]
    /** Current filter values keyed by filter key */
    values?: Record<string, string | boolean>
    /** Called when any filter value changes */
    onChange?: (key: string, value: string | boolean) => void
    /** Search input configuration — omit to hide search */
    search?: SearchConfig
    /** Additional filters shown in expandable "More Filters" panel */
    moreFilters?: FilterItem[]
    /** Called when "Reset" is clicked */
    onReset?: () => void

    /* ── Visual customization ─── */
    /** Custom class for the filter bar container */
    className?: string
    /** Compact mode reduces height */
    compact?: boolean
    /** Show border below filter bar */
    showBorder?: boolean
}

/* ─── Component ──────────────────────────────────────── */

export function TypicalFilter({
    filters = [],
    values = {},
    onChange,
    search,
    moreFilters = [],
    onReset,
    className = '',
    compact = false,
    showBorder = true,
}: TypicalFilterProps) {

    const [showMore, setShowMore] = useState(false)
    const hasMore = moreFilters.length > 0

    const renderFilterItem = (f: FilterItem) => {
        const val = values[f.key]

        switch (f.type) {
            case 'select':
                return (
                    <Select
                        key={f.key}
                        value={typeof val === 'string' ? val : ''}
                        onValueChange={v => onChange?.(f.key, v === '__all__' ? '' : v)}
                    >
                        <SelectTrigger className={`${compact ? 'h-7 text-xs' : 'h-8 text-sm'} w-auto min-w-[130px] gap-1`}>
                            <SelectValue placeholder={f.label} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">{f.label}</SelectItem>
                            {f.options?.map(o => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )

            case 'date':
                return (
                    <Input
                        key={f.key}
                        type="date"
                        value={typeof val === 'string' ? val : ''}
                        onChange={e => onChange?.(f.key, e.target.value)}
                        className={`${compact ? 'h-7 text-xs' : 'h-8 text-sm'} w-auto min-w-[140px]`}
                        placeholder={f.placeholder || f.label}
                    />
                )

            case 'text':
                return (
                    <Input
                        key={f.key}
                        value={typeof val === 'string' ? val : ''}
                        onChange={e => onChange?.(f.key, e.target.value)}
                        className={`${compact ? 'h-7 text-xs' : 'h-8 text-sm'} w-auto min-w-[140px]`}
                        placeholder={f.placeholder || f.label}
                    />
                )

            case 'checkbox':
                return (
                    <label key={f.key} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                            checked={typeof val === 'boolean' ? val : false}
                            onCheckedChange={v => onChange?.(f.key, !!v)}
                        />
                        <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>{f.label}</span>
                    </label>
                )

            default:
                return null
        }
    }

    return (
        <div className={`space-y-0 ${className}`}>
            {/* ─── Primary Filter Bar ────────────────── */}
            <div className={`flex flex-wrap items-center gap-2 ${showBorder ? 'border-b border-gray-100 pb-3' : 'pb-2'}`}>
                {/* Search */}
                {search && (
                    <div className="relative w-56">
                        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                        <Input
                            placeholder={search.placeholder || 'Search...'}
                            value={search.value}
                            onChange={e => search.onChange(e.target.value)}
                            className={`pl-8 ${compact ? 'h-7 text-xs' : 'h-8 text-sm'}`}
                        />
                        {search.value && (
                            <button onClick={() => search.onChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                )}

                {/* Primary filters */}
                {filters.map(renderFilterItem)}

                {/* More filters toggle */}
                {hasMore && (
                    <button
                        onClick={() => setShowMore(!showMore)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        {showMore ? 'Less' : 'More'} Filter
                        {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                )}

                {/* Reset */}
                {onReset && (
                    <button
                        onClick={onReset}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-red-500 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
                    >
                        <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                )}
            </div>

            {/* ─── More Filters Panel ────────────────── */}
            {hasMore && showMore && (
                <div className="pt-3 pb-3 border-b border-gray-100 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {moreFilters.map(f => (
                            <div key={f.key}>
                                <Label className="text-xs text-gray-500 mb-1 block">{f.label}</Label>
                                {renderFilterItem(f)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
