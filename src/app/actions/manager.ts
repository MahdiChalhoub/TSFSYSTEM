'use server'

import { revalidatePath } from "next/cache";

const djangoUrl = process.env.DJANGO_URL || "http://localhost:8000";

async function getAuthHeader() {
    const { cookies } = await import('next/headers');
    const token = (await cookies()).get('auth_token')?.value;
    return token ? `Token ${token}` : '';
}

export async function fetchPendingUsers() {
    const token = await getAuthHeader();
    if (!token) return [];

    try {
        const headerStore = await import('next/headers');
        const headersList = await headerStore.headers();
        const host = headersList.get('host') || "localhost:8000";

        const res = await fetch(`${djangoUrl}/api/manager/approvals/pending/`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Host': host
            },
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error("Fetch pending error", res.status, await res.text());
            return [];
        }

        return await res.json();
    } catch (e) {
        console.error("Fetch pending failed", e);
        return [];
    }
}

export async function approveUserAction(userId: number) {
    const token = await getAuthHeader();
    if (!token) return { error: "Unauthorized" };

    try {
        const headerStore = await import('next/headers');
        const headersList = await headerStore.headers();
        const host = headersList.get('host') || "localhost:8000";

        const res = await fetch(`${djangoUrl}/api/manager/approvals/${userId}/approve/`, {
            method: 'POST',
            headers: { 'Authorization': token, 'Host': host }
        });

        if (!res.ok) return { error: "Failed to approve" };

        revalidatePath('/admin/users/approvals');
        return { success: true };
    } catch (e) {
        return { error: "Connection failed" };
    }
}

export async function rejectUserAction(userId: number) {
    const token = await getAuthHeader();
    if (!token) return { error: "Unauthorized" };

    try {
        const headerStore = await import('next/headers');
        const headersList = await headerStore.headers();
        const host = headersList.get('host') || "localhost:8000";

        const res = await fetch(`${djangoUrl}/api/manager/approvals/${userId}/reject/`, {
            method: 'POST',
            headers: { 'Authorization': token, 'Host': host }
        });

        if (!res.ok) return { error: "Failed to reject" };

        revalidatePath('/admin/users/approvals');
        return { success: true };
    } catch (e) {
        return { error: "Connection failed" };
    }
}
