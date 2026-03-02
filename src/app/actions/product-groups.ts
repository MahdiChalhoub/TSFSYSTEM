'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type VariantInput = {
 id?: number;
 countryId: number;
 sku: string;
 barcode?: string;
 size?: number;
 sizeUnitId?: number;
 costPrice: number;
 basePrice: number;
 minStockLevel?: number;

 costPriceHT?: number;
 costPriceTTC?: number;
 sellingPriceHT?: number;
 sellingPriceTTC?: number;
 taxRate?: number;
};

export type ProductGroupState = {
 message?: string;
 errors?: Record<string, string[]>;
};

export async function createProductGroupWithVariants(
 prevState: ProductGroupState,
 data: {
 name: string;
 brandId: number;
 categoryId?: number;
 description?: string;
 baseUnitId: number;
 variants: VariantInput[];
 }
) {
 try {
 // Transform camelCase frontend keys to snake_case backend keys
 const payload = {
 name: data.name,
 brand_id: data.brandId,
 category_id: data.categoryId,
 description: data.description,
 variants: data.variants.map(v => ({
 name: data.name, // Product inherits group name
 sku: v.sku,
 barcode: v.barcode,
 country_id: v.countryId,
 unit_id: data.baseUnitId,
 size: v.size,
 size_unit_id: v.sizeUnitId,
 costPrice: v.costPrice,
 sellingPriceHT: v.costPrice,
 sellingPriceTTC: v.basePrice,
 taxRate: v.taxRate || 0,
 }))
 };

 await erpFetch('product-groups/create_with_variants/', {
 method: 'POST',
 body: JSON.stringify(payload),
 headers: { 'Content-Type': 'application/json' }
 });

 revalidatePath('/products');
 return { message: 'success' };
 } catch (e: unknown) {
 console.error(e);
 return { message: (e instanceof Error ? e.message : String(e)) || 'Failed to create product group.' };
 }
}

export async function updateProductGroup(
 prevState: ProductGroupState,
 data: {
 groupId: number;
 name: string;
 brandId: number;
 categoryId?: number;
 description?: string;
 baseUnitId: number;
 variants: VariantInput[];
 }
) {
 const { groupId, brandId } = data;

 try {
 // Transform camelCase frontend keys to snake_case backend keys
 const payload = {
 name: data.name,
 brand_id: data.brandId,
 category_id: data.categoryId,
 description: data.description,
 variants: data.variants.map(v => ({
 id: v.id,
 name: data.name,
 sku: v.sku,
 barcode: v.barcode,
 country_id: v.countryId,
 unit_id: data.baseUnitId,
 size: v.size,
 size_unit_id: v.sizeUnitId,
 costPrice: v.costPrice,
 sellingPriceHT: v.costPrice,
 sellingPriceTTC: v.basePrice,
 taxRate: v.taxRate || 0,
 }))
 };

 await erpFetch(`product-groups/${groupId}/update_with_variants/`, {
 method: 'PUT',
 body: JSON.stringify(payload),
 headers: { 'Content-Type': 'application/json' }
 });

 revalidatePath('/products');
 revalidatePath(`/inventory/brands/${brandId}`);
 return { message: 'success' };
 } catch (e: unknown) {
 console.error(e);
 return { message: (e instanceof Error ? e.message : String(e)) || 'Failed to update product group.' };
 }
}

export async function linkProductsToGroup(productIds: number[], groupId: number) {
 try {
 await erpFetch(`product-groups/${groupId}/link_products/`, {
 method: 'POST',
 body: JSON.stringify({ productIds }),
 headers: { 'Content-Type': 'application/json' }
 });

 revalidatePath('/products');
 revalidatePath('/inventory/maintenance');
 return { success: true, message: 'Successfully linked products to group.' };
 } catch (e: unknown) {
 console.error(e);
 return { success: false, message: (e instanceof Error ? e.message : String(e)) || 'Failed to link products.' };
 }
}

export async function createGroupFromProducts(
 productIds: number[],
 data: { name: string, description?: string }
) {
 try {
 await erpFetch('product-groups/create_from_products/', {
 method: 'POST',
 body: JSON.stringify({ productIds, ...data }),
 headers: { 'Content-Type': 'application/json' }
 });

 revalidatePath('/products');
 revalidatePath('/inventory/maintenance');
 return { success: true, message: 'Successfully created group from products.' };
 } catch (e: unknown) {
 console.error(e);
 return { success: false, message: (e instanceof Error ? e.message : String(e)) || 'Failed to create group.' };
 }
}