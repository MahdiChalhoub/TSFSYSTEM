// @ts-nocheck
'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    getAnalyticsProfiles, activateProfile, createProfile,
    updateProfile, deleteProfile
} from '@/app/actions/settings/analytics-profiles';
import { PAGE_CONTEXT_LABELS } from '@/lib/analytics-constants';
import type { AnalyticsProfile, AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles';
import {
    ChevronDown, Check, Plus, Trash2, Edit3, RotateCcw,
    Settings2, Loader2, Shield, User, X, Save, Eye, Copy
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// STYLE TOKENS
// ═══════════════════════════════════════════════════════════════════

const dropdownWrap = "relative inline-block";
const triggerBtn = "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-surface border border-app-border/60 text-[11px] font-bold text-app-foreground hover:border-app-primary/40 transition-all cursor-pointer select-none";
const menuPanel = "absolute mt-1 left-0 z-[100] min-w-[280px] max-w-[340px] bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150";
const menuHeader = "px-3 py-1.5 border-b border-app-border/40 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground";
const menuItem = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer transition-colors ${
        active
            ? 'bg-app-primary/10 text-app-primary font-bold'
            : 'text-app-foreground hover:bg-app-background/60 font-medium'
    }`;
const menuDivider = "border-t border-app-border/40 my-0.5";
const menuAction = "flex items-center gap-2 px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors text-app-muted-foreground hover:text-app-foreground hover:bg-app-background/60";

// ═══════════════════════════════════════════════════════════════════
// DROPDOWN PORTAL — escapes overflow:hidden parents
// ═══════════════════════════════════════════════════════════════════

function DropdownPortal({ anchorRef, compact, children }: { anchorRef: React.RefObject<HTMLDivElement>, compact?: boolean, children: React.ReactNode }) {
    const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });

    useEffect(() => {
        if (!anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        if (compact) {
            // Open upward from the button, aligned to right edge
            setPos({ top: rect.top - 4, left: rect.right - 280, right: 0 });
        } else {
            setPos({ top: rect.bottom + 4, left: rect.left, right: 0 });
        }
    }, [anchorRef, compact]);

    return createPortal(
        <div data-analytics-dropdown className="fixed z-[200] min-w-[280px] max-w-[340px] bg-app-surface border border-app-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
            style={compact ? { bottom: `calc(100vh - ${pos.top}px)`, left: Math.max(8, pos.left), maxHeight: '70vh', overflowY: 'auto' } : { top: pos.top, left: pos.left }}>
            {children}
        </div>,
        document.body
    );
}

interface ProfileSelectorProps {
    pageContext: string;
    onProfileChange?: (profileId: string | null) => void;
    onEditProfile?: (profile: AnalyticsProfile) => void;
    onCreateProfile?: (pageContext: string) => void;
    onDuplicateProfile?: (profile: AnalyticsProfile) => void;
    onExportProfile?: (profile: AnalyticsProfile) => void;
    onCompareProfile?: (profile: AnalyticsProfile) => void;
    onActiveProfileLoaded?: (overrides: Record<string, any>) => void;
    compact?: boolean;
}

export default function AnalyticsProfileSelector({ pageContext, onProfileChange, onEditProfile, onCreateProfile, onDuplicateProfile, onExportProfile, onCompareProfile, onActiveProfileLoaded, compact }: ProfileSelectorProps) {
    const [data, setData] = useState<AnalyticsProfilesData | null>(null);
    const [open, setOpen] = useState(false);
    const [modalProfile, setModalProfile] = useState<AnalyticsProfile | null>(null);
    const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create' | null>(null);
    const [isPending, startTransition] = useTransition();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadProfiles();
    }, [pageContext]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            // Ignore clicks inside the trigger button area
            if (ref.current && ref.current.contains(target)) return;
            // Ignore clicks inside the portaled dropdown (identified by data attribute)
            const portalEl = document.querySelector('[data-analytics-dropdown]');
            if (portalEl && portalEl.contains(target)) return;
            setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const loadProfiles = async () => {
        const d = await getAnalyticsProfiles(pageContext);
        setData(d);
        // Notify parent of active profile overrides
        if (onActiveProfileLoaded && d) {
            const activeId = d.active_profile_per_page?.[pageContext] || null;
            const active = d.profiles?.find(p => p.id === activeId);
            onActiveProfileLoaded(active?.overrides || {});
        }
    };

    const activeProfileId = data?.active_profile_per_page?.[pageContext] || null;
    const profiles = data?.profiles || [];
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    const contextLabel = PAGE_CONTEXT_LABELS[pageContext] || pageContext;

    const handleActivate = (profileId: string | null) => {
        startTransition(async () => {
            await activateProfile(pageContext, profileId);
            await loadProfiles();
            onProfileChange?.(profileId);
            setOpen(false);
        });
    };

    const handleDelete = (profileId: string) => {
        if (!confirm('Delete this profile?')) return;
        startTransition(async () => {
            await deleteProfile(profileId);
            await loadProfiles();
        });
    };

    const openView = (p: AnalyticsProfile) => {
        if (onEditProfile) { onEditProfile(p); setOpen(false); return; }
        setModalProfile(p); setModalMode('view'); setOpen(false);
    };
    const openEdit = (p: AnalyticsProfile) => {
        if (onEditProfile) { onEditProfile(p); setOpen(false); return; }
        setModalProfile(p); setModalMode('edit'); setOpen(false);
    };
    const openCreate = () => {
        if (onCreateProfile) { onCreateProfile(pageContext); setOpen(false); return; }
        setModalProfile(null); setModalMode('create'); setOpen(false);
    };
    const closeModal = () => { setModalProfile(null); setModalMode(null); };

    const systemProfiles = profiles.filter(p => p.is_system);
    const userProfiles = profiles.filter(p => !p.is_system);

    return (
        <div ref={ref} className={dropdownWrap}>
            {/* Trigger */}
            <button type="button" className={compact ? "flex items-center justify-center w-7 h-7 rounded-lg bg-app-surface border border-app-border/60 hover:border-app-primary/40 transition-all cursor-pointer" : triggerBtn} onClick={() => setOpen(!open)}>
                <Settings2 size={compact ? 13 : 12} className="text-app-primary" />
                {!compact && (
                    <>
                        <span>{activeProfile?.name || 'Default Profile'}</span>
                        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                    </>
                )}
                {isPending && <Loader2 size={10} className="animate-spin" />}
            </button>

            {/* Dropdown — uses fixed positioning to escape overflow:hidden parents */}
            {open && (
                <DropdownPortal anchorRef={ref} compact={compact}>
                    <div className={menuHeader}>
                        {contextLabel} Profiles
                    </div>

                    {/* System profiles */}
                    {systemProfiles.map(p => {
                        const overrideCount = Object.keys(p.overrides || {}).length;
                        return (
                            <div key={p.id} className={menuItem(p.id === activeProfileId)}>
                                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => handleActivate(p.id)}>
                                    <Shield size={11} className="shrink-0 text-app-muted-foreground" />
                                    <span className="flex-1 truncate">{p.name}</span>
                                    {overrideCount > 0 && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-black">{overrideCount} overrides</span>
                                    )}
                                    {overrideCount === 0 && (
                                        <span className="text-[8px] text-app-muted-foreground/50">global defaults</span>
                                    )}
                                    {p.id === activeProfileId && <Check size={12} className="text-app-primary shrink-0" />}
                                </div>
                                <button type="button" onClick={e => { e.stopPropagation(); openView(p); }}
                                    className="p-1 text-app-muted-foreground hover:text-app-primary" title="View settings"><Eye size={10} /></button>
                                {onDuplicateProfile && (
                                    <button type="button" onClick={e => { e.stopPropagation(); onDuplicateProfile(p); setOpen(false); }}
                                        className="p-1 text-app-muted-foreground hover:text-app-success" title="Duplicate"><Copy size={10} /></button>
                                )}
                            </div>
                        );
                    })}

                    {/* User profiles */}
                    {userProfiles.length > 0 && (
                        <>
                            <div className={menuDivider} />
                            <div className={menuHeader}>Custom</div>
                            {userProfiles.map(p => {
                                const overrideCount = Object.keys(p.overrides || {}).length;
                                return (
                                    <div key={p.id} className={menuItem(p.id === activeProfileId)}>
                                        <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => handleActivate(p.id)}>
                                            <User size={11} className="shrink-0 text-app-muted-foreground" />
                                            <span className="flex-1 truncate">{p.name}</span>
                                            {overrideCount > 0 && (
                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-black">{overrideCount}</span>
                                            )}
                                            {p.id === activeProfileId && <Check size={12} className="text-app-primary shrink-0" />}
                                        </div>
                                        <button type="button" onClick={e => { e.stopPropagation(); openEdit(p); }}
                                            className="p-1 text-app-muted-foreground hover:text-app-primary" title="Edit"><Edit3 size={10} /></button>
                                        {onDuplicateProfile && (
                                            <button type="button" onClick={e => { e.stopPropagation(); onDuplicateProfile(p); setOpen(false); }}
                                                className="p-1 text-app-muted-foreground hover:text-app-success" title="Duplicate"><Copy size={10} /></button>
                                        )}
                                        <button type="button" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                                            className="p-1 text-app-muted-foreground hover:text-app-error" title="Delete"><Trash2 size={10} /></button>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    <div className={menuDivider} />

                    {/* Actions */}
                    <div className={menuAction} onClick={openCreate}>
                        <Plus size={12} /> Create New Profile
                    </div>
                    <div className={menuAction} onClick={() => handleActivate(systemProfiles[0]?.id || null)}>
                        <RotateCcw size={12} /> Reset to System Default
                    </div>
                    {onExportProfile && profiles.length > 0 && (
                        <div className={menuAction} onClick={() => { const active = profiles.find(p => p.id === activeProfileId); if (active) { onExportProfile(active); setOpen(false); } }}>
                            <Copy size={12} /> Export Active as JSON
                        </div>
                    )}
                    {onCompareProfile && profiles.length > 1 && (
                        <div className={menuAction} onClick={() => { onCompareProfile(profiles[0]); setOpen(false); }}>
                            <Eye size={12} /> Compare Profiles
                        </div>
                    )}
                </DropdownPortal>
            )}

            {/* View / Edit / Create Modal — portaled to body to escape stacking context */}
            {modalMode && createPortal(
                <ProfileModal
                    mode={modalMode}
                    pageContext={pageContext}
                    profile={modalProfile}
                    onClose={closeModal}
                    onSaved={() => { closeModal(); loadProfiles(); }}
                    onDuplicate={(p) => {
                        setModalProfile({ ...p, id: '', name: `${p.name} (Copy)`, is_system: false });
                        setModalMode('create');
                    }}
                />,
                document.body
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE MODAL — View / Edit / Create
// ═══════════════════════════════════════════════════════════════════

const OVERRIDE_FIELDS: { key: string; label: string; type: 'number' | 'select' | 'toggle'; options?: { value: any; label: string }[] }[] = [
    { key: 'sales_avg_period_days', label: 'Sales Average Period', type: 'select', options: [
        { value: 30, label: '30 Days' }, { value: 90, label: '90 Days' }, { value: 180, label: '6 Months' }, { value: 365, label: '1 Year' }, { value: 0, label: 'All Time' },
    ]},
    { key: 'sales_window_size_days', label: 'Sales Period Window', type: 'select', options: [
        { value: 7, label: '7 Days' }, { value: 15, label: '15 Days (Bi-weekly)' }, { value: 30, label: '30 Days (Monthly)' },
    ]},
    { key: 'best_price_period_days', label: 'Best Price Period', type: 'select', options: [
        { value: 30, label: '30 Days' }, { value: 90, label: '90 Days' }, { value: 180, label: '6 Months' }, { value: 365, label: '1 Year' }, { value: 0, label: 'All Time' },
    ]},
    { key: 'proposed_qty_formula', label: 'Proposed Qty Formula', type: 'select', options: [
        { value: 'AVG_DAILY_x_LEAD_DAYS', label: 'Daily Avg × Lead Days' }, { value: 'MONTHLY_AVG_x_MONTHS', label: 'Monthly Avg × Months' },
    ]},
    { key: 'proposed_qty_lead_days', label: 'Lead Days', type: 'number' },
    { key: 'proposed_qty_safety_multiplier', label: 'Safety Multiplier', type: 'number' },
    { key: 'purchase_context', label: 'Purchase Context', type: 'select', options: [
        { value: 'RETAIL', label: 'Retail' }, { value: 'WHOLESALE', label: 'Wholesale' },
    ]},
    { key: 'po_count_source', label: 'PO Count Source', type: 'select', options: [
        { value: 'PURCHASE_INVOICE', label: 'Purchase Invoices' }, { value: 'PURCHASE_ORDER', label: 'Purchase Orders' },
    ]},
    { key: 'stock_scope', label: 'Stock Quantity View', type: 'select', options: [
        { value: 'branch', label: 'Branch (Location)' }, { value: 'all', label: 'All (Total)' },
    ]},
];

const DEFAULTS: Record<string, any> = {
    sales_avg_period_days: 180, sales_window_size_days: 15, best_price_period_days: 180,
    proposed_qty_formula: 'AVG_DAILY_x_LEAD_DAYS', proposed_qty_lead_days: 14,
    proposed_qty_safety_multiplier: 1.5, purchase_context: 'RETAIL', po_count_source: 'PURCHASE_INVOICE',
    stock_scope: 'branch',
};

function ProfileModal({ mode, pageContext, profile, onClose, onSaved, onDuplicate }: {
    mode: 'view' | 'edit' | 'create';
    pageContext: string;
    profile: AnalyticsProfile | null;
    onClose: () => void;
    onSaved: () => void;
    onDuplicate?: (p: AnalyticsProfile) => void;
}) {
    const isReadOnly = mode === 'view';
    const isCreate = mode === 'create';
    const [name, setName] = useState(profile?.name || '');
    const [overrides, setOverrides] = useState<Record<string, any>>(profile?.overrides || {});
    const [visibility, setVisibility] = useState<'organization' | 'personal'>('organization');
    const [isPending, startTransition] = useTransition();

    const setOverride = (key: string, value: any) => {
        setOverrides(prev => ({ ...prev, [key]: value }));
    };
    const clearOverride = (key: string) => {
        setOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSave = () => {
        if (!name.trim()) return;
        startTransition(async () => {
            if (mode === 'edit' && profile) {
                await updateProfile(profile.id, { name, overrides });
            } else if (isCreate) {
                await createProfile(name, pageContext, overrides, visibility);
            }
            onSaved();
        });
    };

    const getEffectiveValue = (key: string) => {
        if (key in overrides) return overrides[key];
        return DEFAULTS[key];
    };

    const getDisplayValue = (field: typeof OVERRIDE_FIELDS[0], value: any) => {
        if (field.options) {
            const opt = field.options.find(o => String(o.value) === String(value));
            return opt?.label || String(value);
        }
        return String(value);
    };

    const title = isCreate
        ? 'Create New Profile'
        : mode === 'edit'
            ? `Edit: ${profile?.name}`
            : `View: ${profile?.name}`;

    return (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-xl border border-app-border shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isReadOnly ? <Eye size={14} className="text-app-primary" /> :
                         isCreate ? <Plus size={14} className="text-app-success" /> :
                         <Edit3 size={14} className="text-app-primary" />}
                        <h3 className="font-black text-[13px] text-app-foreground">{title}</h3>
                        {profile?.is_system && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-app-warning/10 text-app-warning font-black uppercase">System</span>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-app-muted-foreground hover:text-app-foreground">
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-3 max-h-[65vh] overflow-y-auto">
                    {/* Name */}
                    {!isReadOnly && (
                        <div>
                            <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-widest">Profile Name</label>
                            <input
                                type="text"
                                className="w-full bg-app-surface border border-app-border rounded-lg px-3 py-1.5 text-[12px] text-app-foreground focus:ring-2 focus:ring-app-primary/20 outline-none"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., My Wholesale Analysis"
                            />
                        </div>
                    )}

                    {/* Visibility — only on create */}
                    {isCreate && (
                        <div>
                            <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-widest">Visibility</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setVisibility('organization')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${visibility === 'organization' ? 'bg-app-primary text-white border-app-primary' : 'bg-app-surface text-app-muted-foreground border-app-border hover:border-app-primary/30'}`}>
                                    <Shield size={9} className="inline mr-1" /> Organization
                                </button>
                                <button type="button" onClick={() => setVisibility('personal')}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${visibility === 'personal' ? 'bg-app-primary text-white border-app-primary' : 'bg-app-surface text-app-muted-foreground border-app-border hover:border-app-primary/30'}`}>
                                    <User size={9} className="inline mr-1" /> Personal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Configuration */}
                    <div>
                        <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">
                            {isReadOnly ? 'Effective Configuration' : 'Configuration Overrides'}
                        </label>
                        {!isReadOnly && (
                            <p className="text-[8px] text-app-muted-foreground mb-2">
                                Only set fields to override. Unset fields use the global default.
                            </p>
                        )}
                        <div className="space-y-1.5">
                            {OVERRIDE_FIELDS.map(field => {
                                const hasOverride = field.key in overrides;
                                const globalVal = DEFAULTS[field.key];
                                const effectiveVal = getEffectiveValue(field.key);

                                if (isReadOnly) {
                                    // Read-only row: show label → effective value
                                    return (
                                        <div key={field.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${hasOverride ? 'border-app-primary/30 bg-app-primary/5' : 'border-app-border/30 bg-app-background/20'}`}>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-bold text-app-foreground">{field.label}</div>
                                            </div>
                                            <div className="text-[10px] font-bold text-app-foreground">
                                                {getDisplayValue(field, effectiveVal)}
                                            </div>
                                            {hasOverride ? (
                                                <span className="text-[7px] px-1 py-0.5 rounded bg-app-primary/10 text-app-primary font-black">OVERRIDE</span>
                                            ) : (
                                                <span className="text-[7px] text-app-muted-foreground/50">global</span>
                                            )}
                                        </div>
                                    );
                                }

                                // Editable row
                                return (
                                    <div key={field.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${hasOverride ? 'border-app-primary/30 bg-app-primary/5' : 'border-app-border/40 bg-app-background/30'}`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-bold text-app-foreground">{field.label}</div>
                                            <div className="text-[7px] text-app-muted-foreground">
                                                Global: {typeof globalVal === 'number' ? globalVal : String(globalVal)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {field.type === 'select' ? (
                                                <select
                                                    className="bg-app-surface border border-app-border rounded-md px-2 py-1 text-[10px] outline-none min-w-[90px]"
                                                    value={hasOverride ? overrides[field.key] : ''}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        if (v === '') { clearOverride(field.key); }
                                                        else { setOverride(field.key, isNaN(Number(v)) ? v : Number(v)); }
                                                    }}
                                                >
                                                    <option value="">Use global</option>
                                                    {field.options?.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className="w-14 bg-app-surface border border-app-border rounded-md px-2 py-1 text-[10px] text-center outline-none"
                                                    placeholder={String(globalVal)}
                                                    value={hasOverride ? overrides[field.key] : ''}
                                                    onChange={e => {
                                                        const v = e.target.value;
                                                        if (v === '') { clearOverride(field.key); }
                                                        else { setOverride(field.key, Number(v)); }
                                                    }}
                                                />
                                            )}
                                            {hasOverride && (
                                                <button type="button" onClick={() => clearOverride(field.key)}
                                                    className="p-0.5 text-app-muted-foreground hover:text-app-error" title="Reset to global">
                                                    <RotateCcw size={9} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-app-border flex items-center justify-between">
                    <div className="text-[8px] text-app-muted-foreground">
                        {Object.keys(overrides).length} override{Object.keys(overrides).length !== 1 ? 's' : ''} set
                    </div>
                    <div className="flex gap-2">
                        {/* View mode: Duplicate + Close */}
                        {isReadOnly && profile && (
                            <button type="button" onClick={() => onDuplicate?.(profile)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-app-border text-app-muted-foreground hover:text-app-foreground transition-all">
                                <Copy size={10} /> Duplicate as New
                            </button>
                        )}
                        <button type="button" onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-app-border text-app-muted-foreground hover:text-app-foreground transition-all">
                            {isReadOnly ? 'Close' : 'Cancel'}
                        </button>
                        {!isReadOnly && (
                            <button type="button" onClick={handleSave} disabled={isPending || !name.trim()}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-app-primary text-white hover:opacity-90 transition-all disabled:opacity-50">
                                {isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                {isCreate ? 'Create' : 'Update'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
