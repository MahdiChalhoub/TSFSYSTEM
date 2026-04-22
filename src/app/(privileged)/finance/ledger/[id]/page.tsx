import { getJournalEntry } from '@/app/actions/finance/ledger'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Printer, FileText, CheckCircle, AlertCircle, RotateCcw,
    ShieldCheck, Lock, Calendar, Hash, Layers, Eye,
    Zap, Edit,
} from 'lucide-react'

export default async function ViewJournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const entryId = parseInt(id)
    if (isNaN(entryId)) notFound()

    const entry = await getJournalEntry(entryId) as any
    if (!entry) notFound()

    const lines = entry.lines || []
    const totalDebit = lines.reduce((sum: number, l: Record<string, any>) => sum + Number(l.debit || 0), 0)
    const totalCredit = lines.reduce((sum: number, l: Record<string, any>) => sum + Number(l.credit || 0), 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
    const dateRaw = entry.transactionDate || entry.transaction_date
    const dateStr = dateRaw ? new Date(dateRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    const sc = getStatusConfig(entry.status)
    const isLocked = entry.is_locked || entry.fiscalYear?.status === 'LOCKED' || entry.fiscalYear?.isLocked
    const postedAt = entry.posted_at ? new Date(entry.posted_at).toLocaleDateString('en-GB') : null
    const createdAt = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-GB') : null
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">

            {/* ═══════════════ COMPACT HEADER BAR ═══════════════ */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <Link href="/finance/ledger"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface border border-app-border/50 transition-all flex-shrink-0">
                    <ArrowLeft size={13} />
                </Link>
                <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center flex-shrink-0"
                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <FileText size={14} className="text-white" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                    <h1 className="text-[14px] font-bold text-app-foreground tracking-tight whitespace-nowrap">
                        JV <span className="font-mono">#{entry.id}</span>
                    </h1>
                    <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 12%, transparent)` }}>
                        {sc.label}
                    </span>
                    {isLocked && <Lock size={10} style={{ color: 'var(--app-warning)' }} />}
                    {entry.source_module && <Zap size={10} style={{ color: 'var(--app-info)' }} />}
                </div>

                {/* ── Inline metadata strip ── */}
                <div className="hidden sm:flex items-center gap-3 ml-2 text-tp-xs font-bold text-app-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar size={10} />{dateStr}</span>
                    <span>·</span>
                    <span className="font-mono">{entry.reference || '—'}</span>
                    <span>·</span>
                    <span>{entry.scope === 'OFFICIAL' ? 'Official' : 'Internal'}</span>
                    {entry.fiscalYear?.name && <><span>·</span><span>{entry.fiscalYear.name}</span></>}
                </div>

                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                    <button className="p-1.5 text-app-muted-foreground hover:text-app-foreground border border-app-border rounded-lg hover:bg-app-surface transition-all" title="Print">
                        <Printer size={12} />
                    </button>
                    {entry.status !== 'REVERSED' && !isLocked && (
                        <Link href={`/finance/ledger/${entry.id}/edit`}
                            className="flex items-center gap-1 text-tp-xs font-bold bg-app-primary hover:brightness-110 text-white px-2 py-1.5 rounded-lg transition-all"
                            style={{ boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Edit size={11} /><span className="hidden md:inline">Edit</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* ═══════════════ REVERSAL BANNERS (compact) ═══════════════ */}
            {(entry.reversalOf || entry.reversedBy) && (
                <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
                    {entry.reversalOf && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-tp-xs font-bold"
                            style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 15%, transparent)' }}>
                            <RotateCcw size={10} /> Reversal of JV #{entry.reversalOf.id}
                            <Link href={`/finance/ledger/${entry.reversalOf.id}`} className="underline">View</Link>
                        </div>
                    )}
                    {entry.reversedBy && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-tp-xs font-bold"
                            style={{ color: 'var(--app-warning)', background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                            <AlertCircle size={10} /> Reversed by JV #{entry.reversedBy.id}
                            <Link href={`/finance/ledger/${entry.reversedBy.id}`} className="underline">View</Link>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ COMPACT META + TOTALS STRIP ═══════════════ */}
            <div className="flex flex-wrap items-stretch gap-2 mb-3 flex-shrink-0">
                {/* Debit */}
                <MiniKPI label="Total Debit" value={fmt(totalDebit)} color="var(--app-primary)" icon={<Layers size={10} />} />
                {/* Credit */}
                <MiniKPI label="Total Credit" value={fmt(totalCredit)} color="var(--app-error)" icon={<Layers size={10} />} />
                {/* Balance */}
                <MiniKPI label="Difference" value={fmt(Math.abs(totalDebit - totalCredit))}
                    color={isBalanced ? 'var(--app-success)' : 'var(--app-error)'}
                    icon={isBalanced ? <CheckCircle size={10} /> : <AlertCircle size={10} />} />
                {/* Lines */}
                <MiniKPI label="Lines" value={lines.length} color="var(--app-info)" icon={<Hash size={10} />} />
                {/* Integrity */}
                {entry.entry_hash && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-tp-xxs font-mono font-bold text-app-muted-foreground"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                        <ShieldCheck size={10} style={{ color: 'var(--app-success)' }} /> {entry.entry_hash.slice(0, 12)}…
                    </div>
                )}
            </div>

            {/* ═══════════════ INFO STRIP — Compact Details ═══════════════ */}
            <div className="flex-shrink-0 mb-3 rounded-xl border border-app-border/40 px-4 py-2.5"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px 16px' }}>
                    <DetailCell label="Reference" value={entry.reference} mono />
                    <DetailCell label="Journal Type" value={entry.journal_type || entry.journalType || 'GENERAL'} />
                    <DetailCell label="Transaction Date" value={dateStr} />
                    <DetailCell label="Fiscal Year" value={entry.fiscalYear?.name || entry.fiscal_year?.name} />
                    <DetailCell label="Scope" value={entry.scope === 'OFFICIAL' ? 'Official' : 'Internal'}
                        color={entry.scope === 'OFFICIAL' ? 'var(--app-success)' : 'var(--app-info)'} />
                    <DetailCell label="Source" value={entry.source_module || 'Manual'}
                        color={entry.source_module ? 'var(--app-info)' : undefined} />
                    <DetailCell label="Created By" value={entry.created_by?.first_name || entry.created_by?.username} />
                    <DetailCell label="Posted By" value={entry.posted_by?.first_name || entry.posted_by?.username} />
                    <DetailCell label="Created" value={createdAt} />
                    <DetailCell label="Posted" value={postedAt} />
                </div>
                {entry.description && (
                    <div className="mt-2 pt-2 border-t border-app-border/20">
                        <span className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide">Narrative · </span>
                        <span className="text-tp-sm font-medium text-app-foreground">{entry.description}</span>
                    </div>
                )}
            </div>
            <div className="flex-1 min-h-0 rounded-2xl border border-app-border/50 overflow-hidden flex flex-col"
                style={{ background: 'var(--app-surface)' }}>

                <div className="px-4 py-2 flex items-center gap-2 border-b border-app-border/30 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)' }}>
                    <div className="w-1 h-3.5 rounded-full" style={{ background: 'var(--app-info)' }} />
                    <span className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-info)' }}>Financial Vectors</span>
                    <span className="text-tp-xs font-bold text-app-muted-foreground">{lines.length} lines</span>
                </div>

                {/* Column Headers */}
                <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 border-b border-app-border/30 text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 90%, transparent)' }}>
                    <div className="w-6 text-center flex-shrink-0">#</div>
                    <div className="w-16 flex-shrink-0">Code</div>
                    <div className="flex-1 min-w-0">Account Name</div>
                    <div className="hidden lg:block w-32 flex-shrink-0">Description</div>
                    <div className="w-24 text-right flex-shrink-0">Debit</div>
                    <div className="w-24 text-right flex-shrink-0">Credit</div>
                </div>

                {/* Scrollable Lines */}
                <div className="flex-1 min-h-0 overflow-auto overscroll-contain custom-scrollbar">
                    {lines.map((line: any, i: number) => {
                        const debit = Number(line.debit || 0)
                        const credit = Number(line.credit || 0)
                        const isDebit = debit > 0
                        return (
                            <div key={line.id || i}
                                className="group flex items-center gap-2 px-4 py-2 border-b border-app-border/15 hover:bg-app-surface/50 transition-all duration-100"
                                style={i % 2 === 1 ? { background: 'color-mix(in srgb, var(--app-border) 4%, transparent)' } : {}}>

                                {/* # */}
                                <div className="w-6 text-center flex-shrink-0">
                                    <span className="text-tp-xxs font-bold text-app-muted-foreground/60">{i + 1}</span>
                                </div>

                                {/* Code badge */}
                                <div className="w-16 flex-shrink-0">
                                    <span className="font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                            background: `color-mix(in srgb, ${isDebit ? 'var(--app-primary)' : 'var(--app-error)'} 8%, transparent)`,
                                            color: isDebit ? 'var(--app-primary)' : 'var(--app-error)',
                                        }}>
                                        {line.account?.code || '—'}
                                    </span>
                                </div>

                                {/* Account name */}
                                <div className="flex-1 min-w-0">
                                    <span className="text-tp-sm font-bold text-app-foreground truncate block">{line.account?.name || '—'}</span>
                                </div>

                                {/* Line description */}
                                <div className="hidden lg:block w-32 flex-shrink-0">
                                    <span className="text-tp-xs text-app-muted-foreground truncate block">{line.description || ''}</span>
                                </div>

                                {/* Debit */}
                                <div className="w-24 text-right flex-shrink-0">
                                    {debit > 0 && (
                                        <span className="font-mono text-tp-sm font-bold tabular-nums" style={{ color: 'var(--app-primary)' }}>
                                            {fmt(debit)}
                                        </span>
                                    )}
                                </div>

                                {/* Credit */}
                                <div className="w-24 text-right flex-shrink-0">
                                    {credit > 0 && (
                                        <span className="font-mono text-tp-sm font-bold tabular-nums" style={{ color: 'var(--app-error)' }}>
                                            {fmt(credit)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    {/* Empty state */}
                    {lines.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileText size={28} className="text-app-muted-foreground mb-2 opacity-30" />
                            <p className="text-tp-sm font-bold text-app-muted-foreground">No journal lines</p>
                        </div>
                    )}
                </div>

                {/* ── TOTALS ROW (pinned at bottom) ── */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-t-2 border-app-border/40 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                    <div className="w-6 flex-shrink-0" />
                    <div className="w-16 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="text-tp-xs font-bold uppercase tracking-wider text-app-foreground">Total</span>
                    </div>
                    <div className="hidden lg:block w-32 flex-shrink-0" />
                    <div className="w-24 text-right flex-shrink-0">
                        <span className="font-mono text-tp-md font-bold tabular-nums" style={{ color: 'var(--app-primary)' }}>
                            {fmt(totalDebit)}
                        </span>
                    </div>
                    <div className="w-24 text-right flex-shrink-0">
                        <span className="font-mono text-tp-md font-bold tabular-nums" style={{ color: 'var(--app-error)' }}>
                            {fmt(totalCredit)}
                        </span>
                    </div>
                </div>

                {/* ── BALANCE PROOF BAR ── */}
                <div className="flex items-center justify-between px-4 py-1.5 border-t border-app-border/20 flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${isBalanced ? 'var(--app-success)' : 'var(--app-error)'} 4%, transparent)` }}>
                    <div className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-wider"
                        style={{ color: isBalanced ? 'var(--app-success)' : 'var(--app-error)' }}>
                        {isBalanced ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                        {isBalanced ? 'Double-Entry Balanced' : `Out of Balance: ${fmt(Math.abs(totalDebit - totalCredit))}`}
                    </div>
                    <div className="flex items-center gap-3 text-tp-xxs font-bold text-app-muted-foreground">
                        {entry.created_by && (
                            <span>By {entry.created_by.first_name || entry.created_by.username}</span>
                        )}
                        {postedAt && <span>Posted {postedAt}</span>}
                        {entry.source_module && (
                            <span className="font-mono px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)' }}>
                                {entry.source_module}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════ POSTING SNAPSHOT (collapsed into table footer) ═══════════════ */}
            {entry.posting_snapshot && entry.posting_snapshot.length > 0 && (
                <div className="mt-2 rounded-xl border border-app-border/30 overflow-hidden flex-shrink-0" style={{ background: 'var(--app-surface)' }}>
                    <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-app-border/20"
                        style={{ background: 'color-mix(in srgb, var(--app-success) 4%, transparent)' }}>
                        <div className="w-0.5 h-3 rounded-full" style={{ background: 'var(--app-success)' }} />
                        <span className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-success)' }}>Posting Rules Snapshot</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
                        {entry.posting_snapshot.map((snap: any, i: number) => (
                            <span key={i} className="text-tp-xxs font-mono font-bold text-app-muted-foreground">
                                {snap.event_code}: <span style={{ color: 'var(--app-foreground)' }}>{snap.account_code}</span> {snap.account_name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  HELPER COMPONENTS
 * ═══════════════════════════════════════════════════════════ */

function MiniKPI({ label, value, color, icon }: {
    label: string; value: any; color: string; icon: React.ReactNode
}) {
    return (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
            }}>
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                {icon}
            </div>
            <div>
                <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground leading-none">{label}</div>
                <div className="text-tp-md font-bold font-mono tabular-nums leading-tight" style={{ color }}>{value ?? '—'}</div>
            </div>
        </div>
    )
}

function DetailCell({ label, value, mono, color }: {
    label: string; value: any; mono?: boolean; color?: string
}) {
    return (
        <div>
            <div className="text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wide leading-tight">{label}</div>
            <div className={`text-tp-sm font-bold text-app-foreground leading-tight ${mono ? 'font-mono tabular-nums' : ''}`}
                style={color && value && value !== '—' ? { color } : undefined}>
                {value ?? '—'}
            </div>
        </div>
    )
}

function getStatusConfig(status: string): { label: string; color: string } {
    switch (status) {
        case 'POSTED': return { label: 'Posted', color: 'var(--app-success)' }
        case 'DRAFT': return { label: 'Draft', color: 'var(--app-warning)' }
        case 'REVERSED': return { label: 'Reversed', color: 'var(--app-error)' }
        default: return { label: status, color: 'var(--app-muted-foreground)' }
    }
}