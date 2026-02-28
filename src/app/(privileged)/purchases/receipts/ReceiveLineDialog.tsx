'use client';

import { useState } from 'react';
import { Package, Truck, CheckCircle, X } from 'lucide-react';
import { receivePOLine } from '@/app/actions/inventory/locations';
import { toast } from 'sonner';

interface ReceiveLineDialogProps {
    po: any;
    line: any;
    onClose: () => void;
    onSuccess: (updatedPo: any) => void;
}

export default function ReceiveLineDialog({ po, line, onClose, onSuccess }: ReceiveLineDialogProps) {
    const [qty, setQty] = useState<number>(Number(line.quantity) - Number(line.qty_received));
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (qty <= 0) return toast.error("Quantity must be positive");

        setLoading(true);
        try {
            const res = await receivePOLine(po.id, { line_id: line.id, quantity: qty });
            if (res.error) throw new Error(res.error);

            toast.success(`Received ${qty} of ${line.product_name}`);
            onSuccess(res);
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Reception failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-emerald-600 p-8 text-white relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight">Post Reception</h3>
                            <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest mt-0.5">Stock Acquisition Portal</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Item Context</label>
                            <div className="font-bold text-gray-900">{line.product_name}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{line.product_sku}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Ordered</label>
                                <span className="text-xl font-black text-blue-900">{line.quantity}</span>
                            </div>
                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Already Rec.</label>
                                <span className="text-xl font-black text-emerald-900">{line.qty_received}</span>
                            </div>
                        </div>

                        <div className="relative group">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1 mb-2 block">Acquisition Quantity</label>
                            <div className="relative flex items-center">
                                <Truck className="absolute left-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <input
                                    type="number"
                                    autoFocus
                                    step="any"
                                    value={qty}
                                    onChange={(e) => setQty(Number(e.target.value))}
                                    className="w-full pl-12 pr-6 h-16 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-emerald-500/20 focus:bg-white focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all font-black text-xl text-gray-900"
                                    placeholder="0.00"
                                />
                                <button
                                    type="button"
                                    onClick={() => setQty(Number(line.quantity) - Number(line.qty_received))}
                                    className="absolute right-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black hover:bg-emerald-100 transition-colors"
                                >
                                    MAX
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || qty <= 0}
                            className="flex-[2] h-14 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle size={18} />
                                    Post Reception
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
