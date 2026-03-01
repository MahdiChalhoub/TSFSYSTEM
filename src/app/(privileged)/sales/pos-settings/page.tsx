'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import {
    Plus, Trash2, Save, ArrowLeft, Shield, Monitor, Users, Key,
    CreditCard, Banknote, Smartphone, Truck, Wallet, Building2,
    Lock, Unlock, Edit, Check, X, AlertTriangle, Eye, EyeOff,
    ChevronDown, ChevronRight, Loader2, RefreshCw, Hash, Settings2, ExternalLink,
    MessageSquare, Phone, Globe, Zap, ToggleLeft, ToggleRight, TestTube
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

// ── Types ──
type PaymentMethodConfig = { key: string; label: string; accountId: number | null };
type FinancialAccount = { id: number; name: string; type: string; currency: string };
type SiteData = { id: number; name: string; code: string };
type UserData = { id: number; username: string; first_name: string; last_name: string; email: string; pos_pin?: boolean; role?: number; role_name?: string; is_staff?: boolean; is_superuser?: boolean; has_override_pin?: boolean };
type RegisterData = {
    id: number; name: string; siteId: number; siteName: string;
    warehouseId?: number; cashAccountId?: number; isActive: boolean; isOpen: boolean;
};
type WarehouseData = { id: number; name: string; parent: number | null };

const ICONS: Record<string, any> = { CASH: Banknote, CARD: CreditCard, WALLET: Wallet, OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck };
const PRESET_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY', 'CREDIT', 'CHECK', 'TRANSFER'];

type TabId = 'registers' | 'users' | 'payments' | 'security' | 'delivery';

