'use client';

import { useState } from 'react';
import { Search, Plus, User, Briefcase, Building2, CreditCard, ChevronRight, Phone, Mail, Filter, TrendingUp, TrendingDown } from "lucide-react";
import ContactModal from './form';
import clsx from 'clsx';

export default function ContactManager({
    contacts,
    sites
}: {
    contacts: any[],
    sites: any[]
}) {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
    const [siteFilter, setSiteFilter] = useState<string>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');

    const filtered = contacts.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'ALL' || c.type === typeFilter;
        const matchesSite = siteFilter === 'ALL' || c.homeSiteId?.toString() === siteFilter;
        return matchesSearch && matchesType && matchesSite;
    });

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Action Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-gray-50">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            className="w-full bg-gray-50 pl-14 pr-6 py-4 rounded-2xl border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300"
                            placeholder="Universal Master Data Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl w-full md:w-auto">
                        {['ALL', 'CUSTOMER', 'SUPPLIER'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t as any)}
                                className={clsx(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    typeFilter === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-64">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <select
                            className="w-full bg-gray-50 pl-12 pr-6 py-4 rounded-2xl border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-700 appearance-none"
                            value={siteFilter}
                            onChange={(e) => setSiteFilter(e.target.value)}
                        >
                            <option value="ALL">All Home Sites</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-4 w-full xl:w-auto border-t xl:border-t-0 pt-6 xl:pt-0">
                    <button
                        onClick={() => { setModalType('SUPPLIER'); setIsModalOpen(true); }}
                        className="flex-1 xl:flex-none px-6 py-4 bg-amber-50 text-amber-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-2 group"
                    >
                        <Briefcase size={18} className="group-hover:rotate-12 transition-transform" />
                        New Supplier
                    </button>
                    <button
                        onClick={() => { setModalType('CUSTOMER'); setIsModalOpen(true); }}
                        className="flex-1 xl:flex-none px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        Individual Client
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                {filtered.map((contact) => (
                    <div key={contact.id} className="group bg-white p-8 rounded-[48px] border border-gray-100 hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden flex flex-col sm:flex-row items-center gap-8">
                        {/* Decorative Background Account Code */}
                        <div className="absolute right-8 top-8 text-[40px] font-black text-gray-50 group-hover:text-indigo-50/30 transition-colors pointer-events-none">
                            {contact.linkedAccount?.code}
                        </div>

                        {/* Avatar / Icon */}
                        <div className={clsx(
                            "w-24 h-24 rounded-[32px] shrink-0 flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-500",
                            contact.type === 'CUSTOMER' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                        )}>
                            {contact.type === 'CUSTOMER' ? <User size={40} /> : <Briefcase size={40} />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center sm:text-left space-y-4">
                            <div>
                                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter",
                                        contact.type === 'CUSTOMER' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {contact.type}
                                    </span>
                                    {contact.homeSite && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                            <Building2 size={10} /> {contact.homeSite.name}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-[280px]">
                                    {contact.name}
                                </h3>
                            </div>

                            <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                                    <Mail size={14} className="text-indigo-500" />
                                    {contact.email || 'No Email'}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                                    <Phone size={14} className="text-indigo-500" />
                                    {contact.phone || 'No Phone'}
                                </div>
                            </div>
                        </div>

                        {/* Balance Card */}
                        <div className="w-full sm:w-48 bg-gray-50 group-hover:bg-white rounded-[32px] p-6 border border-transparent group-hover:border-gray-100 transition-all flex flex-col items-center justify-center translate-z-0">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Balance</div>
                            <div className={clsx(
                                "text-xl font-black flex items-center gap-1",
                                Number(contact.balance) > 0 ? "text-emerald-600" : Number(contact.balance) < 0 ? "text-rose-600" : "text-gray-400"
                            )}>
                                {Number(contact.balance) > 0 ? <TrendingUp size={16} /> : Number(contact.balance) < 0 ? <TrendingDown size={16} /> : null}
                                ${Math.abs(Number(contact.balance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <button className="mt-4 w-full py-2.5 rounded-xl bg-white border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm">
                                Full Statement
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <ContactModal
                    sites={sites}
                    type={modalType}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
}