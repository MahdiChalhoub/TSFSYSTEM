'use client';

import { useState, useRef, useEffect, memo } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { AlertCircle, Loader2, Delete } from 'lucide-react';
import type { Register, RegisterUser } from '../types';

export const PinStep = memo(function PinStep({ register, cashier, onVerified }: {
    register: Register;
    cashier: RegisterUser;
    onVerified: (user: { id: number; name: string; username: string }) => void;
}) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [shake, setShake] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

    const handleSubmit = async (p = pin) => {
        if (p.length < 4) return;
        setLoading(true); setError('');
        try {
            const { verifyPosPin } = await import('@/components/pos/register-actions');
            const result = await verifyPosPin(register.id, p, cashier.id);
            if (result.success && result.data?.valid) {
                toast.success(`Welcome, ${result.data.user.name}!`);
                onVerified(result.data.user);
            } else {
                setShake(true); setTimeout(() => setShake(false), 500);
                setError('Incorrect PIN — try again');
                setPin('');
            }
        } catch { setError('Auth engine fault'); }
        setLoading(false);
    };

    const press = (key: string) => {
        if (loading) return;
        if (key === 'DEL') { setPin(p => p.slice(0, -1)); setError(''); }
        else if (key === '✓') { handleSubmit(); }
        else if (pin.length < 6) {
            const next = pin + key;
            setPin(next); setError('');
            if (next.length === 6) setTimeout(() => handleSubmit(next), 80);
        }
    };

    const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', '✓'];

    return (
        <div className={clsx('w-full max-w-sm animate-in fade-in zoom-in-95 duration-400', shake && 'animate-shake')}>
            {/* Avatar */}
            <div className="text-center mb-7">
                <div className="w-20 h-20 rounded-full bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/30 text-[var(--app-primary)] flex items-center justify-center mx-auto mb-3 font-black text-2xl shadow-xl shadow-[var(--app-primary-glow)]">
                    {cashier.name.substring(0, 2).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-[var(--app-text)]">{cashier.name}</h2>
                <p className="text-[var(--app-text-muted)] text-sm mt-0.5">{register.name}</p>
            </div>

            {/* PIN dots */}
            <div className={clsx('flex justify-center gap-3 mb-5', shake && 'animate-bounce')}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={clsx(
                        'w-4 h-4 rounded-full border-2 transition-all duration-150',
                        i < pin.length ? 'bg-[var(--app-primary)] border-[var(--app-primary-strong)] shadow-lg shadow-[var(--app-primary-glow)] scale-110' : 'border-[var(--app-border)]/80 bg-transparent'
                    )} />
                ))}
            </div>

            {error && (
                <div className="flex items-center justify-center gap-2 text-[var(--app-error)] text-xs font-bold mb-4">
                    <AlertCircle size={13} /> {error}
                </div>
            )}

            <input ref={inputRef} type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && pin.length >= 4) handleSubmit(); if (e.key === 'Backspace') setPin(p => p.slice(0, -1)); }}
                className="sr-only" autoFocus
            />

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
                {KEYS.map(key => (
                    <button
                        key={key}
                        onClick={() => press(key)}
                        disabled={loading}
                        className={clsx(
                            'h-14 rounded-2xl font-black text-lg transition-all duration-100 active:scale-90 select-none',
                            key === '✓'
                                ? pin.length >= 4
                                    ? 'bg-[var(--app-primary)] text-white shadow-xl shadow-[var(--app-primary-glow)] hover:shadow-[var(--app-primary-glow)]'
                                    : 'bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] cursor-not-allowed'
                                : key === 'DEL'
                                    ? 'bg-[var(--app-error-bg)] text-[var(--app-error)] hover:bg-[var(--app-error-bg)]'
                                    : 'bg-[var(--app-surface-hover)] text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)]/50'
                        )}
                    >
                        {loading && key === '✓' ? <Loader2 size={18} className="animate-spin mx-auto" /> : key === 'DEL' ? <Delete size={18} className="mx-auto" /> : key}
                    </button>
                ))}
            </div>
        </div>
    );
});
