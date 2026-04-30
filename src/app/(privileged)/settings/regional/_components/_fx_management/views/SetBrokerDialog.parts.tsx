'use client'

import { RefreshCcw, Check } from 'lucide-react'
import type { Currency, CurrencyRatePolicy } from '@/app/actions/finance/currency'
import { soft } from '../constants'

/** Currency multi-select chips — only when scope ≠ all.
 *  Source = ALL active non-base currencies the org has enabled
 *  (not just policy-bearing ones). For currencies without a
 *  policy yet, the backend will create one with the chosen
 *  broker when create_if_missing is set in the apply payload. */
export function BrokerChipPicker({
    currencies, policies, scope, codes, setCodes, provider,
}: {
    currencies: Currency[]
    policies: CurrencyRatePolicy[]
    scope: 'include' | 'exclude'
    codes: string[]
    setCodes: React.Dispatch<React.SetStateAction<string[]>>
    provider: CurrencyRatePolicy['provider']
}) {
    const policyCodes = new Set(policies.map(p => p.from_code))
    // Prefer the parent's OrgCurrency snapshot when available so
    // the chip list works even if the finance.Currency mirror lags.
    const fromMirror = currencies.filter(c => !c.is_base && c.is_active).map(c => c.code)
    const allCodes = Array.from(new Set([...fromMirror, ...policyCodes])).sort()
    if (allCodes.length === 0) return (
        <p className="text-[10px] text-app-muted-foreground italic">
            No active currencies — enable some in the <em>Select Currency</em> tab first.
        </p>
    )
    const toggleCode = (code: string) => {
        setCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
    }
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">
                    {scope === 'include' ? '3. Pick currencies to switch' : '3. Pick currencies to KEEP unchanged'}
                </span>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setCodes(allCodes)}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                        style={{ color: 'var(--app-warning)' }}>Select all</button>
                    <button type="button" onClick={() => setCodes([])}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-warning/10"
                        style={{ color: 'var(--app-warning)' }}>Clear</button>
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {allCodes.map(code => {
                    const active = codes.includes(code)
                    const hasPolicy = policyCodes.has(code)
                    return (
                        <button key={code} type="button" onClick={() => toggleCode(code)}
                            title={hasPolicy
                                ? `Existing policy will be re-pointed to ${provider}`
                                : `No policy yet — a new one will be created with ${provider}`}
                            className="px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all inline-flex items-center gap-1"
                            style={active
                                ? { ...soft('--app-warning', 14), color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)' }
                                : { background: 'var(--app-background)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                            {active && <Check size={9} className="-mt-px" />}
                            {code}
                            {!hasPolicy && (
                                <span className="text-[8px] uppercase tracking-widest font-bold ml-0.5"
                                    style={{ color: active ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}>
                                    · new
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/** Impact preview — counts updated vs created policies for the
 *  currently selected scope/codes. */
export function BrokerImpactPreview({
    policies, scope, codes, provider,
}: {
    policies: CurrencyRatePolicy[]
    scope: 'all' | 'include' | 'exclude'
    codes: string[]
    provider: CurrencyRatePolicy['provider']
}) {
    const total = policies.length
    const policyCodesNow = new Set(policies.map(p => p.from_code))
    let updatedN = 0
    let createdN = 0
    if (scope === 'all') {
        updatedN = total
    } else if (scope === 'include') {
        updatedN = policies.filter(p => codes.includes(p.from_code)).length
        createdN = codes.filter(c => !policyCodesNow.has(c)).length
    } else {
        updatedN = policies.filter(p => !codes.includes(p.from_code)).length
    }
    return (
        <div className="rounded-md p-2.5 flex items-start gap-2"
            style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
            <RefreshCcw size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--app-info)' }} />
            <div className="text-[10px] leading-relaxed text-app-foreground">
                <strong className="font-black uppercase tracking-widest text-[9px]" style={{ color: 'var(--app-info)' }}>Impact</strong> —
                {updatedN > 0 && (
                    <> <strong className="font-black">{updatedN}</strong> polic{updatedN === 1 ? 'y' : 'ies'} switched to <strong className="font-black">{provider}</strong></>
                )}
                {createdN > 0 && (
                    <>{updatedN > 0 ? ' · ' : ' '}<strong className="font-black" style={{ color: 'var(--app-success)' }}>{createdN} new</strong> polic{createdN === 1 ? 'y' : 'ies'} created with <strong className="font-black">{provider}</strong></>
                )}
                {updatedN === 0 && createdN === 0 && <> Nothing selected — pick currencies or change scope.</>}
                {(updatedN > 0 || createdN > 0) && <>. Sync history is preserved; old <code className="font-mono">OK</code>/<code className="font-mono">FAIL</code> flags reset.</>}
            </div>
        </div>
    )
}
