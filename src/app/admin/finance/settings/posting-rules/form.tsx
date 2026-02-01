'use client'

import { useState, useTransition } from 'react'
import { Save, Library, Info, ChevronRight, Zap, Target, Package, Users, ShoppingCart, CreditCard, BarChart3 } from 'lucide-react'
import { savePostingRules, PostingRulesConfig } from '@/app/actions/finance/posting-rules'
import { useRouter } from 'next/navigation'

export default function PostingRulesForm({
    initialConfig,
    accounts
}: {
    initialConfig: PostingRulesConfig,
    accounts: any[]
}) {
    const [config, setConfig] = useState<PostingRulesConfig>(initialConfig)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleSave = () => {
        startTransition(async () => {
            await savePostingRules(config)
            router.refresh()
            alert('Posting rules updated successfully!')
        })
    }

    const autoDetect = () => {
        // Create a deep copy to ensure React detects changes in nested objects
        const newConfig: PostingRulesConfig = {
            sales: { ...config.sales },
            purchases: { ...config.purchases },
            inventory: { ...config.inventory },
            automation: { ...config.automation },
            fixedAssets: { ...config.fixedAssets }
        }

        // Helper to find account by code
        const find = (code: string) => {
            const acc = accounts.find(a => a.code === code)
            return acc ? acc.id : null
        }

        // IFRS & Standard Mappings
        newConfig.sales.receivable = find('1110') || find('1300')
        newConfig.sales.revenue = find('4100') || find('4101') || find('701')
        newConfig.sales.cogs = find('5100') || find('5101') || find('6000') || find('601')
        newConfig.sales.inventory = find('1121') || find('1120') || find('31')

        newConfig.purchases.payable = find('2100.1') || find('2100') || find('401') || find('2101')
        newConfig.purchases.inventory = find('5101') || find('6011') || find('607') || find('1121')
        newConfig.purchases.tax = find('2111') || find('4456')

        newConfig.inventory.adjustment = find('9001') || find('5104') || find('709')
        newConfig.inventory.transfer = find('9002') || find('1120')

        newConfig.automation.customerRoot = find('1111') || find('1110') || find('1200') || find('411')
        newConfig.automation.supplierRoot = find('2101') || find('2100.1') || find('2100') || find('401')
        newConfig.automation.payrollRoot = find('2200') || find('421')

        newConfig.fixedAssets.depreciationExpense = find('681') || find('6109') || find('6302')
        newConfig.fixedAssets.accumulatedDepreciation = find('1210') || find('1211') || find('281')

        setConfig(newConfig)

        const foundCount = [
            newConfig.sales.receivable, newConfig.sales.revenue, newConfig.sales.cogs, newConfig.sales.inventory,
            newConfig.purchases.payable, newConfig.purchases.inventory, newConfig.purchases.tax,
            newConfig.inventory.adjustment, newConfig.automation.customerRoot, newConfig.automation.supplierRoot,
            newConfig.automation.payrollRoot,
            newConfig.fixedAssets.depreciationExpense, newConfig.fixedAssets.accumulatedDepreciation
        ].filter(v => v !== null).length

        if (foundCount === 0) {
            alert('Could not find matching accounts automatically. Ensure you have imported an Accounting Standard (IFRS, French, etc.) first.')
        } else {
            alert(`Auto-detection complete. Identified ${foundCount} account matches. Please review and save.`)
        }
    }

    const AccountSelect = ({
        label,
        value,
        onChange,
        description
    }: {
        label: string,
        value: number | null,
        onChange: (id: number | null) => void,
        description?: string
    }) => (
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest block">{label}</label>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all shadow-sm"
            >
                <option value="">(Not Mapped - Manual Selection Required)</option>
                {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                        {acc.code} — {acc.name}
                    </option>
                ))}
            </select>
            {description && <p className="text-[10px] text-stone-400 font-medium italic">{description}</p>}
        </div>
    )

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="bg-stone-900 rounded-3xl p-8 text-white flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/20 p-3 rounded-2xl">
                        <Target className="text-emerald-400" size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold font-serif italic">Transaction Auto-Mapping</h2>
                        <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mt-1">Configure your financial automation engine</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={autoDetect}
                        className="bg-amber-500/10 border border-amber-500/50 text-amber-400 px-6 py-3 rounded-xl font-bold text-sm hover:bg-amber-500/20 transition-all flex items-center gap-2"
                    >
                        <Zap size={18} /> Auto-Detect Mappings
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-emerald-600 px-8 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/40"
                    >
                        <Save size={18} /> {isPending ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Sales Section */}
                <section className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="p-6 bg-stone-50 border-b border-stone-100 flex items-center gap-3">
                        <ShoppingCart className="text-stone-400" size={20} />
                        <h3 className="font-bold text-stone-900 uppercase text-xs tracking-widest">Sales & Revenue</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect
                            label="Accounts Receivable"
                            value={config.sales.receivable}
                            onChange={(id) => setConfig({ ...config, sales: { ...config.sales, receivable: id } })}
                            description="Main control account for customer balances."
                        />
                        <AccountSelect
                            label="Sales Revenue"
                            value={config.sales.revenue}
                            onChange={(id) => setConfig({ ...config, sales: { ...config.sales, revenue: id } })}
                        />
                        <AccountSelect
                            label="Cost of Goods Sold (COGS)"
                            value={config.sales.cogs}
                            onChange={(id) => setConfig({ ...config, sales: { ...config.sales, cogs: id } })}
                        />
                        <AccountSelect
                            label="Inventory Assets"
                            value={config.sales.inventory}
                            onChange={(id) => setConfig({ ...config, sales: { ...config.sales, inventory: id } })}
                        />
                    </div>
                </section>

                {/* Purchase Section */}
                <section className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="p-6 bg-stone-50 border-b border-stone-100 flex items-center gap-3">
                        <CreditCard className="text-stone-400" size={20} />
                        <h3 className="font-bold text-stone-900 uppercase text-xs tracking-widest">Purchases & Suppliers</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect
                            label="Accounts Payable"
                            value={config.purchases.payable}
                            onChange={(id) => setConfig({ ...config, purchases: { ...config.purchases, payable: id } })}
                        />
                        <AccountSelect
                            label="Inventory Purchase"
                            value={config.purchases.inventory}
                            onChange={(id) => setConfig({ ...config, purchases: { ...config.purchases, inventory: id } })}
                        />
                        <AccountSelect
                            label="Input Tax (VAT)"
                            value={config.purchases.tax}
                            onChange={(id) => setConfig({ ...config, purchases: { ...config.purchases, tax: id } })}
                        />
                    </div>
                </section>

                {/* Automation & Partner Sub-Accounts */}
                <section className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden border-2 border-emerald-100/50">
                    <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3 font-bold text-emerald-900">
                        <Users className="text-emerald-500" size={20} />
                        <h3 className="uppercase text-xs tracking-widest">Partner Automation</h3>
                        <Zap size={14} className="ml-auto" />
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect
                            label="Customer Root Account"
                            value={config.automation.customerRoot}
                            onChange={(id) => setConfig({ ...config, automation: { ...config.automation, customerRoot: id } })}
                            description="New customers will automatically get sub-accounts under this parent."
                        />
                        <AccountSelect
                            label="Supplier Root Account"
                            value={config.automation.supplierRoot}
                            onChange={(id) => setConfig({ ...config, automation: { ...config.automation, supplierRoot: id } })}
                            description="New suppliers will automatically get sub-accounts under this parent."
                        />
                        <AccountSelect
                            label="Payroll Root Account (Employees)"
                            value={config.automation.payrollRoot}
                            onChange={(id) => setConfig({ ...config, automation: { ...config.automation, payrollRoot: id } })}
                            description="Employee accrual accounts will be created as children of this parent."
                        />
                    </div>
                </section>

                {/* Inventory & Adjustments */}
                <section className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="p-6 bg-stone-50 border-b border-stone-100 flex items-center gap-3">
                        <Package className="text-stone-400" size={20} />
                        <h3 className="font-bold text-stone-900 uppercase text-xs tracking-widest">Inventory Operations</h3>
                    </div>
                    <div className="p-8 space-y-6">
                        <AccountSelect
                            label="Stock Adjustment Account"
                            value={config.inventory.adjustment}
                            onChange={(id) => setConfig({ ...config, inventory: { ...config.inventory, adjustment: id } })}
                            description="Gains or losses from inventory counts."
                        />
                        <AccountSelect
                            label="Inter-Warehouse Transfer"
                            value={config.inventory.transfer}
                            onChange={(id) => setConfig({ ...config, inventory: { ...config.inventory, transfer: id } })}
                        />
                    </div>
                </section>

                {/* Fixed Assets */}
                <section className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden md:col-span-2">
                    <div className="p-6 bg-stone-50 border-b border-stone-100 flex items-center gap-3">
                        <BarChart3 className="text-stone-400" size={20} />
                        <h3 className="font-bold text-stone-900 uppercase text-xs tracking-widest">Fixed Assets & Depreciation</h3>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <AccountSelect
                            label="Depreciation Expense"
                            value={config.fixedAssets.depreciationExpense}
                            onChange={(id) => setConfig({ ...config, fixedAssets: { ...config.fixedAssets, depreciationExpense: id } })}
                        />
                        <AccountSelect
                            label="Accumulated Depreciation"
                            value={config.fixedAssets.accumulatedDepreciation}
                            onChange={(id) => setConfig({ ...config, fixedAssets: { ...config.fixedAssets, accumulatedDepreciation: id } })}
                        />
                    </div>
                </section>
            </div>

            {/* Info Message */}
            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200 flex items-start gap-4">
                <Info size={24} className="text-stone-400 flex-shrink-0" />
                <div>
                    <h4 className="font-bold text-sm text-stone-900">How this works</h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                        These mappings are used by the <strong>TSF Financial Engine</strong> to automatically generate double-entry journal records.
                        For example, when you complete a Purchase Order, the system will automatically Credit the <em>Accounts Payable</em>
                        and Debit the <em>Inventory Purchase</em> account selected here.
                    </p>
                </div>
            </div>
        </div>
    )
}
