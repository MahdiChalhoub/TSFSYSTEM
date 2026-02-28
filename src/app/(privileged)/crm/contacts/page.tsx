/** Master Data Center - Contacts Logic */
import { erpFetch } from "@/lib/erp-api";
import ContactManager from "./manager";
import Link from "next/link";
import { Users, ShieldCheck, CreditCard, Building2, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    } catch (e) {
        console.error("Failed to fetch contacts", e);
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
        <div className="p-2 md:p-4 space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Users size={20} className="text-white" />
                        </div>
                        Contact <span className="text-indigo-600">Center</span>
                    </h1>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Unified Client & Supplier Registry</p>
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
                <Card className="rounded-3xl border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50 overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <Users size={18} className="text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Active Clients</p>
                                <p className="text-xl font-black text-gray-900 tracking-tighter">{contacts.filter((c: Record<string, any>) => c.type === 'CUSTOMER').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-gradient-to-br from-gray-50 to-gray-100/50 overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <Building2 size={18} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Suppliers</p>
                                <p className="text-xl font-black text-gray-900 tracking-tighter">{contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-gradient-to-br from-indigo-900 to-indigo-800 text-white overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-sm backdrop-blur-sm">
                                <TrendingUp size={18} className="text-indigo-200" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Total Leads</p>
                                <p className="text-xl font-black text-white tracking-tighter">{contacts.filter((c: Record<string, any>) => c.type === 'LEAD').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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