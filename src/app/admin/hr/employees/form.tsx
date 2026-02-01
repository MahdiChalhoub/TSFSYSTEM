'use client';

import { useActionState, useState } from 'react';
import { createEmployee } from '@/app/actions/people';
import { User, X, Briefcase, Phone, Mail, Building2, CreditCard, ShieldCheck, Key, Users } from 'lucide-react';

export default function EmployeeModal({
    sites,
    roles,
    onClose
}: {
    sites: any[],
    roles: any[],
    onClose: () => void
}) {
    const [state, action, isPending] = useActionState(
        createEmployee,
        { success: false, message: '' }
    );

    const [createLogin, setCreateLogin] = useState(false);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-500 border border-gray-100">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-600 shadow-lg shadow-indigo-100 text-white">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 leading-tight">Master HR Enrollment</h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Employee & Payroll Identity</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-400 hover:text-gray-900">
                        <X size={20} />
                    </button>
                </div>

                <form action={async (fd) => {
                    const res = await action(fd);
                    if (res?.success) onClose();
                }} className="p-8 space-y-8">

                    {/* PERSONAL INFO */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <User size={18} className="text-indigo-600" />
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Personal Identification</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">First Name</label>
                                <input name="firstName" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Last Name</label>
                                <input name="lastName" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Work Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input name="email" type="email" className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Internal Reference (ID)</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input name="employeeId" className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800" placeholder="e.g. EMP-101" required />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ASSIGNMENT */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Building2 size={18} className="text-indigo-600" />
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Branch & Role Assignment</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Home Site (Base Branch)</label>
                                <select name="homeSiteId" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800 appearance-none" required>
                                    <option value="">Select Branch...</option>
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Designation / Job Title</label>
                                <input name="jobTitle" className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800" placeholder="e.g. Senior Cashier" />
                            </div>
                        </div>
                    </div>

                    {/* SYSTEM ACCESS */}
                    <div className="p-8 bg-gray-50 rounded-[40px] space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Key size={18} className="text-indigo-600" />
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">System Login Access</h3>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="createLogin" className="sr-only peer" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} />
                                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {createLogin && (
                            <div className="animate-in slide-in-from-top-4 duration-300 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Access Role & Security Level</label>
                                    <select name="roleId" className="w-full px-6 py-4 rounded-2xl bg-white border border-gray-100 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-800 appearance-none" required>
                                        <option value="">Select Access Role...</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name} - {r.description}</option>)}
                                    </select>
                                </div>
                                <p className="text-xs text-gray-400 font-medium bg-white p-4 rounded-2xl border border-gray-100 italic">
                                    Login will be created with username: <span className="text-indigo-600 font-bold">Email Address</span>.
                                    Temporary password will be generated automatically.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* FINANCIAL AUTOMATION MSG */}
                    <div className="p-6 bg-emerald-50 rounded-[32px] flex gap-4 items-start">
                        <CreditCard className="text-emerald-600 shrink-0 mt-1" size={20} />
                        <div>
                            <span className="text-sm font-black text-emerald-900 uppercase tracking-widest">Payroll Sub-Ledger Integration</span>
                            <p className="text-xs text-emerald-600/70 font-medium mt-1">
                                An automated liability account will be generated in the Chart of Accounts (2200-XXXX) to track accrued salaries, bonuses, and expenses for this employee.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-50 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-5 rounded-2xl font-black text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all text-xs uppercase tracking-[0.2em]">Abort</button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] bg-indigo-600 text-white px-6 py-5 rounded-[24px] font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all text-xs uppercase tracking-[0.2em] disabled:opacity-50"
                        >
                            {isPending ? 'Propagating Identity...' : 'Complete Master Setup'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
