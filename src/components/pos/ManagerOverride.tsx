'use client';

import { useState } from 'react';
import { ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ManagerOverrideProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    actionLabel: string;
}

export function ManagerOverride({ isOpen, onClose, onSuccess, actionLabel }: ManagerOverrideProps) {
    const [pin, setPin] = useState('');
    const CORRECT_PIN = '1234'; // Default manager PIN for demo

    if (!isOpen) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (pin === CORRECT_PIN) {
            onSuccess();
            onClose();
            setPin('');
        } else {
            toast.error("Invalid Manager PIN");
            setPin('');
        }
    };

    const handleKey = (num: string) => {
        if (pin.length < 4) setPin(prev => prev + num);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 pb-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
                        <ShieldAlert size={32} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight italic">Security Interlock</h2>
                    <p className="text-sm text-gray-400 font-bold mt-2">Manager code required to: <span className="text-indigo-600 uppercase underline decoration-2 underline-offset-4">{actionLabel}</span></p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 pt-4">
                    <div className="flex justify-center gap-4 mb-8">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className={`w-12 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${pin.length > i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                                {pin.length > i ? 'ΓÇó' : ''}
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

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                    >
                        Cancel Transaction
                    </button>
                </form>
            </div>
        </div>
    );
}
