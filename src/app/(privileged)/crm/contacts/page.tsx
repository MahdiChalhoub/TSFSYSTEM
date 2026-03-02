/** Master Data Center - Contacts Logic */
import { erpFetch } from '@/lib/erp-api';
import ContactManager from './manager';
import Link from 'next/link';
import { Users, Building2, TrendingUp, ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react';

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
        return data.map((c: Record<string, any>) => ({
            ...c,
            homeSite: c.home_site,
            linkedAccount: c.linked_account,
            supplierCategory: c.supplier_category,
            customerTier: c.customer_tier,
            companyName: c.company_name,
            paymentTermsDays: c.payment_terms_days,
            loyaltyPoints: c.loyalty_points,
        }));
    } catch { return []; }
}

async function getSites() {
    try { return await erpFetch('sites/'); } catch { return []; }
}

export default async function ContactsPage() {
    const [contacts, sites, deliveryZones] = await Promise.all([
        getContacts(),
        getSites(),
        getDeliveryZones(),
    ]);

    const customers = contacts.filter((c: Record<string, any>) => c.type === 'CUSTOMER').length;
    const suppliers = contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER').length;
    const leads = contacts.filter((c: Record<string, any>) => c.type === 'LEAD').length;

    const kpis = [
        { label: 'Active Clients', value: customers, icon: Users, accent: 'var(--app-primary)' },
        { label: 'Suppliers', value: suppliers, icon: Building2, accent: 'var(--app-info)' },
        { label: 'Total Leads', value: leads, icon: TrendingUp, accent: 'var(--app-warning)' },
    ];

    const features = [
        {
            icon: Building2,
            title: 'Site Attribution',
            desc: "Distinguish between a contact's Home Site and their Transaction Site.",
        },
        {
            icon: CreditCard,
            title: 'Ledger Precision',
            desc: 'Every contact has a direct 1:1 link to the General Ledger with live balances.',
        },
        {
            icon: ShieldCheck,
            title: 'Trusted Data',
            desc: 'Contact information stays consistent across all modules.',
        },
    ];

    return (
        <div
            className="min-h-screen p-5 md:p-6 space-y-5 max-w-7xl mx-auto"
            style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font)' }}
        >
            {/* ── Header ──────────────────────────────────── */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 fade-in-up">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
                    >
                        <Users size={26} color="#fff" />
                    </div>
                    <div>
                        <h1
                            className="text-3xl font-black tracking-tight"
                            style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font-display)' }}
                        >
                            Contact <span style={{ color: 'var(--app-primary)' }}>Center</span>
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                            Unified Client & Supplier Registry
                        </p>
                    </div>
                </div>
                <Link
                    href="/crm"
                    className="flex items-center gap-1.5 px-4 h-9 rounded-xl font-bold text-sm transition-all"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        color: 'var(--app-text-muted)',
                        boxShadow: 'var(--app-shadow-sm)',
                    }}
                >
                    <ArrowLeft size={14} /> Back
                </Link>
            </header>

            {/* ── KPI Row ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 fade-in-up" style={{ animationDelay: '60ms' }}>
                {kpis.map((kpi, i) => (
                    <div key={i} className="app-kpi-card">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: kpi.accent + '22', boxShadow: `0 4px 12px ${kpi.accent}33` }}
                            >
                                <kpi.icon size={20} style={{ color: kpi.accent }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                    {kpi.label}
                                </p>
                                <p className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                    {kpi.value}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Feature Grid ────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 fade-in-up" style={{ animationDelay: '100ms' }}>
                {features.map((f, i) => (
                    <div
                        key={i}
                        className="app-card app-card-hover p-4 transition-all duration-300"
                    >
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                            style={{ background: 'var(--app-primary-light)' }}
                        >
                            <f.icon size={18} style={{ color: 'var(--app-primary)' }} />
                        </div>
                        <h4
                            className="text-sm font-black uppercase tracking-tight mb-1.5"
                            style={{ color: 'var(--app-text)' }}
                        >
                            {f.title}
                        </h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                            {f.desc}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Contact Manager ─────────────────────────── */}
            <ContactManager
                contacts={contacts}
                sites={sites}
                deliveryZones={deliveryZones}
            />
        </div>
    );
}