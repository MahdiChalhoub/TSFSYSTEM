'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * FRESH VERSION: Wipes all operational data but keeps core configuration
 * (Users, Roles, Sites, Fiscal Years, Chart of Accounts structure, Settings)
 */
export async function wipeAllOperationalData() {
    try {
        await erpFetch('accounting/journal-entries/clear_all/', {
            method: 'POST'
        });
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error("Wipe failed:", error);
        throw new Error("Failed to wipe operational data.");
    }
}

/**
 * SEED DATA: Fills the database with realistic test data
 */
export async function seedTestData() {
    // This logic must be moved to the Django Backend as a management command or API endpoint.
    // We cannot direct-write to the DB from Next.js anymore.
    throw new Error("Seeding via Frontend is deprecated. Please use Django Management Commands (e.g. python manage.py seed_test_data).");
}

