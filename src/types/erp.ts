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
    [key: string]: unknown
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
    startDate?: string
    endDate?: string
    status: 'OPEN' | 'CLOSED' | 'LOCKED'
    is_locked: boolean
    is_closed?: boolean
    isClosed?: boolean
    periods: FiscalPeriod[]
    [key: string]: unknown
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
    reference?: string
    notes?: string
    metadata?: Record<string, unknown>
    [key: string]: unknown
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
    description?: string
    category?: string
    total_amount: number
    monthly_amount?: number
    remaining_amount?: number
    months_recognized?: number
    start_date: string
    end_date?: string
    duration_months?: number
    periods: number
    account_id?: number
    account_name?: string
    source_account_id?: number
    status: string
    [key: string]: unknown
}

export interface TaxGroup {
    id: number
    name: string
    rate: number
    description?: string
    is_active?: boolean
    is_default?: boolean
    total_collected: number
    total_paid: number
    net: number
    [key: string]: unknown
}

export interface TaxSummary {
    total_collected: number
    total_paid: number
    net_liability: number
    net_revenue?: number
    period: string
    sales?: {
        total?: number
        tax?: number
        count?: number
        discount?: number
    }
    [key: string]: unknown
}

export interface ProfitDistribution {
    id: number
    fiscal_year_id: number
    fiscal_year?: number
    fiscal_year_name?: string
    status: string
    total_profit: number
    net_profit?: number
    date: string
    distribution_date?: string
    allocations?: Record<string, unknown>
    notes?: string
    [key: string]: unknown
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
    sku?: string
    barcode?: string
    category_id?: number
    category_name?: string
    brand_id?: number
    brand_name?: string
    selling_price_ttc?: number
    cost_price?: number
    cost_price_ht?: number
    costPrice?: number
    tva_rate?: number
    stock_level?: number
    min_stock?: number
    max_stock?: number
    is_active?: boolean
    unit?: string
    siteStock?: Record<number, number>
    [key: string]: unknown
}

export interface Warehouse {
    id: number
    name: string
    code?: string
    type?: string
    site_id?: number
    siteId?: number | null
    site_name?: string
    site?: { name: string }
    is_active?: boolean
    [key: string]: unknown
}

export interface TransferOrder {
    id: number
    reference?: string
    from_warehouse: number
    from_warehouse_id?: number
    from_warehouse_name?: string
    to_warehouse: number
    to_warehouse_id?: number
    to_warehouse_name?: string
    driver?: string
    status?: string
    date: string
    lines?: TransferOrderLine[] | Record<string, unknown>[]
    lifecycle_status?: string
    is_posted?: boolean
    total_qty_transferred?: number | string
    reason?: string
    notes?: string
    [key: string]: unknown
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
    reference?: string
    warehouse?: number
    warehouse_id?: number
    warehouse_name?: string
    reason?: string
    status?: string
    date: string
    lines?: AdjustmentOrderLine[] | Record<string, unknown>[]
    lifecycle_status?: string
    is_posted?: boolean
    notes?: string
    [key: string]: unknown
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
    reference?: string
    request_type: string
    warehouse_id?: number
    warehouse_name?: string
    status: string
    date: string
    priority?: string
    description?: string
    notes?: string
    lines?: OperationalRequestLine[] | Record<string, unknown>[]
    [key: string]: unknown
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
    reference?: string
    ref_code?: string
    invoice_number?: string
    date?: string
    customer_id?: number
    customer_name?: string
    contact_name?: string
    type?: string
    status?: string
    total?: number
    total_amount?: string | number
    created_at?: string
    items?: SalesOrderLine[]
    lines?: Record<string, unknown>[]
    [key: string]: unknown
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
    reference?: string
    order_id?: number
    order_reference?: string
    original_order?: number
    original_order_ref?: string
    date?: string
    return_date?: string
    status?: string
    total?: number
    total_refund?: string | number
    reason?: string
    customer_name?: string
    lines?: SalesReturnLine[]
    [key: string]: unknown
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
    reference?: string
    order_id?: number
    order?: number
    order_ref?: string
    status?: string
    date?: string
    address?: string
    driver?: string
    recipient_name?: string
    contact_name?: string
    city?: string
    phone?: string
    zone_name?: string
    driver_name?: string
    tracking_code?: string
    delivery_fee?: string | number
    created_at?: string
    dispatched_at?: string
    delivered_at?: string
    [key: string]: unknown
}

export interface DeliveryZone {
    id: number
    name: string
    description?: string
    fee?: number
    base_fee?: string | number
    estimated_time?: string
    estimated_days?: number
    is_active?: boolean
    [key: string]: unknown
}

