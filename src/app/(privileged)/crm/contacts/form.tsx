'use client';

import { useActionState, useState } from 'react';
import { createContact } from '@/app/actions/people';
import { User, X, Briefcase, Phone, Mail, MapPin, Building2, CreditCard, Globe, FileText, Clock, Tag } from 'lucide-react';

export default function ContactModal({
    sites,
    type = 'CUSTOMER',
    onClose
}: {
    sites: Record<string, any>[],
    type?: string,
    onClose: () => void
}) {
    const [state, action, isPending] = useActionState(
        createContact as (prevState: Record<string, any>, formData: FormData) => Promise<{ success: boolean; message: string }>,
        { success: false, message: '' }
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-500 border border-app-border max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-app-surface/50 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${type === 'CUSTOMER' ? 'bg-blue-600 shadow-blue-200' : 'bg-amber-600 shadow-amber-200'} text-white`}>
                            {type === 'CUSTOMER' ? <User size={24} /> : <Briefcase size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-app-foreground leading-tight">
                                Establish {type === 'CUSTOMER' ? 'Client' : 'Supplier'}
                            </h2>
                            <p className="text-xs text-app-muted-foreground font-bold uppercase tracking-widest">Master Data Initialization</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-app-surface rounded-2xl transition-all text-app-muted-foreground hover:text-app-foreground shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <form action={action} className="p-8 space-y-6">
                    <input type="hidden" name="type" value={type} />

                    <div className="grid grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Entity / Individual Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                <input
                                    name="name"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground"
                                    placeholder="Full Name or Company"
                                    required
                                />
                            </div>
                        </div>

                        {/* Company Name */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Company Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                <input
                                    name="companyName"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground"
                                    placeholder="Company / Organization"
                                />
                            </div>
                        </div>

                        {/* Home Site */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Home / Origin Site</label>
                            <div className="relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                <select
                                    name="homeSiteId"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground appearance-none"
                                    required
                                >
                                    <option value="">Select Home Site...</option>
                                    {sites.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Supplier Category — only for suppliers */}
                        {type === 'SUPPLIER' && (
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Supplier Category</label>
                                <div className="relative">
                                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                    <select
                                        name="supplierCategory"
                                        className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-amber-100 outline-none transition-all font-bold text-app-foreground appearance-none"
                                    >
                                        <option value="REGULAR">Regular Supplier</option>
                                        <option value="DEPOT_VENTE">Depot Vente (Consignment)</option>
                                        <option value="MIXED">Mixed</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Customer Tier — only for customers */}
                        {type === 'CUSTOMER' && (
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Client Tier</label>
                                <div className="relative">
                                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                    <select
                                        name="customerTier"
                                        className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-app-foreground appearance-none"
                                    >
                                        <option value="STANDARD">Standard</option>
                                        <option value="VIP">VIP</option>
                                        <option value="WHOLESALE">Wholesale</option>
                                        <option value="RETAIL">Retail</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Work Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                <input
                                    name="email"
                                    type="email"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground"
                                    placeholder="contact@example.com"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Primary Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                <input
                                    name="phone"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground"
                                    placeholder="+225 XX XXX XXX"
                                />
                            </div>
                        </div>

                        {/* Payment Terms */}
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Payment Terms (Days)</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                <input
                                    name="paymentTermsDays"
                                    type="number"
                                    min="0"
                                    defaultValue="0"
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground"
                                    placeholder="0 = Immediate"
                                />
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="col-span-2">
                            <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Notes</label>
                            <div className="relative">
                                <FileText className="absolute left-4 top-4 text-app-faint" size={18} />
                                <textarea
                                    name="notes"
                                    rows={2}
                                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground resize-none"
                                    placeholder="Internal notes about this contact..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-indigo-50/50 rounded-[32px] border-2 border-dashed border-indigo-100/50">
                        <div className="flex items-center gap-3 mb-4">
                            <CreditCard size={18} className="text-indigo-600" />
                            <span className="text-sm font-black text-indigo-900 uppercase tracking-widest">Autonomous Ledger Automation</span>
                        </div>
                        <p className="text-xs text-indigo-600/70 font-medium leading-relaxed">
                            Establishing this contact will automatically propagate a sub-account in the General Ledger.
                            All transactions (Invoices, Receipts, Payables) will be accurately linked for real-time balance sheet maturity.
                        </p>
                    </div>

                    {state?.message && !state.success && (
                        <div className="p-4 bg-rose-50 rounded-2xl text-rose-600 text-sm font-bold">
                            {state.message}
                        </div>
                    )}

                    <div className="pt-6 border-t border-gray-50 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl font-black text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-surface transition-all text-sm uppercase tracking-widest"
                        >
                            Abort
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className={`flex-[2] text-white px-6 py-4 rounded-2xl font-black shadow-xl transition-all text-sm uppercase tracking-widest disabled:opacity-50 ${type === 'CUSTOMER' ? 'bg-blue-600 shadow-blue-200 hover:bg-blue-700' : 'bg-amber-600 shadow-amber-200 hover:bg-amber-700'} hover:-translate-y-1 active:translate-y-0`}
                        >
                            {isPending ? 'Establishing Sub-Ledger...' : `Establish ${type}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}