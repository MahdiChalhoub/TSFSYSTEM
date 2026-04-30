/**
 * Purchase Analytics Settings — V2 Dajingo Pro Style Tokens
 * ===========================================================
 */

export const pageWrap = "min-h-screen p-4 md:p-6 animate-in fade-in duration-300"
export const pageHeader = "mb-4"
export const pageTitle = "text-2xl md:text-3xl font-black text-app-foreground tracking-tight"
export const pageSub = "text-[11px] text-app-muted-foreground mt-0.5 leading-relaxed"

export const card = "rounded-2xl border shadow-sm transition-all hover:shadow-md"
export const cardHead = (accent: string, collapsed?: boolean) =>
    `px-4 py-3 flex items-center gap-3 cursor-pointer select-none transition-all rounded-t-2xl ${collapsed ? 'rounded-b-2xl' : ''}`
export const cardTitle = "text-[12px] font-black text-app-foreground tracking-tight"
export const cardBody = "px-4 py-4 space-y-4 animate-in fade-in duration-200"
export const fieldLabel = "block text-[9px] font-black text-app-muted-foreground mb-1.5 uppercase tracking-widest"
export const fieldHint = "text-[9px] text-app-muted-foreground mt-1 leading-relaxed"
export const fieldSelect = "w-full bg-app-bg border border-app-border/50 rounded-xl px-3 py-2 text-[12px] font-bold focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary outline-none transition-all text-app-foreground appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
export const fieldInput = "w-full bg-app-bg border border-app-border/50 rounded-xl px-3 py-2 text-[12px] font-bold focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary outline-none transition-all text-app-foreground disabled:opacity-50 disabled:cursor-not-allowed"
export const toggleBtn = (active: boolean) =>
    `px-3 py-2 rounded-xl text-[10px] font-black transition-all border cursor-pointer ${
        active
            ? 'bg-app-primary text-white border-app-primary shadow-sm'
            : 'bg-app-bg text-app-muted-foreground border-app-border/50 hover:border-app-primary/30 hover:text-app-foreground'
    }`

export const PERIOD_OPTIONS = [
    { value: 30, label: 'Last 30 Days' },
    { value: 90, label: 'Last 90 Days' },
    { value: 180, label: 'Last 6 Months' },
    { value: 365, label: 'Last 1 Year' },
    { value: 0, label: 'All Time' },
]

export const CONFIG_PRESETS: { name: string; icon: string; desc: string; values: Record<string, any> }[] = [
    {
        name: 'Conservative', icon: '🛡️', desc: 'High safety stock, long analysis window',
        values: { sales_avg_period_days: 365, proposed_qty_lead_days: 30, proposed_qty_safety_multiplier: 2.0, best_price_period_days: 365 }
    },
    {
        name: 'Balanced', icon: '⚖️', desc: 'Standard settings for most businesses',
        values: { sales_avg_period_days: 180, proposed_qty_lead_days: 14, proposed_qty_safety_multiplier: 1.3, best_price_period_days: 180 }
    },
    {
        name: 'Aggressive', icon: '⚡', desc: 'Low stock, fast turnover, lean inventory',
        values: { sales_avg_period_days: 30, proposed_qty_lead_days: 7, proposed_qty_safety_multiplier: 1.0, best_price_period_days: 30 }
    },
]

export const FIELD_HELP: Record<string, string> = {
    sales_avg_period_days: 'The time window used to calculate average daily/monthly sales. Longer periods smooth out seasonal spikes but react slower to trends.',
    sales_window_size_days: 'The sliding window size for calculating rolling averages. Smaller windows are more responsive but noisier.',
    sales_type_exclusions: 'Exclude specific transaction types (returns, internal transfers) from sales averages to avoid skewing the data.',
    proposed_qty_formula: 'The mathematical formula used to calculate how much to order. AVG_DAILY uses daily rates, AVG_MONTHLY uses monthly rates.',
    proposed_qty_lead_days: 'How many days of stock coverage the system should aim for. Factor in supplier lead time + safety buffer.',
    proposed_qty_safety_multiplier: 'Multiplied against the base calculation. 1.0 = exact match. 1.5 = 50% extra safety stock. Below 1.0 risks stockouts.',
    best_price_period_days: 'How far back to look for the best supplier price. Shorter periods reflect current market prices, longer periods find historical lows.',
    purchase_context: 'Retail mode optimizes for individual unit economics. Wholesale mode focuses on bulk pricing, volume discounts, and pallet quantities.',
    po_count_source: 'Whether PO Count reads from actual purchase invoices (received goods) or purchase orders (placed orders). Invoices are more accurate.',
    financial_score_weights: 'How much each factor contributes to a product\'s financial score (must sum to 100%). Margin = profitability, Velocity = demand speed, Stock Health = days of supply.',
}

export const QUICK_PRESETS: Record<string, { label: string; icon: string; values: Record<string, any> }> = {
    conservative: {
        label: 'Conservative', icon: '🛡️',
        values: { sales_avg_period_days: 365, sales_window_size_days: 60, proposed_qty_lead_days: 7, proposed_qty_safety_multiplier: 1.0 },
    },
    balanced: {
        label: 'Balanced', icon: '⚖️',
        values: { sales_avg_period_days: 180, sales_window_size_days: 30, proposed_qty_lead_days: 14, proposed_qty_safety_multiplier: 1.3 },
    },
    aggressive: {
        label: 'Aggressive', icon: '🚀',
        values: { sales_avg_period_days: 90, sales_window_size_days: 14, proposed_qty_lead_days: 21, proposed_qty_safety_multiplier: 1.8 },
    },
}

export const SECTION_DEFAULTS: Record<string, Record<string, any>> = {
    sales: { sales_avg_period_days: 180, sales_window_size_days: 30, sales_type_exclusions: '' },
    proposed: { proposed_qty_formula: 'AVG_DAILY', proposed_qty_lead_days: 14, proposed_qty_safety_multiplier: 1.3 },
    pricing: { best_price_period_days: 180, purchase_context: 'retail' },
    scoring: { financial_score_weights: { margin: 40, velocity: 35, stock_health: 25 } },
}

export const DEFAULTS: Record<string, any> = {
    sales_avg_period_days: 180, sales_window_size_days: 30,
    proposed_qty_formula: 'AVG_DAILY', proposed_qty_lead_days: 14,
    proposed_qty_safety_multiplier: 1.3, best_price_period_days: 180,
    purchase_context: 'retail', po_count_source: 'invoice',
}

/* ── Human-readable label helpers ── */
export const periodLabel = (v: number) => PERIOD_OPTIONS.find(o => o.value === v)?.label || String(v)
export const formulaLabel = (v: string) => v === 'AVG_DAILY_x_LEAD_DAYS' ? 'Daily Avg × Lead Days' : 'Monthly Avg × Months'
export const contextLabel = (v: string) => v === 'RETAIL' ? 'Retail' : 'Wholesale'
export const sourceLabel = (v: string) => v === 'PURCHASE_INVOICE' ? 'Purchase Invoices' : 'Purchase Orders'
