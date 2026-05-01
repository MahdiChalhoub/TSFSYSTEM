/** Master Data Center - Contacts Logic */
import { erpFetch } from "@/lib/erp-api";
import ContactManager from "./manager";
import Link from "next/link";
import { Users, Building2, TrendingUp, ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic';

interface ContactRow {
    id: number;
    name?: string;
    type?: string;
    home_site?: unknown;
    linked_account?: unknown;
    supplier_category?: unknown;
    customer_tier?: unknown;
    company_name?: unknown;
    payment_terms_days?: unknown;
    loyalty_points?: unknown;
    homeSite?: unknown;
    linkedAccount?: unknown;
    supplierCategory?: unknown;
    customerTier?: unknown;
    companyName?: unknown;
    paymentTermsDays?: unknown;
    loyaltyPoints?: unknown;
    [key: string]: unknown;
}

interface SiteRow {
    id: number;
    name?: string;
    [key: string]: unknown;
}

interface ListResponse<T> {
    results?: T[];
}

function asArr<T>(d: unknown): T[] {
    if (Array.isArray(d)) return d as T[];
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as ListResponse<T>).results;
        return Array.isArray(r) ? r : [];
    }
    return [];
}

async function getDeliveryZones(): Promise<unknown[]> {
    try {
        return asArr<unknown>(await erpFetch('pos/delivery-zones/'));
    } catch { return []; }
}
async function getContacts(): Promise<ContactRow[]> {
    try {
        const list = asArr<ContactRow>(await erpFetch('crm/contacts/'));
        return list.map((c) => ({
            ...c,
            homeSite: c.home_site,
            linkedAccount: c.linked_account,
            supplierCategory: c.supplier_category,
            customerTier: c.customer_tier,
            companyName: c.company_name,
            paymentTermsDays: c.payment_terms_days,
            loyaltyPoints: c.loyalty_points,
        }));
    } catch {
        return [];
    }
}
async function getSites(): Promise<SiteRow[]> {
    try {
        return asArr<SiteRow>(await erpFetch('erp/sites/'));
    } catch {
        return [];
    }
}
export default async function ContactsPage() {
    const [contacts, sites] = await Promise.all([
        getContacts(),
        getSites(),
        getDeliveryZones()
    ]);
    return (
        <div className="page-container">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="page-header-title flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary text-app-foreground">
                            <Users size={20} />
                        </div>
                        Contact <span className="text-app-primary">Center</span>
                    </h1>
                    <p className="page-header-subtitle mt-1">Unified Client & Supplier Registry</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/crm">
                        <Button variant="outline" className="rounded-xl h-9 px-4 gap-1.5 border-app-border hover:bg-app-background transition-all shadow-sm text-xs">
                            <ArrowLeft size={16} /> Back
                        </Button>
                    </Link>
                </div>
            </header>
            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="card-kpi bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-app-success/30">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-app-surface flex items-center justify-center shadow-sm">
                            <Users size={18} className="text-app-primary" />
                        </div>
                        <div>
                            <p className="label-micro text-app-primary mb-0.5">Active Clients</p>
                            <p className="value-medium">{contacts.filter((c) => c.type === 'CUSTOMER').length}</p>
                        </div>
                    </div>
                </div>
                <div className="card-kpi bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-app-surface flex items-center justify-center shadow-sm">
                            <Building2 size={18} className="text-app-muted-foreground" />
                        </div>
                        <div>
                            <p className="label-micro text-app-muted-foreground mb-0.5">Suppliers</p>
                            <p className="value-medium">{contacts.filter((c) => c.type === 'SUPPLIER').length}</p>
                        </div>
                    </div>
                </div>
                <div className="card-kpi bg-gradient-to-br from-slate-900 to-slate-800 text-app-foreground border-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-app-foreground/10 flex items-center justify-center shadow-sm backdrop-blur-sm">
                            <TrendingUp size={18} className="text-app-success" />
                        </div>
                        <div>
                            <p className="label-micro text-app-muted-foreground mb-0.5">Total Leads</p>
                            <p className="text-xl font-black text-app-foreground tracking-tighter">{contacts.filter((c) => c.type === 'LEAD').length}</p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Feature Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="group p-4 bg-app-surface rounded-2xl border border-app-border hover:border-app-primary/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-app-primary/5 flex items-center justify-center text-app-primary mb-3 group-hover:scale-110 transition-transform">
                        <Building2 size={20} />
                    </div>
                    <h4 className="text-sm font-black text-app-foreground uppercase tracking-tight mb-1.5">Site Attribution</h4>
                    <p className="text-app-muted-foreground text-[11px] font-medium leading-relaxed">
                        Distinguish between a contact's <b>Home Site</b> and their <b>Transaction Site</b>.
                    </p>
                </div>
                <div className="group p-4 bg-app-surface rounded-2xl border border-app-border hover:border-app-primary/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-app-primary/5 flex items-center justify-center text-app-primary mb-3 group-hover:scale-110 transition-transform">
                        <CreditCard size={20} />
                    </div>
                    <h4 className="text-sm font-black text-app-foreground uppercase tracking-tight mb-1.5">Ledger Precision</h4>
                    <p className="text-app-muted-foreground text-[11px] font-medium leading-relaxed">
                        Every contact has a direct 1:1 link to the General Ledger with live balances.
                    </p>
                </div>
                <div className="group p-4 bg-app-surface rounded-2xl border border-app-border hover:border-app-primary/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-app-primary/5 flex items-center justify-center text-app-primary mb-3 group-hover:scale-110 transition-transform">
                        <ShieldCheck size={20} />
                    </div>
                    <h4 className="text-sm font-black text-app-foreground uppercase tracking-tight mb-1.5">Trusted Data</h4>
                    <p className="text-app-muted-foreground text-[11px] font-medium leading-relaxed">
                        Contact information stays consistent across all modules.
                    </p>
                </div>
            </div>
            <ContactManager
                contacts={contacts}
                sites={sites}
            />
        </div>
    );
}