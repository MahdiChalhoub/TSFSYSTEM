/**
 * db.ts — LEGACY / DEPRECATED
 *
 * The TSF platform uses Django as the backend via erpFetch().
 * Prisma is NOT used for any runtime queries.
 *
 * This file is kept as a placeholder to prevent import errors
 * in case any old code still references it. The PrismaClient
 * is NOT initialized — all database access goes through Django.
 */

// Prisma is explicitly NOT initialized.
// If you see this file being imported, migrate the caller to use erpFetch() instead.
export const prisma = null as any