/** CRM Contact Center — Redesigned V3 */
import { erpFetch } from '@/lib/erp-api';
import ContactManager from './manager';
import {
    Users, Building2, TrendingUp, Phone,
    Star, Activity
} from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getDeliveryZones() {
    try {
        const data = await erpFetch('pos/delivery-zones/');
        return Array.isArray(data) ? data : (data?.results || []);
    } catch { return []; }
}

async function getContacts() {
    try {
        const data = await erpFetch('contacts/');
        const list = Array.isArray(data) ? data : (data?.results || []);
        return list.map((c: Record<string, any>) => ({
            ...c,
            homeSite: c.home_site,
            linkedAccount: c.linked_account,
            supplierCategory: c.supplier_category,
            customerTier: c.customer_tier,
            companyName: c.company_name,
            paymentTermsDays: c.payment_terms_days,
            loyaltyPoints: c.loyalty_points,
            tagNames: c.tag_names || [],
        }));
    } catch { return []; }
}

async function getSites() {
    try {
        const data = await erpFetch('sites/');
        return Array.isArray(data) ? data : (data?.results || []);
    } catch { return []; }
}

async function getTaxProfiles() {
    try {
        const data = await erpFetch('finance/counterparty-tax-profiles/');
        return Array.isArray(data) ? data : (data?.results || []);
    } catch { return []; }
}

async function getContactTags() {
    try {
        const data = await erpFetch('crm/contact-tags/');
        return Array.isArray(data) ? data : (data?.results || []);
    } catch { return []; }
}

export default async function ContactsPage() {
    const [contacts, sites, deliveryZones, taxProfiles, contactTags] = await Promise.all([
        getContacts(), getSites(), getDeliveryZones(), getTaxProfiles(), getContactTags(),
    ]);

    const totalActive = contacts.filter((c: Record<string, any>) => c.is_active !== false).length;
    const customers = contacts.filter((c: Record<string, any>) => c.type === 'CUSTOMER' || c.type === 'BOTH');
    const suppliers = contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER' || c.type === 'BOTH');
    const bothCount = contacts.filter((c: Record<string, any>) => c.type === 'BOTH').length;
    const addressBook = contacts.filter((c: Record<string, any>) => c.type === 'CONTACT' || c.type === 'SERVICE').length;
    const interacted = contacts.filter((c: Record<string, any>) => Number(c.total_orders || 0) + Number(c.supplier_total_orders || 0) > 0).length;
    const vipCount = customers.filter((c: Record<string, any>) => c.customer_tier === 'VIP').length;

    const kpis = [
        { label: 'Total Contacts', value: totalActive, icon: Users, accent: 'var(--app-primary)', sub: `${contacts.length} total` },
        { label: 'Customers', value: customers.length, icon: TrendingUp, accent: 'var(--app-info)', sub: `${bothCount} mixed` },
        { label: 'Suppliers', value: suppliers.length, icon: Building2, accent: 'var(--app-warning)', sub: `${bothCount} mixed` },
        { label: 'Interacted', value: interacted, icon: Activity, accent: 'var(--app-success)', sub: 'have orders' },
        { label: 'Address Book', value: addressBook, icon: Phone, accent: '#8B5CF6', sub: 'personal' },
        { label: 'VIP Clients', value: vipCount, icon: Star, accent: '#EAB308', sub: 'premium tier' },
    ];

    return (
        <div className="app-page" style={{ padding: 'clamp(0.5rem, 2vw, 1.25rem)' }}>
            {/* ── Header ────────────────────────────── */}
            <header
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 fade-in-up"
                style={{ marginBottom: 'clamp(0.75rem, 2vw, 1.25rem)' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="app-icon-badge"
                        style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--app-radius-sm)' }}
                    >
                        <Users size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="theme-heading" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.5rem)' }}>
                            Contact <span style={{ color: 'var(--app-primary)' }}>Center</span>
                        </h1>
                        <p className="theme-text-sm" style={{ marginTop: '0.0625rem' }}>
                            {totalActive} active contacts • {contactTags.length} categories
                        </p>
                    </div>
                </div>
            </header>

            {/* ── KPI Strip ─────────────────────────── */}
            <div
                className="grid gap-2 fade-in-up"
                style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    marginBottom: 'clamp(0.75rem, 2vw, 1rem)',
                    animationDelay: '40ms',
                }}
            >
                {kpis.map((kpi, i) => (
                    <div
                        key={i}
                        className="app-card"
                        style={{ padding: '0.625rem 0.75rem', overflow: 'hidden', position: 'relative' }}
                    >
                        <div
                            style={{
                                position: 'absolute', top: 0, right: 0, width: '3rem', height: '3rem',
                                background: kpi.accent, opacity: 0.06, borderRadius: '0 0 0 100%',
                            }}
                        />
                        <div className="flex items-center gap-2.5">
                            <div
                                style={{
                                    width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem',
                                    background: kpi.accent + '18', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexShrink: 0,
                                }}
                            >
                                <kpi.icon size={13} style={{ color: kpi.accent }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p className="theme-metric-label" style={{ fontSize: '0.5625rem', lineHeight: 1, marginBottom: '0.125rem' }}>
                                    {kpi.label}
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                    <span
                                        style={{
                                            fontSize: 'clamp(1rem, 1.5vw, 1.25rem)', fontWeight: 800,
                                            color: 'var(--app-text)', letterSpacing: '-0.02em', lineHeight: 1,
                                        }}
                                    >
                                        {kpi.value}
                                    </span>
                                    <span className="theme-text-xs" style={{ fontSize: '0.5625rem', opacity: 0.6 }}>
                                        {kpi.sub}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Contact Manager ─────────────────── */}
            <div className="fade-in-up" style={{ animationDelay: '80ms' }}>
                <ContactManager
                    contacts={contacts}
                    sites={sites}
                    deliveryZones={deliveryZones}
                    taxProfiles={taxProfiles}
                    contactTags={contactTags}
                />
            </div>
        </div>
    );
}