export interface DiscountRule {
    id: number
    name: string
    code?: string
    type?: string
    discount_type?: string
    scope?: string
    value?: string | number
    min_amount?: number
    min_order_amount?: string | number
    max_discount?: string | number
    min_quantity?: number
    start_date?: string
    end_date?: string
    is_active?: boolean
    auto_apply?: boolean
    usage_limit?: number
    usage_count?: number
    priority?: number
    product?: number
    category?: number
    brand?: number
    [key: string]: unknown
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
    reference?: string
    ref_code?: string
    supplier_id?: number
    supplier_name?: string
    contact_name?: string
    date?: string
    created_at?: string
    status?: string
    total?: number
    total_amount?: string | number
    payment_method?: string
    lines?: PurchaseOrderLine[]
    [key: string]: unknown
}

export interface PurchaseOrderLine {
    id?: number
    product_id: number
    product?: number
    product_name?: string
    quantity: number
    unit_price: number
    total: number
    qty_received?: number
    [key: string]: unknown
}

export interface PurchaseReturn {
    id: number
    reference?: string
    order_id?: number
    order_reference?: string
    original_order?: number
    original_order_ref?: string
    date?: string
    return_date?: string
    status?: string
    total?: number
    total_amount?: string | number
    reason?: string
    supplier_name?: string
    supplier?: number
    [key: string]: unknown
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
    [key: string]: unknown
}

export interface Employee {
    id: number
    name?: string
    first_name?: string
    last_name?: string
    email?: string
    role?: string
    department?: string
    employee_id?: string
    employee_type?: string
    job_title?: string
    salary?: string | number
    hire_date?: string
    status?: string
    user_id?: number
    is_active?: boolean
    [key: string]: unknown
}

export interface UserApproval {
    id: number
    username?: string
    email?: string
    first_name?: string
    last_name?: string
    requested_at?: string
    status?: string
    role?: string
    [key: string]: unknown
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

export interface LifecycleHistoryEntry {
    action: string
    level?: number
    performed_by_name?: string
    performed_at: string
    comment?: string
    [key: string]: unknown
}

export interface ValuationResponse {
    summary?: {
        total_value: number
        total_products: number
        total_quantity: number
    }
    products?: Record<string, unknown>[]
    [key: string]: unknown
}

export interface LowStockResponse {
    stats?: {
        total_alerts: number
        out_of_stock: number
        critical: number
        low: number
        total_restock_value: number
    }
    products?: Record<string, unknown>[]
    [key: string]: unknown
}

export interface ExpiryAlertResponse {
    stats?: {
        expired: number
        critical: number
        warning: number
        total_value: number
        total_quantity: number
    }
    alerts?: Record<string, unknown>[]
    [key: string]: unknown
}

// ─── Additional Sales Types ─────────────────────────────────────

export interface ImportResult {
    success_count: number
    error_count: number
    errors: { row: number; error: string }[]
    [key: string]: unknown
}

export interface UsageLog {
    id: number
    rule?: number
    order?: number
    applied_at?: string
    discount_amount?: string | number
    [key: string]: unknown
}

export interface SalesAnalyticsData {
    period?: { start: string; end: string }
    overall: {
        revenue: number
        orders: number
        avg_order: number
        tax: number
        discount: number
    }
    top_products?: Record<string, unknown>[]
    top_customers?: Record<string, unknown>[]
    daily_trend?: Record<string, unknown>[]
    payment_methods?: Record<string, unknown>[]
    site_performance?: Record<string, unknown>[]
    [key: string]: unknown
}

// ─── Additional Purchases Types ─────────────────────────────────

export interface PurchaseLine {
    productId: number
    productName?: string
    quantity: number
    unitCostHT?: number
    unitCostTTC?: number
    sellingPriceHT?: number
    sellingPriceTTC?: number
    taxRate?: number
    expiryDate?: string
    [key: string]: unknown
}

// ─── Catalog ────────────────────────────────────────────────────

export interface Category {
    id: number
    name: string
    parent?: number | null
    [key: string]: unknown
}

export interface Brand {
    id: number
    name: string
    [key: string]: unknown
}

export interface ProductAttribute {
    id: number
    name: string
    value?: string
    [key: string]: unknown
}

// ─── Common ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    results: T[]
    count: number
    next?: string | null
    previous?: string | null
}

// ─── Auth / Public Config ───────────────────────────────────────

export interface PublicConfigTenant {
    name?: string
    slug?: string
    logo?: string
    roles?: Array<{ id: number; name: string;[key: string]: unknown }>
    sites?: Array<{ id: number; name: string;[key: string]: unknown }>
    [key: string]: unknown
}

