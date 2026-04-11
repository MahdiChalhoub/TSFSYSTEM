/**
 * Migration v2.0 API Client
 * ==========================
 * Client-side API wrapper for migration v2 endpoints.
 * Uses fetch with proper authentication headers.
 */

import {
    MigrationV2Job,
    ValidationResult,
    MigrationMapping,
    Organization,
    CreateJobRequest,
    LinkFileRequest,
    ExecuteStepRequest,
    VerifyEntitiesRequest,
    APIResponse,
    PaginatedResponse,
    EntityType,
} from '@/types/migration-v2';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://saas.tsf.ci/api';
const MIGRATION_V2_BASE = `${API_BASE}/migration_v2`;

/**
 * Helper to get auth token from cookies/localStorage
 */
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    // Try localStorage first (common pattern in TSF)
    return localStorage.getItem('auth_token') || localStorage.getItem('access_token');
}

/**
 * Helper for fetch with auth headers
 */
async function authFetch(url: string, options: RequestInit = {}) {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({
            message: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.message || errorData.detail || 'API request failed');
    }

    return response.json();
}

// ─── Jobs ───────────────────────────────────────────────────────

export async function getMigrationJobs(): Promise<PaginatedResponse<MigrationV2Job>> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/`);
}

export async function getMigrationJob(jobId: number): Promise<MigrationV2Job> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/`);
}

export async function createMigrationJob(data: CreateJobRequest): Promise<MigrationV2Job> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/create-job/`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function linkMigrationFile(jobId: number, data: LinkFileRequest): Promise<MigrationV2Job> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/link-file/`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ─── Validation ─────────────────────────────────────────────────

export async function validateJob(jobId: number): Promise<ValidationResult> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/validate/`, {
        method: 'POST',
    });
}

export async function getValidationResult(jobId: number): Promise<ValidationResult> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/validation-result/`);
}

// ─── Execution ──────────────────────────────────────────────────

export async function executeStep(jobId: number, data: ExecuteStepRequest): Promise<MigrationV2Job> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/execute-step/`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function executeMasterData(jobId: number): Promise<MigrationV2Job> {
    return executeStep(jobId, { step: 'MASTER_DATA' });
}

export async function executeEntities(jobId: number): Promise<MigrationV2Job> {
    return executeStep(jobId, { step: 'ENTITIES' });
}

export async function executeTransactions(jobId: number): Promise<MigrationV2Job> {
    return executeStep(jobId, { step: 'TRANSACTIONS' });
}

export async function executeStock(jobId: number): Promise<MigrationV2Job> {
    return executeStep(jobId, { step: 'STOCK' });
}

// ─── Mappings ───────────────────────────────────────────────────

export async function getMappings(
    jobId: number,
    filters?: { entity_type?: EntityType; verify_status?: string }
): Promise<PaginatedResponse<MigrationMapping>> {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.verify_status) params.set('verify_status', filters.verify_status);

    const url = `${MIGRATION_V2_BASE}/jobs/${jobId}/mappings/${params.toString() ? '?' + params.toString() : ''}`;
    return authFetch(url);
}

// ─── Verification ───────────────────────────────────────────────

export async function verifyEntities(jobId: number, data: VerifyEntitiesRequest): Promise<APIResponse> {
    return authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/verify/`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ─── Organizations ──────────────────────────────────────────────

export async function getOrganizations(): Promise<Organization[]> {
    // Use saas/my-organizations/ like the rest of the app
    try {
        const response = await authFetch(`${API_BASE}/saas/my-organizations/`);
        return response.results || response || [];
    } catch (err) {
        console.error('Failed to load organizations:', err);
        // Fallback to empty array
        return [];
    }
}

export async function getOrganization(orgId: string): Promise<Organization> {
    return authFetch(`${API_BASE}/saas/organizations/${orgId}/`);
}

// ─── Chart of Accounts (for validation display) ────────────────

export async function getCOAAccounts(orgId: string): Promise<any[]> {
    const response = await authFetch(`${API_BASE}/finance/chart-of-accounts/?organization=${orgId}`);
    return response.results || response;
}

// ─── Posting Rules (for validation display) ────────────────────

export async function getPostingRules(orgId: string): Promise<any> {
    return authFetch(`${API_BASE}/finance/posting-rules/?organization=${orgId}`);
}

// ─── Real-time Progress (Polling Helper) ───────────────────────

export async function pollJobStatus(
    jobId: number,
    callback: (job: MigrationV2Job) => void,
    interval: number = 3000,
    stopCondition?: (job: MigrationV2Job) => boolean
): Promise<void> {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const job = await getMigrationJob(jobId);
                callback(job);

                if (stopCondition && stopCondition(job)) {
                    resolve();
                } else {
                    setTimeout(poll, interval);
                }
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}
