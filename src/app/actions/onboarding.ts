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

export async function registerBusinessAction(prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    const payload = {
        business_name: rawData.business_name,
        slug: rawData.slug,
        business_type_id: parseInt(rawData.business_type_id as string),
        currency_id: parseInt(rawData.currency_id as string),
        email: rawData.email,
        phone: rawData.phone,
        address: rawData.address,
        city: rawData.city,
        country: rawData.country,
        // Super Admin
        admin_first_name: rawData.admin_first_name,
        admin_last_name: rawData.admin_last_name,
        admin_username: rawData.admin_username,
        admin_email: rawData.admin_email,
        admin_password: rawData.admin_password
    };

    try {
        // erpFetch handles headers and base URL
        // For registration, we likely don't need tenant context, or we are creating it.
        // erpFetch tries to resolve tenant context from subdomain. Use it safe.

        // NOTE: erpFetch expects 'api/' prefix is added by it if we pass 'auth/...'.
        // erpFetch: `${DJANGO_URL}/api/${path...}`

        const data = await erpFetch('auth/register/business/', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (data.error) {
            return { error: data };
        }

        return { success: true, login_url: data.login_url };

    } catch (error: any) {
        // erpFetch throws on error
        try {
            const errData = JSON.parse(error.message);
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
