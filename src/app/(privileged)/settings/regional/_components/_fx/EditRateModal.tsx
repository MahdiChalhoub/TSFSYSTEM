'use client'
/**
 * FX Management — EditRateModal (rate-history row editor).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import {
    updateExchangeRate,
    type ExchangeRate,
} from '@/app/actions/finance/currency'
import {
    grad, FG_PRIMARY,
    INPUT_CLS, INPUT_STYLE,
    Field,
} from '../fx/_shared'
import { RATE_TYPES } from './constants'
import { PrefixInput } from './atoms'

export function EditRateModal({ rate, onClose, onSaved }: {
    rate: ExchangeRate
    onClose: () => void
    onSaved: () => Promise<void>
}) {
    const [rateValue, setRateValue] = useState(rate.rate)
    const [rateType, setRateType] = useState<ExchangeRate['rate_type']>(rate.rate_type)
    const [side, setSide] = useState<'MID' | 'BID' | 'ASK'>(rate.rate_side ?? 'MID')
    const [date, setDate] = useState(rate.effective_date)
    const [busy, setBusy] = useState(false)
    const num = Number(rateValue)
    const valid = isFinite(num) && num > 0
    const dirty = rateValue !== rate.rate || rateType !== rate.rate_type
        || side !== (rate.rate_side ?? 'MID') || date !== rate.effective_date

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'var(--app-info)' }} />
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                    <div>
                        <div className="font-black" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                            Edit rate · {rate.from_code}→{rate.to_code}
                        </div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            #{rate.id} · originally {rate.source ?? 'manual'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={14} />
                    </button>
                </div>
                <div className="px-5 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Type">
                            <select value={rateType} onChange={e => setRateType(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                {RATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Side">
                            <select value={side} onChange={e => setSide(e.target.value as any)}
                                className={INPUT_CLS} style={INPUT_STYLE}>
                                <option value="MID">MID</option>
                                <option value="BID">BID</option>
                                <option value="ASK">ASK</option>
                            </select>
                        </Field>
                    </div>
                    <Field label="Date">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className={INPUT_CLS} style={INPUT_STYLE} />
                    </Field>
                    <Field label={`Rate (1 ${rate.from_code} = ? ${rate.to_code})`} error={!valid}
                        hint={!valid ? 'Must be a positive number' : undefined}>
                        <PrefixInput tone="--app-info" prefix={`1 ${rate.from_code} =`} suffix={rate.to_code}
                            value={rateValue} onChange={setRateValue} valid={valid} placeholder="1.000000" />
                    </Field>
                </div>
                <div className="px-4 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <button onClick={onClose}
                        className="px-3.5 py-1.5 rounded-xl font-bold border"
                        style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        Cancel
                    </button>
                    <button disabled={!valid || !dirty || busy} onClick={async () => {
                        setBusy(true)
                        const r = await updateExchangeRate(rate.id, {
                            rate: rateValue, rate_type: rateType, rate_side: side, effective_date: date,
                        })
                        setBusy(false)
                        if (!r.success) { toast.error(r.error || 'Update failed'); return }
                        toast.success('Rate updated')
                        await onSaved()
                    }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold disabled:opacity-50"
                        style={!busy && valid && dirty
                            ? { ...grad('--app-info'), color: FG_PRIMARY, fontSize: 11 }
                            : { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }}>
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
