'use client';
import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
    X, MapPin, Phone, User, Home, Truck, ChevronRight,
    ChevronLeft, Check, Loader2, Banknote, CreditCard, Clock,
    AlertTriangle, Package, UserPlus, ArrowRight, Building2,
    Shield, Hash
} from 'lucide-react';
import clsx from 'clsx';

type DeliveryZone = { id: number; name: string; base_fee: string | number };
type Driver = { id: number; username: string; first_name?: string; last_name?: string };

type DeliveryForm = {
    recipient_name: string;
    phone: string;
    address_line1: string;
    address_line2: string;
    city: string;
    zone: number | null;
    payment_mode: 'IMMEDIATE' | 'CREDIT' | 'HOLD';
    driver: number | null;
    notes: string;
    delivery_fee: number;
};

const STEPS = ['Delivery Info', 'Payment', 'Driver', 'Confirm'];

const PAYMENT_MODES = [
    {
        key: 'IMMEDIATE' as const,
        icon: Banknote,
        label: 'Pay at Delivery',
        desc: 'Driver collects full amount on the spot.',
        gradient: 'from-emerald-500 to-teal-600',
        ring: 'ring-emerald-200 border-emerald-400',
        badge: 'bg-emerald-100 text-emerald-700',
    },
    {
        key: 'HOLD' as const,
        icon: Clock,
        label: 'Hold Session',
        desc: 'Driver returns cash to POS. Session stays live.',
        gradient: 'from-amber-500 to-orange-500',
        ring: 'ring-amber-200 border-amber-400',
        badge: 'bg-amber-100 text-amber-700',
    },
    {
        key: 'CREDIT' as const,
        icon: CreditCard,
        label: 'Client Credit',
        desc: 'Added to client account. Requires credit authority.',
        gradient: 'from-indigo-500 to-violet-600',
        ring: 'ring-indigo-200 border-indigo-400',
        badge: 'bg-indigo-100 text-indigo-700',
    },
];

interface POSDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (deliveryData: DeliveryForm & { delivery_fee: number }) => Promise<void>;
    orderId?: number;
    orderTotal: number;
    currency: string;
    selectedClient?: {
        id?: number;
        name?: string;
        phone?: string;
        address?: string;
        city?: string;
    } | null;
    sessionId?: number | null;
    hasClientCredit?: boolean;
    preSelectedZoneName?: string | null; // Zone pre-selected from customer bar
}

// Walk-in customer IDs / names to detect "no client selected"
const isWalkIn = (client: POSDeliveryModalProps['selectedClient']) => {
    if (!client) return true;
    const name = (client.name || '').toLowerCase();
    return !client.id || client.id === 1 || name.includes('walk') || name.includes('counter');
};

