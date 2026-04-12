// @ts-nocheck
'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { getPurchaseAnalyticsConfig, savePurchaseAnalyticsConfig, getConfigHistory } from '@/app/actions/settings/purchase-analytics-config';
import type { PurchaseAnalyticsConfig, ConfigHistoryEntry } from '@/app/actions/settings/purchase-analytics-config';
import {
    getAnalyticsProfiles, activateProfile, deleteProfile, updateProfile, createProfile
} from '@/app/actions/settings/analytics-profiles';
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants';
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles';
import AnalyticsProfileSelector from '@/components/analytics/AnalyticsProfileSelector';
import {
    Save, Loader2, BarChart3, ShoppingCart, TrendingUp,
    Shield, Calculator, CheckCircle2,
    Layers, User, ArrowLeft, Eye, Plus, X,
    Copy, Download, Upload, Activity, RotateCcw,
    ChevronDown, ChevronRight, AlertTriangle, Search,
    Home, Info, Undo2, Zap, Printer, FileJson, History, ClipboardPaste, Heart, GripVertical,
    ChevronUp, Lock, Unlock
} from 'lucide-react';

/* ── Extracted lib ── */
import {
    pageWrap, pageHeader, pageTitle, pageSub, card, cardHead, cardTitle, cardBody,
    fieldLabel, fieldHint, fieldSelect, fieldInput, toggleBtn,
    PERIOD_OPTIONS, CONFIG_PRESETS, FIELD_HELP, QUICK_PRESETS,
    SECTION_DEFAULTS, DEFAULTS,
    periodLabel, formulaLabel, contextLabel, sourceLabel,
} from './_lib/constants';
import {
    getFieldStatus, computeConfigScore, computeScoreBreakdown,
    computeCompleteness, computeSuggestions, computeWarnings,
} from './_lib/validation';

/* ── Extracted components ── */
import { CompareModal } from './_components/CompareModal';
import { HistoryModal } from './_components/HistoryModal';
import { DiffModal } from './_components/DiffModal';
import { DiffPreviewModal } from './_components/DiffPreviewModal';
import { ShortcutOverlay } from './_components/ShortcutOverlay';
import { TemplateManager } from './_components/TemplateManager';

