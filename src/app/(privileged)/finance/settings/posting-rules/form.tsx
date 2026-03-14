'use client'

import { useState, useTransition } from 'react'
import {
    Save, Zap, Target, Package, ShoppingCart, CreditCard,
    BarChart3, Landmark, Receipt, Truck, AlertTriangle,
    ArrowRight, X, Clock, History, CheckCircle2,
    XCircle, ChevronDown, ChevronRight, Shield,
    TrendingUp, Wallet, Activity, FileText, Settings2,
    RefreshCw, ArrowLeft
} from 'lucide-react'
import {
    applyAutoDetect, savePostingRules, savePostingRulesWithReclassification,
    analyzePostingRulesImpact, PostingRulesConfig, PostingRuleImpact,
    type PostingRuleEntry, type PostingRulesByModule, type CompletenessReport,
    type ModuleCoverage, type HistoryEntry, type AutoDetectResponse
} from '@/app/actions/finance/posting-rules'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════
// Event Catalog — defines all 113 events the UI should show
// ═══════════════════════════════════════════════════════════════

type EventDef = {
    code: string;
    label: string;
    description: string;
    criticality: 'CRITICAL' | 'STANDARD' | 'OPTIONAL' | 'CONDITIONAL';
}

type ModuleDef = {
    key: string;
    label: string;
    icon: any;
    color: string;
    events: EventDef[];
}

