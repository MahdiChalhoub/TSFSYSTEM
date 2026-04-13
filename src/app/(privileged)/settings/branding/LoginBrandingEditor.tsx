'use client'

import { useState, useCallback } from "react";
import { saveLoginBranding } from "@/app/actions/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Loader2, Save, Palette, Image as ImageIcon, Type, Eye,
    Fingerprint, User, Lock, ArrowRight, Globe, RotateCcw
} from "lucide-react";

interface BrandingData {
    brand_color?: string;
    bg_image?: string;
    tagline?: string;
}

const PRESET_COLORS = [
    '#10b981', // Emerald (default)
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4', // Cyan
];

export function LoginBrandingEditor({ initialBranding }: { initialBranding: BrandingData }) {
    const [branding, setBranding] = useState<BrandingData>(initialBranding || {});
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    const brandColor = branding.brand_color || '#10b981';
    const tagline = branding.tagline || '';
    const bgImage = branding.bg_image || '';

    const update = useCallback((key: keyof BrandingData, value: string) => {
        setBranding(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await saveLoginBranding(branding);
            if (result.success) {
                toast.success("Branding saved successfully");
            } else {
                toast.error(result.error || "Failed to save branding");
            }
        } catch (e) {
            toast.error("Failed to save branding");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setBranding({});
        toast.info("Reset to defaults. Click Save to apply.");
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-8">
            {/* ─── Controls Panel ─── */}
            <div className="space-y-6">
                {/* Brand Color */}
                <div className="rounded-2xl p-6 space-y-4"
                    style={{
                        background: 'var(--app-surface, #111827)',
                        border: '1px solid var(--app-border, #1e293b)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Palette size={20} style={{ color: brandColor }} />
                        <Label className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>
                            Brand Color
                        </Label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={brandColor}
                            onChange={e => update('brand_color', e.target.value)}
                            className="w-12 h-12 rounded-xl cursor-pointer border-2 p-1"
                            style={{ borderColor: 'var(--app-border, #1e293b)', background: 'var(--app-bg)' }}
                        />
                        <Input
                            value={brandColor}
                            onChange={e => update('brand_color', e.target.value)}
                            placeholder="#10b981"
                            className="h-12 rounded-xl font-mono text-sm flex-1"
                            style={{
                                background: 'var(--app-bg)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-text)',
                            }}
                        />
                    </div>

                    {/* Preset Colors */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {PRESET_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => update('brand_color', color)}
                                className="w-9 h-9 rounded-xl transition-all hover:scale-110 border-2"
                                style={{
                                    background: color,
                                    borderColor: brandColor === color ? '#fff' : 'transparent',
                                    boxShadow: brandColor === color ? `0 0 0 2px ${color}` : 'none',
                                }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>

                {/* Custom Tagline */}
                <div className="rounded-2xl p-6 space-y-4"
                    style={{
                        background: 'var(--app-surface, #111827)',
                        border: '1px solid var(--app-border, #1e293b)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Type size={20} style={{ color: brandColor }} />
                        <Label className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>
                            Custom Tagline
                        </Label>
                    </div>
                    <Input
                        value={tagline}
                        onChange={e => update('tagline', e.target.value)}
                        placeholder="Secure enterprise gateway. Authorized personnel only."
                        className="h-12 rounded-xl text-sm"
                        style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                        maxLength={120}
                    />
                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                        {tagline.length}/120 characters · Leave blank for default
                    </p>
                </div>

                {/* Background Image */}
                <div className="rounded-2xl p-6 space-y-4"
                    style={{
                        background: 'var(--app-surface, #111827)',
                        border: '1px solid var(--app-border, #1e293b)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <ImageIcon size={20} style={{ color: brandColor }} />
                        <Label className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>
                            Background Image
                        </Label>
                    </div>
                    <Input
                        value={bgImage}
                        onChange={e => update('bg_image', e.target.value)}
                        placeholder="https://your-cdn.com/background.jpg"
                        className="h-12 rounded-xl text-sm"
                        style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                    />
                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                        Paste a URL or use your cloud storage. Recommended: 1920×1080, dark tone.
                    </p>

                    {bgImage && (
                        <div className="relative rounded-xl overflow-hidden h-32"
                            style={{ border: '1px solid var(--app-border)' }}
                        >
                            <img
                                src={bgImage}
                                alt="Background preview"
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="h-12 px-8 rounded-xl font-bold text-sm uppercase tracking-wider flex-1"
                        style={{
                            background: brandColor,
                            color: '#fff',
                            boxShadow: `0 4px 16px color-mix(in srgb, ${brandColor} 30%, transparent)`,
                        }}
                    >
                        {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                        {saving ? "Saving..." : "Save Branding"}
                    </Button>

                    <Button
                        onClick={handleReset}
                        variant="outline"
                        className="h-12 px-6 rounded-xl font-bold text-sm"
                        style={{
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text-muted)',
                        }}
                    >
                        <RotateCcw className="mr-2" size={16} />
                        Reset
                    </Button>
                </div>
            </div>

            {/* ─── Live Preview Panel ─── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Eye size={16} style={{ color: brandColor }} />
                        <span className="text-xs font-black uppercase tracking-widest"
                            style={{ color: 'var(--app-text-muted)' }}
                        >
                            Live Preview
                        </span>
                    </div>
                    <button
                        onClick={() => setPreviewMode(!previewMode)}
                        className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                            background: `color-mix(in srgb, ${brandColor} 10%, transparent)`,
                            color: brandColor,
                        }}
                    >
                        {previewMode ? 'Desktop' : 'Mobile'}
                    </button>
                </div>

                <div className={`rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${previewMode ? 'max-w-sm mx-auto' : ''}`}
                    style={{
                        border: '1px solid var(--app-border)',
                        aspectRatio: previewMode ? '9/16' : '16/9',
                        maxHeight: '560px',
                    }}
                >
                    <div className={`h-full w-full grid ${previewMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {/* Preview Left */}
                        {!previewMode && (
                            <div className="relative flex flex-col justify-end p-8 overflow-hidden"
                                style={{ background: '#0a0f1e' }}
                            >
                                {bgImage ? (
                                    <img
                                        src={bgImage}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                                    />
                                ) : (
                                    <div className="absolute inset-0"
                                        style={{
                                            background: `
                                                radial-gradient(ellipse at 20% 50%, color-mix(in srgb, ${brandColor} 15%, transparent) 0%, transparent 60%),
                                                radial-gradient(ellipse at 80% 20%, color-mix(in srgb, ${brandColor} 8%, transparent) 0%, transparent 50%)
                                            `,
                                        }}
                                    />
                                )}
                                <div className="absolute inset-0"
                                    style={{ background: 'linear-gradient(to top, #0a0f1e 0%, transparent 50%)' }}
                                />
                                <div className="relative z-10 space-y-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
                                        style={{ background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, #6366f1))` }}
                                    >
                                        A
                                    </div>
                                    <h3 className="text-xl font-black text-white tracking-tight">YOUR BRAND</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {tagline || "Secure enterprise gateway. Authorized personnel only."}
                                    </p>
                                    <div className="flex items-center gap-3 pt-2">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: brandColor }} />
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Secured</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Encrypted</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Preview Right */}
                        <div className="flex flex-col items-center justify-center p-6"
                            style={{ background: '#111827' }}
                        >
                            <div className="w-full max-w-[200px] space-y-4">
                                {previewMode && (
                                    <div className="text-center mb-3">
                                        <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-black text-white mb-2"
                                            style={{ background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, #6366f1))` }}
                                        >
                                            A
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 rounded-lg"
                                        style={{ background: `color-mix(in srgb, ${brandColor} 10%, transparent)` }}
                                    >
                                        <Fingerprint size={12} style={{ color: brandColor }} />
                                    </div>
                                </div>

                                <h4 className="text-sm font-black text-white">Welcome Back</h4>
                                <p className="text-[8px] text-slate-400">Enter your credentials</p>

                                {/* Mini form */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center gap-2 h-7 rounded-lg px-2"
                                        style={{ background: '#0f172a', border: `1.5px solid color-mix(in srgb, ${brandColor} 30%, #1e293b)` }}
                                    >
                                        <User size={10} className="text-slate-500" />
                                        <span className="text-[8px] text-slate-500">Username</span>
                                    </div>
                                    <div className="flex items-center gap-2 h-7 rounded-lg px-2"
                                        style={{ background: '#0f172a', border: '1.5px solid #1e293b' }}
                                    >
                                        <Lock size={10} className="text-slate-500" />
                                        <span className="text-[8px] text-slate-500">Password</span>
                                    </div>
                                </div>

                                <button className="w-full h-7 rounded-lg text-white text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"
                                    style={{
                                        background: brandColor,
                                        boxShadow: `0 2px 8px color-mix(in srgb, ${brandColor} 30%, transparent)`,
                                    }}
                                >
                                    Sign In <ArrowRight size={10} />
                                </button>

                                <p className="text-[6px] text-center text-slate-600 pt-1">
                                    Powered by Blanc Engine · E2E Encrypted
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview info */}
                <div className="text-center">
                    <p className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                        This is a simplified preview. The actual login page may appear slightly different.
                    </p>
                </div>
            </div>
        </div>
    );
}