function FieldHelp({ field }: { field: string }) {
    const [show, setShow] = useState(false);
    const help = FIELD_HELP[field];
    if (!help) return null;
    return (
        <span className="relative inline-flex">
            <button type="button" className="text-app-muted-foreground/40 hover:text-app-primary transition-colors"
                onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={() => setShow(!show)}>
                <Info size={9} />
            </button>
            {show && (
                <div className="absolute z-50 left-4 top-0 w-[200px] p-2 rounded-lg bg-app-surface border border-app-border shadow-xl text-[9px] text-app-muted-foreground leading-relaxed animate-[fadeIn_0.1s_ease-in-out]">
                    {help}
                </div>
            )}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function PurchaseAnalyticsSettingsPage() {
    const [config, setConfig] = useState<PurchaseAnalyticsConfig | null>(null);
    const [profilesData, setProfilesData] = useState<AnalyticsProfilesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [editingProfile, setEditingProfile] = useState<AnalyticsProfile | null>(null);
    const [profileOverrides, setProfileOverrides] = useState<Record<string, any>>({});
    // Create mode
    const [creatingForContext, setCreatingForContext] = useState<string | null>(null);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileVisibility, setNewProfileVisibility] = useState<'organization' | 'personal'>('organization');
    // Compare mode
    const [compareProfiles, setCompareProfiles] = useState<[AnalyticsProfile, AnalyticsProfile] | null>(null);
    // Import
    const importRef = useRef<HTMLInputElement>(null);
    // Collapsed cards
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggleCard = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    // Expand/Collapse All sections
    const [allCollapsed, setAllCollapsed] = useState(false);
    // Sync expand/collapse all
    useEffect(() => {
        const sections = ['sales', 'window', 'formula', 'price', 'display', 'profiles'];
        setCollapsed(Object.fromEntries(sections.map(s => [s, allCollapsed])));
    }, [allCollapsed]);
    // Search filter
    const [configSearch, setConfigSearch] = useState('');
    // Confirm reset
    const [confirmResetAll, setConfirmResetAll] = useState(false);
    // Undo history
    const [undoStack, setUndoStack] = useState<Array<{ key: string; prev: any; configSnapshot?: PurchaseAnalyticsConfig }>>([]);
    // Profile hover preview
    const [hoverProfile, setHoverProfile] = useState<AnalyticsProfile | null>(null);
    // Sticky save bar
    const [scrolled, setScrolled] = useState(false);
    // Diff preview
    const [showDiffPreview, setShowDiffPreview] = useState(false);
    const [originalConfig, setOriginalConfig] = useState<PurchaseAnalyticsConfig | null>(null);
    // History
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState<ConfigHistoryEntry[]>([]);
    // Drag-and-drop page context ordering
    const [pageOrder, setPageOrder] = useState<string[]>(Object.keys(PAGE_CONTEXT_LABELS));
    const [draggedCtx, setDraggedCtx] = useState<string | null>(null);
    const [dragOverCtx, setDragOverCtx] = useState<string | null>(null);
    // Keyboard shortcut overlay
    const [showShortcuts, setShowShortcuts] = useState(false);
    // Config templates
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    // Config field search
    const [fieldSearch, setFieldSearch] = useState('');
    // Locked fields (prevent accidental edits)
    const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
    const toggleFieldLock = (field: string) => {
        setLockedFields(prev => {
            const next = new Set(prev);
            next.has(field) ? next.delete(field) : next.add(field);
            return next;
        });
    };
    // Quick presets — imported from _lib/constants
    const applyPreset = (key: string) => {
        const preset = QUICK_PRESETS[key];
        if (!preset || !config) return;
        setConfig(prev => prev ? { ...prev, ...preset.values } : prev);
        toast.success(`Applied "${preset.label}" preset`);
    };
    // Config completeness meter — delegated to _lib/validation
    const completenessScore = config ? computeCompleteness(config) : 0;

    // Auto-save drafts to localStorage
    useEffect(() => {
        if (editingProfile && Object.keys(profileOverrides).length > 0) {
            localStorage.setItem(`pa_draft_${editingProfile.id}`, JSON.stringify(profileOverrides));
        }
    }, [profileOverrides, editingProfile]);

    // Restore draft on profile select
    const restoreDraft = (profile: AnalyticsProfile) => {
        const draft = localStorage.getItem(`pa_draft_${profile.id}`);
        if (draft) {
            try { return JSON.parse(draft); } catch { return null; }
        }
        return null;
    };

    useEffect(() => {
        (async () => {
            const [cfg, prof] = await Promise.all([
                getPurchaseAnalyticsConfig(),
                getAnalyticsProfiles(),
            ]);
            setConfig(cfg);
            setOriginalConfig(JSON.parse(JSON.stringify(cfg)));
            setProfilesData(prof);
            setLoading(false);
        })();

        // Scroll listener for sticky save
        const onScroll = () => setScrolled(window.scrollY > 300);
        window.addEventListener('scroll', onScroll, { passive: true });

        // Presence heartbeat (every 30s)
        const presenceInterval = setInterval(async () => {
            try {
                const fresh = await getPurchaseAnalyticsConfig();
                if (fresh && config) {
                    setConfig(prev => prev ? { ...prev, _active_editors: fresh._active_editors, _user_role: fresh._user_role, _restricted_fields: fresh._restricted_fields } : prev);
                }
            } catch {}
        }, 30000);

        return () => {
            window.removeEventListener('scroll', onScroll);
            clearInterval(presenceInterval);
        };
    }, []);

    const reloadProfiles = async () => {
        const prof = await getAnalyticsProfiles();
        setProfilesData(prof);
    };

    const handleSave = () => {
        if (!config) return;
        startTransition(async () => {
            const result = await savePurchaseAnalyticsConfig(config);
            if (result.success) {
                setSaved(true); setLastSavedAt(new Date());
                setTimeout(() => setSaved(false), 3000);
            }
        });
    };

    // RBAC helper
    const isFieldRestricted = (key: string) => (config?._restricted_fields || []).includes(key);

    // Flash animation on field change
    const [flashField, setFlashField] = useState<string | null>(null);

    const update = (key: keyof PurchaseAnalyticsConfig, value: any) => {
        // RBAC: block restricted fields
        if (isFieldRestricted(key as string)) return;

        // Trigger flash
        setFlashField(key as string);
        setTimeout(() => setFlashField(null), 600);

        if (editingProfile) {
            const prevVal = profileOverrides[key as string];
            setUndoStack(prev => [...prev.slice(-19), { key: key as string, prev: prevVal }]);
            setProfileOverrides(prev => ({ ...prev, [key]: value }));
            return;
        }
        if (!config) return;
        setUndoStack(prev => [...prev.slice(-19), { key: key as string, prev: config[key], configSnapshot: config }]);
        setConfig({ ...config, [key]: value });
    };

    // Clipboard import
    const handleClipboardImport = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            if (typeof parsed === 'object' && parsed.sales_avg_period_days !== undefined) {
                Object.entries(parsed).forEach(([k, v]) => {
                    if (!k.startsWith('_')) update(k as any, v);
                });
            }
        } catch {}
    };

    // Config health score — delegated to _lib/validation
    const configScore = config ? computeConfigScore(config) : 100;

    // Health score breakdown — delegated to _lib/validation
    const scoreBreakdown = config ? computeScoreBreakdown(config) : [];
    const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

    // Config URL sharing
    const handleShareUrl = () => {
        if (!config) return;
        const { _last_modified_by, _last_modified_at, _version_count, _user_role, _restricted_fields, _active_editors, ...clean } = config as any;
        const encoded = btoa(JSON.stringify(clean));
        const url = `${window.location.origin}${window.location.pathname}#config=${encoded}`;
        navigator.clipboard.writeText(url);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Load config from URL hash on mount
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.startsWith('#config=')) {
            try {
                const decoded = JSON.parse(atob(hash.slice(8)));
                if (decoded && typeof decoded === 'object' && decoded.sales_avg_period_days) {
                    setConfig(prev => prev ? { ...prev, ...decoded } : prev);
                    window.history.replaceState(null, '', window.location.pathname);
                }
            } catch {}
        }
    }, []);

    // Section defaults — imported from _lib/constants
    const resetSection = (section: string) => {
        const defaults = SECTION_DEFAULTS[section];
        if (!defaults || !config) return;
        Object.entries(defaults).forEach(([k, v]) => update(k as any, v));
    };

    // Auto-optimization suggestions — delegated to _lib/validation
    const suggestions = config ? computeSuggestions(config, val, valWeight) : [];
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Changelog generator
    const generateChangelog = () => {
        if (!config || !originalConfig) return '';
        const changes: string[] = [];
        Object.keys(config).forEach(k => {
            if (k.startsWith('_')) return;
            const oldVal = (originalConfig as any)[k];
            const newVal = (config as any)[k];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changes.push(`- **${k.replace(/_/g, ' ')}**: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
            }
        });
        if (changes.length === 0) return 'No unsaved changes.';
        return `## Purchase Analytics Config Changes\n\n${changes.join('\n')}\n\n_Generated ${new Date().toLocaleString()}_`;
    };

    // Auto-save draft state (useEffect relocated below `hasChanges` definition to avoid TDZ)
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

    // Restore draft on mount
    useEffect(() => {
        const draft = localStorage.getItem('pa_draft_autosave');
        if (draft && config) {
            try {
                const parsed = JSON.parse(draft);
                if (JSON.stringify(parsed) !== JSON.stringify(config)) {
                    setDraftSavedAt('restored');
                }
            } catch {}
        }
    }, []);

    // Field validation rules
    // Field validation — imported from _lib/validation
    const statusDot = (status: 'ok' | 'warn' | 'error' | null) => {
        if (!status) return null;
        const colors = { ok: 'bg-emerald-500', warn: 'bg-amber-500', error: 'bg-red-500' };
        return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status]}`} />;
    };

    // Diff viewer
    const [showDiff, setShowDiff] = useState(false);
    const diffEntries = (() => {
        if (!config || !originalConfig) return [];
        return Object.keys(config)
            .filter(k => !k.startsWith('_'))
            .map(k => ({
                field: k,
                oldVal: (originalConfig as any)[k],
                newVal: (config as any)[k],
                changed: JSON.stringify((originalConfig as any)[k]) !== JSON.stringify((config as any)[k]),
            }))
            .filter(e => e.changed);
    })();

    // Default value hints — DEFAULTS imported from _lib/constants
    const defaultHint = (field: string, currentVal: any) => {
        const def = DEFAULTS[field];
        if (def === undefined || JSON.stringify(def) === JSON.stringify(currentVal)) return null;
        return <span className="text-[8px] text-app-muted-foreground/50 ml-1">(default: {String(def)})</span>;
    };

    const handleUndo = () => {
        if (undoStack.length === 0) return;
        const last = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        if (editingProfile) {
            if (last.prev === undefined) {
                setProfileOverrides(prev => { const n = { ...prev }; delete n[last.key]; return n; });
            } else {
                setProfileOverrides(prev => ({ ...prev, [last.key]: last.prev }));
            }
        } else if (config) {
            setConfig({ ...config, [last.key]: last.prev });
        }
    };

    const updateWeight = (key: string, value: number) => {
        if (editingProfile) {
            const weights = profileOverrides.financial_score_weights || config?.financial_score_weights || {};
            setProfileOverrides(prev => ({
                ...prev,
                financial_score_weights: { ...weights, [key]: value },
            }));
            return;
        }
        if (!config) return;
        setConfig({
            ...config,
            financial_score_weights: {
                ...config.financial_score_weights,
                [key]: value,
            },
        });
    };

    // Get effective value: profile override → global config
    const val = (key: string) => {
        if ((editingProfile || creatingForContext) && key in profileOverrides) {
            return profileOverrides[key];
        }
        return (config as any)?.[key];
    };

    const valWeight = (key: string) => {
        if ((editingProfile || creatingForContext) && profileOverrides.financial_score_weights) {
            return profileOverrides.financial_score_weights[key] ?? (config?.financial_score_weights as any)?.[key];
        }
        return (config?.financial_score_weights as any)?.[key];
    };

    const isOverridden = (key: string) => (editingProfile || creatingForContext) ? key in profileOverrides : false;

    const clearOverride = (key: string) => {
        const next = { ...profileOverrides };
        delete next[key];
        setProfileOverrides(next);
    };

    const clearWeightOverride = () => {
        const next = { ...profileOverrides };
        delete next['financial_score_weights'];
        setProfileOverrides(next);
    };

    // Ghost default: shows global value when field is overridden
    const globalVal = (key: string) => (config as any)?.[key];
    const globalWeight = (key: string) => (config?.financial_score_weights as any)?.[key];

    // Human-readable default label for select-type fields
    // Label helpers — imported from _lib/constants

    const handleSelectProfile = (profile: AnalyticsProfile) => {
        setEditingProfile(profile);
        // Try to restore draft, fallback to profile overrides
        const draft = restoreDraft(profile);
        setProfileOverrides(draft || profile.overrides || {});
        setSaved(false);
    };

    const handleBackToGlobal = () => {
        // Clear draft on explicit back
        if (editingProfile) localStorage.removeItem(`pa_draft_${editingProfile.id}`);
        setEditingProfile(null);
        setProfileOverrides({});
        setCreatingForContext(null);
        setNewProfileName('');
        setSaved(false);
    };

    const handleStartCreate = (ctx: string) => {
        setEditingProfile(null);
        setCreatingForContext(ctx);
        setProfileOverrides({});
        setNewProfileName('');
        setNewProfileVisibility('organization');
        setSaved(false);
    };

    // #6 Duplicate
    const handleDuplicate = (profile: AnalyticsProfile) => {
        setEditingProfile(null);
        setCreatingForContext(profile.page_context);
        setProfileOverrides({ ...profile.overrides });
        setNewProfileName(`${profile.name} (Copy)`);
        setNewProfileVisibility('organization');
        setSaved(false);
    };

    // #10 Export
    const handleExport = (profile: AnalyticsProfile) => {
        const data = {
            name: profile.name,
            page_context: profile.page_context,
            overrides: profile.overrides,
            exported_at: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `profile_${profile.name.replace(/\s+/g, '_').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // #10 Import
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.name && data.overrides) {
                setEditingProfile(null);
                setCreatingForContext(data.page_context || Object.keys(PAGE_CONTEXT_LABELS)[0]);
                setProfileOverrides(data.overrides);
                setNewProfileName(data.name + ' (Imported)');
                setNewProfileVisibility('organization');
            }
        } catch {
            alert('Invalid JSON file');
        }
        e.target.value = '';
    };

    // #9 Compare
    const handleCompare = (profile: AnalyticsProfile) => {
        const allProfiles = profilesData?.profiles?.filter(p => p.page_context === profile.page_context) || [];
        if (allProfiles.length >= 2) {
            setCompareProfiles([allProfiles[0], allProfiles[1]]);
        }
    };

    // #8 Preview helper: simulated values based on current settings
    const previewData = [
        { product: 'Widget A', sold: 450, stock: 30 },
        { product: 'Gadget B', sold: 120, stock: 80 },
        { product: 'Part C', sold: 900, stock: 5 },
    ];
    const getPreview = () => {
        const days = val('sales_avg_period_days') || 180;
        const lead = val('proposed_qty_lead_days') || 30;
        const safety = val('proposed_qty_safety_multiplier') || 1.0;
        return previewData.map(r => {
            const avgDaily = r.sold / days;
            const proposed = Math.max(0, Math.round(avgDaily * lead * safety - r.stock));
            return { ...r, avgDaily: avgDaily.toFixed(1), proposed };
        });
    };

    const isEditMode = !!editingProfile;
    const isCreateMode = !!creatingForContext;
    const isProfileMode = isEditMode || isCreateMode;
    const overrideCount = Object.keys(profileOverrides).length;
    const isDirty = isProfileMode ? overrideCount > 0 : false;

    // Config validation warnings — delegated to _lib/validation
    const warnings = computeWarnings(val, valWeight);
    const getWarning = (field: string) => warnings.find(w => w.field === field);

    // Card visibility based on search filter
    const searchLower = configSearch.toLowerCase();
    const cardVisible = (keywords: string) => !configSearch || keywords.toLowerCase().includes(searchLower);

    // Unsaved changes detection
    const hasChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

    // Auto-save draft to localStorage every 30s (RELOCATED from above to avoid TDZ on hasChanges)
    useEffect(() => {
        if (!config || !hasChanges) return;
        const timer = setInterval(() => {
            localStorage.setItem('pa_draft_autosave', JSON.stringify(config));
            setDraftSavedAt(new Date().toLocaleTimeString());
        }, 30000);
        return () => clearInterval(timer);
    }, [config, hasChanges]);

    // Keyboard shortcuts: Escape to go back, Ctrl+S to save
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isProfileMode) {
                handleBackToGlobal();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (isCreateMode) {
                    if (!newProfileName.trim()) return;
                    startTransition(async () => {
                        await createProfile(newProfileName, creatingForContext!, profileOverrides, newProfileVisibility);
                        await reloadProfiles();
                        handleBackToGlobal();
                        setSaved(true); setLastSavedAt(new Date());
                        setTimeout(() => setSaved(false), 3000);
                    });
                } else if (editingProfile) {
                    startTransition(async () => {
                        await updateProfile(editingProfile.id, { overrides: profileOverrides });
                        await reloadProfiles();
                        setSaved(true); setLastSavedAt(new Date());
                        setTimeout(() => setSaved(false), 3000);
                    });
                } else {
                    handleSave();
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            // ? key → shortcut overlay
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target as any)?.closest?.('input,select,textarea')) {
                e.preventDefault();
                setShowShortcuts(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isProfileMode, isCreateMode, editingProfile, profileOverrides, config, undoStack]);

    if (loading || !config) {
        return (
            <div className={pageWrap}>
                <div className="mb-3">
                    <div className="h-5 w-[300px] rounded-lg bg-app-border/30 animate-pulse mb-2" />
                    <div className="h-3 w-[450px] rounded bg-app-border/20 animate-pulse" />
                </div>
                <div className={card}>
                    <div className="px-3 py-2 border-b border-app-border/20">
                        <div className="h-3 w-[100px] rounded bg-app-border/30 animate-pulse" />
                    </div>
                    {[1,2,3,4].map(i => (
                        <div key={i} className="px-3 py-3 flex items-center gap-4 border-b border-app-border/10 last:border-0">
                            <div className="h-3 w-[120px] rounded bg-app-border/20 animate-pulse" />
                            <div className="h-3 w-[160px] rounded bg-app-border/20 animate-pulse" />
                            <div className="h-3 w-[40px] rounded bg-app-border/20 animate-pulse" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className={card}>
                            <div className="px-3 py-3">
                                <div className="h-4 w-[140px] rounded bg-app-border/30 animate-pulse mb-3" />
                                <div className="space-y-3">
                                    <div className="h-8 rounded-lg bg-app-border/15 animate-pulse" />
                                    <div className="h-8 rounded-lg bg-app-border/15 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const weightTotal = (valWeight('margin') || 0) +
        (valWeight('velocity') || 0) +
        (valWeight('stock_health') || 0);

    return (
        <div className={pageWrap}>
            {/* Breadcrumb */}
            <nav className="mb-2 flex items-center gap-1.5 text-[10px] text-app-muted-foreground">
                <Home size={10} />
                <span>/</span>
                <span>Settings</span>
                <span>/</span>
                <span className={isProfileMode ? 'cursor-pointer hover:text-app-foreground transition-colors' : 'text-app-foreground font-bold'}
                    onClick={isProfileMode ? handleBackToGlobal : undefined}>Purchase Analytics</span>
                {editingProfile && (
                    <>
                        <span>/</span>
                        <span className="text-app-primary font-bold">{editingProfile.name}</span>
                    </>
                )}
                {isCreateMode && (
                    <>
                        <span>/</span>
                        <span className="text-emerald-600 font-bold">New Profile</span>
                    </>
                )}
            </nav>

            {/* Header */}
            <div className={pageHeader}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className={pageTitle}>Purchase Analytics Configuration</h1>
                            {/* RBAC badge */}
                            {config._user_role && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    config._user_role === 'admin' ? 'bg-emerald-500/10 text-emerald-600' :
                                    config._user_role === 'editor' ? 'bg-blue-500/10 text-blue-600' :
                                    'bg-app-surface-2/10 text-app-muted-foreground'
                                }`}>{config._user_role}</span>
                            )}
                            {/* Presence - active editors */}
                            {config._active_editors && config._active_editors.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[9px] text-emerald-600 font-bold">
                                        {config._active_editors.join(', ')} also viewing
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className={pageSub}>
                            Customize how the PO Intelligence Grid calculates sales averages, proposed quantities, scoring, and pricing.
                            {lastSavedAt && (
                                <span className="ml-2 text-[9px] text-app-muted-foreground/60">
                                    Last saved {Math.round((Date.now() - lastSavedAt.getTime()) / 60000)} min ago
                                </span>
                            )}
                        </p>
                        {/* Viewer warning */}
                        {config._user_role === 'viewer' && (
                            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-600 font-bold">
                                <AlertTriangle size={9} /> Read-only mode — contact an admin to make changes
                            </div>
                        )}
                    </div>
                    {/* Stats bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-app-background border border-app-border/50">
                            <span className="text-[9px] text-app-muted-foreground">Profiles</span>
                            <span className="text-[10px] font-black text-app-foreground tabular-nums transition-all duration-300">{profilesData?.profiles?.length || 0}</span>
                        </div>
                        {/* Config health score */}
                        <div className="relative">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer ${
                                configScore >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' :
                                configScore >= 50 ? 'bg-amber-500/5 border-amber-500/20' :
                                'bg-red-500/5 border-red-500/20'
                            }`} onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}>
                                <Heart size={9} className={configScore >= 80 ? 'text-emerald-500' : configScore >= 50 ? 'text-amber-500' : 'text-red-500'} />
                                <span className={`text-[10px] font-black tabular-nums ${
                                    configScore >= 80 ? 'text-emerald-600' : configScore >= 50 ? 'text-amber-600' : 'text-red-600'
                                }`}>{configScore}%</span>
                            </div>
                            {/* Score breakdown tooltip */}
                            {showScoreBreakdown && (
                                <div className="absolute z-50 top-full right-0 mt-1 w-[220px] p-2 rounded-lg bg-app-surface border border-app-border shadow-xl animate-[fadeIn_0.1s_ease-in-out]">
                                    <p className="text-[9px] font-bold text-app-foreground mb-1.5">Health Score Breakdown</p>
                                    <div className="space-y-1">
                                        {scoreBreakdown.map((c, ci) => (
                                            <div key={ci} className="flex items-center justify-between text-[9px]">
                                                <div className="flex items-center gap-1">
                                                    <span className={c.pass ? 'text-emerald-500' : 'text-red-500'}>{c.pass ? '✓' : '✗'}</span>
                                                    <span className={c.pass ? 'text-app-muted-foreground' : 'text-app-foreground font-bold'}>{c.label}</span>
                                                </div>
                                                {!c.pass && <span className="text-red-500 font-bold">{c.impact}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Share config URL */}
                        <button
                            type="button"
                            onClick={handleShareUrl}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Copy shareable config URL"
                        >
                            <Copy size={9} /> Share
                        </button>
                        {/* Clipboard import */}
                        <button
                            type="button"
                            onClick={handleClipboardImport}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Import config from clipboard (paste JSON)"
                        >
                            <ClipboardPaste size={9} /> Paste
                        </button>
                        {warnings.length > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <AlertTriangle size={9} className="text-amber-500" />
                                <span className="text-[10px] font-black text-amber-600 tabular-nums">{warnings.length}</span>
                            </div>
                        )}
                        {isProfileMode && overrideCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-app-primary/5 border border-app-primary/20">
                                <span className="text-[9px] text-app-muted-foreground">Overrides</span>
                                <span className="text-[10px] font-black text-app-primary">{overrideCount}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `purchase-analytics-config-${new Date().toISOString().slice(0,10)}.json`;
                                a.click(); URL.revokeObjectURL(url);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Export global config as JSON"
                        >
                            <FileJson size={9} /> Export
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Print configuration"
                        >
                            <Printer size={9} /> Print
                        </button>
                        {/* Optimization suggestions */}
                        {suggestions.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowSuggestions(!showSuggestions)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] font-bold text-amber-600 hover:bg-amber-500/10 transition-all"
                                title="View optimization suggestions"
                            >
                                <Zap size={9} /> {suggestions.length} Tip{suggestions.length !== 1 ? 's' : ''}
                            </button>
                        )}
                        {/* Changelog */}
                        {hasChanges && (<>
                            <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(generateChangelog()); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                                title="Copy changelog to clipboard"
                            >
                                <Copy size={9} /> Changelog
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDiff(true)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                                title="View all unsaved changes"
                            >
                                <Eye size={9} /> Diff ({diffEntries.length})
                            </button>
                        </>)}
                        {/* Auto-save indicator */}
                        {draftSavedAt && (
                            <span className="text-[8px] text-app-muted-foreground/50 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Draft saved {draftSavedAt}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={async () => {
                                const data = await getConfigHistory();
                                setHistoryData(data.history);
                                setShowHistory(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="View config version history"
                        >
                            <History size={9} /> History
                            {config._version_count && config._version_count > 0 && (
                                <span className="text-[8px] px-1 rounded bg-app-primary/10 text-app-primary font-black">{config._version_count}</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowTemplates(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Manage config templates"
                        >
                            <Download size={9} /> Templates
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowShortcuts(true)}
                            className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title="Keyboard shortcuts (?)"
                        >
                            <span className="text-[9px] font-mono">?</span>
                        </button>
                        {/* Expand / Collapse All */}
                        <button
                            type="button"
                            onClick={() => setAllCollapsed(prev => !prev)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                            title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                        >
                            {allCollapsed ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
                            {allCollapsed ? 'Expand' : 'Collapse'}
                        </button>
                    </div>
                    {/* Second row: Presets + Search + Completeness */}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-app-muted-foreground/50 uppercase mr-0.5">Presets:</span>
                            {Object.entries(QUICK_PRESETS).map(([key, preset]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => applyPreset(key)}
                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-app-background border border-app-border/30 text-[8px] font-bold text-app-muted-foreground hover:text-app-foreground hover:border-app-primary/30 transition-all"
                                    title={`Apply ${preset.label} preset`}
                                >
                                    <span>{preset.icon}</span> {preset.label}
                                </button>
                            ))}
                        </div>
                        {/* Field Search */}
                        <div className="flex items-center gap-1 ml-auto">
                            <div className="relative">
                                <Search size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
                                <input
                                    type="text"
                                    value={fieldSearch}
                                    onChange={e => setFieldSearch(e.target.value)}
                                    placeholder="Filter fields..."
                                    className="pl-5 pr-2 py-0.5 rounded-md bg-app-background border border-app-border/30 text-[9px] text-app-foreground placeholder:text-app-muted-foreground/30 w-28 focus:w-40 transition-all focus:outline-none focus:ring-1 focus:ring-app-primary/30"
                                />
                            </div>
                            {/* Completeness */}
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-app-background border border-app-border/30" title={`Config ${completenessScore}% complete`}>
                                <div className="w-12 h-1 rounded-full bg-app-border/30 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${completenessScore}%`,
                                            background: completenessScore === 100 ? 'var(--app-success)' : completenessScore >= 75 ? 'var(--app-primary)' : 'var(--app-warning)',
                                        }}
                                    />
                                </div>
                                <span className="text-[8px] font-black text-app-muted-foreground">{completenessScore}%</span>
                            </div>
                        </div>
                    </div>
                    {/* Last modified indicator */}
                    {config._last_modified_by && (
                        <div className="text-[8px] text-app-muted-foreground/60 mt-0.5">
                            Last modified by <span className="font-bold text-app-muted-foreground">{config._last_modified_by}</span>
                            {config._last_modified_at && (
                                <> · {new Date(config._last_modified_at).toLocaleDateString()} {new Date(config._last_modified_at).toLocaleTimeString()}</>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ PAGE PROFILES — TOP ═══ */}
            <div className="mb-3">
                <div className="mb-2">
                    <h2 className="text-[14px] font-black text-app-foreground tracking-tight">Page Profiles</h2>
                    <p className={pageSub}>
                        Each page can override the global defaults below with its own profile.
                    </p>
                </div>

                <div className={card}>

                    {/* Table header */}
                    <div className="grid grid-cols-[24px_140px_200px_70px_40px] gap-2 px-3 py-2 border-b border-app-border/40 bg-app-background/30">
                        <div></div>
                        <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Page</div>
                        <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Active Profile</div>
                        <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Overrides</div>
                        <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Actions</div>
                    </div>

                    {/* Rows */}
                    {pageOrder.map((ctx, i) => {
                        const label = (PAGE_CONTEXT_LABELS as any)[ctx];
                        if (!label) return null;
                        const ctxProfiles = (profilesData?.profiles || []).filter(p => p.page_context === ctx);
                        const activeId = profilesData?.active_profile_per_page?.[ctx];
                        const activeProf = ctxProfiles.find(p => p.id === activeId);
                        const overrideCount = Object.keys(activeProf?.overrides || {}).length;

                        return (
                            <div key={ctx}
                                draggable
                                onDragStart={() => setDraggedCtx(ctx)}
                                onDragEnd={() => { setDraggedCtx(null); setDragOverCtx(null); }}
                                onDragOver={(e) => { e.preventDefault(); setDragOverCtx(ctx); }}
                                onDragLeave={() => setDragOverCtx(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedCtx && draggedCtx !== ctx) {
                                        setPageOrder(prev => {
                                            const next = [...prev];
                                            const fromIdx = next.indexOf(draggedCtx);
                                            const toIdx = next.indexOf(ctx);
                                            next.splice(fromIdx, 1);
                                            next.splice(toIdx, 0, draggedCtx);
                                            return next;
                                        });
                                    }
                                    setDraggedCtx(null);
                                    setDragOverCtx(null);
                                }}
                                className={`grid grid-cols-[24px_140px_200px_70px_40px] gap-2 items-center px-3 py-2 ${i < pageOrder.length - 1 ? 'border-b border-app-border/20' : ''} transition-all ${
                                (editingProfile?.page_context === ctx || creatingForContext === ctx)
                                    ? 'bg-app-primary/[0.06] ring-1 ring-app-primary/20 rounded-lg'
                                    : dragOverCtx === ctx && draggedCtx !== ctx
                                    ? 'bg-app-primary/[0.04] border-t-2 border-app-primary/30'
                                    : 'hover:bg-app-background/20'
                                } ${draggedCtx === ctx ? 'opacity-40' : ''}`}>
                                {/* Drag handle */}
                                <div className="flex flex-col items-center cursor-grab active:cursor-grabbing text-app-muted-foreground/30 hover:text-app-muted-foreground/60 transition-colors">
                                    <GripVertical size={12} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Layers size={12} className="text-indigo-500 shrink-0" />
                                    <span className="text-[11px] font-bold text-app-foreground">{label}</span>
                                </div>
                                <div className="flex items-center gap-1.5 relative"
                                    onMouseEnter={() => activeProf && Object.keys(activeProf.overrides || {}).length > 0 ? setHoverProfile(activeProf) : null}
                                    onMouseLeave={() => setHoverProfile(null)}>
                                    {activeProf?.is_system ? <Shield size={10} className="text-app-muted-foreground shrink-0" /> : activeProf ? <User size={10} className="text-app-muted-foreground shrink-0" /> : null}
                                    <span className="text-[11px] text-app-foreground truncate cursor-default">{activeProf?.name || 'System Default'}</span>
                                    {hoverProfile?.id === activeProf?.id && hoverProfile && (
                                        <div className="absolute z-50 top-full left-0 mt-1 w-[220px] p-2 rounded-lg bg-app-surface border border-app-border shadow-xl animate-[fadeIn_0.1s_ease-in-out]">
                                            <p className="text-[9px] font-bold text-app-foreground mb-1">{hoverProfile.name} — Overrides</p>
                                            <div className="space-y-0.5">
                                                {Object.entries(hoverProfile.overrides || {}).slice(0, 6).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between text-[8px]">
                                                        <span className="text-app-muted-foreground truncate">{k.replace(/_/g, ' ')}</span>
                                                        <span className="text-app-foreground font-bold ml-1">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                                    </div>
                                                ))}
                                                {Object.keys(hoverProfile.overrides || {}).length > 6 && (
                                                    <span className="text-[8px] text-app-muted-foreground">+{Object.keys(hoverProfile.overrides || {}).length - 6} more...</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    {overrideCount > 0 ? (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-black">{overrideCount}</span>
                                    ) : (
                                        <span className="text-[9px] text-app-muted-foreground/40">—</span>
                                    )}
                                </div>
                                <div className="flex items-center">
                                    <AnalyticsProfileSelector
                                        pageContext={ctx}
                                        onProfileChange={() => reloadProfiles()}
                                        onEditProfile={handleSelectProfile}
                                        onCreateProfile={handleStartCreate}
                                        onDuplicateProfile={handleDuplicate}
                                        onExportProfile={handleExport}
                                        onCompareProfile={handleCompare}
                                        compact
                                    />
                                </div>
                            </div>
                        );
                    })}

                </div>
            </div>

            {/* ═══ Import / Export toolbar ═══ */}
            <div className="mb-2 flex items-center gap-2">
                <input type="file" ref={importRef} accept=".json" className="hidden" onChange={handleImport} />
                <button type="button" onClick={() => importRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all">
                    <Upload size={10} /> Import Profile
                </button>
                <div className="flex-1" />
                <button type="button" onClick={() => {
                    const allCollapsed = Object.keys(collapsed).length >= 4 && Object.values(collapsed).every(v => v);
                    if (allCollapsed) setCollapsed({});
                    else setCollapsed({ sales: true, proposed: true, supplier: true, scoring: true });
                }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all">
                    {Object.keys(collapsed).length >= 4 && Object.values(collapsed).every(v => v)
                        ? <><ChevronDown size={10} /> Expand All</>
                        : <><ChevronRight size={10} /> Collapse All</>}
                </button>
                <div className="relative">
                    <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Filter settings..."
                        value={configSearch}
                        onChange={e => setConfigSearch(e.target.value)}
                        className="pl-6 pr-2 py-1 rounded-lg text-[10px] bg-app-surface border border-app-border focus:border-app-primary/30 focus:ring-1 focus:ring-app-primary/10 outline-none text-app-foreground w-[140px] transition-all"
                    />
                </div>
            </div>

            {/* Validation Warnings Banner */}
            {warnings.length > 0 && (
                <div className="mb-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={11} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600">{warnings.length} Configuration Warning{warnings.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-0.5">
                        {warnings.map((w, i) => (
                            <div key={i} className={`text-[9px] flex items-center gap-1.5 ${w.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                                <span className={`w-1 h-1 rounded-full ${w.severity === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                {w.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Optimization Suggestions Panel */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
                    <div className="px-3 py-2 border-b border-amber-500/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Zap size={10} /> Optimization Suggestions</span>
                        <button type="button" onClick={() => setShowSuggestions(false)} className="text-amber-500 hover:text-amber-600"><X size={12} /></button>
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                        {suggestions.map((s, i) => (
                            <div key={i} className="flex items-center justify-between py-1 gap-3">
                                <div className="flex-1">
                                    <span className="text-[10px] font-bold text-app-foreground">{s.field.replace(/_/g, ' ')}</span>
                                    <span className="text-[9px] text-app-muted-foreground ml-1.5">— {s.reason}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-red-500/70 line-through">{JSON.stringify(s.current)}</span>
                                    <span className="text-[9px] text-app-muted-foreground">→</span>
                                    <span className="text-[9px] text-emerald-600 font-bold">{JSON.stringify(s.suggested)}</span>
                                    <button type="button" onClick={() => update(s.field as any, s.suggested)}
                                        className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20 transition-colors">
                                        Apply
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Presets */}
            <div className="mb-2 flex items-center gap-2">
                <div className="flex items-center gap-1 text-[9px] text-app-muted-foreground font-bold uppercase tracking-widest">
                    <Zap size={9} /> Quick Presets
                </div>
                {CONFIG_PRESETS.map(preset => (
                    <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                            Object.entries(preset.values).forEach(([k, v]) => {
                                update(k as any, v);
                            });
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 hover:bg-app-primary/5 transition-all"
                        title={preset.desc}
                    >
                        <span>{preset.icon}</span> {preset.name}
                    </button>
                ))}
            </div>

            {/* ═══ CONFIGURATION SECTION (with smooth transition #5) ═══ */}
            <div className="transition-all duration-300 ease-in-out">

            {/* Mode Banner */}
            {isProfileMode && (
                <div className={`mb-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-2 ${
                    isCreateMode
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600'
                        : 'bg-app-primary/5 border-app-primary/20 text-app-primary'
                }`}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: isCreateMode ? '#10b981' : 'var(--app-primary)' }} />
                    {isCreateMode ? 'CREATE MODE' : 'EDIT MODE'}
                    <span className="text-app-muted-foreground font-normal ml-1">
                        {isCreateMode
                            ? `Creating new profile for ${PAGE_CONTEXT_LABELS[creatingForContext!]}`
                            : `Editing "${editingProfile?.name}" — ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`
                        }
                    </span>
                    {editingProfile && restoreDraft(editingProfile) && (
                        <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-black">DRAFT RESTORED</span>
                    )}
                </div>
            )}

            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isProfileMode && (
                        <button
                            type="button"
                            onClick={handleBackToGlobal}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all"
                        >
                            <ArrowLeft size={10} /> Back to Global
                        </button>
                    )}
                    {isEditMode && overrideCount > 0 && (
                        confirmResetAll ? (
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-red-500 font-bold">Reset all?</span>
                                <button type="button" onClick={() => { setProfileOverrides({}); setConfirmResetAll(false); }}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white hover:bg-red-600 transition-colors">
                                    Yes
                                </button>
                                <button type="button" onClick={() => setConfirmResetAll(false)}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-app-surface border border-app-border text-app-muted-foreground hover:text-app-foreground transition-colors">
                                    No
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmResetAll(true)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-500/70 hover:text-red-600 border border-red-500/20 hover:border-red-500/40 transition-all"
                            >
                                <RotateCcw size={9} /> Reset All
                            </button>
                        )
                    )}
                    {undoStack.length > 0 && (
                        <button
                            type="button"
                            onClick={handleUndo}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:border-app-primary/30 transition-all"
                            title={`Undo last change (${undoStack.length} in stack)`}
                        >
                            <Undo2 size={9} /> Undo
                            <span className="text-[8px] px-1 rounded bg-app-background text-app-muted-foreground/60">{undoStack.length}</span>
                        </button>
                    )}
                    <div>
                    <h2 className="text-[14px] font-black text-app-foreground tracking-tight flex items-center gap-2">
                        {isCreateMode ? (
                            <>
                                <Plus size={14} className="text-emerald-500" />
                                Create New Profile
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-black uppercase">
                                    {PAGE_CONTEXT_LABELS[creatingForContext!] || creatingForContext}
                                </span>
                            </>
                        ) : editingProfile ? (
                            <>
                                <Eye size={14} className="text-app-primary" />
                                {editingProfile.name}
                                {editingProfile.is_system && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-black uppercase">System</span>
                                )}
                                {overrideCount > 0 && (
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-black">
                                        {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </>
                        ) : (
                            'Global Configuration'
                        )}
                    </h2>
                    <p className={pageSub}>
                        {isCreateMode
                            ? 'Set a name, then configure overrides below. Unset fields use global defaults.'
                            : editingProfile
                                ? `Viewing overrides for "${editingProfile.name}". Fields not overridden use global defaults.`
                                : 'Default settings used by all pages unless overridden by a profile.'}
                    </p>
                    {isProfileMode && (
                        <p className="text-[8px] text-app-muted-foreground/50 mt-0.5">Press <kbd className="px-1 py-0.5 rounded bg-app-background border border-app-border text-[7px] font-mono">Esc</kbd> to go back · <kbd className="px-1 py-0.5 rounded bg-app-background border border-app-border text-[7px] font-mono">Ctrl+S</kbd> to save · <kbd className="px-1 py-0.5 rounded bg-app-background border border-app-border text-[7px] font-mono">Ctrl+Z</kbd> to undo</p>
                    )}
                </div>
                </div>
                {/* Save button — same row */}
                <button
                    onClick={() => {
                        if (isCreateMode) {
                            if (!newProfileName.trim()) return;
                            startTransition(async () => {
                                await createProfile(newProfileName, creatingForContext!, profileOverrides, newProfileVisibility);
                                await reloadProfiles();
                                handleBackToGlobal();
                                setSaved(true); setLastSavedAt(new Date());
                                setTimeout(() => setSaved(false), 3000);
                            });
                        } else if (editingProfile) {
                            startTransition(async () => {
                                await updateProfile(editingProfile.id, { overrides: profileOverrides });
                                localStorage.removeItem(`pa_draft_${editingProfile.id}`);
                                await reloadProfiles();
                                setSaved(true); setLastSavedAt(new Date());
                                setTimeout(() => setSaved(false), 3000);
                            });
                        } else {
                            handleSave();
                        }
                    }}
                    disabled={isPending || (isCreateMode && !newProfileName.trim())}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-app-primary text-white rounded-lg text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm shrink-0 ${saved ? 'ring-2 ring-emerald-400/50' : ''}`}
                >
                    {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {saved ? 'Saved!' : isCreateMode ? 'Create Profile' : isEditMode ? 'Save Profile' : 'Save Configuration'}
                </button>
            </div>

            {/* Create mode: Name + Visibility */}
            {isCreateMode && (
                <div className={`${card} mb-3`}>
                    <div className="px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={fieldLabel}>Profile Name</label>
                            <input
                                type="text"
                                className={fieldInput}
                                value={newProfileName}
                                onChange={e => setNewProfileName(e.target.value)}
                                placeholder="e.g., My Wholesale Analysis"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className={fieldLabel}>Visibility</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setNewProfileVisibility('organization')}
                                    className={toggleBtn(newProfileVisibility === 'organization')}>
                                    <Shield size={9} className="inline mr-1" /> Organization
                                </button>
                                <button type="button" onClick={() => setNewProfileVisibility('personal')}
                                    className={toggleBtn(newProfileVisibility === 'personal')}>
                                    <User size={9} className="inline mr-1" /> Personal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* ── Sales Analysis ── */}
                {cardVisible('sales analysis average period window exclusion') && <div className={card}>
                    <div className={cardHead('border-blue-500')} onClick={() => toggleCard('sales')}>
                        <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                            <TrendingUp className="w-3 h-3 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className={cardTitle}>Sales Analysis</h3>
                            <p className="text-[10px] text-app-muted-foreground">How daily/monthly averages are calculated</p>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); resetSection('sales'); }}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                            title="Reset this section to defaults">Reset</button>
                        {collapsed.sales ? <ChevronRight size={14} className="text-app-muted-foreground" /> : <ChevronDown size={14} className="text-app-muted-foreground" />}
                    </div>
                    {!collapsed.sales && <div className={cardBody}>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>Sales Average Period</label>
                                {statusDot(getFieldStatus('sales_avg_period_days', config.sales_avg_period_days))}
                                <FieldHelp field="sales_avg_period_days" />
                                {defaultHint('sales_avg_period_days', config.sales_avg_period_days)}
                                {isOverridden('sales_avg_period_days') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('sales_avg_period_days')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} />
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    className={fieldSelect}
                                    value={val('sales_avg_period_days')}
                                    onChange={e => update('sales_avg_period_days', Number(e.target.value))}
                                    disabled={lockedFields.has('sales_avg_period_days')}
                                    style={lockedFields.has('sales_avg_period_days') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                    {PERIOD_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => toggleFieldLock('sales_avg_period_days')}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-app-muted-foreground/30 hover:text-app-muted-foreground transition-colors"
                                    title={lockedFields.has('sales_avg_period_days') ? 'Unlock field' : 'Lock field'}>
                                    {lockedFields.has('sales_avg_period_days') ? <Lock size={8} /> : <Unlock size={8} />}
                                </button>
                            </div>
                            <p className={fieldHint}>
                                Average daily sales will be calculated over this window.
                                {isOverridden('sales_avg_period_days') && (
                                    <span className="ml-1 text-app-primary/60">Global: {periodLabel(globalVal('sales_avg_period_days'))}</span>
                                )}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>Sales Period Window Size (Days)</label>
                                <FieldHelp field="sales_window_size_days" />
                                {isOverridden('sales_window_size_days') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('sales_window_size_days')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} />
                                        </button>
                                    </>
                                )}
                            </div>
                            <select
                                className={fieldSelect}
                                value={val('sales_window_size_days') ?? 15}
                                onChange={e => update('sales_window_size_days', Number(e.target.value))}
                            >
                                <option value={7}>7 Days</option>
                                <option value={15}>15 Days (Bi-weekly)</option>
                                <option value={30}>30 Days (Monthly)</option>
                            </select>
                            <p className={fieldHint}>
                                Each window covers this many days.
                                {isOverridden('sales_window_size_days') && (
                                    <span className="ml-1 text-app-primary/60">Global: {globalVal('sales_window_size_days') ?? 15} days</span>
                                )}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>Exclude Sale Types from Average</label>
                                <FieldHelp field="sales_type_exclusions" />
                                {isOverridden('sales_avg_exclude_types') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('sales_avg_exclude_types')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} />
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['WHOLESALE', 'ONE_TIME', 'INTERNAL'].map(type => {
                                    const excludes = val('sales_avg_exclude_types') || [];
                                    const active = excludes.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            className={toggleBtn(active)}
                                            onClick={() => {
                                                const next = active
                                                    ? excludes.filter(t => t !== type)
                                                    : [...excludes, type];
                                                update('sales_avg_exclude_types', next);
                                            }}
                                        >
                                            {type.replace('_', ' ')}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className={fieldHint}>
                                Selected types will be excluded from sales averages so they don't skew your analysis.
                            </p>
                        </div>
                    </div>}
                </div>}

                {/* ── Proposed Quantity ── */}
                {cardVisible('proposed quantity formula lead days safety multiplier replenishment') && <div className={card}>
                    <div className={cardHead('border-emerald-500')} onClick={() => toggleCard('proposed')}>
                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                            <Calculator className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className={cardTitle}>Proposed Quantity</h3>
                            <p className="text-[10px] text-app-muted-foreground">How the system suggests quantities to order</p>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); resetSection('proposed'); }}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                            title="Reset this section to defaults">Reset</button>
                        {collapsed.proposed ? <ChevronRight size={14} className="text-app-muted-foreground" /> : <ChevronDown size={14} className="text-app-muted-foreground" />}
                    </div>
                    {!collapsed.proposed && <div className={cardBody}>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>Formula</label>
                                <FieldHelp field="proposed_qty_formula" />
                                {isOverridden('proposed_qty_formula') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('proposed_qty_formula')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} />
                                        </button>
                                        <span className="text-[8px] text-app-primary/60">Global: {formulaLabel(globalVal('proposed_qty_formula'))}</span>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className={toggleBtn(val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS')}
                                    onClick={() => update('proposed_qty_formula', 'AVG_DAILY_x_LEAD_DAYS')}
                                >
                                    Daily Avg × Lead Days
                                </button>
                                <button
                                    type="button"
                                    className={toggleBtn(val('proposed_qty_formula') === 'MONTHLY_AVG_x_MONTHS')}
                                    onClick={() => update('proposed_qty_formula', 'MONTHLY_AVG_x_MONTHS')}
                                >
                                    Monthly Avg × Months
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <label className={fieldLabel + ' mb-0'}>
                                        {val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS' ? 'Lead Days' : 'Lead Days (÷30 = months)'}
                                    </label>
                                    {statusDot(getFieldStatus('proposed_qty_lead_days', val('proposed_qty_lead_days')))}
                                    <FieldHelp field="proposed_qty_lead_days" />
                                    {defaultHint('proposed_qty_lead_days', val('proposed_qty_lead_days'))}
                                    {isOverridden('proposed_qty_lead_days') && (
                                        <>
                                            <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                            <button type="button" onClick={() => clearOverride('proposed_qty_lead_days')}
                                                className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                                <X size={9} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    className={fieldInput}
                                    value={val('proposed_qty_lead_days')}
                                    onChange={e => update('proposed_qty_lead_days', Number(e.target.value))}
                                />
                                <p className={fieldHint}>
                                    Days of stock coverage
                                    {isOverridden('proposed_qty_lead_days') && (
                                        <span className="ml-1 text-app-primary/60">Global: {globalVal('proposed_qty_lead_days')}</span>
                                    )}
                                </p>
                                {getWarning('proposed_qty_lead_days') && (
                                    <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${getWarning('proposed_qty_lead_days')!.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                                        <AlertTriangle size={9} /> {getWarning('proposed_qty_lead_days')!.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <label className={fieldLabel + ' mb-0'}>Safety Multiplier</label>
                                    {statusDot(getFieldStatus('proposed_qty_safety_multiplier', val('proposed_qty_safety_multiplier')))}
                                    <FieldHelp field="proposed_qty_safety_multiplier" />
                                    {defaultHint('proposed_qty_safety_multiplier', val('proposed_qty_safety_multiplier'))}
                                    {isOverridden('proposed_qty_safety_multiplier') && (
                                        <>
                                            <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                            <button type="button" onClick={() => clearOverride('proposed_qty_safety_multiplier')}
                                                className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                                <X size={9} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    min={1.0}
                                    max={3.0}
                                    step={0.1}
                                    className={fieldInput}
                                    value={val('proposed_qty_safety_multiplier')}
                                    onChange={e => update('proposed_qty_safety_multiplier', Number(e.target.value))}
                                />
                                <p className={fieldHint}>
                                    1.0 = exact, 1.5 = 50% buffer
                                    {isOverridden('proposed_qty_safety_multiplier') && (
                                        <span className="ml-1 text-app-primary/60">Global: {globalVal('proposed_qty_safety_multiplier')}</span>
                                    )}
                                </p>
                                {getWarning('proposed_qty_safety_multiplier') && (
                                    <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${getWarning('proposed_qty_safety_multiplier')!.severity === 'danger' ? 'text-red-500' : 'text-amber-600'}`}>
                                        <AlertTriangle size={9} /> {getWarning('proposed_qty_safety_multiplier')!.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="bg-app-background/50 rounded-lg p-3 border border-app-border/50">
                            <p className="text-[10px] font-mono text-app-muted-foreground">
                                {val('proposed_qty_formula') === 'AVG_DAILY_x_LEAD_DAYS'
                                    ? `Proposed = (avg_daily × ${val('proposed_qty_lead_days')} × ${val('proposed_qty_safety_multiplier')}) − current_stock`
                                    : `Proposed = (monthly_avg × ${(val('proposed_qty_lead_days') / 30).toFixed(1)}mo × ${val('proposed_qty_safety_multiplier')}) − current_stock`
                                }
                            </p>
                        </div>
                    </div>}
                </div>}
                {cardVisible('supplier pricing best price period purchase context retail wholesale') && <div className={card}>
                    <div className={cardHead('border-amber-500')} onClick={() => toggleCard('supplier')}>
                        <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className={cardTitle}>Supplier & Pricing</h3>
                            <p className="text-[10px] text-app-muted-foreground">Best price lookups and purchase context</p>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); resetSection('pricing'); }}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                            title="Reset this section to defaults">Reset</button>
                        {collapsed.supplier ? <ChevronRight size={14} className="text-app-muted-foreground" /> : <ChevronDown size={14} className="text-app-muted-foreground" />}
                    </div>
                    {!collapsed.supplier && <div className={cardBody}>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>Best Price Period</label>
                                <FieldHelp field="best_price_period_days" />
                                {isOverridden('best_price_period_days') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('best_price_period_days')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} />
                                        </button>
                                    </>
                                )}
                            </div>
                            <select
                                className={fieldSelect}
                                value={val('best_price_period_days')}
                                onChange={e => update('best_price_period_days', Number(e.target.value))}
                            >
                                {PERIOD_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <p className={fieldHint}>
                                Best price considers supplier prices within this window.
                                {isOverridden('best_price_period_days') && (
                                    <span className="ml-1 text-app-primary/60">Global: {periodLabel(globalVal('best_price_period_days'))}</span>
                                )}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>Purchase Context</label>
                                <FieldHelp field="purchase_context" />
                                {isOverridden('purchase_context') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('purchase_context')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} />
                                        </button>
                                        <span className="text-[8px] text-app-primary/60">Global: {contextLabel(globalVal('purchase_context'))}</span>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" className={toggleBtn(val('purchase_context') === 'RETAIL')}
                                    onClick={() => update('purchase_context', 'RETAIL')}>Retail</button>
                                <button type="button" className={toggleBtn(val('purchase_context') === 'WHOLESALE')}
                                    onClick={() => update('purchase_context', 'WHOLESALE')}>Wholesale</button>
                            </div>
                            <p className={fieldHint}>Retail: individual unit analysis. Wholesale: bulk pricing & volume.</p>
                        </div>
                    </div>}
                </div>}

                {/* ── Scoring & Data Sources ── */}
                {cardVisible('scoring data po count source financial weights margin velocity stock health') && <div className={card}>
                    <div className={cardHead('border-purple-500')} onClick={() => toggleCard('scoring')}>
                        <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className={cardTitle}>Scoring & Data Sources</h3>
                            <p className="text-[10px] text-app-muted-foreground">Financial score weights and PO count source</p>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); resetSection('scoring'); }}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                            title="Reset this section to defaults">Reset</button>
                        {collapsed.scoring ? <ChevronRight size={14} className="text-app-muted-foreground" /> : <ChevronDown size={14} className="text-app-muted-foreground" />}
                    </div>
                    {!collapsed.scoring && <div className={cardBody}>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>PO Count Source</label>
                                <FieldHelp field="po_count_source" />
                                {isOverridden('po_count_source') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={() => clearOverride('po_count_source')}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global">
                                            <X size={9} /></button>
                                        <span className="text-[8px] text-app-primary/60">Global: {sourceLabel(globalVal('po_count_source'))}</span>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" className={toggleBtn(val('po_count_source') === 'PURCHASE_INVOICE')}
                                    onClick={() => update('po_count_source', 'PURCHASE_INVOICE')}>Purchase Invoices</button>
                                <button type="button" className={toggleBtn(val('po_count_source') === 'PURCHASE_ORDER')}
                                    onClick={() => update('po_count_source', 'PURCHASE_ORDER')}>Purchase Orders</button>
                            </div>
                            <p className={fieldHint}>What the "PO Count" column reads from — invoices (received) or orders (placed).</p>
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <label className={fieldLabel + ' mb-0'}>
                                    Financial Score Weights
                                    <span className={`ml-2 ${weightTotal === 100 ? 'text-emerald-500' : 'text-red-500'}`}>(Total: {weightTotal}%)</span>
                                </label>
                                {isOverridden('financial_score_weights') && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
                                        <button type="button" onClick={clearWeightOverride}
                                            className="text-app-muted-foreground hover:text-red-500 transition-colors" title="Reset to global"><X size={9} /></button>
                                        <span className="text-[8px] text-app-primary/60">Global: {globalWeight('margin')}/{globalWeight('velocity')}/{globalWeight('stock_health')}</span>
                                    </>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[9px] text-app-muted-foreground uppercase">Margin</label>
                                    <input type="number" min={0} max={100} className={fieldInput}
                                        value={valWeight('margin')} onChange={e => updateWeight('margin', Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="text-[9px] text-app-muted-foreground uppercase">Velocity</label>
                                    <input type="number" min={0} max={100} className={fieldInput}
                                        value={valWeight('velocity')} onChange={e => updateWeight('velocity', Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="text-[9px] text-app-muted-foreground uppercase">Stock Health</label>
                                    <input type="number" min={0} max={100} className={fieldInput}
                                        value={valWeight('stock_health')} onChange={e => updateWeight('stock_health', Number(e.target.value))} />
                                </div>
                            </div>
                            <p className={fieldHint}>Weights should ideally sum to 100%.</p>
                            {getWarning('financial_score_weights') && (
                                <p className="text-[9px] mt-0.5 flex items-center gap-1 text-amber-600">
                                    <AlertTriangle size={9} /> {getWarning('financial_score_weights')!.message}
                                </p>
                            )}
                        </div>
                    </div>}
                </div>}
            </div>

            {/* No results state for search */}
            {configSearch && !cardVisible('sales analysis average period window exclusion') && !cardVisible('proposed quantity formula lead days safety multiplier replenishment') && !cardVisible('supplier pricing best price period purchase context retail wholesale') && !cardVisible('scoring data po count source financial weights margin velocity stock health') && (
                <div className="flex flex-col items-center justify-center py-12 text-app-muted-foreground">
                    <Search size={24} className="mb-2 opacity-30" />
                    <p className="text-[12px] font-bold">No settings match "{configSearch}"</p>
                    <p className="text-[10px]">Try a different keyword like "lead", "formula", or "weights"</p>
                    <button type="button" onClick={() => setConfigSearch('')}
                        className="mt-2 px-3 py-1 rounded-lg text-[10px] font-bold bg-app-primary/10 text-app-primary hover:bg-app-primary/20 transition-colors">Clear Filter</button>
                </div>
            )}

            {/* ═══ #8 LIVE PREVIEW ═══ */}
            {isProfileMode && (
                <div className="mt-3">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Activity size={12} className="text-app-primary" />
                        <h3 className="text-[12px] font-bold text-app-foreground">Live Preview</h3>
                        <span className="text-[9px] text-app-muted-foreground">Simulated grid output with current settings</span>
                    </div>
                    <div className={card}>
                        <div className="grid grid-cols-[120px_60px_60px_70px_70px] gap-2 px-3 py-1.5 border-b border-app-border/40 bg-app-background/30">
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Product</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Sold</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Stock</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Avg/Day</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Proposed</div>
                        </div>
                        {getPreview().map((r, i) => (
                            <div key={i} className="grid grid-cols-[120px_60px_60px_70px_70px] gap-2 px-3 py-1.5 border-b border-app-border/10 last:border-0">
                                <span className="text-[11px] text-app-foreground font-medium">{r.product}</span>
                                <span className="text-[11px] text-app-muted-foreground">{r.sold}</span>
                                <span className="text-[11px] text-app-muted-foreground">{r.stock}</span>
                                <span className="text-[11px] text-blue-500 font-bold">{r.avgDaily}</span>
                                <span className={`text-[11px] font-bold ${r.proposed > 0 ? 'text-emerald-500' : 'text-app-muted-foreground'}`}>{r.proposed > 0 ? `+${r.proposed}` : '\u2014'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            </div> {/* end transition wrapper */}

            {/* ═══ MODALS — extracted to _components/ ═══ */}
            {compareProfiles && (
                <CompareModal profiles={compareProfiles} config={config} onClose={() => setCompareProfiles(null)} />
            )}

            {/* Print CSS + Flash animation */}
            <style>{`
                @keyframes flashHighlight {
                    0% { background: rgba(var(--app-primary-rgb, 99, 102, 241), 0.15); }
                    100% { background: transparent; }
                }
                .field-flash { animation: flashHighlight 0.6s ease-out; }
                @media print {
                    body > *:not([class*="pageWrap"]) { display: none !important; }
                    nav, button, [data-sidebar], [data-slot="sidebar"], [data-sticky-bar] { display: none !important; }
                    .animate-pulse, .animate-spin { animation: none !important; }
                    * { color: #000 !important; background: #fff !important; border-color: #ccc !important; box-shadow: none !important; }
                }
            `}</style>

            {/* Sticky floating save bar */}
            {scrolled && (
                <div data-sticky-bar className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-app-surface/95 backdrop-blur-md border border-app-border shadow-2xl animate-[fadeIn_0.15s_ease-in-out]">
                    <span className="text-[10px] text-app-muted-foreground font-bold">
                        {isProfileMode ? `Editing: ${editingProfile?.name || 'New Profile'}` : 'Global Config'}
                    </span>
                    {undoStack.length > 0 && (
                        <button type="button" onClick={handleUndo} aria-label="Undo last change"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border transition-all">
                            <Undo2 size={9} /> Undo
                        </button>
                    )}
                    {originalConfig && config && JSON.stringify(config) !== JSON.stringify(originalConfig) && !isProfileMode && (
                        <button type="button" onClick={() => setShowDiffPreview(true)} aria-label="Preview changes"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-amber-600 border border-amber-500/30 hover:bg-amber-500/10 transition-all">
                            <Eye size={9} /> Diff
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (isCreateMode) {
                                if (!newProfileName.trim()) return;
                                startTransition(async () => {
                                    await createProfile(newProfileName, creatingForContext!, profileOverrides, newProfileVisibility);
                                    await reloadProfiles();
                                    handleBackToGlobal();
                                    setSaved(true); setLastSavedAt(new Date());
                                    setTimeout(() => setSaved(false), 3000);
                                });
                            } else if (editingProfile) {
                                startTransition(async () => {
                                    await updateProfile(editingProfile.id, { overrides: profileOverrides });
                                    localStorage.removeItem(`pa_draft_${editingProfile.id}`);
                                    await reloadProfiles();
                                    setSaved(true); setLastSavedAt(new Date());
                                    setTimeout(() => setSaved(false), 3000);
                                });
                            } else {
                                handleSave();
                            }
                        }}
                        disabled={isPending}
                        aria-label="Save configuration"
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-app-primary text-white rounded-lg text-[11px] font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm ${saved ? 'ring-2 ring-emerald-400/50' : ''}`}
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {saved ? 'Saved!' : 'Save'}
                    </button>
                </div>
            )}

            {showDiffPreview && originalConfig && config && (
                <DiffPreviewModal config={config} originalConfig={originalConfig} onClose={() => setShowDiffPreview(false)} onSave={handleSave} />
            )}

            {showHistory && (
                <HistoryModal
                    historyData={historyData}
                    onClose={() => setShowHistory(false)}
                    onRestore={(cfg) => {
                        setConfig(cfg);
                        setOriginalConfig(JSON.parse(JSON.stringify(cfg)));
                        setShowHistory(false);
                        setSaved(true); setLastSavedAt(new Date());
                        setTimeout(() => setSaved(false), 3000);
                    }}
                />
            )}

            {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}

            {showTemplates && (
                <TemplateManager
                    config={config}
                    onClose={() => setShowTemplates(false)}
                    onLoad={(templateConfig) => setConfig(prev => prev ? { ...prev, ...templateConfig } : prev)}
                />
            )}

            {showDiff && <DiffModal entries={diffEntries} onClose={() => setShowDiff(false)} />}
        </div>
    );
}

