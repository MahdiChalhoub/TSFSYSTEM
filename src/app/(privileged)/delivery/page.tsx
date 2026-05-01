'use client';

/**
 * Unified Delivery Module — /delivery
 *
 * Consolidates:
 * - Delivery Zones (from /sales/delivery-zones)
 * - Drivers (from /sales/drivers)
 * - Shipping Rates (from /ecommerce/shipping)
 *
 * Single source of truth for all delivery configuration.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { erpFetch } from '@/lib/erp-api';
import { useCurrency } from '@/lib/utils/currency';
import {
    Truck, MapPin, Package, Plus, X, Search, RefreshCw,
    DollarSign, Clock, Edit2, Trash2, Check, User, Shield,
    CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Mail, Layers, Zap, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import DriverProfileModal from './_components/DriverProfileModal';
import DriverDashboard from './_components/DriverDashboard';
import DriverStatement from './_components/DriverStatement';
import LogExpenseModal from './_components/LogExpenseModal';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DeliveryZone {
    id: number;
    name: string;
    description?: string;
    base_fee: string;
    estimated_days: number;
    is_active: boolean;
}

interface ShippingRate {
    id: number;
    zone: number;
    zone_name?: string;
    min_order_value: string;
    max_order_value: string | null;
    min_weight_kg: string;
    max_weight_kg: string | null;
    fee: string;
    estimated_days: number | null;
    is_active: boolean;
    sort_order: number;
}

interface OrgUser {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    role: number | null;
    is_driver: boolean;
    is_active: boolean;
}

interface DriverProfile {
    id: number;
    user: number;
    user_name: string;
    full_name: string;
    status: 'ONLINE' | 'BUSY' | 'OFFLINE';
    vehicle_type: string;
    vehicle_license_plate: string;
    phone_number: string;
    commission_type: 'FLAT' | 'PERCENT';
    commission_value: string;
    is_active: boolean;
}

interface Role {
    id: number;
    name: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fullName = (u: OrgUser) =>
    `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;

const initials = (u: OrgUser) => {
    const n = fullName(u);
    const parts = n.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

type TabId = 'zones' | 'drivers' | 'shipping';

const TABS: { id: TabId; label: string; icon: typeof MapPin }[] = [
    { id: 'zones', label: 'Delivery Zones', icon: MapPin },
    { id: 'drivers', label: 'Drivers', icon: Truck },
    { id: 'shipping', label: 'Shipping Rates', icon: Package },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CREATE USER MODAL (for drivers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreateUserModal({ roles, onClose, onCreated }: {
    roles: Role[];
    onClose: () => void;
    onCreated: (user: OrgUser) => void;
}) {
    const [form, setForm] = useState({
        first_name: '', last_name: '', email: '', username: '', password: '', role: '', is_driver: true,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!form.first_name) errs.first_name = 'Required';
        if (!form.username) errs.username = 'Required';
        if (!form.password || form.password.length < 6) errs.password = 'Min 6 characters';
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSaving(true);
        try {
            const res = await erpFetch('erp/users/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, role: form.role ? Number(form.role) : null }),
            });
            if (res?.id) {
                toast.success(`${fullName(res)} created`);
                onCreated(res);
                onClose();
            } else {
                toast.error(JSON.stringify(res) || 'Create failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Create failed');
        }
        setSaving(false);
    };

    const inputClass = "w-full px-3 py-2.5 border border-app-border bg-app-background rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all";

    return (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-app-border">
                    <div className="w-10 h-10 rounded-2xl bg-app-primary/10 flex items-center justify-center">
                        <User size={20} className="text-app-primary" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-black text-app-foreground">Create Driver / User</h2>
                        <p className="text-xs text-app-muted-foreground">Add a team member or driver</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-app-surface-2 hover:bg-app-border text-app-muted-foreground flex items-center justify-center">
                        <X size={14} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">First Name *</label>
                            <input value={form.first_name} onChange={set('first_name')} placeholder="Adham"
                                className={clsx(inputClass, errors.first_name && 'border-app-error bg-app-error-bg')} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Last Name</label>
                            <input value={form.last_name} onChange={set('last_name')} placeholder="Chalhoub" className={inputClass} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Username *</label>
                            <input value={form.username} onChange={set('username')} placeholder="adham.c" autoComplete="off"
                                className={clsx(inputClass, errors.username && 'border-app-error bg-app-error-bg')} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Email</label>
                            <input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" className={inputClass} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Password *</label>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters" autoComplete="new-password"
                                className={clsx(inputClass, 'pr-10', errors.password && 'border-app-error bg-app-error-bg')} />
                            <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground">
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1"><Shield size={10} className="inline mr-1" />Role</label>
                        <select value={form.role} onChange={set('role')} className={inputClass}>
                            <option value="">— No specific role —</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, is_driver: !f.is_driver }))}
                        className={clsx("w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all text-left",
                            form.is_driver ? "border-app-warning bg-app-warning-bg/60" : "border-app-border bg-app-background")}>
                        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            form.is_driver ? "bg-app-warning text-white" : "bg-app-surface border border-app-border text-app-muted-foreground")}><Truck size={18} /></div>
                        <div className="flex-1">
                            <p className={clsx("font-black text-sm", form.is_driver ? "text-app-warning" : "text-app-muted-foreground")}>Tag as Delivery Driver</p>
                            <p className="text-xs text-app-muted-foreground mt-0.5">{form.is_driver ? "Will appear in POS delivery modal" : "Enable to add as driver"}</p>
                        </div>
                        <div className={clsx("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
                            form.is_driver ? "border-app-warning bg-app-warning" : "border-app-border")}>
                            {form.is_driver && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                    </button>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 border border-app-border rounded-2xl text-app-muted-foreground font-bold text-sm hover:bg-app-background">Cancel</button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-3 bg-app-primary text-white rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-60">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {saving ? 'Creating…' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ZONES TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ZonesTab({ zones, onReload, loading }: { zones: DeliveryZone[]; onReload: () => void; loading: boolean }) {
    const { fmt } = useCurrency();
    const [editing, setEditing] = useState<Partial<DeliveryZone> | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!editing?.name) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            const method = editing.id ? 'PATCH' : 'POST';
            const url = editing.id ? `pos/delivery-zones/${editing.id}/` : 'pos/delivery-zones/';
            await erpFetch(url, { method, body: JSON.stringify(editing) });
            toast.success(editing.id ? 'Zone updated' : 'Zone created');
            setEditing(null);
            onReload();
        } catch { toast.error('Save failed'); }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this zone?')) return;
        try {
            await erpFetch(`pos/delivery-zones/${id}/`, { method: 'DELETE' });
            toast.success('Zone deleted');
            onReload();
        } catch { toast.error('Delete failed'); }
    };

    const inputClass = "w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-primary/20";

    return (
        <div className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-app-muted-foreground font-medium">{zones.length} zone{zones.length !== 1 ? 's' : ''} configured</p>
                <button onClick={() => setEditing({ name: '', base_fee: '0', estimated_days: 1, is_active: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition-all">
                    <Plus size={14} /> Add Zone
                </button>
            </div>

            {/* Zone cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zones.map(zone => (
                    <div key={zone.id} className="bg-app-surface rounded-2xl border border-app-border p-4 hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <MapPin size={14} className="text-app-info" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-app-foreground text-sm">{zone.name}</h3>
                                    {zone.description && <p className="text-[10px] text-app-muted-foreground">{zone.description}</p>}
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditing(zone)} className="w-7 h-7 rounded-lg bg-app-surface-2 hover:bg-app-primary/10 flex items-center justify-center text-app-muted-foreground hover:text-app-primary">
                                    <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleDelete(zone.id)} className="w-7 h-7 rounded-lg bg-app-surface-2 hover:bg-app-error-bg flex items-center justify-center text-app-muted-foreground hover:text-app-error">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1 font-bold text-app-success"><DollarSign size={12} />{fmt(parseFloat(zone.base_fee))}</span>
                            <span className="flex items-center gap-1 text-app-muted-foreground"><Clock size={12} />{zone.estimated_days}d</span>
                            <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold", zone.is_active ? "bg-app-success-bg text-app-success" : "bg-app-error-bg text-app-error")}>
                                {zone.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                ))}
                {zones.length === 0 && !loading && (
                    <div className="col-span-full text-center py-16 text-app-muted-foreground">
                        <MapPin size={32} className="mx-auto mb-2" />
                        <p className="text-sm font-medium">No delivery zones yet</p>
                        <button onClick={() => setEditing({ name: '', base_fee: '0', estimated_days: 1, is_active: true })}
                            className="text-app-primary text-sm font-bold hover:underline mt-1">+ Create your first zone</button>
                    </div>
                )}
            </div>

            {/* Edit/Create modal */}
            {editing && (
                <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-lg text-app-foreground">{editing.id ? 'Edit Zone' : 'New Zone'}</h3>
                            <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-xl bg-app-surface-2 hover:bg-app-border flex items-center justify-center"><X size={14} /></button>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Zone Name *</label>
                            <input value={editing.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} className={inputClass} placeholder="e.g. Abidjan Centre" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Description</label>
                            <input value={editing.description || ''} onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))} className={inputClass} placeholder="Optional description" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Base Fee</label>
                                <input type="number" step="0.01" value={editing.base_fee || ''} onChange={e => setEditing(p => ({ ...p!, base_fee: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Est. Days</label>
                                <input type="number" value={editing.estimated_days || ''} onChange={e => setEditing(p => ({ ...p!, estimated_days: parseInt(e.target.value) || 1 }))} className={inputClass} />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setEditing(null)} className="flex-1 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-muted-foreground">Cancel</button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-2.5 bg-app-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DRIVERS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


function DriversTab({ users, drivers, roles, onReload, loading }: {
    users: OrgUser[];
    drivers: DriverProfile[];
    roles: Role[];
    onReload: () => void;
    loading: boolean
}) {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [selectedUserForProfile, setSelectedUserForProfile] = useState<{ id: number, driver: DriverProfile | null } | null>(null);
    const [viewingStats, setViewingStats] = useState<{ driver: DriverProfile, stats: any, deliveries: any[] } | null>(null);
    const [viewingStatement, setViewingStatement] = useState<{ driver: DriverProfile, statement: any } | null>(null);
    const [loggingExpenseFor, setLoggingExpenseFor] = useState<DriverProfile | null>(null);
    const [loadingExtra, setLoadingExtra] = useState<number | null>(null);
    const [toggling, setToggling] = useState<number | null>(null);
    const [filter, setFilter] = useState<'all' | 'drivers'>('all');

    const handleToggle = async (user: OrgUser) => {
        setToggling(user.id);
        try {
            const res = await erpFetch('pos-registers/toggle-driver/', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, is_driver: !user.is_driver }),
            });
            if (res?.user_id) {
                toast.success(res.message);

                // If we untagged a driver, maybe we should archive their profile? 
                // For now, just reload.
                onReload();
            } else {
                toast.error(res?.error || 'Toggle failed');
            }
        } catch { toast.error('Failed to update'); }
        setToggling(null);
    };

    const handleViewStats = async (driver: DriverProfile) => {
        setLoadingExtra(driver.id);
        try {
            const [stats, deliveries] = await Promise.all([
                erpFetch(`pos/drivers/${driver.id}/stats/`),
                erpFetch(`pos/delivery-orders/?driver=${driver.user}&limit=10`)
            ]);
            setViewingStats({ driver, stats, deliveries: deliveries?.results || deliveries || [] });
        } catch { toast.error('Failed to load stats'); }
        setLoadingExtra(null);
    };

    const handleViewStatement = async (driver: DriverProfile) => {
        setLoadingExtra(driver.id);
        try {
            const res = await erpFetch(`pos/drivers/${driver.id}/statement/`);
            setViewingStatement({ driver, statement: res });
        } catch { toast.error('Failed to load statement'); }
        setLoadingExtra(null);
    };

    const getProfile = (userId: number) => drivers.find(d => d.user === userId);

    const filtered = users
        .filter(u => filter === 'drivers' ? u.is_driver : true)
        .filter(u => !search || fullName(u).toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

    const driverCount = users.filter(u => u.is_driver).length;
    const onlineCount = drivers.filter(d => d.status === 'ONLINE').length;

    return (
        <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Users', value: users.length, color: 'text-app-muted-foreground', bg: 'bg-app-surface-2', icon: User },
                    { label: 'Tagged Drivers', value: driverCount, color: 'text-app-warning', bg: 'bg-app-warning-bg', icon: Truck },
                    { label: 'Fleet Online', value: onlineCount, color: 'text-app-success', bg: 'bg-app-success-bg', icon: Zap },
                ].map(s => (
                    <div key={s.label} className="bg-app-surface rounded-xl border border-app-border p-3 flex items-center gap-3">
                        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", s.bg)}>
                            <s.icon size={16} className={s.color} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">{s.label}</p>
                            <p className={clsx("text-xl font-black", s.color)}>{loading ? '…' : s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search + Filter + Add */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
                        className="w-full pl-9 pr-3 py-2.5 border border-app-border bg-app-surface rounded-xl text-sm outline-none focus:ring-2 focus:ring-app-primary/20" />
                </div>
                <div className="flex gap-1 bg-app-surface-2 p-1 rounded-xl">
                    {(['all', 'drivers'] as const).map(t => (
                        <button key={t} onClick={() => setFilter(t)}
                            className={clsx("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                                filter === t ? "bg-app-surface shadow-sm text-app-foreground" : "text-app-muted-foreground")}>
                            {t === 'all' ? `All (${users.length})` : `Drivers (${driverCount})`}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-app-primary text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90">
                    <Plus size={14} /> Add
                </button>
            </div>

            {/* User table */}
            <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-5 py-2.5 bg-app-background border-b border-app-border">
                    <div className="col-span-4 text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">User</div>
                    <div className="col-span-3 text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Email</div>
                    <div className="col-span-2 text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Connectivity</div>
                    <div className="col-span-2 text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Vehicle</div>
                    <div className="col-span-1"></div>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-app-muted-foreground" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-app-muted-foreground">
                        <User size={28} className="mx-auto mb-2" />
                        <p className="text-sm">No users found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {filtered.map(user => (
                            <div key={user.id} className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-app-surface-2/50 transition-colors group">
                                <div className="col-span-4 flex items-center gap-3 min-w-0">
                                    <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                                        user.is_driver ? "bg-app-warning text-white" : "bg-app-surface-2 text-app-muted-foreground")}>
                                        {user.is_driver ? <Truck size={14} /> : initials(user)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-app-foreground text-sm truncate">{fullName(user)}</p>
                                        <p className="text-[10px] text-app-muted-foreground font-mono">@{user.username}</p>
                                    </div>
                                </div>
                                <div className="col-span-3 text-sm text-app-muted-foreground truncate">{user.email || '—'}</div>
                                <div className="col-span-2">
                                    {user.is_driver ? (() => {
                                        const p = getProfile(user.id);
                                        if (!p) return <span className="text-[10px] font-bold text-app-warning italic">No Profile</span>;
                                        return (
                                            <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-tighter uppercase",
                                                p.status === 'ONLINE' ? "bg-app-success-bg text-app-success border border-app-success"
                                                    : p.status === 'BUSY' ? "bg-app-warning-bg text-app-warning border border-app-warning"
                                                        : "bg-app-surface-2 text-app-muted-foreground")}>
                                                <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse",
                                                    p.status === 'ONLINE' ? "bg-app-success" : p.status === 'BUSY' ? "bg-app-warning" : "bg-app-muted-foreground")} />
                                                {p.status}
                                            </span>
                                        );
                                    })() : (
                                        <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold",
                                            user.is_active ? "bg-app-success-bg text-app-success" : "bg-app-error-bg text-app-error")}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    {user.is_driver ? (() => {
                                        const p = getProfile(user.id);
                                        if (!p) return <span className="text-app-muted-foreground text-xs">—</span>;
                                        return (
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-app-foreground flex items-center gap-1">
                                                    <Truck size={10} className="text-app-primary" /> {p.vehicle_type}
                                                </span>
                                                <span className="text-[9px] font-mono text-app-muted-foreground">{p.vehicle_license_plate}</span>
                                            </div>
                                        );
                                    })() : <span className="text-app-muted-foreground text-xs">—</span>}
                                </div>
                                <div className="col-span-1 flex justify-end gap-1">
                                    {user.is_driver && (
                                        <button
                                            onClick={() => setSelectedUserForProfile({ id: user.id, driver: getProfile(user.id) || null })}
                                            className="w-8 h-8 rounded-lg bg-app-primary/10 flex items-center justify-center text-app-primary hover:bg-app-primary hover:text-white transition-all shadow-sm"
                                            title="Edit Driver Profile"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => handleToggle(user)} disabled={toggling === user.id}
                                        className={clsx("opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                            toggling === user.id && "!opacity-60",
                                            user.is_driver ? "bg-app-error-bg text-app-error border border-app-error" : "bg-app-surface-2 text-app-muted-foreground border border-app-border hover:border-app-warning")}
                                        title={user.is_driver ? "Remove Driver Tag" : "Tag as Driver"}
                                    >
                                        {toggling === user.id ? <Loader2 size={10} className="animate-spin" /> : user.is_driver ? <X size={14} /> : <Truck size={14} />}
                                    </button>
                                    {user.is_driver && (() => {
                                        const p = getProfile(user.id);
                                        if (!p) return null;
                                        return (
                                            <>
                                                <button
                                                    onClick={() => handleViewStats(p)}
                                                    disabled={loadingExtra === p.id}
                                                    className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-app-info hover:bg-app-info hover:text-white transition-all shadow-sm"
                                                    title="View Dashboard"
                                                >
                                                    {loadingExtra === p.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => handleViewStatement(p)}
                                                    disabled={loadingExtra === p.id}
                                                    className="w-8 h-8 rounded-lg bg-app-success/10 flex items-center justify-center text-app-success hover:bg-app-success hover:text-white transition-all shadow-sm"
                                                    title="Financial Statement"
                                                >
                                                    {loadingExtra === p.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={14} />}
                                                </button>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>


            {showCreate && <CreateUserModal roles={roles} onClose={() => setShowCreate(false)} onCreated={() => { onReload(); setShowCreate(false); }} />}

            {selectedUserForProfile && (
                <DriverProfileModal
                    userId={selectedUserForProfile.id}
                    driver={selectedUserForProfile.driver as any}
                    onClose={() => setSelectedUserForProfile(null)}
                    onSaved={onReload}
                />
            )}

            {/* Performance Dashboard Overlay */}
            {viewingStats && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-300">
                    <div className="bg-app-surface border border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between px-10 py-8 border-b border-white/5 bg-white/[0.02]">
                            <div>
                                <h2 className="text-2xl font-black text-white flex items-center gap-3 italic">
                                    <Truck className="w-8 h-8 text-app-info" />
                                    Performance <span className="text-app-info">Insight</span>
                                </h2>
                                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Real-time driver analytics & tracking</p>
                            </div>
                            <button onClick={() => setViewingStats(null)} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                            <DriverDashboard
                                driver={viewingStats.driver}
                                stats={viewingStats.stats}
                                deliveries={viewingStats.deliveries}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Financial Statement Overlay */}
            {viewingStatement && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-300">
                    <div className="bg-app-surface border border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between px-10 py-8 border-b border-white/5 bg-white/[0.02]">
                            <div>
                                <h2 className="text-2xl font-black text-white flex items-center gap-3 italic">
                                    <FileText className="w-8 h-8 text-app-success" />
                                    Financial <span className="text-app-success">Statement</span>
                                </h2>
                                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Verified Ledger History & Payouts</p>
                            </div>
                            <button onClick={() => setViewingStatement(null)} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                            <DriverStatement
                                entries={viewingStatement.statement?.entries || []}
                                balance={viewingStatement.statement?.balance || '0.00'}
                                driverName={viewingStatement.driver.full_name}
                                onLogExpense={() => setLoggingExpenseFor(viewingStatement.driver)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {loggingExpenseFor && (
                <LogExpenseModal
                    driverId={loggingExpenseFor.id}
                    driverName={loggingExpenseFor.full_name}
                    onClose={() => setLoggingExpenseFor(null)}
                    onSaved={() => {
                        if (viewingStatement?.driver.id === loggingExpenseFor.id) {
                            handleViewStatement(loggingExpenseFor);
                        }
                    }}
                />
            )}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHIPPING RATES TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ShippingTab({ zones, rates, onReload, loading }: { zones: DeliveryZone[]; rates: ShippingRate[]; onReload: () => void; loading: boolean }) {
    const { fmt } = useCurrency();
    const [selectedZone, setSelectedZone] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ zone: 0, fee: '', min_order_value: '0', max_order_value: '', min_weight_kg: '0', max_weight_kg: '' });
    const [saving, setSaving] = useState(false);

    const filteredRates = selectedZone ? rates.filter(r => r.zone === selectedZone) : rates;
    const ratesByZone = useMemo(() => {
        const map: Record<number, ShippingRate[]> = {};
        filteredRates.forEach(r => { (map[r.zone] = map[r.zone] || []).push(r); });
        return map;
    }, [filteredRates]);

    const handleCreate = async () => {
        if (!form.zone || !form.fee) { toast.error('Zone and fee are required'); return; }
        setSaving(true);
        try {
            const payload = {
                zone: form.zone,
                fee: form.fee,
                min_order_value: form.min_order_value || '0',
                max_order_value: form.max_order_value || null,
                min_weight_kg: form.min_weight_kg || '0',
                max_weight_kg: form.max_weight_kg || null,
            };
            const res = await erpFetch('client-portal/shipping-rates/', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (res?.id) {
                toast.success('Rate created');
                setCreating(false);
                onReload();
            } else {
                toast.error(res?.detail || 'Create failed');
            }
        } catch { toast.error('Create failed'); }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this shipping rate?')) return;
        try {
            await erpFetch(`client-portal/shipping-rates/${id}/`, { method: 'DELETE' });
            toast.success('Rate deleted');
            onReload();
        } catch { toast.error('Delete failed'); }
    };

    const inputClass = "w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-primary/20";

    return (
        <div className="space-y-4">
            {/* Zone filter + Add */}
            <div className="flex items-center gap-3">
                <select value={selectedZone || ''} onChange={e => setSelectedZone(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 bg-app-surface border border-app-border rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20">
                    <option value="">All Zones ({rates.length} rates)</option>
                    {zones.map(z => (
                        <option key={z.id} value={z.id}>{z.name} ({rates.filter(r => r.zone === z.id).length} rates)</option>
                    ))}
                </select>
                <button onClick={() => { setCreating(true); setForm(f => ({ ...f, zone: zones[0]?.id || 0 })); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-app-primary text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90">
                    <Plus size={14} /> Add Rate
                </button>
            </div>

            {/* Rates grouped by zone */}
            {Object.entries(ratesByZone).map(([zoneId, zoneRates]) => {
                const zone = zones.find(z => z.id === Number(zoneId));
                return (
                    <div key={zoneId} className="bg-app-surface rounded-2xl border border-app-border overflow-hidden">
                        <div className="px-4 py-3 bg-app-background border-b border-app-border flex items-center gap-2">
                            <MapPin size={14} className="text-app-info" />
                            <span className="font-bold text-sm text-app-foreground">{zone?.name || `Zone #${zoneId}`}</span>
                            <span className="text-[10px] text-app-muted-foreground ml-auto">Base: {fmt(parseFloat(zone?.base_fee || '0'))}</span>
                        </div>
                        <div className="divide-y divide-app-border/30">
                            {zoneRates.map(rate => (
                                <div key={rate.id} className="px-4 py-3 flex items-center gap-4 hover:bg-app-surface-2/50 transition-colors group">
                                    <div className="flex-1 grid grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-[9px] text-app-muted-foreground uppercase font-bold">Order Range</span>
                                            <p className="font-bold text-app-foreground">
                                                ≥{fmt(parseFloat(rate.min_order_value))}
                                                {rate.max_order_value && ` — <${fmt(parseFloat(rate.max_order_value))}`}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-app-muted-foreground uppercase font-bold">Weight</span>
                                            <p className="font-bold text-app-foreground">
                                                {parseFloat(rate.min_weight_kg) > 0 ? `≥${rate.min_weight_kg}kg` : 'Any'}
                                                {rate.max_weight_kg && ` — <${rate.max_weight_kg}kg`}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-app-muted-foreground uppercase font-bold">Fee</span>
                                            <p className="font-black text-app-success">{fmt(parseFloat(rate.fee))}</p>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-app-muted-foreground uppercase font-bold">Est. Days</span>
                                            <p className="font-bold text-app-foreground">{rate.estimated_days || zone?.estimated_days || '—'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(rate.id)}
                                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-app-surface-2 hover:bg-app-error-bg flex items-center justify-center text-app-muted-foreground hover:text-app-error transition-all">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {filteredRates.length === 0 && !loading && (
                <div className="text-center py-16 text-app-muted-foreground">
                    <Package size={32} className="mx-auto mb-2" />
                    <p className="text-sm font-medium">No shipping rates configured</p>
                    <p className="text-xs mt-1">Create rate tiers per zone for eCommerce and physical delivery</p>
                </div>
            )}

            {/* Create modal */}
            {creating && (
                <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-lg text-app-foreground">New Shipping Rate</h3>
                            <button onClick={() => setCreating(false)} className="w-8 h-8 rounded-xl bg-app-surface-2 hover:bg-app-border flex items-center justify-center"><X size={14} /></button>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Zone *</label>
                            <select value={form.zone} onChange={e => setForm(f => ({ ...f, zone: Number(e.target.value) }))} className={inputClass}>
                                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Min Order Value</label>
                                <input type="number" step="0.01" value={form.min_order_value} onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Max Order Value</label>
                                <input type="number" step="0.01" value={form.max_order_value} onChange={e => setForm(f => ({ ...f, max_order_value: e.target.value }))} className={inputClass} placeholder="∞" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Min Weight (kg)</label>
                                <input type="number" step="0.001" value={form.min_weight_kg} onChange={e => setForm(f => ({ ...f, min_weight_kg: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Max Weight (kg)</label>
                                <input type="number" step="0.001" value={form.max_weight_kg} onChange={e => setForm(f => ({ ...f, max_weight_kg: e.target.value }))} className={inputClass} placeholder="∞" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Fee *</label>
                            <input type="number" step="0.01" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} className={inputClass} placeholder="0.00" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setCreating(false)} className="flex-1 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-muted-foreground">Cancel</button>
                            <button onClick={handleCreate} disabled={saving}
                                className="flex-1 py-2.5 bg-app-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {saving ? 'Creating…' : 'Create Rate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DeliveryPage() {
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabId) || 'zones';
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);
    const [loading, setLoading] = useState(true);

    // Data
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [drivers, setDrivers] = useState<DriverProfile[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [rates, setRates] = useState<ShippingRate[]>([]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [zonesRes, usersRes, driversRes, rolesRes, ratesRes] = await Promise.all([
                erpFetch('pos/delivery-zones/').catch(() => []),
                erpFetch('erp/users/').catch(() => []),
                erpFetch('pos/drivers/').catch(() => []),
                erpFetch('roles/').catch(() => []),
                erpFetch('client-portal/shipping-rates/').catch(() => []),
            ]);
            setZones(Array.isArray(zonesRes) ? zonesRes : zonesRes?.results || []);
            setUsers(Array.isArray(usersRes) ? usersRes : usersRes?.results || []);
            setDrivers(Array.isArray(driversRes) ? driversRes : driversRes?.results || []);
            setRoles(Array.isArray(rolesRes) ? rolesRes : rolesRes?.results || []);
            setRates(Array.isArray(ratesRes) ? ratesRes : ratesRes?.results || []);
        } catch { toast.error('Failed to load delivery data'); }
        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-gradient-info shadow-lg shadow-blue-200/50">
                        <Truck size={32} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Operations</p>
                        <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                            Delivery <span className="text-transparent bg-clip-text bg-app-gradient-info">Hub</span>
                        </h1>
                        <p className="text-xs text-app-muted-foreground mt-0.5">Zones, drivers, and shipping rates — POS & eCommerce</p>
                    </div>
                </div>
                <button onClick={loadAll} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 border border-app-border rounded-xl text-sm font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </header>

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Zones', value: zones.length, icon: MapPin, color: 'text-app-info', bg: 'bg-app-info-bg' },
                    { label: 'Active Drivers', value: users.filter(u => u.is_driver).length, icon: Truck, color: 'text-app-warning', bg: 'bg-app-warning-bg' },
                    { label: 'Shipping Rates', value: rates.length, icon: Package, color: 'text-app-success', bg: 'bg-app-success-bg' },
                    { label: 'Avg Fee', value: zones.length > 0 ? (zones.reduce((s, z) => s + parseFloat(z.base_fee), 0) / zones.length).toFixed(0) : '0', icon: DollarSign, color: 'text-app-accent', bg: 'bg-app-accent-bg', prefix: '$' },
                ].map(k => (
                    <div key={k.label} className="bg-app-surface rounded-xl border border-app-border p-4 flex items-center gap-3 hover:shadow-sm transition-all">
                        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", k.bg)}>
                            <k.icon size={18} className={k.color} />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider">{k.label}</p>
                            <p className={clsx("text-xl font-black", k.color)}>{loading ? '…' : `${(k as any).prefix || ''}${k.value}`}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-app-surface-2 p-1.5 rounded-2xl">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={clsx("flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                            activeTab === tab.id
                                ? "bg-app-surface shadow-sm text-app-foreground"
                                : "text-app-muted-foreground hover:text-app-foreground")}>
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'zones' && <ZonesTab zones={zones} onReload={loadAll} loading={loading} />}
            {activeTab === 'drivers' && <DriversTab users={users} drivers={drivers} roles={roles} onReload={loadAll} loading={loading} />}
            {activeTab === 'shipping' && <ShippingTab zones={zones} rates={rates} onReload={loadAll} loading={loading} />}
        </div>
    );
}
