/**
 * Migration v2.0 TypeScript Type Definitions
 * ===========================================
 * Type definitions for the new migration system following TSFSYSTEM architecture.
 */

// ─── Migration Job ──────────────────────────────────────────────

export interface MigrationV2Job {
    id: number
    name: string
    target_organization: string  // UUID
    target_organization_name?: string
    coa_template_used?: string | null
    posting_rules_snapshot?: Record<string, any> | null
    account_type_mappings: Record<string, any>

    status: 'DRAFT' | 'VALIDATING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED'
    current_step?: string | null
    current_step_detail?: string | null
    progress_percent: number

    // Statistics
    total_units: number
    total_categories: number
    total_brands: number
    total_products: number
    total_contacts: number
    total_sales: number
    total_purchases: number
    total_payments: number
    total_stock_records: number

    imported_units: number
    imported_categories: number
    imported_brands: number
    imported_products: number
    imported_customers: number
    imported_suppliers: number
    imported_sales: number
    imported_purchases: number
    imported_payments: number
    imported_stock_records: number

    total_verified: number
    total_flagged: number

    errors: any[]
    warnings: any[]

    started_at?: string | null
    completed_at?: string | null

    source_file_id?: string | null  // UUID
    source_file_name?: string

    created_at?: string
    updated_at?: string
    created_by?: string
}

// ─── Validation Result ──────────────────────────────────────────

export interface ValidationError {
    code: string
    message: string
    action_url?: string
    severity: 'ERROR' | 'WARNING'
}

export interface ValidationResult {
    id?: number
    job_id: number
    is_valid: boolean
    errors: ValidationError[]
    warnings: ValidationError[]
    coa_summary?: {
        total_accounts: number
        account_types: Record<string, number>
        has_customer_root: boolean
        has_supplier_root: boolean
        customer_root_code?: string
        supplier_root_code?: string
    } | null
    posting_rules_summary?: {
        total_rules: number
        configured_rules: string[]
        missing_rules: string[]
        automation: Record<string, any>
        sales: Record<string, any>
        purchases: Record<string, any>
    } | null
    validated_at?: string
}

// ─── Migration Mapping ──────────────────────────────────────────

export type EntityType =
    | 'UNIT'
    | 'CATEGORY'
    | 'BRAND'
    | 'PRODUCT'
    | 'PRODUCT_VARIANT'
    | 'CONTACT_CUSTOMER'
    | 'CONTACT_SUPPLIER'
    | 'COA_ACCOUNT'
    | 'TRANSACTION_SALE'
    | 'TRANSACTION_PURCHASE'
    | 'PAYMENT'
    | 'JOURNAL_ENTRY'
    | 'STOCK_RECORD';

export type VerifyStatus = 'PENDING' | 'VERIFIED' | 'FLAGGED';

export interface MigrationMapping {
    id: number
    job_id: number
    entity_type: EntityType
    source_id: number
    target_id: number
    source_data?: Record<string, any>
    verify_status: VerifyStatus
    verify_notes?: string | null
    verified_at?: string | null
    verified_by?: string | null
    created_at: string
}

// ─── Organizations ──────────────────────────────────────────────

export interface Organization {
    id: string  // UUID
    name: string
    business_name?: string
    slug?: string
    is_active: boolean
    settings?: Record<string, any>
    created_at?: string
}

// ─── Chart of Accounts (for validation) ────────────────────────

export interface COAAccount {
    id: number
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
    sub_type?: string
    parent_id?: number | null
    is_system_only: boolean
    balance: number
}

// ─── Posting Rules (for validation) ────────────────────────────

export interface PostingRules {
    automation?: {
        customerRoot?: number
        supplierRoot?: number
        employeeRoot?: number
    }
    sales?: {
        receivable?: number
        revenue?: number
        cogs?: number
        inventory?: number
        discount?: number
        tax?: number
    }
    purchases?: {
        payable?: number
        inventory?: number
        cogs?: number
        tax?: number
        discount?: number
    }
    payments?: {
        cashAccount?: number
        bankAccount?: number
    }
}

// ─── Wizard Steps ───────────────────────────────────────────────

export type WizardStep =
    | 'SELECT_SOURCE'
    | 'SELECT_ORG'
    | 'VALIDATE'
    | 'UPLOAD'
    | 'MASTER_DATA'
    | 'ENTITIES'
    | 'TRANSACTIONS'
    | 'STOCK'
    | 'VERIFICATION'
    | 'COMPLETE';

export interface WizardStepConfig {
    step: WizardStep
    label: string
    description: string
    icon: string
    isCompleted: boolean
    isCurrent: boolean
    isDisabled: boolean
}

// ─── API Responses ──────────────────────────────────────────────

export interface APIResponse<T = any> {
    status: 'success' | 'error'
    data?: T
    message?: string
    code?: string
    errors?: ValidationError[]
}

export interface PaginatedResponse<T = any> {
    count: number
    next?: string | null
    previous?: string | null
    results: T[]
}

// ─── Progress Updates ───────────────────────────────────────────

export interface ProgressUpdate {
    step: string
    detail: string
    progress: number
    timestamp: string
}

// ─── File Upload ────────────────────────────────────────────────

export interface StoredFile {
    uuid: string
    original_filename: string
    filename: string
    file_size: number
    content_type: string
    category: string
    uploaded_at: string
    created_at: string
}

// ─── Request Payloads ───────────────────────────────────────────

export interface CreateJobRequest {
    name: string
    target_organization_id: string
    coa_template?: string
}

export interface LinkFileRequest {
    file_uuid: string
    name: string
}

export interface ExecuteStepRequest {
    step: 'MASTER_DATA' | 'ENTITIES' | 'TRANSACTIONS' | 'STOCK'
    params?: Record<string, any>
}

export interface VerifyEntitiesRequest {
    entity_type?: EntityType
    entity_ids?: number[]
    verify_all?: boolean
}
