'use client'

import { useState } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import type { Currency, ExchangeRate } from '@/app/actions/finance/currency'
import { RATE_TYPES, INPUT_CLS, INPUT_STYLE, grad, soft } from './constants'

export function NewRateForm({ currencies, base, onCancel, onSubmit }: {
    currencies: Currency[]
    base: Currency
    onCancel: () => void
    onSubmit: (p: { from_currency: number; to_currency: number; rate: string; rate_type: ExchangeRate['rate_type']; effective_date: string; source?: string }) => Promise<void>
}) {
    const non_base = currencies.filter(c => c.id !== base.id && c.is_active)
    const [fromId, setFromId] = useState<number | null>(non_base[0]?.id ?? null)
    const [rate, setRate] = useState('1.000000')
    const [rateType, setRateType] = useState<ExchangeRate['rate_type']>('SPOT')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [busy, setBusy] = useState(false)
    if (!fromId) return (
        <p className="text-[10px] text-app-muted-foreground">Add a non-base currency in the Currencies tab before entering rates.</p>
    )
    const fromCode = non_base.find(c => c.id === fromId)?.code ?? '???'
    const rateNum = Number(rate)
    const rateValid = isFinite(rateNum) && rateNum > 0
    const valid = rateValid && !!fromId
    return (
        <div className="space-y-3">
            {/* Header band — same accent (success) as the rates tab. */}
            <div className="flex items-center gap-2">
                <TrendingUp size={11} style={{ color: 'var(--app-success)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>New Exchange Rate</span>
                <span className="text-[9px] text-app-muted-foreground">— manual entry · stored under <code className="font-mono">source=MANUAL</code></span>
            </div>

            {/* Pair + rate type + date — same row, prefix/suffix labels mirror NewPolicyForm. */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-end">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">From</div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={{ background: 'var(--app-background)', borderColor: 'var(--app-border)' }}>
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 11, background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', borderRight: '1px solid var(--app-border)' }}>1×</span>
                        <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono outline-none bg-transparent text-app-foreground">
                            {non_base.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="self-end pb-1 text-center pr-1 pl-1">
                    <span className="text-[12px] font-mono font-black text-app-muted-foreground">→</span>
                </div>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">Rate (in {base.code})</div>
                    <div className="flex items-stretch rounded-lg overflow-hidden border"
                        style={rateValid
                            ? { background: 'var(--app-background)', borderColor: 'var(--app-border)' }
                            : { background: 'var(--app-background)', borderColor: 'color-mix(in srgb, var(--app-error) 50%, transparent)' }}>
                        <input value={rate} onChange={e => setRate(e.target.value)} placeholder="1.000000"
                            inputMode="decimal"
                            className="flex-1 px-2 py-1.5 text-[12px] font-mono tabular-nums font-black outline-none bg-transparent text-app-foreground" />
                        <span className="px-3 flex items-center font-mono font-black text-app-muted-foreground"
                            style={{ fontSize: 11, background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', borderLeft: '1px solid var(--app-border)' }}>{base.code}</span>
                    </div>
                </div>
                <div className="self-end pb-2 text-center text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">·</div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">Type</div>
                        <select value={rateType} onChange={e => setRateType(e.target.value as ExchangeRate['rate_type'])}
                            className={INPUT_CLS} style={INPUT_STYLE}>
                            {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-app-foreground mb-1">Date</div>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} />
                    </div>
                </div>
            </div>

            {/* Inline preview / error line. */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                {!rateValid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>
                        <AlertTriangle size={10} /> Rate must be a positive number
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md"
                        style={{ ...soft('--app-success', 8), color: 'var(--app-success)' }}
                        title={`On ${date}, 1 ${fromCode} will convert to ${rateNum.toFixed(6)} ${base.code}`}>
                        <TrendingUp size={10} /> Preview: 1 {fromCode} = <strong className="font-black">{rateNum.toFixed(6)}</strong> {base.code} on {date}
                    </span>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={onCancel} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border/50 hover:bg-app-background transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button disabled={!valid || busy} onClick={async () => {
                        setBusy(true)
                        try {
                            await onSubmit({ from_currency: fromId!, to_currency: base.id, rate, rate_type: rateType, effective_date: date, source: 'MANUAL' })
                        } finally { setBusy(false) }
                    }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all"
                        style={!busy && valid
                            ? { ...grad('--app-success'), color: 'var(--app-primary-foreground, white)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-success) 30%, transparent)' }
                            : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        {busy ? 'Adding…' : 'Add Rate'}
                    </button>
                </div>
            </div>
        </div>
    )
}
