'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import {
    Plus, Trash2, Edit3, Check, X, Zap, Filter, User, Users,
    DollarSign, MapPin, CreditCard, Search, Loader2, Maximize2, Minimize2,
    ChevronRight, ChevronDown, Package, ShoppingCart, Landmark, Heart,
    Receipt, UserCircle, Settings2, ArrowLeft, ArrowRight,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const TRIGGER_EVENTS = [
    { value: 'PRICE_CHANGE', label: 'Product Price Changed', group: 'Inventory' },
    { value: 'LOW_STOCK', label: 'Low Stock Alert', group: 'Inventory' },
    { value: 'EXPIRY_APPROACHING', label: 'Product Expiry Approaching', group: 'Inventory' },
    { value: 'PRODUCT_EXPIRED', label: 'Product Has Expired', group: 'Inventory' },
    { value: 'PRODUCT_CREATED', label: 'New Product Created', group: 'Inventory' },
    { value: 'BARCODE_MISSING_PURCHASE', label: 'Purchased Without Barcode', group: 'Inventory' },
    { value: 'BARCODE_MISSING_TRANSFER', label: 'Transferred Without Barcode', group: 'Inventory' },
    { value: 'BARCODE_DAILY_CHECK', label: 'Daily: Products Without Barcodes', group: 'Inventory' },
    { value: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment Made', group: 'Inventory' },
    { value: 'INVENTORY_COUNT', label: 'Inventory Count Needed', group: 'Inventory' },
    { value: 'NEGATIVE_STOCK', label: 'Negative Stock Sale', group: 'Inventory' },
    { value: 'PURCHASE_ENTERED', label: 'Purchase Order Entered', group: 'Purchasing' },
    { value: 'PURCHASE_NO_ATTACHMENT', label: 'Purchase Without Attachment', group: 'Purchasing' },
    { value: 'PO_APPROVED', label: 'Purchase Order Approved', group: 'Purchasing' },
    { value: 'RECEIPT_VOUCHER', label: 'Receipt Voucher Arrived', group: 'Purchasing' },
    { value: 'PROFORMA_RECEIVED', label: 'Proforma Received', group: 'Purchasing' },
    { value: 'TRANSFER_CREATED', label: 'Transfer Order Created', group: 'Purchasing' },
    { value: 'DELIVERY_COMPLETED', label: 'Delivery Completed', group: 'Purchasing' },
    { value: 'NEW_SUPPLIER', label: 'New Supplier Onboarded', group: 'Purchasing' },
    { value: 'CREDIT_SALE', label: 'Credit Sale — No Cash', group: 'Finance' },
    { value: 'HIGH_VALUE_SALE', label: 'High-Value Sale', group: 'Finance' },
    { value: 'ORDER_COMPLETED', label: 'Order Completed', group: 'Finance' },
    { value: 'POS_RETURN', label: 'POS Return / Refund', group: 'Finance' },
    { value: 'CASHIER_DISCOUNT', label: 'Cashier Discount', group: 'Finance' },
    { value: 'OVERDUE_INVOICE', label: 'Invoice Overdue', group: 'Finance' },
    { value: 'LATE_PAYMENT', label: 'Late Payment', group: 'Finance' },
    { value: 'PAYMENT_DUE_SUPPLIER', label: 'Supplier Payment Due', group: 'Finance' },
    { value: 'NEW_INVOICE', label: 'New Invoice', group: 'Finance' },
    { value: 'BANK_STATEMENT', label: 'Bank Statement', group: 'Finance' },
    { value: 'DAILY_SUMMARY', label: 'End-of-Day Summary', group: 'Finance' },
    { value: 'MONTH_END', label: 'Month-End Close', group: 'Finance' },
    { value: 'PERIOD_CLOSING_SOON', label: 'Fiscal Period Closing Soon', group: 'Finance' },
    { value: 'PERIOD_STARTING_SOON', label: 'Next Fiscal Period Starting Soon', group: 'Finance' },
    { value: 'PERIOD_REOPEN_REQUEST', label: 'Fiscal Period Reopen Requested', group: 'Finance' },
    { value: 'PROMOTION_TRIGGERED', label: 'Targeted Client Promotion', group: 'CRM' },
    { value: 'EXTERNAL_DOCUMENT_SEND', label: 'Send External Document', group: 'CRM' },
    { value: 'CLIENT_FOLLOWUP_DUE', label: 'Client Follow-Up Due', group: 'CRM' },
    { value: 'SUPPLIER_FOLLOWUP_DUE', label: 'Supplier Follow-Up Due', group: 'CRM' },
    { value: 'NEW_CLIENT', label: 'New Client Registered', group: 'CRM' },
    { value: 'CLIENT_INACTIVE', label: 'Client Inactive', group: 'CRM' },
    { value: 'CLIENT_COMPLAINT', label: 'Client Complaint', group: 'CRM' },
    { value: 'ADDRESS_BOOK_VERIFY', label: 'Address Book Verify', group: 'CRM' },
    { value: 'EMPLOYEE_ONBOARD', label: 'Employee Onboarded', group: 'HR' },
    { value: 'LEAVE_REQUEST', label: 'Leave Request', group: 'HR' },
    { value: 'ATTENDANCE_ANOMALY', label: 'Attendance Anomaly', group: 'HR' },
    { value: 'USER_REGISTRATION', label: 'New User Registration', group: 'System' },
    { value: 'REPORT_NEEDS_REVIEW', label: 'Report Needs Review', group: 'System' },
    { value: 'ORDER_STALE', label: 'Order Not Treated', group: 'System' },
    { value: 'APPROVAL_PENDING', label: 'Approval Pending', group: 'System' },
    { value: 'CUSTOM', label: 'Custom Event', group: 'System' },
];

const MODULES = [
    { value: 'inventory', label: 'Inventory', icon: Package, color: 'var(--app-info, #3b82f6)', group: 'Inventory' },
    { value: 'purchasing', label: 'Purchasing', icon: ShoppingCart, color: '#f59e0b', group: 'Purchasing' },
    { value: 'finance', label: 'Finance', icon: Landmark, color: 'var(--app-primary)', group: 'Finance' },
    { value: 'crm', label: 'CRM', icon: Heart, color: '#ec4899', group: 'CRM' },
    { value: 'sales', label: 'Sales / POS', icon: Receipt, color: '#8b5cf6', group: 'Finance' },
    { value: 'hr', label: 'HR', icon: UserCircle, color: '#10b981', group: 'HR' },
    { value: 'system', label: 'System', icon: Settings2, color: 'var(--app-muted-foreground)', group: 'System' },
];

const moduleMeta = (code: string) =>
    MODULES.find(m => m.value === (code || '').toLowerCase())
        || { value: code || 'system', label: code || 'Other', icon: Settings2, color: 'var(--app-muted-foreground)', group: 'System' };

const RECURRENCE_INTERVALS = [
    { value: 'DAILY', label: 'Daily' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
];

const PRIORITIES = [
    { value: 'URGENT', label: 'Urgent' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];

interface AutoTaskRule {
    id?: number;
    name: string;
    trigger_event: string;
    rule_type: string;
    module: string;
    code?: string;
    recurrence_interval?: string | null;
    chain_parent?: number | null;
    conditions: {
        min_amount?: number;
        max_amount?: number;
        site_id?: number;
        client_id?: number;
        cashier_id?: number;
        payment_method?: string;
    };
    template_data: {
        title: string;
        priority: string;
        estimated_minutes: number;
        default_points: number;
    };
    assign_to_user_id?: number | null;
    assign_to_role_id?: number | null;
    assign_to_user_group_id?: number | null;
    stale_threshold_days?: number;
    is_active: boolean;
}

const emptyRule = (): AutoTaskRule => ({
    name: '',
    trigger_event: 'PRICE_CHANGE',
    rule_type: 'EVENT',
    module: 'inventory',
    recurrence_interval: null,
    conditions: {},
    template_data: { title: '', priority: 'HIGH', estimated_minutes: 30, default_points: 1 },
    assign_to_user_id: null,
    assign_to_role_id: null,
    assign_to_user_group_id: null,
    stale_threshold_days: 3,
    is_active: true,
});

const inputCls =
    'w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all';

const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block';

export default function AutoTaskRulesPage() {
    const [rules, setRules] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [userGroups, setUserGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRule, setEditingRule] = useState<AutoTaskRule | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [focusMode, setFocusMode] = useState(false);
    const [selectedModule, setSelectedModule] = useState<string>('inventory');
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const searchParams = useSearchParams();
    const searchRef = useRef<HTMLInputElement>(null);

    // Read ?module= from URL to initially focus a module (from quick-access deep links).
    useEffect(() => {
        const focus = searchParams?.get('module');
        if (focus && MODULES.some(m => m.value === focus)) {
            setSelectedModule(focus);
        }
    }, [searchParams]);

    const load = async () => {
        setLoading(true);
        try {
            const [r, u, rl, ug] = await Promise.all([
                erpFetch('auto-task-rules/').catch(() => []),
                erpFetch('users/').catch(() => []),
                erpFetch('roles/').catch(() => []),
                erpFetch('user-groups/').catch(() => []),
            ]);
            setRules(Array.isArray(r) ? r : r?.results || []);
            setUsers(Array.isArray(u) ? u : u?.results || []);
            setRoles(Array.isArray(rl) ? rl : rl?.results || []);
            setUserGroups(Array.isArray(ug) ? ug : ug?.results || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const saveRule = async () => {
        if (!editingRule) return;
        if (!editingRule.name.trim()) { toast.error('Rule name is required'); return; }
        if (!editingRule.trigger_event) { toast.error('Select a trigger event'); return; }
        if (!editingRule.template_data?.title) { toast.error('Task title is required'); return; }

        setSaving(true);
        try {
            const payload: any = {
                name: editingRule.name,
                trigger_event: editingRule.trigger_event,
                rule_type: editingRule.rule_type || 'EVENT',
                module: editingRule.module || 'system',
                code: editingRule.code || null,
                recurrence_interval: editingRule.recurrence_interval || null,
                stale_threshold_days: editingRule.stale_threshold_days || 3,
                conditions: editingRule.conditions,
                is_active: editingRule.is_active,
                assign_to_user: editingRule.assign_to_user_id || null,
                assign_to_user_group: editingRule.assign_to_user_group_id || null,
            };

            const tmpl = await erpFetch('task-templates/', {
                method: 'POST',
                body: JSON.stringify({
                    name: editingRule.template_data.title || editingRule.name,
                    default_priority: editingRule.template_data.priority,
                    estimated_minutes: editingRule.template_data.estimated_minutes,
                    default_points: editingRule.template_data.default_points,
                    assign_to_role: editingRule.assign_to_role_id || null,
                    is_active: true,
                }),
            });

            payload.template = tmpl.id;

            if (editingRule.id) {
                await erpFetch(`auto-task-rules/${editingRule.id}/`, { method: 'PUT', body: JSON.stringify(payload) });
                toast.success('Rule updated');
            } else {
                await erpFetch('auto-task-rules/', { method: 'POST', body: JSON.stringify(payload) });
                toast.success('Rule created');
            }
            setEditingRule(null);
            load();
        } catch {
            toast.error('Failed to save rule');
        } finally {
            setSaving(false);
        }
    };

    const deleteRule = async (id: number) => {
        if (!confirm('Delete this auto-task rule?')) return;
        try {
            await erpFetch(`auto-task-rules/${id}/`, { method: 'DELETE' });
            toast.success('Rule deleted');
            load();
        } catch {
            toast.error('Failed to delete');
        }
    };

    const toggleActive = async (rule: any) => {
        try {
            await erpFetch(`auto-task-rules/${rule.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !rule.is_active }),
            });
            load();
        } catch {
            toast.error('Failed to update');
        }
    };

    const getTriggerLabel = (v: string) => TRIGGER_EVENTS.find(t => t.value === v)?.label || v;

    const filteredRules = rules.filter(r => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return r.name?.toLowerCase().includes(q) ||
               r.code?.toLowerCase().includes(q) ||
               r.trigger_event?.toLowerCase().includes(q);
    });

    // Group rules by module for the organized list view.
    const rulesByModule = useMemo(() => {
        const buckets: Record<string, any[]> = {};
        for (const m of MODULES) buckets[m.value] = [];
        for (const r of filteredRules) {
            const key = (r.module || 'system').toLowerCase();
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(r);
        }
        return buckets;
    }, [filteredRules]);

    // Unfiltered counts (for the nav) — independent of the search filter.
    const totalByModule = useMemo(() => {
        const buckets: Record<string, number> = {};
        for (const m of MODULES) buckets[m.value] = 0;
        for (const r of rules) {
            const key = (r.module || 'system').toLowerCase();
            buckets[key] = (buckets[key] || 0) + 1;
        }
        return buckets;
    }, [rules]);

    const selectedMeta = moduleMeta(selectedModule);
    const currentRules = rulesByModule[selectedModule] || [];

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            {/* ── Header ────────────────────────────────────────────── */}
            {focusMode ? (
                <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <Zap size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Automations</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{filteredRules.length}/{rules.length}</span>
                    </div>
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search… (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-1.5 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>
                    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                    <div className="page-header-icon bg-app-primary"
                         style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Zap size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Automations</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {rules.length} Automations · Turn business events into tracked work
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => { setEditingRule(emptyRule()); setIsNew(true); setWizardStep(1); }}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                        >
                            <Plus size={14} />
                            <span className="hidden sm:inline">New Automation</span>
                        </button>
                        <button
                            onClick={() => setFocusMode(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            title="Focus Mode (Ctrl+Q)"
                        >
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            )}

            {!focusMode && (
                <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search rules… (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>
                </div>
            )}

            {/* ── 2-Pane Layout: Module Nav (left) + Rules (right) ─── */}
            <div className="flex-1 min-h-0 flex gap-3">
                {/* Vertical Module Nav */}
                <div className="w-48 md:w-56 flex-shrink-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                    <div className="px-3 py-2 bg-app-surface/60 border-b border-app-border/50">
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Modules</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                        {MODULES.map(m => {
                            const Icon = m.icon;
                            const count = totalByModule[m.value] || 0;
                            const isSelected = selectedModule === m.value;
                            return (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setSelectedModule(m.value)}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left"
                                    style={{
                                        background: isSelected ? `color-mix(in srgb, ${m.color} 12%, transparent)` : 'transparent',
                                        borderLeft: `3px solid ${isSelected ? m.color : 'transparent'}`,
                                    }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: isSelected ? m.color : `color-mix(in srgb, ${m.color} 12%, transparent)`,
                                            color: isSelected ? 'white' : m.color,
                                        }}>
                                        <Icon size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-black truncate" style={{ color: isSelected ? m.color : 'var(--app-foreground)' }}>
                                            {m.label}
                                        </div>
                                        <div className="text-[9px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {count} rule{count === 1 ? '' : 's'}
                                        </div>
                                    </div>
                                    {count > 0 && (
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded tabular-nums flex-shrink-0"
                                            style={{
                                                background: isSelected ? 'white' : `color-mix(in srgb, ${m.color} 15%, transparent)`,
                                                color: m.color,
                                            }}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Rules Panel */}
                <div className="flex-1 min-w-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-app-surface/60 border-b border-app-border/50">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${selectedMeta.color} 12%, transparent)`, color: selectedMeta.color }}>
                            {(() => { const I = selectedMeta.icon; return <I size={13} />; })()}
                        </div>
                        <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--app-foreground)' }}>
                            {selectedMeta.label}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: 'var(--app-muted-foreground)' }}>
                            {currentRules.length}
                        </span>
                        <div className="flex-1" />
                        <button onClick={() => {
                            const seed = emptyRule();
                            seed.module = selectedModule;
                            setEditingRule(seed);
                            setIsNew(true);
                            setWizardStep(1);
                        }}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                            style={{ background: selectedMeta.color, color: 'white' }}>
                            <Plus size={11} /> Rule
                        </button>
                    </div>

                    <div className="hidden md:flex flex-shrink-0 items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/40 border-b border-app-border/30 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                        <div className="w-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0">Rule</div>
                        <div className="hidden md:block w-36 flex-shrink-0">Trigger</div>
                        <div className="hidden lg:block w-40 flex-shrink-0">Conditions</div>
                        <div className="w-16 text-center flex-shrink-0">Active</div>
                        <div className="w-20 text-right flex-shrink-0">Actions</div>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 size={24} className="animate-spin text-app-primary" />
                            </div>
                        ) : currentRules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                {(() => { const I = selectedMeta.icon; return <I size={36} className="mb-3 opacity-40" style={{ color: selectedMeta.color }} />; })()}
                                <p className="text-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {search.trim() ? 'No matching rules' : `No rules in ${selectedMeta.label} yet`}
                                </p>
                                {!search.trim() && (
                                    <button onClick={() => {
                                        const seed = emptyRule();
                                        seed.module = selectedModule;
                                        setEditingRule(seed);
                                        setIsNew(true);
                                        setWizardStep(1);
                                    }}
                                        className="mt-3 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                                        style={{ background: selectedMeta.color, color: 'white' }}>
                                        <Plus size={12} /> Add first rule
                                    </button>
                                )}
                            </div>
                        ) : (
                            currentRules.map((rule: any) => {
                                const mod = selectedMeta;
                                return (
                            <div
                                key={rule.id}
                                className={`group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5 ${!rule.is_active ? 'opacity-60' : ''}`}
                                style={{
                                    paddingLeft: '12px',
                                    paddingRight: '12px',
                                    borderLeft: `3px solid ${mod.color}`,
                                }}
                            >
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                    }}
                                >
                                    <Zap size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {rule.code && (
                                            <span
                                                className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                                    color: 'var(--app-muted-foreground)',
                                                }}
                                            >
                                                {rule.code}
                                            </span>
                                        )}
                                        <div className="truncate text-[13px] font-bold text-app-foreground">{rule.name}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded md:hidden"
                                            style={{ background: `color-mix(in srgb, ${mod.color} 10%, transparent)`, color: mod.color }}>
                                            {getTriggerLabel(rule.trigger_event)}
                                        </span>
                                        {rule.rule_type === 'RECURRING' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                                🔁 {(rule.recurrence_interval || 'RECURRING').toLowerCase()}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                ⚡ once per event
                                            </span>
                                        )}
                                        {(rule.conditions?.days_before !== undefined && rule.conditions?.days_before !== null) && (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                                style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                🔔 {rule.conditions.days_before}d before
                                            </span>
                                        )}
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                            {rule.assign_to_user ? '👤 person'
                                                : rule.assign_to_user_group ? '👥 team'
                                                : rule.template?.assign_to_role ? '⚙️ auto'
                                                : '⚠️ unassigned'}
                                        </span>
                                    </div>
                                </div>
                                <div className="hidden md:block w-36 flex-shrink-0">
                                    <span
                                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: 'var(--app-primary)',
                                            border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                        }}
                                    >
                                        {getTriggerLabel(rule.trigger_event)}
                                    </span>
                                </div>
                                <div className="hidden lg:block w-40 flex-shrink-0 text-[11px] font-medium text-app-muted-foreground space-y-0.5">
                                    {rule.conditions?.min_amount && (
                                        <div className="flex items-center gap-1">
                                            <DollarSign size={10} /> ≥ {Number(rule.conditions.min_amount).toLocaleString()}
                                        </div>
                                    )}
                                    {rule.conditions?.site_id && (
                                        <div className="flex items-center gap-1">
                                            <MapPin size={10} /> Site #{rule.conditions.site_id}
                                        </div>
                                    )}
                                    {rule.conditions?.payment_method && (
                                        <div className="flex items-center gap-1">
                                            <CreditCard size={10} /> {rule.conditions.payment_method}
                                        </div>
                                    )}
                                    {!Object.keys(rule.conditions || {}).length && (
                                        <span>All events</span>
                                    )}
                                </div>
                                <div className="w-16 flex justify-center flex-shrink-0">
                                    <button
                                        onClick={() => toggleActive(rule)}
                                        className={`w-9 h-4 rounded-full relative transition-all ${rule.is_active ? 'bg-app-primary' : 'bg-app-border'}`}
                                        title={rule.is_active ? 'Disable' : 'Enable'}
                                    >
                                        <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow ${rule.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </div>
                                <div className="w-20 flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingRule({
                                                ...rule,
                                                template_data: {
                                                    title: rule.template?.name || '',
                                                    priority: rule.template?.default_priority || 'HIGH',
                                                    estimated_minutes: rule.template?.estimated_minutes || 30,
                                                    default_points: rule.template?.default_points || 1,
                                                },
                                                assign_to_role_id: rule.template?.assign_to_role || null,
                                                assign_to_user_id: rule.assign_to_user || null,
                                                assign_to_user_group_id: rule.assign_to_user_group || null,
                                            });
                                            setIsNew(false);
                                            setWizardStep(3);
                                        }}
                                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                                        title="Edit"
                                    >
                                        <Edit3 size={12} />
                                    </button>
                                    <button
                                        onClick={() => deleteRule(rule.id)}
                                        className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                                        title="Delete"
                                        style={{ color: 'var(--app-error, #ef4444)' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modal ─────────────────────────────────────────────── */}
            {editingRule && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setEditingRule(null); }}
                >
                    <div
                        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                                borderBottom: '1px solid var(--app-border)',
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: 'var(--app-primary)',
                                        boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    }}
                                >
                                    <Zap size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-app-foreground">
                                        {isNew ? 'New Automation' : 'Edit Automation'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-app-muted-foreground">
                                        Where · when · what happens
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingRule(null)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* ── Wizard Stepper ─────────────────────────────── */}
                        <div className="flex items-center justify-center gap-2 px-5 py-2 flex-shrink-0"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 90%, var(--app-bg))' }}>
                            {([
                                { n: 1, label: 'Where', done: !!editingRule.module },
                                { n: 2, label: 'When', done: !!editingRule.trigger_event },
                                { n: 3, label: 'What', done: wizardStep >= 3 && !!editingRule.name && !!editingRule.template_data?.title },
                            ] as const).map((step, i) => {
                                const isActive = wizardStep === step.n;
                                const clickable = step.n < wizardStep || step.n === wizardStep;
                                return (
                                    <div key={step.n} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { if (clickable) setWizardStep(step.n as 1 | 2 | 3); }}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${clickable ? '' : 'opacity-50 cursor-not-allowed'}`}
                                            style={{
                                                background: isActive ? 'var(--app-primary)' : step.done ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                color: isActive ? 'white' : step.done ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                            }}>
                                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                                                style={{ background: isActive ? 'white' : step.done ? 'var(--app-primary)' : 'transparent', color: isActive ? 'var(--app-primary)' : step.done ? 'white' : 'inherit' }}>
                                                {step.done && !isActive ? <Check size={9} /> : step.n}
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{step.label}</span>
                                        </button>
                                        {i < 2 && <div className="w-6 h-px" style={{ background: 'var(--app-border)' }} />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Step 1: Module Picker ─────────────────────── */}
                        {wizardStep === 1 && (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                                <p className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Where in your business does this happen?
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                    {MODULES.map(m => {
                                        const Icon = m.icon;
                                        const selected = editingRule.module === m.value;
                                        return (
                                            <button key={m.value} type="button"
                                                onClick={() => setEditingRule({ ...editingRule, module: m.value })}
                                                className="flex flex-col items-start gap-2 p-3 rounded-xl transition-all text-left"
                                                style={{
                                                    background: selected ? `color-mix(in srgb, ${m.color} 10%, transparent)` : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                                    border: `2px solid ${selected ? m.color : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                                }}>
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                                    style={{ background: `color-mix(in srgb, ${m.color} 15%, transparent)`, color: m.color }}>
                                                    <Icon size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-[12px] font-black" style={{ color: 'var(--app-foreground)' }}>{m.label}</div>
                                                    <div className="text-[10px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        {TRIGGER_EVENTS.filter(t => t.group === m.group).length} events
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Step 2: Event Picker ──────────────────────── */}
                        {wizardStep === 2 && (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                                <p className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    When should this automation run?
                                </p>
                                {(() => {
                                    const mod = moduleMeta(editingRule.module);
                                    const events = TRIGGER_EVENTS.filter(t => t.group === mod.group);
                                    if (events.length === 0) {
                                        return (
                                            <div className="p-4 rounded-xl text-[11px] font-medium text-center"
                                                style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)', color: 'var(--app-warning)' }}>
                                                No predefined events for this module. Use a Custom Event instead.
                                            </div>
                                        );
                                    }
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px' }}>
                                            {events.map(t => {
                                                const selected = editingRule.trigger_event === t.value;
                                                return (
                                                    <button key={t.value} type="button"
                                                        onClick={() => setEditingRule({ ...editingRule, trigger_event: t.value })}
                                                        className="flex items-center gap-2 p-2.5 rounded-xl transition-all text-left"
                                                        style={{
                                                            background: selected ? `color-mix(in srgb, ${mod.color} 10%, transparent)` : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                                            border: `1px solid ${selected ? mod.color : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                                        }}>
                                                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                            style={{ background: selected ? mod.color : 'transparent', border: `2px solid ${selected ? mod.color : 'var(--app-border)'}` }}>
                                                            {selected && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <span className="text-[12px] font-bold flex-1 min-w-0 truncate" style={{ color: 'var(--app-foreground)' }}>{t.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* ── Step 3: Details ──────────────────────────── */}
                        {wizardStep === 3 && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            {/* Section: Name the automation */}
                            <div className="p-4 rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">Name this automation</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label className={labelCls}>What will this do? *</label>
                                        <input
                                            value={editingRule.name}
                                            onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                                            className={inputCls}
                                            placeholder="e.g. Print price tag on price change"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Short code (optional)</label>
                                        <input
                                            value={editingRule.code || ''}
                                            onChange={e => setEditingRule({ ...editingRule, code: e.target.value })}
                                            className={`${inputCls} font-mono`}
                                            placeholder="INV-01"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Module hidden — it's chosen in Step 1 of the wizard. */}

                            {/* Section: Timing — renamed to "When should this run?" */}
                            <div className="p-4 rounded-xl space-y-3"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                                    borderLeft: '3px solid var(--app-primary)',
                                }}>
                                <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>
                                    When should this run?
                                </h4>

                                {/* Repeats? Yes/No segmented */}
                                <div>
                                    <label className={labelCls}>Does this repeat?</label>
                                    <div className="flex items-center gap-1 p-1 rounded-xl"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', width: 'fit-content' }}>
                                        {[
                                            { v: 'EVENT', label: 'No — fires once per event' },
                                            { v: 'RECURRING', label: 'Yes — on a schedule' },
                                        ].map(o => {
                                            const active = editingRule.rule_type === o.v
                                            return (
                                                <button key={o.v} type="button"
                                                    onClick={() => setEditingRule({
                                                        ...editingRule,
                                                        rule_type: o.v,
                                                        recurrence_interval: o.v === 'EVENT' ? null : (editingRule.recurrence_interval || 'DAILY'),
                                                    })}
                                                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                                                    style={{
                                                        background: active ? 'var(--app-primary)' : 'transparent',
                                                        color: active ? 'white' : 'var(--app-muted-foreground)',
                                                    }}>
                                                    {o.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Every X — only when recurring */}
                                {editingRule.rule_type === 'RECURRING' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                                        <div>
                                            <label className={labelCls}>Every</label>
                                            <select
                                                value={editingRule.recurrence_interval || 'DAILY'}
                                                onChange={e => setEditingRule({ ...editingRule, recurrence_interval: e.target.value || null })}
                                                className={inputCls}
                                            >
                                                {RECURRENCE_INTERVALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Flag as stale after (days)</label>
                                            <input type="number" min={1}
                                                value={editingRule.stale_threshold_days || 3}
                                                onChange={e => setEditingRule({ ...editingRule, stale_threshold_days: Number(e.target.value) })}
                                                className={inputCls}
                                            />
                                            <p className="text-[9px] font-medium mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                                Item flagged stale after this many days without progress.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Reminder before — applies to both EVENT and RECURRING for time-bound triggers */}
                                <div>
                                    <label className={labelCls}>Reminder timing — fire N days before</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min={0} max={90}
                                            value={(editingRule.conditions as any)?.days_before ?? ''}
                                            placeholder="0 = on the day"
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: {
                                                    ...editingRule.conditions,
                                                    days_before: e.target.value === '' ? undefined : Number(e.target.value),
                                                } as any,
                                            })}
                                            className={`${inputCls} max-w-[130px]`} />
                                        <span className="text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                            days before the target date
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Used by triggers that have a target date (period close, due invoice, expiry, follow-up). Leave blank to fall back to the tenant-wide lead-time.
                                    </p>
                                </div>
                            </div>

                            {/* Trigger Event — filtered to the selected module's events */}
                            {(() => {
                                const mod = moduleMeta(editingRule.module);
                                const moduleEvents = TRIGGER_EVENTS.filter(t => t.group === mod.group);
                                return (
                                    <div>
                                        <label className={labelCls}>When this happens (in {mod.label}) *</label>
                                        <select
                                            value={editingRule.trigger_event}
                                            onChange={e => setEditingRule({ ...editingRule, trigger_event: e.target.value })}
                                            className={inputCls}
                                        >
                                            {moduleEvents.length === 0 ? (
                                                <option value="CUSTOM">Custom Event</option>
                                            ) : (
                                                moduleEvents.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))
                                            )}
                                        </select>
                                        <p className="text-[9px] font-medium mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Change the module in Step 1 to pick from other event groups.
                                        </p>
                                    </div>
                                );
                            })()}

                            {/* Conditions */}
                            <div
                                className="p-4 rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Filter size={13} style={{ color: 'var(--app-primary)' }} />
                                    <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                        Only when… (optional filters)
                                    </h4>
                                </div>
                                <p className="text-[10px] font-medium text-app-muted-foreground mb-3">
                                    Narrow down when the automation fires. Leave everything blank to always run.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                    <div>
                                        <label className={labelCls}>Min Amount</label>
                                        <input
                                            type="number"
                                            value={editingRule.conditions.min_amount ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: { ...editingRule.conditions, min_amount: e.target.value ? Number(e.target.value) : undefined },
                                            })}
                                            className={inputCls}
                                            placeholder="500000"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Max Amount</label>
                                        <input
                                            type="number"
                                            value={editingRule.conditions.max_amount ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: { ...editingRule.conditions, max_amount: e.target.value ? Number(e.target.value) : undefined },
                                            })}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Site ID</label>
                                        <input
                                            type="number"
                                            value={editingRule.conditions.site_id ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: { ...editingRule.conditions, site_id: e.target.value ? Number(e.target.value) : undefined },
                                            })}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Client ID</label>
                                        <input
                                            type="number"
                                            value={editingRule.conditions.client_id ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: { ...editingRule.conditions, client_id: e.target.value ? Number(e.target.value) : undefined },
                                            })}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Payment Method</label>
                                        <select
                                            value={editingRule.conditions.payment_method ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: { ...editingRule.conditions, payment_method: e.target.value || undefined },
                                            })}
                                            className={inputCls}
                                        >
                                            <option value="">Any</option>
                                            <option value="CREDIT">Credit</option>
                                            <option value="CASH">Cash</option>
                                            <option value="CARD">Card</option>
                                            <option value="WAVE">Wave</option>
                                            <option value="OM">Orange Money</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Cashier ID</label>
                                        <input
                                            type="number"
                                            value={editingRule.conditions.cashier_id ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                conditions: { ...editingRule.conditions, cashier_id: e.target.value ? Number(e.target.value) : undefined },
                                            })}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Task Config */}
                            <div
                                className="p-4 rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                    borderLeft: '3px solid var(--app-primary)',
                                }}
                            >
                                <h4 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-primary)' }}>
                                    What task gets created?
                                </h4>
                                <div>
                                    <label className={labelCls}>Task title the assignee will see *</label>
                                    <input
                                        value={editingRule.template_data.title}
                                        onChange={e => setEditingRule({
                                            ...editingRule,
                                            template_data: { ...editingRule.template_data, title: e.target.value },
                                        })}
                                        className={inputCls}
                                        placeholder="Follow up on credit sale — {reference}"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: 8 }}>
                                    <div>
                                        <label className={labelCls}>How urgent?</label>
                                        <select
                                            value={editingRule.template_data.priority}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                template_data: { ...editingRule.template_data, priority: e.target.value },
                                            })}
                                            className={inputCls}
                                        >
                                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="flex items-center gap-2 cursor-pointer select-none mt-2 mb-1">
                                            <input type="checkbox"
                                                checked={!!(editingRule.conditions as any)?.require_completion_note}
                                                onChange={e => setEditingRule({
                                                    ...editingRule,
                                                    conditions: { ...editingRule.conditions, require_completion_note: e.target.checked } as any,
                                                })} />
                                            <span className="text-[11px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                                Require proof — ask the assignee to describe their work before closing the task
                                            </span>
                                        </label>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Est. minutes to complete</label>
                                        <input
                                            type="number"
                                            value={editingRule.template_data.estimated_minutes}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                template_data: { ...editingRule.template_data, estimated_minutes: Number(e.target.value) },
                                            })}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Assignment */}
                            {(() => {
                                // Which assignment mode is currently in effect?
                                const mode: 'user' | 'team' | 'auto' =
                                    editingRule.assign_to_user_id ? 'user'
                                    : editingRule.assign_to_user_group_id ? 'team'
                                    : 'auto';
                                const setMode = (next: 'user' | 'team' | 'auto') => {
                                    if (next === 'auto') {
                                        setEditingRule({ ...editingRule, assign_to_user_id: null, assign_to_user_group_id: null });
                                    } else if (next === 'user') {
                                        setEditingRule({ ...editingRule, assign_to_user_group_id: null });
                                    } else {
                                        setEditingRule({ ...editingRule, assign_to_user_id: null });
                                    }
                                };
                                return (
                            <div className="p-4 rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">Who should do this?</h4>
                                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                    {([
                                        { v: 'user' as const, icon: <User size={12} />, label: 'One person' },
                                        { v: 'team' as const, icon: <Users size={12} />, label: 'A team' },
                                        { v: 'auto' as const, icon: <Zap size={12} />, label: 'Automatically' },
                                    ]).map(o => (
                                        <button key={o.v} type="button"
                                            onClick={() => setMode(o.v)}
                                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                                            style={{
                                                background: mode === o.v ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                                color: mode === o.v ? 'white' : 'var(--app-muted-foreground)',
                                            }}>
                                            {o.icon} {o.label}
                                        </button>
                                    ))}
                                </div>

                                {mode === 'user' && (
                                    <div>
                                        <label className={labelCls}>Choose the person</label>
                                        <select value={editingRule.assign_to_user_id ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                assign_to_user_id: e.target.value ? Number(e.target.value) : null,
                                            })}
                                            className={inputCls}>
                                            <option value="">— pick a person —</option>
                                            {users.map((u: any) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.first_name} {u.last_name} ({u.username})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {mode === 'team' && (
                                    <div>
                                        <label className={labelCls}>Choose the team</label>
                                        <select value={editingRule.assign_to_user_group_id ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                assign_to_user_group_id: e.target.value ? Number(e.target.value) : null,
                                            })}
                                            className={inputCls}>
                                            <option value="">— pick a team —</option>
                                            {userGroups.map((g: any) => (
                                                <option key={g.id} value={g.id}>
                                                    {g.name} · {g.member_count ?? 0} {(g.member_count ?? 0) === 1 ? 'member' : 'members'}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] font-medium text-app-muted-foreground mt-1">Every member of the team gets the task.</p>
                                    </div>
                                )}

                                {mode === 'auto' && (
                                    <div>
                                        <label className={labelCls}>Fallback role (advanced)</label>
                                        <select value={editingRule.assign_to_role_id ?? ''}
                                            onChange={e => setEditingRule({
                                                ...editingRule,
                                                assign_to_role_id: e.target.value ? Number(e.target.value) : null,
                                            })}
                                            className={inputCls}>
                                            <option value="">— anyone with the right permission —</option>
                                            {roles.map((r: any) => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] font-medium text-app-muted-foreground mt-1">
                                            The system picks who gets the task based on roles. Leave blank to let it auto-route.
                                        </p>
                                    </div>
                                )}
                            </div>
                                );
                            })()}

                            {/* Active toggle */}
                            <div className="flex items-center justify-between px-1">
                                <div>
                                    <p className="text-[12px] font-bold text-app-foreground">Active</p>
                                    <p className="text-[10px] font-medium text-app-muted-foreground">Disable to pause without deleting.</p>
                                </div>
                                <button
                                    onClick={() => setEditingRule({ ...editingRule, is_active: !editingRule.is_active })}
                                    className={`w-11 h-6 rounded-full relative transition-all ${editingRule.is_active ? 'bg-app-primary' : 'bg-app-border'}`}
                                >
                                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${editingRule.is_active ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                        )}

                        {/* Wizard Footer — Back / Next / Save */}
                        <div
                            className="px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-bg))',
                                borderTop: '1px solid var(--app-border)',
                            }}
                        >
                            <button
                                onClick={() => setEditingRule(null)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            >
                                Cancel
                            </button>
                            <div className="flex items-center gap-2">
                                {wizardStep > 1 && (
                                    <button
                                        onClick={() => setWizardStep((wizardStep - 1) as 1 | 2 | 3)}
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                    >
                                        <ArrowLeft size={12} /> Back
                                    </button>
                                )}
                                {wizardStep < 3 ? (
                                    <button
                                        onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3)}
                                        disabled={(wizardStep === 1 && !editingRule.module) || (wizardStep === 2 && !editingRule.trigger_event)}
                                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                    >
                                        Next <ArrowRight size={12} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={saveRule}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                    >
                                        {saving ? 'Saving…' : (<><Check size={13} /> Save Rule</>)}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
