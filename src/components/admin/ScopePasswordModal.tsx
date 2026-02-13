'use client';

import { useState } from 'react';
import { X, Eye, Layers, Unlock, Shield } from 'lucide-react';
import { setScopePassword } from '@/app/actions/people';

export default function ScopePasswordModal({
    employee,
    onClose
}: {
    employee: { id: string; firstName: string; lastName: string; user?: { id: string; has_official_pin?: boolean; has_internal_pin?: boolean } };
    onClose: () => void;
}) {
    const [officialPin, setOfficialPin] = useState('');
    const [internalPin, setInternalPin] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [hasOfficialPin, setHasOfficialPin] = useState(employee.user?.has_official_pin ?? false);
    const [hasInternalPin, setHasInternalPin] = useState(employee.user?.has_internal_pin ?? false);

    if (!employee.user) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 text-center">
                    <Shield size={48} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-700 mb-2">No System Login</h3>
                    <p className="text-sm text-gray-400 mb-6">This employee doesn&apos;t have a system login. Create one first from the employee form.</p>
                    <button onClick={onClose} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Close</button>
                </div>
            </div>
        );
    }

    const userId = employee.user.id;

    async function handleSetPassword(scope: 'official' | 'internal', pin: string | null) {
        setSaving(scope);
        setMessage(null);
        try {
            const result = await setScopePassword(userId, scope, pin);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                if (scope === 'official') {
                    setHasOfficialPin(!!pin);
                    setOfficialPin('');
                } else {
                    setHasInternalPin(!!pin);
                    setInternalPin('');
                }
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'Failed' });
        } finally {
            setSaving(null);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Access Passwords</h2>
                        <p className="text-xs text-gray-400 font-bold mt-1">{employee.firstName} {employee.lastName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-900">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 space-y-6">

                    {/* Official Password */}
                    <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers size={16} className="text-emerald-600" />
                                <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Official Password</span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${hasOfficialPin ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                                {hasOfficialPin ? '● Set' : '○ Not set'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500">Alternative login password that grants <strong>standard access</strong>.</p>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={officialPin}
                                onChange={e => setOfficialPin(e.target.value)}
                                placeholder="Enter new password..."
                                className="flex-1 px-4 py-3 rounded-xl bg-white border border-emerald-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-medium"
                            />
                            <button
                                onClick={() => handleSetPassword('official', officialPin)}
                                disabled={!officialPin || saving === 'official'}
                                className="px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40"
                            >
                                {saving === 'official' ? '...' : 'Set'}
                            </button>
                            {hasOfficialPin && (
                                <button
                                    onClick={() => handleSetPassword('official', null)}
                                    disabled={saving === 'official'}
                                    className="px-3 py-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                                    title="Clear Official password"
                                >
                                    <Unlock size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Internal Password */}
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Eye size={16} className="text-gray-700" />
                                <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Internal Password</span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${hasInternalPin ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-400'}`}>
                                {hasInternalPin ? '● Set' : '○ Not set'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500">Alternative login password that grants <strong>elevated access</strong> with full data visibility.</p>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={internalPin}
                                onChange={e => setInternalPin(e.target.value)}
                                placeholder="Enter new password..."
                                className="flex-1 px-4 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-gray-200 outline-none text-sm font-medium"
                            />
                            <button
                                onClick={() => handleSetPassword('internal', internalPin)}
                                disabled={!internalPin || saving === 'internal'}
                                className="px-4 py-3 bg-gray-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-40"
                            >
                                {saving === 'internal' ? '...' : 'Set'}
                            </button>
                            {hasInternalPin && (
                                <button
                                    onClick={() => handleSetPassword('internal', null)}
                                    disabled={saving === 'internal'}
                                    className="px-3 py-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                                    title="Clear Internal password"
                                >
                                    <Unlock size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`p-3 rounded-xl text-xs font-bold text-center ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
