'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type ProductFormState = {
 errors?: {
 [key: string]: string[];
 };
 message?: string;
};

export async function createProduct(prevState: ProductFormState, formData: FormData) {
 // 1. Extract Core Data
 const rawData = {
 name: formData.get('name'),
 shortName: formData.get('shortName') || undefined,
 description: formData.get('description') || undefined,
 categoryId: formData.get('categoryId') || undefined,
 brandId: formData.get('brandId') || undefined,
 countryId: formData.get('countryId') || undefined,
 productType: formData.get('productType') || 'SINGLE',

 // Attributes & Packaging
 size: formData.get('size') || undefined,
 sizeUnitId: formData.get('sizeUnitId') || undefined,
 unitId: formData.get('unitId') || undefined,

 // Variations Data (JSON array string)
 variationsData: formData.get('variationsData') || '[]',

 // Pricing
 costPrice: formData.get('costPrice') || 0,
 basePrice: formData.get('basePrice') || 0,
 taxRate: formData.get('taxRate') || 0,
 isTaxIncluded: formData.get('isTaxIncluded') === 'on',

 // Rules
 minStockLevel: formData.get('minStockLevel') || 0,
 isExpiryTracked: formData.get('isExpiryTracked') === 'on',
 isForSale: formData.get('isForSale') === 'on',
 isForPurchasing: formData.get('isForPurchasing') === 'on',
 isSerialized: formData.get('isSerialized') === 'on',

 // Advanced Levels
 packagingLevels: formData.get('packagingLevels') || '[]',
 
 // Supplier
 supplierId: formData.get('supplierId') || undefined,
 supplierSku: formData.get('supplierSku') || undefined,
 supplierPrice: formData.get('supplierPrice') || undefined,
 supplierLeadTime: formData.get('supplierLeadTime') || undefined,
 };

 try {
 // Parse JSON fields securely
 let parsedVariations = [];
 try { parsedVariations = JSON.parse(rawData.variationsData as string); } catch(e){}
 
 let parsedPackaging = [];
 try { parsedPackaging = JSON.parse(rawData.packagingLevels as string); } catch(e){}

 const payload = {
 ...rawData,
 variations: parsedVariations,
 packagingLevels: parsedPackaging
 };

 // 3. Delegation to Django
 // NOTE: The endpoint needs to be able to handle this massive complex payload.
 // If 'products/create_complex/' doesn't exist yet, it will need to be built to accept this structure!
 const response = await erpFetch('inventory/products/create_complex/', {
 method: 'POST',
 body: JSON.stringify(payload),
 headers: { 'Content-Type': 'application/json' }
 });

 if (response.error) {
 return { message: response.error };
 }

 } catch (e: unknown) {
 console.error("Backend Create Error:", e);
 return { message: (e instanceof Error ? e.message : String(e)) || 'System Error: Failed to Create Product.' };
 }

 // 4. Revalidate & Redirect
 revalidatePath('/products');
 redirect('/products');
}
