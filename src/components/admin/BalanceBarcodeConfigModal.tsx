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
import {
    getBalanceBarcodeConfigMap, updateBalanceBarcodeConfigMap,
    BalanceBarcodeConfig, BalanceBarcodeConfigMap, VariableBarcodeMode,
} from '@/app/actions/balance-barcode';
import { toast } from 'sonner';
import { BARCODE_EMBEDDABLE_TYPES, UNIT_TYPE_BY_ID, UnitTypeId } from '@/lib/unit-types';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

/** Blank config map derived from the SINGLE SOURCE OF TRUTH at
 *  `src/lib/unit-types.ts`. No hardcoded list here — add/remove a type there
 *  (flag `canEmbedInBarcode`) and this modal updates automatically. */
const BLANK_MAP: BalanceBarcodeConfigMap = Object.fromEntries(
    BARCODE_EMBEDDABLE_TYPES.map(t => [t.id, {
        mode: t.id as VariableBarcodeMode,
        prefix: t.barcodeRender?.prefix || '20',
        itemDigits: 5,
        weightIntDigits: t.barcodeDefaults?.intDigits ?? 3,
        weightDecDigits: t.barcodeDefaults?.decDigits ?? 0,
        isEnabled: t.id === 'WEIGHT',
    }])
) as BalanceBarcodeConfigMap;

/** Derived mode metadata — no hardcoding. Labels / icons / examples all
 *  come from the shared unit-types catalog. */
function modeMeta(mode: VariableBarcodeMode) {
    const t = UNIT_TYPE_BY_ID[mode as UnitTypeId];
    const r = t?.barcodeRender;
    return {
        label: t?.label ?? mode,
        Icon: t?.icon ?? Scale,
        intLabel: `${t?.label ?? mode} integer`,
        decLabel: r?.decHint === 'Count uses no decimal' ? 'Not used' : `${t?.label ?? mode} decimal`,
        intHint: r?.intHint ?? '',
        decHint: r?.decHint ?? '',
        exampleInt: r?.exampleInt ?? '1',
        exampleDec: r?.exampleDec ?? '',
        unit: r?.unit ?? '',
        decAllowed: (t?.barcodeDefaults?.decDigits ?? 0) > 0,
        humanExample: (i: string, d: string) => {
            const verb = r?.verbPhrase ?? '';
            const unit = r?.unit ?? '';
            if (!d) return <>{verb} <span className="font-bold" style={{ color: 'var(--app-success)' }}>{i}</span> {unit}</>;
            return <>{verb} <span className="font-bold" style={{ color: 'var(--app-success)' }}>{i}</span>.<span className="font-bold" style={{ color: 'var(--app-warning)' }}>{d}</span> {unit}</>;
        },
    };
}

