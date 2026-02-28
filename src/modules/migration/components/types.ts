export interface MigrationJob {
    id: number
    name: string
    source_type: string
    status: string
    progress: number
    current_step: string | null
    source_business_id: number | null
    source_business_name: string | null
    migration_mode: string
    total_units: number
    total_categories: number
    total_brands: number
    total_products: number
    total_contacts: number
    total_transactions: number
    total_accounts: number
    total_inventory: number
    total_errors: number
    last_heartbeat: string | null
    error_summary: Record<string, number> | null
    completed_steps: string[] | null
    error_log: string | null
    created_by_name: string
    started_at: string | null
    completed_at: string | null
    created_at: string
    mappings_summary?: Record<string, number>
}

export interface PreviewData {
    status?: string
    tables: Record<string, number>
}

export interface Business {
    id: number
    name: string
    currency_id?: number
    start_date?: string
    products?: number
    contacts?: number
    transactions?: number
    locations?: number
}

export type WizardStep = "LIST" | "SOURCE" | "UPLOAD" | "BUSINESSES" | "PREVIEW" | "RUNNING" | "RESULTS"

export interface PipelineStep {
    name: string
    label: string
    progress: number
    status: 'completed' | 'running' | 'pending'
}

export interface PipelineData {
    job_id: number
    job_status: string
    progress: number
    current_step: string | null
    current_step_detail: string | null
    completed_count: number
    total_steps: number
    can_resume: boolean
    pipeline: PipelineStep[]
}

export interface ReviewEntity {
    entity_type: string
    total: number
    draft: number
    good: number
    page_link: string | null
    filter_param: string | null
    group: string
    order: number
    samples: any[]
    can_approve: boolean
}

export interface ReviewData {
    job_id: number
    job_status: string
    total_mappings: number
    total_errors: number
    total_draft: number
    total_good: number
    error_log: string
    error_lines_preview: string[]
    entities: ReviewEntity[]
    needs_review_count: number
    groups: Record<string, string>
}

