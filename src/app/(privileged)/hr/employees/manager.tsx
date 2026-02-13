'use client';

import { useState } from 'react';
import { Search, Plus, User, Briefcase, Building2, CreditCard, ChevronRight, Phone, Mail, Filter, ShieldCheck, Fingerprint, Lock, AlertTriangle, Link2 } from "lucide-react";
import EmployeeModal from './form';
import ScopePasswordModal from '@/components/admin/ScopePasswordModal';
import { linkGLAccount } from '@/app/actions/people';
import { useAdmin } from '@/context/AdminContext';
import clsx from 'clsx';

export default function EmployeeManager({
    employees,
    sites,
    roles
}: {
    employees: any[],
    sites: any[],
    roles: any[]
}) {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scopeEmployee, setScopeEmployee] = useState<any | null>(null);
    const [linkingGL, setLinkingGL] = useState<string | null>(null);
    const [glMessage, setGLMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
    const { scopeAccess } = useAdmin();

    async function handleLinkGL(emp: any, empType: 'EMPLOYEE' | 'PARTNER' | 'BOTH') {
        setLinkingGL(emp.id);
        setGLMessage(null);
        const result = await linkGLAccount(emp.id, empType);
        if (result.success) {
            emp.linkedAccount = result.linkedAccount;
            emp.employeeType = empType;
            setGLMessage({ id: emp.id, type: 'success', text: result.message || 'GL linked!' });
        } else {
            setGLMessage({ id: emp.id, type: 'error', text: result.message });
        }
        setLinkingGL(null);
    }

    const filtered = employees.filter(e =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeId.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Action Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-gray-50">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            className="w-full bg-gray-50 pl-14 pr-6 py-4 rounded-2xl border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300"
                            placeholder="Search by Name or Employee ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-4 w-full xl:w-auto">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 xl:flex-none px-8 py-4 bg-indigo-600 text-white rounded-[28px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 group"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        Enroll New Employee
                    </button>
                </div>
            </div>

            {/* Employee Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filtered.map((emp) => (
                    <div key={emp.id} className={clsx(
                        "group bg-white p-8 rounded-[48px] border hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden flex flex-col items-center",
                        emp.isStandaloneUser ? "border-amber-200 bg-amber-50/30" : "border-gray-100"
                    )}>
                        {/* Status Badge */}
                        {emp.isStandaloneUser ? (
                            <div className="absolute top-8 right-8 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-amber-200/50 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Incomplete
                            </div>
                        ) : (
                            <div className="absolute top-8 right-8 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {emp.status}
                            </div>
                        )}

                        {/* Avatar Cell */}
                        <div className="relative mb-6">
                            <div className={clsx(
                                "w-32 h-32 rounded-[44px] flex items-center justify-center transition-colors duration-500 shadow-inner",
                                emp.isStandaloneUser
                                    ? "bg-amber-50 text-amber-200 group-hover:bg-amber-100 group-hover:text-amber-300"
                                    : "bg-gray-50 text-gray-200 group-hover:bg-indigo-50 group-hover:text-indigo-200"
                            )}>
                                <User size={56} strokeWidth={1.5} />
                            </div>
                            {emp.user && (
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white shadow-xl rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-50 animate-in zoom-in duration-700">
                                    <ShieldCheck size={20} />
                                </div>
                            )}
                        </div>

                        {/* Core Info */}
                        <div className="text-center space-y-2 mb-8">
                            <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {emp.firstName} {emp.lastName}
                            </h3>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{emp.jobTitle || 'Unassigned Role'}</span>
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{emp.employeeId}</span>
                            </div>
                        </div>

                        {/* Attribution Grid */}
                        <div className="w-full grid grid-cols-2 gap-4 mb-8 pt-8 border-t border-gray-50">
                            <div className="flex flex-col items-center text-center">
                                <Building2 size={16} className="text-gray-300 mb-1" />
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Home Site</span>
                                <span className="text-[11px] font-bold text-gray-700">{emp.homeSite?.name || 'Global'}</span>
                            </div>
                            <div className="flex flex-col items-center text-center border-l border-gray-50">
                                <CreditCard size={16} className={clsx("mb-1", emp.linkedAccount ? "text-emerald-400" : emp.isStandaloneUser ? "text-gray-300" : "text-red-400")} />
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Ledger Account</span>
                                {emp.isStandaloneUser ? (
                                    <span className="text-[10px] text-gray-400">N/A</span>
                                ) : emp.linkedAccount ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[11px] font-mono font-bold text-emerald-600">{emp.linkedAccount.code}</span>
                                        {emp.dividendsAccount && (
                                            <span className="text-[9px] font-mono text-purple-500">DIV: {emp.dividendsAccount.code}</span>
                                        )}
                                        {emp.employeeType && emp.employeeType !== 'EMPLOYEE' && (
                                            <span className="text-[8px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">{emp.employeeType}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 mt-1">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleLinkGL(emp, 'EMPLOYEE')}
                                                disabled={linkingGL === emp.id}
                                                className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all border border-blue-200/50"
                                            >
                                                Employee
                                            </button>
                                            <button
                                                onClick={() => handleLinkGL(emp, 'PARTNER')}
                                                disabled={linkingGL === emp.id}
                                                className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-[8px] font-black uppercase hover:bg-purple-600 hover:text-white transition-all border border-purple-200/50"
                                            >
                                                Partner
                                            </button>
                                            <button
                                                onClick={() => handleLinkGL(emp, 'BOTH')}
                                                disabled={linkingGL === emp.id}
                                                className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[8px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all border border-amber-200/50"
                                            >
                                                Both
                                            </button>
                                        </div>
                                        {linkingGL === emp.id && <span className="text-[9px] text-gray-400 animate-pulse">Creating GL...</span>}
                                    </div>
                                )}
                                {glMessage && glMessage.id === emp.id && (
                                    <span className={clsx("text-[9px] font-bold mt-1", glMessage.type === 'success' ? 'text-emerald-600' : 'text-red-500')}>
                                        {glMessage.text}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="w-full grid grid-cols-3 gap-3">
                            {emp.isStandaloneUser ? (
                                <button className="col-span-2 py-3.5 rounded-2xl bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all shadow-sm border border-amber-200/50">
                                    Complete Profile
                                </button>
                            ) : (
                                <>
                                    <button className="py-3.5 rounded-2xl bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all border border-transparent hover:border-gray-200">
                                        View Profile
                                    </button>
                                    <button className="py-3.5 rounded-2xl bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                        Payroll Detail
                                    </button>
                                </>
                            )}
                            {scopeAccess !== 'official' && (
                                <button
                                    onClick={() => setScopeEmployee(emp)}
                                    className="py-3.5 rounded-2xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-1"
                                >
                                    <Lock size={10} />
                                    Scope
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <EmployeeModal
                    sites={sites}
                    roles={roles}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            {scopeEmployee && (
                <ScopePasswordModal
                    employee={scopeEmployee}
                    onClose={() => setScopeEmployee(null)}
                />
            )}
        </div>
    );
}