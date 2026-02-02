import { prisma } from "./db";
import { Prisma } from "../generated/client";

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
    tx?: Prisma.TransactionClient
) {
    const client = tx || prisma;

    try {
        await (client as any).auditLog.create({
            data: {
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                field: params.field,
                oldValue: params.oldValue,
                newValue: params.newValue,
                userId: params.userId,
                organizationId: params.organizationId,
            }
        });
    } catch (error) {
        console.error("FAILED TO LOG AUDIT ACTION:", error);
        // We don't throw here to avoid failing the main transaction for a logging error
        // though in high-security systems you might WANT to throw.
    }
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
    tx?: Prisma.TransactionClient
) {
    const fields = Object.keys(newData);

    for (const field of fields) {
        const oldVal = oldData[field];
        const newVal = newData[field];

        // Basic comparison (works for strings, numbers, booleans)
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            await logAuditAction({
                userId,
                action: 'UPDATE',
                entity,
                entityId,
                field,
                oldValue: oldVal?.toString(),
                newValue: newVal?.toString(),
                organizationId
            }, tx);
        }
    }
}
