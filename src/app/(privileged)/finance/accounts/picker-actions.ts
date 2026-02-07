'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getChartOfAccountsList() {
    try {
        return await erpFetch('coa/?is_active=true');
    } catch (e) {
        console.error("Failed to fetch COA list:", e);
        return [];
    }
}

export async function getUsersList() {
    try {
        return await erpFetch('users/?is_active=true');
    } catch (e) {
        console.error("Failed to fetch users list:", e);
        return [];
    }
}