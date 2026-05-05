// @ts-nocheck
'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
    Calendar, ChevronLeft, ChevronRight, X, Clock,
    ChevronsLeft, ChevronsRight
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface SmartDatePickerProps {
    value: string                    // 'YYYY-MM-DD' or ''
    onChange: (date: string) => void
    label?: string
    placeholder?: string
    minDate?: string                 // 'YYYY-MM-DD'
    maxDate?: string
    presets?: { label: string; days: number }[]
    showPresets?: boolean
    className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]
const SHORT_MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const DEFAULT_EXPIRY_PRESETS = [
    { label: '+3 mo', days: 90 },
    { label: '+6 mo', days: 180 },
    { label: '+1 yr', days: 365 },
    { label: '+2 yr', days: 730 },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function toDateStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
    const result = new Date(d)
    result.setDate(result.getDate() + days)
    return result
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate()
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
    const d = new Date(year, month, 1).getDay()
    return d === 0 ? 6 : d - 1 // Monday = 0
}

function formatDisplay(dateStr: string): string {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function SmartDatePicker({
    value,
    onChange,
    label,
    placeholder = 'Pick a date...',
    minDate,
    maxDate,
    presets,
    showPresets = true,
    className = '',
}: SmartDatePickerProps) {
    const [open, setOpen] = useState(false)
    const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days')
    const containerRef = useRef<HTMLDivElement>(null)

    // Which month/year the calendar is showing
    const today = useMemo(() => new Date(), [])
    const initialDate = value ? new Date(value + 'T00:00:00') : today
    const [viewYear, setViewYear] = useState(initialDate.getFullYear())
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

    // Sync calendar view when value changes externally
    useEffect(() => {
        if (value) {
            const d = new Date(value + 'T00:00:00')
            setViewYear(d.getFullYear())
            setViewMonth(d.getMonth())
        }
    }, [value])

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setViewMode('days')
            }
        }
        if (open) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    const selectedDate = value ? new Date(value + 'T00:00:00') : null
    const minD = minDate ? new Date(minDate + 'T00:00:00') : null
    const maxD = maxDate ? new Date(maxDate + 'T00:00:00') : null

    const effectivePresets = presets || DEFAULT_EXPIRY_PRESETS

    // ── Navigation ──
    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }
    function prevYear() { setViewYear(y => y - 1) }
    function nextYear() { setViewYear(y => y + 1) }

    // ── Select handlers ──
    function selectDay(day: number) {
        const d = new Date(viewYear, viewMonth, day)
        onChange(toDateStr(d))
        setOpen(false)
        setViewMode('days')
    }
    function selectMonth(m: number) {
        setViewMonth(m)
        setViewMode('days')
    }
    function selectYear(y: number) {
        setViewYear(y)
        setViewMode('months')
    }
    function selectPreset(days: number) {
        const d = addDays(today, days)
        onChange(toDateStr(d))
        setOpen(false)
        setViewMode('days')
    }
    function handleClear(e: React.MouseEvent) {
        e.stopPropagation()
        onChange('')
        setOpen(false)
    }
    function goToToday() {
        setViewYear(today.getFullYear())
        setViewMonth(today.getMonth())
        setViewMode('days')
    }

    // ── Day grid ──
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

    function isDayDisabled(day: number): boolean {
        const d = new Date(viewYear, viewMonth, day)
        if (minD && d < minD) return true
        if (maxD && d > maxD) return true
        return false
    }

    function isDayToday(day: number): boolean {
        return isSameDay(new Date(viewYear, viewMonth, day), today)
    }

    function isDaySelected(day: number): boolean {
        if (!selectedDate) return false
        return isSameDay(new Date(viewYear, viewMonth, day), selectedDate)
    }

    // ── Year range for year picker ──
    const yearRangeStart = Math.floor(viewYear / 12) * 12
    const yearRange = Array.from({ length: 12 }, (_, i) => yearRangeStart + i)

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`w-full border rounded-lg p-3 text-sm font-medium bg-app-background text-left flex items-center gap-2 min-h-[48px] transition-all outline-none ${open
                        ? 'border-app-success ring-2 ring-emerald-500/20'
                        : 'border-app-border hover:border-app-muted-foreground/40'
                    } ${value ? 'text-app-foreground' : 'text-app-muted-foreground'}`}
            >
                <Calendar size={16} className={value ? 'text-app-success' : 'text-app-muted-foreground'} />
                <span className="flex-1 truncate">
                    {value ? formatDisplay(value) : placeholder}
                </span>
                {value && (
                    <span
                        onClick={handleClear}
                        className="p-0.5 rounded hover:bg-app-background text-app-muted-foreground hover:text-app-error transition-colors"
                    >
                        <X size={14} />
                    </span>
                )}
            </button>

            {/* Dropdown Calendar */}
            {open && (
                <div className="absolute z-50 mt-1 left-0 right-0 bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ minWidth: '280px' }}>

                    {/* Quick Presets */}
                    {showPresets && viewMode === 'days' && (
                        <div className="flex items-center gap-1 px-3 pt-3 pb-1">
                            {effectivePresets.map(p => (
                                <button
                                    key={p.days}
                                    type="button"
                                    onClick={() => selectPreset(p.days)}
                                    className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-app-success-soft text-app-success hover:bg-app-success-soft dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap"
                                >
                                    {p.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={goToToday}
                                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-app-info-soft text-app-info hover:bg-app-info-soft dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors ml-auto"
                            >
                                Today
                            </button>
                        </div>
                    )}

                    {/* ── Header: Month / Year Nav ── */}
                    <div className="flex items-center justify-between px-3 py-2">
                        <button type="button" onClick={viewMode === 'years' ? () => setViewYear(y => y - 12) : viewMode === 'months' ? prevYear : prevMonth}
                            className="p-1.5 rounded-lg hover:bg-app-background text-app-muted-foreground hover:text-app-foreground transition-colors">
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center gap-1">
                            {viewMode === 'days' && (
                                <>
                                    <button type="button" onClick={() => setViewMode('months')}
                                        className="px-2 py-1 rounded-lg text-sm font-black text-app-foreground hover:bg-app-background transition-colors">
                                        {MONTH_NAMES[viewMonth]}
                                    </button>
                                    <button type="button" onClick={() => setViewMode('years')}
                                        className="px-2 py-1 rounded-lg text-sm font-black text-app-foreground hover:bg-app-background transition-colors">
                                        {viewYear}
                                    </button>
                                </>
                            )}
                            {viewMode === 'months' && (
                                <button type="button" onClick={() => setViewMode('years')}
                                    className="px-2 py-1 rounded-lg text-sm font-black text-app-foreground hover:bg-app-background transition-colors">
                                    {viewYear}
                                </button>
                            )}
                            {viewMode === 'years' && (
                                <span className="text-sm font-black text-app-foreground px-2">
                                    {yearRangeStart} – {yearRangeStart + 11}
                                </span>
                            )}
                        </div>

                        <button type="button" onClick={viewMode === 'years' ? () => setViewYear(y => y + 12) : viewMode === 'months' ? nextYear : nextMonth}
                            className="p-1.5 rounded-lg hover:bg-app-background text-app-muted-foreground hover:text-app-foreground transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* ── Days Grid ── */}
                    {viewMode === 'days' && (
                        <div className="px-3 pb-3">
                            {/* Day names */}
                            <div className="grid grid-cols-7 mb-1">
                                {DAY_NAMES.map(d => (
                                    <div key={d} className="text-center text-[9px] font-black uppercase tracking-wider text-app-muted-foreground py-1">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Day cells */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {/* Empty before first day */}
                                {Array.from({ length: firstDay }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}

                                {/* Day buttons */}
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                    const disabled = isDayDisabled(day)
                                    const isToday = isDayToday(day)
                                    const isSelected = isDaySelected(day)
                                    const isPast = new Date(viewYear, viewMonth, day) < today && !isToday

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => selectDay(day)}
                                            className={`
                        relative aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all
                        ${disabled ? 'text-app-muted-foreground/30 cursor-not-allowed' : 'cursor-pointer'}
                        ${isSelected
                                                    ? 'bg-app-success text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/40'
                                                    : isToday
                                                        ? 'bg-app-info-soft text-app-info dark:bg-blue-900/40 dark:text-blue-400 font-black'
                                                        : isPast
                                                            ? 'text-app-muted-foreground/60 hover:bg-app-background'
                                                            : 'text-app-foreground hover:bg-app-success-soft dark:hover:bg-emerald-900/20'
                                                }
                      `}
                                        >
                                            {day}
                                            {isToday && !isSelected && (
                                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-app-info" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Months Grid ── */}
                    {viewMode === 'months' && (
                        <div className="px-3 pb-3 grid grid-cols-3 gap-1.5">
                            {SHORT_MONTHS.map((m, i) => {
                                const isCurrent = i === today.getMonth() && viewYear === today.getFullYear()
                                const isSelected = selectedDate && i === selectedDate.getMonth() && viewYear === selectedDate.getFullYear()
                                return (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => selectMonth(i)}
                                        className={`py-2.5 rounded-lg text-xs font-bold transition-all ${isSelected
                                                ? 'bg-app-success text-white shadow-md'
                                                : isCurrent
                                                    ? 'bg-app-info-soft text-app-info dark:bg-blue-900/40 dark:text-blue-400'
                                                    : 'text-app-foreground hover:bg-app-background'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* ── Years Grid ── */}
                    {viewMode === 'years' && (
                        <div className="px-3 pb-3 grid grid-cols-3 gap-1.5">
                            {yearRange.map(y => {
                                const isCurrent = y === today.getFullYear()
                                const isSelected = selectedDate && y === selectedDate.getFullYear()
                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        onClick={() => selectYear(y)}
                                        className={`py-2.5 rounded-lg text-xs font-bold transition-all ${isSelected
                                                ? 'bg-app-success text-white shadow-md'
                                                : isCurrent
                                                    ? 'bg-app-info-soft text-app-info dark:bg-blue-900/40 dark:text-blue-400'
                                                    : 'text-app-foreground hover:bg-app-background'
                                            }`}
                                    >
                                        {y}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
