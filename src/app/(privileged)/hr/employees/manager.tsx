// @ts-nocheck
'use client';

import { useState } from 'react';
import type { Employee } from '@/types/erp';
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
    employees: Record<string, any>[],
    sites: Record<string, any>[],
    roles: Record<string, any>[]
}) {
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scopeEmployee, setScopeEmployee] = useState<Employee | null>(null);
    const [linkingGL, setLinkingGL] = useState<string | null>(null);
    const [glMessage, setGLMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
    const { scopeAccess } = useAdmin();

    async function handleLinkGL(emp: Record<string, any>, empType: 'EMPLOYEE' | 'PARTNER' | 'BOTH') {
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
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-app-surface p-6 rounded-[40px] shadow-2xl shadow-indigo-900/5 border border-app-border">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-app-faint group-focus-within:text-app-info transition-colors" size={20} />
                        <input
                            className="w-full bg-app-surface pl-14 pr-6 py-4 rounded-2xl border-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-app-foreground placeholder:text-app-faint"
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
                        "group bg-app-surface p-8 rounded-[48px] border hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden flex flex-col items-center",
                        emp.isStandaloneUser ? "border-app-warning bg-app-warning-bg/30" : "border-app-border"
                    )}>
                        {/* Status Badge */}
                        {emp.isStandaloneUser ? (
                            <div className="absolute top-8 right-8 px-3 py-1 bg-app-warning-bg text-app-warning rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-app-warning/50 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-app-warning"></span>
                                Incomplete
                            </div>
                        ) : (
                            <div className="absolute top-8 right-8 px-3 py-1 bg-app-success-bg text-app-success rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-app-success/50 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse"></span>
                                {emp.status}
                            </div>
                        )}

                        {/* Avatar Cell */}
                        <div className="relative mb-6">
                            <div className={clsx(
                                "w-32 h-32 rounded-[44px] flex items-center justify-center transition-colors duration-500 shadow-inner",
                                emp.isStandaloneUser
                                    ? "bg-app-warning-bg text-amber-200 group-hover:bg-app-warning-bg group-hover:text-amber-300"
                                    : "bg-app-surface text-gray-200 group-hover:bg-app-info-bg group-hover:text-indigo-200"
                            )}>
                                <User size={56} strokeWidth={1.5} />
                            </div>
                            {emp.user && (
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-app-surface shadow-xl rounded-2xl flex items-center justify-center text-app-success border border-app-success animate-in zoom-in duration-700">
                                    <ShieldCheck size={20} />
                                </div>
                            )}
                        </div>

                        {/* Core Info */}
                        <div className="text-center space-y-2 mb-8">
                            <h3 className="text-2xl font-black text-app-foreground group-hover:text-app-info transition-colors">
                                {emp.firstName} {emp.lastName}
                            </h3>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">{emp.jobTitle || 'Unassigned Role'}</span>
                                <span className="text-[10px] font-bold text-app-info bg-app-info-bg px-2 py-0.5 rounded-full">{emp.employeeId}</span>
                            </div>
                        </div>

                        {/* Attribution Grid */}
                        <div className="w-full grid grid-cols-2 gap-4 mb-8 pt-8 border-t border-app-border">
                            <div className="flex flex-col items-center text-center">
                                <Building2 size={16} className="text-app-faint mb-1" />
                                <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-tighter">Home Site</span>
                                <span className="text-[11px] font-bold text-app-foreground">{emp.homeSite?.name || 'Global'}</span>
                            </div>
                            <div className="flex flex-col items-center text-center border-l border-app-border">
                                <CreditCard size={16} className={clsx("mb-1", emp.linkedAccount ? "text-app-success" : emp.isStandaloneUser ? "text-app-faint" : "text-app-error")} />
                                <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-tighter">Ledger Account</span>
                                {emp.isStandaloneUser ? (
                                    <span className="text-[10px] text-app-muted-foreground">N/A</span>
                                ) : emp.linkedAccount ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-[11px] font-mono font-bold text-app-success">{emp.linkedAccount.code}</span>
                                        {emp.dividendsAccount && (
                                            <span className="text-[9px] font-mono text-purple-500">DIV: {emp.dividendsAccount.code}</span>
                                        )}
                                        {emp.employeeType && emp.employeeType !== 'EMPLOYEE' && (
                                            <span className="text-[8px] font-bold text-app-info bg-app-info-bg px-1.5 py-0.5 rounded-full">{emp.employeeType}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 mt-1">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleLinkGL(emp, 'EMPLOYEE')}
                                                disabled={linkingGL === emp.id}
                                                className="px-2 py-1 bg-app-info-bg text-app-info rounded text-[8px] font-black uppercase hover:bg-app-info hover:text-white transition-all border border-app-info/50"
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
                                                className="px-2 py-1 bg-app-warning-bg text-app-warning rounded text-[8px] font-black uppercase hover:bg-app-warning hover:text-white transition-all border border-app-warning/50"
                                            >
                                                Both
                                            </button>
                                        </div>
                                        {linkingGL === emp.id && <span className="text-[9px] text-app-muted-foreground animate-pulse">Creating GL...</span>}
                                    </div>
                                )}
                                {glMessage && glMessage.id === emp.id && (
                                    <span className={clsx("text-[9px] font-bold mt-1", glMessage.type === 'success' ? 'text-app-success' : 'text-app-error')}>
                                        {glMessage.text}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="w-full grid grid-cols-3 gap-3">
                            {emp.isStandaloneUser ? (
                                <button className="col-span-2 py-3.5 rounded-2xl bg-app-warning-bg text-app-warning text-[10px] font-black uppercase tracking-widest hover:bg-app-warning hover:text-white transition-all shadow-sm border border-app-warning/50">
                                    Complete Profile
                                </button>
                            ) : (
                                <>
                                    <button className="py-3.5 rounded-2xl bg-app-surface text-[10px] font-black uppercase tracking-widest text-app-muted-foreground hover:bg-app-surface-2 hover:text-app-muted-foreground transition-all border border-transparent hover:border-app-border">
                                        View Profile
                                    </button>
                                    <button className="py-3.5 rounded-2xl bg-app-info-bg text-app-info text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                        Payroll Detail
                                    </button>
                                </>
                            )}
                            {scopeAccess !== 'official' && (
                                <button
                                    onClick={() => setScopeEmployee(emp)}
                                    className="py-3.5 rounded-2xl bg-app-success-bg text-app-success text-[10px] font-black uppercase tracking-widest hover:bg-app-primary hover:text-white transition-all shadow-sm flex items-center justify-center gap-1"
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