'use client'
/**
 * FX Management — MANUAL RATE MODAL.
 * Extracted verbatim from FxRedesigned.tsx.
 *
 * Manual rate entry. Two modes:
 *    - "Mid only" (default)        — single rate input, writes one MID row.
 *    - "Bid + Mid + Ask"           — three rate inputs, writes a triple.
 *  Backend's unique-together is (org, from, to, date, type, side), so writing
 *  three rows with distinct sides is safe and idempotent for re-edits.
 */
import { useEffect, useRef, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import {
    type Currency, type ExchangeRate,
} from '@/app/actions/finance/currency'
import { ManualRateForm } from './ManualRateForm'

export function ManualRateModal({ base, currencies, onRefresh, onClose, onSubmit }: {
    /** Optional — modal falls back to `currencies.find(c => c.is_base)` so
     *  clicking the button works even before the mirror finishes loading. */
    base?: Currency
    currencies: Currency[]
    /** Called when the modal opens with no base in `currencies`. Re-fetches
     *  the parent's loadAll(); modal re-renders when state updates. Without
     *  this, a click on Add Manual Rate during the initial fetch would
     *  permanently show the "Set a base currency first" notice. */
    onRefresh?: () => Promise<void>
    onClose: () => void
    onSubmit: (p: { from_currency: number; to_currency: number; rate: string; rate_type: ExchangeRate['rate_type']; rate_side?: 'MID' | 'BID' | 'ASK'; effective_date: string; source?: string }) => Promise<void>
}) {
    const baseCcy = base ?? currencies.find(c => c.is_base)
    const [refreshing, setRefreshing] = useState(false)
    // Stable ref so onRefresh churn from parent re-renders doesn't keep
    // re-running this effect (didRefresh prevents the body firing twice, but
    // the dep churn was visibly thrashing).
    const onRefreshRef = useRef(onRefresh)
    onRefreshRef.current = onRefresh
    const didRefresh = useRef(false)

    useEffect(() => {
        if (!baseCcy && !didRefresh.current && onRefreshRef.current) {
            didRefresh.current = true
            setRefreshing(true)
            onRefreshRef.current().finally(() => { setRefreshing(false) })
        }
    }, [baseCcy])

    // CRITICAL: don't put hooks after this early-return. ManualRateForm holds
    // all the form-specific hooks so React's hook-order invariant is preserved
    // when baseCcy transitions from undefined → defined.
    if (!baseCcy) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
                <div className="w-full max-w-md rounded-2xl overflow-hidden p-5"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    {refreshing ? (
                        <>
                            <div className="font-black mb-2 inline-flex items-center gap-2" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                                <RefreshCcw size={14} className="animate-spin" /> Loading currencies…
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                                Refreshing the currency list. This usually takes a second.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="font-black mb-2" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>Set a base currency first</div>
                            <p style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                                Manual-rate entries store the value in your base currency. Mark one of your enabled currencies as ⭐ base
                                in the <em>Select Currency</em> tab, then come back here. Currently loaded:
                                {' '}<strong>{currencies.length}</strong> currenc{currencies.length === 1 ? 'y' : 'ies'},
                                {' '}base = <strong>{currencies.find(c => c.is_base)?.code ?? 'none'}</strong>.
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                                {onRefresh && (
                                    <button onClick={() => {
                                        setRefreshing(true)
                                        onRefresh().finally(() => setRefreshing(false))
                                    }}
                                        className="px-3.5 py-1.5 rounded-xl font-bold border"
                                        style={{
                                            fontSize: 11,
                                            color: 'var(--app-info)',
                                            borderColor: 'color-mix(in srgb, var(--app-info) 30%, transparent)',
                                            background: 'color-mix(in srgb, var(--app-info) 6%, transparent)',
                                        }}>
                                        <RefreshCcw size={11} className="inline -mt-0.5 mr-1" /> Refresh
                                    </button>
                                )}
                                <button onClick={onClose} className="px-3.5 py-1.5 rounded-xl font-bold border"
                                    style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                                    Close
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }
    return <ManualRateForm baseCcy={baseCcy} currencies={currencies} onClose={onClose} onSubmit={onSubmit} />
}
