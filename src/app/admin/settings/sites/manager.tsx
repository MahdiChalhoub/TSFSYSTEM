'use client';

import { useState } from 'react';
import { Plus, Search, Building2, MapPin, Edit3, Trash2, Users, Warehouse } from "lucide-react";
import SiteModal from './form';
import { deleteSite } from '@/app/actions/sites';

export default function SiteManager({ sites }: { sites: any[] }) {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<any>(null);

    const filtered = sites.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code?.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this branch? All data must be moved first.')) return;
        const res = await deleteSite(id);
        if (!res.success) alert(res.message);
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="relative group max-w-xl w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={22} />
                    <input
                        className="w-full bg-white pl-16 pr-8 py-5 rounded-[32px] border-none shadow-2xl shadow-indigo-900/5 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 placeholder:font-black"
                        placeholder="Search branches, IDs, or locations..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => {
                        setEditingSite(null);
                        setIsModalOpen(true);
                    }}
                    className="w-full lg:w-auto bg-indigo-600 text-white px-10 py-5 rounded-[32px] font-black shadow-2xl shadow-indigo-200 hover:shadow-indigo-400/40 hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-3 group whitespace-nowrap"
                >
                    <Plus size={24} className="group-hover:rotate-90 transition-transform duration-500" />
                    <span className="uppercase tracking-widest text-sm">Add New Branch</span>
                </button>
            </div>

            {/* Sites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-32 text-center bg-white rounded-[60px] border-4 border-dashed border-gray-50">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
                            <Building2 size={48} />
                        </div>
                        <p className="text-gray-300 font-black uppercase tracking-[0.2em]">No branches detected</p>
                    </div>
                ) : (
                    filtered.map((site) => (
                        <div key={site.id} className="group bg-white border border-gray-100 rounded-[48px] p-8 hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.15)] transition-all relative overflow-hidden flex flex-col h-full">
                            {!site.isActive && (
                                <div className="absolute top-0 right-0 bg-red-50 text-red-500 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-bl-3xl">
                                    Disabled Site
                                </div>
                            )}

                            {/* Decorative Background Icon */}
                            <Building2 size={120} className="absolute -right-8 -bottom-8 text-gray-50 group-hover:text-indigo-50/50 transition-colors -rotate-12" />

                            <div className="flex justify-between items-start mb-10 relative z-10">
                                <div className="w-20 h-20 rounded-[28px] bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                    <Building2 size={36} />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEditingSite(site);
                                            setIsModalOpen(true);
                                        }}
                                        className="p-3 bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm"
                                        title="Edit Site"
                                    >
                                        <Edit3 size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(site.id)}
                                        className="p-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-2xl transition-all shadow-sm"
                                        title="Terminte Site"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-8 relative z-10 flex-1">
                                <div className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-2 font-mono">
                                    {site.code || `SITE-ID-${site.id.toString().padStart(3, '0')}`}
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-4 truncate group-hover:text-indigo-600 transition-colors">{site.name}</h3>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3 text-sm text-gray-500 font-bold bg-gray-50 p-3 rounded-2xl w-fit">
                                        <MapPin size={18} className="text-indigo-500" />
                                        <span>{site.city || 'No City'}, Lebanon</span>
                                    </div>
                                    <div className="flex items-center gap-6 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 px-1">
                                        <div className="flex items-center gap-2">
                                            <Warehouse size={14} className="text-indigo-300" />
                                            <span>{site._count?.warehouses || 0} Storage Zones</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-indigo-300" />
                                            <span>{site._count?.users || 0} Staff</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-gray-50 relative z-10">
                                <button className="w-full py-4 rounded-3xl bg-gray-50 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white hover:shadow-xl hover:shadow-indigo-200 transition-all">
                                    View Detailed Branch Report
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <SiteModal
                    site={editingSite}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
}
