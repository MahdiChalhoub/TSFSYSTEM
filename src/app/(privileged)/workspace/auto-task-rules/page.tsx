'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
    Plus, Trash2, Edit3, Check, X, ChevronDown, Zap, Filter,
    User, Users, AlertOctagon, DollarSign, MapPin, CreditCard
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const TRIGGER_EVENTS = [
    { value: 'CREDIT_SALE', label: '💳 Credit Sale — No Cash Collected', group: 'Finance' },
    { value: 'HIGH_VALUE_SALE', label: '💰 High-Value Sale Threshold', group: 'Finance' },
    { value: 'ORDER_COMPLETED', label: '✅ Order Completed', group: 'Finance' },
    { value: 'POS_RETURN', label: '↩️ POS Return / Refund', group: 'Finance' },
    { value: 'CASHIER_DISCOUNT', label: '🏷 Cashier Applied Discount', group: 'Finance' },
    { value: 'NEGATIVE_STOCK', label: '📦 Negative Stock Sale', group: 'Finance' },
    { value: 'OVERDUE_INVOICE', label: '⏰ Invoice Overdue', group: 'Finance' },
    { value: 'LATE_PAYMENT', label: '🔴 Late Payment Detected', group: 'Finance' },
    { value: 'DAILY_SUMMARY', label: '📊 End-of-Day Financial Summary', group: 'Finance' },
    { value: 'NEW_INVOICE', label: '🧾 New Invoice Received', group: 'General' },
    { value: 'PRICE_CHANGE', label: '💱 Product Price Changed', group: 'General' },
    { value: 'LOW_STOCK', label: '⚠️ Low Stock Alert', group: 'General' },
    { value: 'PO_APPROVED', label: '📋 Purchase Order Approved', group: 'General' },
    { value: 'DELIVERY_COMPLETED', 'label': '🚚 Delivery Completed', group: 'General' },
    { value: 'CUSTOM', label: '⚙️ Custom Event', group: 'General' },
];

const PRIORITIES = [
    { value: 'URGENT', label: '🔴 Urgent', color: 'text-red-600' },
    { value: 'HIGH', label: '🟠 High', color: 'text-orange-500' },
    { value: 'MEDIUM', label: '🔵 Medium', color: 'text-blue-500' },
    { value: 'LOW', label: '⚪ Low', color: 'text-gray-400' },
];

interface AutoTaskRule {
    id?: number;
    name: string;
    trigger_event: string;
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
    is_active: boolean;
}

const emptyRule = (): AutoTaskRule => ({
    name: '',
    trigger_event: 'HIGH_VALUE_SALE',
    conditions: {},
    template_data: { title: '', priority: 'HIGH', estimated_minutes: 30, default_points: 1 },
    assign_to_user_id: null,
    assign_to_role_id: null,
    is_active: true,
});

