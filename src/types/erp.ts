/**
 * Shared ERP Entity Types
 * =======================
 * Centralized type definitions for all ERP domain entities.
 * Used across pages and components to replace `useState<any>`.
 */

// ─── Finance ────────────────────────────────────────────────────

export interface ChartOfAccount {
    id: number
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
    sub_type?: string
    parent?: number | null
    parent_name?: string
    balance: number
    directBalance: number
    rollup_balance?: number
    temp_balance?: number
    syscohada_code?: string
    syscohada_class?: string
    is_active: boolean
    children?: ChartOfAccount[]
    depth?: number
}

export interface FinancialAccount {
    id: number
    name: string
    type: string
    site_id?: number
    currency: string
    balance: number
    is_active: boolean
}

export interface JournalEntry {
    id: number
    reference?: string
    description?: string
    date: string
    entry_type?: string
    scope?: 'OFFICIAL' | 'INTERNAL'
    status?: string
    total_debit: number
    total_credit: number
    lines: JournalLine[]
    created_at?: string
    created_by?: string
}

export interface JournalLine {
    id?: number
    account_id: number
    account_name?: string
    account_code?: string
    debit: number
    credit: number
    description?: string
    contact_id?: number | null
    employee_id?: number | null
}

export interface Voucher {
    id: number
    reference: string
    description?: string
    date: string
    amount: number
    status: string
    type?: string
    voucher_type?: string
    scope?: 'OFFICIAL' | 'INTERNAL'
    source_account_id?: number
    source_account?: string
    destination_account_id?: number
    destination_account?: string
    financial_event_id?: number
    financial_event?: string
    is_posted?: boolean
    lines?: VoucherLine[]
    lifecycle_status?: string
    created_at?: string
    created_by?: string
    [key: string]: unknown
}

export interface VoucherLine {
    id?: number
    account_id: number
    account_name?: string
    debit: number
    credit: number
    description?: string
}

export interface FiscalYear {
    id: number
    name: string
    start_date: string
    end_date: string
    status: 'OPEN' | 'CLOSED' | 'LOCKED'
    is_locked: boolean
    periods: FiscalPeriod[]
}

export interface FiscalPeriod {
    id: number
    name: string
    start_date: string
    end_date: string
    status: 'OPEN' | 'CLOSED' | 'LOCKED'
    fiscal_year: number
}

export interface Payment {
    id: number
    reference?: string
    amount: number
    date: string
    payment_date?: string
    type: string
    status?: string
    method?: string
    contact_id?: number
    contact?: number
    contact_name?: string
    account_id?: number
    account_name?: string
    payment_account_id?: number
    notes?: string
    [key: string]: unknown
}

export interface AgingBucket {
    contact_id: number
    contact_name: string
    current: number
    days_30: number
    days_60: number
    days_90: number
    over_90: number
    total: number
}

export interface ContactBalance {
    id: number
    name: string
    balance: number
    type?: string
}

export interface FinancialEvent {
    id: number
    event_type: string
    description: string
    amount: number
    date: string
    status?: string
    metadata?: Record<string, unknown>
}

export interface Asset {
    id: number
    name: string
    code?: string
    description?: string
    category?: string
    acquisition_date?: string
    purchase_date?: string
    acquisition_cost?: number
    purchase_value?: number
    book_value?: number
    useful_life_months?: number
    useful_life_years?: number
    salvage_value?: number
    residual_value?: number
    accumulated_depreciation?: number
    depreciation_method: string
    account_id?: number
    account_name?: string
    source_account_id?: number
    status: string
    current_value?: number
    [key: string]: unknown
}

export interface DepreciationScheduleItem {
    period: string
    opening_value: number
    depreciation: number
    accumulated: number
    closing_value: number
}

export interface DeferredExpense {
    id: number
    name: string
    total_amount: number
    start_date: string
    end_date: string
    periods: number
    account_id?: number
    account_name?: string
    status: string
}

export interface TaxGroup {
    id: number
    name: string
    rate: number
    total_collected: number
    total_paid: number
    net: number
}

export interface TaxSummary {
    total_collected: number
    total_paid: number
    net_liability: number
    period: string
}

export interface ProfitDistribution {
    id: number
    fiscal_year_id: number
    fiscal_year_name?: string
    status: string
    total_profit: number
    date: string
    allocations?: ProfitAllocation[]
}

export interface ProfitAllocation {
    partner_id: number
    partner_name: string
    percentage: number
    amount: number
}

export interface BankReconciliation {
    id: number
    account_id: number
    account_name?: string
    statement_balance: number
    book_balance: number
    difference: number
    status: string
    items?: BankReconciliationItem[]
}

export interface BankReconciliationItem {
    id: number
    description: string
    amount: number
    date: string
    matched: boolean
}

export interface AuditTrailEntry {
    id: number
    action: string
    model: string
    object_id: number
    user: string
    timestamp: string
    changes?: Record<string, unknown>
}

export interface AuditTrailResponse {
    results: AuditTrailEntry[]
    count: number
}

export interface CashRegisterData {
    register_id: number
    opening_balance: number
    current_balance: number
    transactions: CashTransaction[]
}

export interface CashTransaction {
    id: number
    type: string
    amount: number
    description: string
    timestamp: string
}

export interface LifecycleHistoryEntry {
    id: number
    action: string
    from_status: string
    to_status: string
    user: string
    timestamp: string
    notes?: string
}

export interface DiagnosticItem {
    code: string
    severity: 'INFO' | 'WARNING' | 'ERROR'
    message: string
    details?: string
}

// ─── Inventory ──────────────────────────────────────────────────

