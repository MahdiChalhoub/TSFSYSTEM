'use server';

import { erpFetch } from "@/lib/erp-api";

/**
 * Identity / RBAC Actions
 */
export async function getRoles() {
    try {
        return await erpFetch('roles/');
    } catch (e) {
        console.error("Failed to fetch roles:", e);
        return [];
    }
}