export function POSDeliveryModal({
    isOpen, onClose, onConfirm,
    orderTotal, currency, selectedClient, sessionId, hasClientCredit,
    preSelectedZoneName
}: POSDeliveryModalProps) {
    const [step, setStep] = useState(0);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showGate, setShowGate] = useState(false);

    const [form, setForm] = useState<DeliveryForm>({
        recipient_name: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        zone: null,
        payment_mode: 'IMMEDIATE',
        driver: null,
        notes: '',
        delivery_fee: 0,
    });

    useEffect(() => {
        if (!isOpen) return;
        setStep(0);

        // Check if walk-in → show gate screen
        const noClient = isWalkIn(selectedClient);
        setShowGate(noClient);

        // Auto-fill from client
        setForm({
            recipient_name: selectedClient?.name || '',
            phone: selectedClient?.phone || '',
            address_line1: selectedClient?.address || '',
            address_line2: '',
            city: selectedClient?.city || '',
            zone: null,
            payment_mode: 'IMMEDIATE',
            driver: null,
            notes: '',
            delivery_fee: 0,
        });

        loadData();
    }, [isOpen, selectedClient]);

    async function loadData() {
        setLoading(true);
        try {
            const [zonesData, driversData] = await Promise.all([
                erpFetch('pos/delivery-zones/'),
                erpFetch('users/?is_driver=true&is_active=true').catch(() => []),
            ]);
            const zoneList: DeliveryZone[] = Array.isArray(zonesData) ? zonesData : zonesData?.results || [];
            setZones(zoneList);
            setDrivers(Array.isArray(driversData) ? driversData : driversData?.results || []);

            // Auto-select zone from customer bar if one was pre-selected
            if (preSelectedZoneName) {
                const match = zoneList.find(
                    z => z.name.toLowerCase() === preSelectedZoneName.toLowerCase()
                );
                if (match) {
                    setForm(f => ({ ...f, zone: match.id, delivery_fee: Number(match.base_fee) }));
                }
            }
        } catch { }
        setLoading(false);
    }

    const set = (k: keyof DeliveryForm, v: any) => setForm(f => ({ ...f, [k]: v }));
    const selectedZone = zones.find(z => z.id === form.zone);
    const deliveryFee = selectedZone ? Number(selectedZone.base_fee) : 0;
    const totalWithDelivery = orderTotal + deliveryFee;

    const fmt = (n: number) =>
        `${currency} ${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    const canNext = () => {
        if (step === 0) return form.recipient_name.trim() && form.phone.trim() && form.address_line1.trim();
        return true;
    };

    async function handleSubmit() {
        setSubmitting(true);
        try {
            await onConfirm({ ...form, delivery_fee: deliveryFee });
            onClose();
        } catch { }
        setSubmitting(false);
    }

    if (!isOpen) return null;

    // ─── Gate Screen: no real client selected ───
    if (showGate) {
        return (
            <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                    className="relative w-[420px] max-w-[95vw] bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-white/10"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative px-8 py-8">
                        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all">
                            <X size={14} />
                        </button>

                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mx-auto mb-5">
                            <Truck size={28} className="text-white" />
                        </div>

                        <h2 className="text-white text-xl font-black text-center mb-1">Client Required</h2>
                        <p className="text-white/50 text-sm text-center mb-7">
                            A delivery order needs a real client with a name, phone, and address. Please identify the client first.
                        </p>

                        <div className="space-y-3">
                            {/* Option A: proceed anyway with manual fill */}
                            <button
                                onClick={() => setShowGate(false)}
                                className="w-full flex items-center gap-4 p-4 bg-white/8 hover:bg-white/12 border border-white/10 hover:border-amber-400/40 rounded-2xl text-left transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/30 transition-all">
                                    <Hash size={18} className="text-amber-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-white text-sm font-bold">Fill info manually</p>
                                    <p className="text-white/40 text-xs">Enter recipient details for this delivery</p>
                                </div>
                                <ArrowRight size={16} className="text-white/20 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                            </button>

                            {/* Option B: go back and select client */}
                            <button
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-4 bg-white/8 hover:bg-white/12 border border-white/10 hover:border-emerald-400/40 rounded-2xl text-left transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 transition-all">
                                    <User size={18} className="text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-white text-sm font-bold">Select existing client</p>
                                    <p className="text-white/40 text-xs">Go back and choose a client from your CRM</p>
                                </div>
                                <ArrowRight size={16} className="text-white/20 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main Modal ───
    return (
        <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-[560px] max-w-[95vw] bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Premium Header ── */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-5 shrink-0">
                    {/* Glow */}
                    <div className="absolute top-0 right-0 w-40 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                <Truck size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-white text-base font-black tracking-tight">New Delivery Order</h2>
                                <p className="text-white/40 text-[11px]">Order: {fmt(orderTotal)}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Client banner if auto-filled */}
                    {selectedClient?.name && !isWalkIn(selectedClient) && (
                        <div className="mt-3 flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-3 py-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <span className="text-emerald-400 text-xs font-black">{selectedClient.name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-bold truncate">{selectedClient.name}</p>
                                {selectedClient.phone && <p className="text-white/40 text-[10px]">{selectedClient.phone}</p>}
                            </div>
                            <div className="flex items-center gap-1 text-emerald-400">
                                <Check size={10} />
                                <span className="text-[10px] font-bold">Auto-filled</span>
                            </div>
                        </div>
                    )}

                    {/* Step pills */}
                    <div className="mt-4 flex items-center gap-1.5">
                        {STEPS.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 flex-1">
                                <div className={clsx(
                                    "flex items-center gap-1.5 flex-1 px-2.5 py-1.5 rounded-xl transition-all",
                                    i === step ? "bg-amber-500/20 border border-amber-400/30" :
                                        i < step ? "bg-emerald-500/15 border border-emerald-400/20" :
                                            "bg-white/5 border border-white/5"
                                )}>
                                    <div className={clsx(
                                        "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 w-5 h-5",
                                        i < step ? "bg-emerald-500 text-white" :
                                            i === step ? "bg-amber-500 text-white" :
                                                "bg-white/10 text-white/30"
                                    )}>
                                        {i < step ? <Check size={8} /> : i + 1}
                                    </div>
                                    <span className={clsx("text-[10px] font-bold hidden sm:block truncate",
                                        i === step ? "text-amber-300" :
                                            i < step ? "text-emerald-300" : "text-white/25"
                                    )}>{s}</span>
                                </div>
                                {i < STEPS.length - 1 && <ChevronRight size={10} className="text-white/15 shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                            <Loader2 size={28} className="animate-spin mb-3" />
                            <span className="text-sm">Loading data...</span>
                        </div>
                    ) : step === 0 ? (
                        /* ─── Step 1: Delivery Info ─── */
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Recipient Name" icon={<User size={12} />} required>
                                    <Input value={form.recipient_name} onChange={v => set('recipient_name', v)} placeholder="Full name" />
                                </Field>
                                <Field label="Phone" icon={<Phone size={12} />} required>
                                    <Input value={form.phone} onChange={v => set('phone', v)} placeholder="+XXX XX XX XX" type="tel" />
                                </Field>
                            </div>
                            <Field label="Address Line 1" icon={<Home size={12} />} required>
                                <Input value={form.address_line1} onChange={v => set('address_line1', v)} placeholder="Street, building, apartment..." />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Address Line 2" icon={<Building2 size={12} />}>
                                    <Input value={form.address_line2} onChange={v => set('address_line2', v)} placeholder="Floor, landmark..." />
                                </Field>
                                <Field label="City">
                                    <Input value={form.city} onChange={v => set('city', v)} placeholder="City" />
                                </Field>
                            </div>

                            {/* Zone tiles */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                    <MapPin size={11} className="text-amber-500" /> Delivery Zone
                                </label>
                                {zones.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {zones.map(z => (
                                            <button key={z.id}
                                                onClick={() => { set('zone', z.id); set('delivery_fee', Number(z.base_fee)); }}
                                                className={clsx(
                                                    "flex items-center justify-between px-3.5 py-3 rounded-2xl border-2 text-left transition-all",
                                                    form.zone === z.id
                                                        ? "border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md shadow-amber-100"
                                                        : "border-gray-100 hover:border-amber-200 bg-gray-50"
                                                )}>
                                                <div>
                                                    <p className={clsx("text-sm font-bold", form.zone === z.id ? "text-amber-700" : "text-gray-700")}>{z.name}</p>
                                                    <p className="text-[10px] text-gray-400">+{fmt(Number(z.base_fee))}</p>
                                                </div>
                                                {form.zone === z.id && <Check size={14} className="text-amber-500" />}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                        <MapPin size={14} className="text-amber-400" />
                                        <p className="text-xs text-amber-600">
                                            No zones configured. <a href="/sales/delivery-zones" className="font-bold underline">Set them up →</a>
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Field label="Special Instructions">
                                <textarea
                                    value={form.notes}
                                    onChange={e => set('notes', e.target.value)}
                                    rows={2}
                                    placeholder="Landmarks, floor, access code..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 font-medium resize-none placeholder:text-gray-300"
                                />
                            </Field>
                        </div>

                    ) : step === 1 ? (
                        /* ─── Step 2: Payment ─── */
                        <div className="p-6 space-y-3">
                            <p className="text-xs text-gray-400 font-medium mb-1">How will this delivery be paid?</p>
                            {PAYMENT_MODES.map(m => {
                                const Icon = m.icon;
                                const blocked = m.key === 'CREDIT' && !hasClientCredit;
                                const active = form.payment_mode === m.key && !blocked;
                                return (
                                    <button key={m.key}
                                        disabled={blocked}
                                        onClick={() => set('payment_mode', m.key)}
                                        className={clsx(
                                            "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                                            blocked ? "opacity-40 cursor-not-allowed border-gray-100 bg-gray-50" :
                                                active ? `border-transparent ${m.ring} ring-2 bg-white shadow-lg` :
                                                    "border-gray-100 hover:border-gray-200 bg-white"
                                        )}>
                                        <div className={clsx(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-md",
                                            active ? m.gradient + " shadow-current/20 text-white" : "from-gray-100 to-gray-50 text-gray-400"
                                        )}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-gray-900">{m.label}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">{m.desc}</p>
                                            {blocked && <p className="text-[10px] text-rose-400 font-bold mt-0.5">No credit authority for this client</p>}
                                        </div>
                                        <div className={clsx(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                            active ? `bg-gradient-to-br ${m.gradient} border-transparent` : "border-gray-200"
                                        )}>
                                            {active && <Check size={9} className="text-white" />}
                                        </div>
                                    </button>
                                );
                            })}

                            {form.payment_mode === 'HOLD' && (
                                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                        <AlertTriangle size={14} className="text-amber-500" />
                                    </div>
                                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                                        The POS session stays <strong>open</strong> until the driver returns with cash and you confirm receipt. The register cannot close while there are pending holds.
                                    </p>
                                </div>
                            )}
                        </div>

                    ) : step === 2 ? (
                        /* ─── Step 3: Driver ─── */
                        <div className="p-6 space-y-2">
                            <p className="text-xs text-gray-400 font-medium mb-3">Assign a delivery driver (optional)</p>

                            <button onClick={() => set('driver', null)}
                                className={clsx("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all",
                                    form.driver === null ? "border-slate-800 bg-slate-50 shadow-md" : "border-gray-100 hover:border-gray-200 bg-white")}>
                                <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center", form.driver === null ? "bg-slate-800" : "bg-gray-100")}>
                                    <Truck size={15} className={form.driver === null ? "text-white" : "text-gray-400"} />
                                </div>
                                <span className={clsx("text-sm font-bold", form.driver === null ? "text-slate-800" : "text-gray-500")}>Assign later</span>
                                {form.driver === null && <Check size={14} className="text-emerald-500 ml-auto" />}
                            </button>

                            {drivers.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {drivers.map(d => {
                                        const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.username;
                                        const active = form.driver === d.id;
                                        return (
                                            <button key={d.id} onClick={() => set('driver', d.id)}
                                                className={clsx("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all",
                                                    active ? "border-amber-400 bg-amber-50 shadow-md shadow-amber-100" : "border-gray-100 hover:border-amber-200 bg-white")}>
                                                <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm",
                                                    active ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200" : "bg-gray-100 text-gray-500")}>
                                                    {name[0]?.toUpperCase()}
                                                </div>
                                                <span className={clsx("text-sm font-bold flex-1 text-left", active ? "text-amber-800" : "text-gray-700")}>{name}</span>
                                                {active && <Check size={14} className="text-amber-500" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    ) : (
                        /* ─── Step 4: Confirm ─── */
                        <div className="p-6 space-y-4">
                            {/* Summary card */}
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield size={14} className="text-amber-400" />
                                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Delivery Summary</span>
                                </div>
                                <div className="space-y-3">
                                    <Row label="Recipient" value={form.recipient_name} />
                                    <Row label="Phone" value={form.phone} />
                                    <Row label="Address" value={[form.address_line1, form.address_line2, form.city].filter(Boolean).join(', ')} />
                                    {selectedZone && <Row label="Zone" value={selectedZone.name} />}
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/40 text-xs">Payment</span>
                                        <span className={clsx("text-xs font-black px-2.5 py-1 rounded-lg",
                                            form.payment_mode === 'IMMEDIATE' ? "bg-emerald-500/20 text-emerald-300" :
                                                form.payment_mode === 'HOLD' ? "bg-amber-500/20 text-amber-300" :
                                                    "bg-indigo-500/20 text-indigo-300")}>
                                            {form.payment_mode === 'IMMEDIATE' ? 'Pay at delivery' :
                                                form.payment_mode === 'HOLD' ? 'Hold session' : 'Credit'}
                                        </span>
                                    </div>
                                    {form.driver !== null && (
                                        <Row label="Driver" value={
                                            (() => {
                                                const d = drivers.find(dr => dr.id === form.driver);
                                                return d ? [d.first_name, d.last_name].filter(Boolean).join(' ') || d.username : '—';
                                            })()
                                        } />
                                    )}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Order subtotal</span>
                                    <span className="font-bold text-gray-900">{fmt(orderTotal)}</span>
                                </div>
                                {deliveryFee > 0 && (
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Delivery fee ({selectedZone?.name})</span>
                                        <span className="font-bold text-amber-600">+ {fmt(deliveryFee)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-2 mt-1 border-t border-gray-200">
                                    <span className="text-base font-black text-gray-900">Total Due</span>
                                    <span className="text-base font-black text-emerald-600">{fmt(totalWithDelivery)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white shrink-0">
                    {step > 0 ? (
                        <button onClick={() => setStep(s => s - 1)}
                            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all">
                            <ChevronLeft size={14} /> Back
                        </button>
                    ) : <div />}

                    {step < STEPS.length - 1 ? (
                        <button onClick={() => setStep(s => s + 1)}
                            disabled={!canNext()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl text-sm font-black hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-200">
                            Next <ChevronRight size={14} />
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={submitting}
                            className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-sm font-black hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 transition-all shadow-lg shadow-emerald-200">
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                            Create Delivery
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ──
function Field({ label, icon, required, children }: { label: string; icon?: React.ReactNode; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                {icon} {label} {required && <span className="text-amber-500">*</span>}
            </label>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 font-medium placeholder:text-gray-300 transition-all"
        />
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <span className="text-white/40 text-xs shrink-0">{label}</span>
            <span className="text-white text-xs font-bold text-right">{value || '—'}</span>
        </div>
    );
}
