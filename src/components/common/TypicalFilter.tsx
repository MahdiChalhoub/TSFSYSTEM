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
 <SelectTrigger className={`bg-app-text/50 border-app-border focus:ring-app-primary/10 focus:border-app-primary transition-all rounded-xl ${compact ? 'h-8 text-[11px]' : 'h-10 text-xs'} ${inPanel ? 'w-full' : 'w-auto min-w-[140px]'} font-black uppercase tracking-tight`}>
 <SelectValue placeholder={f.label} />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-app-border shadow-2xl">
 <SelectItem value="__all__" className="text-[11px] font-black uppercase tracking-widest text-app-text-faint">{f.label}</SelectItem>
 {f.options?.map(o => (
 <SelectItem key={o.value} value={o.value} className="text-[11px] font-bold uppercase tracking-tight">{o.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 )

 case 'date':
 return (
 <Input key={f.key} type="date"
 value={typeof val === 'string' ? val : ''}
 onChange={e => onChange?.(f.key, e.target.value)}
 className={`bg-app-text/50 border-app-border focus:ring-app-primary/10 focus:border-app-primary transition-all rounded-xl font-bold ${compact ? 'h-8 text-[11px]' : 'h-10 text-xs'} ${inPanel ? 'w-full' : 'w-auto min-w-[150px]'}`}
 placeholder={f.placeholder || f.label} />
 )

 case 'text':
 return (
 <Input key={f.key}
 value={typeof val === 'string' ? val : ''}
 onChange={e => onChange?.(f.key, e.target.value)}
 className={`bg-app-text/50 border-app-border focus:ring-app-primary/10 focus:border-app-primary transition-all rounded-xl font-bold ${compact ? 'h-8 text-[11px]' : 'h-10 text-xs'} ${inPanel ? 'w-full' : 'w-auto min-w-[150px]'}`}
 placeholder={f.placeholder || f.label} />
 )

 case 'checkbox':
 return (
 <label key={f.key} className="flex items-center gap-3 cursor-pointer group/check bg-app-surface-2 hover:bg-app-surface px-3 py-2 rounded-xl border border-transparent hover:border-app-border transition-all">
 <Checkbox checked={typeof val === 'boolean' ? val : false}
 className="bg-app-surface border-2 border-app-border data-[state=checked]:bg-app-primary data-[state=checked]:border-app-primary transition-all"
 onCheckedChange={v => onChange?.(f.key, !!v)} />
 <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-app-text-muted font-black uppercase tracking-widest group-hover/check:text-app-text transition-colors`}>{f.label}</span>
 </label>
 )

 default: return null
 }
 }

 return (
 <div className={`space-y-0 ${className}`}>
 {/* ─── Primary Bar ────────────────────── */}
 {/* ─── Primary Bar ────────────────────── */}
 <div className={`flex flex-wrap items-center gap-3 ${showBorder ? 'border-b border-app-border pb-4' : 'pb-2'}`}>
 {/* Search */}
 {search && (
 <div className="relative w-72 group/search">
 <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} text-slate-300 group-hover/search:text-app-primary transition-colors duration-500`} />
 <Input
 placeholder={search.placeholder || 'IDENTIFY TARGET NODES...'}
 value={search.value}
 onChange={e => search.onChange(e.target.value)}
 className={`pl-11 pr-10 bg-app-text/50 border-app-border focus:bg-app-surface focus:ring-app-primary/10 focus:border-app-primary transition-all rounded-full font-black text-[11px] uppercase tracking-tight shadow-inner ${compact ? 'h-8' : 'h-10'}`} />
 {search.value && (
 <button onClick={() => search.onChange('')}
 className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-app-error hover:bg-app-error-bg transition-all">
 <X className="h-3.5 w-3.5" />
 </button>
 )}
 </div>
 )}

 {/* Visible filters */}
 <div className="flex flex-wrap items-center gap-2">
 {visibleFilters.map(f => renderFilterItem(f))}
 </div>

 {/* Advanced Filters toggle */}
 {hasAdvanced && (
 <button
 onClick={() => setShowAdvanced(!showAdvanced)}
 className={`flex items-center gap-3 px-4 rounded-xl border transition-all duration-500 group/adv relative overflow-hidden ${showAdvanced
 ? 'border-app-primary bg-app-primary text-app-text shadow-lg shadow-app-primary/20'
 : 'border-app-border bg-app-surface text-app-text-muted hover:text-app-text hover:border-app-border hover:shadow-lg'
 } ${compact ? 'h-8 text-[10px]' : 'h-10 text-[11px] font-black uppercase tracking-widest'}`}>
 <SlidersHorizontal className={`h-4 w-4 ${showAdvanced ? 'text-app-text' : 'text-slate-300 group-hover/adv:text-app-primary'} transition-colors duration-500`} />
 Advanced
 {activeCount > 0 && (
 <span className={`inline-flex items-center justify-center px-1.5 py-0 rounded-full text-[9px] font-black min-w-[20px] h-5 ${showAdvanced ? 'bg-app-surface text-app-success shadow-inner' : 'bg-app-primary text-app-text shadow-lg shadow-emerald-200'}`}>
 {activeCount}
 </span>
 )}
 {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover/adv:translate-y-0.5" />}
 </button>
 )}

 {/* Reset */}
 {onReset && (
 <button
 onClick={onReset}
 className={`flex items-center gap-2 px-3 h-10 rounded-xl text-slate-300 hover:text-app-error hover:bg-app-error-bg transition-all duration-300 group/reset ${compact ? 'text-[10px]' : 'text-[11px] font-black uppercase tracking-widest'}`}>
 <RotateCcw className="h-3.5 w-3.5 group-hover/reset:rotate-[-180deg] transition-transform duration-500" /> Reset
 </button>
 )}
 </div>

 {/* ─── Advanced Filters Panel ─────────── */}
 {hasAdvanced && showAdvanced && (
 <div className="pt-6 pb-6 border-b border-app-border animate-in slide-in-from-top-4 duration-500 fade-in">
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 bg-app-surface-2 backdrop-blur-sm p-6 rounded-[2rem] border border-app-border shadow-inner">
 {allAdvanced.map(f => (
 <div key={f.key} className="space-y-2">
 <Label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest px-1">{f.label}</Label>
 {renderFilterItem(f, true)}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )
}
