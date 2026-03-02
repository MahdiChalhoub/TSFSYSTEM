'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getWarehouses() {
 return await erpFetch('warehouses/')
}

export type WarehouseState = {
 message?: string;
 errors?: {
 name?: string[];
 code?: string[];
 location_type?: string[];
 };
};

export async function createWarehouse(prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
 const data: Record<string, any> = {
 name: formData.get('name') as string,
 code: (formData.get('code') as string)?.toUpperCase() || undefined,
 location_type: formData.get('location_type') as string || 'WAREHOUSE',
 can_sell: formData.get('canSell') === 'on',
 is_active: formData.get('isActive') === 'on',
 address: formData.get('address') as string || '',
 city: formData.get('city') as string || '',
 phone: formData.get('phone') as string || '',
 vat_number: formData.get('vat_number') as string || '',
 }

 const parentId = formData.get('parent');
 if (parentId) data.parent = Number(parentId);

 if (!data.name || data.name.length < 2) {
 return { message: 'Validation Error', errors: { name: ['Name must be at least 2 characters'] } };
 }

 try {
 await erpFetch('warehouses/', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 })
 revalidatePath('/inventory/warehouses')
 return { message: 'success' }
 } catch (e: unknown) {
 return { message: 'Database Error: ' + (e instanceof Error ? e.message : String(e)) }
 }
}

export async function updateWarehouse(id: number, prevState: WarehouseState, formData: FormData): Promise<WarehouseState> {
 const data: Record<string, any> = {
 name: formData.get('name') as string,
 code: (formData.get('code') as string)?.toUpperCase() || undefined,
 location_type: formData.get('location_type') as string || 'WAREHOUSE',
 can_sell: formData.get('canSell') === 'on',
 is_active: formData.get('isActive') === 'on',
 address: formData.get('address') as string || '',
 city: formData.get('city') as string || '',
 phone: formData.get('phone') as string || '',
 vat_number: formData.get('vat_number') as string || '',
 }

 const parentId = formData.get('parent');
 if (parentId) data.parent = Number(parentId);
 else data.parent = null;

 try {
 await erpFetch(`warehouses/${id}/`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 })
 revalidatePath('/inventory/warehouses')
 return { message: 'success' }
 } catch (e: unknown) {
 return { message: 'Database Error: ' + (e instanceof Error ? e.message : String(e)) }
 }
}

export async function deleteWarehouse(id: number) {
 try {
 await erpFetch(`warehouses/${id}/`, {
 method: 'DELETE'
 })
 revalidatePath('/inventory/warehouses')
 return { success: true }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}