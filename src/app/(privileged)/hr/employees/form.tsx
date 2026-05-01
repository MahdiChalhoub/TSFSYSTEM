'use client';

import { useActionState, useEffect, useState } from 'react';
import { createEmployee } from '@/app/actions/people';
import { User, X, Mail, Briefcase, Building2, CreditCard, Key, Users } from 'lucide-react';

interface SiteOption {
    id: number;
    name?: string;
    [key: string]: unknown;
}

interface RoleOption {
    id: number;
    name?: string;
    description?: string;
    [key: string]: unknown;
}

export default function EmployeeModal({
    sites,
    roles,
    onClose
}: {
    sites: SiteOption[],
    roles: RoleOption[],
    onClose: () => void
}) {
    const [state, action, isPending] = useActionState(
        createEmployee,
        { success: false, message: '' }
    );

    const [createLogin, setCreateLogin] = useState(false);

    // Close modal once the server action reports success
    useEffect(() => {
        if (state?.success) onClose();
    }, [state, onClose]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-500 border border-app-border">
                {/* Header */}
                <div className="px-8 py-6 border-b border-app-border flex justify-between items-center sticky top-0 bg-app-surface/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-600 shadow-lg shadow-indigo-100 text-white">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-app-foreground leading-tight">Master HR Enrollment</h2>
                            <p className="text-xs text-app-muted-foreground font-bold uppercase tracking-widest">Employee & Payroll Identity</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-app-surface rounded-2xl transition-all text-app-muted-foreground hover:text-app-foreground">
                        <X size={20} />
                    </button>
                </div>

                <form action={action} className="p-8 space-y-8">

                    {/* PERSONAL INFO */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <User size={18} className="text-app-info" />
                            <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest">Personal Identification</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">First Name</label>
                                <input name="firstName" className="w-full px-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Last Name</label>
                                <input name="lastName" className="w-full px-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Work Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                    <input name="email" type="email" className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Internal Reference (ID)</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-app-faint" size={18} />
                                    <input name="employeeId" className="w-full pl-12 pr-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground" placeholder="e.g. EMP-101" required />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ASSIGNMENT */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Building2 size={18} className="text-app-info" />
                            <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest">Branch & Role Assignment</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Home Site (Base Branch)</label>
                                <select name="homeSiteId" className="w-full px-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground appearance-none" required>
                                    <option value="">Select Branch...</option>
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Designation / Job Title</label>
                                <input name="jobTitle" className="w-full px-6 py-4 rounded-2xl bg-app-surface border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground" placeholder="e.g. Senior Cashier" />
                            </div>
                        </div>
                    </div>

                    {/* SYSTEM ACCESS */}
                    <div className="p-8 bg-app-surface rounded-[40px] space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Key size={18} className="text-app-info" />
                                <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest">System Login Access</h3>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="createLogin" className="sr-only peer" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} />
                                <div className="w-14 h-7 bg-app-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-app-surface after:border-app-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {createLogin && (
                            <div className="animate-in slide-in-from-top-4 duration-300 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 ml-1">Access Role & Security Level</label>
                                    <select name="roleId" className="w-full px-6 py-4 rounded-2xl bg-app-surface border border-app-border focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground appearance-none" required>
                                        <option value="">Select Access Role...</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name} - {r.description}</option>)}
                                    </select>
                                </div>
                                <p className="text-xs text-app-muted-foreground font-medium bg-app-surface p-4 rounded-2xl border border-app-border italic">
                                    Login will be created with username: <span className="text-app-info font-bold">Email Address</span>.
                                    Temporary password will be generated automatically.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* PERSON TYPE & LEDGER */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <CreditCard size={18} className="text-app-info" />
                            <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest">Person Category & Ledger</h3>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <label className="relative cursor-pointer">
                                <input type="radio" name="employeeType" value="EMPLOYEE" defaultChecked className="peer sr-only" />
                                <div className="p-4 rounded-2xl bg-app-surface border-2 border-transparent peer-checked:border-app-info peer-checked:bg-app-info-bg transition-all text-center">
                                    <span className="text-xs font-black text-app-foreground uppercase tracking-widest">Employee</span>
                                    <p className="text-[9px] text-app-muted-foreground mt-1">Payroll & Salaries</p>
                                </div>
                            </label>
                            <label className="relative cursor-pointer">
                                <input type="radio" name="employeeType" value="PARTNER" className="peer sr-only" />
                                <div className="p-4 rounded-2xl bg-app-surface border-2 border-transparent peer-checked:border-purple-500 peer-checked:bg-purple-50 transition-all text-center">
                                    <span className="text-xs font-black text-app-foreground uppercase tracking-widest">Partner</span>
                                    <p className="text-[9px] text-app-muted-foreground mt-1">Capital & Dividends</p>
                                </div>
                            </label>
                            <label className="relative cursor-pointer">
                                <input type="radio" name="employeeType" value="BOTH" className="peer sr-only" />
                                <div className="p-4 rounded-2xl bg-app-surface border-2 border-transparent peer-checked:border-app-warning peer-checked:bg-app-warning-bg transition-all text-center">
                                    <span className="text-xs font-black text-app-foreground uppercase tracking-widest">Both</span>
                                    <p className="text-[9px] text-app-muted-foreground mt-1">All Accounts</p>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-app-success-bg rounded-2xl">
                            <p className="text-[10px] text-app-success font-bold">
                                GL sub-accounts will be auto-created based on the selected category:
                                <br />• <strong>Employee</strong> → Salaries Payable (2121-XXXX)
                                <br />• <strong>Partner</strong> → Capital (3001-XXXX) + Dividends (3200-XXXX)
                                <br />• <strong>Both</strong> → All of the above
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-app-border flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-5 rounded-2xl font-black text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-surface transition-all text-xs uppercase tracking-[0.2em]">Abort</button>
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