export interface PublicConfig {
    tenant?: PublicConfigTenant | null
    business_types?: Array<{ id: number; name: string;[key: string]: unknown }>
    currencies?: Array<{ id: number; name: string; code?: string;[key: string]: unknown }>
    [key: string]: unknown
}

// ─── CRM Contact Summary ────────────────────────────────────────

export interface ContactSummaryData {
    contact: {
        name: string
        type: string
        email?: string
        phone?: string
        address?: string
        credit_limit?: number
        payment_terms_days?: number
        loyalty_points?: number
        supplier_category?: string
        customer_tier?: string
        vat_id?: string
        [key: string]: unknown
    }
    orders: {
        recent: Array<Record<string, unknown>>
        stats: { total_count: number; total_amount: number; completed: number; draft: number;[key: string]: unknown }
    }
    payments: {
        recent: Array<Record<string, unknown>>
        stats: { payment_count: number; total_paid: number;[key: string]: unknown }
    }
    balance: { current_balance: number; last_payment_date?: string;[key: string]: unknown }
    journal_entries: Array<Record<string, unknown>>
    analytics?: { avg_order_value?: number; monthly_frequency?: number; total_revenue?: number; top_products?: Array<Record<string, unknown>>;[key: string]: unknown }
    pricing_rules?: Array<Record<string, unknown>>
    [key: string]: unknown
}

// ─── SaaS Entities ──────────────────────────────────────────────

export interface SaasOrganization {
    id: number
    name: string
    slug?: string
    logo?: string
    is_active?: boolean
    status?: string
    plan_name?: string
    current_plan_name?: string          // used in organizations list page
    subscription_status?: string
    created_at?: string
    user_count?: number
    site_count?: number
    module_count?: number
    business_email?: string
    client_name?: string
    business_type_name?: string
    country?: string
    modules?: Array<Record<string, unknown>>
    sites?: Array<Record<string, unknown>>
    subscription?: Record<string, unknown>
    [key: string]: unknown
}

interface SaasUsageMeter {
    current: number
    limit: number
    percent: number
}

interface SaasUsageModules {
    current: number
    total_available: number
}

interface SaasUsageStorage {
    current_mb: number
    limit_mb: number
    percent: number
}

interface SaasUsagePlan {
    name?: string
    monthly_price?: string | number
    annual_price?: string | number
    expiry?: string
    [key: string]: unknown
}

interface SaasUsageClient {
    full_name?: string
    company_name?: string | null
    email?: string
    phone?: string | null
    [key: string]: unknown
}

export interface SaasUsageData {
    users: SaasUsageMeter
    sites: SaasUsageMeter
    storage: SaasUsageStorage
    invoices: SaasUsageMeter
    modules: SaasUsageModules
    plan?: SaasUsagePlan
    client?: SaasUsageClient | null
    warnings?: Array<Record<string, unknown>>
    [key: string]: unknown
}

export interface SaasBillingClient {
    id: string
    full_name: string
    email: string
    phone?: string | null
    company_name?: string | null
    /** CRM Contact ID in the SaaS org — used to navigate directly to /crm/contacts/{id} */
    crm_contact_id?: string | null
    [key: string]: unknown
}

export interface SaasBillingData {
    history: Array<Record<string, unknown>>
    balance: { total_paid: string; total_credits: string; net_balance: string;[key: string]: unknown }
    client: SaasBillingClient | null
    [key: string]: unknown
}

export interface SaasAddonData {
    purchased: Array<Record<string, unknown>>
    available: Array<Record<string, unknown>>
    [key: string]: unknown
}

interface SaasPlanLimits {
    max_users?: number
    max_sites?: number
    max_products?: number
    max_storage_gb?: number
    max_invoices_per_month?: number
    max_customers?: number
    storage_gb?: number
    custom?: boolean
    [key: string]: unknown
}

interface SaasPlanCategory {
    id: number
    name: string
    slug?: string
    type?: string
    [key: string]: unknown
}

export interface SaasPlan {
    id: number
    name: string
    slug?: string
    description?: string
    monthly_price: string
    annual_price: string
    is_public?: boolean
    is_active?: boolean
    sort_order?: number
    trial_days?: number
    price?: string | number
    max_users?: number
    max_products?: number
    max_sites?: number
    category?: SaasPlanCategory
    limits?: SaasPlanLimits
    modules?: string[]
    features?: Record<string, unknown>
    organizations?: Array<Record<string, unknown>>
    addons?: Array<Record<string, unknown>>
    [key: string]: unknown
}

export interface SaasUpdateStatus {
    current_version?: string
    latest_version?: string
    update_available?: boolean
    integrity?: string
    environment?: string
    [key: string]: unknown
}

