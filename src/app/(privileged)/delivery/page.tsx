'use client';

/**
 * Delivery Hub — /delivery (Dajingo Pro redesign)
 *
 * Consolidates Delivery Zones, Drivers, and Shipping Rates under one
 * page with three tabs. Chrome conforms to design-language.md:
 *   - page-header-icon glow + text-lg md:text-xl black title
 *   - auto-fit KPI strip with theme tokens (no raw hex / Tailwind palette)
 *   - search bar with Ctrl+K
 *   - tab nav using theme tokens
 *   - modal pattern from §11
 *   - empty + loading states
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { erpFetch } from '@/lib/erp-api';
import { useCurrency } from '@/lib/utils/currency';
import {
    Truck, MapPin, Package, Plus, X, Search, RefreshCw,
    DollarSign, Clock, Edit2, Trash2, Check, User, Shield,
    Loader2, Eye, EyeOff, Zap, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import DriverProfileModal from './_components/DriverProfileModal';
import DriverDashboard from './_components/DriverDashboard';
import DriverStatement from './_components/DriverStatement';
import LogExpenseModal from './_components/LogExpenseModal';
import { ExternalDriversTab } from './_components/ExternalDriversTab';
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, PrimaryButton, StatusPill,
} from '@/modules/mcp/_design';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DeliveryZone {
    id: number; name: string; description?: string;
    base_fee: string; estimated_days: number; is_active: boolean;
}
interface ShippingRate {
    id: number; zone: number; zone_name?: string;
    min_order_value: string; max_order_value: string | null;
    min_weight_kg: string; max_weight_kg: string | null;
    fee: string; estimated_days: number | null;
    is_active: boolean; sort_order: number;
}
interface OrgUser {
    id: number; username: string; first_name: string; last_name: string;
    email: string; role: number | null; is_driver: boolean; is_active: boolean;
}
interface DriverProfile {
    id: number; user: number; user_name: string; full_name: string;
    status: 'ONLINE' | 'BUSY' | 'OFFLINE';
    vehicle_type: string; vehicle_plate: string; phone: string;
    commission_type: 'FLAT' | 'PERCENT'; commission_value: string;
    is_active_fleet: boolean; available_for_purchase?: boolean; available_for_sales?: boolean;
}
interface Role { id: number; name: string }

const fullName = (u: OrgUser) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
const initials = (u: OrgUser) => {
    const n = fullName(u);
    const p = n.split(' ');
    return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

type TabId = 'zones' | 'drivers' | 'external-drivers' | 'shipping';

const TABS: { id: TabId; label: string; icon: typeof MapPin }[] = [
    { id: 'zones',            label: 'Delivery Zones',     icon: MapPin },
    { id: 'drivers',          label: 'Drivers',            icon: Truck },
    // External drivers are one-off contractors (no User row, no commission).
    // They show up on the PO form when source = EXTERNAL; this tab is the
    // settings UI for managing the saved roster.
    { id: 'external-drivers', label: 'External Drivers',   icon: User },
    { id: 'shipping',         label: 'Shipping Rates',     icon: Package },
];

// Shared input class — used by all three tab forms. Conforms to §12.
const inputClass = 'w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary placeholder:text-app-muted-foreground transition-all';
const monoInputClass = inputClass.replace('font-bold', 'font-mono font-bold');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODAL SHELL — conforms to design-language §11
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Modal({
    icon, title, subtitle, onClose, children, size = 'md',
}: {
    icon: React.ReactNode
    title: string
    subtitle?: string
    onClose: () => void
    children: React.ReactNode
    size?: 'md' | 'lg' | 'xl'
}) {
    const maxW = size === 'xl' ? 'max-w-6xl' : size === 'lg' ? 'max-w-5xl' : 'max-w-lg';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={clsx('w-full mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col', maxW)}
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            {icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-app-foreground truncate">{title}</h3>
                            {subtitle && <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest truncate">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CREATE USER MODAL (for drivers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreateUserModal({ roles, onClose, onCreated }: {
    roles: Role[]; onClose: () => void; onCreated: (user: OrgUser) => void
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
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, role: form.role ? Number(form.role) : null }),
            });
            if (res?.id) {
                toast.success(`${fullName(res)} created`);
                onCreated(res); onClose();
            } else {
                toast.error(JSON.stringify(res) || 'Create failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Create failed');
        }
        setSaving(false);
    };

    return (
        <Modal icon={<User size={15} className="text-white" />} title="Create Driver / User" subtitle="Team member or driver" onClose={onClose}>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    <Field label="First Name *">
                        <input value={form.first_name} onChange={set('first_name')} placeholder="Adham"
                            className={clsx(inputClass, errors.first_name && 'border-app-error')} />
                    </Field>
                    <Field label="Last Name">
                        <input value={form.last_name} onChange={set('last_name')} placeholder="Chalhoub" className={inputClass} />
                    </Field>
                    <Field label="Username *">
                        <input value={form.username} onChange={set('username')} placeholder="adham.c" autoComplete="off"
                            className={clsx(inputClass, errors.username && 'border-app-error')} />
                    </Field>
                    <Field label="Email">
                        <input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" className={inputClass} />
                    </Field>
                </div>
                <Field label="Password *">
                    <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
                            placeholder="Min 6 characters" autoComplete="new-password"
                            className={clsx(inputClass, 'pr-9', errors.password && 'border-app-error')} />
                        <button type="button" onClick={() => setShowPassword(s => !s)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-app-border/50 text-app-muted-foreground transition-colors">
                            {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                    </div>
                </Field>
                <Field label="Role">
                    <select value={form.role} onChange={set('role')} className={inputClass}>
                        <option value="">— No specific role —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </Field>
                <button type="button" onClick={() => setForm(f => ({ ...f, is_driver: !f.is_driver }))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                    style={{
                        borderColor: form.is_driver ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 50%, transparent)' : 'var(--app-border)',
                        background: form.is_driver ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)' : 'var(--app-bg)',
                    }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: form.is_driver ? 'var(--app-warning, #f59e0b)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: form.is_driver ? 'white' : 'var(--app-muted-foreground)',
                        }}>
                        <Truck size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-black" style={{ color: form.is_driver ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)' }}>
                            Tag as Delivery Driver
                        </p>
                        <p className="text-[10px] text-app-muted-foreground font-medium mt-0.5">
                            {form.is_driver ? 'Will appear in POS delivery modal' : 'Enable to add as driver'}
                        </p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                            borderColor: form.is_driver ? 'var(--app-warning, #f59e0b)' : 'var(--app-border)',
                            background: form.is_driver ? 'var(--app-warning, #f59e0b)' : 'transparent',
                        }}>
                        {form.is_driver && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                </button>
                <div className="flex gap-2 pt-1 justify-end">
                    <GhostButton icon={<X size={13} />} label="Cancel" onClick={onClose} />
                    <PrimaryButton icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                        label={saving ? 'Creating…' : 'Create User'} onClick={handleSubmit as any} disabled={saving} />
                </div>
            </form>
        </Modal>
    );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{label}</label>
            {children}
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
            setEditing(null); onReload();
        } catch { toast.error('Save failed'); }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this zone?')) return;
        try {
            await erpFetch(`pos/delivery-zones/${id}/`, { method: 'DELETE' });
            toast.success('Zone deleted'); onReload();
        } catch { toast.error('Delete failed'); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-app-muted-foreground">
                    {zones.length} zone{zones.length !== 1 ? 's' : ''} configured
                </p>
                <PrimaryButton icon={<Plus size={13} />} label="Add Zone"
                    onClick={() => setEditing({ name: '', base_fee: '0', estimated_days: 1, is_active: true })} />
            </div>

            {loading ? (
                <Loading />
            ) : zones.length === 0 ? (
                <EmptyState icon={<MapPin size={36} />} title="No delivery zones yet"
                    description="Create your first zone to organise drivers and shipping rates."
                    action={<PrimaryButton icon={<Plus size={13} />} label="Create First Zone"
                        onClick={() => setEditing({ name: '', base_fee: '0', estimated_days: 1, is_active: true })} />} />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                    {zones.map(zone => (
                        <div key={zone.id} className="rounded-xl p-3 transition-all group"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-start justify-between mb-2 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                        <MapPin size={13} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-[13px] font-black text-app-foreground truncate">{zone.name}</h3>
                                        {zone.description && <p className="text-[10px] text-app-muted-foreground truncate">{zone.description}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={() => setEditing(zone)} title="Edit"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                                        <Edit2 size={12} />
                                    </button>
                                    <button onClick={() => handleDelete(zone.id)} title="Delete"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                        style={{ color: 'var(--app-error, #ef4444)' }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] flex-wrap">
                                <span className="flex items-center gap-1 font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>
                                    <DollarSign size={11} />{fmt(parseFloat(zone.base_fee))}
                                </span>
                                <span className="flex items-center gap-1 text-app-muted-foreground tabular-nums font-bold">
                                    <Clock size={11} />{zone.estimated_days}d
                                </span>
                                <StatusPill label={zone.is_active ? 'Active' : 'Inactive'}
                                    color={zone.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)'} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <Modal icon={<MapPin size={15} className="text-white" />}
                    title={editing.id ? 'Edit Zone' : 'New Zone'}
                    onClose={() => setEditing(null)}>
                    <div className="px-5 py-4 space-y-3">
                        <Field label="Zone Name *">
                            <input value={editing.name || ''}
                                onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
                                placeholder="e.g. Abidjan Centre" className={inputClass} />
                        </Field>
                        <Field label="Description">
                            <input value={editing.description || ''}
                                onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))}
                                placeholder="Optional description" className={inputClass} />
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                            <Field label="Base Fee">
                                <input type="number" step="0.01" value={editing.base_fee || ''}
                                    onChange={e => setEditing(p => ({ ...p!, base_fee: e.target.value }))} className={monoInputClass} />
                            </Field>
                            <Field label="Est. Days">
                                <input type="number" value={editing.estimated_days || ''}
                                    onChange={e => setEditing(p => ({ ...p!, estimated_days: parseInt(e.target.value) || 1 }))} className={monoInputClass} />
                            </Field>
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                            <GhostButton icon={<X size={13} />} label="Cancel" onClick={() => setEditing(null)} />
                            <PrimaryButton icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                                label={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DRIVERS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DriversTab({ users, drivers, roles, onReload, loading }: {
    users: OrgUser[]; drivers: DriverProfile[]; roles: Role[]; onReload: () => void; loading: boolean
}) {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [selectedUserForProfile, setSelectedUserForProfile] = useState<{ id: number; driver: DriverProfile | null } | null>(null);
    const [viewingStats, setViewingStats] = useState<{ driver: DriverProfile; stats: any; deliveries: any[] } | null>(null);
    const [viewingStatement, setViewingStatement] = useState<{ driver: DriverProfile; statement: any } | null>(null);
    const [loggingExpenseFor, setLoggingExpenseFor] = useState<DriverProfile | null>(null);
    const [loadingExtra, setLoadingExtra] = useState<number | null>(null);
    const [toggling, setToggling] = useState<number | null>(null);
    const [filter, setFilter] = useState<'all' | 'drivers'>('all');
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    const handleToggle = async (user: OrgUser) => {
        setToggling(user.id);
        try {
            const res = await erpFetch('pos-registers/toggle-driver/', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, is_driver: !user.is_driver }),
            });
            if (res?.user_id) { toast.success(res.message); onReload(); }
            else toast.error(res?.error || 'Toggle failed');
        } catch { toast.error('Failed to update'); }
        setToggling(null);
    };

    const handleViewStats = async (driver: DriverProfile) => {
        setLoadingExtra(driver.id);
        try {
            const [stats, deliveries] = await Promise.all([
                erpFetch(`pos/drivers/${driver.id}/stats/`),
                erpFetch(`pos/delivery-orders/?driver=${driver.user}&limit=10`),
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

    const kpis = [
        { label: 'Total Users',     value: users.length,  icon: <User size={14} />, color: 'var(--app-muted-foreground)' },
        { label: 'Tagged Drivers',  value: driverCount,   icon: <Truck size={14} />, color: 'var(--app-warning, #f59e0b)' },
        { label: 'Fleet Online',    value: onlineCount,   icon: <Zap size={14} />,   color: 'var(--app-success, #22c55e)' },
    ];

    return (
        <div className="space-y-3">
            <KPIStrip items={kpis} />

            <div className="flex gap-2 flex-wrap">
                <div className="flex-1 relative min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users… (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                </div>
                <div className="flex rounded-xl border border-app-border overflow-hidden">
                    {(['all', 'drivers'] as const).map(t => (
                        <button key={t} onClick={() => setFilter(t)}
                            className="text-[11px] font-bold px-3 py-1.5 transition-all"
                            style={{
                                background: filter === t ? 'var(--app-primary)' : 'transparent',
                                color: filter === t ? 'white' : 'var(--app-muted-foreground)',
                            }}>
                            {t === 'all' ? `All (${users.length})` : `Drivers (${driverCount})`}
                        </button>
                    ))}
                </div>
                <PrimaryButton icon={<Plus size={13} />} label="Add User" onClick={() => setShowCreate(true)} />
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}>
                <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="col-span-4">User</div>
                    <div className="col-span-3 hidden md:block">Email</div>
                    <div className="col-span-2">Connectivity</div>
                    <div className="col-span-2 hidden md:block">Vehicle</div>
                    <div className="col-span-1" />
                </div>
                {loading ? (
                    <Loading />
                ) : filtered.length === 0 ? (
                    <EmptyState icon={<User size={32} />} title={search ? 'No matching users' : 'No users found'} />
                ) : (
                    <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                        {filtered.map(user => (
                            <div key={user.id} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-app-surface transition-colors group">
                                <div className="col-span-4 flex items-center gap-2 min-w-0">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0"
                                        style={{
                                            background: user.is_driver ? 'var(--app-warning, #f59e0b)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                            color: user.is_driver ? 'white' : 'var(--app-muted-foreground)',
                                        }}>
                                        {user.is_driver ? <Truck size={13} /> : initials(user)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-bold text-app-foreground truncate">{fullName(user)}</p>
                                        <p className="text-[10px] text-app-muted-foreground font-mono">@{user.username}</p>
                                    </div>
                                </div>
                                <div className="col-span-3 hidden md:block text-[12px] text-app-muted-foreground truncate">{user.email || '—'}</div>
                                <div className="col-span-2">
                                    {user.is_driver ? (() => {
                                        const p = getProfile(user.id);
                                        if (!p) return <StatusPill label="No Profile" color="var(--app-warning, #f59e0b)" />;
                                        const c = p.status === 'ONLINE' ? 'var(--app-success, #22c55e)'
                                            : p.status === 'BUSY' ? 'var(--app-warning, #f59e0b)'
                                                : 'var(--app-muted-foreground)';
                                        return (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                                                style={{
                                                    background: `color-mix(in srgb, ${c} 12%, transparent)`,
                                                    color: c,
                                                    border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
                                                }}>
                                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c }} />
                                                {p.status}
                                            </span>
                                        );
                                    })() : (
                                        <StatusPill label={user.is_active ? 'Active' : 'Inactive'}
                                            color={user.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)'} />
                                    )}
                                </div>
                                <div className="col-span-2 hidden md:block">
                                    {user.is_driver ? (() => {
                                        const p = getProfile(user.id);
                                        if (!p) return <span className="text-app-muted-foreground text-[11px]">—</span>;
                                        return (
                                            <div className="min-w-0">
                                                <span className="text-[11px] font-bold text-app-foreground flex items-center gap-1 truncate">
                                                    <Truck size={10} className="text-app-primary flex-shrink-0" /> {p.vehicle_type}
                                                </span>
                                                <span className="text-[10px] font-mono text-app-muted-foreground truncate block">{p.vehicle_plate}</span>
                                            </div>
                                        );
                                    })() : <span className="text-app-muted-foreground text-[11px]">—</span>}
                                </div>
                                <div className="col-span-1 flex justify-end gap-0.5">
                                    {user.is_driver && (
                                        <button onClick={() => setSelectedUserForProfile({ id: user.id, driver: getProfile(user.id) || null })}
                                            title="Edit Driver Profile"
                                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                            <Edit2 size={12} />
                                        </button>
                                    )}
                                    <button onClick={() => handleToggle(user)} disabled={toggling === user.id}
                                        title={user.is_driver ? 'Remove Driver Tag' : 'Tag as Driver'}
                                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all border"
                                        style={{
                                            background: user.is_driver ? 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' : 'transparent',
                                            color: user.is_driver ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)',
                                            borderColor: user.is_driver ? 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' : 'var(--app-border)',
                                            opacity: toggling === user.id ? 0.5 : undefined,
                                        }}>
                                        {toggling === user.id ? <Loader2 size={11} className="animate-spin" /> : user.is_driver ? <X size={12} /> : <Truck size={12} />}
                                    </button>
                                    {user.is_driver && (() => {
                                        const p = getProfile(user.id);
                                        if (!p) return null;
                                        return (
                                            <>
                                                <button onClick={() => handleViewStats(p)} disabled={loadingExtra === p.id}
                                                    title="View Dashboard"
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                    {loadingExtra === p.id ? <Loader2 size={11} className="animate-spin" /> : <Eye size={12} />}
                                                </button>
                                                <button onClick={() => handleViewStatement(p)} disabled={loadingExtra === p.id}
                                                    title="Financial Statement"
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                                    {loadingExtra === p.id ? <Loader2 size={11} className="animate-spin" /> : <FileText size={12} />}
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
                <DriverProfileModal userId={selectedUserForProfile.id} driver={selectedUserForProfile.driver as any}
                    onClose={() => setSelectedUserForProfile(null)} onSaved={onReload} />
            )}
            {viewingStats && (
                <Modal icon={<Truck size={15} className="text-white" />} title="Performance Insight"
                    subtitle="Real-time driver analytics & tracking" onClose={() => setViewingStats(null)} size="xl">
                    <div className="p-5">
                        <DriverDashboard driver={viewingStats.driver} stats={viewingStats.stats} deliveries={viewingStats.deliveries} />
                    </div>
                </Modal>
            )}
            {viewingStatement && (
                <Modal icon={<FileText size={15} className="text-white" />} title="Financial Statement"
                    subtitle="Verified ledger history & payouts" onClose={() => setViewingStatement(null)} size="lg">
                    <div className="p-5">
                        <DriverStatement entries={viewingStatement.statement?.entries || []}
                            balance={viewingStatement.statement?.balance || '0.00'}
                            driverName={viewingStatement.driver.full_name}
                            onLogExpense={() => setLoggingExpenseFor(viewingStatement.driver)} />
                    </div>
                </Modal>
            )}
            {loggingExpenseFor && (
                <LogExpenseModal driverId={loggingExpenseFor.id} driverName={loggingExpenseFor.full_name}
                    onClose={() => setLoggingExpenseFor(null)}
                    onSaved={() => { if (viewingStatement?.driver.id === loggingExpenseFor.id) handleViewStatement(loggingExpenseFor); }} />
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
                zone: form.zone, fee: form.fee,
                min_order_value: form.min_order_value || '0',
                max_order_value: form.max_order_value || null,
                min_weight_kg: form.min_weight_kg || '0',
                max_weight_kg: form.max_weight_kg || null,
            };
            const res = await erpFetch('client-portal/shipping-rates/', { method: 'POST', body: JSON.stringify(payload) });
            if (res?.id) { toast.success('Rate created'); setCreating(false); onReload(); }
            else toast.error(res?.detail || 'Create failed');
        } catch { toast.error('Create failed'); }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this shipping rate?')) return;
        try {
            await erpFetch(`client-portal/shipping-rates/${id}/`, { method: 'DELETE' });
            toast.success('Rate deleted'); onReload();
        } catch { toast.error('Delete failed'); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <select value={selectedZone || ''} onChange={e => setSelectedZone(e.target.value ? Number(e.target.value) : null)}
                    className={clsx(inputClass, 'flex-1 min-w-[200px]')}>
                    <option value="">All Zones ({rates.length} rates)</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name} ({rates.filter(r => r.zone === z.id).length} rates)</option>)}
                </select>
                <PrimaryButton icon={<Plus size={13} />} label="Add Rate"
                    onClick={() => { setCreating(true); setForm(f => ({ ...f, zone: zones[0]?.id || 0 })); }} />
            </div>

            {loading ? (
                <Loading />
            ) : filteredRates.length === 0 ? (
                <EmptyState icon={<Package size={36} />} title="No shipping rates configured"
                    description="Create rate tiers per zone for eCommerce and physical delivery." />
            ) : (
                Object.entries(ratesByZone).map(([zoneId, zoneRates]) => {
                    const zone = zones.find(z => z.id === Number(zoneId));
                    return (
                        <div key={zoneId} className="rounded-2xl overflow-hidden"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="px-3 py-2 flex items-center gap-2"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                <MapPin size={12} style={{ color: 'var(--app-info, #3b82f6)' }} />
                                <span className="text-[12px] font-black text-app-foreground">{zone?.name || `Zone #${zoneId}`}</span>
                                <span className="text-[10px] text-app-muted-foreground tabular-nums font-bold ml-auto">
                                    Base: {fmt(parseFloat(zone?.base_fee || '0'))}
                                </span>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                {zoneRates.map(rate => (
                                    <div key={rate.id} className="px-3 py-2.5 flex items-center gap-3 hover:bg-app-surface transition-colors group">
                                        <div className="flex-1 grid gap-2"
                                            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                                            <RateCell label="Order Range" value={
                                                `≥${fmt(parseFloat(rate.min_order_value))}${rate.max_order_value ? ` — <${fmt(parseFloat(rate.max_order_value))}` : ''}`
                                            } />
                                            <RateCell label="Weight" value={
                                                `${parseFloat(rate.min_weight_kg) > 0 ? `≥${rate.min_weight_kg}kg` : 'Any'}${rate.max_weight_kg ? ` — <${rate.max_weight_kg}kg` : ''}`
                                            } />
                                            <RateCell label="Fee" value={fmt(parseFloat(rate.fee))} valueColor="var(--app-success, #22c55e)" />
                                            <RateCell label="Est. Days" value={String(rate.estimated_days || zone?.estimated_days || '—')} />
                                        </div>
                                        <button onClick={() => handleDelete(rate.id)}
                                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}

            {creating && (
                <Modal icon={<Package size={15} className="text-white" />} title="New Shipping Rate" onClose={() => setCreating(false)}>
                    <div className="px-5 py-4 space-y-3">
                        <Field label="Zone *">
                            <select value={form.zone} onChange={e => setForm(f => ({ ...f, zone: Number(e.target.value) }))} className={inputClass}>
                                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                            </select>
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                            <Field label="Min Order Value">
                                <input type="number" step="0.01" value={form.min_order_value}
                                    onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))} className={monoInputClass} />
                            </Field>
                            <Field label="Max Order Value">
                                <input type="number" step="0.01" value={form.max_order_value}
                                    onChange={e => setForm(f => ({ ...f, max_order_value: e.target.value }))} className={monoInputClass} placeholder="∞" />
                            </Field>
                            <Field label="Min Weight (kg)">
                                <input type="number" step="0.001" value={form.min_weight_kg}
                                    onChange={e => setForm(f => ({ ...f, min_weight_kg: e.target.value }))} className={monoInputClass} />
                            </Field>
                            <Field label="Max Weight (kg)">
                                <input type="number" step="0.001" value={form.max_weight_kg}
                                    onChange={e => setForm(f => ({ ...f, max_weight_kg: e.target.value }))} className={monoInputClass} placeholder="∞" />
                            </Field>
                        </div>
                        <Field label="Fee *">
                            <input type="number" step="0.01" value={form.fee}
                                onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} className={monoInputClass} placeholder="0.00" />
                        </Field>
                        <div className="flex gap-2 justify-end pt-1">
                            <GhostButton icon={<X size={13} />} label="Cancel" onClick={() => setCreating(false)} />
                            <PrimaryButton icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                                label={saving ? 'Creating…' : 'Create Rate'} onClick={handleCreate} disabled={saving} />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function RateCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div className="min-w-0">
            <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">{label}</span>
            <p className="text-[12px] font-bold tabular-nums truncate" style={{ color: valueColor || 'var(--app-foreground)' }}>{value}</p>
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
                erpFetch('users/').catch(() => []),
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

    const driverCount = users.filter(u => u.is_driver).length;
    const onlineCount = drivers.filter(d => d.status === 'ONLINE').length;
    const avgFee = zones.length > 0 ? zones.reduce((s, z) => s + parseFloat(z.base_fee), 0) / zones.length : 0;

    const kpis = [
        { label: 'Zones',          value: zones.length,        icon: <MapPin size={14} />,    color: 'var(--app-info, #3b82f6)' },
        { label: 'Active Drivers', value: driverCount,         icon: <Truck size={14} />,     color: 'var(--app-warning, #f59e0b)' },
        { label: 'Fleet Online',   value: onlineCount,         icon: <Zap size={14} />,       color: 'var(--app-success, #22c55e)' },
        { label: 'Shipping Rates', value: rates.length,        icon: <Package size={14} />,   color: 'var(--app-primary)' },
        { label: 'Avg Base Fee',   value: avgFee.toFixed(0),   icon: <DollarSign size={14} />, color: '#8b5cf6' },
    ];

    return (
        <ModulePage>
            <PageHeader
                icon={<Truck size={20} className="text-white" />}
                title="Delivery Hub"
                subtitle={`${zones.length} zone${zones.length === 1 ? '' : 's'} · ${driverCount} driver${driverCount === 1 ? '' : 's'} · ${rates.length} rate${rates.length === 1 ? '' : 's'}`}
                actions={
                    <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
                        label="Refresh" onClick={loadAll} disabled={loading} />
                }
            />

            <KPIStrip items={kpis} />

            {/* Tab nav */}
            <div className="flex gap-0.5 p-1 mb-3 rounded-xl flex-shrink-0"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}>
                {TABS.map(tab => {
                    const active = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                            style={{
                                background: active ? 'var(--app-surface)' : 'transparent',
                                color: active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                boxShadow: active ? '0 2px 8px color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'none',
                            }}>
                            <tab.icon size={13} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {activeTab === 'zones'            && <ZonesTab zones={zones} onReload={loadAll} loading={loading} />}
                {activeTab === 'drivers'          && <DriversTab users={users} drivers={drivers} roles={roles} onReload={loadAll} loading={loading} />}
                {activeTab === 'external-drivers' && <ExternalDriversTab />}
                {activeTab === 'shipping'         && <ShippingTab zones={zones} rates={rates} onReload={loadAll} loading={loading} />}
            </div>
        </ModulePage>
    );
}
