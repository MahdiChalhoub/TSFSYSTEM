'use client';

import { useActionState, useState } from 'react';
import { createSite, updateSite } from '@/app/actions/sites';
import { MapPin, X, Building2, Phone, FileText } from 'lucide-react';

export default function SiteModal({
    site,
    onClose
}: {
    site?: any,
    onClose: () => void
}) {
    const [state, action, isPending] = useActionState(
        site ? updateSite.bind(null, site.id) : createSite,
        { message: '' }
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-500 border border-gray-100">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 leading-tight">
                                {site ? 'Edit Site' : 'New Branch'}
                            </h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Entity Configuration</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all text-gray-400 hover:text-gray-900 shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <form action={async (fd) => {
                    await action(fd);
                    onClose();
                }} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Site / Branch Name</label>
                            <input
                                name="name"
                                defaultValue={site?.name}
                                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800 placeholder:text-gray-300"
                                placeholder="e.g., Beirut Downtown Branch"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Branch Code</label>
                            <input
                                name="code"
                                defaultValue={site?.code}
                                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800 placeholder:text-gray-300"
                                placeholder="BEY-01"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">VAT / Tax ID</label>
                            <div className="relative">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    name="vatNumber"
                                    defaultValue={site?.vatNumber}
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800"
                                    placeholder="1234567-8"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Logistics & Contact</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    name="address"
                                    defaultValue={site?.address}
                                    placeholder="Physical Street Address"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800"
                                />
                            </div>
                            <input
                                name="city"
                                defaultValue={site?.city}
                                placeholder="City"
                                className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800"
                            />
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    name="phone"
                                    defaultValue={site?.phone}
                                    placeholder="Contact Phone"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${site?.isActive !== false ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                            <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Active for Operations</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="isActive" defaultChecked={site?.isActive !== false} className="sr-only peer" />
                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                        </label>
                    </div>

                    <div className="pt-6 border-t border-gray-50 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl font-black text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all text-sm uppercase tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all text-sm uppercase tracking-widest disabled:opacity-50"
                        >
                            {isPending ? 'Propagating...' : (site ? 'Update Site' : 'Establish Site')}
                        </button>
                    </div>

                    {state.message && state.message !== 'success' && (
                        <div className="p-4 bg-red-50 rounded-2xl text-center text-red-500 text-xs font-black uppercase tracking-tighter">
                            {state.message}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}