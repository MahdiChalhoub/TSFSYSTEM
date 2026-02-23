'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import {
    Plus, Trash2, GripVertical, Save, ArrowLeft,
    Wallet, CreditCard, Banknote, Smartphone, Truck
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

type PaymentMethodConfig = {
    key: string;
    label: string;
    accountId: number | null;
};

type FinancialAccount = {
    id: number;
    name: string;
    type: string;
    currency: string;
};

const ICONS: Record<string, any> = {
    CASH: Banknote,
    CARD: CreditCard,
    WALLET: Wallet,
    OM: Smartphone,
    WAVE: Smartphone,
    DELIVERY: Truck,
};

const PRESET_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY', 'CREDIT', 'CHECK', 'TRANSFER'];

export default function POSSettingsPage() {
    const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
    const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newMethodKey, setNewMethodKey] = useState('');

    useEffect(() => {
        Promise.all([
            erpFetch('settings/item/pos_payment_methods/'),
            erpFetch('accounts/')
        ]).then(([config, accts]) => {
            const accountList = Array.isArray(accts) ? accts : (accts?.results || []);
            setAccounts(accountList);

            if (config && Array.isArray(config) && config.length > 0) {
                // Normalize: handle both string[] and object[] formats
                const normalized = config.map((m: any) => {
                    if (typeof m === 'string') {
                        return { key: m, label: m, accountId: null };
                    }
                    return { key: m.key, label: m.label || m.key, accountId: m.accountId || null };
                });
                setMethods(normalized);
            } else {
                // Default methods
                setMethods([
                    { key: 'CASH', label: 'Cash', accountId: null },
                    { key: 'CARD', label: 'Card', accountId: null },
                    { key: 'WALLET', label: 'Wallet', accountId: null },
                    { key: 'WAVE', label: 'Wave', accountId: null },
                    { key: 'OM', label: 'OM', accountId: null },
                    { key: 'MULTI', label: 'Multi', accountId: null },
                    { key: 'DELIVERY', label: 'Delivery', accountId: null },
                ]);
            }
        }).catch(err => {
            console.error('Failed to load POS settings:', err);
            toast.error('Failed to load POS settings');
        }).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await erpFetch('settings/item/pos_payment_methods/', {
                method: 'POST',
                body: JSON.stringify(methods)
            });
            toast.success('Payment methods saved! Refresh POS to see changes.');
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const addMethod = () => {
        const key = newMethodKey.trim().toUpperCase();
        if (!key) return;
        if (methods.find(m => m.key === key)) {
            toast.error(`"${key}" already exists`);
            return;
        }
        setMethods(prev => [...prev, { key, label: key, accountId: null }]);
        setNewMethodKey('');
    };

    const removeMethod = (key: string) => {
        setMethods(prev => prev.filter(m => m.key !== key));
    };

    const updateMethod = (index: number, updates: Partial<PaymentMethodConfig>) => {
        setMethods(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
    };

    const moveMethod = (index: number, direction: -1 | 1) => {
        const newIdx = index + direction;
        if (newIdx < 0 || newIdx >= methods.length) return;
        setMethods(prev => {
            const arr = [...prev];
            [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
            return arr;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeft size={20} className="text-gray-500" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">POS Payment Methods</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Configure payment buttons and link them to financial accounts</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Payment Methods List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_140px_200px_40px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Button Label</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Key</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Account</span>
                    <span />
                </div>

                {methods.map((method, idx) => {
                    const Icon = ICONS[method.key] || CreditCard;
                    const linkedAccount = accounts.find(a => a.id === method.accountId);

                    return (
                        <div
                            key={method.key}
                            className="grid grid-cols-[40px_1fr_140px_200px_40px] gap-3 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50/50 transition-colors"
                        >
                            {/* Reorder */}
                            <div className="flex flex-col items-center gap-0.5">
                                <button
                                    onClick={() => moveMethod(idx, -1)}
                                    disabled={idx === 0}
                                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-[10px]"
                                >▲</button>
                                <button
                                    onClick={() => moveMethod(idx, 1)}
                                    disabled={idx === methods.length - 1}
                                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-[10px]"
                                >▼</button>
                            </div>

                            {/* Label */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <Icon size={16} />
                                </div>
                                <input
                                    type="text"
                                    value={method.label}
                                    onChange={(e) => updateMethod(idx, { label: e.target.value })}
                                    className="text-sm font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-emerald-500 outline-none py-1 w-full transition-all"
                                />
                            </div>

                            {/* Key */}
                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded text-center">
                                {method.key}
                            </span>

                            {/* Account Dropdown */}
                            <select
                                value={method.accountId || ''}
                                onChange={(e) => updateMethod(idx, { accountId: e.target.value ? Number(e.target.value) : null })}
                                className={clsx(
                                    "text-xs font-bold rounded-lg px-2 py-2 border outline-none transition-all w-full",
                                    method.accountId
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                        : "bg-amber-50 border-amber-200 text-amber-700"
                                )}
                            >
                                <option value="">⚠ No account linked</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} ({acc.type || 'N/A'})
                                    </option>
                                ))}
                            </select>

                            {/* Delete */}
                            <button
                                onClick={() => removeMethod(method.key)}
                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    );
                })}

                {/* Add New */}
                <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-3">
                    <select
                        value={newMethodKey}
                        onChange={(e) => setNewMethodKey(e.target.value)}
                        className="text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none flex-1"
                    >
                        <option value="">Select a method to add...</option>
                        {PRESET_METHODS
                            .filter(p => !methods.find(m => m.key === p))
                            .map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))
                        }
                    </select>
                    <input
                        type="text"
                        value={newMethodKey}
                        onChange={(e) => setNewMethodKey(e.target.value.toUpperCase())}
                        placeholder="Or type custom..."
                        className="text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none w-40"
                    />
                    <button
                        onClick={addMethod}
                        disabled={!newMethodKey.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-40"
                    >
                        <Plus size={16} />
                        Add
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2">How it works</h3>
                <ul className="text-xs text-blue-700 space-y-1 font-medium">
                    <li>• Each payment button on the POS screen is linked to a <b>Financial Account</b></li>
                    <li>• When a sale is processed, the money is automatically posted to the linked account's ledger</li>
                    <li>• Buttons without a linked account will use the default payment account</li>
                    <li>• Reorder buttons to match your most-used payment methods</li>
                    <li>• Changes apply to <b>this organization only</b> — each org has its own config</li>
                </ul>
            </div>
        </div>
    );
}
