'use client';

/**
 * Driver & User Management — /sales/drivers
 *
 * Redesigned in the /purchases page theme:
 * - White background, gray-100 borders, shadow-sm
 * - Emerald/amber accent colors
 * - rounded-2xl cards
 * - Bold headers, uppercase tracking-widest labels
 *
 * Features:
 * 1. List all org users with is_driver toggle
 * 2. Create new users with is_driver checkbox built-in
 * 3. KPI summary cards
 * 4. Search/filter
 */

import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import Link from 'next/link';
import {
 Truck, ArrowLeft, RefreshCw, Search, Plus, X,
 User, CheckCircle2, AlertCircle, Shield, Mail, Loader2, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

interface OrgUser {
 id: number;
 username: string;
 first_name: string;
 last_name: string;
 email: string;
 role: number | null;
 is_driver: boolean;
 is_active: boolean;
 registration_status?: string;
}

interface Role {
 id: number;
 name: string;
}

const fullName = (u: OrgUser) =>
 `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;

const initials = (u: OrgUser) => {
 const n = fullName(u);
 const parts = n.split(' ');
 return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

const DRIVER_COLORS = [
 'bg-app-primary-light text-app-success',
 'bg-app-info-bg text-app-info',
 'bg-purple-100 text-purple-700',
 'bg-app-warning-bg text-app-warning',
 'bg-rose-100 text-rose-700',
];

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({ roles, onClose, onCreated }: {
 roles: Role[];
 onClose: () => void;
 onCreated: (user: OrgUser) => void;
}) {
 const [form, setForm] = useState({
 first_name: '',
 last_name: '',
 email: '',
 username: '',
 password: '',
 role: '',
 is_driver: false,
 });
 const [showPassword, setShowPassword] = useState(false);
 const [saving, setSaving] = useState(false);
 const [errors, setErrors] = useState<Record<string, string>>({});

 const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
 setForm(f => ({ ...f, [k]: e.target.value }));

 const validate = () => {
 const errs: Record<string, string> = {};
 if (!form.first_name) errs.first_name = 'Required';
 if (!form.username) errs.username = 'Required';
 if (!form.password || form.password.length < 6) errs.password = 'Min 6 characters';
 return errs;
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const errs = validate();
 if (Object.keys(errs).length) { setErrors(errs); return; }
 setSaving(true);
 try {
 const payload = {
 ...form,
 role: form.role ? Number(form.role) : null,
 };
 const res = await erpFetch('erp/users/', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 if (res?.id) {
 toast.success(`${fullName(res)} created successfully`);
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

 return (
 <div className="fixed inset-0 z-50 bg-app-background/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
 <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
 {/* Header */}
 <div className="app-page flex items-center gap-4 px-6 pt-6 pb-4 border-b border-app-border">
 <div className="w-10 h-10 rounded-2xl bg-app-primary-light flex items-center justify-center">
 <User size={20} className="text-app-primary" />
 </div>
 <div className="flex-1">
 <h2 className="text-lg font-black text-app-foreground">Create New User</h2>
 <p className="text-xs text-app-muted-foreground">Add a team member or driver to your organization</p>
 </div>
 <button onClick={onClose} className="w-8 h-8 rounded-xl bg-app-surface-2 hover:bg-app-border text-app-muted-foreground flex items-center justify-center transition-all">
 <X size={14} />
 </button>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
 {/* Name row */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">First Name *</label>
 <input value={form.first_name} onChange={set('first_name')} placeholder="Adham"
 className={clsx("w-full px-3 py-2.5 border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all", errors.first_name ? 'border-rose-300 bg-rose-50' : 'border-app-border bg-app-background')}
 />
 {errors.first_name && <p className="text-rose-500 text-[10px] mt-0.5">{errors.first_name}</p>}
 </div>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Last Name</label>
 <input value={form.last_name} onChange={set('last_name')} placeholder="Chalhoub"
 className="w-full px-3 py-2.5 border border-app-border bg-app-background rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
 />
 </div>
 </div>

 {/* Username + Email */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Username *</label>
 <input value={form.username} onChange={set('username')} placeholder="adham.c" autoComplete="off"
 className={clsx("w-full px-3 py-2.5 border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all", errors.username ? 'border-rose-300 bg-rose-50' : 'border-app-border bg-app-background')}
 />
 {errors.username && <p className="text-rose-500 text-[10px] mt-0.5">{errors.username}</p>}
 </div>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Email</label>
 <div className="relative">
 <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input type="email" value={form.email} onChange={set('email')} placeholder="name@company.com"
 className="w-full pl-8 pr-3 py-2.5 border border-app-border bg-app-background rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
 />
 </div>
 </div>
 </div>

 {/* Password */}
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">Password *</label>
 <div className="relative">
 <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 6 characters" autoComplete="new-password"
 className={clsx("w-full px-3 py-2.5 pr-10 border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all", errors.password ? 'border-rose-300 bg-rose-50' : 'border-app-border bg-app-background')}
 />
 <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-muted-foreground">
 {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 {errors.password && <p className="text-rose-500 text-[10px] mt-0.5">{errors.password}</p>}
 </div>

 {/* Role */}
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-1">
 <Shield size={10} className="inline mr-1" />Role
 </label>
 <select value={form.role} onChange={set('role')}
 className="w-full px-3 py-2.5 border border-app-border bg-app-background rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all">
 <option value="">— No specific role —</option>
 {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
 </select>
 </div>

 {/* is_driver toggle — prominent */}
 <button
 type="button"
 onClick={() => setForm(f => ({ ...f, is_driver: !f.is_driver }))}
 className={clsx(
 "w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all text-left",
 form.is_driver
 ? "border-app-warning/30 bg-app-warning-bg/60"
 : "border-app-border bg-app-background hover:border-app-border"
 )}
 >
 <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
 form.is_driver ? "bg-app-warning text-app-foreground" : "bg-app-surface border border-app-border text-app-muted-foreground"
 )}>
 <Truck size={18} />
 </div>
 <div className="flex-1 min-w-0">
 <p className={clsx("font-black text-sm", form.is_driver ? "text-app-warning" : "text-app-muted-foreground")}>
 Tag as Delivery Driver
 </p>
 <p className={clsx("text-xs mt-0.5", form.is_driver ? "text-app-warning" : "text-app-muted-foreground")}>
 {form.is_driver
 ? "This user will appear in the POS delivery modal driver list"
 : "Enable to let this user appear as a driver in the POS delivery modal"}
 </p>
 </div>
 <div className={clsx(
 "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
 form.is_driver ? "border-app-warning bg-app-warning" : "border-app-border"
 )}>
 {form.is_driver && <CheckCircle2 size={12} className="text-app-foreground" strokeWidth={3} />}
 </div>
 </button>

 {/* Submit */}
 <div className="flex gap-3 pt-2">
 <button type="button" onClick={onClose}
 className="flex-1 py-3 border border-app-border rounded-2xl text-app-muted-foreground font-bold text-sm hover:bg-app-background transition-all">
 Cancel
 </button>
 <button type="submit" disabled={saving}
 className="flex-1 py-3 bg-app-primary hover:bg-app-success text-app-foreground rounded-2xl font-bold text-sm shadow-sm shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
 {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
 {saving ? 'Creating…' : 'Create User'}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DriverManagementPage() {
 const [users, setUsers] = useState<OrgUser[]>([]);
 const [roles, setRoles] = useState<Role[]>([]);
 const [loading, setLoading] = useState(true);
 const [toggling, setToggling] = useState<number | null>(null);
 const [search, setSearch] = useState('');
 const [showCreate, setShowCreate] = useState(false);
 const [tab, setTab] = useState<'all' | 'drivers'>('all');

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const [usersData, rolesData] = await Promise.all([
 erpFetch('erp/users/'),
 erpFetch('roles/').catch(() => []),
 ]);
 setUsers(Array.isArray(usersData) ? usersData : usersData?.results || []);
 setRoles(Array.isArray(rolesData) ? rolesData : rolesData?.results || []);
 } catch {
 toast.error('Failed to load users');
 }
 setLoading(false);
 }, []);

 useEffect(() => { load(); }, [load]);

 const handleToggle = async (user: OrgUser) => {
 setToggling(user.id);
 try {
 const res = await erpFetch('pos-registers/toggle-driver/', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ user_id: user.id, is_driver: !user.is_driver }),
 });
 if (res?.user_id) {
 setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_driver: !u.is_driver } : u));
 toast.success(res.message);
 } else {
 toast.error(res?.error || 'Toggle failed');
 }
 } catch {
 toast.error('Failed to update');
 }
 setToggling(null);
 };

 const filtered = users
 .filter(u => tab === 'drivers' ? u.is_driver : true)
 .filter(u => !search || fullName(u).toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

 const driverCount = users.filter(u => u.is_driver).length;
 const activeCount = users.filter(u => u.is_active).length;

 return (
 <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">

 {/* Header — mirrors /purchases style */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Car size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Sales</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Driver <span className="text-app-primary">Registry</span>
          </h1>
        </div>
      </div>
    </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {[
 { label: 'Total Users', value: users.length, icon: User, bg: 'bg-app-surface-2', color: 'text-app-muted-foreground', vcol: 'text-app-muted-foreground' },
 { label: 'Active Users', value: activeCount, icon: CheckCircle2, bg: 'bg-app-primary-light', color: 'text-app-primary', vcol: 'text-app-success' },
 { label: 'Tagged Drivers', value: driverCount, icon: Truck, bg: 'bg-app-warning-bg', color: 'text-app-warning', vcol: 'text-app-warning' },
 { label: 'Non-Drivers', value: users.length - driverCount, icon: Shield, bg: 'bg-app-info-bg', color: 'text-app-info', vcol: 'text-app-info' },
 ].map(stat => (
 <div key={stat.label} className="bg-app-surface p-5 rounded-2xl border border-app-border shadow-sm flex items-center gap-4 group">
 <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform", stat.bg)}>
 <stat.icon size={22} className={stat.color} />
 </div>
 <div>
 <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">{stat.label}</p>
 <p className={clsx("text-2xl font-black mt-0.5", stat.vcol)}>{loading ? '…' : stat.value}</p>
 </div>
 </div>
 ))}
 </div>

 {/* Info Banner */}
 <div className="bg-app-warning-bg border border-app-warning rounded-2xl px-5 py-4 flex items-start gap-4">
 <div className="w-8 h-8 rounded-xl bg-app-warning/20 flex items-center justify-center shrink-0">
 <Truck size={16} className="text-app-warning" />
 </div>
 <div>
 <p className="font-bold text-app-warning text-sm">Drivers appear in the POS Delivery Modal</p>
 <p className="text-app-warning/70 text-xs mt-0.5">
 Enable the <em>Driver</em> tag on any user — regardless of their role — and they will appear in the delivery driver selection in the POS terminal.
 You can tag users during creation or toggle the flag at any time.
 </p>
 </div>
 </div>

 {/* Search + Tabs */}
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Search by name or email…"
 className="w-full pl-10 pr-4 py-3 border border-app-border bg-app-surface rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-success transition-all shadow-sm"
 />
 </div>
 <div className="flex gap-1 bg-app-surface-2 p-1 rounded-2xl">
 {(['all', 'drivers'] as const).map(t => (
 <button key={t} onClick={() => setTab(t)}
 className={clsx("px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
 tab === t ? "bg-app-surface shadow-sm text-app-foreground" : "text-app-muted-foreground hover:text-app-muted-foreground"
 )}>
 {t === 'all' ? `All (${users.length})` : `Drivers (${driverCount})`}
 </button>
 ))}
 </div>
 </div>

 {/* User List */}
 <div className="bg-app-surface rounded-2xl border border-app-border shadow-sm overflow-hidden">
 {/* Table header */}
 <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-app-background border-b border-app-border">
 <div className="col-span-4 text-xs font-black text-app-muted-foreground uppercase tracking-wider">User</div>
 <div className="col-span-3 text-xs font-black text-app-muted-foreground uppercase tracking-wider">Email</div>
 <div className="col-span-2 text-xs font-black text-app-muted-foreground uppercase tracking-wider">Status</div>
 <div className="col-span-2 text-xs font-black text-app-muted-foreground uppercase tracking-wider">Driver Tag</div>
 <div className="col-span-1 text-xs font-black text-app-muted-foreground uppercase tracking-wider"></div>
 </div>

 {loading ? (
 <div className="flex flex-col items-center justify-center py-20 gap-3">
 <Loader2 size={24} className="animate-spin text-app-muted-foreground" />
 <p className="text-app-muted-foreground text-sm">Loading users…</p>
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 gap-3 text-app-muted-foreground">
 <User size={32} strokeWidth={1} />
 <p className="text-sm">No users found</p>
 <button onClick={() => setShowCreate(true)} className="text-app-primary text-sm font-bold hover:underline">+ Create first user</button>
 </div>
 ) : (
 <div className="divide-y divide-gray-50">
 {filtered.map((user, idx) => {
 const name = fullName(user);
 const colorIdx = idx % DRIVER_COLORS.length;
 const isLoading = toggling === user.id;
 return (
 <div key={user.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-app-surface-2/50 transition-colors group">
 {/* User info */}
 <div className="col-span-4 flex items-center gap-3 min-w-0">
 <div className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0",
 user.is_driver ? "bg-app-warning text-app-foreground" : DRIVER_COLORS[colorIdx]
 )}>
 {user.is_driver ? <Truck size={16} /> : initials(user)}
 </div>
 <div className="min-w-0">
 <p className="font-bold text-app-foreground text-sm truncate">{name}</p>
 <p className="text-xs text-app-muted-foreground font-mono truncate">@{user.username}</p>
 </div>
 </div>
 {/* Email */}
 <div className="col-span-3 min-w-0">
 <p className="text-sm text-app-muted-foreground truncate">{user.email || '—'}</p>
 </div>
 {/* Status */}
 <div className="col-span-2">
 <span className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold",
 user.is_active ? "bg-app-primary-light text-app-success" : "bg-app-surface-2 text-app-muted-foreground"
 )}>
 {user.is_active ? <CheckCircle2 size={10} strokeWidth={3} /> : <AlertCircle size={10} />}
 {user.is_active ? 'Active' : 'Inactive'}
 </span>
 </div>
 {/* Driver badge */}
 <div className="col-span-2">
 {user.is_driver ? (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-app-warning-bg text-app-warning border border-app-warning">
 <Truck size={10} /> Driver
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-app-muted-foreground">—</span>
 )}
 </div>
 {/* Toggle button */}
 <div className="col-span-1 flex justify-end">
 <button
 onClick={() => handleToggle(user)}
 disabled={!!isLoading}
 className={clsx(
 "opacity-0 group-hover:opacity-100 transition-all px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1",
 isLoading && "!opacity-60 cursor-not-allowed",
 user.is_driver
 ? "bg-app-warning-bg text-app-warning hover:bg-app-warning-bg border border-app-warning"
 : "bg-app-surface-2 text-app-muted-foreground hover:bg-app-warning-bg hover:text-app-warning hover:border-app-warning border border-app-border"
 )}
 >
 {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Truck size={10} />}
 {user.is_driver ? 'Remove' : 'Tag'}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Create User Modal */}
 {showCreate && (
 <CreateUserModal
 roles={roles}
 onClose={() => setShowCreate(false)}
 onCreated={(user) => setUsers(prev => [user, ...prev])}
 />
 )}
 </div>
 );
}
