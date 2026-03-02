'use client'

import { useState, useTransition } from "react"
import { createShift, updateShift, deleteShift } from "@/app/actions/hr"
import { toast } from "sonner"
import { Plus, Edit2, Trash2, Clock, Sun, Moon, Sunset, Coffee } from "lucide-react"

interface Props { shifts: any[] }

const SHIFT_ICONS: Record<string, any> = {
 'MORNING': <Sun size={18} className="text-amber-500" />,
 'AFTERNOON': <Sunset size={18} className="text-orange-500" />,
 'NIGHT': <Moon size={18} className="text-indigo-500" />,
}

export default function ShiftsClient({ shifts }: Props) {
 const [showForm, setShowForm] = useState(false)
 const [editing, setEditing] = useState<any>(null)
 const [isPending, startTransition] = useTransition()

 const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault()
 const fd = new FormData(e.currentTarget)
 const data: Record<string, any> = {
 name: fd.get('name'),
 start_time: fd.get('start_time'),
 end_time: fd.get('end_time'),
 break_duration_minutes: parseInt(fd.get('break_duration_minutes') as string) || 0,
 shift_type: fd.get('shift_type') || 'MORNING',
 is_active: true,
 }
 startTransition(async () => {
 try {
 if (editing) {
 await updateShift(editing.id, data)
 toast.success('Shift updated')
 } else {
 await createShift(data)
 toast.success('Shift created')
 }
 setShowForm(false)
 setEditing(null)
 } catch (err: any) { toast.error(err.message || 'Failed') }
 })
 }

 const handleDelete = (id: string) => {
 if (!confirm('Delete this shift?')) return
 startTransition(async () => {
 try { await deleteShift(id); toast.success('Deleted') }
 catch (err: any) { toast.error(err.message) }
 })
 }

 return (
 <div className="space-y-4">
 <div className="flex justify-end">
 <button onClick={() => { setEditing(null); setShowForm(!showForm) }}
 className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-app-text rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200">
 <Plus size={18} /> Add Shift
 </button>
 </div>

 {showForm && (
 <form onSubmit={handleSubmit} className="bg-app-surface p-8 rounded-3xl border border-amber-100 shadow-xl space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <div>
 <label className="block text-xs font-black text-app-text-faint uppercase tracking-wider mb-2">Shift Name</label>
 <input name="name" defaultValue={editing?.name} required
 className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
 </div>
 <div>
 <label className="block text-xs font-black text-app-text-faint uppercase tracking-wider mb-2">Start Time</label>
 <input name="start_time" type="time" defaultValue={editing?.start_time} required
 className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-amber-400 outline-none transition-all" />
 </div>
 <div>
 <label className="block text-xs font-black text-app-text-faint uppercase tracking-wider mb-2">End Time</label>
 <input name="end_time" type="time" defaultValue={editing?.end_time} required
 className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-amber-400 outline-none transition-all" />
 </div>
 <div>
 <label className="block text-xs font-black text-app-text-faint uppercase tracking-wider mb-2">Break (min)</label>
 <input name="break_duration_minutes" type="number" defaultValue={editing?.break_duration_minutes || 0}
 className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-amber-400 outline-none transition-all" />
 </div>
 </div>
 <div className="flex justify-end gap-3 pt-4">
 <button type="button" onClick={() => { setShowForm(false); setEditing(null) }}
 className="px-6 py-3 rounded-xl border border-app-border font-bold text-app-text-muted hover:bg-app-bg transition-colors">Cancel</button>
 <button type="submit" disabled={isPending}
 className="px-8 py-3 bg-amber-600 text-app-text rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50 transition-all">
 {isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
 </button>
 </div>
 </form>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {shifts.length === 0 && (
 <div className="col-span-full text-center py-20 text-app-text-faint">
 <Clock size={48} className="mx-auto mb-4 opacity-30" />
 <p className="text-lg font-semibold">No shifts defined</p>
 <p className="text-sm">Create shifts to schedule your workforce</p>
 </div>
 )}
 {shifts.map((s: any) => (
 <div key={s.id} className="bg-app-surface p-6 rounded-2xl border border-app-border hover:shadow-lg hover:border-amber-200 transition-all group">
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
 {SHIFT_ICONS[s.shift_type] || <Clock size={18} className="text-amber-600" />}
 </div>
 <div>
 <div className="font-bold text-app-text">{s.name}</div>
 <div className="text-xs text-app-text-faint">{s.shift_type || 'Standard'}</div>
 </div>
 </div>
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => { setEditing(s); setShowForm(true) }} className="p-2 hover:bg-amber-50 rounded-xl">
 <Edit2 size={14} className="text-amber-600" />
 </button>
 <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-xl">
 <Trash2 size={14} className="text-red-500" />
 </button>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
 <div className="text-center">
 <div className="text-lg font-black text-app-text">{s.start_time || '—'}</div>
 <div className="text-[10px] font-bold text-app-text-faint uppercase">Start</div>
 </div>
 <div className="text-center">
 <div className="text-lg font-black text-app-text">{s.end_time || '—'}</div>
 <div className="text-[10px] font-bold text-app-text-faint uppercase">End</div>
 </div>
 <div className="text-center">
 <div className="text-lg font-black text-amber-600">{s.break_duration_minutes || 0}<span className="text-xs">m</span></div>
 <div className="text-[10px] font-bold text-app-text-faint uppercase">Break</div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}
