'use client'

import { useState, useTransition } from 'react'
import { Save, Info, Zap, Target, Package, Users, ShoppingCart, CreditCard, BarChart3, Shield, Landmark, Receipt, Truck, AlertTriangle, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { savePostingRules, savePostingRulesWithReclassification, analyzePostingRulesImpact, PostingRulesConfig, PostingRuleImpact } from '@/app/actions/finance/posting-rules'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export default function PostingRulesForm({
    initialConfig,
    accounts
}: {
    initialConfig: PostingRulesConfig,
    accounts: Record<string, any>[]
}) {
    const [config, setConfig] = useState<PostingRulesConfig>(() => {
        const defaults: PostingRulesConfig = {
            sales: { receivable: null, revenue: null, cogs: null, inventory: null, round_off: null, discount: null, vat_collected: null },
            purchases: { payable: null, inventory: null, expense: null, vat_recoverable: null, vat_suspense: null, airsi_payable: null, reverse_charge_vat: null, discount_earned: null, delivery_fees: null, airsi: null },
            inventory: { adjustment: null, transfer: null },
            automation: { customerRoot: null, supplierRoot: null, payrollRoot: null },
            fixedAssets: { depreciationExpense: null, accumulatedDepreciation: null },
            suspense: { reception: null },
            partners: { capital: null, loan: null, withdrawal: null },
            equity: { capital: null, draws: null },
            tax: { vat_payable: null, vat_refund_receivable: null },
        }

        return {
            ...defaults,
            ...initialConfig,
            sales: { ...defaults.sales, ...(initialConfig?.sales || {}) },
            purchases: { ...defaults.purchases, ...(initialConfig?.purchases || {}) },
            inventory: { ...defaults.inventory, ...(initialConfig?.inventory || {}) },
            automation: { ...defaults.automation, ...(initialConfig?.automation || {}) },
            fixedAssets: { ...defaults.fixedAssets, ...(initialConfig?.fixedAssets || {}) },
            suspense: { ...defaults.suspense, ...(initialConfig?.suspense || {}) },
            partners: { ...defaults.partners, ...(initialConfig?.partners || {}) },
            equity: { ...defaults.equity, ...(initialConfig?.equity || {}) },
            tax: { ...defaults.tax, ...(initialConfig?.tax || {}) },
        }
    })
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const searchParams = useSearchParams()
    const fromSetup = searchParams.get('from') === 'setup'
    const [impactDialog, setImpactDialog] = useState<{ impacts: PostingRuleImpact[], hasHighRisk: boolean } | null>(null)

    const handleSave = () => {
        startTransition(async () => {
            // Step 1: Analyze impact (dry run)
            const analysis = await analyzePostingRulesImpact(config)

            if (analysis.has_high_risk && analysis.impact && analysis.impact.length > 0) {
                // Show impact dialog for user decision
                setImpactDialog({
                    impacts: analysis.impact,
                    hasHighRisk: true,
                })
                return
            }

            // No risky changes — save directly
            const result = await savePostingRules(config)
            router.refresh()
            if (result.impact && result.impact.length > 0) {
                toast.success(`Posting rules updated! ${result.impact.length} account(s) changed (no balance impact).`)
            } else {
                toast.success('Posting rules updated successfully!')
            }
        })
    }

    const handleConfirmSave = (reclassify: boolean) => {
        setImpactDialog(null)
        startTransition(async () => {
            if (reclassify) {
                const result = await savePostingRulesWithReclassification(config)
                router.refresh()
                const posted = result.reclassifications?.filter(r => r.status === 'posted').length || 0
                toast.success(`Posting rules saved! ${posted} reclassification JE(s) posted to sweep balances.`)
            } else {
                await savePostingRules(config)
                router.refresh()
                toast.warning('Posting rules saved WITHOUT reclassification. Old balances remain on previous accounts.')
            }
        })
    }

    const autoDetect = () => {
        const newConfig: PostingRulesConfig = JSON.parse(JSON.stringify(config))

        const find = (code: string) => {
            const acc = accounts.find(a => a.code === code)
            return acc ? acc.id : null
        }
        const findByType = (type: string, nameMatch: string) => {
            const acc = accounts.find(a => a.type === type && a.name.toLowerCase().includes(nameMatch.toLowerCase()))
            return acc ? acc.id : null
        }

        // Sales — IFRS → USA GAAP → SYSCOHADA/PCG/PCN → name fallback
        newConfig.sales.receivable = find('1110') || find('1200') || find('411') || find('41') || findByType('ASSET', 'receivable')
        newConfig.sales.revenue = find('4100') || find('4101') || find('701') || find('70') || findByType('INCOME', 'sales')
        newConfig.sales.cogs = find('5100') || find('5101') || find('5000') || find('601') || find('60') || findByType('EXPENSE', 'cost')
        newConfig.sales.inventory = find('1120') || find('1300') || find('31') || find('37') || findByType('ASSET', 'inventory')
        newConfig.sales.round_off = find('9002') || find('6589') || find('7589') || find('758')
        newConfig.sales.discount = find('6190') || find('709') || findByType('EXPENSE', 'discount')
        newConfig.sales.vat_collected = find('2111') || find('4457') || find('443') || find('44') || findByType('LIABILITY', 'vat')

        // Purchases
        newConfig.purchases.payable = find('2101') || find('2100') || find('401') || find('40') || findByType('LIABILITY', 'payable')
        newConfig.purchases.inventory = find('1120') || find('1300') || find('31') || find('37') || find('607') || findByType('ASSET', 'inventory')
        newConfig.purchases.expense = find('5101') || find('6011') || find('5000') || find('601') || find('60') || findByType('EXPENSE', 'purchase')
        newConfig.purchases.vat_recoverable = find('2112') || find('4456') || find('445') || find('44') || findByType('ASSET', 'vat')
        newConfig.purchases.vat_suspense = find('2116') || find('4458') || find('44586')
        newConfig.purchases.airsi_payable = find('2113') || find('4471')
        newConfig.purchases.reverse_charge_vat = find('2114') || find('4452') || findByType('LIABILITY', 'reverse')
        newConfig.purchases.discount_earned = find('4201') || find('7190') || find('609') || find('77') || findByType('INCOME', 'discount')
        newConfig.purchases.delivery_fees = find('5102') || find('6241') || find('624') || find('61') || findByType('EXPENSE', 'freight')

        // Inventory
        newConfig.inventory.adjustment = find('9001') || find('5104') || find('708') || find('709') || findByType('EXPENSE', 'adjustment')
        newConfig.inventory.transfer = find('9002') || find('1120') || find('31')

        // Automation
        newConfig.automation.customerRoot = find('1111') || find('1110') || find('1200') || find('411') || find('41') || findByType('ASSET', 'receivable')
        newConfig.automation.supplierRoot = find('2101') || find('2100') || find('401') || find('40') || findByType('LIABILITY', 'payable')
        newConfig.automation.payrollRoot = find('2200') || find('2121') || find('421') || find('42') || findByType('LIABILITY', 'salary')

        // Fixed Assets
        newConfig.fixedAssets.depreciationExpense = find('6303') || find('681') || find('6109') || find('6302') || find('68') || findByType('EXPENSE', 'depreciation')
        newConfig.fixedAssets.accumulatedDepreciation = find('1210') || find('1211') || find('281') || find('28') || findByType('ASSET', 'accumulated')

        // Suspense
        newConfig.suspense.reception = find('2102') || find('9004') || find('3800') || find('380') || find('471')

        // Partners
        newConfig.partners.capital = find('3001') || find('3100') || find('101') || find('10') || findByType('EQUITY', 'capital')
        newConfig.partners.loan = find('2201') || find('1680') || find('168') || find('16') || findByType('LIABILITY', 'loan')
        newConfig.partners.withdrawal = find('3005') || find('3200') || find('108') || find('12') || findByType('EQUITY', 'draw')

        // Equity
        newConfig.equity.capital = find('3001') || find('3100') || find('101') || find('10') || findByType('EQUITY', 'capital')
        newConfig.equity.draws = find('3005') || find('3200') || find('108') || find('129') || find('12') || findByType('EQUITY', 'draw')

        // Tax
        newConfig.tax.vat_payable = find('2110') || find('2111') || find('4455') || find('443') || find('44') || findByType('LIABILITY', 'vat payable')
        newConfig.tax.vat_refund_receivable = find('2115') || find('4458') || findByType('ASSET', 'vat refund')

        setConfig(newConfig)

        const allValues = [
            ...Object.values(newConfig.sales),
            ...Object.values(newConfig.purchases),
            ...Object.values(newConfig.inventory),
            ...Object.values(newConfig.automation),
            ...Object.values(newConfig.fixedAssets),
            ...Object.values(newConfig.suspense),
            ...Object.values(newConfig.partners),
            ...Object.values(newConfig.equity),
            ...Object.values(newConfig.tax),
        ]
        const foundCount = allValues.filter(v => v !== null).length
        const totalCount = allValues.length

        if (foundCount === 0) {
            toast.error('No matching accounts found. Import a Chart of Accounts template first.')
        } else {
            toast.success(`Auto-detection: ${foundCount}/${totalCount} accounts matched. Review and save.`)
        }
    }

    const AccountSelect = ({
        label, value, onChange, description
    }: {
        label: string, value: number | null, onChange: (id: number | null) => void, description?: string
    }) => (
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest block">{label}</label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-app-surface border border-app-border rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all shadow-sm"
            >
                <option value="">(Not Mapped)</option>
                {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                        {acc.code} — {acc.name}
                    </option>
                ))}
            </select>
            {description && <p className="text-[10px] text-app-muted-foreground font-medium italic">{description}</p>}
        </div>
    )

    // Helper to update nested config
    const set = <S extends keyof PostingRulesConfig>(section: S, key: keyof PostingRulesConfig[S], id: number | null) => {
        setConfig(prev => ({ ...prev, [section]: { ...prev[section], [key]: id } }))
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Return to Setup Wizard banner */}
            {fromSetup && (
                <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--app-info)10', border: '1px solid var(--app-info)30' }}>
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--app-foreground)' }}>
                        <Info size={18} style={{ color: 'var(--app-info)' }} />
                        <span>You&apos;re configuring posting rules as part of the <strong>COA Setup Wizard</strong>. Save your changes, then return to the wizard.</span>
                    </div>
                    <button
                        onClick={() => router.push('/finance/setup')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                        style={{ background: 'var(--app-primary)', color: 'white' }}
                    >
                        <ArrowLeft size={14} /> Return to Wizard
                    </button>
                </div>
            )}
            {/* Header */}
            <div className="bg-app-surface rounded-3xl p-8 text-app-foreground flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-app-primary/20 p-3 rounded-2xl">
                        <Target className="text-app-primary" size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold font-serif italic">Transaction Auto-Mapping</h2>
                        <p className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Configure your financial automation engine</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={autoDetect}
                        className="bg-app-warning-bg border border-app-warning/50 text-app-warning px-6 py-3 rounded-xl font-bold text-sm hover:bg-app-warning/20 transition-all flex items-center gap-2"
                    >
                        <Zap size={18} /> Auto-Detect
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-app-primary px-8 py-3 rounded-xl font-bold text-sm hover:bg-app-success transition-all flex items-center gap-2 shadow-lg shadow-app-primary/20"
                    >
                        <Save size={18} /> {isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* ═══ Sales & Revenue ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center gap-3">
                        <ShoppingCart className="text-app-muted-foreground" size={20} />
                        <h3 className="font-bold text-app-foreground uppercase text-xs tracking-widest">Sales & Revenue</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect label="Accounts Receivable" value={config.sales.receivable}
                            onChange={(id) => set('sales', 'receivable', id)}
                            description="Main control account for customer balances." />
                        <AccountSelect label="Sales Revenue" value={config.sales.revenue}
                            onChange={(id) => set('sales', 'revenue', id)} />
                        <AccountSelect label="Cost of Goods Sold (COGS)" value={config.sales.cogs}
                            onChange={(id) => set('sales', 'cogs', id)} />
                        <AccountSelect label="Inventory Assets" value={config.sales.inventory}
                            onChange={(id) => set('sales', 'inventory', id)} />
                        <AccountSelect label="Round-Off Account" value={config.sales.round_off}
                            onChange={(id) => set('sales', 'round_off', id)}
                            description="Absorbs rounding differences on invoices." />
                        <AccountSelect label="Sales Discount" value={config.sales.discount}
                            onChange={(id) => set('sales', 'discount', id)}
                            description="Discounts granted to customers." />
                        <AccountSelect label="VAT Collected" value={config.sales.vat_collected}
                            onChange={(id) => set('sales', 'vat_collected', id)}
                            description="Output VAT on sales invoices." />
                    </div>
                </section>

                {/* ═══ Purchases & Suppliers ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center gap-3">
                        <CreditCard className="text-app-muted-foreground" size={20} />
                        <h3 className="font-bold text-app-foreground uppercase text-xs tracking-widest">Purchases & Suppliers</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect label="Accounts Payable" value={config.purchases.payable}
                            onChange={(id) => set('purchases', 'payable', id)}
                            description="Main control account for supplier balances." />
                        <AccountSelect label="Inventory Purchase" value={config.purchases.inventory}
                            onChange={(id) => set('purchases', 'inventory', id)} />
                        <AccountSelect label="VAT Recoverable (Input Tax)" value={config.purchases.vat_recoverable}
                            onChange={(id) => set('purchases', 'vat_recoverable', id)}
                            description="Input VAT deductible on purchases." />
                        <AccountSelect label="AIRSI Payable" value={config.purchases.airsi_payable}
                            onChange={(id) => set('purchases', 'airsi_payable', id)}
                            description="Withholding tax payable (Acompte d'Impôt)." />
                        <AccountSelect label="Reverse Charge VAT" value={config.purchases.reverse_charge_vat}
                            onChange={(id) => set('purchases', 'reverse_charge_vat', id)}
                            description="Self-assessed VAT on imports or cross-border services." />
                        <AccountSelect label="Discount Earned" value={config.purchases.discount_earned}
                            onChange={(id) => set('purchases', 'discount_earned', id)}
                            description="Early payment discounts received from suppliers." />
                        <AccountSelect label="Delivery Fees" value={config.purchases.delivery_fees}
                            onChange={(id) => set('purchases', 'delivery_fees', id)}
                            description="Freight and transport costs on purchases." />
                        <AccountSelect label="Purchase Expense" value={config.purchases.expense}
                            onChange={(id) => set('purchases', 'expense', id)}
                            description="General purchase expense account for non-inventory items." />
                        <AccountSelect label="VAT Suspense (Cash-Basis)" value={config.purchases.vat_suspense}
                            onChange={(id) => set('purchases', 'vat_suspense', id)}
                            description="Holds VAT until payment is made (cash-basis accounting only)." />
                    </div>
                </section>

                {/* ═══ Partner Automation ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden border-2 border-app-success/30">
                    <div className="p-6 bg-app-primary-light border-b border-app-success/30 flex items-center gap-3 font-bold text-app-success">
                        <Users className="text-app-primary" size={20} />
                        <h3 className="uppercase text-xs tracking-widest">Partner Automation</h3>
                        <Zap size={14} className="ml-auto" />
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect label="Customer Root Account" value={config.automation.customerRoot}
                            onChange={(id) => set('automation', 'customerRoot', id)}
                            description="New customers will automatically get sub-accounts under this parent." />
                        <AccountSelect label="Supplier Root Account" value={config.automation.supplierRoot}
                            onChange={(id) => set('automation', 'supplierRoot', id)}
                            description="New suppliers will automatically get sub-accounts under this parent." />
                        <AccountSelect label="Payroll Root Account" value={config.automation.payrollRoot}
                            onChange={(id) => set('automation', 'payrollRoot', id)}
                            description="Employee accrual accounts will be created as children of this parent." />
                    </div>
                </section>

                {/* ═══ Tax (VAT Control) ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden border-2 border-app-warning/30">
                    <div className="p-6 bg-app-warning-bg border-b border-app-warning/30 flex items-center gap-3 font-bold text-app-warning">
                        <Receipt className="text-app-warning" size={20} />
                        <h3 className="uppercase text-xs tracking-widest">Tax Control Accounts</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect label="VAT Payable (Settlement)" value={config.tax.vat_payable}
                            onChange={(id) => set('tax', 'vat_payable', id)}
                            description="Clearing account for net VAT due to tax authorities." />
                        <AccountSelect label="VAT Refund Receivable" value={config.tax.vat_refund_receivable}
                            onChange={(id) => set('tax', 'vat_refund_receivable', id)}
                            description="VAT credit receivable from the state when input > output." />
                    </div>
                </section>

                {/* ═══ Inventory Operations ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center gap-3">
                        <Package className="text-app-muted-foreground" size={20} />
                        <h3 className="font-bold text-app-foreground uppercase text-xs tracking-widest">Inventory Operations</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect label="Stock Adjustment Account" value={config.inventory.adjustment}
                            onChange={(id) => set('inventory', 'adjustment', id)}
                            description="Gains or losses from inventory counts." />
                        <AccountSelect label="Inter-Warehouse Transfer" value={config.inventory.transfer}
                            onChange={(id) => set('inventory', 'transfer', id)} />
                    </div>
                </section>

                {/* ═══ Suspense ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center gap-3">
                        <Truck className="text-app-muted-foreground" size={20} />
                        <h3 className="font-bold text-app-foreground uppercase text-xs tracking-widest">Suspense & Transit</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect label="Goods Reception (In-Transit)" value={config.suspense.reception}
                            onChange={(id) => set('suspense', 'reception', id)}
                            description="Temporary holding account for goods received before invoice." />
                    </div>
                </section>

                {/* ═══ Equity & Partners ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden md:col-span-2">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center gap-3">
                        <Landmark className="text-app-muted-foreground" size={20} />
                        <h3 className="font-bold text-app-foreground uppercase text-xs tracking-widest">Equity & Partners</h3>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                        <AccountSelect label="Owner Capital" value={config.equity.capital}
                            onChange={(id) => set('equity', 'capital', id)}
                            description="Owner equity / share capital." />
                        <AccountSelect label="Owner Draws" value={config.equity.draws}
                            onChange={(id) => set('equity', 'draws', id)}
                            description="Owner withdrawals / dividends." />
                        <AccountSelect label="Partner Capital" value={config.partners.capital}
                            onChange={(id) => set('partners', 'capital', id)} />
                        <AccountSelect label="Partner Loans" value={config.partners.loan}
                            onChange={(id) => set('partners', 'loan', id)}
                            description="Current account loans from partners." />
                        <AccountSelect label="Partner Withdrawals" value={config.partners.withdrawal}
                            onChange={(id) => set('partners', 'withdrawal', id)} />
                    </div>
                </section>

                {/* ═══ Fixed Assets ═══ */}
                <section className="bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden md:col-span-2">
                    <div className="p-6 bg-app-background border-b border-app-border flex items-center gap-3">
                        <BarChart3 className="text-app-muted-foreground" size={20} />
                        <h3 className="font-bold text-app-foreground uppercase text-xs tracking-widest">Fixed Assets & Depreciation</h3>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <AccountSelect label="Depreciation Expense" value={config.fixedAssets.depreciationExpense}
                            onChange={(id) => set('fixedAssets', 'depreciationExpense', id)} />
                        <AccountSelect label="Accumulated Depreciation" value={config.fixedAssets.accumulatedDepreciation}
                            onChange={(id) => set('fixedAssets', 'accumulatedDepreciation', id)} />
                    </div>
                </section>
            </div>

            {/* Info */}
            <div className="bg-app-background p-6 rounded-3xl border border-app-border flex items-start gap-4">
                <Info size={24} className="text-app-muted-foreground flex-shrink-0" />
                <div>
                    <h4 className="font-bold text-sm text-app-foreground">How this works</h4>
                    <p className="text-xs text-app-muted-foreground mt-1 leading-relaxed">
                        These mappings are used by the <strong>TSF Financial Engine</strong> to automatically generate double-entry journal records.
                        When you create a Customer, their sub-account is created under the <em>Customer Root</em>.
                        When you complete a Purchase Order, the system Credits <em>Accounts Payable</em> and Debits <em>Inventory Purchase</em>.
                        All account resolution is dynamic — <strong>no hardcoded account codes</strong>.
                    </p>
                </div>
            </div>

            {/* ═══════ Impact Analysis Dialog ═══════ */}
            {impactDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-app-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-app-border">
                        {/* Header */}
                        <div className="p-6 border-b border-app-border bg-app-warning-bg flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-app-warning/20 p-2 rounded-xl">
                                    <AlertTriangle className="text-app-warning" size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-app-foreground text-lg">Account Change Detected</h3>
                                    <p className="text-xs text-app-muted-foreground mt-0.5">
                                        {impactDialog.impacts.filter(i => i.risk === 'HIGH').length} rule(s) have existing journal entries and balances that will be affected.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setImpactDialog(null)} className="p-1 hover:bg-app-surface rounded-lg transition-colors">
                                <X size={18} className="text-app-muted-foreground" />
                            </button>
                        </div>

                        {/* Impact Table */}
                        <div className="overflow-y-auto flex-1 p-6">
                            <div className="space-y-3">
                                {impactDialog.impacts.map((impact, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border ${impact.risk === 'HIGH'
                                        ? 'border-app-error/30 bg-app-error-bg'
                                        : 'border-app-border bg-app-background'
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-xs text-app-muted-foreground uppercase tracking-widest">
                                                {impact.rule}
                                            </span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${impact.risk === 'HIGH'
                                                ? 'bg-app-error text-white'
                                                : 'bg-app-surface-2 text-app-muted-foreground'
                                                }`}>
                                                {impact.risk} risk
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <div className="flex-1 bg-app-surface rounded-xl p-2 text-center">
                                                <span className="text-[10px] text-app-muted-foreground uppercase block">Old</span>
                                                <span className="font-medium text-app-foreground text-xs">{impact.old_account}</span>
                                            </div>
                                            <ArrowRight size={16} className="text-app-muted-foreground flex-shrink-0" />
                                            <div className="flex-1 bg-app-surface rounded-xl p-2 text-center">
                                                <span className="text-[10px] text-app-muted-foreground uppercase block">New</span>
                                                <span className="font-medium text-app-foreground text-xs">{impact.new_account}</span>
                                            </div>
                                        </div>
                                        {impact.risk === 'HIGH' && (
                                            <div className="mt-3 flex items-center gap-4 text-xs">
                                                <span className="text-app-error font-bold">
                                                    {impact.journal_entries} journal entries on old account
                                                </span>
                                                <span className="text-app-error font-bold">
                                                    Balance: {impact.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-app-border bg-app-background space-y-3">
                            <button
                                onClick={() => handleConfirmSave(true)}
                                disabled={isPending}
                                className="w-full bg-app-primary text-white py-3 rounded-2xl font-bold text-sm hover:bg-app-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={16} />
                                Save &amp; Reclassify Balances (Recommended)
                            </button>
                            <p className="text-[10px] text-app-muted-foreground text-center leading-relaxed">
                                This will post reclassification journal entries to sweep existing balances from the old accounts to the new ones.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleConfirmSave(false)}
                                    disabled={isPending}
                                    className="flex-1 bg-app-surface border border-app-border text-app-foreground py-2.5 rounded-xl text-xs font-bold hover:bg-app-surface-2 transition-all disabled:opacity-50"
                                >
                                    Save Without Reclassify
                                </button>
                                <button
                                    onClick={() => setImpactDialog(null)}
                                    className="flex-1 bg-app-surface border border-app-border text-app-muted-foreground py-2.5 rounded-xl text-xs font-bold hover:bg-app-surface-2 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}