'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export interface UDLESavedView {
 id: string;
 model_name: string;
 name: string;
 config: {
 columns: string[];
 filters: Record<string, any>;
 sorting: { field: string, dir: 'asc' | 'desc' } | null;
 };
 is_default: boolean;
 created_at: string;
}

export async function getSavedViews(modelName: string) {
 return erpFetch(`/udle-views/?model_name=${modelName}`);
}

export async function createSavedView(data: Partial<UDLESavedView>) {
 const res = await erpFetch('/udle-views/', {
 method: 'POST',
 body: JSON.stringify(data),
 });
 return res;
}

export async function updateSavedView(id: string, data: Partial<UDLESavedView>) {
 const res = await erpFetch(`/udle-views/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data),
 });
 return res;
}

export async function deleteSavedView(id: string) {
 const res = await erpFetch(`/udle-views/${id}/`, {
 method: 'DELETE',
 });
 return res;
}
