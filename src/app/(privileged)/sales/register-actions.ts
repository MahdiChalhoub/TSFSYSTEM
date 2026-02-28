'use server';

import { erpFetch } from "@/lib/erp-api";

/**
 * Fetch the POS Lobby data: sites → registers → sessions
 */
export async function getPosLobby() {
    try {
        const data = await erpFetch('pos-registers/lobby/');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to load lobby' };
    }
}

/**
 * Verify a cashier PIN for a specific register
 */
export async function verifyPosPin(registerId: number, pin: string, userId?: number) {
    try {
        const data = await erpFetch('pos-registers/verify-pin/', {
            method: 'POST',
            body: JSON.stringify({ register_id: registerId, pin, ...(userId ? { user_id: userId } : {}) }),
        });
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Invalid PIN' };
    }
}

/**
 * Open a new register session (start shift).
 * Standard: { register_id, cashier_id, opening_balance, notes }
 * Advanced: { register_id, cashier_id, opening_mode: 'advanced', account_reconciliations, cash_counted, cash_software, address_book_balance, notes }
 */
export async function openRegisterSession(
    registerId: number,
    cashierId: number,
    openingBalance: number,
    notes?: string,
    advancedData?: {
        opening_mode: 'advanced';
        account_reconciliations: Array<{ account_id: number; software_amount: number; statement_amount: number }>;
        cash_counted: number;
        cash_software: number;
        address_book_balance: number;
    },
    forceClose?: boolean,
    overridePin?: string,
) {
    try {
        const body: any = {
            register_id: registerId,
            cashier_id: cashierId,
            notes: notes || '',
        };

        if (advancedData) {
            body.opening_mode = 'advanced';
            body.account_reconciliations = advancedData.account_reconciliations;
            body.cash_counted = advancedData.cash_counted;
            body.cash_software = advancedData.cash_software;
            body.address_book_balance = advancedData.address_book_balance;
        } else {
            body.opening_balance = openingBalance;
        }

        if (forceClose && overridePin) {
            body.force_close = true;
            body.override_pin = overridePin;
        }

        const data = await erpFetch('pos-registers/open-session/', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return { success: true, data };
    } catch (error: any) {
        // Preserve structured error data from backend
        return { success: false, error: error?.message || 'Failed to open session', data: error?.data };
    }
}


/**
 * Close a register session (end shift)
 */
export async function closeRegisterSession(sessionId: number, closingBalance: number, notes?: string) {
    try {
        const data = await erpFetch('pos-registers/close-session/', {
            method: 'POST',
            body: JSON.stringify({
                session_id: sessionId,
                closing_balance: closingBalance,
                notes: notes || '',
            }),
        });
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to close session' };
    }
}

/**
 * Set a POS PIN for a user
 */
export async function setPosPin(userId: number, pin: string) {
    try {
        const data = await erpFetch('pos-registers/set-pin/', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, pin }),
        });
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to set PIN' };
    }
}

/**
 * Get status of all open sessions
 */
export async function getRegisterStatus() {
    try {
        const data = await erpFetch('pos-registers/session-status/');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to get status' };
    }
}
