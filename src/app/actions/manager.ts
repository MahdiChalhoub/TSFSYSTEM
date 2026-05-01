'use server'

import { revalidatePath } from "next/cache";
import { erpFetch, handleAuthError } from "@/lib/erp-api";

export async function fetchPendingUsers() {
    try {
        return await erpFetch('manager/approvals/pending/');
    } catch (e) {
        handleAuthError(e)
        console.error("Fetch pending failed", e);
        return [];
    }
}

export async function approveUserAction(userId: number) {
    try {
        await erpFetch(`manager/approvals/${userId}/approve/`, {
            method: 'POST'
        });
        revalidatePath('/users/approvals');
        return { success: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to approve" };
    }
}

export async function rejectUserAction(userId: number) {
    try {
        await erpFetch(`manager/approvals/${userId}/reject/`, {
            method: 'POST'
        });
        revalidatePath('/users/approvals');
        return { success: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to reject" };
    }
}

export async function requestCorrectionAction(userId: number, notes: string) {
    try {
        await erpFetch(`manager/approvals/${userId}/correction/`, {
            method: 'POST',
            body: JSON.stringify({ notes }),
            headers: { 'Content-Type': 'application/json' }
        });
        revalidatePath('/users/approvals');
        return { success: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to request correction" };
    }
}
