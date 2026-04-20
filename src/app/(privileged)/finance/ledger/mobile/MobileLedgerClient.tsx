// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileLedgerClient — mobile-native General Ledger view.
 *  Replaces the dense DajingoListView table with card-per-entry
 *  list, filter chip rail, and a bottom-sheet detail view.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    BookOpen, Plus, FileText, CheckCircle2, Clock, RotateCcw, Lock, ShieldCheck,
    RefreshCcw, Eye, Pencil, Trash2, Copy, Layers, Zap,
    Calendar, ChevronRight,
} from 'lucide-react'
import { useAdmin } from '@/context/AdminContext'
import { useCurrency } from '@/lib/utils/currency'
import {
    getLedgerEntries, deleteJournalEntry, reverseJournalEntry,
} from '@/app/actions/finance/ledger'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
    POSTED:   { label: 'Posted',   color: 'var(--app-success, #22c55e)', icon: CheckCircle2 },
    DRAFT:    { label: 'Draft',    color: 'var(--app-warning, #f59e0b)', icon: Clock },
    REVERSED: { label: 'Reversed', color: 'var(--app-error, #ef4444)',   icon: RotateCcw },
}

function formatAmount(n: number | string | undefined, fmt?: (n: number) => string): string {
    const v = Number(n ?? 0)
    if (isNaN(v)) return '—'
    if (fmt) return fmt(v)
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso?: string): string {
    if (!iso) return '—'
    try {
        const d = new Date(iso)
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return iso }
}

