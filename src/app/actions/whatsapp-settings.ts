'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type WhatsappProvider = 'TWILIO' | 'MESSAGEBIRD' | 'META' | '';

export type WhatsappConfig = {
 is_active: boolean;
 provider: WhatsappProvider;
 account_sid?: string;
 auth_token?: string;
 from_number?: string;
 api_key?: string;
 channel_id?: string;
 access_token?: string;
 phone_number_id?: string;
};

const DEFAULT_CONFIG: WhatsappConfig = {
 is_active: false,
 provider: ''
};

export async function getWhatsappConfig(): Promise<WhatsappConfig> {
 try {
 const config = await erpFetch('settings/item/whatsapp_integration/');
 if (typeof config === 'object' && config !== null) {
 return { ...DEFAULT_CONFIG, ...config };
 }
 return DEFAULT_CONFIG;
 } catch (e) {
 console.error("Failed to fetch whatsapp config:", e);
 return DEFAULT_CONFIG;
 }
}

export async function saveWhatsappConfig(config: WhatsappConfig) {
 try {
 await erpFetch('settings/item/whatsapp_integration/', {
 method: 'POST',
 body: JSON.stringify(config),
 headers: { 'Content-Type': 'application/json' }
 });

 revalidatePath('/settings');
 revalidatePath('/settings/whatsapp');

 return { success: true };
 } catch (e: unknown) {
 console.error("Failed to save whatsapp config:", e);
 return { success: false, message: (e instanceof Error ? e.message : String(e)) };
 }
}
