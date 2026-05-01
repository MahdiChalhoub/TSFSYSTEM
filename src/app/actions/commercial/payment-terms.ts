'use server';
import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

interface PaymentTerm {
    id: number;
    name: string;
    code: string;
    description?: string;
    days: number;
    discount_percent: number;
    discount_days: number;
    is_default: boolean;
    is_active: boolean;
    sort_order: number;
    [key: string]: unknown;
}

interface PaymentTermsResponse {
    results?: PaymentTerm[];
}

interface ActionState {
    message?: string;
    success?: boolean;
}

interface SeedDefaultsResult {
    message?: string;
    terms?: PaymentTerm[];
    [key: string]: unknown;
}

function errorMessage(e: unknown, fallback: string): string {
    if (e instanceof Error) return e.message || fallback;
    if (typeof e === 'object' && e !== null && 'message' in e) {
        const msg = (e as { message?: unknown }).message;
        if (typeof msg === 'string') return msg || fallback;
    }
    return fallback;
}

export async function getPaymentTerms(): Promise<PaymentTerm[]> {
    try {
        const data = (await erpFetch('payment-terms/')) as PaymentTerm[] | PaymentTermsResponse;
        return Array.isArray(data) ? data : (data?.results ?? []);
    } catch {
        return [];
    }
}

export async function createPaymentTerm(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
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
    } catch (e: unknown) {
        return { message: errorMessage(e, 'Failed to create payment term.') };
    }

    revalidatePath('/settings/payment-terms');
    return { message: '', success: true };
}

export async function updatePaymentTerm(id: number, data: Record<string, unknown>): Promise<ActionState> {
    try {
        await erpFetch(`payment-terms/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        revalidatePath('/settings/payment-terms');
        return { success: true };
    } catch (e: unknown) {
        return { message: errorMessage(e, 'Failed to update.') };
    }
}

export async function deletePaymentTerm(id: number): Promise<ActionState> {
    try {
        await erpFetch(`payment-terms/${id}/`, { method: 'DELETE' });
        revalidatePath('/settings/payment-terms');
        return { success: true };
    } catch (e: unknown) {
        return { message: errorMessage(e, 'Failed to delete.') };
    }
}

export async function seedDefaultPaymentTerms(): Promise<SeedDefaultsResult> {
    try {
        const result = (await erpFetch('payment-terms/seed-defaults/', { method: 'POST' })) as SeedDefaultsResult;
        revalidatePath('/settings/payment-terms');
        return result ?? {};
    } catch (e: unknown) {
        return { message: errorMessage(e, 'Failed to seed defaults.') };
    }
}
