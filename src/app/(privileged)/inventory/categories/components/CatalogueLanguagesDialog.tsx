'use client';

/**
 * Catalogue Languages Dialog — pick which locale codes the tenant wants
 * to surface across the product catalogue. One checkbox per well-known
 * language plus a free-text input for custom codes. Writes to
 * Organization.settings.catalogue_languages via the backend endpoint.
 */

import { useEffect, useState } from 'react';
import { X, Loader2, Languages, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getCatalogueLanguages, setCatalogueLanguages, labelFor, isRTL } from '@/lib/catalogue-languages';

const COMMON: { code: string; native: string }[] = [
    { code: 'en', native: 'English' },
    { code: 'fr', native: 'Français' },
    { code: 'ar', native: 'العربية' },
    { code: 'es', native: 'Español' },
    { code: 'de', native: 'Deutsch' },
    { code: 'it', native: 'Italiano' },
    { code: 'pt', native: 'Português' },
    { code: 'nl', native: 'Nederlands' },
    { code: 'tr', native: 'Türkçe' },
    { code: 'ru', native: 'Русский' },
    { code: 'zh', native: '中文' },
    { code: 'ja', native: '日本語' },
    { code: 'he', native: 'עברית' },
    { code: 'fa', native: 'فارسی' },
];

interface Props {
    onClose: () => void;
    onDone: (codes: string[]) => void;
}

export function CatalogueLanguagesDialog({ onClose, onDone }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [codes, setCodes] = useState<string[]>([]);
    const [custom, setCustom] = useState('');

    useEffect(() => {
        getCatalogueLanguages()
            .then(setCodes)
            .catch(() => setCodes(['fr', 'ar']))
            .finally(() => setLoading(false));
    }, []);

    const toggle = (c: string) => setCodes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    const addCustom = () => {
        const norm = custom.trim().toLowerCase().slice(0, 10);
        if (!norm) return;
        if (!codes.includes(norm)) setCodes(prev => [...prev, norm]);
        setCustom('');
    };

    const save = async () => {
        setSaving(true);
        try {
            const saved = await setCatalogueLanguages(codes);
            toast.success(`${saved.length} language${saved.length === 1 ? '' : 's'} enabled`);
            onDone(saved);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', color: 'white' }}>
                            <Languages size={15} />
                        </div>
                        <div>
                            <h3 className="text-tp-md" style={{ color: 'var(--app-foreground)' }}>Catalogue languages</h3>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                {codes.length} enabled
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="p-1.5 rounded-lg transition-all hover:bg-app-border/30"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                        </div>
                    ) : (
                        <>
                            <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                Pick the languages your catalogue needs. Category and product forms will render one translation input per enabled language.
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {COMMON.map(l => {
                                    const active = codes.includes(l.code);
                                    return (
                                        <button key={l.code} type="button"
                                                onClick={() => toggle(l.code)}
                                                className="flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left"
                                                style={{
                                                    background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                                    border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                                    color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                                }}>
                                            <span className="flex-1 min-w-0">
                                                <span className="text-tp-sm font-bold truncate block" dir={isRTL(l.code) ? 'rtl' : undefined}>
                                                    {l.native}
                                                </span>
                                                <span className="text-tp-xxs font-mono uppercase" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {l.code}
                                                </span>
                                            </span>
                                            {active && <span className="text-tp-xs font-bold ml-2">✓</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom code added from the picked list */}
                            {codes.filter(c => !COMMON.some(l => l.code === c)).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {codes.filter(c => !COMMON.some(l => l.code === c)).map(c => (
                                        <span key={c} className="inline-flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded"
                                              style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                            {labelFor(c)}
                                            <button type="button" onClick={() => toggle(c)} title="Remove">×</button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--app-border)' }}>
                                <input value={custom}
                                       onChange={e => setCustom(e.target.value.replace(/[^a-z-]/gi, ''))}
                                       onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                                       placeholder="Custom locale code (e.g. ber, ku)"
                                       className="flex-1 px-3 py-2 rounded-xl text-tp-sm font-mono outline-none"
                                       style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                <button type="button" onClick={addCustom}
                                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-tp-xs font-bold"
                                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Plus size={12} /> Add
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="px-5 py-3 flex justify-end gap-2"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <button onClick={onClose} disabled={saving}
                            className="px-4 py-2 rounded-xl text-tp-sm font-bold"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        Cancel
                    </button>
                    <button onClick={save} disabled={saving || loading}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-sm font-bold text-white transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
