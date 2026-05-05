/** Master Data Center - Contacts Logic */
import { erpFetch } from "@/lib/erp-api";
import ContactManager from "./manager";
import { Users, ShieldCheck, CreditCard, Building2 } from "lucide-react";

export const dynamic = 'force-dynamic';

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
    const [contacts, sites] = await Promise.all([
        getContacts(),
        getSites()
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="max-w-[1600px] mx-auto space-y-12">
                {/* Enterprise Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-app-info flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <Users size={20} />
                            </div>
                            <span className="text-xs font-black text-app-info uppercase tracking-[0.3em]">Master Entity Management</span>
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-app-foreground tracking-tighter leading-none">
                            Contact <span className="text-app-info">Center</span>
                        </h1>
                        <p className="mt-6 text-app-muted-foreground font-medium max-w-2xl text-lg leading-relaxed">
                            A unified registry for all Clients and Suppliers. Every contact is cryptographically linked to a
                            <span className="text-app-info font-bold ml-1">unique sub-ledger account</span> for precision accounting and multi-site attribution.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 bg-app-surface p-8 rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-app-border">
                        <div className="text-center px-6 border-r border-app-border last:border-0">
                            <div className="text-4xl font-black text-app-foreground tracking-tighter mb-1">{contacts.filter((c: Record<string, any>) => c.type === 'CUSTOMER').length}</div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Active Clients</div>
                        </div>
                        <div className="text-center px-6 border-r border-app-border last:border-0">
                            <div className="text-4xl font-black text-app-foreground tracking-tighter mb-1">{contacts.filter((c: Record<string, any>) => c.type === 'SUPPLIER').length}</div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Suppliers</div>
                        </div>
                        <div className="text-center px-6 border-r border-app-border last:border-0">
                            <div className="text-4xl font-black text-app-foreground tracking-tighter mb-1">{contacts.filter((c: Record<string, any>) => c.type === 'LEAD').length}</div>
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Leads</div>
                        </div>
                    </div>
                </div>

                <div className="bg-app-info rounded-[50px] p-10 lg:p-16 relative overflow-hidden shadow-2xl shadow-indigo-200">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-app-surface opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-app-foreground opacity-5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-app-surface/10 flex items-center justify-center text-white">
                                <Building2 size={24} />
                            </div>
                            <h4 className="text-xl font-black text-white">Site Attribution</h4>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                                Distinguish between a contact's <b>Home Site</b> (registration) and their <b>Transaction Site</b> (activity) for perfect multi-branch analytics.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-app-surface/10 flex items-center justify-center text-white">
                                <CreditCard size={24} />
                            </div>
                            <h4 className="text-xl font-black text-white">Ledger Precision</h4>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                                Every contact has a direct 1:1 link to the General Ledger. Balances are calculated live from validated journal entries.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-app-surface/10 flex items-center justify-center text-white">
                                <ShieldCheck size={24} />
                            </div>
                            <h4 className="text-xl font-black text-white">Safe Transitions</h4>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                                Automated sub-ledger generation prevents manual accounting errors when establishing new business relationships.
                            </p>
                        </div>
                    </div>
                </div>

                <ContactManager
                    contacts={contacts}
                    sites={sites}
                />
            </div>
        </div>
    );
}