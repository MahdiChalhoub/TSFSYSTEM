// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  FiscalYearSelector + useActiveFiscalYear hook
 *  Global "rule" that governs every finance report: pick a
 *  fiscal year once and every report (Trial Balance, P&L,
 *  Balance Sheet, Cash Flow…) reads the same window.
 *
 *  - Persists the selection in localStorage (key below).
 *  - Emits a browser 'storage'-like custom event so every open
 *    report auto-refreshes when the FY changes in one tab.
 *  - `useActiveFiscalYear(fiscalYears)` gives every report the
 *    resolved { start, end } for the current FY (or a sensible
 *    fallback when the user has never picked one).
 * ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Calendar, ChevronDown, Check, Infinity as InfinityIcon } from 'lucide-react'

const STORAGE_KEY = 'tsf_active_fiscal_year'
const EVENT = 'tsf-fiscal-year-change'

export type FiscalYear = {
    id: number
    name?: string
    start_date: string   // ISO yyyy-mm-dd
    end_date: string
    is_closed?: boolean
}

/* ─── Hook: subscribe to the active fiscal year ─── */
export function useActiveFiscalYear(fiscalYears: FiscalYear[] | undefined) {
    // Priority: explicit selection → fiscal year covering today → latest open → null
    const safe = Array.isArray(fiscalYears) ? fiscalYears : []
    const [fyId, setFyId] = useState<number | 'all' | null>(null)

    useEffect(() => {
        const read = () => {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
            if (raw === 'all') setFyId('all')
            else if (raw) { const n = Number(raw); setFyId(Number.isFinite(n) ? n : null) }
            else setFyId(null)
        }
        read()
        const onChange = () => read()
        window.addEventListener(EVENT, onChange)
        window.addEventListener('storage', onChange)
        return () => {
            window.removeEventListener(EVENT, onChange)
            window.removeEventListener('storage', onChange)
        }
    }, [])

    const resolved = useMemo(() => {
        if (fyId === 'all') {
            return { mode: 'all' as const, fy: null, start: null, end: null, isExplicit: true }
        }
        // Use local-date for "today" to avoid UTC shift near midnight.
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const findCovering = () => safe.find(f => f.start_date <= today && today <= f.end_date)
        const explicit = fyId != null ? safe.find(f => f.id === fyId) : null
        const fy =
            explicit ||
            findCovering() ||
            safe.slice().sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''))[0] ||
            null
        return {
            mode: 'fy' as const,
            fy,
            start: fy?.start_date ?? null,
            end: fy?.end_date ?? null,
            // Distinguishes a user-chosen FY from the auto-resolved default.
            // Consumers should usually only *snap* their date state when
            // the user made an explicit selection.
            isExplicit: Boolean(explicit),
        }
    }, [fyId, safe])

    return resolved
}

