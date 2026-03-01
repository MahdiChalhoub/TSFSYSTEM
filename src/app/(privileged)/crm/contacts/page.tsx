/** Master Data Center - Contacts Logic */
import { erpFetch } from "@/lib/erp-api";
import ContactManager from "./manager";
import Link from "next/link";
import { Users, Building2, TrendingUp, ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        // Map Django camelCase/snake_case if needed. 
        // Django DRF default is snake_case unless configured otherwise.
        // Assuming camelCase based on previous knowledge or needing mapping.
        // Serializer uses snake_case keys (home_site).
        // Frontend expects camelCase often (homeSite).
        // I will map it MANUALLY here or update Serializer to use camelCase (using djangorestframework-camel-case or manual).
        // Let's assume snake_case from backend and map to camelCase for frontend components if they expect it.
        // The previous code used Prisma which returns camelCase.
        // So I MUST mapping.
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
    } catch {
        return [];
    }
}
async function getSites() {
    try {
        return await erpFetch('sites/');
    } catch (e) {
        return [];
    }
}
export default async function ContactsPage() {
    const [contacts, sites, deliveryZones] = await Promise.all([
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
                        <div className="page-header-icon bg-emerald-600 text-white">
                            <Users size={20} />
                        </div>
                        Contact <span className="text-emerald-600">Center</span>
                    </h1>
                    <p className="page-header-subtitle mt-1">Unified Client & Supplier Registry</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/crm">
                        <Button variant="outline" className="rounded-xl h-9 px-4 gap-1.5 border-gray-200 hover:bg-gray-50 transition-all shadow-sm text-xs">
                            <ArrowLeft size={16} /> Back
                        </Button>
                    </Link>
                </div>
            </header>
            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="card-kpi bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            <Users size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="label-micro text-emerald-500 mb-0.5">Active Clients</p>
                            <p className="value-medium">{contacts.filter((c: Record<string, any>) => c.type === 'CUSTOMER').length}</p>
                        </div>
                    </div>
                </div>
                <div className="card-kpi bg-gradient-to-br from-slate-50 to-slate-100/50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                            <Building2 size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <p className="label-micro text-slate-400 mb-0.5">Suppliers</p>
                            <p className="value-medium">{contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER').length}</p>
                        </div>
                    </div>
                </div>
                <div className="card-kpi bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-sm backdrop-blur-sm">
                            <TrendingUp size={18} className="text-emerald-300" />
                        </div>
                        <div>
                            <p className="label-micro text-slate-300 mb-0.5">Total Leads</p>
                            <p className="text-xl font-black text-white tracking-tighter">{contacts.filter((c: Record<string, any>) => c.type === 'LEAD').length}</p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Feature Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="group p-4 bg-white rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                        <Building2 size={20} />
                    </div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1.5">Site Attribution</h4>
                    <p className="text-gray-500 text-[11px] font-medium leading-relaxed">
                        Distinguish between a contact's <b>Home Site</b> and their <b>Transaction Site</b>.
                    </p>
                </div>
                <div className="group p-4 bg-white rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                        <CreditCard size={20} />
                    </div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1.5">Ledger Precision</h4>
                    <p className="text-gray-500 text-[11px] font-medium leading-relaxed">
                        Every contact has a direct 1:1 link to the General Ledger with live balances.
                    </p>
                </div>
                <div className="group p-4 bg-white rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                        <ShieldCheck size={20} />
                    </div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1.5">Trusted Data</h4>
                    <p className="text-gray-500 text-[11px] font-medium leading-relaxed">
                        Autonomous verification ensures that contact identity remains consistent across all modules.
                    </p>
                </div>
            </div>
            <ContactManager
                contacts={contacts}
                sites={sites}
                deliveryZones={deliveryZones}
            />
        </div>
    );
}