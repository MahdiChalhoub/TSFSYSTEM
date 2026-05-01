'use client';

import { useState, useEffect } from 'react';
import { createPaymentTerm, updatePaymentTerm, deletePaymentTerm, seedDefaultPaymentTerms } from '@/app/actions/commercial/payment-terms';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Star, CheckCircle2, XCircle, Sparkles, Save, X, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell';
import { useRouter } from 'next/navigation';

type PaymentTerm = {
    id: number;
    name: string;
    code: string;
    description?: string;
    days: number;
    discount_percent: number;
    discount_days: number;
    is_default: boolean;
    is_active: boolean;
    sort_order: number;
};

export default function PaymentTermsClient({ initialTerms }: { initialTerms: PaymentTerm[] }) {
    const router = useRouter();
    const [terms, setTerms] = useState<PaymentTerm[]>(initialTerms);

    // Sync state when props change (from router.refresh)
    useEffect(() => {
        setTerms(initialTerms);
    }, [initialTerms]);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '', code: '', description: '', days: 0,
        discount_percent: 0, discount_days: 0, is_default: false, sort_order: 0,
    });

    const resetForm = () => {
        setForm({ name: '', code: '', description: '', days: 0, discount_percent: 0, discount_days: 0, is_default: false, sort_order: 0 });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (t: PaymentTerm) => {
        setForm({
            name: t.name, code: t.code, description: t.description || '',
            days: t.days, discount_percent: t.discount_percent, discount_days: t.discount_days,
            is_default: t.is_default, sort_order: t.sort_order,
        });
        setEditingId(t.id);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.code) {
            toast.error('Name and Code are required');
            return;
        }
        setLoading(true);

        if (editingId) {
            const res = await updatePaymentTerm(editingId, form);
            if (res?.success) {
                toast.success('Payment term updated');
                router.refresh();
                resetForm();
            } else {
                toast.error(res?.message || 'Failed to update');
            }
        } else {
            const formData = new FormData();
            Object.entries(form).forEach(([k, v]) => formData.append(k, String(v)));
            const res = await createPaymentTerm(null, formData);
            if (res?.success) {
                toast.success('Payment term created');
                router.refresh();
                resetForm();
            } else {
                toast.error(res?.message || 'Failed to create');
            }
        }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this payment term?')) return;
        setLoading(true);
        const res = await deletePaymentTerm(id);
        if (res?.success) {
            toast.success('Deleted');
            router.refresh();
        } else {
            toast.error(res?.message || 'Failed to delete');
        }
        setLoading(false);
    };

    const handleSetDefault = async (id: number) => {
        setLoading(true);
        const res = await updatePaymentTerm(id, { is_default: true });
        if (res?.success) {
            toast.success('Default updated');
            router.refresh();
        }
        setLoading(false);
    };

    const handleSeedDefaults = async () => {
        setLoading(true);
        const res = await seedDefaultPaymentTerms();
        if (res?.terms) {
            toast.success(`Created ${res.terms.length} default terms`);
            router.refresh();
        } else {
            toast.info(res?.message || 'Terms already exist');
        }
        setLoading(false);
    };

    return (
        <SettingsPageShell
            title="Payment Terms"
            subtitle={`${terms.length} Terms Configured`}
            icon={<Banknote size={20} className="text-white" />}
            configKey="payment_terms"
            config={terms.length > 0 ? Object.fromEntries(terms.map(t => [t.code, t])) : null}
            hasChanges={false}
        >
            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-app-primary hover:bg-app-primary text-white font-bold text-xs">
                    <Plus size={14} className="mr-1" /> New Payment Term
                </Button>
                <Button onClick={handleSeedDefaults} variant="outline"
                    className="text-xs font-bold" disabled={loading}>
                    <Sparkles size={14} className="mr-1" /> Seed Default Terms
                </Button>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <Card className="border-2 border-app-success dark:border-emerald-800 shadow-lg">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black theme-text">
                                {editingId ? 'Edit Payment Term' : 'New Payment Term'}
                            </h3>
                            <button onClick={resetForm} className="theme-text-muted hover:theme-text">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                                <Label className="text-[10px] font-bold theme-text-muted">Name *</Label>
                                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Net 30 Days" className="text-sm" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold theme-text-muted">Code *</Label>
                                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. NET_30" className="text-sm" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold theme-text-muted">Days Until Due</Label>
                                <Input type="number" value={form.days} onChange={e => setForm(f => ({ ...f, days: Number(e.target.value) }))}
                                    className="text-sm" />
                            </div>
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold theme-text-muted">Description</Label>
                            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full rounded-xl p-3 text-sm theme-text theme-surface resize-none"
                                style={{ border: '1px solid var(--theme-border)' }}
                                rows={2} placeholder="Detailed terms description..." />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <Label className="text-[10px] font-bold theme-text-muted">Early Discount %</Label>
                                <Input type="number" step="0.01" value={form.discount_percent}
                                    onChange={e => setForm(f => ({ ...f, discount_percent: Number(e.target.value) }))}
                                    className="text-sm" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold theme-text-muted">Discount Valid (days)</Label>
                                <Input type="number" value={form.discount_days}
                                    onChange={e => setForm(f => ({ ...f, discount_days: Number(e.target.value) }))}
                                    className="text-sm" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold theme-text-muted">Sort Order</Label>
                                <Input type="number" value={form.sort_order}
                                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                                    className="text-sm" />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm theme-text cursor-pointer">
                                <input type="checkbox" checked={form.is_default}
                                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                                    className="rounded" />
                                Set as default
                            </label>
                            <Button onClick={handleSave} disabled={loading}
                                className="bg-app-primary hover:bg-app-primary text-white font-bold text-xs ml-auto">
                                <Save size={14} className="mr-1" /> {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Terms List */}
            {terms.length === 0 ? (
                <Card className="border shadow-sm">
                    <CardContent className="p-8 text-center">
                        <p className="theme-text-muted text-sm">No payment terms configured yet.</p>
                        <p className="theme-text-muted text-xs mt-1">Click "Seed Default Terms" to add standard payment conditions.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {terms.map(t => (
                        <Card key={t.id} className={`border shadow-sm transition-all hover:shadow-md ${t.is_default ? 'border-app-success dark:border-emerald-700' : ''}`}>
                            <CardContent className="p-4 flex items-center gap-4">
                                {/* Default star */}
                                <button onClick={() => handleSetDefault(t.id)} title={t.is_default ? 'Default' : 'Set as default'}
                                    className={`shrink-0 ${t.is_default ? 'text-app-warning' : 'theme-text-muted hover:text-app-warning'}`}>
                                    <Star size={16} fill={t.is_default ? 'currentColor' : 'none'} />
                                </button>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm theme-text">{t.name}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded theme-surface-alt theme-text-muted">{t.code}</span>
                                        {t.is_default && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-app-success-bg text-app-success dark:bg-emerald-900/30 dark:text-app-success">DEFAULT</span>
                                        )}
                                        {!t.is_active && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-app-error-bg text-app-error dark:bg-rose-900/30 dark:text-app-error">INACTIVE</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        {t.days > 0 && <span className="text-[10px] theme-text-muted">{t.days} days</span>}
                                        {t.discount_percent > 0 && (
                                            <span className="text-[10px] theme-text-muted">
                                                {t.discount_percent}% discount within {t.discount_days} days
                                            </span>
                                        )}
                                        {t.description && <span className="text-[10px] theme-text-muted truncate">{t.description}</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => handleEdit(t)}
                                        className="p-2 rounded-lg hover:bg-app-info-bg dark:hover:bg-indigo-900/20 theme-text-muted hover:text-app-info transition-colors">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)}
                                        className="p-2 rounded-lg hover:bg-app-error-bg dark:hover:bg-rose-900/20 theme-text-muted hover:text-app-error transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </SettingsPageShell>
    );
}
