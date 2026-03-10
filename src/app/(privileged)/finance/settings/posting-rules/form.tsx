'use client'

import { useState, useTransition } from 'react'
import { Save, Info, Zap, Target, Package, Users, ShoppingCart, CreditCard, BarChart3, Shield, Landmark, Receipt, Truck } from 'lucide-react'
import { savePostingRules, PostingRulesConfig } from '@/app/actions/finance/posting-rules'
import { useRouter } from 'next/navigation'
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
            purchases: { payable: null, inventory: null, vat_recoverable: null, airsi_payable: null, reverse_charge_vat: null, discount_earned: null, delivery_fees: null, airsi: null },
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

    const handleSave = () => {
        startTransition(async () => {
            await savePostingRules(config)
            router.refresh()
            toast.success('Posting rules updated successfully!')
        })
    }

    const autoDetect = () => {
        const newConfig: PostingRulesConfig = JSON.parse(JSON.stringify(config))

        const find = (code: string) => {
            const acc = accounts.find(a => a.code === code)
            return acc ? acc.id : null
        }

        // Sales
        newConfig.sales.receivable = find('1110') || find('1300') || find('411')
        newConfig.sales.revenue = find('4100') || find('4101') || find('701')
        newConfig.sales.cogs = find('5100') || find('5101') || find('6000') || find('601')
        newConfig.sales.inventory = find('1121') || find('1120') || find('31')
        newConfig.sales.round_off = find('6589') || find('7589') || find('758')
        newConfig.sales.discount = find('6190') || find('709')
        newConfig.sales.vat_collected = find('2111') || find('4457') || find('443')

        // Purchases
        newConfig.purchases.payable = find('2100.1') || find('2100') || find('401') || find('2101')
        newConfig.purchases.inventory = find('5101') || find('6011') || find('607') || find('1121')
        newConfig.purchases.vat_recoverable = find('2112') || find('4456') || find('445')
        newConfig.purchases.airsi_payable = find('2113') || find('4471')
        newConfig.purchases.reverse_charge_vat = find('2114') || find('4452')
        newConfig.purchases.discount_earned = find('7190') || find('609')
        newConfig.purchases.delivery_fees = find('6241') || find('624')
        newConfig.purchases.airsi = find('2113') || find('4471')

        // Inventory
        newConfig.inventory.adjustment = find('9001') || find('5104') || find('709')
        newConfig.inventory.transfer = find('9002') || find('1120')

        // Automation
        newConfig.automation.customerRoot = find('1111') || find('1110') || find('1200') || find('411')
        newConfig.automation.supplierRoot = find('2101') || find('2100.1') || find('2100') || find('401')
        newConfig.automation.payrollRoot = find('2200') || find('421')

        // Fixed Assets
        newConfig.fixedAssets.depreciationExpense = find('681') || find('6109') || find('6302')
        newConfig.fixedAssets.accumulatedDepreciation = find('1210') || find('1211') || find('281')

        // Suspense
        newConfig.suspense.reception = find('3800') || find('380') || find('471')

        // Partners
        newConfig.partners.capital = find('3100') || find('101')
        newConfig.partners.loan = find('1680') || find('168')
        newConfig.partners.withdrawal = find('3200') || find('108')

        // Equity
        newConfig.equity.capital = find('3100') || find('101')
        newConfig.equity.draws = find('3200') || find('108') || find('129')

        // Tax
        newConfig.tax.vat_payable = find('2110') || find('4455') || find('443')
        newConfig.tax.vat_refund_receivable = find('2115') || find('4458')

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
        </div>
    )
}