export interface Product {
    id: number
    name: string
    sku: string
    barcode?: string
    category_id?: number
    category_name?: string
    brand_id?: number
    brand_name?: string
    selling_price_ttc: number
    cost_price_ht?: number
    tva_rate?: number
    stock_level: number
    min_stock?: number
    max_stock?: number
    is_active: boolean
}

export interface Warehouse {
    id: number
    name: string
    code?: string
    site_id?: number
    site_name?: string
    is_active: boolean
}

export interface TransferOrder {
    id: number
    reference: string
    from_warehouse_id: number
    from_warehouse_name?: string
    to_warehouse_id: number
    to_warehouse_name?: string
    status: string
    date: string
    lines: TransferOrderLine[]
    lifecycle_status?: string
}

export interface TransferOrderLine {
    id?: number
    product_id: number
    product_name?: string
    quantity: number
    received_quantity?: number
}

export interface AdjustmentOrder {
    id: number
    reference: string
    warehouse_id: number
    warehouse_name?: string
    reason: string
    status: string
    date: string
    lines: AdjustmentOrderLine[]
    lifecycle_status?: string
}

export interface AdjustmentOrderLine {
    id?: number
    product_id: number
    product_name?: string
    quantity_change: number
    reason?: string
}

export interface OperationalRequest {
    id: number
    reference: string
    request_type: string
    warehouse_id: number
    warehouse_name?: string
    status: string
    date: string
    priority?: string
    lines: OperationalRequestLine[]
}

export interface OperationalRequestLine {
    id?: number
    product_id: number
    product_name?: string
    requested_quantity: number
    approved_quantity?: number
}

export interface ValuationData {
    total_value: number
    method: string
    warehouse_breakdown: WarehouseValuation[]
    category_breakdown: CategoryValuation[]
}

export interface WarehouseValuation {
    warehouse_id: number
    warehouse_name: string
    total_value: number
    item_count: number
}

export interface CategoryValuation {
    category_id: number
    category_name: string
    total_value: number
    item_count: number
}

export interface LowStockData {
    critical: LowStockItem[]
    warning: LowStockItem[]
    total_critical: number
    total_warning: number
}

export interface LowStockItem {
    product_id: number
    product_name: string
    sku: string
    current_stock: number
    min_stock: number
    warehouse_name?: string
}

export interface ExpiryAlertData {
    expired: ExpiryItem[]
    expiring_soon: ExpiryItem[]
    total_expired: number
    total_expiring: number
}

export interface ExpiryItem {
    product_id: number
    product_name: string
    batch_number: string
    expiry_date: string
    quantity: number
    warehouse_name?: string
}

// ─── Sales ──────────────────────────────────────────────────────

export interface SalesOrder {
    id: number
    reference: string
    date: string
    customer_id?: number
    customer_name?: string
    status: string
    total: number
    items?: SalesOrderLine[]
}

export interface SalesOrderLine {
    id?: number
    product_id: number
    product_name?: string
    quantity: number
    unit_price: number
    total: number
}

export interface SalesReturn {
    id: number
    reference: string
    order_id: number
    order_reference?: string
    date: string
    status: string
    total: number
    lines?: SalesReturnLine[]
}

export interface SalesReturnLine {
    id?: number
    product_id: number
    product_name?: string
    quantity: number
    reason?: string
}

export interface CreditNote {
    id: number
    reference: string
    return_id: number
    amount: number
    date: string
    status: string
}

export interface DeliveryOrder {
    id: number
    reference: string
    order_id: number
    status: string
    date: string
    address?: string
    driver?: string
}

export interface DeliveryZone {
    id: number
    name: string
    fee: number
    estimated_time?: string
    is_active: boolean
}

export interface DiscountRule {
    id: number
    name: string
    type: string
    value: number
    min_amount?: number
    start_date?: string
    end_date?: string
    is_active: boolean
    usage_count?: number
}

export interface DiscountUsageLog {
    id: number
    rule_id: number
    order_id: number
    amount: number
    date: string
}

export interface SalesAnalytics {
    total_revenue: number
    total_orders: number
    average_order: number
    top_products: TopProduct[]
    trend: TrendPoint[]
}

export interface TopProduct {
    product_id: number
    product_name: string
    quantity_sold: number
    revenue: number
}

export interface TrendPoint {
    date: string
    revenue: number
    orders: number
}

// ─── Purchases ──────────────────────────────────────────────────

export interface PurchaseOrder {
    id: number
    reference: string
    supplier_id: number
    supplier_name?: string
    date: string
    status: string
    total: number
    lines?: PurchaseOrderLine[]
}

export interface PurchaseOrderLine {
    id?: number
    product_id: number
    product_name?: string
    quantity: number
    unit_price: number
    total: number
}

export interface PurchaseReturn {
    id: number
    reference: string
    order_id: number
    order_reference?: string
    date: string
    status: string
    total: number
}

// ─── CRM & HR ───────────────────────────────────────────────────

export interface Contact {
    id: number
    name: string
    type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER'
    email?: string
    phone?: string
    address?: string
    company?: string
    tax_id?: string
    balance?: number
}

export interface Employee {
    id: number
    name: string
    email?: string
    role?: string
    department?: string
    salary?: number
    hire_date?: string
    status: string
    user_id?: number
}

export interface UserApproval {
    id: number
    username: string
    email: string
    requested_at: string
    status: string
    role?: string
}

export interface ContactStatement {
    contact: Contact
    entries: ContactStatementEntry[]
    opening_balance: number
    closing_balance: number
}

export interface ContactStatementEntry {
    date: string
    reference: string
    description: string
    debit: number
    credit: number
    balance: number
}

// ─── Common ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    results: T[]
    count: number
    next?: string | null
    previous?: string | null
}