// ── Main Component ───────────────────────────────────────────────────────────
export default function AutoTaskRulesPage() {
    const [rules, setRules] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRule, setEditingRule] = useState<AutoTaskRule | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [r, tmpl, u, rl] = await Promise.all([
                erpFetch('auto-task-rules/').catch(() => []),
                erpFetch('task-templates/').catch(() => []),
                erpFetch('users/').catch(() => []),
                erpFetch('roles/').catch(() => []),
            ]);
            setRules(Array.isArray(r) ? r : r?.results || []);
            setTemplates(Array.isArray(tmpl) ? tmpl : tmpl?.results || []);
            setUsers(Array.isArray(u) ? u : u?.results || []);
            setRoles(Array.isArray(rl) ? rl : rl?.results || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const saveRule = async () => {
        if (!editingRule) return;
        if (!editingRule.name.trim()) { toast.error('Rule name is required'); return; }
        if (!editingRule.trigger_event) { toast.error('Select a trigger event'); return; }

        setSaving(true);
        try {
            const payload: any = {
                name: editingRule.name,
                trigger_event: editingRule.trigger_event,
                conditions: editingRule.conditions,
                is_active: editingRule.is_active,
                assign_to_user: editingRule.assign_to_user_id || null,
            };

            // If no template, create one inline from template_data
            if (!editingRule.template_data?.title) {
                toast.error('Task title is required');
                setSaving(false);
                return;
            }

            // Create or reuse template
            const tmpl = await erpFetch('task-templates/', {
                method: 'POST',
                body: JSON.stringify({
                    name: editingRule.template_data.title || editingRule.name,
                    default_priority: editingRule.template_data.priority,
                    estimated_minutes: editingRule.template_data.estimated_minutes,
                    default_points: editingRule.template_data.default_points,
                    assign_to_role: editingRule.assign_to_role_id || null,
                    is_active: true,
                })
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
        } catch (e) {
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
        } catch { toast.error('Failed to delete'); }
    };

    const toggleActive = async (rule: any) => {
        try {
            await erpFetch(`auto-task-rules/${rule.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !rule.is_active })
            });
            load();
        } catch { toast.error('Failed to update'); }
    };

    const getTriggerLabel = (v: string) => TRIGGER_EVENTS.find(t => t.value === v)?.label || v;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Zap size={22} className="text-amber-500" /> Auto-Task Rules
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Automatically create tasks when financial or operational events occur. Filter by amount, site, client, or cashier.
                    </p>
                </div>
                <button
                    onClick={() => { setEditingRule(emptyRule()); setIsNew(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                >
                    <Plus size={15} /> New Rule
                </button>
            </div>

            {/* Rule List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Loading rules...</div>
                ) : rules.length === 0 ? (
                    <div className="p-10 text-center">
                        <Zap size={32} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No auto-task rules yet.</p>
                        <p className="text-gray-400 text-sm">Create your first rule to automate task creation based on financial events.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="p-4 text-left">Rule Name</th>
                                <th className="p-4 text-left">Trigger Event</th>
                                <th className="p-4 text-left">Conditions</th>
                                <th className="p-4 text-left">Task</th>
                                <th className="p-4 text-center w-20">Active</th>
                                <th className="p-4 text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {rules.map((rule: any) => (
                                <tr key={rule.id} className={clsx('hover:bg-gray-50 transition-colors', !rule.is_active && 'opacity-40')}>
                                    <td className="p-4 font-semibold text-gray-900">{rule.name}</td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                                            {getTriggerLabel(rule.trigger_event)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-500 space-y-0.5">
                                        {rule.conditions?.min_amount && <div className="flex items-center gap-1"><DollarSign size={10} /> ≥ {Number(rule.conditions.min_amount).toLocaleString()}</div>}
                                        {rule.conditions?.site_id && <div className="flex items-center gap-1"><MapPin size={10} /> Site #{rule.conditions.site_id}</div>}
                                        {rule.conditions?.payment_method && <div className="flex items-center gap-1"><CreditCard size={10} /> {rule.conditions.payment_method}</div>}
                                        {!Object.keys(rule.conditions || {}).length && <span className="text-gray-300">All events</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs font-semibold text-gray-700">{rule.template?.name}</div>
                                        <div className="text-[10px] text-gray-400">
                                            {rule.template?.default_priority} · {rule.assign_to_user ? `→ ${rule.assign_to_user_name || 'Specific User'}` : rule.template?.assign_to_role ? `→ Role` : 'Unassigned'}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => toggleActive(rule)}
                                            className={clsx('w-10 h-5 rounded-full relative transition-all', rule.is_active ? 'bg-emerald-500' : 'bg-gray-200')}
                                        >
                                            <span className={clsx('w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow', rule.is_active ? 'left-5' : 'left-0.5')} />
                                        </button>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => { setEditingRule({ ...rule, template_data: { title: rule.template?.name || '', priority: rule.template?.default_priority || 'HIGH', estimated_minutes: rule.template?.estimated_minutes || 30, default_points: rule.template?.default_points || 1 }, assign_to_role_id: rule.template?.assign_to_role || null }); setIsNew(false); }} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all">
                                                <Edit3 size={12} />
                                            </button>
                                            <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit / Create Modal */}
            {editingRule && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-black text-gray-900">{isNew ? 'New Auto-Task Rule' : 'Edit Rule'}</h2>
                            <button onClick={() => setEditingRule(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Rule Name */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Rule Name *</label>
                                <input value={editingRule.name} onChange={e => setEditingRule({ ...editingRule, name: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Alert on credit sales > 100,000 XOF" />
                            </div>

                            {/* Trigger Event */}
                            <div>
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Trigger Event *</label>
                                <select value={editingRule.trigger_event} onChange={e => setEditingRule({ ...editingRule, trigger_event: e.target.value })} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                    {['Finance', 'General'].map(group => (
                                        <optgroup key={group} label={group}>
                                            {TRIGGER_EVENTS.filter(t => t.group === group).map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">
                                    {editingRule.trigger_event === 'HIGH_VALUE_SALE' && '⚡ Will fire on every sale — use min_amount condition to filter.'}
                                    {editingRule.trigger_event === 'ORDER_COMPLETED' && '⚡ Fires after every completed sale. Use amount/site/client conditions to filter.'}
                                    {editingRule.trigger_event === 'CREDIT_SALE' && '⚡ Fires whenever a sale is processed with CREDIT payment method.'}
                                </p>
                            </div>

                            {/* Conditions */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Filter size={13} className="text-indigo-500" />
                                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-wide">Conditions (all optional)</h3>
                                </div>
                                <p className="text-[10px] text-gray-400">Only fire this rule when ALL specified conditions match. Leave blank to match everything.</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Min Amount (XOF)</label>
                                        <input type="number" value={editingRule.conditions.min_amount || ''} onChange={e => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, min_amount: e.target.value ? Number(e.target.value) : undefined } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="e.g. 500000" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Max Amount (XOF)</label>
                                        <input type="number" value={editingRule.conditions.max_amount || ''} onChange={e => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, max_amount: e.target.value ? Number(e.target.value) : undefined } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="optional" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Site ID</label>
                                        <input type="number" value={editingRule.conditions.site_id || ''} onChange={e => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, site_id: e.target.value ? Number(e.target.value) : undefined } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="only for this site" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Client ID</label>
                                        <input type="number" value={editingRule.conditions.client_id || ''} onChange={e => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, client_id: e.target.value ? Number(e.target.value) : undefined } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="only for this client" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Payment Method</label>
                                        <select value={editingRule.conditions.payment_method || ''} onChange={e => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, payment_method: e.target.value || undefined } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                                            <option value="">Any method</option>
                                            <option value="CREDIT">CREDIT</option>
                                            <option value="CASH">CASH</option>
                                            <option value="CARD">CARD</option>
                                            <option value="WAVE">WAVE</option>
                                            <option value="OM">Orange Money</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Cashier User ID</label>
                                        <input type="number" value={editingRule.conditions.cashier_id || ''} onChange={e => setEditingRule({ ...editingRule, conditions: { ...editingRule.conditions, cashier_id: e.target.value ? Number(e.target.value) : undefined } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="only for this cashier" />
                                    </div>
                                </div>
                            </div>

                            {/* Task Config */}
                            <div className="bg-indigo-50/50 rounded-xl p-4 space-y-3 border border-indigo-100">
                                <h3 className="text-xs font-black text-indigo-700 uppercase tracking-wide">Task to Create</h3>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-600 uppercase">Task Title Template *</label>
                                    <input value={editingRule.template_data.title} onChange={e => setEditingRule({ ...editingRule, template_data: { ...editingRule.template_data, title: e.target.value } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" placeholder="e.g. Follow up on credit sale — {reference}" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Priority</label>
                                        <select value={editingRule.template_data.priority} onChange={e => setEditingRule({ ...editingRule, template_data: { ...editingRule.template_data, priority: e.target.value } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase">Est. Minutes</label>
                                        <input type="number" value={editingRule.template_data.estimated_minutes} onChange={e => setEditingRule({ ...editingRule, template_data: { ...editingRule.template_data, estimated_minutes: Number(e.target.value) } })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Assignment */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <h3 className="text-xs font-black text-gray-700 uppercase tracking-wide">Task Assignment</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1"><User size={10} /> Specific User</label>
                                        <select value={editingRule.assign_to_user_id || ''} onChange={e => setEditingRule({ ...editingRule, assign_to_user_id: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                                            <option value="">— no specific user —</option>
                                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.username})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-600 uppercase flex items-center gap-1"><Users size={10} /> Role Group</label>
                                        <select value={editingRule.assign_to_role_id || ''} onChange={e => setEditingRule({ ...editingRule, assign_to_role_id: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                                            <option value="">— no role —</option>
                                            {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <p className="text-[9px] text-gray-400 mt-0.5">Specific User overrides Role</p>
                                    </div>
                                </div>
                            </div>

                            {/* Active toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Rule Active</p>
                                    <p className="text-xs text-gray-400">Disable to pause without deleting</p>
                                </div>
                                <button onClick={() => setEditingRule({ ...editingRule, is_active: !editingRule.is_active })} className={clsx('w-11 h-6 rounded-full relative transition-all', editingRule.is_active ? 'bg-emerald-500' : 'bg-gray-200')}>
                                    <span className={clsx('w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow', editingRule.is_active ? 'left-6' : 'left-1')} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                            <button onClick={() => setEditingRule(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-all">Cancel</button>
                            <button onClick={saveRule} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50">
                                {saving ? '...' : <><Check size={14} /> Save Rule</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
