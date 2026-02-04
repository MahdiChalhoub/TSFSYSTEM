'use server'

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { erpFetch } from "@/lib/erp-api";

export async function getPublicConfig() {
    try {
        const data = await erpFetch('auth/config/');
        return data || { business_types: [], currencies: [], tenant: {} };
    } catch (error) {
        console.error("Config fetch error:", error);
        return { business_types: [], currencies: [], tenant: {} };
    }
}

export async function getPublicPlans() {
    try {
        const data = await erpFetch('saas/plans/');
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Public plans fetch error:", error);
        return [];
    }
}

export async function registerBusinessAction(prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    // Build payload for Django (as FormData to support Logo)
    const djangoPayload = new FormData();
    djangoPayload.append('business_name', rawData.business_name as string);
    djangoPayload.append('slug', rawData.slug as string);
    djangoPayload.append('business_type_id', rawData.business_type_id as string);
    djangoPayload.append('currency_id', rawData.currency_id as string);
    djangoPayload.append('email', rawData.email as string);
    djangoPayload.append('phone', rawData.phone as string);
    djangoPayload.append('address', rawData.address as string);
    djangoPayload.append('city', rawData.city as string);
    djangoPayload.append('state', rawData.state as string);
    djangoPayload.append('zip_code', rawData.zip_code as string);
    djangoPayload.append('country', rawData.country as string);

    // Website Handling (Sanitization)
    if (rawData.website) {
        let url = (rawData.website as string).trim();
        if (url) {
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            djangoPayload.append('website', url);
        }
    }

    djangoPayload.append('timezone', 'UTC');

    // Logo File
    const logoFile = formData.get('logo');
    if (logoFile instanceof File && logoFile.size > 0) {
        djangoPayload.append('logo', logoFile);
    }

    // Super Admin
    djangoPayload.append('admin_first_name', rawData.admin_first_name as string);
    djangoPayload.append('admin_last_name', rawData.admin_last_name as string);
    djangoPayload.append('admin_username', rawData.admin_username as string);
    djangoPayload.append('admin_email', rawData.admin_email as string);
    djangoPayload.append('admin_password', rawData.admin_password as string);

    try {
        const data = await erpFetch('auth/register/business/', {
            method: "POST",
            // DO NOT set Content-Type header when sending FormData!
            body: djangoPayload
        });

        if (data.error) {
            // Normalize error structure
            if (typeof data.error === 'string') {
                return { error: { root: [data.error] } };
            }
            // If data.error is an object (e.g. { error: "msg" } or { detail: "msg" })
            if (typeof data.error === 'object') {
                if (data.error.detail) {
                    return { error: { root: [data.error.detail] } };
                }
                if (data.error.error) {
                    return { error: { root: [data.error.error] } };
                }
                // Otherwise it might be valiation fields
                return { error: data.error };
            }
            return { error: { root: ["Unknown registration error"] } };
        }

        return { success: true, login_url: data.login_url };

    } catch (error: any) {
        try {
            const errData = JSON.parse(error.message);
            // Check for generic DRF error structure
            if (errData.detail) {
                return { error: { root: [errData.detail] } };
            }
            if (errData.error) {
                // Convert { error: "msg" } to { root: ["msg"] }
                if (typeof errData.error === 'string') return { error: { root: [errData.error] } };
                return { error: errData.error };
            }
            return { error: errData };
        } catch (e) {
            return { error: { root: ["Connection failed or invalid response"] } };
        }
    }
}

export async function registerUserAction(prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    const payload = {
        first_name: rawData.first_name,
        last_name: rawData.last_name,
        email: rawData.email,
        username: rawData.username,
        password: rawData.password,
        role_id: parseInt(rawData.role_id as string),
        // Optional fields
        phone: rawData.phone,
        nationality: rawData.nationality,
        address: rawData.address,
        date_of_birth: rawData.date_of_birth || null
    };

    try {
        const data = await erpFetch('auth/register/user/', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (data.error) {
            return { error: data };
        }

        return { success: true, message: "Registration successful! Please wait for approval." };

    } catch (error: any) {
        console.error("User Register Error", error);
        try {
            const errData = JSON.parse(error.message);
            return { error: errData };
        } catch (e) {
            return { error: { root: ["Connection failed"] } };
        }
    }
}

export async function checkWorkspace(slug: string) {
    try {
        const data = await erpFetch(`tenant/resolve/?slug=${slug}`);
        if (data && data.id) {
            return { exists: true, data };
        }
        return { exists: false };
    } catch (error) {
        return { exists: false };
    }
}
