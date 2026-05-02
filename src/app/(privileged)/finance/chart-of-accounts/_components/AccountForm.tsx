'use client'

import { useState } from 'react'
import { Loader2, Lock, Info } from 'lucide-react'
import { TYPE_CONFIG } from './types'
import { useScope } from '@/hooks/useScope'
import { useTranslation } from '@/hooks/use-translation'

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
    const { t } = useTranslation()
    /** Track foreign-currency state in real time. The Monetary classification
     *  field is only meaningful for FX-bearing accounts (IAS 21 / ASC 830);
     *  on a home-currency account it has zero effect at period close. We
     *  hide it unless the user types a currency that isn't blank. */
    const [hasForeignCurrency, setHasForeignCurrency] = useState<boolean>(
        Boolean(initialData?.currency)
    )
    return (
        <form action={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', alignItems: 'end' }}>
            <div className="col-span-full mb-1 flex items-center justify-between">
                <h3 className="text-tp-md font-bold uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                    {title || (preselectedParentId ? t('finance.coa.form_add_sub') : t('finance.coa.form_add_root'))}
                </h3>
            </div>
            {[
                { name: 'code', label: t('finance.coa.form_code'), placeholder: '1010', type: 'input', mono: true, defaultValue: initialData?.code },
                { name: 'name', label: t('finance.coa.form_name'), placeholder: t('finance.coa.form_name_placeholder'), type: 'input', defaultValue: initialData?.name },
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
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_type')}</label>
                <select name="type" defaultValue={initialData?.type || 'ASSET'} className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_subtype')}</label>
                <select name="subType" defaultValue={initialData?.subType || ''} className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    <option value="">{t('finance.coa.form_subtype_none')}</option>
                    <option value="CASH">{t('finance.coa.form_subtype_cash')}</option>
                    <option value="BANK">{t('finance.coa.form_subtype_bank')}</option>
                    <option value="RECEIVABLE">{t('finance.coa.form_subtype_receivable')}</option>
                    <option value="PAYABLE">{t('finance.coa.form_subtype_payable')}</option>
                </select>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_parent')}</label>
                <select name="parentId" defaultValue={initialData?.parentId || preselectedParentId || ''} className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    <option value="">{t('finance.coa.form_parent_root')}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_syscohada')}</label>
                <input name="syscohadaCode" defaultValue={initialData?.syscohadaCode || ''} placeholder={t('finance.coa.form_syscohada_placeholder')} className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }} />
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
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{t('finance.coa.form_internal_only')}</span>
                        <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                            {t('finance.coa.form_internal_hint')}
                        </span>
                    </label>
                </div>
            )}
            {/* ── Multi-currency / Revaluation ─────────────────────────────
                  Drives FX revaluation behaviour. Most operators leave these
                  alone; only set them on accounts that actually transact in
                  a foreign currency. */}
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}
                    title="Leave blank if this account uses your tenant's home currency. Set ONLY when the account holds balances in another currency (e.g. USD/EUR) — then the Monetary class field below appears.">
                    {t('finance.coa.form_currency')}
                </label>
                <input
                    name="currency"
                    placeholder={t('finance.coa.form_currency_placeholder')}
                    defaultValue={initialData?.currency || ''}
                    onChange={(e) => setHasForeignCurrency(Boolean(e.currentTarget.value.trim()))}
                    className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none uppercase"
                    maxLength={10}
                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                />
            </div>
            {/* Monetary class — IAS 21 / ASC 830 — only relevant when this
                account holds a NON-home currency. We hide it on home-currency
                accounts (where it would have zero effect) to remove a source
                of accountant confusion. The hidden input still ships the
                default 'MONETARY' so the backend stays happy. */}
            {hasForeignCurrency ? (
                <div>
                    <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}
                        title="IAS 21 / ASC 830 — controls the FX rate used at period-end revaluation:&#10;• Monetary: closing rate (Cash/AR/AP/Loans)&#10;• Non-Monetary: historical rate, no revaluation (Inventory/Fixed Assets/Capital)&#10;• Income/Expense: average rate (Sales/Costs)">
                        {t('finance.coa.form_monetary_class')}
                        <Info size={11} className="opacity-60" />
                    </label>
                    <select
                        name="monetaryClassification"
                        defaultValue={initialData?.monetary_classification || initialData?.monetaryClassification || 'MONETARY'}
                        className="w-full text-tp-sm px-2.5 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                    >
                        <option value="MONETARY">{t('finance.coa.form_monetary')}</option>
                        <option value="NON_MONETARY">{t('finance.coa.form_non_monetary')}</option>
                        <option value="INCOME_EXPENSE">{t('finance.coa.form_income_expense')}</option>
                    </select>
                </div>
            ) : (
                // Hidden submit so we don't break the backend's required field.
                // Defaults to MONETARY, which is the standard pick anyway.
                <input type="hidden" name="monetaryClassification"
                    value={initialData?.monetary_classification || initialData?.monetaryClassification || 'MONETARY'} />
            )}

            {/* ── Branch scope ─────────────────────────────────────────────
                Auto picks the right behavior from type/system_role/code (the
                derivation in ChartOfAccount.scope_mode). For accountants who
                want to override the auto-classification, set explicitly:
                  • Tenant-wide  — never filtered by branch (AR/AP/Bank/Equity)
                  • Branch-split — filtered to selected branch (Revenue/Expense)
                  • Branch-located — physically scoped (Inventory/WIP)
                Selecting a non-Auto value sets a representative `system_role`
                that the derivation already recognizes — no schema change. */}
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block"
                    style={{ color: 'var(--app-muted-foreground)' }}
                    title="Controls how this account's balance reacts to a Branch filter. Auto picks the right answer based on type and code; override only if the auto-classification is wrong.">
                    Branch Scope
                </label>
                <select
                    name="scopeOverride"
                    defaultValue={(() => {
                        const role = String(initialData?.system_role || '').toUpperCase()
                        if (['INVENTORY','INVENTORY_ASSET','WIP'].includes(role)) return 'BRANCH_LOCATED'
                        if (['REVENUE','REVENUE_CONTROL','COGS','COGS_CONTROL','EXPENSE','DELIVERY_FEES','DEPRECIATION_EXP','BAD_DEBT','GRNI'].includes(role)) return 'BRANCH_SPLIT'
                        if (['AR_CONTROL','AP_CONTROL','CASH_ACCOUNT','BANK_ACCOUNT','RECEIVABLE','PAYABLE','CAPITAL','RETAINED_EARNINGS','LOAN','TAX_PAYABLE','TAX_RECEIVABLE'].includes(role)) return 'TENANT_WIDE'
                        return 'AUTO'
                    })()}
                    className="w-full text-tp-sm px-2.5 py-2 rounded-xl outline-none"
                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                >
                    <option value="AUTO">Auto (recommended)</option>
                    <option value="TENANT_WIDE">🌐 Tenant-wide</option>
                    <option value="BRANCH_SPLIT">🏢 Branch-split</option>
                    <option value="BRANCH_LOCATED">📦 Branch-located</option>
                </select>
            </div>
            {/* "Revalue at period end" — same gating as Monetary class. The
                FX-revaluation pipeline only touches accounts that hold a
                non-home currency. Hide on home-currency accounts so the
                form is shorter; preserve the stored value via hidden input. */}
            {hasForeignCurrency ? (
                <div className="col-span-full">
                    <label className="flex items-center gap-2 cursor-pointer select-none p-2.5 rounded-xl border" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'var(--app-bg, #020617)' }}>
                        <input
                            type="checkbox"
                            name="revaluationRequired"
                            defaultChecked={!!(initialData?.revaluation_required ?? initialData?.revaluationRequired)}
                            className="w-4 h-4 rounded accent-app-info"
                        />
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{t('finance.coa.form_revalue')}</span>
                        <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                            {t('finance.coa.form_revalue_hint')}
                        </span>
                    </label>
                </div>
            ) : (
                <input type="hidden" name="revaluationRequired"
                    value={(initialData?.revaluation_required ?? initialData?.revaluationRequired) ? 'on' : ''} />
            )}

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
                    {t('common.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2 rounded-xl text-tp-md font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                >
                    {isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : t('common.save')}
                </button>
            </div>
        </form>
    )
}