// ─── Inventory Serial Tracker ───────────────────────────────────

export interface SerialNumber {
    id: number
    serial_number: string
    product_name?: string
    status: string
    warehouse_name?: string
    created_at: string
    [key: string]: unknown
}

export interface SerialHistoryLog {
    id: number
    action: string
    reference?: string
    warehouse_name?: string
    user_name?: string
    created_at: string
    [key: string]: unknown
}

// ─── Admin Hierarchy Data ───────────────────────────────────────

export interface AdminHierarchyProduct {
    id: number
    name: string
    sku?: string
    size?: string
    stock: number
    countryName?: string
    unitName?: string
    unit_name?: string
    country_name?: string
    unit?: { name: string }
    [key: string]: unknown
}

export interface AdminHierarchyGroup {
    id: number
    name: string
    totalStock: number
    products: AdminHierarchyProduct[]
    [key: string]: unknown
}

export interface AdminHierarchyBrandData {
    groups: AdminHierarchyGroup[]
    looseProducts: AdminHierarchyProduct[]
    [key: string]: unknown
}

export interface AdminCountryHierarchyItem {
    id: number
    name: string
    totalStock: number
    products: AdminHierarchyProduct[]
    [key: string]: unknown
}

export interface AdminEntity {
    id: number
    name: string
    code?: string
    short_name?: string
    logo?: string
    product_count?: number
    countries?: Array<{ id: number; name: string; code: string;[key: string]: unknown }>
    categories?: Array<{ id: number; name: string;[key: string]: unknown }>
    products?: Array<Record<string, unknown>>
    [key: string]: unknown
}

// ─── Packages ───────────────────────────────────────────────────

export interface PackageStats {
    total_packages?: number
    total_size?: number
    applied_count?: number
    pending_count?: number
    [key: string]: unknown
}

// ─── SaaS Array Elements ────────────────────────────────────────

export interface SaasModule {
    id: number
    name: string
    code: string
    description?: string
    is_active?: boolean
    is_core?: boolean
    status?: string                         // 'INSTALLED' | 'DISABLED' etc.
    active_features?: string[]             // enabled feature codes
    available_features?: Array<{ code: string; name: string } | string>
    [key: string]: unknown
}

export interface SaasUser {
    id: number
    username: string
    email?: string
    first_name?: string
    last_name?: string
    role?: string
    is_active?: boolean
    is_superuser?: boolean
    is_staff?: boolean
    date_joined?: string
    [key: string]: unknown
}

export interface SaasSite {
    id: number
    name: string
    code?: string
    address?: string
    city?: string
    phone?: string
    vat_number?: string
    is_active?: boolean
    created_at?: string
    [key: string]: unknown
}

export interface SaasAddon {
    id: number
    name: string
    code?: string
    price?: number | string
    description?: string
    [key: string]: unknown
}

export interface PlanCategory {
    id: number
    name: string
    [key: string]: unknown
}

export interface SaasUpdateHistoryEntry {
    id: number
    version: string
    is_applied: boolean
    created_at: string
    applied_at?: string
    status?: string
    changelog?: string
    [key: string]: unknown
}

export interface SaasBackup {
    id: number
    filename?: string
    size?: number
    created_at?: string
    [key: string]: unknown
}

// ─── Admin / UI Array Elements ──────────────────────────────────

export interface SidebarDynamicItem {
    label: string
    href?: string
    path?: string
    icon?: string
    module?: string
    visibility?: string
    children?: SidebarDynamicItem[]
    [key: string]: unknown
}

export interface AppNotification {
    id: number
    title?: string
    message: string
    type?: string
    read_at?: string | null
    created_at?: string
    [key: string]: unknown
}

export interface BusinessType {
    id: number
    name: string
    [key: string]: unknown
}

export interface Currency {
    id: number
    code: string
    name: string
    symbol?: string
    [key: string]: unknown
}

export interface AppUser {
    id: number
    name?: string
    username: string
    email?: string
    first_name?: string
    last_name?: string
    role?: string
    [key: string]: unknown
}

// ─── Auth Action State ──────────────────────────────────────────

export interface AuthActionState {
    error?: {
        root?: string | string[]
        username?: string | string[]
        email?: string | string[]
        password?: string | string[]
        role_id?: string | string[]
        [key: string]: unknown
    }
    success?: boolean
    message?: string
    challenge_id?: string
    two_factor_required?: boolean
    _username?: string
    _slug?: string
    [key: string]: unknown
}

// ─── Standard Server Action Result ──────────────────────────────

/** Standard result type for mutation server actions (create/update/delete) */
export interface ActionResult<T = Record<string, unknown>> {
    success: boolean
    message?: string
    error?: string
    result?: T
}
