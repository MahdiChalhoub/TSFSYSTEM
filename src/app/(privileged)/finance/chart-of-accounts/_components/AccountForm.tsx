'use client'

import { Loader2, Lock } from 'lucide-react'
import { TYPE_CONFIG } from './types'
import { useScope } from '@/hooks/useScope'

interface AccountFormProps {
    accounts: Record<string, any>[]
    isPending: boolean
    onSubmit: (formData: FormData) => void
    initialData?: Record<string, any>
    preselectedParentId?: number
    onCancel: () => void
    title?: string
}

export function AccountForm({
    accounts,
    isPending,
    onSubmit,
    initialData,
    preselectedParentId,
    onCancel,
    title
}: AccountFormProps) {
    const { isOfficial } = useScope()
    return (
        <form action={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', alignItems: 'end' }}>
            <div className="col-span-full mb-1 flex items-center justify-between">
                <h3 className="text-tp-md font-bold uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                    {title || (preselectedParentId ? 'Add Sub-Account' : 'Add Root Account')}
                </h3>
            </div>
            {[
                { name: 'code', label: 'Code', placeholder: '1010', type: 'input', mono: true, defaultValue: initialData?.code },
                { name: 'name', label: 'Name', placeholder: 'Account Name', type: 'input', defaultValue: initialData?.name },
            ].map(f => (
                <div key={f.name}>
                    <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{f.label}</label>
                    <input
                        name={f.name}
                        placeholder={f.placeholder}
                        required
                        defaultValue={f.defaultValue}
                        className={`w-full text-tp-md px-2.5 py-2 rounded-xl outline-none transition-all ${f.mono ? 'font-mono font-bold' : ''}`}
                        style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                    />
                </div>
            ))}
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Type</label>
                <select name="type" defaultValue={initialData?.type || 'ASSET'} className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Sub-Type</label>
                <select name="subType" defaultValue={initialData?.subType || ''} className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    <option value="">None</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="RECEIVABLE">Receivable</option>
                    <option value="PAYABLE">Payable</option>
                </select>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Parent</label>
                <select name="parentId" defaultValue={initialData?.parentId || preselectedParentId || ''} className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    <option value="">(Root)</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>SYSCOHADA Code</label>
                <input name="syscohadaCode" defaultValue={initialData?.syscohadaCode || ''} placeholder="e.g. 57" className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }} />
            </div>
            {/* Internal-only flag is meaningless in OFFICIAL view (you can't see what you mark).
                Hide it there; preserve the value with a hidden input so editing an existing
                internal account from OFFICIAL view doesn't silently flip it to public. */}
            {isOfficial ? (
                <input type="hidden" name="isInternal" value={initialData?.isInternal ? 'on' : ''} />
            ) : (
                <div className="col-span-full">
                    <label className="flex items-center gap-2 cursor-pointer select-none p-2.5 rounded-xl border" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'var(--app-bg, #020617)' }}>
                        <input
                            type="checkbox"
                            name="isInternal"
                            defaultChecked={!!initialData?.isInternal}
                            className="w-4 h-4 rounded accent-app-warning"
                        />
                        <Lock size={13} style={{ color: 'var(--app-warning, #F59E0B)' }} />
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>Internal-only</span>
                        <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                            — Hidden from the Official view
                        </span>
                    </label>
                </div>
            )}
            {/* ── Multi-currency / Revaluation ─────────────────────────────
                  Drives FX revaluation behaviour. Most operators leave these
                  alone; only set them on accounts that actually transact in
                  a foreign currency. */}
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Currency</label>
                <input
                    name="currency"
                    placeholder="(default)"
                    defaultValue={initialData?.currency || ''}
                    className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none uppercase"
                    maxLength={10}
                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                />
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Monetary class</label>
                <select
                    name="monetaryClassification"
                    defaultValue={initialData?.monetary_classification || initialData?.monetaryClassification || 'MONETARY'}
                    className="w-full text-tp-sm px-2.5 py-2 rounded-xl outline-none"
                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                    title="IAS 21 / ASC 830 — drives the rate type used at FX revaluation."
                >
                    <option value="MONETARY">Monetary (closing rate)</option>
                    <option value="NON_MONETARY">Non-monetary (no reval)</option>
                    <option value="INCOME_EXPENSE">Income/Expense (avg rate)</option>
                </select>
            </div>
            <div className="col-span-full">
                <label className="flex items-center gap-2 cursor-pointer select-none p-2.5 rounded-xl border" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'var(--app-bg, #020617)' }}>
                    <input
                        type="checkbox"
                        name="revaluationRequired"
                        defaultChecked={!!(initialData?.revaluation_required ?? initialData?.revaluationRequired)}
                        className="w-4 h-4 rounded accent-app-info"
                    />
                    <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>Revalue at period end</span>
                    <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                        — Include this account in FX revaluation runs (foreign-currency monetary balances).
                    </span>
                </label>
            </div>

            <div className="col-span-full flex gap-2 items-end justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl text-tp-md font-bold transition-all disabled:opacity-50"
                    style={{
                        background: 'transparent',
                        color: 'var(--app-muted-foreground)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                    }}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2 rounded-xl text-tp-md font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                >
                    {isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save'}
                </button>
            </div>
        </form>
    )
}
