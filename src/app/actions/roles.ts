'use server'

import { erpFetch } from '@/lib/erp-api';
import { revalidatePath } from 'next/cache';

export async function getRoles() {
 return erpFetch('roles/');
}

export async function getPermissions() {
 return erpFetch('permissions/');
}

export async function createRole(data: { name: string, description?: string, permissions?: number[] }) {
 const res = await erpFetch('roles/', {
 method: 'POST',
 body: JSON.stringify(data)
 });
 revalidatePath('/settings/roles');
 return res;
}

export async function updateRole(id: number, data: { name?: string, description?: string, permissions?: number[] }) {
 const res = await erpFetch(`roles/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(data)
 });
 revalidatePath('/settings/roles');
 return res;
}

export async function deleteRole(id: number) {
 const res = await erpFetch(`roles/${id}/`, {
 method: 'DELETE'
 });
 revalidatePath('/settings/roles');
 return res;
}
