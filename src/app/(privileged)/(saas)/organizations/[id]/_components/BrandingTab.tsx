'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Loader2, Save, Palette, Image as ImageIcon, Type,
    Fingerprint, User, Lock, ArrowRight, RotateCcw
} from "lucide-react";

interface BrandingData {
    brand_color?: string;
    bg_image?: string;
    tagline?: string;
}

const PRESET_COLORS = [
    '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

interface BrandingTabProps {
    orgId: string;
    orgSettings: Record<string, any>;
    onSave: (settings: Record<string, any>) => Promise<void>;
}

export function BrandingTab({ orgId, orgSettings, onSave }: BrandingTabProps) {
    const [branding, setBranding] = useState<BrandingData>(orgSettings?.login_branding || {});
    const [saving, setSaving] = useState(false);

    const brandColor = branding.brand_color || '#10b981';
    const tagline = branding.tagline || '';
    const bgImage = branding.bg_image || '';

    const update = (key: keyof BrandingData, value: string) => {
        setBranding(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedSettings = {
                ...orgSettings,
                login_branding: branding,
            };
            await onSave(updatedSettings);
            toast.success("Tenant branding saved");
        } catch (e) {
            toast.error("Failed to save branding");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
                {/* Brand Color */}
                <div className="rounded-2xl p-5 space-y-3"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2">
                        <Palette size={18} style={{ color: brandColor }} />
                        <Label className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Brand Color</Label>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={brandColor}
                            onChange={e => update('brand_color', e.target.value)}
                            className="w-10 h-10 rounded-lg cursor-pointer border p-0.5"
                            style={{ borderColor: 'var(--app-border)', background: 'var(--app-bg)' }}
                        />
                        <Input value={brandColor} onChange={e => update('brand_color', e.target.value)}
                            className="h-10 rounded-lg font-mono text-xs flex-1"
                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map(c => (
                            <button key={c} onClick={() => update('brand_color', c)}
                                className="w-7 h-7 rounded-lg transition-transform hover:scale-110 border"
                                style={{
                                    background: c,
                                    borderColor: brandColor === c ? '#fff' : 'transparent',
                                    boxShadow: brandColor === c ? `0 0 0 2px ${c}` : 'none',
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Tagline */}
                <div className="rounded-2xl p-5 space-y-3"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2">
                        <Type size={18} style={{ color: brandColor }} />
                        <Label className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Tagline</Label>
                    </div>
                    <Input value={tagline} onChange={e => update('tagline', e.target.value)}
                        placeholder="Custom login page tagline..."
                        className="h-10 rounded-lg text-sm"
                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                        maxLength={120}
                    />
                </div>

                {/* Background Image */}
                <div className="rounded-2xl p-5 space-y-3"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2">
                        <ImageIcon size={18} style={{ color: brandColor }} />
                        <Label className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Background Image</Label>
                    </div>
                    <Input value={bgImage} onChange={e => update('bg_image', e.target.value)}
                        placeholder="https://..."
                        className="h-10 rounded-lg text-sm"
                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                    />
                    {bgImage && (
                        <div className="rounded-lg overflow-hidden h-24"
                            style={{ border: '1px solid var(--app-border)' }}
                        >
                            <img src={bgImage} alt="BG" className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}
                        className="h-10 px-6 rounded-xl font-bold text-sm flex-1"
                        style={{ background: brandColor, color: '#fff' }}
                    >
                        {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                        {saving ? "Saving..." : "Save Branding"}
                    </Button>
                    <Button onClick={() => setBranding({})} variant="outline"
                        className="h-10 px-4 rounded-xl"
                        style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
                    >
                        <RotateCcw size={14} />
                    </Button>
                </div>
            </div>

            {/* Mini Preview */}
            <div className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--app-border)', aspectRatio: '16/10', minHeight: 300 }}
            >
                <div className="h-full w-full grid grid-cols-2">
                    <div className="relative flex flex-col justify-end p-6 overflow-hidden" style={{ background: '#0a0f1e' }}>
                        {bgImage ? (
                            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        ) : (
                            <div className="absolute inset-0" style={{
                                background: `radial-gradient(ellipse at 20% 50%, color-mix(in srgb, ${brandColor} 15%, transparent), transparent 60%)`,
                            }} />
                        )}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a0f1e 0%, transparent 50%)' }} />
                        <div className="relative z-10 space-y-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white"
                                style={{ background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 60%, #6366f1))` }}
                            >T</div>
                            <h4 className="text-base font-black text-white">TENANT</h4>
                            <p className="text-[9px] text-slate-400">{tagline || "Secure enterprise gateway."}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-5" style={{ background: '#111827' }}>
                        <div className="w-full max-w-[160px] space-y-2.5">
                            <div className="flex items-center gap-1.5"><Fingerprint size={10} style={{ color: brandColor }} /></div>
                            <h5 className="text-xs font-black text-white">Welcome Back</h5>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 h-6 rounded px-2"
                                    style={{ background: '#0f172a', border: `1px solid color-mix(in srgb, ${brandColor} 30%, #1e293b)` }}
                                ><User size={8} className="text-slate-500" /><span className="text-[7px] text-slate-500">Username</span></div>
                                <div className="flex items-center gap-1.5 h-6 rounded px-2"
                                    style={{ background: '#0f172a', border: '1px solid #1e293b' }}
                                ><Lock size={8} className="text-slate-500" /><span className="text-[7px] text-slate-500">Password</span></div>
                            </div>
                            <button className="w-full h-6 rounded text-white text-[7px] font-bold flex items-center justify-center gap-1"
                                style={{ background: brandColor }}
                            >Sign In <ArrowRight size={8} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