const MODULES: ModuleDef[] = [
    {
        key: 'sales', label: 'Sales & Revenue', icon: ShoppingCart, color: 'var(--app-success)',
        events: [
            { code: 'sales.invoice.receivable', label: 'Accounts Receivable', description: 'AR from sales invoices', criticality: 'CRITICAL' },
            { code: 'sales.invoice.revenue', label: 'Sales Revenue', description: 'Revenue recognition', criticality: 'CRITICAL' },
            { code: 'sales.invoice.discount', label: 'Discount Given', description: 'Sales discounts allowed', criticality: 'STANDARD' },
            { code: 'sales.invoice.vat_output', label: 'VAT Collected', description: 'Output VAT on sales', criticality: 'CONDITIONAL' },
            { code: 'sales.invoice.rounding', label: 'Rounding', description: 'Invoice rounding difference', criticality: 'OPTIONAL' },
            { code: 'sales.invoice.shipping_revenue', label: 'Shipping Revenue', description: 'Delivery charge income', criticality: 'OPTIONAL' },
            { code: 'sales.invoice.service_revenue', label: 'Service Revenue', description: 'Service-type item income', criticality: 'OPTIONAL' },
            { code: 'sales.invoice.advance_offset', label: 'Advance Offset', description: 'Offset customer deposit', criticality: 'OPTIONAL' },
            { code: 'sales.invoice.deposit_liability', label: 'Deposit Liability', description: 'Customer deposit held', criticality: 'OPTIONAL' },
            { code: 'sales.credit_note.receivable_reversal', label: 'CN: AR Reversal', description: 'Reverse AR for credit note', criticality: 'STANDARD' },
            { code: 'sales.credit_note.revenue_reversal', label: 'CN: Revenue Reversal', description: 'Reverse revenue for CN', criticality: 'STANDARD' },
            { code: 'sales.credit_note.vat_output_reversal', label: 'CN: VAT Reversal', description: 'Reverse VAT on CN', criticality: 'CONDITIONAL' },
            { code: 'sales.refund.cash', label: 'Refund: Cash', description: 'Cash refund to customer', criticality: 'STANDARD' },
            { code: 'sales.refund.bank', label: 'Refund: Bank', description: 'Bank refund to customer', criticality: 'STANDARD' },
            { code: 'sales.writeoff.bad_debt_expense', label: 'Bad Debt Expense', description: 'Write-off bad debts', criticality: 'STANDARD' },
            { code: 'sales.writeoff.receivable', label: 'Write-off: AR', description: 'Write off uncollectible', criticality: 'STANDARD' },
            { code: 'sales.commission.expense', label: 'Commission Expense', description: 'Sales commission cost', criticality: 'OPTIONAL' },
            { code: 'sales.commission.payable', label: 'Commission Payable', description: 'Commission owed', criticality: 'OPTIONAL' },
        ]
    },
    {
        key: 'purchases', label: 'Purchases & Suppliers', icon: CreditCard, color: 'var(--app-info)',
        events: [
            { code: 'purchases.invoice.payable', label: 'Accounts Payable', description: 'AP from purchase invoices', criticality: 'CRITICAL' },
            { code: 'purchases.invoice.expense', label: 'Purchase Expense', description: 'Expense recognition', criticality: 'CRITICAL' },
            { code: 'purchases.invoice.inventory', label: 'Inventory', description: 'Inventory value from purchase', criticality: 'CRITICAL' },
            { code: 'purchases.invoice.vat_input', label: 'VAT Deductible', description: 'Input VAT on purchases', criticality: 'CONDITIONAL' },
            { code: 'purchases.invoice.discount', label: 'Discount Earned', description: 'Purchase discounts taken', criticality: 'STANDARD' },
            { code: 'purchases.invoice.freight', label: 'Freight / Delivery', description: 'Transport costs', criticality: 'OPTIONAL' },
            { code: 'purchases.invoice.rounding', label: 'Rounding', description: 'Purchase rounding diff', criticality: 'OPTIONAL' },
            { code: 'purchases.return.payable_reversal', label: 'Return: AP Reversal', description: 'Reverse AP for return', criticality: 'STANDARD' },
            { code: 'purchases.return.inventory_reversal', label: 'Return: Inventory Rev.', description: 'Reverse inventory', criticality: 'STANDARD' },
            { code: 'purchases.return.vat_input_reversal', label: 'Return: VAT Reversal', description: 'Reverse input VAT', criticality: 'CONDITIONAL' },
            { code: 'purchases.payment.cash', label: 'Payment: Cash', description: 'Cash to vendor', criticality: 'STANDARD' },
            { code: 'purchases.payment.bank', label: 'Payment: Bank', description: 'Bank to vendor', criticality: 'STANDARD' },
            { code: 'purchases.payment.payable', label: 'Payment: AP Clear', description: 'AP settlement', criticality: 'STANDARD' },
            { code: 'purchases.vendor_credit.payable', label: 'Vendor Credit: AP', description: 'Reduce AP', criticality: 'STANDARD' },
            { code: 'purchases.vendor_credit.expense_reversal', label: 'Vendor Credit: Expense Rev.', description: 'Reverse expense', criticality: 'STANDARD' },
        ]
    },
    {
        key: 'inventory', label: 'Inventory Operations', icon: Package, color: 'var(--app-warning)',
        events: [
            { code: 'inventory.receipt.inventory', label: 'Goods Receipt', description: 'Inventory increase', criticality: 'CRITICAL' },
            { code: 'inventory.receipt.grni', label: 'GRNI (Accrual)', description: 'Goods Received Not Invoiced', criticality: 'STANDARD' },
            { code: 'inventory.issue.cogs', label: 'COGS', description: 'Cost of Goods Sold', criticality: 'CRITICAL' },
            { code: 'inventory.issue.inventory', label: 'Issue: Inventory', description: 'Inventory decrease', criticality: 'CRITICAL' },
            { code: 'inventory.adjustment.loss', label: 'Adjustment Loss', description: 'Count/damage loss', criticality: 'STANDARD' },
            { code: 'inventory.adjustment.gain', label: 'Adjustment Gain', description: 'Count surplus', criticality: 'STANDARD' },
            { code: 'inventory.adjustment.inventory', label: 'Adjustment: Value', description: 'Inventory value adj', criticality: 'STANDARD' },
            { code: 'inventory.transfer.source_inventory', label: 'Transfer: Source', description: 'Decrease at source WH', criticality: 'STANDARD' },
            { code: 'inventory.transfer.destination_inventory', label: 'Transfer: Destination', description: 'Increase at dest WH', criticality: 'STANDARD' },
            { code: 'inventory.writeoff.inventory', label: 'Write-off: Inventory', description: 'Inventory write-off', criticality: 'STANDARD' },
            { code: 'inventory.writeoff.expense', label: 'Write-off: Expense', description: 'Write-off expense', criticality: 'STANDARD' },
            { code: 'inventory.expiry.inventory', label: 'Expiry: Inventory', description: 'Expired goods removal', criticality: 'STANDARD' },
            { code: 'inventory.expiry.loss', label: 'Expiry: Loss', description: 'Expiry loss expense', criticality: 'STANDARD' },
        ]
    },
    {
        key: 'payments', label: 'Payment Processing', icon: Wallet, color: 'var(--app-primary)',
        events: [
            { code: 'payments.customer.cash', label: 'Customer: Cash', description: 'Cash from customer', criticality: 'CRITICAL' },
            { code: 'payments.customer.bank', label: 'Customer: Bank', description: 'Bank deposit from customer', criticality: 'CRITICAL' },
            { code: 'payments.customer.receivable', label: 'Customer: AR Clear', description: 'AR settlement', criticality: 'CRITICAL' },
            { code: 'payments.supplier.cash', label: 'Supplier: Cash', description: 'Cash to supplier', criticality: 'CRITICAL' },
            { code: 'payments.supplier.bank', label: 'Supplier: Bank', description: 'Bank to supplier', criticality: 'CRITICAL' },
            { code: 'payments.supplier.payable', label: 'Supplier: AP Clear', description: 'AP settlement', criticality: 'CRITICAL' },
            { code: 'payments.fee.bank_charge', label: 'Bank Charge', description: 'Bank service fee', criticality: 'OPTIONAL' },
            { code: 'payments.fee.processor_fee', label: 'Processor Fee', description: 'Payment processor fee', criticality: 'OPTIONAL' },
            { code: 'payments.refund.cash', label: 'Refund: Cash', description: 'Cash refund', criticality: 'STANDARD' },
            { code: 'payments.refund.bank', label: 'Refund: Bank', description: 'Bank refund', criticality: 'STANDARD' },
        ]
    },
    {
        key: 'tax', label: 'Tax Engine', icon: Receipt, color: '#e67e22',
        events: [
            { code: 'tax.vat.output', label: 'VAT Output', description: 'VAT collected', criticality: 'CONDITIONAL' },
            { code: 'tax.vat.input', label: 'VAT Input', description: 'VAT deductible', criticality: 'CONDITIONAL' },
            { code: 'tax.vat.payable', label: 'VAT Payable', description: 'Net VAT due', criticality: 'CONDITIONAL' },
            { code: 'tax.vat.recoverable', label: 'VAT Recoverable', description: 'VAT credit/refund', criticality: 'CONDITIONAL' },
            { code: 'tax.withholding.sales', label: 'WHT: Sales', description: 'Withholding on sales', criticality: 'CONDITIONAL' },
            { code: 'tax.withholding.purchases', label: 'WHT: Purchases', description: 'Withholding on purchases', criticality: 'CONDITIONAL' },
            { code: 'tax.withholding.payable', label: 'WHT: Payable', description: 'WHT due to govt', criticality: 'CONDITIONAL' },
            { code: 'tax.airsi.purchases', label: 'AIRSI: Purchases', description: 'AIRSI withheld', criticality: 'CONDITIONAL' },
            { code: 'tax.airsi.payable', label: 'AIRSI: Payable', description: 'AIRSI due to DGI', criticality: 'CONDITIONAL' },
            { code: 'tax.settlement.vat_payable', label: 'Settlement: VAT Pay', description: 'Clear VAT payable', criticality: 'CONDITIONAL' },
            { code: 'tax.settlement.vat_recoverable', label: 'Settlement: VAT Rec', description: 'Clear VAT recoverable', criticality: 'CONDITIONAL' },
        ]
    },
    {
        key: 'treasury', label: 'Treasury & Banking', icon: Landmark, color: '#2980b9',
        events: [
            { code: 'treasury.cash.deposit', label: 'Cash Deposit', description: 'Cash to bank', criticality: 'STANDARD' },
            { code: 'treasury.cash.withdrawal', label: 'Cash Withdrawal', description: 'Cash from bank', criticality: 'STANDARD' },
            { code: 'treasury.bank.deposit', label: 'Bank Deposit', description: 'Deposit received', criticality: 'STANDARD' },
            { code: 'treasury.bank.withdrawal', label: 'Bank Withdrawal', description: 'Bank withdrawal', criticality: 'STANDARD' },
            { code: 'treasury.bank.transfer', label: 'Inter-Bank Transfer', description: 'Between accounts', criticality: 'STANDARD' },
            { code: 'treasury.fx.gain', label: 'FX Gain', description: 'Foreign exchange gain', criticality: 'CONDITIONAL' },
            { code: 'treasury.fx.loss', label: 'FX Loss', description: 'Foreign exchange loss', criticality: 'CONDITIONAL' },
        ]
    },
    {
        key: 'assets', label: 'Fixed Assets', icon: BarChart3, color: '#8e44ad',
        events: [
            { code: 'assets.purchase.asset', label: 'Asset Acquisition', description: 'Fixed asset purchase', criticality: 'STANDARD' },
            { code: 'assets.purchase.payable', label: 'Asset: Payable', description: 'Payable for asset', criticality: 'STANDARD' },
            { code: 'assets.depreciation.expense', label: 'Depreciation Expense', description: 'Depreciation charge', criticality: 'STANDARD' },
            { code: 'assets.depreciation.accumulated', label: 'Accumulated Depreciation', description: 'Accum. depreciation', criticality: 'STANDARD' },
            { code: 'assets.disposal.asset', label: 'Disposal: Asset', description: 'Remove asset value', criticality: 'STANDARD' },
            { code: 'assets.disposal.accumulated', label: 'Disposal: Accum Depr', description: 'Clear accum depr', criticality: 'STANDARD' },
            { code: 'assets.disposal.gain', label: 'Disposal: Gain', description: 'Gain on disposal', criticality: 'STANDARD' },
            { code: 'assets.disposal.loss', label: 'Disposal: Loss', description: 'Loss on disposal', criticality: 'STANDARD' },
        ]
    },
    {
        key: 'equity', label: 'Equity & Capital', icon: TrendingUp, color: '#27ae60',
        events: [
            { code: 'equity.capital.contribution', label: 'Capital Contribution', description: 'Owner investment', criticality: 'STANDARD' },
            { code: 'equity.capital.withdrawal', label: 'Owner Withdrawal', description: 'Owner draws', criticality: 'STANDARD' },
            { code: 'equity.dividend.declaration', label: 'Dividend Declared', description: 'Dividend declaration', criticality: 'OPTIONAL' },
            { code: 'equity.dividend.payment', label: 'Dividend Payment', description: 'Dividend paid', criticality: 'OPTIONAL' },
            { code: 'equity.retained_earnings.transfer', label: 'Retained Earnings', description: 'P&L transfer', criticality: 'STANDARD' },
        ]
    },
    {
        key: 'adjustment', label: 'Adjustments & Accruals', icon: Settings2, color: '#95a5a6',
        events: [
            { code: 'adjustment.journal.debit', label: 'Manual: Debit', description: 'Manual debit entry', criticality: 'STANDARD' },
            { code: 'adjustment.journal.credit', label: 'Manual: Credit', description: 'Manual credit entry', criticality: 'STANDARD' },
            { code: 'adjustment.accrual.expense', label: 'Accrued Expense', description: 'Expense accrual', criticality: 'STANDARD' },
            { code: 'adjustment.accrual.revenue', label: 'Accrued Revenue', description: 'Revenue accrual', criticality: 'STANDARD' },
            { code: 'adjustment.deferral.expense', label: 'Deferred Expense', description: 'Prepayment', criticality: 'STANDARD' },
            { code: 'adjustment.deferral.revenue', label: 'Deferred Revenue', description: 'Unearned revenue', criticality: 'STANDARD' },
            { code: 'adjustment.provision.expense', label: 'Provision Expense', description: 'Provision charge', criticality: 'STANDARD' },
            { code: 'adjustment.provision.liability', label: 'Provision Liability', description: 'Provision balance', criticality: 'STANDARD' },
        ]
    },
]

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

