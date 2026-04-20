'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import type { DraftAuditEntry } from '@/app/actions/finance/fiscal-year'

export interface DraftAuditData {
    drafts: DraftAuditEntry[]
    total: number
    periodName: string
}

export function DraftAuditModal({ data, onClose }: { data: DraftAuditData; onClose: () => void }) {
    const dismiss = useModalDismiss(true, onClose)

    return (
        <div {...dismiss.backdropProps} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div {...dismiss.contentProps} className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="px-5 py-4 flex justify-between items-center"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)' }}>
                            <AlertTriangle size={16} style={{ color: 'var(--app-error, #ef4444)' }} />
                        </div>
                        <div>
                            <h2 className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                Cannot Close {data.periodName}
                            </h2>
                            <p className="text-[10px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                {data.total} draft journal {data.total === 1 ? 'entry' : 'entries'} must be posted or deleted
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-1">
                        {data.drafts.map(d => (
                            <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="flex-shrink-0">
                                    <AlertTriangle size={13} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>{d.reference}</div>
                                    <div className="text-[9px] font-medium truncate" style={{ color: 'var(--app-muted-foreground)' }}>{d.description}</div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                        {d.total_debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[9px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>{d.date}</div>
                                </div>
                            </div>
                        ))}
                        {data.total > data.drafts.length && (
                            <div className="text-[10px] font-bold text-center py-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                ... and {data.total - data.drafts.length} more
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-5 py-3" style={{ borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose}
                        className="w-full py-2 text-[11px] font-bold rounded-xl border transition-all"
                        style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
