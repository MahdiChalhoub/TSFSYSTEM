'use client';

import { useState, useTransition } from 'react';
import { CheckCircle, Circle, Plus, Calendar, Award, ChevronRight, Clock } from 'lucide-react';

interface ChecklistItem {
 id: number;
 label: string;
 is_required: boolean;
 is_checked: boolean;
 notes?: string;
 checked_at?: string;
}

interface Checklist {
 id: number;
 template: number;
 template_name: string;
 assigned_to: number;
 assigned_to_name: string;
 date: string;
 status: string;
 completed_at?: string;
 points_earned: number;
 item_responses: ChecklistItem[];
 progress?: { total: number; done: number; percentage: number };
}

interface Template {
 id: number;
 name: string;
 trigger: string;
 trigger_display: string;
 points: number;
 items: { id: number; label: string; order: number; is_required: boolean }[];
}

interface Props {
 checklists: Checklist[];
 templates: Template[];
 users: { id: number; email: string; username: string }[];
}

export default function ChecklistsClient({ checklists: initial, templates, users }: Props) {
 const [checklists, setChecklists] = useState(initial);
 const [isPending, startTransition] = useTransition();
 const [expandedId, setExpandedId] = useState<number | null>(null);
 const [showAssign, setShowAssign] = useState(false);
 const [assignTemplate, setAssignTemplate] = useState('');
 const [assignUser, setAssignUser] = useState('');
 const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);

 async function handleToggleItem(checklistId: number, itemId: number, currentValue: boolean) {
 const { checkChecklistItem } = await import('@/app/actions/workspace');
 await checkChecklistItem(checklistId, itemId, !currentValue);
 setChecklists(prev => prev.map(cl => {
 if (cl.id !== checklistId) return cl;
 const items = cl.item_responses.map(it =>
 it.id === itemId ? { ...it, is_checked: !currentValue } : it
 );
 const done = items.filter(i => i.is_checked).length;
 const total = items.length;
 const allReqDone = items.filter(i => i.is_required).every(i => i.is_checked);
 return {
 ...cl,
 item_responses: items,
 progress: { total, done, percentage: Math.round(done / total * 100) },
 status: allReqDone ? 'COMPLETED' : 'IN_PROGRESS',
 };
 }));
 }

 async function handleAssign() {
 if (!assignTemplate || !assignUser || !assignDate) return;
 const { createChecklist } = await import('@/app/actions/workspace');
 const result = await createChecklist({
 template: parseInt(assignTemplate),
 assigned_to: parseInt(assignUser),
 date: assignDate,
 });
 if (result?.id) {
 setChecklists(prev => [result, ...prev]);
 setShowAssign(false);
 }
 }

 const STATUS_STYLE: Record<string, string> = {
 PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
 IN_PROGRESS: 'bg-sky-50 text-sky-700 border-sky-200',
 COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
 MISSED: 'bg-red-50 text-red-700 border-red-200',
 };

 return (
 <div className="space-y-6">
 {/* Templates Overview + Assign */}
 <div className="flex items-center justify-between bg-app-surface p-4 rounded-3xl shadow-lg shadow-gray-100 border border-gray-50">
 <div className="flex items-center gap-4 overflow-x-auto pb-1">
 {templates.map(t => (
 <div key={t.id} className="bg-gradient-to-br from-gray-50 to-white px-5 py-3 rounded-2xl border border-app-border shrink-0">
 <div className="font-bold text-sm text-app-text">{t.name}</div>
 <div className="text-[10px] text-app-text-faint uppercase tracking-wider">{t.trigger_display} · {t.items?.length || 0} items · {t.points} pts</div>
 </div>
 ))}
 </div>
 <button onClick={() => setShowAssign(true)}
 className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-bold rounded-2xl hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center gap-2 shrink-0 ml-4">
 <Plus size={16} /> Assign Checklist
 </button>
 </div>

 {/* Assign Form */}
 {showAssign && (
 <div className="bg-app-surface p-6 rounded-3xl shadow-xl border border-emerald-50 space-y-4 animate-in slide-in-from-top duration-300">
 <h3 className="text-lg font-bold text-app-text">Assign Checklist</h3>
 <div className="grid grid-cols-3 gap-4">
 <select value={assignTemplate} onChange={e => setAssignTemplate(e.target.value)}
 className="px-4 py-3 bg-app-bg rounded-2xl border border-app-border text-sm">
 <option value="">Select template...</option>
 {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
 </select>
 <select value={assignUser} onChange={e => setAssignUser(e.target.value)}
 className="px-4 py-3 bg-app-bg rounded-2xl border border-app-border text-sm">
 <option value="">Assign to...</option>
 {users.map((u: any) => <option key={u.id} value={u.id}>{u.email || u.username}</option>)}
 </select>
 <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)}
 className="px-4 py-3 bg-app-bg rounded-2xl border border-app-border text-sm" />
 </div>
 <div className="flex gap-3 justify-end">
 <button onClick={() => setShowAssign(false)} className="px-6 py-2 text-sm text-app-text-muted font-medium">Cancel</button>
 <button onClick={() => startTransition(handleAssign)}
 className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-2xl hover:bg-emerald-700 transition-all">
 {isPending ? 'Assigning...' : 'Assign'}
 </button>
 </div>
 </div>
 )}

 {/* Checklists List */}
 <div className="space-y-3">
 {checklists.length === 0 ? (
 <div className="text-center py-20 bg-app-surface rounded-3xl border border-gray-50">
 <CheckCircle size={48} className="mx-auto text-gray-300 mb-4" />
 <p className="text-app-text-faint font-medium text-lg">No checklists assigned</p>
 </div>
 ) : checklists.map(cl => {
 const isExpanded = expandedId === cl.id;
 const progress = cl.progress || {
 total: cl.item_responses?.length || 0,
 done: cl.item_responses?.filter(i => i.is_checked).length || 0,
 percentage: cl.item_responses?.length ? Math.round(cl.item_responses.filter(i => i.is_checked).length / cl.item_responses.length * 100) : 0,
 };

 return (
 <div key={cl.id} className="bg-app-surface rounded-2xl border border-gray-50 overflow-hidden hover:shadow-lg hover:shadow-gray-100 transition-all">
 <button onClick={() => setExpandedId(isExpanded ? null : cl.id)}
 className="w-full p-5 flex items-center gap-4 text-left">
 <ChevronRight size={18} className={`text-app-text-faint transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
 <div className="flex-1">
 <div className="font-bold text-app-text">{cl.template_name}</div>
 <div className="text-xs text-app-text-faint flex items-center gap-3 mt-1">
 <span className="flex items-center gap-1"><Calendar size={12} /> {cl.date}</span>
 <span>👤 {cl.assigned_to_name}</span>
 </div>
 </div>
 {/* Progress Bar */}
 <div className="w-32 bg-app-surface-2 rounded-full h-2.5 shrink-0">
 <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${progress.percentage}%` }} />
 </div>
 <span className="text-sm font-bold text-app-text-muted shrink-0 w-12 text-right">{progress.percentage}%</span>
 <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border shrink-0 ${STATUS_STYLE[cl.status] || ''}`}>
 {cl.status}
 </span>
 {cl.points_earned > 0 && (
 <span className="flex items-center gap-1 text-amber-500 bg-amber-50 px-3 py-1.5 rounded-xl text-sm font-bold shrink-0">
 <Award size={14} /> {cl.points_earned}
 </span>
 )}
 </button>

 {/* Expanded Items */}
 {isExpanded && (
 <div className="border-t border-gray-50 px-5 py-4 space-y-2 animate-in slide-in-from-top duration-200">
 {(cl.item_responses || []).map((item: any) => (
 <button key={item.id}
 onClick={() => startTransition(() => handleToggleItem(cl.id, item.template_item || item.id, item.is_checked))}
 className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-app-bg transition-colors text-left"
 disabled={cl.status === 'COMPLETED'}>
 {item.is_checked ? (
 <CheckCircle size={20} className="text-emerald-500 shrink-0" />
 ) : (
 <Circle size={20} className="text-gray-300 shrink-0" />
 )}
 <span className={`text-sm ${item.is_checked ? 'text-app-text-faint line-through' : 'text-gray-700 font-medium'}`}>
 {item.label}
 </span>
 {item.is_required && !item.is_checked && (
 <span className="text-[9px] text-red-400 font-bold uppercase ml-auto">Required</span>
 )}
 </button>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
}
