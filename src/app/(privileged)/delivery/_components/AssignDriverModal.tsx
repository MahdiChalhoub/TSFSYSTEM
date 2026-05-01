'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import {
    X, Truck, User, Search, MapPin,
    Check, Loader2, Zap, AlertCircle
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
    vehicle_license_plate: string;
    phone_number: string;
    is_active: boolean;
}

interface DeliveryOrder {
    id: number;
    order_ref: string;
    contact_name: string;
    address: string;
    status: string;
}

interface AssignDriverModalProps {
    order: DeliveryOrder;
    onClose: () => void;
    onAssigned: () => void;
}

export default function AssignDriverModal({ order, onClose, onAssigned }: AssignDriverModalProps) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [assigning, setAssigning] = useState<number | null>(null);

    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                // Fetch only ONLINE drivers for quick assignment
                const res = await erpFetch('pos/drivers/active/');
                setDrivers(Array.isArray(res) ? res : []);
            } catch {
                toast.error('Failed to load active drivers');
            } finally {
                setLoading(false);
            }
        };
        fetchDrivers();
    }, []);

    const handleAssign = async (driver: Driver) => {
        setAssigning(driver.id);
        try {
            const res = await erpFetch(`pos/deliveries/${order.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ driver: driver.user }), // DeliveryOrder uses User ID
            });

            if (res.id) {
                toast.success(`Assigned ${driver.full_name} to delivery`);
                onAssigned();
                onClose();
            } else {
                toast.error('Assignment failed');
            }
        } catch {
            toast.error('An error occurred');
        } finally {
            setAssigning(null);
        }
    };

    const filtered = drivers.filter(d =>
        d.full_name.toLowerCase().includes(search.toLowerCase()) ||
        d.user_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-app-surface rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-app-border overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-app-border">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-app-primary/10 flex items-center justify-center text-app-primary">
                                <Truck size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-app-foreground italic">Assign <span className="text-app-primary">Driver</span></h2>
                                <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Order: {order.order_ref}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-app-surface-2 hover:bg-app-border text-app-muted-foreground flex items-center justify-center transition-all">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="bg-app-background/50 rounded-2xl p-4 mt-6 border border-app-border">
                        <div className="flex items-start gap-3">
                            <MapPin size={16} className="text-app-success mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-app-foreground truncate max-w-[300px]">{order.address}</p>
                                <p className="text-[10px] text-app-muted-foreground font-medium">{order.contact_name}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selection Area */}
                <div className="p-8">
                    <div className="relative mb-6">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Find online drivers..."
                            className="w-full pl-12 pr-4 py-4 bg-app-background border border-app-border rounded-[1.5rem] text-sm font-bold outline-none focus:ring-2 focus:ring-app-primary/20 transition-all shadow-inner"
                        />
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-3 text-app-muted-foreground">
                                <Loader2 size={32} className="animate-spin text-app-primary" />
                                <p className="text-xs font-bold animate-pulse">Scanning for active fleet...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="py-12 text-center text-app-muted-foreground">
                                <Zap size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-bold italic">No active drivers found</p>
                                <p className="text-[10px] mt-1">Make sure drivers marks themselves as ONLINE</p>
                            </div>
                        ) : (
                            filtered.map(driver => (
                                <button
                                    key={driver.id}
                                    onClick={() => handleAssign(driver)}
                                    disabled={assigning !== null}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-app-surface border border-app-border hover:border-app-primary hover:shadow-lg transition-all text-left group"
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-xl bg-app-background flex items-center justify-center text-app-primary overflow-hidden border border-app-border">
                                            {driver.full_name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-app-success rounded-full border-2 border-app-surface"></div>
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="font-black text-sm text-app-foreground group-hover:text-app-primary transition-colors">
                                            {driver.full_name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-app-muted-foreground flex items-center gap-1 italic">
                                                <Truck size={10} /> {driver.vehicle_type}
                                            </span>
                                            <span className="text-[10px] font-bold text-app-muted-foreground">•</span>
                                            <span className="text-[10px] font-mono text-app-muted-foreground">{driver.phone_number}</span>
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        {assigning === driver.id ? (
                                            <Loader2 size={16} className="animate-spin text-app-primary" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-app-primary/5 group-hover:bg-app-primary group-hover:text-white flex items-center justify-center text-app-primary transition-all shadow-sm">
                                                <Check size={18} strokeWidth={3} />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="px-8 pb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-app-info-bg flex items-center justify-center text-app-info shrink-0">
                        <AlertCircle size={14} />
                    </div>
                    <p className="text-[10px] text-app-muted-foreground font-medium leading-relaxed">
                        Only <span className="text-app-success font-black">ONLINE</span> drivers are shown. If a driver is busy or offline, you won't see them in this list to ensure delivery speed.
                    </p>
                </div>
            </div>
        </div>
    );
}
