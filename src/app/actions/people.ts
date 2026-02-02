'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

/**
 * Creates a Contact (Master Data).
 * Backend handles linked account creation.
 */
export async function createContact(prevState: any, formData: FormData) {
    const name = formData.get('name') as string;
    const type = formData.get('type') as string; // 'SUPPLIER' or 'CUSTOMER'
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const homeSiteId = formData.get('homeSiteId') ? parseInt(formData.get('homeSiteId') as string) : null;

    try {
        const contact = await erpFetch('contacts/', {
            method: 'POST',
            body: JSON.stringify({
                name,
                type,
                email,
                phone,
                home_site: homeSiteId
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/crm');
        return { success: true, contact };
    } catch (e: any) {
        console.error("Failed to create contact:", e);
        return { success: false, message: e.message };
    }
}

/**
 * Creates an Employee (HR Master Data).
 * Backend handles linked account creation.
 */
export async function createEmployee(prevState: any, formData: FormData) {
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const employeeId = formData.get('employeeId') as string;
    const jobTitle = formData.get('jobTitle') as string;
    const homeSiteId = formData.get('homeSiteId') ? parseInt(formData.get('homeSiteId') as string) : null;

    try {
        const employee = await erpFetch('employees/', {
            method: 'POST',
            body: JSON.stringify({
                employee_id: employeeId,
                first_name: firstName,
                last_name: lastName,
                email,
                job_title: jobTitle,
                home_site: homeSiteId
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/hr');
        return { success: true, employee };
    } catch (e: any) {
        console.error("Failed to create employee:", e);
        return { success: false, message: e.message };
    }
}

export async function getRoles() {
    try {
        return await erpFetch('roles/');
    } catch (e) {
        console.error("Failed to fetch roles:", e);
        return [];
    }
}
