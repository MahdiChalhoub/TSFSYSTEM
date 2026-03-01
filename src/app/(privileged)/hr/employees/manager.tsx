'use client';
import { useState } from 'react';
import type { Employee } from '@/types/erp';
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { useCurrency } from '@/lib/utils/currency';
import { toast } from 'sonner';
import { Search, Plus, User, Briefcase, Building2, CreditCard, ChevronRight, Phone, Mail, Filter, ShieldCheck, Fingerprint, Lock, AlertTriangle, Link2, ExternalLink, Zap } from "lucide-react";
import EmployeeModal from './form';
import ScopePasswordModal from '@/components/admin/ScopePasswordModal';
import { linkGLAccount } from '@/app/actions/people';
import { useAdmin } from '@/context/AdminContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
type Personnel = Record<string, any>;
const ALL_COLUMNS: ColumnDef<Personnel>[] = [
    { key: 'identity', label: 'Name', sortable: true, alwaysVisible: true },
    { key: 'id', label: 'Record ID', sortable: true },
    { key: 'role', label: 'Job Title' },
    { key: 'attribution', label: 'Site' },
    { key: 'ledger', label: 'GL Account', align: 'right' },
];
export default function HumanCapitalRegistry({
    employees,
    sites,
    roles
}: {
    employees: Personnel[],
    sites: Record<string, any>[],
    roles: Record<string, any>[]
}) {
    const { fmt } = useCurrency();
    const settings = useListViewSettings('hr_employees_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 20,
        sortKey: 'identity',
        sortDir: 'asc',
    });
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scopeEmployee, setScopeEmployee] = useState<any | null>(null);
    const [linkingGL, setLinkingGL] = useState<string | null>(null);
    const { scopeAccess } = useAdmin();
    async function handleLinkGL(emp: Personnel, empType: 'EMPLOYEE' | 'PARTNER' | 'BOTH') {
        setLinkingGL(emp.id);
        const result = await linkGLAccount(emp.id, empType);
        if (result.success) {
            emp.linkedAccount = result.linkedAccount;
            emp.employeeType = empType;
            toast.success(`${emp.firstName} linked to Ledger successfully`);
        } else {
            toast.error(result.message);
        }
        setLinkingGL(null);
    }
    const filtered = employees.filter(e =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeId.toLowerCase().includes(search.toLowerCase())
    );
    const columns: ColumnDef<Personnel>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: Personnel) => React.ReactNode> = {
            identity: r => (
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${r.isStandaloneUser ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                            <User size={20} />
                        </div>
                        {r.user && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-50">
                                <ShieldCheck size={10} />
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                            {r.firstName} {r.lastName}
                        </div>
                        <div className="text-[10px] font-medium text-gray-400">
                            {r.user?.email || 'No System Access'}
                        </div>
                    </div>
                </div>
            ),
            id: r => <span className="font-mono font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg text-[10px]">{r.employeeId}</span>,
            role: r => (
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest">{r.jobTitle || 'Unassigned Role'}</span>
                    <span className="text-[10px] text-gray-400 font-medium">ID: {r.id}</span>
                </div>
            ),
            attribution: r => (
                <Badge variant="outline" className="text-[10px] font-bold border-stone-200 text-stone-600 bg-stone-50">
                    <Building2 size={10} className="mr-1" /> {r.homeSite?.name || 'All Sites'}
                </Badge>
            ),
            ledger: r => (
                <div className="flex justify-end items-center gap-2">
                    {r.isStandaloneUser ? (
                        <span className="text-[10px] font-black text-gray-300 uppercase italic">N/A Profile Incomplete</span>
                    ) : r.linkedAccount ? (
                        <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-emerald-600 text-xs">{r.linkedAccount.code}</span>
                            {r.employeeType && r.employeeType !== 'EMPLOYEE' && (
                                <Badge className="mt-0.5 bg-violet-50 text-violet-600 border-violet-100 text-[8px] h-4">
                                    {r.employeeType} PARITY
                                </Badge>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-1">
                            {['EMPLOYEE', 'PARTNER', 'BOTH'].map(type => (
                                <Button
                                    key={type}
                                    onClick={() => handleLinkGL(r, type as any)}
                                    disabled={linkingGL === r.id}
                                    variant="ghost"
                                    className="h-7 px-2 bg-gray-50 hover:bg-indigo-600 hover:text-white text-[8px] font-black uppercase border border-gray-100"
                                >
                                    {type}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            )
        };
        return { ...c, render: renderers[c.key] };
    });
    return (
        <div className="space-y-6">
            <TypicalListView<Personnel>
                title="Employee Directory"
                data={filtered}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                className="rounded-[32px] border-0 shadow-sm overflow-hidden"
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                headerExtra={
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        className="h-10 px-6 bg-gray-900 text-white hover:bg-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all"
                    >
                        <Plus size={18} className="mr-2" /> Add Employee
                    </Button>
                }
                lifecycle={{
                    getStatus: r => r.isStandaloneUser
                        ? { label: 'Incomplete', variant: 'warning' }
                        : { label: r.status || 'Active', variant: 'success' }
                }}
                actions={{
                    onEdit: (r) => toast.info(`Initializing secure stream for ${r.firstName}`),
                    extra: (r: Personnel) => (
                        <div className="flex gap-1">
                            {scopeAccess !== 'official' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-500 hover:bg-emerald-50"
                                    onClick={() => setScopeEmployee({
                                        ...r,
                                        firstName: r.firstName || r.first_name,
                                        lastName: r.lastName || r.last_name
                                    } as any)}
                                >
                                    <Lock size={14} />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50">
                                <ExternalLink size={14} />
                            </Button>
                        </div>
                    )
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search by name or ID...', value: search, onChange: setSearch }}
                />
            </TypicalListView>
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