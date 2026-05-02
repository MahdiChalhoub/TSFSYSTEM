'use client'

import { useState } from 'react'
import { Loader2, Lock, Info } from 'lucide-react'
import { TYPE_CONFIG } from './types'
import { useScope } from '@/hooks/useScope'
import { useTranslation } from '@/hooks/use-translation'

interface AccountFormProps {
    accounts: Record<string, any>[]
    /** Tenant's enabled currencies (Regional Settings → FX tab). When
     *  provided, the currency field renders as a dropdown of these
     *  currencies + "Default (home)". Empty array → falls back to a
     *  free-text input so legacy callers still work. */
    orgCurrencies?: Record<string, any>[]
    /** Numbering convention for the org's active COA template — drives
     *  child-code suggestion. PCG/SYSCOHADA = `PREFIX_EXTEND` (append
     *  digit); GAAP/IFRS = `FIXED_STEP` with per-depth steps. Empty rules
     *  → no auto-suggest, just a placeholder hint. */
    numberingRules?: { template_key: string; rules: Record<string, any> }
    isPending: boolean
    onSubmit: (formData: FormData) => void
    initialData?: Record<string, any>
    preselectedParentId?: number
    onCancel: () => void
    title?: string
}

export function AccountForm({
    accounts,
    orgCurrencies = [],
    numberingRules,
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
    /** Show the parent's code as a placeholder hint so the user knows the
     *  prefix to extend — but never auto-fill, since each account class
     *  (SYSCOHADA / IFRS / custom) has its own numbering philosophy. */
    const [parentId, setParentId] = useState<string>(
        String(initialData?.parentId || preselectedParentId || '')
    )
    const [type, setType] = useState<string>(initialData?.type || 'ASSET')
    const parentCode = accounts.find(a => String(a.id) === parentId)?.code as string | undefined
    const codePlaceholder = parentCode ? `${parentCode}…` : '1010'

    /** Suggest the next child code per the org's COA template numbering
     *  convention. Reads `numberingRules.rules.scheme`:
     *
     *    PREFIX_EXTEND  (PCG / SYSCOHADA / Lebanese PCN)
     *      - First child of `41` → `411`; next sibling of `4111` → `4112`.
     *      - Children always extend the parent's code by one digit.
     *
     *    FIXED_STEP    (GAAP / IFRS)
     *      - Each depth has its own step: depth 0=1000, 1=100, 2=10, 3=1.
     *      - First child of `1100` → `1110`; next sibling of `1170` → `1180`.
     *
     *  No rule + no siblings → blank (we can't guess across templates).
     *  No rule but ≥2 siblings → infer step from observed gap.
     */
    const suggestNextCode = (pid: string): string => {
        if (!pid) return ''
        const parent = accounts.find(a => String(a.id) === pid)
        if (!parent?.code) return ''
        const parentCodeStr = String(parent.code)

        // Existing children of this parent — used for "next sibling" mode.
        const sibCodes = accounts
            .filter(a => String(a.parentId) === pid)
            .map(a => String(a.code || ''))
            .filter(Boolean)

        const scheme = numberingRules?.rules?.scheme
        const steps: number[] = numberingRules?.rules?.steps || []

        // ── PREFIX_EXTEND ─────────────────────────────────────────────
        if (scheme === 'PREFIX_EXTEND') {
            if (sibCodes.length === 0) {
                // First child: append "1" to the parent prefix (411 from 41).
                return `${parentCodeStr}1`
            }
            // Next sibling: max numeric tail + 1, preserving width.
            const tails = sibCodes
                .filter(c => c.startsWith(parentCodeStr) && c.length > parentCodeStr.length)
                .map(c => c.slice(parentCodeStr.length))
            const numeric = tails.map(t => parseInt(t, 10)).filter(n => !isNaN(n))
            if (numeric.length === 0) return `${parentCodeStr}${sibCodes.length + 1}`
            const next = Math.max(...numeric) + 1
            const width = tails[0]?.length || 1
            return `${parentCodeStr}${String(next).padStart(width, '0')}`
        }

        // ── FIXED_STEP ────────────────────────────────────────────────
        if (scheme === 'FIXED_STEP' && steps.length > 0) {
            // Compute the parent's depth from the parent chain. depth = 0
            // for a root, 1 for child of root, etc.
            let depth = 1
            let cur = parent
            while (cur?.parentId) {
                const p = accounts.find(a => String(a.id) === String(cur!.parentId))
                if (!p) break
                cur = p
                depth++
            }
            // Past the deepest declared step, FIXED_STEP templates (GAAP/
            // IFRS) switch to decimal sub-accounts: 1111 → 1111.01 → 1111.02.
            // Otherwise +step would produce 1112, which is a SIBLING of 1111
            // at the same level — wrong for sub-accounting.
            if (depth >= steps.length) {
                if (sibCodes.length === 0) return `${parentCodeStr}.01`
                // Find existing decimal subs and pick the next .NN.
                const subs = sibCodes
                    .filter(c => c.startsWith(`${parentCodeStr}.`))
                    .map(c => c.slice(parentCodeStr.length + 1))
                const nums = subs.map(t => parseInt(t, 10)).filter(n => !isNaN(n))
                if (nums.length === 0) return `${parentCodeStr}.01`
                const next = Math.max(...nums) + 1
                return `${parentCodeStr}.${String(next).padStart(2, '0')}`
            }
            const step = steps[depth]
            const parentNum = parseFloat(parentCodeStr)
            if (isNaN(parentNum) || step <= 0) return ''
            if (sibCodes.length === 0) {
                // First child: parent + one step (1100 → 1110).
                return String(Math.round(parentNum + step))
            }
            // Next sibling: max sibling + step (1170 → 1180).
            const sibNums = sibCodes.map(c => parseFloat(c)).filter(n => !isNaN(n))
            if (sibNums.length === 0) return ''
            return String(Math.round(Math.max(...sibNums) + step))
        }

        // ── No template rule — fall back to observed-pattern inference ─
        // Only suggests when there are 2+ siblings (we have a real signal).
        if (sibCodes.length >= 2) {
            const sibs = sibCodes
                .map(c => ({ raw: c, num: parseFloat(c) }))
                .filter(s => !isNaN(s.num))
                .sort((a, b) => a.num - b.num)
            if (sibs.length >= 2) {
                const last = sibs[sibs.length - 1]
                const step = last.num - sibs[sibs.length - 2].num
                if (step > 0) {
                    const dotIdx = last.raw.indexOf('.')
                    const decimals = dotIdx >= 0 ? last.raw.length - dotIdx - 1 : 0
                    const next = last.num + step
                    return decimals > 0 ? next.toFixed(decimals) : String(Math.round(next))
                }
            }
        }
        return ''
    }
    const isEdit = Boolean(initialData?.id)
    const [code, setCode] = useState<string>(
        initialData?.code || (preselectedParentId ? suggestNextCode(String(preselectedParentId)) : '')
    )
    /** While `codeIsAuto` is true the code field tracks parent changes;
     *  the moment the user types their own code we lock it. On edit we
     *  never auto-suggest — the existing code is authoritative. */
    const [codeIsAuto, setCodeIsAuto] = useState<boolean>(!isEdit && !initialData?.code)

    /** Map an account's `scope_mode` to the form's scopeOverride value.
     *  The form dropdown uses upper-case ('TENANT_WIDE'); the live record
     *  uses lower-case ('tenant_wide'). */
    const scopeModeToOverride = (mode: string | undefined): string => {
        switch ((mode || '').toLowerCase()) {
            case 'tenant_wide': return 'TENANT_WIDE'
            case 'branch_split': return 'BRANCH_SPLIT'
            case 'branch_located': return 'BRANCH_LOCATED'
            default: return 'AUTO'
        }
    }
    /** Initial scope override:
     *   - Edit: use the account's existing system_role mapping
     *   - Create with a parent: inherit the parent's scope_mode by default
     *   - Create at root: AUTO (let backend derive from type/role)
     */
    const initialScopeOverride: string = (() => {
        if (initialData?.id) {
            const role = String(initialData?.system_role || '').toUpperCase()
            if (['INVENTORY', 'INVENTORY_ASSET', 'WIP'].includes(role)) return 'BRANCH_LOCATED'
            if (['REVENUE', 'REVENUE_CONTROL', 'COGS', 'COGS_CONTROL', 'EXPENSE', 'DELIVERY_FEES', 'DEPRECIATION_EXP', 'BAD_DEBT', 'GRNI'].includes(role)) return 'BRANCH_SPLIT'
            if (['AR_CONTROL', 'AP_CONTROL', 'CASH_ACCOUNT', 'BANK_ACCOUNT', 'RECEIVABLE', 'PAYABLE', 'CAPITAL', 'RETAINED_EARNINGS', 'LOAN', 'TAX_PAYABLE', 'TAX_RECEIVABLE'].includes(role)) return 'TENANT_WIDE'
            return 'AUTO'
        }
        // Creating: inherit the parent's scope when one is selected.
        const parent = accounts.find(a => String(a.id) === parentId)
        return scopeModeToOverride(parent?.scope_mode)
    })()
    const [scopeOverride, setScopeOverride] = useState<string>(initialScopeOverride)
    const [scopeIsAuto, setScopeIsAuto] = useState<boolean>(!isEdit)

    /** Eligible parents — silent-bug guards:
     *  • Active only (inactive accounts can't accept new children)
     *  • Same type (an ASSET can't sit under an EXPENSE tree)
     *  • Not self, not any descendant of self (would create a cycle)
     *  • No direct ledger balance (leaf accounts hold transactions; if a
     *    leaf with a balance becomes a parent, the parent's rollup would
     *    silently double-count its own posted entries against children).
     *  Re-evaluates whenever the user changes type — and on edit, the
     *  current account's own subtree is computed once. */
    const eligibleParents = (() => {
        const selfId = initialData?.id
        const blocked = new Set<string | number>()
        if (selfId) {
            // BFS the descendant subtree to block cycles.
            blocked.add(selfId)
            const queue = [selfId]
            while (queue.length) {
                const current = queue.shift()
                accounts.forEach(a => {
                    if (String(a.parentId) === String(current) && !blocked.has(a.id)) {
                        blocked.add(a.id)
                        queue.push(a.id)
                    }
                })
            }
        }
        return accounts.filter(a => {
            if (a.isActive === false) return false
            if (blocked.has(a.id)) return false
            if (a.type && a.type !== type) return false
            // A leaf with posted entries can't host children — mixing direct
            // ledger balance with child rollups breaks the parent total.
            const direct = Number(a.directBalance ?? 0)
            if (direct !== 0) return false
            return true
        })
    })()
    return (
        <form action={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', alignItems: 'end' }}>
            <div className="col-span-full mb-1 flex items-center justify-between">
                <h3 className="text-tp-md font-bold uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                    {title || (preselectedParentId ? t('finance.coa.form_add_sub') : t('finance.coa.form_add_root'))}
                </h3>
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_code')}</label>
                <input
                    name="code"
                    placeholder={codePlaceholder}
                    required
                    value={code}
                    onChange={e => { setCode(e.target.value); setCodeIsAuto(false) }}
                    className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none transition-all font-mono font-bold"
                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                />
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_name')}</label>
                <input
                    name="name"
                    placeholder={t('finance.coa.form_name_placeholder')}
                    required
                    defaultValue={initialData?.name}
                    className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none transition-all"
                    style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                />
            </div>
            <div>
                <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{t('finance.coa.form_type')}</label>
                <select name="type" value={type} onChange={e => { setType(e.target.value); setParentId('') }} className="w-full text-tp-md px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
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
                <select name="parentId" value={parentId} onChange={e => {
                    const next = e.target.value
                    setParentId(next)
                    if (codeIsAuto) setCode(suggestNextCode(next))
                    // Inherit the parent's branch scope by default. Only when
                    // the user hasn't manually overridden the dropdown — once
                    // they click a value, we stop following the parent.
                    if (scopeIsAuto) {
                        const parent = accounts.find(a => String(a.id) === next)
                        setScopeOverride(scopeModeToOverride(parent?.scope_mode))
                    }
                }} className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none" style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                    <option value="">{t('finance.coa.form_parent_root')}</option>
                    {eligibleParents.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
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
                    title="Leave on Default (home) if this account uses your tenant's home currency. Pick another currency only when the account holds balances in that currency — then the Monetary class field below appears. The list comes from your enabled currencies in Regional Settings → FX.">
                    {t('finance.coa.form_currency')}
                </label>
                {orgCurrencies.length > 0 ? (
                    // Dropdown sourced from /settings/regional?tab=fx (org-currencies).
                    // Default option (empty value) means "use the tenant's home /
                    // default currency" — no explicit currency stored on the account.
                    <select
                        name="currency"
                        defaultValue={initialData?.currency || ''}
                        onChange={(e) => setHasForeignCurrency(Boolean(e.currentTarget.value.trim()))}
                        className="w-full text-tp-sm px-2.5 py-2 rounded-xl outline-none"
                        style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}>
                        {/* The "Default" option (empty value) IS the tenant's
                            default currency — selecting it stores no explicit
                            currency and the account inherits the home currency.
                            We skip the default in the foreign-currency list
                            below so it doesn't appear twice. */}
                        <option value="">
                            {(() => {
                                const def = orgCurrencies.find(c => c.is_default)
                                return def
                                    ? `Default — ${def.currency_code || 'home'}${def.currency_symbol ? ` (${def.currency_symbol})` : ''}`
                                    : 'Default (home currency)'
                            })()}
                        </option>
                        {(() => {
                            const foreign = orgCurrencies
                                .filter(c => c.is_enabled !== false && !c.is_default)
                            if (foreign.length === 0) return null
                            return (
                                <optgroup label="Foreign currencies">
                                    {foreign.map(c => (
                                        <option key={c.id} value={c.currency_code || ''}>
                                            {c.currency_code}
                                            {c.currency_symbol ? ` (${c.currency_symbol})` : ''}
                                            {c.currency_name ? ` — ${c.currency_name}` : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )
                        })()}
                    </select>
                ) : (
                    // Fallback for callers that didn't load org-currencies — same
                    // free-text behavior as before so nothing breaks.
                    <input
                        name="currency"
                        placeholder={t('finance.coa.form_currency_placeholder')}
                        defaultValue={initialData?.currency || ''}
                        onChange={(e) => setHasForeignCurrency(Boolean(e.currentTarget.value.trim()))}
                        className="w-full text-tp-sm font-mono px-2.5 py-2 rounded-xl outline-none uppercase"
                        maxLength={10}
                        style={{ background: 'var(--app-bg, #020617)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                    />
                )}
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
                    value={scopeOverride}
                    onChange={e => { setScopeOverride(e.target.value); setScopeIsAuto(false) }}
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
