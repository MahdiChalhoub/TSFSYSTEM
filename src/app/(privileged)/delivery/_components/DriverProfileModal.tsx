'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
    X, User, Truck, Phone, Shield, Check,
    AlertCircle, Loader2, Save, CreditCard,
    Zap, Clock, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

interface Driver {
    id: number;
    user: number;
    user_name: string;
    full_name: string;
    status: 'ONLINE' | 'BUSY' | 'OFFLINE';
    vehicle_type: string;
    vehicle_plate: string;
    phone: string;
    commission_type: 'FLAT' | 'PERCENT';
    commission_value: string;
    is_active_fleet: boolean;
    /** Per-module visibility — drives `users/?driver_for=…` filtering on
     *  the PO and POS pickers. Defaults to true server-side. */
    available_for_purchase?: boolean;
    available_for_sales?: boolean;
}

interface DriverProfileModalProps {
    driver: Driver | null;
    userId: number;
    onClose: () => void;
    onSaved: () => void;
}

export default function DriverProfileModal({ driver, userId, onClose, onSaved }: DriverProfileModalProps) {
    const [form, setForm] = useState<Partial<Driver>>({
        user: userId,
        status: 'OFFLINE',
        vehicle_type: 'MOTORCYCLE',
        vehicle_plate: '',
        phone: '',
        commission_type: 'FLAT',
        commission_value: '0',
        is_active_fleet: true,
        available_for_purchase: true,
        available_for_sales: true,
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (driver) {
            setForm(driver);
        }
    }, [driver]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = driver ? 'PATCH' : 'POST';
            const url = driver ? `pos/drivers/${driver.id}/` : 'pos/drivers/';

            const res = await erpFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (res.id) {
                toast.success(driver ? 'Profile updated' : 'Driver profile created');
                onSaved();
                onClose();
            } else {
                toast.error('Failed to save profile');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = "w-full px-4 py-3 border border-app-border bg-app-background rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-app-primary/20 transition-all";

    return (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-app-surface rounded-[2.5rem] shadow-2xl w-full max-w-xl border border-app-border overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="relative h-32 bg-app-warning overflow-hidden">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-black/10 hover:bg-black/20 text-white flex items-center justify-center transition-all z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="absolute -bottom-12 left-8 flex items-end gap-6">
                        <div className="w-24 h-24 rounded-3xl bg-app-surface border-[6px] border-app-surface shadow-xl flex items-center justify-center text-app-warning">
                            <Truck size={40} />
                        </div>
                        <div className="mb-14">
                            <h2 className="text-2xl font-black text-white drop-shadow-sm">
                                {driver ? 'Driver Profile' : 'Initialize Profile'}
                            </h2>
                            <p className="text-white/80 text-sm font-medium">Fleet Management Module</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="px-8 pt-16 pb-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Vehicle Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-2">Vehicle Type</label>
                                <select
                                    value={form.vehicle_type}
                                    onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                                    className={inputClass}
                                >
                                    <option value="MOTORCYCLE">Motorcycle 🏍️</option>
                                    <option value="CAR">Car 🚗</option>
                                    <option value="VAN">Van 🚐</option>
                                    <option value="TRUCK">Truck 🚚</option>
                                    <option value="BICYCLE">Bicycle 🚲</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-2">License Plate</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground">
                                        <Shield size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        value={form.vehicle_plate}
                                        onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })}
                                        placeholder="ABC-1234"
                                        className={clsx(inputClass, "pl-11 uppercase font-mono tracking-widest")}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact & Status */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-2">Driver Phone</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground">
                                        <Phone size={16} />
                                    </div>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="+225 ..."
                                        className={clsx(inputClass, "pl-11")}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-2">Connectivity Status</label>
                                <div className="flex p-1 bg-app-background border border-app-border rounded-2xl gap-1">
                                    {(['ONLINE', 'BUSY', 'OFFLINE'] as const).map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setForm({ ...form, status: s })}
                                            className={clsx(
                                                "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                                                form.status === s
                                                    ? s === 'ONLINE' ? "bg-app-success text-white shadow-lg shadow-emerald-200"
                                                        : s === 'BUSY' ? "bg-app-warning text-white shadow-lg shadow-amber-200"
                                                            : "bg-app-muted-foreground text-white"
                                                    : "text-app-muted-foreground hover:bg-app-surface"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Commission Settings */}
                    <div className="bg-app-background/50 rounded-3xl border border-app-border p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
                                <CreditCard size={16} />
                            </div>
                            <h3 className="text-sm font-black text-app-foreground">Earnings & Commission</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Fee Strategy</label>
                                <select
                                    value={form.commission_type}
                                    onChange={(e) => setForm({ ...form, commission_type: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-bold"
                                >
                                    <option value="FLAT">Flat Fee per Delivery</option>
                                    <option value="PERCENT">Percentage of Delivery Fee</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Value</label>
                                <input
                                    type="number"
                                    value={form.commission_value}
                                    onChange={(e) => setForm({ ...form, commission_value: e.target.value })}
                                    className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Module availability ────────────────────────
                     *  Lets a tenant ring-fence a driver to one module.
                     *  Both default to true so the existing fleet keeps
                     *  showing up everywhere; flip off to remove this
                     *  driver from that module's picker without deleting
                     *  the row. */}
                    <div className="bg-app-background/50 rounded-3xl border border-app-border p-6 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-app-primary/10 flex items-center justify-center text-app-primary">
                                <Zap size={16} />
                            </div>
                            <h3 className="text-sm font-black text-app-foreground">Available For</h3>
                        </div>
                        <p className="text-xs text-app-muted-foreground -mt-1">
                            Controls which module pickers list this driver. Both on = visible everywhere.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-3 px-4 py-3 bg-app-surface border border-app-border rounded-2xl cursor-pointer hover:border-app-primary/40 transition-all">
                                <input type="checkbox"
                                    checked={form.available_for_sales !== false}
                                    onChange={e => setForm({ ...form, available_for_sales: e.target.checked })}
                                    className="w-4 h-4 accent-app-primary" />
                                <span className="text-xs font-bold text-app-foreground">Sales / POS</span>
                            </label>
                            <label className="flex items-center gap-3 px-4 py-3 bg-app-surface border border-app-border rounded-2xl cursor-pointer hover:border-app-primary/40 transition-all">
                                <input type="checkbox"
                                    checked={form.available_for_purchase !== false}
                                    onChange={e => setForm({ ...form, available_for_purchase: e.target.checked })}
                                    className="w-4 h-4 accent-app-primary" />
                                <span className="text-xs font-bold text-app-foreground">Purchases</span>
                            </label>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 border-2 border-app-border rounded-3xl font-black text-sm text-app-muted-foreground hover:bg-app-background transition-all"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-[2] py-4 bg-app-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-app-primary/25 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {saving ? 'SAVING...' : driver ? 'UPDATE PROFILE' : 'INITIALIZE DRIVER'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
