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

export async function createContact(prevState: any, formData: FormData) {
    try {
        const data = {
            name: formData.get('name'),
            type: formData.get('type') || 'CUSTOMER',
            email: formData.get('email') || '',
            phone: formData.get('phone') || '',
            home_site_id: formData.get('homeSiteId') || null,
        };
        await erpFetch('contacts/', { method: 'POST', body: JSON.stringify(data) });
        return { success: true, message: 'Contact created successfully' };
    } catch (e: any) {
        return { success: false, message: e.message || 'Failed to create contact' };
    }
}

export async function createEmployee(prevState: any, formData: FormData) {
    try {
        const data = {
            first_name: formData.get('firstName'),
            last_name: formData.get('lastName'),
            email: formData.get('email') || '',
            employee_id: formData.get('employeeId'),
            home_site_id: formData.get('homeSiteId') || null,
            job_title: formData.get('jobTitle') || '',
            create_login: formData.get('createLogin') === 'on',
            role_id: formData.get('roleId') || null,
        };
        await erpFetch('employees/', { method: 'POST', body: JSON.stringify(data) });
        return { success: true, message: 'Employee created successfully' };
    } catch (e: any) {
        return { success: false, message: e.message || 'Failed to create employee' };
    }
}

/**
 * Set or clear a user's scope password (Official or Internal).
 * Admin-only. Pass pin=null to clear.
 */
export async function setScopePassword(userId: string, scope: 'official' | 'internal', pin: string | null) {
    try {
        const result = await erpFetch(`users/${userId}/set-scope-pin/`, {
            method: 'POST',
            body: JSON.stringify({ scope, pin }),
        });
        return { success: true, message: result.message || `${scope} password ${pin ? 'set' : 'cleared'}` };
    } catch (e: any) {
        return { success: false, message: e.message || 'Failed to update scope password' };
    }
}

/**
 * Auto-create and link a GL ledger account for an employee.
 * Creates a payroll liability sub-account (EMPLOYEE) or capital sub-account (PARTNER).
 */
export async function linkGLAccount(employeeId: string, employeeType?: 'EMPLOYEE' | 'PARTNER' | 'BOTH') {
    try {
        const body: Record<string, string> = {};
        if (employeeType) body.employee_type = employeeType;

        const result = await erpFetch(`employees/${employeeId}/link-gl-account/`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return {
            success: true,
            message: result.message,
            linkedAccount: {
                id: result.linked_account_id,
                code: result.linked_account_code,
                name: result.linked_account_name
            }
        };
    } catch (e: any) {
        return { success: false, message: e.message || 'Failed to link GL account' };
    }
}