export default function POSSettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('registers');
    const [loading, setLoading] = useState(true);

    // Data stores
    const [sites, setSites] = useState<SiteData[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
    const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
    const [lobbyData, setLobbyData] = useState<any[]>([]);

    // Load all data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [sitesRes, usersRes, acctsRes, whRes, methodsRes, lobbyRes] = await Promise.all([
                erpFetch('sites/').catch(() => []),
                erpFetch('users/').catch(() => []),
                erpFetch('accounts/').catch(() => []),
                erpFetch('warehouses/').catch(() => []),
                erpFetch('settings/item/pos_payment_methods/').catch(() => null),
                erpFetch('pos-registers/lobby/').catch(() => []),
            ]);
            const sitesArray = Array.isArray(sitesRes) ? sitesRes : sitesRes?.results || [];
            const lobbyArray = Array.isArray(lobbyRes) ? lobbyRes : [];
            // Fallback: if /sites/ returned empty but lobby has branches, use lobby data as sites
            const effectiveSites = sitesArray.length > 0 ? sitesArray : lobbyArray.map((s: any) => ({ id: s.id, name: s.name, code: s.code || '' }));
            setSites(effectiveSites);
            setUsers(Array.isArray(usersRes) ? usersRes : usersRes?.results || []);
            setAccounts(Array.isArray(acctsRes) ? acctsRes : acctsRes?.results || []);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.results || []);
            setLobbyData(lobbyArray);
            // Payment methods
            if (methodsRes && Array.isArray(methodsRes) && methodsRes.length > 0) {
                setMethods(methodsRes.map((m: any) => typeof m === 'string' ? { key: m, label: m, accountId: null } : { key: m.key, label: m.label || m.key, accountId: m.accountId || null }));
            } else {
                setMethods([
                    { key: 'CASH', label: 'Cash', accountId: null },
                    { key: 'CARD', label: 'Card', accountId: null },
                    { key: 'WALLET', label: 'Wallet', accountId: null },
                    { key: 'WAVE', label: 'Wave', accountId: null },
                    { key: 'OM', label: 'OM', accountId: null },
                    { key: 'MULTI', label: 'Multi', accountId: null },
                    { key: 'DELIVERY', label: 'Delivery', accountId: null },
                ]);
            }
        } catch (e) {
            toast.error('Failed to load settings data');
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const tabs = [
        { id: 'registers' as TabId, label: 'Registers', icon: Monitor, desc: 'POS terminals & sessions' },
        { id: 'users' as TabId, label: 'Users & PINs', icon: Key, desc: 'Cashier access & PINs' },
        { id: 'payments' as TabId, label: 'Payment Methods', icon: CreditCard, desc: 'Configure payment options' },
        { id: 'security' as TabId, label: 'Security', icon: Shield, desc: 'Rules & access control' },
        { id: 'delivery' as TabId, label: 'Delivery & SMS', icon: Truck, desc: 'Confirmation codes & SMS' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <Loader2 size={32} className="text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400 font-bold">Loading POS Settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/sales" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <ArrowLeft size={20} className="text-gray-500" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">POS Configuration</h1>
                            <p className="text-xs text-gray-400 mt-0.5">Registers, cashiers, payment methods & security</p>
                        </div>
                    </div>
                    <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto py-6 px-6 flex gap-6">
                {/* Sidebar Tabs */}
                <div className="w-56 shrink-0 space-y-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
                                    activeTab === tab.id
                                        ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100"
                                        : "bg-white hover:bg-gray-50 text-gray-600 border border-transparent"
                                )}
                            >
                                <Icon size={18} className={activeTab === tab.id ? "text-indigo-500" : "text-gray-400"} />
                                <div>
                                    <p className="text-sm font-bold">{tab.label}</p>
                                    <p className="text-[10px] text-gray-400">{tab.desc}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'registers' && (
                        <RegistersTab sites={sites} accounts={accounts} warehouses={warehouses} users={users} lobbyData={lobbyData} onRefresh={loadData} />
                    )}
                    {activeTab === 'users' && (
                        <UsersTab users={users} lobbyData={lobbyData} onRefresh={loadData} />
                    )}
                    {activeTab === 'payments' && (
                        <PaymentsTab methods={methods} setMethods={setMethods} accounts={accounts} />
                    )}
                    {activeTab === 'security' && (
                        <SecurityTab />
                    )}
                    {activeTab === 'delivery' && (
                        <DeliveryTab />
                    )}
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 1: REGISTERS
// ═══════════════════════════════════════════════════════════════════
function RegistersTab({ sites, accounts, warehouses, users, lobbyData, onRefresh }: {
    sites: SiteData[]; accounts: FinancialAccount[]; warehouses: WarehouseData[];
    users: UserData[]; lobbyData: any[]; onRefresh: () => void;
}) {
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Create form
    const [form, setForm] = useState({
        name: '', siteId: '', warehouseId: '', cashAccountId: '',
        allowedAccountIds: [] as number[], authorizedUserIds: [] as number[],
        openingMode: 'STANDARD' as string, cashierCanSeeSoftware: false,
        paymentMethods: [] as Array<{ key: string; label: string; accountId: number | null }>,
    });

    const handleCreate = async () => {
        if (!form.name || !form.siteId) {
            toast.error('Name and Site are required');
            return;
        }
        setSaving(true);
        try {
            await erpFetch('pos-registers/create-register/', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name,
                    site_id: Number(form.siteId),
                    warehouse_id: form.warehouseId ? Number(form.warehouseId) : null,
                    cash_account_id: form.cashAccountId ? Number(form.cashAccountId) : null,
                    allowed_account_ids: form.allowedAccountIds,
                    authorized_user_ids: form.authorizedUserIds,
                    opening_mode: form.openingMode,
                    cashier_can_see_software: form.cashierCanSeeSoftware,
                    payment_methods: form.paymentMethods,
                })
            });
            toast.success(`Register "${form.name}" created!`);
            setShowCreate(false);
            setForm({ name: '', siteId: '', warehouseId: '', cashAccountId: '', allowedAccountIds: [], authorizedUserIds: [], openingMode: 'STANDARD', cashierCanSeeSoftware: false, paymentMethods: [] });
            onRefresh();
        } catch (e) {
            toast.error('Failed to create register');
        }
        setSaving(false);
    };

    const handleUpdate = async () => {
        if (!editId) return;
        setSaving(true);
        try {
            await erpFetch('pos-registers/update-register/', {
                method: 'POST',
                body: JSON.stringify({
                    id: editId,
                    name: form.name,
                    warehouse_id: form.warehouseId ? Number(form.warehouseId) : null,
                    cash_account_id: form.cashAccountId ? Number(form.cashAccountId) : null,
                    allowed_account_ids: form.allowedAccountIds,
                    authorized_user_ids: form.authorizedUserIds,
                    opening_mode: form.openingMode,
                    cashier_can_see_software: form.cashierCanSeeSoftware,
                    payment_methods: form.paymentMethods,
                })
            });
            toast.success('Register updated!');
            setEditId(null);
            onRefresh();
        } catch (e) {
            toast.error('Failed to update register');
        }
        setSaving(false);
    };

    // Flatten lobby data for display
    const allRegisters: any[] = [];
    lobbyData.forEach((site: any) => {
        (site.registers || []).forEach((reg: any) => {
            allRegisters.push({ ...reg, siteName: site.name, siteId: site.id });
        });
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-gray-900">POS Registers</h2>
                    <p className="text-xs text-gray-400">Physical terminals at each site with their own cash accounts</p>
                </div>
                <button
                    onClick={() => { setShowCreate(!showCreate); setEditId(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100"
                >
                    <Plus size={16} />
                    New Register
                </button>
            </div>

            {/* Create / Edit Form */}
            {(showCreate || editId) && (
                <div className="bg-white rounded-2xl border border-indigo-100 p-5 space-y-4 shadow-sm animate-in slide-in-from-top-2">
                    <h3 className="font-black text-sm text-indigo-700">{editId ? 'Edit Register' : 'Create New Register'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Register Name *</label>
                            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Caisse 1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
                        </div>
                        {!editId && (
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Branch / Location *</label>
                                    <Link href="/inventory/warehouses" target="_blank" className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"><ExternalLink size={8} /> Create</Link>
                                </div>
                                <select value={form.siteId} onChange={(e) => setForm(f => ({ ...f, siteId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200">
                                    <option value="">Select branch...</option>
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Warehouse</label>
                                <Link href="/inventory/warehouses" target="_blank" className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"><ExternalLink size={8} /> Create</Link>
                            </div>
                            <select value={form.warehouseId} onChange={(e) => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200">
                                <option value="">Default warehouse</option>
                                {warehouses.filter(w => !form.siteId || w.parent === Number(form.siteId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cash Account</label>
                                <Link href="/finance" target="_blank" className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"><ExternalLink size={8} /> Create</Link>
                            </div>
                            <select value={form.cashAccountId} onChange={(e) => setForm(f => ({ ...f, cashAccountId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200">
                                <option value="">No dedicated cash account</option>
                                {accounts.filter(a => a.type === 'CASH' || a.type === 'PETTY_CASH').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Opening Mode</label>
                            <select value={form.openingMode} onChange={(e) => setForm(f => ({ ...f, openingMode: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200">
                                <option value="STANDARD">Standard — Quick cash open</option>
                                <option value="ADVANCED">Advanced — Full reconciliation</option>
                            </select>
                        </div>
                    </div>

                    {/* Cashier Software Visibility Toggle */}
                    {form.openingMode === 'ADVANCED' && (
                        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                            <button
                                onClick={() => setForm(f => ({ ...f, cashierCanSeeSoftware: !f.cashierCanSeeSoftware }))}
                                className={clsx(
                                    "w-10 h-5 rounded-full transition-all flex items-center px-0.5",
                                    form.cashierCanSeeSoftware ? "bg-amber-500 justify-end" : "bg-gray-300 justify-start"
                                )}
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow" />
                            </button>
                            <div>
                                <p className="text-xs font-bold text-amber-800">Cashier can see software values</p>
                                <p className="text-[10px] text-amber-600">{form.cashierCanSeeSoftware ? 'Cashier sees full details' : 'Manager PIN required to reveal amounts'}</p>
                            </div>
                        </div>
                    )}

                    {/* Allowed Payment Accounts */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Allowed Payment Accounts</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setForm(f => ({ ...f, allowedAccountIds: accounts.filter(a => a.type !== 'SAVINGS' && a.type !== 'INVESTMENT').map(a => a.id) }))} className="text-[10px] text-indigo-500 font-bold hover:underline">Select All</button>
                                <button type="button" onClick={() => setForm(f => ({ ...f, allowedAccountIds: [] }))} className="text-[10px] text-gray-400 font-bold hover:underline">Clear</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                            {accounts.filter(a => a.type !== 'SAVINGS' && a.type !== 'INVESTMENT').map(acc => (
                                <button key={acc.id} type="button"
                                    onClick={() => setForm(f => ({
                                        ...f,
                                        allowedAccountIds: f.allowedAccountIds.includes(acc.id)
                                            ? f.allowedAccountIds.filter(id => id !== acc.id)
                                            : [...f.allowedAccountIds, acc.id]
                                    }))}
                                    className={clsx(
                                        "px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left flex items-center justify-between",
                                        form.allowedAccountIds.includes(acc.id)
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                                    )}>
                                    <span className="truncate">{acc.name}</span>
                                    {form.allowedAccountIds.includes(acc.id) ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded border border-gray-300" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Authorized Users */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Authorized Cashiers</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setForm(f => ({ ...f, authorizedUserIds: users.map(u => u.id) }))} className="text-[10px] text-indigo-500 font-bold hover:underline">Select All</button>
                                <button type="button" onClick={() => setForm(f => ({ ...f, authorizedUserIds: [] }))} className="text-[10px] text-gray-400 font-bold hover:underline">Clear</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                            {users.map(u => (
                                <button key={u.id} type="button"
                                    onClick={() => setForm(f => ({
                                        ...f,
                                        authorizedUserIds: f.authorizedUserIds.includes(u.id)
                                            ? f.authorizedUserIds.filter(id => id !== u.id)
                                            : [...f.authorizedUserIds, u.id]
                                    }))}
                                    className={clsx(
                                        "px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2",
                                        form.authorizedUserIds.includes(u.id)
                                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                                    )}>
                                    <div className={clsx("w-6 h-6 rounded flex items-center justify-center shrink-0",
                                        form.authorizedUserIds.includes(u.id) ? "bg-indigo-200" : "bg-gray-100"
                                    )}>
                                        <Users size={12} className={form.authorizedUserIds.includes(u.id) ? "text-indigo-700" : "text-gray-400"} />
                                    </div>
                                    <div className="flex-1 text-left truncate">
                                        {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
                                    </div>
                                    {form.authorizedUserIds.includes(u.id) ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Payment Methods for this Register ── */}
                    <div className="border border-indigo-100 rounded-2xl p-4 bg-indigo-50/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-gray-700">Payment Methods</p>
                                <p className="text-[10px] text-gray-400">Buttons shown in the POS for this register</p>
                            </div>
                            <div className="flex gap-1 flex-wrap justify-end">
                                {['CASH', 'CARD', 'WAVE', 'OM', 'WALLET', 'MULTI', 'DELIVERY', 'CREDIT', 'CHECK', 'TRANSFER'].filter(
                                    k => !form.paymentMethods.find(m => m.key === k)
                                ).map(k => (
                                    <button key={k}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, paymentMethods: [...f.paymentMethods, { key: k, label: k.charAt(0) + k.slice(1).toLowerCase(), accountId: null }] }))}
                                        className="px-2 py-1 text-[9px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all"
                                    >+ {k}</button>
                                ))}
                                <button type="button"
                                    onClick={() => {
                                        const key = prompt('Custom method key (e.g. MTN_MONEY):');
                                        if (key && key.trim()) {
                                            setForm(f => ({ ...f, paymentMethods: [...f.paymentMethods, { key: key.trim().toUpperCase(), label: key.trim(), accountId: null }] }));
                                        }
                                    }}
                                    className="px-2 py-1 text-[9px] font-bold rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                                >+ Custom</button>
                            </div>
                        </div>
                        {form.paymentMethods.length === 0 && (
                            <p className="text-[10px] text-gray-400 text-center py-2">No methods configured — will use global defaults</p>
                        )}
                        {form.paymentMethods.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2">
                                <span className="text-gray-300 cursor-grab text-xs">⠿</span>
                                <input
                                    type="text"
                                    value={m.label}
                                    onChange={e => setForm(f => {
                                        const arr = [...f.paymentMethods];
                                        arr[idx] = { ...arr[idx], label: e.target.value };
                                        return { ...f, paymentMethods: arr };
                                    })}
                                    className="flex-1 text-xs font-bold text-gray-800 outline-none min-w-0"
                                    placeholder="Label"
                                />
                                <span className="text-[9px] text-gray-300 font-mono">{m.key}</span>
                                <select
                                    value={m.accountId || ''}
                                    onChange={e => setForm(f => {
                                        const arr = [...f.paymentMethods];
                                        arr[idx] = { ...arr[idx], accountId: e.target.value ? Number(e.target.value) : null };
                                        return { ...f, paymentMethods: arr };
                                    })}
                                    className={clsx(
                                        "text-[10px] font-bold rounded-lg border px-2 py-1 outline-none max-w-[130px]",
                                        m.accountId ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-600"
                                    )}
                                >
                                    <option value="">No account</option>
                                    {accounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                                <button type="button"
                                    onClick={() => setForm(f => ({ ...f, paymentMethods: f.paymentMethods.filter((_, i) => i !== idx) }))}
                                    className="text-red-400 hover:text-red-600 transition-all p-1"
                                ><X size={12} /></button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => { setShowCreate(false); setEditId(null); }}
                            className="px-4 py-2 text-gray-500 text-sm font-bold hover:bg-gray-100 rounded-lg transition-all">Cancel</button>
                        <button onClick={editId ? handleUpdate : handleCreate} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 disabled:opacity-50 transition-all shadow">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {editId ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            )}

            {/* Register List */}
            {sites.map(site => {
                const siteRegisters = allRegisters.filter(r => r.siteId === site.id);
                return (
                    <div key={site.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                            <Building2 size={14} className="text-gray-400" />
                            <span className="text-sm font-black text-gray-700">{site.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{site.code || ''}</span>
                            <span className="ml-auto text-[10px] font-bold text-gray-400">{siteRegisters.length} register(s)</span>
                        </div>
                        {siteRegisters.length === 0 ? (
                            <div className="px-4 py-8 text-center text-gray-300 text-sm">No registers at this site</div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {siteRegisters.map((reg: any) => (
                                    <div key={reg.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                            reg.isOpen ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400")}>
                                            <Monitor size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-gray-900">{reg.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {reg.isOpen ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                        <Unlock size={8} /> Open — {reg.currentSession?.cashierName}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                                        <Lock size={8} /> Closed
                                                    </span>
                                                )}
                                                {reg.cashAccountName && (
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                        💰 {reg.cashAccountName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {reg.authorizedUsers?.slice(0, 3).map((u: any) => (
                                                <span key={u.id} className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-black" title={u.name}>
                                                    {u.name?.substring(0, 2).toUpperCase()}
                                                </span>
                                            ))}
                                            {(reg.authorizedUsers?.length || 0) > 3 && (
                                                <span className="text-[9px] text-gray-400">+{reg.authorizedUsers.length - 3}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setEditId(reg.id);
                                                setShowCreate(false);
                                                setForm({
                                                    name: reg.name,
                                                    siteId: String(reg.siteId),
                                                    warehouseId: reg.warehouseId ? String(reg.warehouseId) : '',
                                                    cashAccountId: reg.cashAccountId ? String(reg.cashAccountId) : '',
                                                    allowedAccountIds: reg.allowedAccounts?.map((a: any) => a.id) || [],
                                                    authorizedUserIds: reg.authorizedUsers?.map((u: any) => u.id) || [],
                                                    openingMode: (reg.openingMode || 'standard').toUpperCase(),
                                                    cashierCanSeeSoftware: reg.cashierCanSeeSoftware || false,
                                                    paymentMethods: reg.paymentMethods || [],
                                                });
                                            }}
                                            className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all">
                                            <Edit size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {sites.length === 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 text-center">
                    <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-amber-800">No branches loaded</p>
                    <p className="text-xs text-amber-600 mt-1">
                        If you have locations, try refreshing. Otherwise, create them in{' '}
                        <Link href="/inventory/warehouses" className="underline font-bold">Inventory → Warehouses</Link>
                    </p>
                    <button onClick={onRefresh} className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all inline-flex items-center gap-2">
                        <RefreshCw size={12} /> Reload Data
                    </button>
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 2: USERS & PINs
// ═══════════════════════════════════════════════════════════════════
function UsersTab({ users, lobbyData, onRefresh }: { users: UserData[]; lobbyData: any[]; onRefresh: () => void }) {
    const [pinInputs, setPinInputs] = useState<Record<number, string>>({});
    const [overridePinInputs, setOverridePinInputs] = useState<Record<number, string>>({});
    const [savingPinFor, setSavingPinFor] = useState<number | null>(null);
    const [savingOverrideFor, setSavingOverrideFor] = useState<number | null>(null);
    const [showPinFor, setShowPinFor] = useState<number | null>(null);
    const [showOverrideFor, setShowOverrideFor] = useState<number | null>(null);

    // Build a map of which registers each user is assigned to
    const userRegisterMap: Record<number, string[]> = {};
    lobbyData.forEach((site: any) => {
        (site.registers || []).forEach((reg: any) => {
            (reg.authorizedUsers || []).forEach((u: any) => {
                if (!userRegisterMap[u.id]) userRegisterMap[u.id] = [];
                userRegisterMap[u.id].push(`${reg.name} (${site.name})`);
            });
        });
    });

    const handleSetPin = async (userId: number) => {
        const pin = pinInputs[userId];
        if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
            toast.error('PIN must be 4-6 digits'); return;
        }
        setSavingPinFor(userId);
        try {
            const res = await erpFetch('pos-registers/set-pin/', { method: 'POST', body: JSON.stringify({ user_id: userId, pin }) });
            if (res?.error) toast.error(res.error);
            else {
                toast.success(res.message || 'POS PIN updated successfully!');
                setPinInputs(p => ({ ...p, [userId]: '' }));
                onRefresh();
            }
        } catch (e: any) {
            toast.error(e?.message || 'Failed to set PIN');
        }
        setSavingPinFor(null);
    };

    const handleSetOverridePin = async (userId: number) => {
        const pin = overridePinInputs[userId];
        if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
            toast.error('PIN must be 4-6 digits'); return;
        }
        setSavingOverrideFor(userId);
        try {
            const res = await erpFetch('pos-registers/set-override-pin/', { method: 'POST', body: JSON.stringify({ user_id: userId, pin }) });
            if (res?.error) toast.error(res.error);
            else {
                toast.success(res.message || 'Override PIN updated successfully!');
                setOverridePinInputs(p => ({ ...p, [userId]: '' }));
                onRefresh();
            }
        } catch (e: any) {
            toast.error(e?.message || 'Failed to set override PIN');
        }
        setSavingOverrideFor(null);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-black text-gray-900">Users & PIN Codes</h2>
                <p className="text-xs text-gray-400">Manage cashier PINs (POS login) and manager override PINs (security authorizations)</p>
            </div>

            {/* ── Section 1: Cashier PINs ── */}
            <div>
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Key size={12} /> Cashier PINs — POS Login
                </h3>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="grid grid-cols-[1fr_100px_1fr_160px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Registers</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Set / Change</span>
                    </div>
                    {users.length === 0 && (
                        <div className="p-6 text-center text-sm text-gray-400">
                            No users found in this organization.
                        </div>
                    )}
                    {users.map(user => {
                        const hasPin = user.pos_pin || false;
                        const assignedRegisters = userRegisterMap[user.id] || [];
                        return (
                            <div key={user.id} className="grid grid-cols-[1fr_100px_1fr_160px] gap-3 px-4 py-2.5 border-b border-gray-50 items-center hover:bg-gray-50/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] shrink-0">
                                        {(user.first_name || user.username || '?').substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 truncate">
                                            {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {hasPin ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                            <Check size={8} /> Set
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                            <AlertTriangle size={8} /> None
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {assignedRegisters.length === 0 ? (
                                        <span className="text-[10px] text-gray-300">—</span>
                                    ) : assignedRegisters.map((r, i) => (
                                        <span key={i} className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">{r}</span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="relative flex-1">
                                        <input
                                            type={showPinFor === user.id ? "text" : "password"}
                                            value={pinInputs[user.id] || ''}
                                            onChange={(e) => setPinInputs(p => ({ ...p, [user.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                            placeholder="PIN" maxLength={6}
                                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-200 text-center"
                                        />
                                        <button onClick={() => setShowPinFor(showPinFor === user.id ? null : user.id)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            {showPinFor === user.id ? <EyeOff size={10} /> : <Eye size={10} />}
                                        </button>
                                    </div>
                                    <button onClick={() => handleSetPin(user.id)}
                                        disabled={savingPinFor === user.id || !(pinInputs[user.id]?.length >= 4)}
                                        className="p-1 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-30 transition-all shrink-0">
                                        {savingPinFor === user.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Section 2: Manager Override PINs ── */}
            <div>
                <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Shield size={12} /> Manager Override PINs — Security Authorization
                </h3>
                <p className="text-[10px] text-gray-400 mb-2">
                    Managers use this PIN to authorize: <b>void, refund, clear cart, delete item, decrease qty, discount, price override</b>
                </p>
                <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden shadow-sm">
                    <div className="grid grid-cols-[1fr_120px_200px] gap-3 px-4 py-3 bg-rose-50/50 border-b border-rose-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Override PIN Status</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Set / Change Override PIN</span>
                    </div>
                    {users.filter(u => {
                        const r = (u.role_name || '').toLowerCase();
                        const isManager = r.includes('admin') || r.includes('manager') || u.is_staff || u.is_superuser;
                        return isManager || u.has_override_pin;
                    }).length === 0 && (
                            <div className="p-6 text-center text-sm text-gray-400">
                                No managers or admins found to set an override PIN for.
                            </div>
                        )}
                    {users.filter(u => {
                        const r = (u.role_name || '').toLowerCase();
                        const isManager = r.includes('admin') || r.includes('manager') || u.is_staff || u.is_superuser;
                        return isManager || u.has_override_pin;
                    }).map(user => {
                        const hasOverride = (user as any).has_override_pin || false;
                        return (
                            <div key={user.id} className="grid grid-cols-[1fr_120px_200px] gap-3 px-4 py-2.5 border-b border-gray-50 items-center hover:bg-gray-50/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-black text-[10px] shrink-0">
                                        <Shield size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 truncate">
                                            {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}
                                        </p>
                                        <p className="text-[9px] text-gray-400">{user.role_name || user.role || 'User'}</p>
                                    </div>
                                </div>
                                <div>
                                    {hasOverride ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                            <Check size={8} /> Can Authorize
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                            <Lock size={8} /> Not a Manager
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="relative flex-1">
                                        <input
                                            type={showOverrideFor === user.id ? "text" : "password"}
                                            value={overridePinInputs[user.id] || ''}
                                            onChange={(e) => setOverridePinInputs(p => ({ ...p, [user.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                            placeholder="Override PIN" maxLength={6}
                                            className="w-full px-2 py-1 border border-rose-200 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-rose-200 text-center"
                                        />
                                        <button onClick={() => setShowOverrideFor(showOverrideFor === user.id ? null : user.id)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            {showOverrideFor === user.id ? <EyeOff size={10} /> : <Eye size={10} />}
                                        </button>
                                    </div>
                                    <button onClick={() => handleSetOverridePin(user.id)}
                                        disabled={savingOverrideFor === user.id || !(overridePinInputs[user.id]?.length >= 4)}
                                        className="p-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-30 transition-all shrink-0">
                                        {savingOverrideFor === user.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2">How PINs Work</h3>
                <ul className="text-xs text-blue-700 space-y-1 font-medium">
                    <li>• <b>Cashier PIN</b> — Used to log into a POS register at the lobby screen</li>
                    <li>• <b>Manager Override PIN</b> — Used to authorize sensitive actions (void, discount, delete, qty decrease, clear cart, refund, price override)</li>
                    <li>• Both PINs are <b>4-6 digits</b>, hashed securely (admins cannot see existing PINs)</li>
                    <li>• A user can have <b>both</b> PINs — one for login, one for overrides</li>
                    <li>• Only users with an override PIN can authorize protected actions on any register</li>
                </ul>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 3: PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════
function PaymentsTab({ methods, setMethods, accounts }: {
    methods: PaymentMethodConfig[]; setMethods: (m: PaymentMethodConfig[]) => void; accounts: FinancialAccount[];
}) {
    const [saving, setSaving] = useState(false);
    const [newMethodKey, setNewMethodKey] = useState('');

    const handleSave = async () => {
        setSaving(true);
        try {
            await erpFetch('settings/item/pos_payment_methods/', {
                method: 'POST',
                body: JSON.stringify(methods)
            });
            toast.success('Payment methods saved!');
        } catch (e) { toast.error('Failed to save'); }
        setSaving(false);
    };

    const addMethod = () => {
        const key = newMethodKey.trim().toUpperCase();
        if (!key || methods.find(m => m.key === key)) { toast.error(`"${key}" already exists`); return; }
        setMethods([...methods, { key, label: key, accountId: null }]);
        setNewMethodKey('');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-gray-900">Payment Methods</h2>
                    <p className="text-xs text-gray-400">Configure POS payment buttons and link them to financial accounts</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-100 transition-all">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="grid grid-cols-[40px_1fr_120px_200px_40px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] font-black text-gray-400 uppercase">#</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">Label</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">Key</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">Account</span>
                    <span />
                </div>
                {methods.map((method, idx) => {
                    const Icon = ICONS[method.key] || CreditCard;
                    return (
                        <div key={method.key} className="grid grid-cols-[40px_1fr_120px_200px_40px] gap-3 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50/50">
                            <div className="flex flex-col items-center gap-0.5">
                                <button onClick={() => { const arr = [...methods]; if (idx > 0) [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; setMethods(arr); }}
                                    disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-[10px]">▲</button>
                                <button onClick={() => { const arr = [...methods]; if (idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; setMethods(arr); }}
                                    disabled={idx === methods.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-[10px]">▼</button>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <Icon size={16} />
                                </div>
                                <input type="text" value={method.label}
                                    onChange={(e) => { const arr = [...methods]; arr[idx] = { ...arr[idx], label: e.target.value }; setMethods(arr); }}
                                    className="text-sm font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-500 outline-none py-1 w-full" />
                            </div>
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded text-center">{method.key}</span>
                            <select value={method.accountId || ''}
                                onChange={(e) => { const arr = [...methods]; arr[idx] = { ...arr[idx], accountId: e.target.value ? Number(e.target.value) : null }; setMethods(arr); }}
                                className={clsx("text-xs font-bold rounded-lg px-2 py-2 border outline-none w-full",
                                    method.accountId ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-700")}>
                                <option value="">⚠ No account linked</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type || 'N/A'})</option>)}
                            </select>
                            <button onClick={() => setMethods(methods.filter(m => m.key !== method.key))}
                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}

                <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-3">
                    <select value={newMethodKey} onChange={(e) => setNewMethodKey(e.target.value)}
                        className="text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none flex-1">
                        <option value="">Select method...</option>
                        {PRESET_METHODS.filter(p => !methods.find(m => m.key === p)).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type="text" value={newMethodKey} onChange={(e) => setNewMethodKey(e.target.value.toUpperCase())}
                        placeholder="Or custom..." className="text-sm font-bold bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none w-32" />
                    <button onClick={addMethod} disabled={!newMethodKey.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 disabled:opacity-40">
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 4: SECURITY RULES
// ═══════════════════════════════════════════════════════════════════
function SecurityTab() {
    const [rules, setRules] = useState({
        requirePinForLogin: true,
        allowCashierSwitch: true,
        autoLockIdleMinutes: 15,
        requireManagerForVoid: true,
        requireManagerForDiscount: true,
        requireManagerForPriceOverride: true,
        requireManagerForRefund: true,
        requireManagerForClearCart: true,
        requireManagerForDeleteItem: true,
        requireManagerForDecreaseQty: true,
        maxDiscountPercent: 20,
        lockRegisterOnClose: true,
        printReceiptOnClose: true,
        requireCountOnClose: true,
        allowNegativeStock: false,
        // Reconciliation strategy
        enableReconciliation: true,
        controlledAccountsAreTruth: true,
        autoCalibrateToClose: true,
        enableAccountBook: true,
        autoTransferExcessToReserve: true,
        autoDeductShortageFromCashier: true,
        requireStatementOnClose: true,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        erpFetch('settings/item/pos_security_rules/').then(data => {
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                setRules(prev => ({ ...prev, ...data }));
            }
        }).catch(() => { });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await erpFetch('settings/item/pos_security_rules/', { method: 'POST', body: JSON.stringify(rules) });
            toast.success('Security rules saved!');
        } catch (e) { toast.error('Failed to save'); }
        setSaving(false);
    };

    const ToggleRow = ({ label, desc, field }: { label: string; desc: string; field: keyof typeof rules }) => (
        <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="text-[10px] text-gray-400">{desc}</p>
            </div>
            <button
                onClick={() => setRules(r => ({ ...r, [field]: !r[field] }))}
                className={clsx("w-11 h-6 rounded-full transition-all relative shrink-0",
                    rules[field] ? "bg-emerald-500" : "bg-gray-200")}
            >
                <div className={clsx("w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all",
                    rules[field] ? "left-6" : "left-1")} />
            </button>
        </div>
    );

    const NumberRow = ({ label, desc, field, suffix }: { label: string; desc: string; field: keyof typeof rules; suffix: string }) => (
        <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="text-[10px] text-gray-400">{desc}</p>
            </div>
            <div className="flex items-center gap-2">
                <input type="number" value={rules[field] as number}
                    onChange={(e) => setRules(r => ({ ...r, [field]: Number(e.target.value) }))}
                    className="w-16 px-2 py-1 text-center text-sm font-bold border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200" />
                <span className="text-xs text-gray-400 font-bold">{suffix}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-gray-900">Security Rules</h2>
                    <p className="text-xs text-gray-400">Control POS access, overrides, reconciliation, and restrictions</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-100 transition-all">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                </button>
            </div>

            {/* Authentication */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Key size={12} /> Authentication
                </h3>
                <ToggleRow label="Require PIN for POS Login" desc="Users must enter their PIN to access any register" field="requirePinForLogin" />
                <ToggleRow label="Allow Cashier Switching" desc="Allow switching between cashiers without closing the register" field="allowCashierSwitch" />
                <NumberRow label="Auto-Lock After Idle" desc="Lock the register after this many minutes of inactivity" field="autoLockIdleMinutes" suffix="min" />
            </div>

            {/* Manager Overrides */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Shield size={12} /> Manager Overrides Required
                </h3>
                <ToggleRow label="Void / Cancel Order" desc="Require manager PIN to void a completed order" field="requireManagerForVoid" />
                <ToggleRow label="Apply Discount" desc="Require manager PIN to apply any manual discount" field="requireManagerForDiscount" />
                <ToggleRow label="Price Override" desc="Require manager PIN to change a product's price downward" field="requireManagerForPriceOverride" />
                <ToggleRow label="Process Refund" desc="Require manager PIN to process a refund" field="requireManagerForRefund" />
                <ToggleRow label="Clear Cart" desc="Require manager PIN to clear the entire cart" field="requireManagerForClearCart" />
                <ToggleRow label="Delete Item" desc="Require manager PIN to remove an item from the cart" field="requireManagerForDeleteItem" />
                <ToggleRow label="Decrease Quantity" desc="Require manager PIN to decrease any product's quantity" field="requireManagerForDecreaseQty" />
                <NumberRow label="Max Discount Without Approval" desc="Cashiers can apply up to this discount % without manager PIN" field="maxDiscountPercent" suffix="%" />
            </div>

            {/* Register Close Rules */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Monitor size={12} /> Register Open / Close Rules
                </h3>
                <ToggleRow label="Lock Register on Close" desc="Prevent access after closing until reopened" field="lockRegisterOnClose" />
                <ToggleRow label="Print Receipt on Register Close" desc="Auto-print a Z-report summary when closing the register" field="printReceiptOnClose" />
                <ToggleRow label="Require Cash Count on Close" desc="Cashier must count and enter physical cash when closing" field="requireCountOnClose" />
                <ToggleRow label="Allow Negative Stock Sales" desc="Allow selling products even if stock is 0 or negative" field="allowNegativeStock" />
            </div>

            {/* Reconciliation Strategy */}
            <div className="bg-white rounded-2xl border border-violet-100 p-5 shadow-sm">
                <h3 className="text-xs font-black text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Settings2 size={12} /> Reconciliation Strategy
                </h3>
                <div className="bg-violet-50 rounded-xl p-3 mb-3 text-xs text-violet-700 font-medium space-y-1">
                    <p className="font-black text-violet-800">How closing reconciliation works:</p>
                    <p>1. <b>Controlled accounts</b> (Wave, Orange, Bank) → provider statement is truth</p>
                    <p>2. Any difference between software & statement → <b>calibrated to cash</b> (cashier used wrong payment method)</p>
                    <p>3. After calibration, cash in hand + address book balance = expected cash software</p>
                    <p>4. <b>Excess cash</b> → auto-transferred to reserve account + notified</p>
                    <p>5. <b>Missing cash</b> → auto-deducted from cashier account</p>
                </div>
                <ToggleRow label="Enable Reconciliation on Close" desc="Run the full reconciliation workflow when closing a register" field="enableReconciliation" />
                <ToggleRow label="Controlled Accounts = Truth" desc="Wave, Orange Money, Bank statements are always correct. Any difference is calibrated." field="controlledAccountsAreTruth" />
                <ToggleRow label="Auto-Calibrate Differences to Cash" desc="When controlled account has a mismatch, auto-adjust the cash account" field="autoCalibrateToClose" />
                <ToggleRow label="Require Statement Entry on Close" desc="Cashier must enter real amounts from provider statements for each controlled account" field="requireStatementOnClose" />
                <ToggleRow label="Enable Account Book" desc="Allow cashiers to log transactions in the Account Book (Livre de Caisse) — requires manager approval" field="enableAccountBook" />
                <ToggleRow label="Auto-Transfer Excess to Reserve" desc="If more cash in hand than expected, transfer surplus to the reserve account" field="autoTransferExcessToReserve" />
                <ToggleRow label="Auto-Deduct Shortage from Cashier" desc="If less cash in hand, deduct the difference from the cashier's personal account" field="autoDeductShortageFromCashier" />
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 5: DELIVERY & SMS
// ═══════════════════════════════════════════════════════════════════
const SMS_PROVIDERS = [
    {
        key: 'none',
        label: 'Disabled',
        desc: 'No SMS — code shown on receipt only',
        icon: X,
        color: 'text-gray-400',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        active: 'border-gray-400 bg-gray-100',
        fields: [],
    },
    {
        key: 'twilio',
        label: 'Twilio',
        desc: 'Global coverage, most reliable',
        icon: Phone,
        color: 'text-rose-500',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        active: 'border-rose-400 bg-rose-50 ring-2 ring-rose-100',
        fields: [
            { key: 'sms_account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: false },
            { key: 'sms_api_key', label: 'Auth Token', placeholder: 'Your Twilio auth token', secret: true },
            { key: 'sms_sender_id', label: 'From Number', placeholder: '+1234567890', secret: false },
        ],
    },
    {
        key: 'africas_talking',
        label: "Africa's Talking",
        desc: 'Best for West & East Africa (CI, SN, GH, KE...)',
        icon: Globe,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        active: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100',
        fields: [
            { key: 'sms_account_sid', label: 'Username', placeholder: 'Your AT username (or sandbox)', secret: false },
            { key: 'sms_api_key', label: 'API Key', placeholder: 'Your Africa\'s Talking API key', secret: true },
            { key: 'sms_sender_id', label: 'Sender ID (optional)', placeholder: 'Shortcode or alpha sender', secret: false },
        ],
    },
    {
        key: 'infobip',
        label: 'Infobip',
        desc: 'Enterprise — Europe, MENA, global',
        icon: Zap,
        color: 'text-pink-500',
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        active: 'border-pink-400 bg-pink-50 ring-2 ring-pink-100',
        fields: [
            { key: 'sms_api_key', label: 'API Key', placeholder: 'Your Infobip API key', secret: true },
            { key: 'sms_webhook_url', label: 'Base URL', placeholder: 'https://xxxxx.api.infobip.com', secret: false },
            { key: 'sms_sender_id', label: 'Sender Name', placeholder: 'MYSHOP', secret: false },
        ],
    },
    {
        key: 'webhook',
        label: 'Custom Webhook',
        desc: 'Bring your own SMS API — any provider',
        icon: Globe,
        color: 'text-indigo-500',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        active: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100',
        fields: [
            { key: 'sms_webhook_url', label: 'Webhook URL', placeholder: 'https://your-sms-provider.com/send', secret: false },
            { key: 'sms_api_key', label: 'Bearer Token (optional)', placeholder: 'Authorization token', secret: true },
        ],
    },
];

function DeliveryTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    const [settings, setSettings] = useState({
        // Codes
        require_driver_pos_code: false,
        require_client_delivery_code: false,
        // SMS
        sms_delivery_code_enabled: false,
        sms_provider: 'none',
        sms_account_sid: '',
        sms_api_key: '',
        sms_sender_id: '',
        sms_webhook_url: '',
        // Loyalty
        loyalty_point_value: 1,
        loyalty_earn_rate: 10,
    });

    const load = async () => {
        try {
            const data = await erpFetch('pos/pos-settings/');
            if (data && typeof data === 'object') {
                setSettings(s => ({ ...s, ...data }));
            }
        } catch { /* first setup — no settings yet */ }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const set = (k: string, v: any) => setSettings(s => ({ ...s, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await erpFetch('pos/pos-settings/', {
                method: 'PATCH',
                body: JSON.stringify(settings),
            });
            toast.success('Delivery & SMS settings saved ✓');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        }
        setSaving(false);
    };

    const handleTestSMS = async () => {
        if (!testPhone) { toast.error('Enter a phone number to test'); return; }
        setTesting(true);
        try {
            await erpFetch('pos/pos-settings/test_sms/', {
                method: 'POST',
                body: JSON.stringify({ phone: testPhone }),
            });
            toast.success(`Test SMS sent to ${testPhone}`);
        } catch (e: any) {
            toast.error(e?.message || 'SMS test failed — check your credentials');
        }
        setTesting(false);
    };

    const activeProvider = SMS_PROVIDERS.find(p => p.key === settings.sms_provider) ?? SMS_PROVIDERS[0];

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── Section 1: Confirmation Codes ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Hash size={15} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-white text-sm font-black">Confirmation Codes</h2>
                            <p className="text-white/40 text-[10px]">Chain-of-custody protection for deliveries</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {/* Code 1 */}
                    <div className={clsx(
                        "flex items-start justify-between gap-4 p-4 rounded-2xl border-2 transition-all",
                        settings.require_driver_pos_code ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-gray-50"
                    )}>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <span className="text-[9px] font-black text-indigo-600">1</span>
                                </div>
                                <p className="text-sm font-black text-gray-900">Register ↔ Driver Code</p>
                            </div>
                            <p className="text-xs text-gray-500 ml-7">
                                A code is generated at order creation and shown on the <b>driver\'s mobile page</b>.
                                When the driver returns with cash, the cashier must enter this code before logging the cash return.
                                Protects the driver — cashier cannot register a payment without driver\'s code.
                            </p>
                        </div>
                        <button
                            onClick={() => set('require_driver_pos_code', !settings.require_driver_pos_code)}
                            className="shrink-0 mt-0.5"
                        >
                            {settings.require_driver_pos_code
                                ? <ToggleRight size={32} className="text-indigo-500" />
                                : <ToggleLeft size={32} className="text-gray-300" />}
                        </button>
                    </div>

                    {/* Code 2 */}
                    <div className={clsx(
                        "flex items-start justify-between gap-4 p-4 rounded-2xl border-2 transition-all",
                        settings.require_client_delivery_code ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"
                    )}>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                                    <span className="text-[9px] font-black text-amber-600">2</span>
                                </div>
                                <p className="text-sm font-black text-gray-900">Driver ↔ Client Code</p>
                            </div>
                            <p className="text-xs text-gray-500 ml-7">
                                A code is generated at order creation and <b>given to the client</b> (printed on receipt or sent via SMS).
                                The driver must ask the client for this code and enter it on their mobile page to mark the delivery as completed.
                                Protects the client — driver cannot fake a delivery without physically being there.
                            </p>
                        </div>
                        <button
                            onClick={() => set('require_client_delivery_code', !settings.require_client_delivery_code)}
                            className="shrink-0 mt-0.5"
                        >
                            {settings.require_client_delivery_code
                                ? <ToggleRight size={32} className="text-amber-500" />
                                : <ToggleLeft size={32} className="text-gray-300" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Section 2: SMS Provider ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-700 to-teal-800 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                                <MessageSquare size={15} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-white text-sm font-black">SMS Gateway</h2>
                                <p className="text-white/50 text-[10px]">Auto-send confirmation codes to clients</p>
                            </div>
                        </div>
                        {/* Master SMS toggle */}
                        <button
                            onClick={() => set('sms_delivery_code_enabled', !settings.sms_delivery_code_enabled)}
                            className="flex items-center gap-2"
                        >
                            {settings.sms_delivery_code_enabled
                                ? <ToggleRight size={28} className="text-emerald-300" />
                                : <ToggleLeft size={28} className="text-white/30" />}
                            <span className="text-white/70 text-xs font-bold">
                                {settings.sms_delivery_code_enabled ? 'On' : 'Off'}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-5">
                    {/* Provider selector */}
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Select Provider</p>
                        <div className="grid grid-cols-5 gap-2">
                            {SMS_PROVIDERS.map(p => {
                                const Icon = p.icon;
                                const isActive = settings.sms_provider === p.key;
                                return (
                                    <button
                                        key={p.key}
                                        onClick={() => set('sms_provider', p.key)}
                                        className={clsx(
                                            "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center",
                                            isActive ? p.active : `${p.border} ${p.bg} hover:opacity-80`
                                        )}
                                    >
                                        <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center", isActive ? 'bg-white/70' : 'bg-white')}>
                                            <Icon size={16} className={p.color} />
                                        </div>
                                        <span className={clsx("text-[10px] font-black leading-tight", isActive ? 'text-gray-900' : 'text-gray-500')}>
                                            {p.label}
                                        </span>
                                        {isActive && <Check size={10} className="text-emerald-500" />}
                                    </button>
                                );
                            })}
                        </div>
                        {activeProvider.key !== 'none' && (
                            <p className="text-xs text-gray-400 mt-2">{activeProvider.desc}</p>
                        )}
                    </div>

                    {/* Dynamic credential fields */}
                    {activeProvider.fields.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Credentials</p>
                            {activeProvider.fields.map(f => {
                                const isSecret = f.secret;
                                const shown = showSecrets[f.key];
                                return (
                                    <div key={f.key}>
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                                            {f.label}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={isSecret && !shown ? 'password' : 'text'}
                                                value={(settings as any)[f.key] || ''}
                                                onChange={e => set(f.key, e.target.value)}
                                                placeholder={f.placeholder}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 pr-10 placeholder:text-gray-300"
                                            />
                                            {isSecret && (
                                                <button
                                                    onClick={() => setShowSecrets(s => ({ ...s, [f.key]: !s[f.key] }))}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Test SMS */}
                    {settings.sms_delivery_code_enabled && activeProvider.key !== 'none' && (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                <TestTube size={10} className="inline mr-1" /> Test SMS
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="tel"
                                    value={testPhone}
                                    onChange={e => setTestPhone(e.target.value)}
                                    placeholder="+2250701234567"
                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400"
                                />
                                <button
                                    onClick={handleTestSMS}
                                    disabled={testing || !testPhone}
                                    className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-black hover:bg-indigo-600 disabled:opacity-40 transition-all flex items-center gap-1.5"
                                >
                                    {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
                                    Send Test
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1.5">Sends a sample confirmation code to verify your integration</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Loyalty Program ── */}
            <div className="p-6 rounded-3xl border border-amber-100 bg-amber-50/40 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                        ⭐
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-gray-900">Loyalty Program</h3>
                        <p className="text-[10px] text-gray-500">Configure how points are earned and what they are worth</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                            Point Value (monetary)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={(settings as any).loyalty_point_value}
                            onChange={e => set('loyalty_point_value', parseFloat(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-300"
                        />
                        <p className="text-[9px] text-gray-400 mt-1">Monetary value of 1 point (e.g. 500 = 1pt is worth 500 FCFA)</p>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                            Earn Rate (spend per point)
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={(settings as any).loyalty_earn_rate}
                            onChange={e => set('loyalty_earn_rate', parseFloat(e.target.value) || 10)}
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-300"
                        />
                        <p className="text-[9px] text-gray-400 mt-1">Currency spent to earn 1 point (e.g. 10000 = spend 10,000 to get 1pt)</p>
                    </div>
                </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-2xl text-sm font-black hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Delivery & SMS Settings
                </button>
            </div>
        </div>
    );
}
