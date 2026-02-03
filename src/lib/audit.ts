// import { prisma } from "./db";
// import { Prisma } from "../generated/client";

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
 * Can be used within an existing transaction.
 */
export async function logAuditAction(
    params: AuditLogParams,
    tx?: any // was Prisma.TransactionClient
) {
    // Audit logging is being migrated to Django Middleware.
    // Client-side calls are ignored for now.
    // console.log("Audit Action:", params); 
}

/**
 * Captures changes between two objects and logs each changed field.
 */
export async function logEntityUpdate(
    userId: number,
    entity: string,
    entityId: string,
    oldData: any,
    newData: any,
    organizationId: string,
    tx?: any // was Prisma.TransactionClient
) {
    // No-op
}
