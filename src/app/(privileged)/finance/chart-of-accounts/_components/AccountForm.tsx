'use client'

import { useState } from 'react'
import { Loader2, Lock, Info, Hash, Layers, Coins, Building2 } from 'lucide-react'
import { TYPE_CONFIG } from './types'
import { useScope } from '@/hooks/useScope'
import { useTranslation } from '@/hooks/use-translation'

/** Visual section wrapper — groups related fields under a header with an
 *  icon + title. Cleaner than the previous flat grid, especially in the
 *  narrow mobile bottom-sheet layout. */
function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl p-3 sm:p-4"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 35%, transparent)',
            }}>
            <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                    {icon}
                </div>
                <div className="text-tp-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--app-muted-foreground)' }}>{title}</div>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {children}
            </div>
        </div>
    )
}

/** Reusable input/select wrapper — consistent label + control styling. */
function FormField({ label, hint, children, fullSpan }: { label: string; hint?: string; children: React.ReactNode; fullSpan?: boolean }) {
    return (
        <div className={fullSpan ? 'col-span-full' : ''}>
            <label className="text-tp-xxs font-bold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--app-muted-foreground)' }}
                title={hint}>
                {label}
                {hint && <Info size={10} className="inline ml-1 opacity-60" />}
            </label>
            {children}
        </div>
    )
}

