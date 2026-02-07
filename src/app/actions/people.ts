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