/* ─── Selector chip + popover ─── */
export function FiscalYearSelector({ fiscalYears }: { fiscalYears: FiscalYear[] | undefined }) {
    const [open, setOpen] = useState(false)
    const [activeId, setActiveId] = useState<number | 'all' | null>(null)
    const btnRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const safe = Array.isArray(fiscalYears) ? fiscalYears : []

    // Sync with storage
    useEffect(() => {
        const read = () => {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
            if (raw === 'all') setActiveId('all')
            else if (raw) { const n = Number(raw); setActiveId(Number.isFinite(n) ? n : null) }
            else setActiveId(null)
        }
        read()
        const onChange = () => read()
        window.addEventListener(EVENT, onChange)
        window.addEventListener('storage', onChange)
        return () => {
            window.removeEventListener(EVENT, onChange)
            window.removeEventListener('storage', onChange)
        }
    }, [])

    // Close on outside click / Esc
    useEffect(() => {
        if (!open) return
        const onDoc = (e: MouseEvent) => {
            if (panelRef.current?.contains(e.target as Node)) return
            if (btnRef.current?.contains(e.target as Node)) return
            setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onDoc)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDoc)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const pick = useCallback((v: number | 'all' | null) => {
        if (v === null) localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, String(v))
        window.dispatchEvent(new CustomEvent(EVENT))
        setActiveId(v)
        setOpen(false)
    }, [])

    // Label for the chip
    const label = useMemo(() => {
        if (activeId === 'all') return 'All time'
        const fy = safe.find(f => f.id === activeId)
        if (fy) return fy.name || `FY ${fy.start_date.slice(0, 4)}`
        // Fallback — FY that covers today
        const today = new Date().toISOString().split('T')[0]
        const covering = safe.find(f => f.start_date <= today && today <= f.end_date)
        return covering ? (covering.name || `FY ${covering.start_date.slice(0, 4)}`) : 'Auto · FY'
    }, [activeId, safe])

    return (
        <div className="relative inline-block">
            <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all hover:brightness-110"
                style={{
                    background: open
                        ? 'color-mix(in srgb, var(--app-primary) 10%, var(--app-surface))'
                        : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    border: open
                        ? '1px solid color-mix(in srgb, var(--app-primary) 35%, transparent)'
                        : '1px solid var(--app-border)',
                    color: open ? 'var(--app-primary)' : 'var(--app-foreground)',
                    height: 32,
                }}
                title="Fiscal year applies to every report">
                <Calendar size={12}
                    style={{ color: open ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                <span className="text-tp-xs font-black uppercase tracking-wider"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    FY
                </span>
                <span className="text-tp-sm font-bold">{label}</span>
                <ChevronDown size={11}
                    style={{
                        color: 'var(--app-muted-foreground)',
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                    }} />
            </button>

            {open && (
                <div ref={panelRef}
                    className="absolute z-50 mt-1.5 left-0 rounded-2xl p-2 animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                        minWidth: 260,
                    }}>
                    <div className="px-2 py-1 text-tp-xxs font-black uppercase tracking-widest"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Active fiscal year
                    </div>
                    <p className="px-2 pb-2 text-tp-xxs"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Applies to every finance report automatically.
                    </p>

                    <button onClick={() => pick(null)} type="button"
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-tp-sm transition-all text-left"
                        style={activeId === null ? {
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: 'var(--app-primary)',
                        } : {
                            background: 'transparent',
                            color: 'var(--app-foreground)',
                        }}>
                        <span className="flex items-center gap-1.5">
                            <span className="font-bold">Auto</span>
                            <span className="text-tp-xxs opacity-70">· the FY that covers today</span>
                        </span>
                        {activeId === null && <Check size={12} />}
                    </button>

                    <div className="h-px my-1.5"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />

                    {safe.length === 0 && (
                        <p className="px-2 py-2 text-tp-xs italic"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            No fiscal years defined yet.
                        </p>
                    )}

                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {safe.slice().sort((a, b) => b.start_date.localeCompare(a.start_date)).map(fy => {
                            const isActive = activeId === fy.id
                            return (
                                <button key={fy.id} onClick={() => pick(fy.id)} type="button"
                                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-tp-sm transition-all text-left"
                                    style={isActive ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                        color: 'var(--app-primary)',
                                    } : {
                                        background: 'transparent',
                                        color: 'var(--app-foreground)',
                                    }}>
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="font-bold truncate">
                                            {fy.name || `FY ${fy.start_date.slice(0, 4)}`}
                                        </span>
                                        {fy.is_closed && (
                                            <span className="text-tp-xxs font-bold uppercase px-1 py-0.5 rounded"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--app-muted-foreground) 15%, transparent)',
                                                    color: 'var(--app-muted-foreground)',
                                                }}>
                                                closed
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-tp-xxs font-mono tabular-nums flex items-center gap-1"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {fy.start_date} → {fy.end_date}
                                        {isActive && <Check size={12} />}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <div className="h-px my-1.5"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />

                    <button onClick={() => pick('all')} type="button"
                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-tp-sm transition-all text-left"
                        style={activeId === 'all' ? {
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: 'var(--app-primary)',
                        } : {
                            background: 'transparent',
                            color: 'var(--app-foreground)',
                        }}>
                        <span className="flex items-center gap-1.5">
                            <InfinityIcon size={12} />
                            <span className="font-bold">All time</span>
                            <span className="text-tp-xxs opacity-70">· ignore fiscal years</span>
                        </span>
                        {activeId === 'all' && <Check size={12} />}
                    </button>
                </div>
            )}
        </div>
    )
}
