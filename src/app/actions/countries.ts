'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type CountryState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
    };
};

export async function createCountry(prevState: CountryState, formData: FormData): Promise<CountryState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    try {
        await erpFetch('countries/', {
            method: 'POST',
            body: JSON.stringify({ name, code: code.toUpperCase() }),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/inventory/countries');
        return { message: 'success' };
    } catch (e: any) {
        console.error(e);
        return { message: e.message || 'Database Error: Failed to create country.' };
    }
}

export async function updateCountry(id: number, prevState: CountryState, formData: FormData): Promise<CountryState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    try {
        await erpFetch(`countries/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ name, code: code.toUpperCase() }),
            headers: { 'Content-Type': 'application/json' }
        });
        revalidatePath('/admin/inventory/countries');
        return { message: 'success' };
    } catch (e: any) {
        console.error(e);
        return { message: e.message || 'Failed to update country' };
    }
}

export async function getCountryHierarchy(countryId: number) {
    try {
        return await erpFetch(`countries/${countryId}/hierarchy/`);
    } catch (e) {
        console.error("Failed to fetch country hierarchy:", e);
        return [];
    }
}
