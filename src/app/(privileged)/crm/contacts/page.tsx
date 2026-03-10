/** Master Data Center - Contacts Logic */
import { erpFetch } from '@/lib/erp-api';
import ContactManager from './manager';
import Link from 'next/link';
import { Users, Building2, TrendingUp, ArrowLeft, Phone, UserPlus, Tag } from 'lucide-react';

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
        getContacts(),
        getSites(),
        getDeliveryZones(),
        getTaxProfiles(),
        getContactTags(),
    ]);

    const customers = contacts.filter((c: Record<string, any>) => c.type === 'CUSTOMER').length;
    const suppliers = contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER').length;
    const addressBook = contacts.filter((c: Record<string, any>) => c.type === 'CONTACT' || c.type === 'SERVICE').length;
    const totalActive = contacts.filter((c: Record<string, any>) => c.is_active !== false).length;

    const kpis = [
        { label: 'Active Contacts', value: totalActive, icon: Users, accent: 'var(--app-primary)' },
        { label: 'Customers', value: customers, icon: TrendingUp, accent: 'var(--app-info)' },
        { label: 'Suppliers', value: suppliers, icon: Building2, accent: 'var(--app-warning)' },
        { label: 'Address Book', value: addressBook, icon: Phone, accent: 'var(--app-success)' },
    ];

    return (
        <div
            className="app-page"
            style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}
        >
            {/* ── Header ──────────────────────────────────── */}
            <header className="app-page-header" style={{ marginBottom: '1rem' }}>
                <div className="flex items-center gap-3">
                    <div className="app-icon-badge" style={{ width: '2.75rem', height: '2.75rem', borderRadius: 'var(--app-radius-sm)' }}>
                        <Users size={20} color="#fff" />
                    </div>
                    <div>
                        <h1 className="theme-heading">
                            Contact <span style={{ color: 'var(--app-primary)' }}>Center</span>
                        </h1>
                        <p className="theme-text-muted" style={{ marginTop: '0.125rem' }}>
                            Unified Client, Supplier & Address Book Registry
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Link
                        href="/crm/contacts/new"
                        className="app-btn app-btn-primary"
                    >
                        <UserPlus size={14} /> New Contact
                    </Link>
                    <Link
                        href="/crm"
                        className="app-btn app-btn-ghost"
                    >
                        <ArrowLeft size={14} /> Back
                    </Link>
                </div>
            </header>

            {/* ── KPI Row ─────────────────────────────────── */}
            <div
                className="grid gap-3 fade-in-up"
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    marginBottom: '1rem',
                    animationDelay: '60ms',
                }}
            >
                {kpis.map((kpi, i) => (
                    <div key={i} className="app-kpi-card" style={{ padding: '0.875rem' }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex items-center justify-center shrink-0"
                                style={{
                                    width: '2.25rem', height: '2.25rem',
                                    borderRadius: 'var(--app-radius-sm)',
                                    background: kpi.accent + '22',
                                }}
                            >
                                <kpi.icon size={16} style={{ color: kpi.accent }} />
                            </div>
                            <div>
                                <p className="theme-metric-label">{kpi.label}</p>
                                <p className="theme-heading-sm" style={{ margin: 0 }}>{kpi.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Contact Manager ─────────────────────────── */}
            <ContactManager
                contacts={contacts}
                sites={sites}
                deliveryZones={deliveryZones}
                taxProfiles={taxProfiles}
                contactTags={contactTags}
            />
        </div>
    );
}