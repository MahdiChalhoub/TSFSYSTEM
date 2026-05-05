'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Key, Shield, Lock, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react'
import { resetPOSUserPIN } from '@/app/actions/pos/settings-actions'

interface PINResetModalProps {
    userId: number;
    userName: string;
    mode: 'self' | 'admin';
    onClose: () => void;
    onSuccess: () => void;
}

export function PINResetModal({ userId, userName, mode, onClose, onSuccess }: PINResetModalProps) {
    const [password, setPassword] = useState('')
    const [newPin, setNewPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [saving, setSaving] = useState(false)
    const [passwordError, setPasswordError] = useState('')

    const handlePinChange = async () => {
        if (!password) { setPasswordError('Password is required to confirm your identity'); return }
        if (!newPin || newPin.length < 4) { toast.error('PIN must be 4-6 digits'); return }
        if (newPin !== confirmPin) { toast.error('PINs do not match'); return }

        setSaving(true)
        setPasswordError('')
        try {
            await resetPOSUserPIN({
                target_user_id: userId,
                new_pin: newPin,
                mode,
                admin_password: mode === 'admin' ? password : undefined,
                current_password: mode === 'self' ? password : undefined
            });
            
            toast.success(mode === 'self' ? 'Your PIN has been updated!' : `PIN reset for ${userName}`)
            onSuccess()
            onClose()
        } catch (e: any) {
            const msg = e?.message || 'Failed to update PIN'
            if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('identity')) {
                setPasswordError(msg)
            } else {
                toast.error(msg)
            }
        }
        setSaving(false)
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[60] animate-in fade-in duration-150" onClick={onClose} />
            <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-app-bg border border-app-border rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200"
                    style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                    {/* Modal header */}
                    <div className="px-5 pt-5 pb-3">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{
                                    background: mode === 'self'
                                        ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                        : 'color-mix(in srgb, var(--app-warning) 12%, transparent)',
                                    color: mode === 'self' ? 'var(--app-primary)' : 'var(--app-warning)',
                                }}>
                                {mode === 'self' ? <Key size={18} /> : <Shield size={18} />}
                            </div>
                            <div>
                                <h3 className="text-[14px] font-black text-app-foreground">
                                    {mode === 'self' ? 'Change Your PIN' : `Reset PIN`}
                                </h3>
                                <p className="text-[10px] text-app-muted-foreground">
                                    {mode === 'self'
                                        ? 'Confirm your identity with your password'
                                        : `Setting new PIN for ${userName}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-5 pb-5 space-y-3">
                        {/* Identity verification notice */}
                        <div className="flex items-start gap-2 p-2.5 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 12%, transparent)' }}>
                            <Lock size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                            <p className="text-[10px] text-app-muted-foreground leading-relaxed">
                                Enter your <strong>login password</strong> to verify your identity before changing the PIN.
                            </p>
                        </div>

                        {/* Password field */}
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                                Your Password *
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                                placeholder="Enter your login password"
                                autoFocus
                                className={`w-full text-[12px] px-3 py-2.5 bg-app-bg border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-colors ${passwordError ? 'border-app-error/50 bg-app-error/5' : 'border-app-border/50 focus:border-app-primary/40'}`}
                            />
                            {passwordError && (
                                <p className="text-[9px] text-red-400 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={9} /> {passwordError}
                                </p>
                            )}
                        </div>

                        {/* New PIN */}
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                                New PIN (4-6 digits) *
                            </label>
                            <div className="relative">
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    value={newPin}
                                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="● ● ● ●"
                                    className="w-full text-[14px] font-mono tracking-[0.3em] px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary/40 transition-colors text-center"
                                />
                                <button onClick={() => setShowPin(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-app-muted-foreground hover:text-app-foreground transition-colors">
                                    {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm PIN */}
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                                Confirm PIN *
                            </label>
                            <input
                                type={showPin ? 'text' : 'password'}
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="● ● ● ●"
                                className={`w-full text-[14px] font-mono tracking-[0.3em] px-3 py-2.5 bg-app-bg border rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-colors text-center ${confirmPin && confirmPin !== newPin ? 'border-app-error/50' : 'border-app-border/50 focus:border-app-primary/40'}`}
                            />
                            {confirmPin && confirmPin !== newPin && (
                                <p className="text-[9px] text-red-400 mt-1">PINs do not match</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <button onClick={onClose}
                                className="flex-1 text-[11px] font-bold py-2.5 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-surface transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={handlePinChange}
                                disabled={saving || !password || newPin.length < 4 || newPin !== confirmPin}
                                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2.5 rounded-xl text-white transition-all disabled:opacity-40"
                                style={{
                                    background: mode === 'self' ? 'var(--app-primary)' : 'var(--app-warning)',
                                    boxShadow: `0 2px 12px color-mix(in srgb, ${mode === 'self' ? 'var(--app-primary)' : 'var(--app-warning)'} 25%, transparent)`,
                                }}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                                {mode === 'self' ? 'Update PIN' : 'Reset PIN'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
