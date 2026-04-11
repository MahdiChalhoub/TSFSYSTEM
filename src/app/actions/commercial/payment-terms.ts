// @ts-nocheck
'use server';
import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export async function getPaymentTerms() {
    try {
        const data = await erpFetch('payment-terms/');
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch {
        return [];
    }
}

export async function createPaymentTerm(prevState: any, formData: FormData) {
    const body = {
        name: formData.get('name'),
        code: formData.get('code'),
        description: formData.get('description') || '',
        days: Number(formData.get('days') || 0),
        discount_percent: Number(formData.get('discount_percent') || 0),
        discount_days: Number(formData.get('discount_days') || 0),
        is_default: formData.get('is_default') === 'true',
        is_active: true,
        sort_order: Number(formData.get('sort_order') || 0),
    };

    try {
        await erpFetch('payment-terms/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (e: any) {
        return { message: e?.message || 'Failed to create payment term.' };
    }

    revalidatePath('/settings/payment-terms');
    return { message: '', success: true };
}

export async function updatePaymentTerm(id: number, data: Record<string, any>) {
    try {
        await erpFetch(`payment-terms/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        revalidatePath('/settings/payment-terms');
        return { success: true };
    } catch (e: any) {
        return { message: e?.message || 'Failed to update.' };
    }
}

export async function deletePaymentTerm(id: number) {
    try {
        await erpFetch(`payment-terms/${id}/`, { method: 'DELETE' });
        revalidatePath('/settings/payment-terms');
        return { success: true };
    } catch (e: any) {
        return { message: e?.message || 'Failed to delete.' };
    }
}

export async function seedDefaultPaymentTerms() {
    try {
        const result = await erpFetch('payment-terms/seed-defaults/', { method: 'POST' });
        revalidatePath('/settings/payment-terms');
        return result;
    } catch (e: any) {
        return { message: e?.message || 'Failed to seed defaults.' };
    }
}