const inputClass = "w-full text-tp-md px-3 py-2.5 rounded-xl outline-none transition-all"
const inputStyle: React.CSSProperties = {
    background: 'var(--app-bg, #020617)',
    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
    color: 'var(--app-foreground)',
    minHeight: '42px',  // touch-friendly
}

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
        <form action={onSubmit} className="flex flex-col gap-3">
            {/* Title */}
            <div className="flex items-center justify-between">
                <h3 className="text-tp-lg" style={{ color: 'var(--app-foreground)' }}>
                    {title || (preselectedParentId ? t('finance.coa.form_add_sub') : t('finance.coa.form_add_root'))}
                </h3>
            </div>

            {/* ── Identity ── */}
            <FormSection icon={<Hash size={14} />} title="Identity">
                <FormField label={t('finance.coa.form_code')}>
                    <input
                        name="code"
                        placeholder={codePlaceholder}
                        required
                        value={code}
                        onChange={e => { setCode(e.target.value); setCodeIsAuto(false) }}
                        className={`${inputClass} font-mono font-bold`}
                        style={inputStyle}
                    />
                </FormField>
                <FormField label={t('finance.coa.form_name')}>
                    <input
                        name="name"
                        placeholder={t('finance.coa.form_name_placeholder')}
                        required
                        defaultValue={initialData?.name}
                        className={inputClass}
                        style={inputStyle}
                    />
                </FormField>
                <FormField label={t('finance.coa.form_type')}>
                    <select name="type" value={type} onChange={e => { setType(e.target.value); setParentId('') }} className={inputClass} style={inputStyle}>
                        {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                </FormField>
                <FormField label={t('finance.coa.form_subtype')}>
                    <select name="subType" defaultValue={initialData?.subType || ''} className={inputClass} style={inputStyle}>
                        <option value="">{t('finance.coa.form_subtype_none')}</option>
                        <option value="CASH">{t('finance.coa.form_subtype_cash')}</option>
                        <option value="BANK">{t('finance.coa.form_subtype_bank')}</option>
                        <option value="RECEIVABLE">{t('finance.coa.form_subtype_receivable')}</option>
                        <option value="PAYABLE">{t('finance.coa.form_subtype_payable')}</option>
                    </select>
                </FormField>
            </FormSection>

            {/* ── Hierarchy ── */}
            <FormSection icon={<Layers size={14} />} title="Hierarchy">
                <FormField label={t('finance.coa.form_parent')} fullSpan>
                    <select name="parentId" value={parentId} onChange={e => {
                        const next = e.target.value
                        setParentId(next)
                        if (codeIsAuto) setCode(suggestNextCode(next))
                        if (scopeIsAuto) {
                            const parent = accounts.find(a => String(a.id) === next)
                            setScopeOverride(scopeModeToOverride(parent?.scope_mode))
                        }
                    }} className={`${inputClass} font-mono`} style={inputStyle}>
                        <option value="">{t('finance.coa.form_parent_root')}</option>
                        {eligibleParents.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                </FormField>
                <FormField label={t('finance.coa.form_syscohada')}>
                    <input name="syscohadaCode" defaultValue={initialData?.syscohadaCode || ''} placeholder={t('finance.coa.form_syscohada_placeholder')} className={`${inputClass} font-mono`} style={inputStyle} />
                </FormField>
            </FormSection>

            {/* Internal-only flag — hidden in OFFICIAL view */}
            {isOfficial ? (
                <input type="hidden" name="isInternal" value={initialData?.isInternal ? 'on' : ''} />
            ) : (
                <label className="flex items-center gap-2 cursor-pointer select-none p-3 rounded-xl border"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'var(--app-bg, #020617)' }}>
                    <input type="checkbox" name="isInternal" defaultChecked={!!initialData?.isInternal} className="w-4 h-4 rounded accent-app-warning" />
                    <Lock size={13} style={{ color: 'var(--app-warning, #F59E0B)' }} />
                    <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{t('finance.coa.form_internal_only')}</span>
                    <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {t('finance.coa.form_internal_hint')}
                    </span>
                </label>
            )}
            {/* ── Currency & FX ── */}
            <FormSection icon={<Coins size={14} />} title="Currency">
                <FormField
                    label={t('finance.coa.form_currency')}
                    hint="Leave on Default (home) if this account uses your tenant's home currency. Pick another to enable FX revaluation."
                    fullSpan={!hasForeignCurrency}>
                    {orgCurrencies.length > 0 ? (
                        <select
                            name="currency"
                            defaultValue={initialData?.currency || ''}
                            onChange={(e) => setHasForeignCurrency(Boolean(e.currentTarget.value.trim()))}
                            className={inputClass}
                            style={inputStyle}>
                            <option value="">
                                {(() => {
                                    const def = orgCurrencies.find(c => c.is_default)
                                    return def
                                        ? `Default — ${def.currency_code || 'home'}${def.currency_symbol ? ` (${def.currency_symbol})` : ''}`
                                        : 'Default (home currency)'
                                })()}
                            </option>
                            {(() => {
                                const foreign = orgCurrencies.filter(c => c.is_enabled !== false && !c.is_default)
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
                        <input
                            name="currency"
                            placeholder={t('finance.coa.form_currency_placeholder')}
                            defaultValue={initialData?.currency || ''}
                            onChange={(e) => setHasForeignCurrency(Boolean(e.currentTarget.value.trim()))}
                            className={`${inputClass} font-mono uppercase`}
                            maxLength={10}
                            style={inputStyle}
                        />
                    )}
                </FormField>
                {hasForeignCurrency ? (
                    <FormField label={t('finance.coa.form_monetary_class')}
                        hint="IAS 21 / ASC 830 — controls the FX rate used at period-end revaluation. Monetary = closing rate; Non-Monetary = historical; Income/Expense = average.">
                        <select
                            name="monetaryClassification"
                            defaultValue={initialData?.monetary_classification || initialData?.monetaryClassification || 'MONETARY'}
                            className={inputClass}
                            style={inputStyle}>
                            <option value="MONETARY">{t('finance.coa.form_monetary')}</option>
                            <option value="NON_MONETARY">{t('finance.coa.form_non_monetary')}</option>
                            <option value="INCOME_EXPENSE">{t('finance.coa.form_income_expense')}</option>
                        </select>
                    </FormField>
                ) : (
                    <input type="hidden" name="monetaryClassification"
                        value={initialData?.monetary_classification || initialData?.monetaryClassification || 'MONETARY'} />
                )}
                {hasForeignCurrency && (
                    <label className="col-span-full flex items-center gap-2 cursor-pointer select-none p-3 rounded-xl border"
                        style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'var(--app-bg, #020617)' }}>
                        <input type="checkbox" name="revaluationRequired" defaultChecked={!!(initialData?.revaluation_required ?? initialData?.revaluationRequired)} className="w-4 h-4 rounded accent-app-info" />
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{t('finance.coa.form_revalue')}</span>
                        <span className="text-tp-xs flex-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            {t('finance.coa.form_revalue_hint')}
                        </span>
                    </label>
                )}
                {!hasForeignCurrency && (
                    <input type="hidden" name="revaluationRequired"
                        value={(initialData?.revaluation_required ?? initialData?.revaluationRequired) ? 'on' : ''} />
                )}
            </FormSection>

            {/* ── Branch scope ── */}
            <FormSection icon={<Building2 size={14} />} title="Branch Behavior">
                <FormField label="Branch Scope"
                    hint="Controls how this account's balance reacts to a Branch filter. Auto picks the right answer based on type and code."
                    fullSpan>
                    <select
                        name="scopeOverride"
                        value={scopeOverride}
                        onChange={e => { setScopeOverride(e.target.value); setScopeIsAuto(false) }}
                        className={inputClass}
                        style={inputStyle}>
                        <option value="AUTO">Auto (recommended)</option>
                        <option value="TENANT_WIDE">🌐 Tenant-wide</option>
                        <option value="BRANCH_SPLIT">🏢 Branch-split</option>
                        <option value="BRANCH_LOCATED">📦 Branch-located</option>
                    </select>
                </FormField>
            </FormSection>

            {/* Action bar — sits at the end of the form and scrolls with
                the rest of the content. The previous `sticky bottom-0`
                attached the bar to the scroll container's bottom edge,
                which produced a half-floating bar that wasn't aligned
                with the actual end of the form. */}
            <div className="flex gap-2 justify-end pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-tp-md font-bold transition-all disabled:opacity-50 active:scale-95"
                    style={{
                        background: 'transparent',
                        color: 'var(--app-muted-foreground)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                        minHeight: '44px',
                    }}
                >
                    {t('common.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl text-tp-md font-bold text-white transition-all disabled:opacity-50 active:scale-95"
                    style={{
                        background: 'var(--app-primary)',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                        minHeight: '44px',
                    }}
                >
                    {isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : t('common.save')}
                </button>
            </div>
        </form>
    )
}
