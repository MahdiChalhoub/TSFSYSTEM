'use client';

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { Bell, CheckSquare, Save } from 'lucide-react';

const EVENT_TYPES = [
 { id: 'PRICE_OVERRIDE', label: 'Price Override', desc: 'Triggered when a cashier sells an item below the base price limit.' },
 { id: 'GLOBAL_DISCOUNT', label: 'Global Discount', desc: 'Triggered when a manual discount is applied to the entire cart.' },
 { id: 'CLEAR_CART', label: 'Clear Cart', desc: 'Triggered when a cashier deletes an entire active ticket.' },
 { id: 'REMOVE_ITEM', label: 'Remove Item', desc: 'Triggered when an item is completely removed from the cart.' },
 { id: 'DECREASE_QTY', label: 'Decrease Quantity', desc: 'Triggered when the quantity of a previously added item is reduced.' },
 { id: 'CREDIT_SALE', label: 'Credit Sale', desc: 'Triggered when a sale is completed with the CREDIT payment method — no cash collected, client owes the amount.' },
 { id: 'NEGATIVE_STOCK_OVERRIDE', label: 'Negative Stock Sale', desc: 'Triggered when a sale is processed for an item with zero or negative stock (requires Allow Negative Stock setting).' },
];

export default function AuditSettings() {
 const [rules, setRules] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 const loadRules = async () => {
 setLoading(true);
 try {
 const data = await erpFetch('pos-audit-rules/');
 setRules(data || []);
 } catch (e) {
 toast.error("Failed to load audit rules");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadRules();
 }, []);

 const toggleRule = async (eventType: string, field: 'send_notification' | 'create_task') => {
 const existing = rules.find(r => r.event_type === eventType);
 try {
 if (existing) {
 const payload = { ...existing, [field]: !existing[field] };
 await erpFetch(`pos-audit-rules/${existing.id}/`, {
 method: 'PUT',
 body: JSON.stringify(payload)
 });
 setRules(prev => prev.map(r => r.id === existing.id ? payload : r));
 } else {
 const payload = { event_type: eventType, send_notification: false, create_task: false, [field]: true };
 const res = await erpFetch('pos-audit-rules/', {
 method: 'POST',
 body: JSON.stringify(payload)
 });
 setRules(prev => [...prev, res]);
 }
 toast.success("Rule updated successfully");
 } catch (e) {
 toast.error("Failed to save rule");
 }
 };

 return (
 <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden max-w-4xl">
 <div className="px-6 py-5 border-b bg-app-surface-2/50">
 <h3>Audit Alert Configuration</h3>
 <p className="text-sm text-app-muted-foreground mt-1">Configure which POS events should notify managers or create immediate follow-up tasks.</p>
 </div>
 <div className="p-0">
 <table className="w-full text-left text-sm">
 <thead className="bg-app-background text-app-muted-foreground uppercase text-[10px] font-bold tracking-wider">
 <tr>
 <th className="px-6 py-3">Event Trigger</th>
 <th className="px-6 py-3 text-center w-32">Notify Managers</th>
 <th className="px-6 py-3 text-center w-32">Create Task</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border">
 {EVENT_TYPES.map(ev => {
 const rule = rules.find(r => r.event_type === ev.id) || { send_notification: false, create_task: false };
 return (
 <tr key={ev.id} className="hover:bg-app-background transition-colors">
 <td className="px-6 py-4">
 <div className="font-semibold text-app-foreground">{ev.label}</div>
 <div className="text-xs text-app-muted-foreground mt-1">{ev.desc}</div>
 </td>
 <td className="px-6 py-4 text-center">
 <button
 onClick={() => toggleRule(ev.id, 'send_notification')}
 className={`w-10 h-6 rounded-full transition-colors relative ${rule.send_notification ? 'bg-app-primary' : 'bg-app-border'}`}
 >
 <span className={`absolute top-1 w-4 h-4 bg-app-surface rounded-full transition-all ${rule.send_notification ? 'left-5' : 'left-1'}`} />
 </button>
 </td>
 <td className="px-6 py-4 text-center">
 <button
 onClick={() => toggleRule(ev.id, 'create_task')}
 className={`w-10 h-6 rounded-full transition-colors relative ${rule.create_task ? 'bg-app-info' : 'bg-app-border'}`}
 >
 <span className={`absolute top-1 w-4 h-4 bg-app-surface rounded-full transition-all ${rule.create_task ? 'left-5' : 'left-1'}`} />
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 );
}
