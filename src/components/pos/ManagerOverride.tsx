'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, X, CheckCircle2, Ship, Clock, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ManagerOverrideProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    actionLabel: string;
}

export function ManagerOverride({ isOpen, onClose, onSuccess, actionLabel }: ManagerOverrideProps) {
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('IDLE');

    // Auto-initiate remote request when modal opens
    useEffect(() => {
        if (isOpen && status === 'IDLE') {
            setStatus('PENDING');
            toast.info("Authorization request sent to Moderator's Office...");
        }
    }, [isOpen, status]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setPin('');
            setStatus('IDLE');
        }
    }, [isOpen]);

    // Simulate Moderator Approval Polling
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (status === 'PENDING') {
            timer = setTimeout(() => {
                setStatus('APPROVED');
                toast.success("Moderator approved the request!");
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1000);
            }, 3000); // Simulate 3s delay for moderator to click "Approve" from office
        }
        return () => clearTimeout(timer);
    }, [status, onSuccess, onClose]);

    if (!isOpen) return null;

    const handleSendToModerator = () => {
        setStatus('PENDING');
        toast.info("Authorization request sent to Moderator's Office...");
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (pin.length === 4) {
            toast.success(`Authorized by Moderator #${pin}`);
            setStatus('APPROVED');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } else {
            toast.error("Enter 4-digit PIN");
        }
    };

    const handleKey = (num: string) => {
        if (pin.length < 4) setPin(prev => prev + num);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-50 text-gray-300 hover:text-gray-500 transition-all z-20"
                >
                    <X size={20} />
                </button>

                <div className="p-8 pb-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
                        <ShieldAlert size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight italic">Security Interlock</h2>
                    <p className="text-sm text-gray-400 font-bold mt-2 px-8">Manager code or remote authorization required to: <span className="text-indigo-600 uppercase underline decoration-2 underline-offset-4">{actionLabel}</span></p>
                </div>

                {status === 'APPROVED' ? (
                    <div className="p-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95">
                        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-200">
                            <Check size={48} strokeWidth={3} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-emerald-600 tracking-tighter italic">AUTHORIZED</h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Redirecting to Transaction...</p>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        {status === 'PENDING' && (
                            <div className="absolute inset-x-0 -top-4 flex items-center justify-center gap-2 animate-pulse mb-4 z-10">
                                <div className="flex items-center gap-2 bg-amber-100 px-4 py-1.5 rounded-full border border-amber-200 shadow-sm">
                                    <Clock className="text-amber-600 animate-spin-slow" size={12} />
                                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Awaiting Office Appproval...</span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="p-8 pt-4">
                            <div className="flex justify-center gap-4 mb-8">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className={`w-12 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${pin.length > i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                                        {pin.length > i ? (
                                            <div className="w-3 h-3 bg-white rounded-full" />
                                        ) : ''}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-8">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((val) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                            if (val === 'C') setPin('');
                                            else if (val === 'OK') handleSubmit();
                                            else handleKey(val);
                                        }}
                                        className={`h-16 rounded-2xl text-lg font-black transition-all ${val === 'OK' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100'}`}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                                >
                                    Cancel Transaction
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
