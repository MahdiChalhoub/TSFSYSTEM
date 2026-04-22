'use client'

import { Loader2 } from 'lucide-react'
import { TYPE_CONFIG } from './types'

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
            <div className="flex gap-2 items-end">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-2 rounded-xl text-tp-md font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                >
                    {isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save'}
                </button>
            </div>
        </form>
    )
}