export function BalanceBarcodeConfigModal({ isOpen, onClose }: Props) {
    // Start with defaults visible instantly. The backend endpoint for
    // `settings/balance-barcode/` may not exist in every tenant yet, so we
    // don't block the UI on it — we just hydrate in the background if it
    // comes back with saved values.
    const [configs, setConfigs] = useState<BalanceBarcodeConfigMap>(BLANK_MAP);
    const [activeMode, setActiveMode] = useState<VariableBarcodeMode>('WEIGHT');
    const [saving, setSaving] = useState(false);
    const loading = false; // kept for render guards below

    const config = configs[activeMode];
    const patchConfig = (p: Partial<BalanceBarcodeConfig>) =>
        setConfigs(prev => ({ ...prev, [activeMode]: { ...prev[activeMode], ...p } }));

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        // Fetch with a short timeout — if the endpoint is missing or Django
        // is slow, we stick with defaults rather than freezing the modal.
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
        Promise.race([getBalanceBarcodeConfigMap(), timeout]).then(res => {
            if (cancelled || !res || !(res as any).success || !(res as any).data) return;
            setConfigs((res as any).data);
        });
        return () => { cancelled = true; };
    }, [isOpen]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        const res = await updateBalanceBarcodeConfigMap(configs);
        if (res.success) {
            toast.success('Variable barcode configuration saved');
            onClose();
        } else {
            toast.error(res.error || 'Failed to save');
        }
        setSaving(false);
    }, [configs, onClose]);

    if (!isOpen) return null;

    const meta = modeMeta(config.mode);
    // When mode doesn't use decimals, force the decimal width to 0 in the
    // preview so the barcode layout reflects the effective structure.
    const effectiveDecDigits = meta.decAllowed ? config.weightDecDigits : 0;
    const totalDigits = 1 + config.itemDigits + config.weightIntDigits + effectiveDecDigits;
    const itemExample = '1'.repeat(config.itemDigits);
    const weightIntExample = '2'.repeat(config.weightIntDigits);
    const weightDecExample = '3'.repeat(effectiveDecDigits);
    const fullBarcode = `${config.prefix}${itemExample}${weightIntExample}${weightDecExample}`;
    const checkDigit = totalDigits <= 12 ? 'C' : '';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-4xl mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
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
                            <h3 className="text-tp-md" style={{ color: 'var(--app-foreground)' }}>
                                Variable Barcode Config
                            </h3>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                {meta.label}-embedded EAN-13 structure
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
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        {/* Landscape body: vertical tabs (left) + controls (middle) + preview (right) */}
                        <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[180px_minmax(0,1fr)] md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-0">

                            {/* LEFT: vertical mode tabs */}
                            <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar"
                                 style={{ borderRight: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                <div className="text-tp-xxs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Format
                                </div>
                                {BARCODE_EMBEDDABLE_TYPES.map(t => {
                                    const key = t.id as VariableBarcodeMode;
                                    const m = modeMeta(key);
                                    const active = activeMode === key;
                                    const slot = configs[key];
                                    return (
                                        <button key={key} type="button"
                                            onClick={() => setActiveMode(key)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                                            style={{
                                                background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                                border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                                color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                            }}>
                                            <m.Icon size={15} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-tp-sm font-bold">{m.label}</div>
                                                <div className="text-tp-xxs" style={{ color: slot.isEnabled ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                                                    {slot.isEnabled ? `prefix ${slot.prefix}` : 'off'}
                                                </div>
                                            </div>
                                            {slot.isEnabled && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--app-success)' }} />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* LEFT: controls */}
                            <div className="p-5 space-y-3 overflow-y-auto custom-scrollbar"
                                 style={{ borderRight: '1px solid var(--app-border)' }}>

                                {/* Enable toggle */}
                                <div className="flex items-center justify-between p-3 rounded-xl"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                    <div className="min-w-0">
                                        <div className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                            Enable {meta.label.toLowerCase()} barcodes
                                        </div>
                                        <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Enforce this {meta.label.toLowerCase()}-embedded structure.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => patchConfig({ isEnabled: !config.isEnabled })}
                                        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
                                        style={{ background: config.isEnabled ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }}
                                        aria-pressed={config.isEnabled}>
                                        <span className="pointer-events-none inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                                            style={{ transform: config.isEnabled ? 'translateX(22px)' : 'translateX(2px)', marginTop: '2px' }} />
                                    </button>
                                </div>

                                {/* Structure fields 2x2 */}
                                <div className="grid grid-cols-2 gap-3" style={{ opacity: config.isEnabled ? 1 : 0.4, pointerEvents: config.isEnabled ? 'auto' : 'none' }}>
                                    <StructureField label="Prefix" hint={`Default "${UNIT_TYPE_BY_ID[activeMode as UnitTypeId]?.barcodeRender?.prefix || ''}"`} maxLength={2}>
                                        <input type="text" value={config.prefix}
                                            onChange={e => patchConfig({ prefix: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                                            className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            maxLength={2} />
                                    </StructureField>

                                    <StructureField label="Item digits" hint="Product code length">
                                        <input type="number" value={config.itemDigits}
                                            onChange={e => patchConfig({ itemDigits: Math.max(1, Math.min(10, Number(e.target.value))) })}
                                            className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            min={1} max={10} />
                                    </StructureField>

                                    <StructureField label={meta.intLabel} hint={meta.intHint}>
                                        <input type="number" value={config.weightIntDigits}
                                            onChange={e => patchConfig({ weightIntDigits: Math.max(1, Math.min(5, Number(e.target.value))) })}
                                            className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            min={1} max={5} />
                                    </StructureField>

                                    <StructureField label={meta.decLabel} hint={meta.decHint} disabled={!meta.decAllowed}>
                                        <input type="number" value={config.weightDecDigits} disabled={!meta.decAllowed}
                                            onChange={e => patchConfig({ weightDecDigits: Math.max(0, Math.min(5, Number(e.target.value))) })}
                                            className="w-full px-3 py-2 rounded-xl text-tp-lg font-mono font-bold text-center outline-none transition-all disabled:opacity-40"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            min={0} max={5} />
                                    </StructureField>
                                </div>

                                {/* Info banner */}
                                <div className="flex items-start gap-2 p-2.5 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                    <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info)' }} />
                                    <span className="text-tp-xs leading-relaxed" style={{ color: 'var(--app-foreground)' }}>
                                        Same layout for all four modes — only the meaning of the variable digits changes. Use different prefixes so scanners can dispatch the right format.
                                    </span>
                                </div>
                            </div>

                            {/* RIGHT: live preview */}
                            <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col"
                                 style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                <div className="rounded-xl overflow-hidden flex-1 flex flex-col"
                                     style={{ border: '1px solid var(--app-border)', opacity: config.isEnabled ? 1 : 0.4, background: 'var(--app-surface)' }}>
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
                                    <div className="flex-1 px-4 py-5 flex flex-col items-center justify-center gap-4" style={{ background: 'var(--app-background)' }}>
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
                                                { label: `${meta.label} int`, color: 'var(--app-success)', count: config.weightIntDigits },
                                                ...(meta.decAllowed ? [{ label: `${meta.label} dec`, color: 'var(--app-warning)', count: config.weightDecDigits }] : []),
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
                                            Example: item <span className="font-bold" style={{ color: 'var(--app-info)' }}>#000042</span>{' '}
                                            {meta.humanExample(meta.exampleInt, meta.exampleDec)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 flex gap-2 flex-shrink-0"
                             style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                            <button onClick={onClose}
                                className="px-4 py-2.5 rounded-xl text-tp-sm font-bold transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                                Cancel
                            </button>
                            <div className="flex-1" />
                            <button onClick={handleSave} disabled={saving}
                                className="px-5 py-2.5 rounded-xl text-tp-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                <span>Save all four modes</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StructureField({ label, hint, children, disabled }: { label: string; hint: string; maxLength?: number; children: React.ReactNode; disabled?: boolean }) {
    return (
        <div className="space-y-1.5" style={{ opacity: disabled ? 0.45 : 1 }}>
            <label className="text-tp-xxs font-bold uppercase tracking-widest block" style={{ color: 'var(--app-muted-foreground)' }}>
                {label}
            </label>
            {children}
            <p className="text-tp-xxs text-center" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</p>
        </div>
    );
}
