'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * Loads all data required for the POS Settings management console.
 */
export async function loadPOSSettingsData() {
    try {
        const [lobby, users, accounts, warehouses, globalSettings] = await Promise.all([
            erpFetch('pos-registers/lobby/'),
            erpFetch('erp/users/'),
            erpFetch('accounts/'),
            erpFetch('inventory/warehouses/'),
            erpFetch('pos-settings/').catch(() => ({}))
        ]);

        return {
            sites: lobby?.results || [],
            users: Array.isArray(users) ? users : users?.results || [],
            accounts: Array.isArray(accounts) ? accounts : accounts?.results || [],
            warehouses: Array.isArray(warehouses) ? warehouses : warehouses?.results || [],
            globalSettings: globalSettings || {}
        };
    } catch (error: any) {
        console.error('Failed to load POS settings data:', error);
        throw new Error(error.message || 'Data loading failed');
    }
}

/**
 * Updates a specific register configuration.
 */
export async function saveRegisterConfig(regId: number, data: any) {
    try {
        const result = await erpFetch('pos-registers/update-register/', {
            method: 'POST',
            body: JSON.stringify({ id: regId, ...data })
        });
        revalidatePath('/sales/pos-settings');
        return result;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to update register');
    }
}

/**
 * Patches global system-wide POS rules.
 */
export async function saveGlobalPOSSettings(data: any) {
    try {
        const result = await erpFetch('pos-settings/', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        revalidatePath('/sales/pos-settings');
        return result;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to save global settings');
    }
}

/**
 * Resets a user's POS PIN with admin authorization or self-confirmation.
 */
export async function resetPOSUserPIN(params: { 
    target_user_id: number; 
    new_pin: string; 
    admin_password?: string;
    current_password?: string;
    mode: 'self' | 'admin' 
}) {
    try {
        const endpoint = params.mode === 'self' 
            ? 'pos-registers/change-own-pin/' 
            : 'pos-registers/admin-reset-pin/';
            
        const body = params.mode === 'self' 
            ? { current_password: params.current_password, new_pin: params.new_pin }
            : { admin_password: params.admin_password, target_user_id: params.target_user_id, new_pin: params.new_pin };

        const result = await erpFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        
        revalidatePath('/sales/pos-settings');
        return result;
    } catch (error: any) {
        throw new Error(error.message || 'PIN update failed');
    }
}
