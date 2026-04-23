'use client';

/**
 * Scale Barcode Config Modal
 * ===========================
 * Tenant-wide configuration for GS1-style weight-embedded EAN-13 barcodes
 * used at the scales (deli, produce, fresh-food). The structure is:
 *
 *     [prefix][item-code][weight-integer][weight-decimal][check-digit]
 *
 * Example for 1.250 kg of item #000042:
 *     2  000042  001  250  C  →  20000420012500
 *
 * This is *specific* to weight-embedded barcodes — not a generic variable
 * barcode format. For price-embedded or quantity-embedded formats we'd want
 * a separate config row (future work).
 *
 * Styling uses the app's typography engine (text-tp-*) and color tokens
 * (var(--app-*)) to stay consistent with the rest of the admin surface.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, Scale, BarChart3, Info } from 'lucide-react';
import { getBalanceBarcodeConfig, updateBalanceBarcodeConfig, BalanceBarcodeConfig } from '@/app/actions/balance-barcode';
import { toast } from 'sonner';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

const DEFAULTS: BalanceBarcodeConfig = {
    prefix: '2',
    itemDigits: 6,
    weightIntDigits: 3,
    weightDecDigits: 3,
    isEnabled: true,
};

export function BalanceBarcodeConfigModal({ isOpen, onClose }: Props) {
    const [config, setConfig] = useState<BalanceBarcodeConfig>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        getBalanceBarcodeConfig().then(res => {
            if (res.success && res.data) setConfig(res.data);
            setLoading(false);
        });
    }, [isOpen]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        const res = await updateBalanceBarcodeConfig(config);
        if (res.success) {
            toast.success('Scale barcode configuration saved');
            onClose();
        } else {
            toast.error(res.error || 'Failed to save');
        }
        setSaving(false);
    }, [config, onClose]);

    if (!isOpen) return null;

    const totalDigits = 1 + config.itemDigits + config.weightIntDigits + config.weightDecDigits;
    const itemExample = '1'.repeat(config.itemDigits);
    const weightIntExample = '2'.repeat(config.weightIntDigits);
    const weightDecExample = '3'.repeat(config.weightDecDigits);
    const fullBarcode = `${config.prefix}${itemExample}${weightIntExample}${weightDecExample}`;
    const checkDigit = totalDigits <= 12 ? 'C' : '';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header — same page-header-icon pattern as Chart of Accounts */}
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="page-header-icon" style={{ background: 'var(--app-warning)' }}>
                            <Scale size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-tp-md font-bold tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                                Scale Barcode Config
                            </h3>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                Weight-embedded EAN-13 structure
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-app-border/40"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-2">
                        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Loading…</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-5 space-y-4">

                            {/* Info banner */}
                            <div className="flex items-start gap-2.5 p-3 rounded-xl"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                                <span className="text-tp-sm leading-relaxed" style={{ color: 'var(--app-foreground)' }}>
                                    Configures the barcode format produced by your <strong>scales</strong> (deli, produce, fresh-food). Any product using a weighed unit will follow this structure.
                                </span>
                            </div>

                            {/* Enable toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <div className="min-w-0">
                                    <div className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Enable scale barcodes
                                    </div>
                                    <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Enforce this structure on weighed-item barcodes.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setConfig(c => ({ ...c, isEnabled: !c.isEnabled }))}
                                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
                                    style={{ background: config.isEnabled ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }}
                                    aria-pressed={config.isEnabled}
                                >
                                    <span className="pointer-events-none inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                                        style={{ transform: config.isEnabled ? 'translateX(22px)' : 'translateX(2px)', marginTop: '2px' }} />
                                </button>
                            </div>

                            {/* Structure fields */}
                            <div className="grid grid-cols-2 gap-3" style={{ opacity: config.isEnabled ? 1 : 0.4, pointerEvents: config.isEnabled ? 'auto' : 'none' }}>
                                <StructureField label="Prefix" hint='Usually "2"' maxLength={2}>
                                    <input
                                        type="text"
                                        value={config.prefix}
                                        onChange={e => setConfig(c => ({ ...c, prefix: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                                        className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                        maxLength={2}
                                    />
                                </StructureField>

                                <StructureField label="Item digits" hint="Product code length">
                                    <input
                                        type="number"
                                        value={config.itemDigits}
                                        onChange={e => setConfig(c => ({ ...c, itemDigits: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                                        className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                        min={1} max={10}
                                    />
                                </StructureField>

                                <StructureField label="Weight integer" hint="Whole kg digits">
                                    <input
                                        type="number"
                                        value={config.weightIntDigits}
                                        onChange={e => setConfig(c => ({ ...c, weightIntDigits: Math.max(1, Math.min(5, Number(e.target.value))) }))}
                                        className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                        min={1} max={5}
                                    />
                                </StructureField>

                                <StructureField label="Weight decimal" hint="Fractional digits (g)">
                                    <input
                                        type="number"
                                        value={config.weightDecDigits}
                                        onChange={e => setConfig(c => ({ ...c, weightDecDigits: Math.max(0, Math.min(5, Number(e.target.value))) }))}
                                        className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                        min={0} max={5}
                                    />
                                </StructureField>
                            </div>

                            {/* Live preview */}
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)', opacity: config.isEnabled ? 1 : 0.4 }}>
                                <div className="px-4 py-2 flex items-center gap-2"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                    <BarChart3 size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                                    <span className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Live preview
                                    </span>
                                    <span className="text-tp-xxs ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {fullBarcode.length + (checkDigit ? 1 : 0)} digits total
                                    </span>
                                </div>
                                <div className="px-4 py-4 flex flex-col items-center gap-3" style={{ background: 'var(--app-background)' }}>
                                    <div className="flex items-center font-mono text-tp-2xl font-bold tracking-[0.15em]">
                                        <span style={{ color: 'var(--app-error)' }}>{config.prefix}</span>
                                        <span style={{ color: 'var(--app-info)' }}>{itemExample}</span>
                                        <span style={{ color: 'var(--app-success)' }}>{weightIntExample}</span>
                                        <span style={{ color: 'var(--app-warning)' }}>{weightDecExample}</span>
                                        {checkDigit && <span style={{ color: 'var(--app-muted-foreground)' }}>{checkDigit}</span>}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 justify-center">
                                        {[
                                            { label: 'Prefix', color: 'var(--app-error)', count: config.prefix.length },
                                            { label: 'Item', color: 'var(--app-info)', count: config.itemDigits },
                                            { label: 'Weight int', color: 'var(--app-success)', count: config.weightIntDigits },
                                            { label: 'Weight dec', color: 'var(--app-warning)', count: config.weightDecDigits },
                                            ...(checkDigit ? [{ label: 'Check', color: 'var(--app-muted-foreground)', count: 1 }] : []),
                                        ].map(l => (
                                            <div key={l.label} className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                                                <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {l.label} ({l.count})
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="text-tp-xs text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Example: item <span className="font-bold" style={{ color: 'var(--app-info)' }}>#000042</span> weighing{' '}
                                        <span className="font-bold" style={{ color: 'var(--app-success)' }}>1</span>.
                                        <span className="font-bold" style={{ color: 'var(--app-warning)' }}>250</span> kg
                                        → <span className="font-mono font-bold" style={{ color: 'var(--app-foreground)' }}>{config.prefix}000042001250{checkDigit || ''}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 pb-5 pt-0 flex gap-2">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-tp-sm font-bold transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-2.5 rounded-xl text-tp-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                <span>Save</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StructureField({ label, hint, children }: { label: string; hint: string; maxLength?: number; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-tp-xxs font-bold uppercase tracking-widest block" style={{ color: 'var(--app-muted-foreground)' }}>
                {label}
            </label>
            {children}
            <p className="text-tp-xxs text-center" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</p>
        </div>
    );
}
