export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VERIFY' | 'POST' | 'REVERSE';

export interface AuditLogParams {
    userId: number;
    action: AuditAction;
    entity: string;
    entityId: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    organizationId: string;
}

/**
 * Logs an action to the AuditLog table.
 * Audit logging is handled by Django Middleware — this is a no-op stub.
 */
export async function logAuditAction(
    _params: AuditLogParams,
): Promise<void> {
    // Audit logging is handled by Django Middleware.
    // This function exists for interface compatibility only.
}

/**
 * Captures changes between two objects and logs each changed field.
 * Audit logging is handled by Django Middleware — this is a no-op stub.
 */
export async function logEntityUpdate(
    _userId: number,
    _entity: string,
    _entityId: string,
    _oldData: Record<string, unknown>,
    _newData: Record<string, unknown>,
    _organizationId: string,
): Promise<void> {
    // No-op — handled by Django Middleware
}
