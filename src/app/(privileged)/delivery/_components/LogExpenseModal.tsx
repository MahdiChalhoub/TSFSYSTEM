'use client';

import React, { useState } from 'react';
import { X, DollarSign, FileText, Loader2, Fuel, Wrench, CheckCircle2 } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import clsx from 'clsx';

interface LogExpenseModalProps {
    driverId: number;
    driverName: string;
    onClose: () => void;
    onSaved: () => void;
}

export default function LogExpenseModal({ driverId, driverName, onClose, onSaved }: LogExpenseModalProps) {
    const [form, setForm] = useState({
        amount: '',
        expense_type: 'fuel' as 'fuel' | 'maintenance' | 'other',
        reference: '',
        description: '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.amount || parseFloat(form.amount) <= 0) {
            toast.error('Valid amount is required');
            return;
        }

        setSaving(true);
        try {
            const res = await erpFetch(`pos/drivers/${driverId}/log_expense/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (res?.success) {
                toast.success('Fleet expense logged successfully');
                onSaved();
                onClose();
            } else {
                toast.error(res?.error || 'Failed to log expense');
            }
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        }
        setSaving(false);
    };

    const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all";

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div
                    className="px-8 pt-8 pb-6"
                    style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--app-info) 10%, transparent), transparent)' }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-white italic tracking-tight">Log Fleet <span className="text-app-info">Expense</span></h2>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all">
                            <X size={16} />
                        </button>
                    </div>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{driverName}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="grid grid-cols-3 gap-2">
                        {(['fuel', 'maintenance', 'other'] as const).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, expense_type: type }))}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                                    form.expense_type === type
                                        ? "bg-blue-500/20 border-app-info text-app-info shadow-lg shadow-blue-500/10"
                                        : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10"
                                )}
                            >
                                {type === 'fuel' ? <Fuel size={18} /> : type === 'maintenance' ? <Wrench size={18} /> : <FileText size={18} />}
                                <span className="text-[10px] font-bold uppercase tracking-tighter">{type}</span>
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 ml-1">Amount (USD) *</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"><DollarSign size={14} /></div>
                            <input
                                type="number"
                                step="0.01"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                className={clsx(inputClass, "pl-10 text-lg font-black")}
                                placeholder="0.00"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 ml-1">Reference / Invoice #</label>
                        <input
                            value={form.reference}
                            onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                            className={inputClass}
                            placeholder="e.g. SHELL-2024-88"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className={clsx(inputClass, "h-24 resize-none")}
                            placeholder="Detailed notes regarding this expense..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl border border-white/5 text-white/40 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all">Cancel</button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-[2] py-4 bg-app-gradient-info text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {saving ? 'Processing...' : 'Confirm Expense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
