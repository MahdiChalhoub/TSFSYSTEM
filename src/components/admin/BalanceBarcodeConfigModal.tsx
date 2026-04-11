'use client';

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
            toast.success('Balance barcode configuration saved');
            onClose();
        } else {
            toast.error(res.error || 'Failed to save');
        }
        setSaving(false);
    }, [config, onClose]);

    if (!isOpen) return null;

    // Build barcode preview
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
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-warning)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                            <Scale size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Balance Barcode Config</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">Global scale barcode structure</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-2">
                        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                        <span className="text-[12px] font-bold text-app-muted-foreground">Loading config...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-5 space-y-5">

                            {/* Info Banner */}
                            <div className="flex items-start gap-2.5 p-3 rounded-xl text-[11px]"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>
                                <Info size={14} className="flex-shrink-0 mt-0.5" />
                                <span>This configuration defines the barcode structure for <strong>all weighed/scale items</strong>. Products using balance units will follow this rule.</span>
                            </div>

                            {/* Enable Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <div>
                                    <span className="text-[12px] font-bold text-app-foreground">Enable Balance Barcodes</span>
                                    <p className="text-[10px] text-app-muted-foreground">Enforce barcode structure for scale items</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setConfig(c => ({ ...c, isEnabled: !c.isEnabled }))}
                                    className="w-10 h-5 rounded-full transition-all duration-200 relative flex-shrink-0"
                                    style={{
                                        background: config.isEnabled ? 'var(--app-primary)' : 'var(--app-border)',
                                    }}
                                >
                                    <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200"
                                        style={{ left: config.isEnabled ? '22px' : '2px' }} />
                                </button>
                            </div>

                            {/* Structure Fields */}
                            <div className="grid grid-cols-2 gap-3" style={{ opacity: config.isEnabled ? 1 : 0.4, pointerEvents: config.isEnabled ? 'auto' : 'none' }}>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Prefix</label>
                                    <input
                                        type="text"
                                        value={config.prefix}
                                        onChange={e => setConfig(c => ({ ...c, prefix: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                                        className="w-full px-3 py-2.5 rounded-xl text-[14px] font-mono font-bold text-center text-app-foreground outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                        maxLength={2}
                                    />
                                    <p className="text-[9px] text-app-muted-foreground text-center">Usually "2"</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Item Digits</label>
                                    <input
                                        type="number"
                                        value={config.itemDigits}
                                        onChange={e => setConfig(c => ({ ...c, itemDigits: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                                        className="w-full px-3 py-2.5 rounded-xl text-[14px] font-mono font-bold text-center text-app-foreground outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                        min={1}
                                        max={10}
                                    />
                                    <p className="text-[9px] text-app-muted-foreground text-center">Product code length</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Weight Integer</label>
                                    <input
                                        type="number"
                                        value={config.weightIntDigits}
                                        onChange={e => setConfig(c => ({ ...c, weightIntDigits: Math.max(1, Math.min(5, Number(e.target.value))) }))}
                                        className="w-full px-3 py-2.5 rounded-xl text-[14px] font-mono font-bold text-center text-app-foreground outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                        min={1}
                                        max={5}
                                    />
                                    <p className="text-[9px] text-app-muted-foreground text-center">Whole kg/lb digits</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Weight Decimal</label>
                                    <input
                                        type="number"
                                        value={config.weightDecDigits}
                                        onChange={e => setConfig(c => ({ ...c, weightDecDigits: Math.max(0, Math.min(5, Number(e.target.value))) }))}
                                        className="w-full px-3 py-2.5 rounded-xl text-[14px] font-mono font-bold text-center text-app-foreground outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                        min={0}
                                        max={5}
                                    />
                                    <p className="text-[9px] text-app-muted-foreground text-center">Fractional digits</p>
                                </div>
                            </div>

                            {/* Live Barcode Preview */}
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)', opacity: config.isEnabled ? 1 : 0.4 }}>
                                <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                                    <BarChart3 size={12} className="text-app-muted-foreground" />
                                    <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Live Preview</span>
                                    <span className="text-[9px] font-bold text-app-muted-foreground ml-auto">{fullBarcode.length + (checkDigit ? 1 : 0)} digits total</span>
                                </div>
                                <div className="px-4 py-4 flex flex-col items-center gap-3" style={{ background: 'var(--app-background)' }}>
                                    {/* Color-coded barcode */}
                                    <div className="flex items-center font-mono text-[18px] md:text-[22px] font-black tracking-[0.15em]">
                                        <span style={{ color: 'var(--app-error)' }}>{config.prefix}</span>
                                        <span style={{ color: 'var(--app-info)' }}>{itemExample}</span>
                                        <span style={{ color: 'var(--app-success)' }}>{weightIntExample}</span>
                                        <span style={{ color: 'var(--app-warning)' }}>{weightDecExample}</span>
                                        {checkDigit && <span className="text-app-muted-foreground">{checkDigit}</span>}
                                    </div>

                                    {/* Legend */}
                                    <div className="flex flex-wrap items-center gap-3 justify-center">
                                        {[
                                            { label: 'Prefix', color: 'var(--app-error)', count: config.prefix.length },
                                            { label: 'Item Code', color: 'var(--app-info)', count: config.itemDigits },
                                            { label: 'Weight Int', color: 'var(--app-success)', count: config.weightIntDigits },
                                            { label: 'Weight Dec', color: 'var(--app-warning)', count: config.weightDecDigits },
                                            ...(checkDigit ? [{ label: 'Check', color: 'var(--app-muted-foreground)', count: 1 }] : []),
                                        ].map(l => (
                                            <div key={l.label} className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                                                <span className="text-[9px] font-bold text-app-muted-foreground">{l.label} ({l.count})</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Human readable example */}
                                    <div className="text-[10px] text-app-muted-foreground text-center mt-1">
                                        Example: Item <span className="font-bold" style={{ color: 'var(--app-info)' }}>#000042</span> weighing{' '}
                                        <span className="font-bold" style={{ color: 'var(--app-success)' }}>1</span>.
                                        <span className="font-bold" style={{ color: 'var(--app-warning)' }}>250</span> kg
                                        → <span className="font-mono font-bold text-app-foreground">{config.prefix}000042001250{checkDigit || ''}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 pt-0 flex gap-2">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                <span>Save Configuration</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
