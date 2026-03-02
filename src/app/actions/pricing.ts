'use server';

import { erpFetch } from '@/lib/erp-api';

// ── Price Groups ──────────────────────────────────────────────────────────────

export async function getPriceGroups() {
 try {
 return await erpFetch('price-groups/');
 } catch (e) {
 console.error("Failed to fetch price groups:", e);
 return [];
 }
}

export async function createPriceGroup(prevState: Record<string, any>, formData: FormData) {
 try {
 const data = {
 name: formData.get('name'),
 description: formData.get('description') || '',
 priority: parseInt(formData.get('priority') as string) || 0,
 valid_from: formData.get('validFrom') || null,
 valid_until: formData.get('validUntil') || null,
 };
 await erpFetch('price-groups/', { method: 'POST', body: JSON.stringify(data) });
 return { success: true, message: 'Price group created' };
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) || 'Failed to create price group' };
 }
}

export async function deletePriceGroup(id: number) {
 try {
 await erpFetch(`price-groups/${id}/`, { method: 'DELETE' });
 return { success: true };
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) || 'Failed to delete' };
 }
}

// ── Price Group Members ───────────────────────────────────────────────────────

export async function getGroupMembers(groupId: number) {
 try {
 return await erpFetch(`price-groups/${groupId}/members/`);
 } catch (e) {
 return [];
 }
}

export async function addGroupMember(groupId: number, contactId: number) {
 try {
 await erpFetch(`price-groups/${groupId}/members/`, {
 method: 'POST',
 body: JSON.stringify({ contact_id: contactId }),
 });
 return { success: true };
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) };
 }
}

export async function removeGroupMember(groupId: number, contactId: number) {
 try {
 await erpFetch(`price-groups/${groupId}/members/`, {
 method: 'DELETE',
 body: JSON.stringify({ contact_id: contactId }),
 });
 return { success: true };
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) };
 }
}

// ── Client Price Rules ────────────────────────────────────────────────────────

export async function getPriceRules() {
 try {
 return await erpFetch('price-rules/');
 } catch (e) {
 console.error("Failed to fetch price rules:", e);
 return [];
 }
}

export async function createPriceRule(prevState: Record<string, any>, formData: FormData) {
 try {
 const data: Record<string, any> = {
 discount_type: formData.get('discountType') || 'FIXED_PRICE',
 value: parseFloat(formData.get('value') as string) || 0,
 min_quantity: parseInt(formData.get('minQuantity') as string) || 1,
 is_active: true,
 notes: formData.get('notes') || '',
 valid_from: formData.get('validFrom') || null,
 valid_until: formData.get('validUntil') || null,
 };

 const contactId = formData.get('contactId');
 const groupId = formData.get('priceGroupId');
 const productId = formData.get('productId');
 const categoryId = formData.get('categoryId');

 if (contactId) data.contact_id = parseInt(contactId as string);
 if (groupId) data.price_group_id = parseInt(groupId as string);
 if (productId) data.product_id = parseInt(productId as string);
 if (categoryId) data.category_id = parseInt(categoryId as string);

 await erpFetch('price-rules/', { method: 'POST', body: JSON.stringify(data) });
 return { success: true, message: 'Price rule created' };
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) || 'Failed to create price rule' };
 }
}

export async function deletePriceRule(id: number) {
 try {
 await erpFetch(`price-rules/${id}/`, { method: 'DELETE' });
 return { success: true };
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) || 'Failed to delete' };
 }
}

export async function getRulesForContact(contactId: number) {
 try {
 return await erpFetch(`price-rules/for-contact/${contactId}/`);
 } catch (e) {
 return [];
 }
}
