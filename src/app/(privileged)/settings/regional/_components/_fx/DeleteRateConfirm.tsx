'use client'
/**
 * FX Management — DeleteRateConfirm modal.
 * Extracted verbatim from FxRedesigned.tsx (was inline inside RateHistoryView).
 */
import { Trash2, AlertTriangle } from 'lucide-react'
import { type ExchangeRate } from '@/app/actions/finance/currency'
import { grad, soft, FG_PRIMARY } from '../fx/_shared'

export function DeleteRateConfirm({ rate, busy, onCancel, onConfirm }: {
    rate: ExchangeRate
    busy: boolean
    onCancel: () => void
    onConfirm: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, var(--app-border))' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-error)' }} />
                <div className="px-5 pt-5 pb-3">
                    <div className="font-black inline-flex items-center gap-2" style={{ fontSize: 14, color: 'var(--app-error)' }}>
                        <AlertTriangle size={14} /> Delete rate?
                    </div>
                    <p className="font-bold uppercase tracking-widest mt-0.5"
                        style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                        This action is permanent
                    </p>
                </div>
                <div className="px-5 pb-4 space-y-2.5">
                    <div className="rounded-xl p-3 font-mono"
                        style={{ ...soft('--app-error', 6), border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)', fontSize: 11, color: 'var(--app-foreground)' }}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-black">{rate.from_code} → {rate.to_code}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                style={{ ...soft(rate.rate_side === 'BID' ? '--app-success' : rate.rate_side === 'ASK' ? '--app-error' : '--app-muted-foreground', 12) }}>
                                {rate.rate_type} · {rate.rate_side ?? 'MID'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                            <span>1 {rate.from_code} = <strong style={{ color: 'var(--app-foreground)' }}>{Number(rate.rate).toFixed(6)}</strong> {rate.to_code}</span>
                            <span>{rate.effective_date}</span>
                        </div>
                        {rate.source && (
                            <div className="mt-1 text-[9px] uppercase tracking-widest font-black" style={{ color: 'var(--app-muted-foreground)' }}>
                                Source · {rate.source}
                            </div>
                        )}
                    </div>
                    <p className="leading-relaxed" style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                        Rate-history entries posted by past transactions remain in those journal entries even after the rate row is deleted.
                        If this rate has been used to post a journal, the entries are unaffected — only future revaluations will use the new rate.
                    </p>
                </div>
                <div className="px-4 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <button onClick={onCancel} disabled={busy}
                        className="px-3.5 py-1.5 rounded-xl font-bold border disabled:opacity-50"
                        style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                        style={busy
                            ? { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }
                            : { ...grad('--app-error'), color: FG_PRIMARY, fontSize: 11 }}>
                        <Trash2 size={11} />
                        {busy ? 'Deleting…' : 'Delete rate'}
                    </button>
                </div>
            </div>
        </div>
    )
}
