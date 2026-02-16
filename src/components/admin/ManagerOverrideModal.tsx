'use client'

import React, { useState } from 'react'
import { ShieldAlert, X, ShieldCheck, Loader2 } from 'lucide-react'
import { verifyManagerOverride } from '@/app/actions/overrides'
import { toast } from 'sonner'

interface ManagerOverrideModalProps {
    isOpen: boolean
    onClose: () => void
    onVerified: () => void
    action: string
    orderId?: number
    details?: string
    title?: string
    description?: string
}

export default function ManagerOverrideModal({
    isOpen,
    onClose,
    onVerified,
    action,
    orderId,
    details,
    title = 'Manager Override Required',
    description = 'A manager signature is required to perform this action.'
}: ManagerOverrideModalProps) {
    const [pin, setPin] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (pin.length < 4) return

        setLoading(true)
        setError(null)

        try {
            const result = await verifyManagerOverride(pin, action, orderId, details)
            if (result.verified) {
                toast.success('Override authorized')
                onVerified()
                onClose()
            } else {
                setError('Invalid manager PIN')
                setPin('')
            }
        } catch (err) {
            setError('Verification failed. Try again.')
        } finally {
            setLoading(false)
        }
    }

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6)
        setPin(val)
        if (error) setError(null)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                            <ShieldAlert size={24} />
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-6">{description}</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Manager PIN
                            </label>
                            <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={pin}
                                onChange={handlePinChange}
                                placeholder="••••"
                                className={`w-full text-center text-3xl tracking-[1em] py-4 bg-gray-50 border-2 rounded-xl focus:outline-none transition-all ${error ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-100 focus:border-amber-400 focus:bg-white'
                                    }`}
                                autoFocus
                            />
                            {error && (
                                <p className="text-xs text-red-600 mt-2 text-center font-medium animate-bounce">{error}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || pin.length < 4}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${pin.length >= 4
                                    ? 'bg-gray-900 text-white hover:bg-black'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {loading ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    Authorize Override
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Audit logging is enabled for this operation
                    </div>
                </div>
            </div>
        </div>
    )
}
