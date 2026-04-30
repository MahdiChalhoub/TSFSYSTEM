'use client'
/**
 * FX Management — ManualRateForm (the actual form body for manual rate entry).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { TrendingUp, X } from 'lucide-react'
import {
    type Currency, type ExchangeRate,
} from '@/app/actions/finance/currency'
import {
    grad, soft, FG_PRIMARY,
    INPUT_CLS, INPUT_STYLE,
    Field,
} from '../fx/_shared'
import { RATE_TYPES } from './constants'
import { PrefixInput } from './atoms'

export function ManualRateForm({ baseCcy, currencies, onClose, onSubmit }: {
    baseCcy: Currency
    currencies: Currency[]
    onClose: () => void
    onSubmit: (p: { from_currency: number; to_currency: number; rate: string; rate_type: ExchangeRate['rate_type']; rate_side?: 'MID' | 'BID' | 'ASK'; effective_date: string; source?: string }) => Promise<void>
}) {
    const non_base = currencies.filter(c => c.id !== baseCcy.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    const [mode, setMode] = useState<'mid' | 'three'>('mid')
    const [midRate, setMidRate] = useState('1.000000')
    const [bidRate, setBidRate] = useState('')
    const [askRate, setAskRate] = useState('')
    const [rateType, setRateType] = useState<ExchangeRate['rate_type']>('SPOT')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [busy, setBusy] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

    const fromCode = non_base.find(c => c.id === fromId)?.code ?? '???'
    const mid = Number(midRate)
    const bid = Number(bidRate)
    const ask = Number(askRate)
    const midValid = isFinite(mid) && mid > 0
    const threeValid = midValid
        && isFinite(bid) && bid > 0 && bid <= mid
        && isFinite(ask) && ask > 0 && ask >= mid
    const valid = mode === 'mid' ? midValid : threeValid

    // When user switches to 'three', auto-fill bid/ask with mid as a starting
    // point so they don't see empty fields screaming "invalid".
    useEffect(() => {
        if (mode === 'three' && !bidRate && midValid) setBidRate(midRate)
        if (mode === 'three' && !askRate && midValid) setAskRate(midRate)
    }, [mode, midRate, midValid])  // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-success) 30%, var(--app-border))' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-success)' }} />
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                    <div>
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>Add Manual Rate</div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>One-off entry · stored under <code className="font-mono">source=MANUAL</code></p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>
                <div className="px-5 pb-4 space-y-3">
                    {/* Pair + type + date */}
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="From">
                            <select value={fromId ?? ''} onChange={e => setFromId(Number(e.target.value))}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                {non_base.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                            </select>
                        </Field>
                        <Field label={`To (always ${baseCcy.code})`}>
                            <div className={INPUT_CLS + ' font-mono font-black flex items-center'}
                                style={{ ...INPUT_STYLE, justifyContent: 'center', color: 'var(--app-muted-foreground)' }}>
                                {baseCcy.code}
                            </div>
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Type">
                            <select value={rateType} onChange={e => setRateType(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Date">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                className={INPUT_CLS} style={INPUT_STYLE} />
                        </Field>
                    </div>

                    {/* Mode toggle: mid-only vs three-sided */}
                    <Field label="Sides">
                        <div className="inline-flex items-stretch rounded-xl overflow-hidden border h-9 w-full"
                            style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            {([
                                { key: 'mid' as const,   label: 'Mid only',          hint: 'Single quote (most common)' },
                                { key: 'three' as const, label: 'Bid + Mid + Ask',   hint: 'Two-sided quote (transactional)' },
                            ]).map((opt, idx) => {
                                const active = mode === opt.key
                                return (
                                    <button key={opt.key} type="button" onClick={() => setMode(opt.key)}
                                        title={opt.hint}
                                        className="flex-1 inline-flex items-center justify-center font-bold transition-all"
                                        style={{
                                            fontSize: 11,
                                            color: active ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                                            background: active ? 'color-mix(in srgb, var(--app-success) 12%, transparent)' : 'transparent',
                                            borderLeft: idx === 0 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        }}>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </Field>

                    {/* Rate inputs */}
                    {mode === 'mid' ? (
                        <Field label={`Rate (1 ${fromCode} = ? ${baseCcy.code})`} error={!midValid}
                            hint={!midValid ? 'Must be a positive number' : undefined}>
                            <PrefixInput tone="--app-success" prefix={`1 ${fromCode} =`} suffix={baseCcy.code}
                                value={midRate} onChange={setMidRate} valid={midValid} placeholder="1.000000" />
                        </Field>
                    ) : (
                        <div className="space-y-2">
                            <Field label={`Bid · operator buys (≤ Mid)`} error={!isFinite(bid) || bid <= 0 || bid > mid}>
                                <PrefixInput tone="--app-success" prefix="−" suffix={baseCcy.code}
                                    value={bidRate} onChange={setBidRate}
                                    valid={isFinite(bid) && bid > 0 && bid <= mid}
                                    placeholder="0.999000" />
                            </Field>
                            <Field label={`Mid · mid-market`} error={!midValid}>
                                <PrefixInput tone="--app-info" prefix="·" suffix={baseCcy.code}
                                    value={midRate} onChange={setMidRate} valid={midValid}
                                    placeholder="1.000000" />
                            </Field>
                            <Field label={`Ask · operator sells (≥ Mid)`} error={!isFinite(ask) || ask <= 0 || ask < mid}>
                                <PrefixInput tone="--app-error" prefix="+" suffix={baseCcy.code}
                                    value={askRate} onChange={setAskRate}
                                    valid={isFinite(ask) && ask > 0 && ask >= mid}
                                    placeholder="1.001000" />
                            </Field>
                            {threeValid && mid > 0 && (
                                <p className="font-mono px-2 py-1.5 rounded-md inline-block"
                                    style={{ ...soft('--app-info', 8), color: 'var(--app-info)', fontSize: 10 }}>
                                    Spread: bid −{((mid - bid) / mid * 100).toFixed(2)}% / ask +{((ask - mid) / mid * 100).toFixed(2)}%
                                </p>
                            )}
                        </div>
                    )}

                    {mode === 'mid' && midValid && (
                        <p className="font-mono px-2 py-1.5 rounded-md inline-block"
                            style={{ ...soft('--app-success', 8), color: 'var(--app-success)', fontSize: 10 }}>
                            <TrendingUp size={10} className="inline -mt-0.5 mr-1" />
                            Preview: 1 {fromCode} = <strong>{mid.toFixed(6)}</strong> {baseCcy.code} on {date}
                        </p>
                    )}
                </div>
                <div className="px-4 py-3 flex items-center justify-between gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                        {progress ? `Saving ${progress.done}/${progress.total}…`
                            : !valid ? (mode === 'mid' ? 'Enter a positive rate' : 'Bid ≤ Mid ≤ Ask, all positive')
                            : mode === 'three' ? 'Will write 3 rows (BID + MID + ASK)'
                            : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose}
                            className="px-3.5 py-1.5 rounded-xl font-bold border"
                            style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                            Cancel
                        </button>
                        <button disabled={!valid || busy} onClick={async () => {
                            setBusy(true)
                            try {
                                if (mode === 'mid') {
                                    setProgress({ done: 0, total: 1 })
                                    await onSubmit({ from_currency: fromId!, to_currency: baseCcy.id, rate: midRate, rate_type: rateType, rate_side: 'MID', effective_date: date, source: 'MANUAL' })
                                    setProgress({ done: 1, total: 1 })
                                } else {
                                    // Three sequential calls — backend's unique-together accepts the trio.
                                    const ops: Array<{ side: 'BID' | 'MID' | 'ASK'; rate: string }> = [
                                        { side: 'BID', rate: bidRate },
                                        { side: 'MID', rate: midRate },
                                        { side: 'ASK', rate: askRate },
                                    ]
                                    setProgress({ done: 0, total: ops.length })
                                    for (let i = 0; i < ops.length; i++) {
                                        await onSubmit({
                                            from_currency: fromId!, to_currency: baseCcy.id,
                                            rate: ops[i].rate, rate_type: rateType,
                                            rate_side: ops[i].side, effective_date: date, source: 'MANUAL',
                                        })
                                        setProgress({ done: i + 1, total: ops.length })
                                    }
                                }
                                onClose()  // triggers parent's reload
                            } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Failed')
                            } finally { setBusy(false); setProgress(null) }
                        }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                            style={!busy && valid
                                ? { ...grad('--app-success'), color: FG_PRIMARY, fontSize: 11, boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }
                                : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                            {busy ? 'Adding…' : mode === 'three' ? 'Add 3 rows' : 'Add rate'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
