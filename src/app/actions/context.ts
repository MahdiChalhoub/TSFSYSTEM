'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function setCurrentSite(siteId: number) {
 const cookieStore = await cookies();

 if (siteId === -1) {
 cookieStore.delete('tsf_current_site_id');
 } else {
 cookieStore.set('tsf_current_site_id', siteId.toString(), {
 httpOnly: true,
 secure: process.env.NODE_ENV === 'production',
 sameSite: 'lax',
 maxAge: 60 * 60 * 24 * 7 // 1 week
 });
 }

 revalidatePath('/', 'layout');
 return { success: true };
}

export async function getCurrentSiteId() {
 const cookieStore = await cookies();
 const siteId = cookieStore.get('tsf_current_site_id')?.value;
 return siteId ? parseInt(siteId) : null;
}
