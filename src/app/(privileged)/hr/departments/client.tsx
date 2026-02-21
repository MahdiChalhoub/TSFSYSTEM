'use client'

import { useState, useTransition } from "react"
import { createDepartment, updateDepartment, deleteDepartment } from "@/app/actions/hr"
import { toast } from "sonner"
import { Plus, Edit2, Trash2, Building2, ChevronRight, User } from "lucide-react"

interface Props {
    departments: any[]
    employees: any[]
}

export default function DepartmentsClient({ departments, employees }: Props) {
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<any>(null)
    const [isPending, startTransition] = useTransition()

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const data: Record<string, any> = {
            name: fd.get('name'),
            code: fd.get('code'),
            parent: fd.get('parent') || null,
            manager: fd.get('manager') || null,
            is_active: true,
        }
        startTransition(async () => {
            try {
                if (editing) {
                    await updateDepartment(editing.id, data)
                    toast.success('Department updated')
                } else {
                    await createDepartment(data)
                    toast.success('Department created')
                }
                setShowForm(false)
                setEditing(null)
            } catch (err: any) {
                toast.error(err.message || 'Failed')
            }
        })
    }

    const handleDelete = (id: string) => {
        if (!confirm('Delete this department?')) return
        startTransition(async () => {
            try {
                await deleteDepartment(id)
                toast.success('Department deleted')
            } catch (err: any) { toast.error(err.message || 'Failed') }
        })
    }

    const roots = departments.filter(d => !d.parent)
    const getChildren = (parentId: string) => departments.filter(d => d.parent === parentId)

    const renderDept = (dept: any, level = 0) => (
        <div key={dept.id}>
            <div className={`flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:border-violet-200 transition-all group ${level > 0 ? 'ml-8' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                        <Building2 size={18} className="text-violet-600" />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900">{dept.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{dept.code}</div>
                    </div>
                    {dept.manager_name && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full">
                            <User size={12} className="text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-700">{dept.manager_name}</span>
                        </div>
                    )}
                    {dept.parent_name && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <ChevronRight size={12} />
                            <span>under {dept.parent_name}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(dept); setShowForm(true) }} className="p-2 hover:bg-violet-50 rounded-xl transition-colors">
                        <Edit2 size={14} className="text-violet-600" />
                    </button>
                    <button onClick={() => handleDelete(dept.id)} className="p-2 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 size={14} className="text-red-500" />
                    </button>
                </div>
            </div>
            {getChildren(dept.id).map(child => renderDept(child, level + 1))}
        </div>
    )

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => { setEditing(null); setShowForm(!showForm) }}
                    className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-200">
                    <Plus size={18} /> Add Department
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-violet-100 shadow-xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Name</label>
                            <input name="name" defaultValue={editing?.name} required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Code</label>
                            <input name="code" defaultValue={editing?.code} required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all font-mono" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Parent Department</label>
                            <select name="parent" defaultValue={editing?.parent || ''} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 outline-none transition-all">
                                <option value="">— Root —</option>
                                {departments.filter(d => d.id !== editing?.id).map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Manager</label>
                            <select name="manager" defaultValue={editing?.manager || ''} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 outline-none transition-all">
                                <option value="">— None —</option>
                                {employees.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => { setShowForm(false); setEditing(null) }}
                            className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending}
                            className="px-8 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-all disabled:opacity-50">
                            {isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {roots.length === 0 && (
                    <div className="text-center py-20 text-gray-400">
                        <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-semibold">No departments yet</p>
                        <p className="text-sm">Create your first department to organize your workforce</p>
                    </div>
                )}
                {roots.map(dept => renderDept(dept))}
            </div>
        </div>
    )
}
