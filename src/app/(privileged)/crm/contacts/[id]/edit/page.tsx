/** Edit Contact Page */
import { erpFetch } from '@/lib/erp-api';
import { notFound } from 'next/navigation';
import ContactFormPage from '../../new/form-page';

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
        const data = await erpFetch('finance/counterparty-tax-profiles/');
        return Array.isArray(data) ? data : (data?.results || []);
    } catch {
        return [];
    }
}

async function getContactTags() {
    try {
        const data = await erpFetch('crm/contact-tags/');
        return Array.isArray(data) ? data : (data?.results || []);
    } catch {
        return [];
    }
}

async function getContact(id: string) {
    try {
        const data = await erpFetch(`crm/contacts/${id}/`);
        return data;
    } catch {
        return null;
    }
}

export default async function EditContactPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const [sites, deliveryZones, taxProfiles, contactTags, contact] = await Promise.all([
        getSites(),
        getDeliveryZones(),
        getTaxProfiles(),
        getContactTags(),
        getContact(id),
    ]);

    if (!contact) {
        notFound();
    }

    return (
        <ContactFormPage
            sites={sites}
            deliveryZones={deliveryZones}
            taxProfiles={taxProfiles}
            contactTags={contactTags}
            type={contact.type}
            contact={contact}
        />
    );
}

