/** Create New Contact Page */
import { erpFetch } from '@/lib/erp-api';
import { notFound, redirect } from 'next/navigation';
import ContactFormPage from './form-page';

export const dynamic = 'force-dynamic';

async function getSites() {
  try {
    const data = await erpFetch('sites/');
    return Array.isArray(data) ? data : (data?.results || []);
  } catch {
    return [];
  }
}

async function getDeliveryZones() {
  try {
    const data = await erpFetch('pos/delivery-zones/');
    return Array.isArray(data) ? data : (data?.results || []);
  } catch {
    return [];
  }
}

async function getTaxProfiles() {
  try {
    const data = await erpFetch('finance/tax-profiles/');
    return Array.isArray(data) ? data : (data?.results || []);
  } catch {
    return [];
  }
}

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: { type?: string }
}) {
  const sites = await getSites();
  const deliveryZones = await getDeliveryZones();
  const taxProfiles = await getTaxProfiles();

  const contactType = searchParams.type?.toUpperCase() === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';

  return (
    <ContactFormPage
      sites={sites}
      deliveryZones={deliveryZones}
      taxProfiles={taxProfiles}
      type={contactType}
    />
  );
}
