/** Master Data Center - Contacts Logic */
import { prisma } from "@/lib/db";
import ContactManager from "./manager";
import { Users, ShieldCheck, CreditCard, Building2 } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
    const contacts = await prisma.contact.findMany({
        include: {
            homeSite: { select: { name: true, code: true } },
            linkedAccount: { select: { code: true } }
        },
        orderBy: { name: 'asc' }
    });

    const sites = await prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true }
    });

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-8 lg:p-12">
            <div className="max-w-[1600px] mx-auto space-y-12">
                {/* Enterprise Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <Users size={20} />
                            </div>
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em]">Master Entity Management</span>
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-gray-900 tracking-tighter leading-none">
                            Contact <span className="text-indigo-600">Center</span>
                        </h1>
                        <p className="mt-6 text-gray-500 font-medium max-w-2xl text-lg leading-relaxed">
                            A unified registry for all Clients and Suppliers. Every contact is cryptographically linked to a
                            <span className="text-indigo-600 font-bold ml-1">unique sub-ledger account</span> for precision accounting and multi-site attribution.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 bg-white p-8 rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-gray-50">
                        <div className="text-center px-6 border-r border-gray-100 last:border-0">
                            <div className="text-4xl font-black text-gray-900 tracking-tighter mb-1">{contacts.filter(c => c.type === 'CUSTOMER').length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Clients</div>
                        </div>
                        <div className="text-center px-6 border-r border-gray-100 last:border-0">
                            <div className="text-4xl font-black text-gray-900 tracking-tighter mb-1">{contacts.filter(c => c.type === 'SUPPLIER').length}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suppliers</div>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-600 rounded-[50px] p-10 lg:p-16 relative overflow-hidden shadow-2xl shadow-indigo-200">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                                <Building2 size={24} />
                            </div>
                            <h4 className="text-xl font-black text-white">Site Attribution</h4>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                                Distinguish between a contact's <b>Home Site</b> (registration) and their <b>Transaction Site</b> (activity) for perfect multi-branch analytics.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                                <CreditCard size={24} />
                            </div>
                            <h4 className="text-xl font-black text-white">Ledger Precision</h4>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed">
                                Every contact has a direct 1:1 link to the General Ledger. Balances are calculated live from validated journal entries.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
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
                    contacts={serializeDecimals(contacts)}
                    sites={serializeDecimals(sites)}
                />
            </div>
        </div>
    );
}