const CRIT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    CRITICAL: { bg: 'var(--app-error)', text: 'white', label: 'CRITICAL' },
    STANDARD: { bg: 'var(--app-muted-foreground)', text: 'white', label: 'STANDARD' },
    OPTIONAL: { bg: 'var(--app-border)', text: 'var(--app-muted-foreground)', label: 'OPTIONAL' },
    CONDITIONAL: { bg: '#e67e22', text: 'white', label: 'IF APPLICABLE' },
}

function CriticalityBadge({ level }: { level: string }) {
    const style = CRIT_STYLES[level] || CRIT_STYLES.STANDARD
    return (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap"
            style={{ background: style.bg, color: style.text, opacity: 0.85 }}>
            {style.label}
        </span>
    )
}

function CoverageBar({ pct, color }: { pct: number; color: string }) {
    return (
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--app-border)' }}>
            <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 80 ? 'var(--app-success)' : pct >= 50 ? color : 'var(--app-error)' }} />
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function PostingRulesClient({
    rulesByModule,
    completeness,
    moduleCoverage,
    history,
    accounts,
}: {
    rulesByModule: PostingRulesByModule
    completeness: CompletenessReport | null
    moduleCoverage: ModuleCoverage | null
    history: HistoryEntry[]
    accounts: Record<string, any>[]
}) {
    const [activeTab, setActiveTab] = useState<'mappings' | 'coverage' | 'history'>('mappings')
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['sales', 'purchases']))
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const searchParams = useSearchParams()
    const fromSetup = searchParams.get('from') === 'setup'
    const [impactDialog, setImpactDialog] = useState<{ impacts: PostingRuleImpact[], hasHighRisk: boolean } | null>(null)

    // Build a flat lookup: event_code → account_id
    const ruleMap: Record<string, number | null> = {}
    Object.values(rulesByModule).forEach((rules: any[]) => {
        rules.forEach((r: PostingRuleEntry) => {
            ruleMap[r.event_code] = r.account
        })
    })

    // Build a flat lookup: event_code → PostingRuleEntry
    const ruleEntryMap: Record<string, PostingRuleEntry> = {}
    Object.values(rulesByModule).forEach((rules: any[]) => {
        rules.forEach((r: PostingRuleEntry) => {
            ruleEntryMap[r.event_code] = r
        })
    })

    const toggleModule = (key: string) => {
        setExpandedModules(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    // Count configured for each module
    const getModuleStats = (mod: ModuleDef) => {
        const total = mod.events.length
        const configured = mod.events.filter(e => ruleMap[e.code] != null).length
        return { total, configured }
    }

    // Build legacy config for save
    const buildLegacyConfig = (): PostingRulesConfig => {
        const find = (code: string) => ruleMap[code] ?? null
        return {
            sales: {
                receivable: find('sales.invoice.receivable'),
                revenue: find('sales.invoice.revenue'),
                cogs: find('inventory.issue.cogs'),
                inventory: find('inventory.receipt.inventory'),
                round_off: find('sales.invoice.rounding'),
                discount: find('sales.invoice.discount'),
                vat_collected: find('sales.invoice.vat_output'),
            },
            purchases: {
                payable: find('purchases.invoice.payable'),
                inventory: find('purchases.invoice.inventory'),
                expense: find('purchases.invoice.expense'),
                vat_recoverable: find('purchases.invoice.vat_input'),
                vat_suspense: find('tax.vat.suspense') ?? null,
                airsi_payable: find('tax.airsi.payable'),
                reverse_charge_vat: find('tax.settlement.reverse_charge') ?? null,
                discount_earned: find('purchases.invoice.discount'),
                delivery_fees: find('purchases.invoice.freight'),
                airsi: find('tax.airsi.purchases'),
            },
            inventory: {
                adjustment: find('inventory.adjustment.inventory'),
                transfer: find('inventory.transfer.source_inventory'),
            },
            automation: { customerRoot: find('sales.invoice.receivable'), supplierRoot: find('purchases.invoice.payable'), payrollRoot: null },
            fixedAssets: { depreciationExpense: find('assets.depreciation.expense'), accumulatedDepreciation: find('assets.depreciation.accumulated') },
            suspense: { reception: find('inventory.receipt.grni') },
            partners: { capital: find('equity.capital.contribution'), loan: null, withdrawal: find('equity.capital.withdrawal') },
            equity: { capital: find('equity.capital.contribution'), draws: find('equity.capital.withdrawal') },
            tax: { vat_payable: find('tax.vat.payable'), vat_refund_receivable: find('tax.vat.recoverable') },
        }
    }

    const handleAutoDetect = () => {
        startTransition(async () => {
            const result = await applyAutoDetect(70)
            if (result) {
                toast.success(`Auto-detection: ${result.applied} rules applied (avg confidence: ${result.summary.avg_confidence}%). Page refreshing.`)
                router.refresh()
            } else {
                toast.error('Auto-detection failed.')
            }
        })
    }

    const handleSave = () => {
        startTransition(async () => {
            const config = buildLegacyConfig()
            const analysis = await analyzePostingRulesImpact(config)
            if (analysis.has_high_risk && analysis.impact && analysis.impact.length > 0) {
                setImpactDialog({ impacts: analysis.impact, hasHighRisk: true })
                return
            }
            const result = await savePostingRules(config)
            router.refresh()
            toast.success(result.impact?.length ? `Updated! ${result.impact.length} account(s) changed.` : 'Posting rules saved.')
        })
    }

    const handleConfirmSave = (reclassify: boolean) => {
        setImpactDialog(null)
        startTransition(async () => {
            const config = buildLegacyConfig()
            if (reclassify) {
                const result = await savePostingRulesWithReclassification(config)
                router.refresh()
                const posted = result.reclassifications?.filter(r => r.status === 'posted').length || 0
                toast.success(`Saved! ${posted} reclassification JE(s) posted.`)
            } else {
                await savePostingRules(config)
                router.refresh()
                toast.warning('Saved WITHOUT reclassification. Old balances remain.')
            }
        })
    }

    const totalEvents = MODULES.reduce((a, m) => a + m.events.length, 0)
    const totalConfigured = MODULES.reduce((a, m) => a + m.events.filter(e => ruleMap[e.code] != null).length, 0)
    const overallPct = totalEvents > 0 ? Math.round((totalConfigured / totalEvents) * 100) : 0
    const criticalMissing = MODULES.flatMap(m => m.events)
        .filter(e => e.criticality === 'CRITICAL' && ruleMap[e.code] == null)

    const TABS = [
        { key: 'mappings' as const, label: 'Mappings', icon: Target, count: `${totalConfigured}/${totalEvents}` },
        { key: 'coverage' as const, label: 'Coverage', icon: Activity, count: `${overallPct}%` },
        { key: 'history' as const, label: 'Audit Trail', icon: History, count: `${history.length}` },
    ]

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Return to Setup Wizard */}
            {fromSetup && (
                <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--app-info)10', border: '1px solid var(--app-info)30' }}>
                    <div className="flex items-center gap-3 text-sm text-app-foreground">
                        <ArrowLeft size={18} style={{ color: 'var(--app-info)' }} />
                        <span>Configuring posting rules as part of <strong>COA Setup Wizard</strong>.</span>
                    </div>
                    <button onClick={() => router.push('/finance/setup')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm" style={{ background: 'var(--app-primary)', color: 'white' }}>
                        <ArrowLeft size={14} /> Return to Wizard
                    </button>
                </div>
            )}

            {/* ══════ Header ══════ */}
            <div className="bg-app-surface rounded-3xl p-8 shadow-2xl border border-app-border">
                <div className="flex justify-between items-start gap-6 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl" style={{ background: 'var(--app-primary)20' }}>
                            <Target style={{ color: 'var(--app-primary)' }} size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold font-serif italic text-app-foreground">Posting Engine</h2>
                            <p className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">
                                Enterprise financial event routing — {totalConfigured}/{totalEvents} events configured
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Ready indicator */}
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-app-border text-xs font-bold"
                            style={{ color: criticalMissing.length === 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                            {criticalMissing.length === 0
                                ? <><CheckCircle2 size={16} /> Ready</>
                                : <><XCircle size={16} /> {criticalMissing.length} Critical Missing</>
                            }
                        </div>
                        <button onClick={handleAutoDetect} disabled={isPending}
                            className="px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border"
                            style={{ background: 'var(--app-warning-bg)', borderColor: 'var(--app-warning)50', color: 'var(--app-warning)' }}>
                            <Zap size={18} /> Auto-Detect
                        </button>
                        <button onClick={handleSave} disabled={isPending}
                            className="px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            <Save size={18} /> {isPending ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* Coverage mini-bar in header */}
                <div className="mt-5">
                    <CoverageBar pct={overallPct} color="var(--app-primary)" />
                </div>
            </div>

            {/* ══════ Critical Blockers Alert ══════ */}
            {criticalMissing.length > 0 && (
                <div className="rounded-2xl p-5 flex items-start gap-4"
                    style={{ background: 'var(--app-error)08', border: '2px solid var(--app-error)25' }}>
                    <AlertTriangle size={22} style={{ color: 'var(--app-error)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <p className="font-bold text-sm text-app-foreground">
                            {criticalMissing.length} critical event{criticalMissing.length > 1 ? 's' : ''} unmapped — posting will fail
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {criticalMissing.map(e => (
                                <span key={e.code} className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                    style={{ background: 'var(--app-error)15', color: 'var(--app-error)' }}>
                                    {e.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════ Tabs ══════ */}
            <div className="flex gap-1 bg-app-background rounded-2xl p-1.5 border border-app-border">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-app-surface shadow-sm text-app-foreground' : 'text-app-muted-foreground hover:text-app-foreground'
                                }`}>
                            <Icon size={16} />
                            {tab.label}
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: isActive ? 'var(--app-primary)20' : 'var(--app-border)', color: isActive ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }}>
                                {tab.count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* ══════ TAB 1: MAPPINGS ══════ */}
            {activeTab === 'mappings' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {MODULES.map(mod => {
                        const { total, configured } = getModuleStats(mod)
                        const isExpanded = expandedModules.has(mod.key)
                        const Icon = mod.icon
                        const pct = total > 0 ? Math.round((configured / total) * 100) : 0

                        return (
                            <section key={mod.key}
                                className={`bg-app-surface rounded-3xl border shadow-sm overflow-hidden transition-all ${mod.events.some(e => e.criticality === 'CRITICAL' && ruleMap[e.code] == null) ? 'border-app-error/40' : 'border-app-border'
                                    }`}>
                                {/* Module Header (clickable) */}
                                <button onClick={() => toggleModule(mod.key)}
                                    className="w-full p-5 bg-app-background border-b border-app-border flex items-center gap-3 hover:bg-app-surface transition-colors text-left">
                                    <Icon size={18} style={{ color: mod.color }} />
                                    <h3 className="font-bold text-app-foreground text-xs uppercase tracking-widest flex-1">
                                        {mod.label}
                                    </h3>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                        style={{ background: pct === 100 ? 'var(--app-success)20' : 'var(--app-warning-bg)', color: pct === 100 ? 'var(--app-success)' : 'var(--app-warning)' }}>
                                        {configured}/{total}
                                    </span>
                                    {isExpanded ? <ChevronDown size={16} className="text-app-muted-foreground" /> : <ChevronRight size={16} className="text-app-muted-foreground" />}
                                </button>

                                {/* Events */}
                                {isExpanded && (
                                    <div className="p-5 space-y-4">
                                        {mod.events.map(event => {
                                            const accountId = ruleMap[event.code]
                                            const isMissing = accountId == null
                                            const isCriticalMissing = isMissing && event.criticality === 'CRITICAL'

                                            return (
                                                <div key={event.code} className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <label className={`text-[11px] font-bold uppercase tracking-wide flex-1 ${isCriticalMissing ? 'text-app-error' : isMissing ? 'text-app-warning' : 'text-app-muted-foreground'}`}>
                                                            {event.label}
                                                            {isCriticalMissing && <span className="text-app-error normal-case ml-1">⚠</span>}
                                                        </label>
                                                        <CriticalityBadge level={event.criticality} />
                                                    </div>
                                                    <select
                                                        value={accountId || ''}
                                                        onChange={() => { /* Read-only for now — use save button */ }}
                                                        className={`w-full bg-app-surface rounded-xl p-3 text-sm font-medium outline-none transition-all shadow-sm border ${isCriticalMissing ? 'border-app-error/50 bg-app-error-bg/30' : isMissing ? 'border-app-warning/30' : 'border-app-border'
                                                            }`}
                                                    >
                                                        <option value="">(Not Mapped)</option>
                                                        {accounts.map((acc: any) => (
                                                            <option key={acc.id} value={acc.id}>
                                                                {acc.code} — {acc.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-app-muted-foreground font-medium italic">{event.description}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </section>
                        )
                    })}
                </div>
            )}

            {/* ══════ TAB 2: COVERAGE DASHBOARD ══════ */}
            {activeTab === 'coverage' && (
                <div className="space-y-6">
                    {/* Overall Gauge */}
                    <div className="bg-app-surface rounded-3xl border border-app-border p-8 text-center">
                        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 mb-4"
                            style={{ borderColor: overallPct >= 80 ? 'var(--app-success)' : overallPct >= 50 ? 'var(--app-warning)' : 'var(--app-error)' }}>
                            <span className="text-3xl font-black text-app-foreground">{overallPct}%</span>
                        </div>
                        <h3 className="text-lg font-bold text-app-foreground">Overall Coverage</h3>
                        <p className="text-sm text-app-muted-foreground mt-1">{totalConfigured} of {totalEvents} posting events configured</p>
                        <div className="flex items-center justify-center gap-2 mt-3">
                            {criticalMissing.length === 0
                                ? <span className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--app-success)' }}>
                                    <CheckCircle2 size={14} /> All critical events mapped — posting engine ready
                                </span>
                                : <span className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--app-error)' }}>
                                    <XCircle size={14} /> {criticalMissing.length} critical event{criticalMissing.length > 1 ? 's' : ''} missing — posting will fail
                                </span>
                            }
                        </div>
                    </div>

                    {/* Per-Module Bars */}
                    <div className="bg-app-surface rounded-3xl border border-app-border overflow-hidden">
                        <div className="p-5 bg-app-background border-b border-app-border">
                            <h3 className="font-bold text-app-foreground text-xs uppercase tracking-widest">Coverage by Module</h3>
                        </div>
                        <div className="p-6 space-y-5">
                            {MODULES.map(mod => {
                                const { total, configured } = getModuleStats(mod)
                                const pct = total > 0 ? Math.round((configured / total) * 100) : 0
                                const critCount = mod.events.filter(e => e.criticality === 'CRITICAL' && ruleMap[e.code] == null).length
                                const Icon = mod.icon

                                return (
                                    <div key={mod.key}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <Icon size={14} style={{ color: mod.color }} />
                                                <span className="text-xs font-bold text-app-foreground">{mod.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {critCount > 0 && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                                                        style={{ background: 'var(--app-error)', color: 'white' }}>
                                                        {critCount} CRITICAL
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold text-app-muted-foreground">
                                                    {configured}/{total} ({pct}%)
                                                </span>
                                            </div>
                                        </div>
                                        <CoverageBar pct={pct} color={mod.color} />
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Criticality breakdown */}
                    {completeness && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Critical Missing', items: completeness.missing_critical, color: 'var(--app-error)', icon: XCircle },
                                { label: 'Standard Missing', items: completeness.missing_standard, color: 'var(--app-warning)', icon: AlertTriangle },
                                { label: 'Conditional', items: completeness.missing_conditional, color: '#e67e22', icon: Shield },
                                { label: 'Optional', items: completeness.missing_optional, color: 'var(--app-muted-foreground)', icon: FileText },
                            ].map(cat => {
                                const CatIcon = cat.icon
                                return (
                                    <div key={cat.label} className="bg-app-surface rounded-2xl border border-app-border p-5 text-center">
                                        <CatIcon size={20} style={{ color: cat.color, margin: '0 auto' }} />
                                        <p className="text-2xl font-black text-app-foreground mt-2">{cat.items.length}</p>
                                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">{cat.label}</p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══════ TAB 3: AUDIT TRAIL ══════ */}
            {activeTab === 'history' && (
                <div className="bg-app-surface rounded-3xl border border-app-border overflow-hidden">
                    <div className="p-5 bg-app-background border-b border-app-border flex items-center justify-between">
                        <h3 className="font-bold text-app-foreground text-xs uppercase tracking-widest flex items-center gap-2">
                            <History size={16} /> Rule Change History
                        </h3>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{history.length} entries</span>
                    </div>

                    {history.length === 0 ? (
                        <div className="p-12 text-center text-app-muted-foreground">
                            <Clock size={32} className="mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">No changes recorded yet</p>
                            <p className="text-xs mt-1">Changes to posting rules will appear here automatically.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-app-border">
                            {history.map((entry, i) => {
                                const isCreate = entry.change_type === 'CREATE'
                                const isDelete = entry.change_type === 'DELETE'
                                const ts = new Date(entry.timestamp)
                                const timeAgo = getTimeAgo(ts)

                                return (
                                    <div key={i} className="p-4 hover:bg-app-background transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase"
                                                        style={{
                                                            background: isCreate ? 'var(--app-success)20' : isDelete ? 'var(--app-error)20' : 'var(--app-info)20',
                                                            color: isCreate ? 'var(--app-success)' : isDelete ? 'var(--app-error)' : 'var(--app-info)',
                                                        }}>
                                                        {entry.change_type}
                                                    </span>
                                                    <span className="text-xs font-bold text-app-foreground font-mono">{entry.event_code}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-app-muted-foreground">
                                                    {entry.old_account && (
                                                        <span className="bg-app-background px-2 py-0.5 rounded text-[10px]">{entry.old_account}</span>
                                                    )}
                                                    {entry.old_account && entry.new_account && (
                                                        <ArrowRight size={12} />
                                                    )}
                                                    {entry.new_account && (
                                                        <span className="bg-app-background px-2 py-0.5 rounded text-[10px] font-medium">{entry.new_account}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-[10px] text-app-muted-foreground">{timeAgo}</p>
                                                {entry.changed_by && (
                                                    <p className="text-[10px] text-app-muted-foreground font-medium">by {entry.changed_by}</p>
                                                )}
                                                {entry.source && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                                                        style={{ background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                                                        {entry.source}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Info footer */}
            <div className="bg-app-background p-6 rounded-3xl border border-app-border flex items-start gap-4">
                <Shield size={24} className="text-app-muted-foreground flex-shrink-0" />
                <div>
                    <h4 className="font-bold text-sm text-app-foreground">Posting Engine Architecture</h4>
                    <p className="text-xs text-app-muted-foreground mt-1 leading-relaxed">
                        PostingRule is the <strong>single source of truth</strong> for all GL account mappings.
                        Every financial service resolves accounts through <strong>PostingResolver</strong> — no hardcoded account codes.
                        Changes are immutably tracked in the audit trail.
                        Posted journal entries carry a frozen <strong>posting snapshot</strong> of the rules active at posting time.
                    </p>
                </div>
            </div>

            {/* ═══════ Impact Analysis Dialog ═══════ */}
            {impactDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-app-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-app-border">
                        <div className="p-6 border-b border-app-border flex items-start justify-between" style={{ background: 'var(--app-warning-bg)' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl" style={{ background: 'var(--app-warning)20' }}>
                                    <AlertTriangle style={{ color: 'var(--app-warning)' }} size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-app-foreground text-lg">Account Change Impact</h3>
                                    <p className="text-xs text-app-muted-foreground mt-0.5">
                                        {impactDialog.impacts.filter(i => i.risk === 'HIGH').length} rule(s) affect existing balances.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setImpactDialog(null)} className="p-1 hover:bg-app-surface rounded-lg">
                                <X size={18} className="text-app-muted-foreground" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-6 space-y-3">
                            {impactDialog.impacts.map((impact, i) => (
                                <div key={i} className={`p-4 rounded-2xl border ${impact.risk === 'HIGH' ? 'border-app-error/30 bg-app-error-bg' : 'border-app-border bg-app-background'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-xs text-app-muted-foreground uppercase tracking-widest">{impact.rule}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${impact.risk === 'HIGH' ? 'bg-app-error text-white' : 'bg-app-surface-2 text-app-muted-foreground'}`}>
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
                                        <div className="mt-3 flex items-center gap-4 text-xs text-app-error font-bold">
                                            <span>{impact.journal_entries} journal entries</span>
                                            <span>Balance: {impact.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-app-border bg-app-background space-y-3">
                            <button onClick={() => handleConfirmSave(true)} disabled={isPending}
                                className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', color: 'white' }}>
                                <Save size={16} /> Save & Reclassify Balances (Recommended)
                            </button>
                            <p className="text-[10px] text-app-muted-foreground text-center">
                                Posts reclassification journal entries to sweep balances from old to new accounts.
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => handleConfirmSave(false)} disabled={isPending}
                                    className="flex-1 bg-app-surface border border-app-border text-app-foreground py-2.5 rounded-xl text-xs font-bold hover:bg-app-surface-2 transition-all disabled:opacity-50">
                                    Save Without Reclassify
                                </button>
                                <button onClick={() => setImpactDialog(null)}
                                    className="flex-1 bg-app-surface border border-app-border text-app-muted-foreground py-2.5 rounded-xl text-xs font-bold hover:bg-app-surface-2 transition-all">
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

// ═══════════════════════════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════════════════════════

function getTimeAgo(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return date.toLocaleDateString()
}