export function MobileLedgerClient() {
    const router = useRouter()
    const { viewScope } = useAdmin()
    const { fmt } = useCurrency()
    const [isPending, startTransition] = useTransition()
    const [entries, setEntries] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [sheetEntry, setSheetEntry] = useState<any | null>(null)
    const [actionEntry, setActionEntry] = useState<any | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
    const [reverseTarget, setReverseTarget] = useState<any | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getLedgerEntries(viewScope || 'INTERNAL', {
                status: statusFilter || undefined,
            })
            setEntries(Array.isArray(data) ? data : [])
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load entries')
        } finally {
            setLoading(false)
        }
    }, [viewScope, statusFilter])

    useEffect(() => { loadData() }, [loadData])

    const stats = useMemo(() => {
        const total = entries.length
        const posted = entries.filter(e => e.status === 'POSTED').length
        const draft = entries.filter(e => e.status === 'DRAFT').length
        const reversed = entries.filter(e => e.status === 'REVERSED').length
        const totalDebit = entries.reduce((s, e) => s + Number(e.totalDebit ?? e.total_debit ?? 0), 0)
        const totalCredit = entries.reduce((s, e) => s + Number(e.totalCredit ?? e.total_credit ?? 0), 0)
        return { total, posted, draft, reversed, totalDebit, totalCredit }
    }, [entries])

    const openSheet = useCallback((e: any) => setSheetEntry(e), [])
    const openActions = useCallback((e: any) => setActionEntry(e), [])

    const handleDelete = useCallback(() => {
        if (!deleteTarget) return
        startTransition(async () => {
            const res = await deleteJournalEntry(deleteTarget.id)
            if (res?.success !== false) {
                toast.success('Entry deleted')
                setDeleteTarget(null)
                loadData()
            } else {
                toast.error(res?.message || 'Delete failed')
            }
        })
    }, [deleteTarget, loadData])

    const handleReverse = useCallback(() => {
        if (!reverseTarget) return
        startTransition(async () => {
            const res = await reverseJournalEntry(reverseTarget.id)
            if (res?.success !== false) {
                toast.success('Entry reversed')
                setReverseTarget(null)
                loadData()
            } else {
                toast.error(res?.message || 'Reverse failed')
            }
        })
    }, [reverseTarget, loadData])

    const actionItems = useMemo(() => {
        if (!actionEntry) return []
        const isPosted = actionEntry.status === 'POSTED'
        const isLocked = actionEntry.isLocked || actionEntry.is_locked
        return [
            { key: 'view', label: 'View detail', hint: 'Full info', icon: <Eye size={16} />, variant: 'grid', onClick: () => openSheet(actionEntry) },
            { key: 'open', label: 'Open page', hint: 'Full screen', icon: <BookOpen size={16} />, variant: 'grid', onClick: () => router.push(`/finance/ledger/${actionEntry.id}`) },
            { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, disabled: isLocked, hint: isLocked ? 'Locked entry' : undefined, onClick: () => router.push(`/finance/ledger/${actionEntry.id}?edit=1`) },
            ...(isPosted ? [{ key: 'reverse', label: 'Reverse entry', hint: 'Creates counter-entry', icon: <RotateCcw size={16} />, onClick: () => setReverseTarget(actionEntry) }] : []),
            { key: 'copy', label: 'Copy reference', hint: actionEntry.reference || `#${actionEntry.id}`, icon: <Copy size={16} />, onClick: () => {
                try { navigator.clipboard?.writeText(actionEntry.reference || String(actionEntry.id)); toast.success('Copied') }
                catch { toast.error('Copy failed') }
            } },
            { key: 'delete', label: 'Delete', destructive: true, disabled: isPosted || isLocked, hint: (isPosted || isLocked) ? 'Only draft entries can be deleted' : undefined, icon: <Trash2 size={16} />, onClick: () => setDeleteTarget(actionEntry) },
        ]
    }, [actionEntry, openSheet, router])

    return (
        <MobileMasterPage
            config={{
                title: 'General Ledger',
                subtitle: loading
                    ? 'Loading entries…'
                    : `${stats.total} entries · ${viewScope === 'OFFICIAL' ? 'Official' : 'Internal'}`,
                icon: <BookOpen size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search reference, source…',
                primaryAction: {
                    label: 'New Entry',
                    icon: <Plus size={16} strokeWidth={2.6} />,
                    onClick: () => router.push('/finance/ledger/new'),
                },
                secondaryActions: [
                    { label: 'Import CSV', icon: <FileText size={14} />, href: '/finance/ledger/import' },
                    { label: 'Opening Balances', icon: <Layers size={14} />, href: '/finance/ledger/opening' },
                    { label: 'Refresh', icon: <RefreshCcw size={14} />, onClick: () => loadData() },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <FileText size={13} />, color: 'var(--app-primary)' },
                    { label: 'Posted', value: stats.posted, icon: <CheckCircle2 size={13} />, color: 'var(--app-success, #22c55e)' },
                    { label: 'Draft', value: stats.draft, icon: <Clock size={13} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Reversed', value: stats.reversed, icon: <RotateCcw size={13} />, color: 'var(--app-error, #ef4444)' },
                    { label: 'Total Debit', value: formatAmount(stats.totalDebit, fmt), icon: <Zap size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Total Credit', value: formatAmount(stats.totalCredit, fmt), icon: <Zap size={13} />, color: '#8b5cf6' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} entries</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{viewScope === 'OFFICIAL' ? 'Official' : 'Internal'}</span>
                    </>
                ),
                onRefresh: async () => { await loadData() },
            }}
            modals={
                <>
                    <MobileActionSheet
                        open={actionEntry !== null}
                        onClose={() => setActionEntry(null)}
                        title={actionEntry?.reference || (actionEntry ? `#${actionEntry.id}` : '')}
                        subtitle={actionEntry ? `${formatDate(actionEntry.date)} · ${actionEntry.status || 'DRAFT'}` : undefined}
                        items={actionItems}
                    />
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                        onConfirm={handleDelete}
                        title={`Delete "${deleteTarget?.reference || `#${deleteTarget?.id}`}"?`}
                        description="Only draft entries can be deleted. This cannot be undone."
                        confirmText="Delete"
                        variant="danger"
                    />
                    <ConfirmDialog
                        open={reverseTarget !== null}
                        onOpenChange={(o) => { if (!o) setReverseTarget(null) }}
                        onConfirm={handleReverse}
                        title={`Reverse "${reverseTarget?.reference || `#${reverseTarget?.id}`}"?`}
                        description="Creates a counter-entry with swapped debits/credits. Both entries remain visible in the ledger."
                        confirmText="Reverse"
                        variant="warning"
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={sheetEntry !== null}
                    onClose={() => setSheetEntry(null)}
                    initialSnap="expanded">
                    {sheetEntry && (
                        <LedgerEntryDetail
                            entry={sheetEntry}
                            fmt={fmt}
                            onEdit={() => { setSheetEntry(null); router.push(`/finance/ledger/${sheetEntry.id}?edit=1`) }}
                            onOpen={() => { setSheetEntry(null); router.push(`/finance/ledger/${sheetEntry.id}`) }}
                            onClose={() => setSheetEntry(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery }) => {
                const q = searchQuery.trim().toLowerCase()
                const filtered = entries.filter(e => {
                    if (!q) return true
                    return (e.reference || '').toLowerCase().includes(q)
                        || (e.sourceModule || e.source_module || '').toLowerCase().includes(q)
                        || (e.sourceModel || e.source_model || '').toLowerCase().includes(q)
                        || String(e.id).includes(q)
                })

                return (
                    <div className="space-y-2">
                        {/* Status filter chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {[
                                { key: '', label: 'All', color: 'var(--app-primary)', count: stats.total },
                                { key: 'POSTED', label: 'Posted', color: STATUS_META.POSTED.color, count: stats.posted },
                                { key: 'DRAFT', label: 'Draft', color: STATUS_META.DRAFT.color, count: stats.draft },
                                { key: 'REVERSED', label: 'Reversed', color: STATUS_META.REVERSED.color, count: stats.reversed },
                            ].map(f => {
                                const active = statusFilter === f.key
                                return (
                                    <button
                                        key={f.label}
                                        onClick={() => setStatusFilter(f.key)}
                                        className="flex-shrink-0 flex items-center gap-1.5 font-black uppercase tracking-widest rounded-full px-3 py-1.5 active:scale-95 transition-all"
                                        style={{
                                            fontSize: 'var(--tp-xxs)',
                                            minHeight: 32,
                                            color: active ? '#fff' : f.color,
                                            background: active
                                                ? f.color
                                                : `color-mix(in srgb, ${f.color} 10%, transparent)`,
                                            border: `1px solid color-mix(in srgb, ${f.color} ${active ? 50 : 25}%, transparent)`,
                                        }}>
                                        {f.label}
                                        <span className="font-black tabular-nums rounded-full px-1.5 py-0.5"
                                            style={{
                                                fontSize: 'var(--tp-xxs)',
                                                background: active ? 'rgba(255,255,255,0.2)' : `color-mix(in srgb, ${f.color} 16%, transparent)`,
                                                color: active ? '#fff' : f.color,
                                                minWidth: 20, textAlign: 'center',
                                            }}>
                                            {f.count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <RefreshCcw size={32} className="text-app-muted-foreground mb-3 animate-spin opacity-60" />
                                <p className="font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-md)' }}>
                                    Loading ledger…
                                </p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                <BookOpen size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="font-bold text-app-muted-foreground mb-1"
                                    style={{ fontSize: 'var(--tp-lg)' }}>
                                    {q || statusFilter ? 'No matching entries' : 'No ledger entries'}
                                </p>
                                <p className="text-app-muted-foreground max-w-xs"
                                    style={{ fontSize: 'var(--tp-md)' }}>
                                    {q || statusFilter ? 'Try a different filter or search.' : 'Tap + to create the first entry.'}
                                </p>
                            </div>
                        ) : (
                            filtered.map(e => {
                                const status = STATUS_META[e.status] || STATUS_META.DRAFT
                                const SIcon = status.icon
                                const isLocked = e.isLocked || e.is_locked
                                const isVerified = e.isVerified || e.is_verified
                                const debit = Number(e.totalDebit ?? e.total_debit ?? 0)
                                const credit = Number(e.totalCredit ?? e.total_credit ?? 0)
                                const lineCount = e.lineCount ?? e.line_count ?? 0
                                const srcModule = e.sourceModule || e.source_module
                                const scope = e.scope
                                return (
                                    <button
                                        key={e.id}
                                        onClick={() => openSheet(e)}
                                        onContextMenu={(ev) => { ev.preventDefault(); openActions(e) }}
                                        className="w-full text-left rounded-2xl p-3 active:scale-[0.99] transition-transform"
                                        style={{
                                            background: `linear-gradient(90deg, color-mix(in srgb, ${status.color} 5%, var(--app-surface)) 0%, var(--app-surface) 100%)`,
                                            border: `1px solid color-mix(in srgb, ${status.color} 22%, var(--app-border))`,
                                            contentVisibility: 'auto',
                                            containIntrinsicSize: '0 140px',
                                        }}>
                                        {/* Line 1: reference + status */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono font-black tabular-nums text-app-foreground flex-1 truncate"
                                                style={{ fontSize: 'var(--tp-lg)' }}>
                                                {e.reference || `#${e.id}`}
                                            </span>
                                            <span className="flex items-center gap-1 font-black uppercase tracking-widest rounded-full px-2 py-0.5"
                                                style={{
                                                    fontSize: 'var(--tp-xxs)',
                                                    background: `color-mix(in srgb, ${status.color} 14%, transparent)`,
                                                    color: status.color,
                                                }}>
                                                <SIcon size={10} /> {status.label}
                                            </span>
                                        </div>
                                        {/* Line 2: date + source + flags */}
                                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                            <span className="flex items-center gap-1 font-bold text-app-muted-foreground"
                                                style={{ fontSize: 'var(--tp-xs)' }}>
                                                <Calendar size={10} /> {formatDate(e.date)}
                                            </span>
                                            {srcModule && (
                                                <span className="font-mono font-black uppercase tracking-wider text-app-muted-foreground rounded px-1.5"
                                                    style={{ fontSize: 'var(--tp-xxs)', background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                                    {srcModule}
                                                </span>
                                            )}
                                            {scope === 'OFFICIAL' && (
                                                <span className="flex items-center gap-0.5 font-black uppercase tracking-widest rounded-full px-1.5 py-0.5"
                                                    style={{
                                                        fontSize: 'var(--tp-xxs)',
                                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
                                                        color: 'var(--app-info, #3b82f6)',
                                                    }}>
                                                    OFF
                                                </span>
                                            )}
                                            {isLocked && (
                                                <Lock size={10} style={{ color: 'var(--app-muted-foreground)' }} />
                                            )}
                                            {isVerified && (
                                                <ShieldCheck size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                            )}
                                        </div>
                                        {/* Line 3: amounts + line count */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                                <span className="flex items-center gap-1 font-mono font-black tabular-nums rounded-lg px-2 py-1"
                                                    style={{
                                                        fontSize: 'var(--tp-sm)',
                                                        color: 'var(--app-info, #3b82f6)',
                                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                                    }}>
                                                    Dr {formatAmount(debit, fmt)}
                                                </span>
                                                <span className="flex items-center gap-1 font-mono font-black tabular-nums rounded-lg px-2 py-1"
                                                    style={{
                                                        fontSize: 'var(--tp-sm)',
                                                        color: '#8b5cf6',
                                                        background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                                                    }}>
                                                    Cr {formatAmount(credit, fmt)}
                                                </span>
                                            </div>
                                            <span className="flex items-center gap-1 font-bold text-app-muted-foreground flex-shrink-0"
                                                style={{ fontSize: 'var(--tp-xs)' }}>
                                                <Layers size={11} /> {lineCount}
                                            </span>
                                            <ChevronRight size={14} className="text-app-muted-foreground flex-shrink-0" />
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                )
            }}
        </MobileMasterPage>
    )
}

/* ─── Entry detail sheet ─── */
function LedgerEntryDetail({ entry, fmt, onEdit, onOpen, onClose }: any) {
    const status = STATUS_META[entry.status] || STATUS_META.DRAFT
    const SIcon = status.icon
    const lines = entry.lines || entry.journal_lines || []
    const debit = Number(entry.totalDebit ?? entry.total_debit ?? 0)
    const credit = Number(entry.totalCredit ?? entry.total_credit ?? 0)
    const isBalanced = Math.abs(debit - credit) < 0.01

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${status.color} 10%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: `linear-gradient(135deg, ${status.color}, color-mix(in srgb, ${status.color} 70%, #000))`,
                        boxShadow: `0 4px 14px color-mix(in srgb, ${status.color} 30%, transparent)`,
                        color: '#fff',
                    }}>
                    <SIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-mono font-black text-app-foreground truncate leading-tight"
                        style={{ fontSize: 'var(--tp-xl)' }}>
                        {entry.reference || `#${entry.id}`}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-black uppercase tracking-widest rounded-full px-2 py-0.5"
                            style={{
                                fontSize: 'var(--tp-xxs)',
                                background: `color-mix(in srgb, ${status.color} 14%, transparent)`,
                                color: status.color,
                            }}>
                            {status.label}
                        </span>
                        <span className="font-bold text-app-muted-foreground truncate"
                            style={{ fontSize: 'var(--tp-xs)' }}>
                            {formatDate(entry.date)}
                        </span>
                    </div>
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {/* Balance cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                        }}>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Debit</div>
                        <div className="font-mono font-black tabular-nums mt-1"
                            style={{ fontSize: 'var(--tp-stat)', color: 'var(--app-info, #3b82f6)' }}>
                            {formatAmount(debit, fmt)}
                        </div>
                    </div>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, #8b5cf6 6%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, #8b5cf6 20%, transparent)',
                        }}>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>Credit</div>
                        <div className="font-mono font-black tabular-nums mt-1"
                            style={{ fontSize: 'var(--tp-stat)', color: '#8b5cf6' }}>
                            {formatAmount(credit, fmt)}
                        </div>
                    </div>
                </div>

                {!isBalanced && (
                    <div className="rounded-xl p-3 flex items-center gap-2"
                        style={{
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
                        }}>
                        <ShieldCheck size={14} style={{ color: 'var(--app-error, #ef4444)' }} />
                        <span className="font-black" style={{ fontSize: 'var(--tp-md)', color: 'var(--app-error, #ef4444)' }}>
                            Unbalanced — Δ {formatAmount(Math.abs(debit - credit), fmt)}
                        </span>
                    </div>
                )}

                {/* Meta */}
                <div className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    {[
                        ['Date', formatDate(entry.date)],
                        ['Status', status.label],
                        ['Type', entry.journalType || entry.journal_type || 'MANUAL'],
                        ['Source', entry.sourceModule || entry.source_module || '—'],
                        ['Source Doc', entry.sourceModel || entry.source_model || '—'],
                        ['Scope', entry.scope || 'INTERNAL'],
                        ['Currency', entry.currency || '—'],
                        ['Lines', String(entry.lineCount ?? entry.line_count ?? lines.length ?? 0)],
                        ['Locked', (entry.isLocked ?? entry.is_locked) ? 'Yes' : 'No'],
                        ['Verified', (entry.isVerified ?? entry.is_verified) ? 'Yes' : 'No'],
                        ['Created', entry.createdAt ? formatDate(entry.createdAt) : (entry.created_at ? formatDate(entry.created_at) : '—')],
                        ['Posted', entry.postedAt ? formatDate(entry.postedAt) : (entry.posted_at ? formatDate(entry.posted_at) : '—')],
                    ].map(([label, value], i) => (
                        <div key={label}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                            style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                            <span className="font-black uppercase tracking-widest text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>{label}</span>
                            <span className="font-bold text-app-foreground truncate text-right"
                                style={{ fontSize: 'var(--tp-md)' }}>{value}</span>
                        </div>
                    ))}
                </div>

                {/* Lines */}
                {lines.length > 0 && (
                    <div>
                        <div className="font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 px-1"
                            style={{ fontSize: 'var(--tp-xs)' }}>
                            Journal Lines ({lines.length})
                        </div>
                        <div className="rounded-2xl overflow-hidden"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            {lines.slice(0, 50).map((l: any, i: number) => {
                                const ld = Number(l.debit ?? 0)
                                const lc = Number(l.credit ?? 0)
                                return (
                                    <div key={l.id || i} className="px-3 py-2.5"
                                        style={{ borderTop: i === 0 ? undefined : '1px dashed color-mix(in srgb, var(--app-border) 22%, transparent)' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono font-black tabular-nums"
                                                style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-primary)', minWidth: 46 }}>
                                                {l.account_code || l.accountCode || '—'}
                                            </span>
                                            <span className="flex-1 font-bold text-app-foreground truncate"
                                                style={{ fontSize: 'var(--tp-sm)' }}>
                                                {l.account_name || l.accountName || '—'}
                                            </span>
                                        </div>
                                        {l.description && (
                                            <div className="text-app-muted-foreground truncate mb-1"
                                                style={{ fontSize: 'var(--tp-xs)' }}>
                                                {l.description}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            {ld > 0 && (
                                                <span className="font-mono font-black tabular-nums rounded-lg px-2 py-0.5"
                                                    style={{
                                                        fontSize: 'var(--tp-xs)',
                                                        color: 'var(--app-info, #3b82f6)',
                                                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                                    }}>
                                                    Dr {formatAmount(ld, fmt)}
                                                </span>
                                            )}
                                            {lc > 0 && (
                                                <span className="font-mono font-black tabular-nums rounded-lg px-2 py-0.5"
                                                    style={{
                                                        fontSize: 'var(--tp-xs)',
                                                        color: '#8b5cf6',
                                                        background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                                                    }}>
                                                    Cr {formatAmount(lc, fmt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                            {lines.length > 50 && (
                                <div className="px-3 py-2 text-center font-bold text-app-muted-foreground"
                                    style={{ fontSize: 'var(--tp-xxs)', borderTop: '1px dashed color-mix(in srgb, var(--app-border) 22%, transparent)' }}>
                                    + {lines.length - 50} more lines
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
                style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                    background: 'var(--app-surface)',
                }}>
                <button onClick={onOpen}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)', height: 46, padding: '0 16px',
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}>
                    <BookOpen size={14} /> Full page
                </button>
                <button
                    onClick={onEdit}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-black"
                    style={{
                        fontSize: 'var(--tp-md)', height: 46,
                        color: '#fff',
                        background: 'var(--app-primary)',
                        boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                    }}>
                    <Pencil size={14} /> Edit entry
                </button>
            </div>
        </div>
    )
}
