'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Search, Filter, ChevronDown, ChevronUp, RotateCcw, X, SlidersHorizontal } from 'lucide-react'

/* ═══════════════════════════════════════════════════════
   TypicalFilter — Reusable filter bar
   
   Features:
   ✓ Primary filters shown in top bar
   ✓ Search input with clear button
   ✓ Auto-overflow: when maxVisible set, extra filters collapse
   ✓ Expandable "Advanced Filters" panel
   ✓ Reset all filters
   ✓ Compact mode
   ✓ Filter types: select, date, text, checkbox
   ═══════════════════════════════════════════════════════ */

export type FilterItemType = 'select' | 'date' | 'text' | 'checkbox'

export type FilterItem = {
    key: string
    label: string
    type: FilterItemType
    options?: { value: string; label: string }[]
    placeholder?: string
}

export type SearchConfig = {
    placeholder?: string
    value: string
    onChange: (value: string) => void
}

export type TypicalFilterProps = {
    filters?: FilterItem[]
    values?: Record<string, string | boolean>
    onChange?: (key: string, value: string | boolean) => void
    search?: SearchConfig
    /** Additional filters in expandable panel */
    moreFilters?: FilterItem[]
    onReset?: () => void

    /** Max number of primary filters to show before auto-overflowing to advanced panel */
    maxVisible?: number

    className?: string
    compact?: boolean
    showBorder?: boolean
}

export function TypicalFilter({
    filters = [],
    values = {},
    onChange,
    search,
    moreFilters = [],
    onReset,
    maxVisible,
    className = '',
    compact = false,
    showBorder = true,
}: TypicalFilterProps) {

    const [showAdvanced, setShowAdvanced] = useState(false)

    /* Auto-overflow: split filters into visible + overflow */
    const limit = maxVisible ?? filters.length
    const visibleFilters = filters.slice(0, limit)
    const overflowFilters = filters.slice(limit)
    const allAdvanced = [...overflowFilters, ...moreFilters]
    const hasAdvanced = allAdvanced.length > 0

    /* Count active filters */
    const activeCount = Object.entries(values).filter(([_, v]) => v !== '' && v !== false).length

    const renderFilterItem = (f: FilterItem, inPanel = false) => {
        const val = values[f.key]

        switch (f.type) {
            case 'select':
                return (
                    <Select key={f.key}
                        value={typeof val === 'string' ? val : ''}
                        onValueChange={v => onChange?.(f.key, v === '__all__' ? '' : v)}>
                        <SelectTrigger className={`${compact ? 'h-7 text-xs' : 'h-8 text-sm'} ${inPanel ? 'w-full' : 'w-auto min-w-[130px]'} gap-1`}>
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
                    <Input key={f.key} type="date"
                        value={typeof val === 'string' ? val : ''}
                        onChange={e => onChange?.(f.key, e.target.value)}
                        className={`${compact ? 'h-7 text-xs' : 'h-8 text-sm'} ${inPanel ? 'w-full' : 'w-auto min-w-[140px]'}`}
                        placeholder={f.placeholder || f.label} />
                )

            case 'text':
                return (
                    <Input key={f.key}
                        value={typeof val === 'string' ? val : ''}
                        onChange={e => onChange?.(f.key, e.target.value)}
                        className={`${compact ? 'h-7 text-xs' : 'h-8 text-sm'} ${inPanel ? 'w-full' : 'w-auto min-w-[140px]'}`}
                        placeholder={f.placeholder || f.label} />
                )

            case 'checkbox':
                return (
                    <label key={f.key} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={typeof val === 'boolean' ? val : false}
                            onCheckedChange={v => onChange?.(f.key, !!v)} />
                        <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>{f.label}</span>
                    </label>
                )

            default: return null
        }
    }

    return (
        <div className={`space-y-0 ${className}`}>
            {/* ─── Primary Bar ────────────────────── */}
            <div className={`flex flex-wrap items-center gap-2 ${showBorder ? 'border-b border-gray-100 pb-3' : 'pb-2'}`}>
                {/* Search */}
                {search && (
                    <div className="relative w-56">
                        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                        <Input
                            placeholder={search.placeholder || 'Search...'}
                            value={search.value}
                            onChange={e => search.onChange(e.target.value)}
                            className={`pl-8 ${compact ? 'h-7 text-xs' : 'h-8 text-sm'}`} />
                        {search.value && (
                            <button onClick={() => search.onChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                )}

                {/* Visible filters */}
                {visibleFilters.map(f => renderFilterItem(f))}

                {/* Advanced Filters toggle */}
                {hasAdvanced && (
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${showAdvanced
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            } ${compact ? 'text-xs' : 'text-sm'}`}>
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Advanced
                        {activeCount > 0 && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0 rounded-full text-[10px] font-bold bg-emerald-500 text-white min-w-[18px]">
                                {activeCount}
                            </span>
                        )}
                        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                )}

                {/* Reset */}
                {onReset && (
                    <button
                        onClick={onReset}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-red-500 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}>
                        <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                )}
            </div>

            {/* ─── Advanced Filters Panel ─────────── */}
            {hasAdvanced && showAdvanced && (
                <div className="pt-3 pb-3 border-b border-gray-100 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {allAdvanced.map(f => (
                            <div key={f.key}>
                                <Label className="text-xs text-gray-500 mb-1 block">{f.label}</Label>
                                {renderFilterItem(f, true)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
