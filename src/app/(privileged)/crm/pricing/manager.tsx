// @ts-nocheck
'use client';

import { useState } from 'react';
import { Plus, Tag, Users, DollarSign, Percent, Hash, Trash2, ChevronRight, Search, Calendar, Star, AlertCircle } from "lucide-react";
import clsx from 'clsx';
import { createPriceGroup, createPriceRule, deletePriceGroup, deletePriceRule } from '@/app/actions/pricing';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function PricingManager({
 priceGroups,
 priceRules,
 contacts,
 products,
 categories,
}: {
 priceGroups: Record<string, any>[],
 priceRules: Record<string, any>[],
 contacts: Record<string, any>[],
 products: Record<string, any>[],
 categories: Record<string, any>[],
}) {
 const [tab, setTab] = useState<'groups' | 'rules'>('groups');
 const [showGroupForm, setShowGroupForm] = useState(false);
 const [showRuleForm, setShowRuleForm] = useState(false);
 const [search, setSearch] = useState('');

 // Group form
 const [groupName, setGroupName] = useState('');
 const [groupDesc, setGroupDesc] = useState('');
 const [groupPriority, setGroupPriority] = useState('0');

 // Rule form
 const [ruleType, setRuleType] = useState('FIXED_PRICE');
 const [ruleValue, setRuleValue] = useState('');
 const [ruleContactId, setRuleContactId] = useState('');
 const [ruleGroupId, setRuleGroupId] = useState('');
 const [ruleProductId, setRuleProductId] = useState('');
 const [ruleCategoryId, setRuleCategoryId] = useState('');
 const [ruleMinQty, setRuleMinQty] = useState('1');
 const [ruleNotes, setRuleNotes] = useState('');

 const [saving, setSaving] = useState(false);
 const [message, setMessage] = useState('');

 const handleCreateGroup = async () => {
 setSaving(true);
 const fd = new FormData();
 fd.set('name', groupName);
 fd.set('description', groupDesc);
 fd.set('priority', groupPriority);
 const result = await createPriceGroup(null, fd);
 setSaving(false);
 if (result.success) {
 setShowGroupForm(false);
 setGroupName(''); setGroupDesc(''); setGroupPriority('0');
 window.location.reload();
 } else {
 setMessage(result.message || 'Failed');
 }
 };

 const handleCreateRule = async () => {
 setSaving(true);
 const fd = new FormData();
 fd.set('discountType', ruleType);
 fd.set('value', ruleValue);
 fd.set('minQuantity', ruleMinQty);
 fd.set('notes', ruleNotes);
 if (ruleContactId) fd.set('contactId', ruleContactId);
 if (ruleGroupId) fd.set('priceGroupId', ruleGroupId);
 if (ruleProductId) fd.set('productId', ruleProductId);
 if (ruleCategoryId) fd.set('categoryId', ruleCategoryId);
 const result = await createPriceRule(null, fd);
 setSaving(false);
 if (result.success) {
 setShowRuleForm(false);
 setRuleValue(''); setRuleContactId(''); setRuleGroupId(''); setRuleProductId('');
 window.location.reload();
 } else {
 setMessage(result.message || 'Failed');
 }
 };

 const [deleteTarget, setDeleteTarget] = useState<{ type: 'group' | 'rule'; id: number; title: string; description: string } | null>(null);

 const handleDeleteGroup = async (id: number) => {
 setDeleteTarget({
 type: 'group',
 id,
 title: 'Delete Price Group?',
 description: 'All members and rules in this group will be removed.',
 });
 };

 const handleDeleteRule = async (id: number) => {
 setDeleteTarget({
 type: 'rule',
 id,
 title: 'Delete Price Rule?',
 description: 'This price rule will be permanently removed.',
 });
 };

 const handleConfirmDelete = async () => {
 if (!deleteTarget) return;
 if (deleteTarget.type === 'group') {
 await deletePriceGroup(deleteTarget.id);
 } else {
 await deletePriceRule(deleteTarget.id);
 }
 setDeleteTarget(null);
 window.location.reload();
 };

 const discountLabel = (type: string) => {
 switch (type) {
 case 'FIXED_PRICE': return 'Fixed Price';
 case 'PERCENTAGE': return '% Discount';
 case 'AMOUNT_OFF': return 'Amount Off';
 default: return type;
 }
 };

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
 {/* Tab Bar + Actions */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-surface p-6 rounded-[40px] shadow-2xl shadow-violet-900/5 border border-app-border">
 <div className="flex gap-2 bg-app-background p-1.5 rounded-2xl">
 {(['groups', 'rules'] as const).map((t) => (
 <button
 key={t}
 onClick={() => setTab(t)}
 className={clsx(
 "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
 tab === t ? "bg-app-surface text-app-foreground shadow-sm" : "text-app-muted-foreground hover:text-app-muted-foreground"
 )}
 >
 {t === 'groups' ? '📦 Price Groups' : '📐 Price Rules'}
 </button>
 ))}
 </div>

 <div className="flex gap-3">
 <div className="relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
 <input
 className="pl-12 pr-6 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-muted-foreground placeholder:text-app-muted-foreground w-64"
 placeholder="Search..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>
 <button
 onClick={() => tab === 'groups' ? setShowGroupForm(true) : setShowRuleForm(true)}
 className="px-6 py-3 bg-app-primary text-app-foreground rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-violet-100 hover:bg-app-primary hover:-translate-y-0.5 transition-all flex items-center gap-2"
 >
 <Plus size={18} />
 New {tab === 'groups' ? 'Group' : 'Rule'}
 </button>
 </div>
 </div>

 {message && (
 <div className="p-4 bg-rose-50 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-2">
 <AlertCircle size={16} /> {message}
 </div>
 )}

 {/* Price Groups Tab */}
 {tab === 'groups' && (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
 {priceGroups
 .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
 .map((group) => (
 <div key={group.id} className="group bg-app-surface p-8 rounded-[40px] border border-app-border hover:shadow-2xl hover:shadow-violet-900/5 transition-all relative overflow-hidden">
 <div className="absolute right-6 top-6 text-[40px] font-black text-app-muted-foreground group-hover:text-violet-50/40 transition-colors">P{group.priority}</div>

 <div className="flex items-start justify-between relative z-10">
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <div className="w-10 h-10 rounded-xl bg-app-primary/10 text-app-primary flex items-center justify-center">
 <Tag size={20} />
 </div>
 <div>
 <h3 className="text-xl font-black text-app-foreground">{group.name}</h3>
 <p className="text-xs text-app-muted-foreground font-bold">Priority: {group.priority}</p>
 </div>
 </div>
 {group.description && (
 <p className="text-sm text-app-muted-foreground font-medium">{group.description}</p>
 )}
 </div>
 <button
 onClick={() => handleDeleteGroup(group.id)}
 className="p-2 text-app-muted-foreground hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
 >
 <Trash2 size={16} />
 </button>
 </div>

 <div className="mt-6 flex gap-4">
 <div className="bg-app-background rounded-2xl p-4 flex-1 text-center">
 <div className="text-2xl font-black text-app-foreground">{group.member_count || 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Members</div>
 </div>
 <div className="bg-app-background rounded-2xl p-4 flex-1 text-center">
 <div className="text-2xl font-black text-app-foreground">{group.rule_count || 0}</div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Rules</div>
 </div>
 </div>

 {(group.valid_from || group.valid_until) && (
 <div className="mt-4 flex items-center gap-2 text-xs text-app-muted-foreground font-bold">
 <Calendar size={12} />
 {group.valid_from && <span>From: {group.valid_from}</span>}
 {group.valid_until && <span>Until: {group.valid_until}</span>}
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {/* Price Rules Tab */}
 {tab === 'rules' && (
 <div className="space-y-4 pb-20">
 {priceRules
 .filter(r =>
 (r.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (r.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (r.group_name || '').toLowerCase().includes(search.toLowerCase())
 )
 .map((rule) => (
 <div key={rule.id} className="group bg-app-surface p-6 rounded-[32px] border border-app-border hover:shadow-xl hover:shadow-violet-900/5 transition-all flex items-center gap-6">
 <div className={clsx(
 "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
 rule.discount_type === 'FIXED_PRICE' ? "bg-app-primary-light text-app-primary" :
 rule.discount_type === 'PERCENTAGE' ? "bg-app-info-bg text-app-info" : "bg-app-warning-bg text-app-warning"
 )}>
 {rule.discount_type === 'PERCENTAGE' ? <Percent size={24} /> :
 rule.discount_type === 'AMOUNT_OFF' ? <Hash size={24} /> : <DollarSign size={24} />}
 </div>

 <div className="flex-1 space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className={clsx(
 "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase",
 rule.discount_type === 'FIXED_PRICE' ? "bg-app-primary-light text-app-success" :
 rule.discount_type === 'PERCENTAGE' ? "bg-app-info-bg text-app-info" : "bg-app-warning-bg text-app-warning"
 )}>
 {discountLabel(rule.discount_type)}
 </span>
 <span className="text-lg font-black text-app-foreground">
 {rule.discount_type === 'PERCENTAGE' ? `${rule.value}%` : `$${rule.value}`}
 </span>
 {rule.min_quantity > 1 && (
 <span className="text-xs text-app-muted-foreground font-bold">Min qty: {rule.min_quantity}</span>
 )}
 </div>
 <div className="flex items-center gap-4 text-xs font-bold text-app-muted-foreground">
 {rule.contact_name && <span>👤 {rule.contact_name}</span>}
 {rule.group_name && <span>📦 {rule.group_name}</span>}
 {rule.product_name && <span>📦 {rule.product_name}</span>}
 {rule.category_name && <span>🏷️ {rule.category_name}</span>}
 {!rule.contact_name && !rule.group_name && <span className="text-app-muted-foreground">Global rule</span>}
 </div>
 </div>

 <button
 onClick={() => handleDeleteRule(rule.id)}
 className="p-2 text-app-muted-foreground hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
 >
 <Trash2 size={16} />
 </button>
 </div>
 ))}
 {priceRules.length === 0 && (
 <div className="text-center py-20 text-app-muted-foreground font-bold">
 No price rules yet. Create one to get started.
 </div>
 )}
 </div>
 )}

 {/* Create Group Modal */}
 {showGroupForm && (
 <div className="fixed inset-0 bg-app-background/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
 <div className="bg-app-surface rounded-[40px] shadow-2xl w-full max-w-lg p-8 space-y-6 animate-in fade-in zoom-in duration-300">
 <h2 className="text-2xl font-black text-app-foreground">New Price Group</h2>
 <div className="space-y-4">
 <div>
 <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2">Group Name</label>
 <input
 value={groupName} onChange={(e) => setGroupName(e.target.value)}
 className="w-full px-4 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-foreground"
 placeholder="e.g., VIP Clients"
 />
 </div>
 <div>
 <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2">Description</label>
 <textarea
 value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
 className="w-full px-4 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-foreground resize-none"
 rows={2} placeholder="Describe this pricing tier..."
 />
 </div>
 <div>
 <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2">Priority (higher = wins)</label>
 <input
 type="number" value={groupPriority} onChange={(e) => setGroupPriority(e.target.value)}
 className="w-full px-4 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-foreground"
 />
 </div>
 </div>
 <div className="flex gap-4 pt-4">
 <button onClick={() => setShowGroupForm(false)} className="flex-1 px-6 py-3 rounded-2xl font-black text-app-muted-foreground hover:bg-app-background transition-all text-sm uppercase tracking-widest">Cancel</button>
 <button onClick={handleCreateGroup} disabled={saving || !groupName} className="flex-[2] px-6 py-3 bg-app-primary text-app-foreground rounded-2xl font-black shadow-lg hover:bg-app-primary transition-all text-sm uppercase tracking-widest disabled:opacity-50">
 {saving ? 'Creating...' : 'Create Group'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Create Rule Modal */}
 {showRuleForm && (
 <div className="fixed inset-0 bg-app-background/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
 <div className="bg-app-surface rounded-[40px] shadow-2xl w-full max-w-lg p-8 space-y-6 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
 <h2 className="text-2xl font-black text-app-foreground">New Price Rule</h2>
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2">Discount Type</label>
 <select value={ruleType} onChange={(e) => setRuleType(e.target.value)}
 className="w-full px-4 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-foreground appearance-none">
 <option value="FIXED_PRICE">Fixed Price</option>
 <option value="PERCENTAGE">% Discount</option>
 <option value="AMOUNT_OFF">Amount Off</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2">
 {ruleType === 'PERCENTAGE' ? 'Discount %' : 'Price / Amount'}
 </label>
 <input type="number" step="0.01" value={ruleValue} onChange={(e) => setRuleValue(e.target.value)}
 className="w-full px-4 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-foreground"
 placeholder={ruleType === 'PERCENTAGE' ? '10' : '0.00'}
 />
 </div>
 </div>

 <div className="p-4 bg-violet-50 rounded-2xl space-y-3">
 <p className="text-xs font-black text-app-primary uppercase tracking-widest">Target (choose one)</p>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground mb-1">Specific Contact</label>
 <select value={ruleContactId} onChange={(e) => { setRuleContactId(e.target.value); if (e.target.value) setRuleGroupId(''); }}
 className="w-full px-4 py-2.5 rounded-xl bg-app-surface border-none focus:ring-2 focus:ring-violet-200 outline-none font-bold text-app-foreground text-sm appearance-none">
 <option value="">— None —</option>
 {contacts.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground mb-1">Or Price Group</label>
 <select value={ruleGroupId} onChange={(e) => { setRuleGroupId(e.target.value); if (e.target.value) setRuleContactId(''); }}
 className="w-full px-4 py-2.5 rounded-xl bg-app-surface border-none focus:ring-2 focus:ring-violet-200 outline-none font-bold text-app-foreground text-sm appearance-none">
 <option value="">— None —</option>
 {priceGroups.map((g: Record<string, any>) => <option key={g.id} value={g.id}>{g.name}</option>)}
 </select>
 </div>
 </div>

 <div className="p-4 bg-app-background rounded-2xl space-y-3">
 <p className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Scope (optional)</p>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground mb-1">Product</label>
 <select value={ruleProductId} onChange={(e) => setRuleProductId(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl bg-app-surface border-none focus:ring-2 focus:ring-gray-200 outline-none font-bold text-app-foreground text-sm appearance-none">
 <option value="">All Products</option>
 {products.map((p: Record<string, any>) => <option key={p.id} value={p.id}>{p.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground mb-1">Or Category</label>
 <select value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl bg-app-surface border-none focus:ring-2 focus:ring-gray-200 outline-none font-bold text-app-foreground text-sm appearance-none">
 <option value="">All Categories</option>
 {categories.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </div>
 </div>

 <div>
 <label className="block text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-2">Min Quantity</label>
 <input type="number" min="1" value={ruleMinQty} onChange={(e) => setRuleMinQty(e.target.value)}
 className="w-full px-4 py-3 rounded-2xl bg-app-background border-none focus:ring-4 focus:ring-violet-100 outline-none font-bold text-app-foreground"
 />
 </div>
 </div>
 <div className="flex gap-4 pt-4">
 <button onClick={() => setShowRuleForm(false)} className="flex-1 px-6 py-3 rounded-2xl font-black text-app-muted-foreground hover:bg-app-background transition-all text-sm uppercase tracking-widest">Cancel</button>
 <button onClick={handleCreateRule} disabled={saving || !ruleValue} className="flex-[2] px-6 py-3 bg-app-primary text-app-foreground rounded-2xl font-black shadow-lg hover:bg-app-primary transition-all text-sm uppercase tracking-widest disabled:opacity-50">
 {saving ? 'Creating...' : 'Create Rule'}
 </button>
 </div>
 </div>
 </div>
 )}

 <ConfirmDialog
 open={deleteTarget !== null}
 onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
 onConfirm={handleConfirmDelete}
 title={deleteTarget?.title ?? ''}
 description={deleteTarget?.description ?? ''}
 variant="danger"
 />
 </div>
 );
}
