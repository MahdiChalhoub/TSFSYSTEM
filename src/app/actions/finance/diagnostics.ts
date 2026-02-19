'use server'

/**
 * Financial Diagnostics — NOT YET IMPLEMENTED
 * These functions are stubs pending Django backend implementation.
 * They return explicit not-implemented status to prevent silent fake success.
 */

export async function diagnoseFinancialDiscrepancy() {
    return {
        success: false,
        message: 'Financial diagnostics engine is not yet implemented. This feature is being developed.',
        issues: []
    }
}

export async function healLedgerResidues() {
    return {
        success: false,
        message: 'Ledger healing is not yet implemented. This feature is being developed.'
    }
}