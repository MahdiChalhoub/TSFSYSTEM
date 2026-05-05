'use client'

import { useState, useTransition } from 'react'
import {
    Settings2, Globe, Banknote, Eye, Shield, Lock,
    Sparkles, Check, X, Loader2, ExternalLink, Zap
} from 'lucide-react'
import { toggleOrgFeature } from '@/app/actions/features'
import type { FeatureStatus, FeatureMap } from '@/app/actions/features'
import { toast } from 'sonner'
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell'

const ICONS: Record<string, any> = {
    banknote: Banknote,
    globe: Globe,
    eye: Eye,
    shield: Shield,
    settings: Settings2,
}

export function FeaturesClient({ features: initialFeatures }: { features: FeatureMap }) {
    const [features, setFeatures] = useState<FeatureMap>(initialFeatures)
    const [togglingKey, setTogglingKey] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const featureList = Object.values(features)

    const handleToggle = (key: string, currentEnabled: boolean) => {
        const feature = features[key]
        if (!feature) return

        // Block if plan doesn't allow and trying to enable
        if (!currentEnabled && !feature.plan_allows) {
            toast.error('Plan upgrade required', {
                description: `Your plan (${feature.plan_name || 'None'}) does not include ${feature.label}. Please upgrade.`,
            })
            return
        }

        setTogglingKey(key)
        startTransition(async () => {
            const result = await toggleOrgFeature(key, !currentEnabled)
            if (result.success && result.feature) {
                setFeatures(prev => ({ ...prev, [key]: result.feature! }))
                toast.success(`${feature.label} ${!currentEnabled ? 'enabled' : 'disabled'}`)
            } else {
                toast.error('Failed to toggle feature', { description: result.error })
            }
            setTogglingKey(null)
        })
    }

    const enabledCount = featureList.filter(f => f.enabled).length

    return (
        <SettingsPageShell
            title="Feature Flags"
            subtitle={`${enabledCount} Active · Plan-Gated Features`}
            icon={<Zap size={20} className="text-white" />}
            configKey="features"
            config={features as any}
            hasChanges={false}
        >

            {/* ═══════════ INFO BANNER ═══════════ */}
            <div
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-[12px]"
                style={{
                    background: 'color-mix(in srgb, var(--app-accent) 5%, var(--app-surface))',
                    border: '1px solid color-mix(in srgb, var(--app-accent) 15%, transparent)',
                    color: 'var(--app-muted-foreground)',
                }}
            >
                <Sparkles size={16} style={{ color: 'var(--app-accent)', flexShrink: 0, marginTop: 1 }} />
                <div>
                    <span className="font-bold text-app-foreground">Features are gated by your subscription plan.</span>{' '}
                    Some features require a plan upgrade to enable. Toggle switches are disabled when your plan doesn&apos;t include the feature.
                </div>
            </div>

            {/* ═══════════ FEATURE CARDS ═══════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {featureList.map(feature => {
                    const FeatureIcon = ICONS[feature.icon] || Settings2
                    const isToggling = togglingKey === feature.key
                    const canToggle = feature.plan_allows
                    const isEnabled = feature.enabled

                    return (
                        <div
                            key={feature.key}
                            className="relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200"
                            style={{
                                background: isEnabled
                                    ? 'color-mix(in srgb, var(--app-accent) 4%, var(--app-surface))'
                                    : 'var(--app-surface)',
                                borderColor: isEnabled
                                    ? 'color-mix(in srgb, var(--app-accent) 25%, transparent)'
                                    : 'var(--app-border)',
                                opacity: canToggle ? 1 : 0.7,
                            }}
                        >
                            {/* Icon */}
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: isEnabled
                                        ? 'color-mix(in srgb, var(--app-accent) 12%, transparent)'
                                        : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    color: isEnabled ? 'var(--app-accent)' : 'var(--app-muted-foreground)',
                                }}
                            >
                                <FeatureIcon size={18} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-black text-app-foreground">{feature.label}</span>

                                    {isEnabled && (
                                        <span
                                            className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}
                                        >
                                            <Check size={8} /> Active
                                        </span>
                                    )}

                                    {!canToggle && (
                                        <span
                                            className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}
                                        >
                                            <Lock size={8} /> Upgrade
                                        </span>
                                    )}
                                </div>

                                <p className="text-[11px] text-app-muted-foreground mt-0.5 leading-relaxed">
                                    {feature.description}
                                </p>

                                {feature.plan_name && (
                                    <p className="text-[10px] text-app-muted-foreground mt-1 font-mono">
                                        Plan: {feature.plan_name}
                                    </p>
                                )}
                            </div>

                            {/* Toggle Switch */}
                            <button
                                onClick={() => handleToggle(feature.key, isEnabled)}
                                disabled={isToggling || !canToggle}
                                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                                style={{
                                    background: isEnabled
                                        ? 'var(--app-accent)'
                                        : 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                                }}
                                title={!canToggle ? 'Plan upgrade required' : (isEnabled ? 'Disable' : 'Enable')}
                            >
                                <span
                                    className="absolute top-0.5 w-5 h-5 rounded-full bg-app-surface shadow-sm transition-all duration-200 flex items-center justify-center"
                                    style={{ left: isEnabled ? '22px' : '2px' }}
                                >
                                    {isToggling ? (
                                        <Loader2 size={10} className="animate-spin" style={{ color: 'var(--app-accent)' }} />
                                    ) : isEnabled ? (
                                        <Check size={10} style={{ color: 'var(--app-accent)' }} />
                                    ) : (
                                        <X size={10} style={{ color: 'var(--app-muted-foreground)' }} />
                                    )}
                                </span>
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* ═══════════ BOTTOM NOTE ═══════════ */}
            {featureList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--app-accent) 8%, transparent)' }}>
                        <Settings2 size={24} style={{ color: 'var(--app-accent)' }} />
                    </div>
                    <h3>No Features Available</h3>
                    <p className="text-sm text-app-muted-foreground max-w-md">
                        Feature flags will appear here once your platform is configured with plan-gated features.
                    </p>
                </div>
            )}
        </SettingsPageShell>
    )
}
