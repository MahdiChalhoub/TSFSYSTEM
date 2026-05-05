'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    getFormDefinitions, createFormDefinition, updateFormDefinition, deleteFormDefinition,
} from '@/app/actions/finance/forms'
import type { FormDefinition, FormField, FieldType } from '@/app/actions/finance/forms'
import { DynamicFormRenderer } from '@/components/forms/DynamicFormRenderer'
import {
    Plus, Pencil, Trash2, Eye, EyeOff, ChevronDown, ChevronUp,
    GripVertical, X, CheckCircle, AlertTriangle, Loader2, Copy,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Field type metadata ───────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
    { value: 'text',     label: 'Text',          icon: 'T' },
    { value: 'textarea', label: 'Long Text',      icon: '¶' },
    { value: 'number',   label: 'Number',         icon: '#' },
    { value: 'decimal',  label: 'Decimal',        icon: '0.0' },
    { value: 'date',     label: 'Date',           icon: '📅' },
    { value: 'select',   label: 'Select',         icon: '▾' },
    { value: 'checkbox', label: 'Checkbox',       icon: '✓' },
    { value: 'email',    label: 'Email',          icon: '@' },
    { value: 'url',      label: 'URL',            icon: '🔗' },
]

const newField = (): FormField => ({
    key: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    help: '',
    options: [],
    default: '',
})

// ── Field editor row ──────────────────────────────────────────────────────────

function FieldEditor({
    field,
    index,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: {
    field: FormField
    index: number
    onChange: (updated: FormField) => void
    onRemove: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    isFirst: boolean
    isLast: boolean
}) {
    const [expanded, setExpanded] = useState(index === 0)
    const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'))

    const update = (patch: Partial<FormField>) => onChange({ ...field, ...patch })

    const handleOptionsBlur = () => {
        const opts = optionsText.split('\n').map(s => s.trim()).filter(Boolean)
        update({ options: opts })
    }

    const inputCls = 'w-full px-2.5 py-1.5 text-xs border border-app-border rounded-lg focus:outline-none focus:ring-1 focus:ring-app-border'

    return (
        <div className="border border-app-border rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-app-surface cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}>
                <GripVertical className="h-3.5 w-3.5 text-app-faint flex-shrink-0" />

                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="w-7 h-5 flex items-center justify-center text-[10px] font-bold bg-app-surface-2 text-app-muted-foreground rounded">
                        {FIELD_TYPES.find(t => t.value === field.type)?.icon ?? 'T'}
                    </span>
                    <span className="text-sm font-semibold text-app-foreground truncate">
                        {field.label || <span className="text-app-muted-foreground italic">Untitled field</span>}
                    </span>
                    {field.key && (
                        <span className="text-[10px] font-mono text-app-muted-foreground bg-app-surface-2 px-1.5 py-0.5 rounded hidden sm:inline">
                            {field.key}
                        </span>
                    )}
                    {field.required && (
                        <span className="text-[10px] font-bold text-app-error bg-app-error-bg border border-rose-100 px-1.5 py-0.5 rounded">
                            required
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-app-faint hover:text-app-muted-foreground disabled:opacity-30">
                        <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onMoveDown} disabled={isLast} className="p-1 text-app-faint hover:text-app-muted-foreground disabled:opacity-30">
                        <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onRemove} className="p-1 text-app-faint hover:text-app-error">
                        <X className="h-3.5 w-3.5" />
                    </button>
                    <ChevronDown className={`h-3.5 w-3.5 text-app-muted-foreground ml-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Expanded editor */}
            {expanded && (
                <div className="p-4 border-t border-app-border grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Label *</label>
                        <input value={field.label} onChange={e => update({ label: e.target.value })}
                            placeholder="Field label shown to user" className={inputCls} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Key * <span className="normal-case font-normal text-app-muted-foreground">(unique, no spaces)</span></label>
                        <input value={field.key} onChange={e => update({ key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                            placeholder="field_key" className={`${inputCls} font-mono`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Type</label>
                        <select value={field.type} onChange={e => update({ type: e.target.value as FieldType })} className={inputCls}>
                            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Placeholder</label>
                        <input value={field.placeholder ?? ''} onChange={e => update({ placeholder: e.target.value })}
                            placeholder="Optional hint text" className={inputCls} />
                    </div>
                    <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Help text</label>
                        <input value={field.help ?? ''} onChange={e => update({ help: e.target.value })}
                            placeholder="Shown below the field" className={inputCls} />
                    </div>

                    {field.type === 'select' && (
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Options <span className="normal-case font-normal text-app-muted-foreground">(one per line)</span></label>
                            <textarea
                                rows={4}
                                value={optionsText}
                                onChange={e => setOptionsText(e.target.value)}
                                onBlur={handleOptionsBlur}
                                placeholder={"OPTION_A\nOPTION_B\nOPTION_C"}
                                className={`${inputCls} resize-y font-mono`}
                            />
                        </div>
                    )}

                    {(field.type === 'number' || field.type === 'decimal') && (
                        <>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Min</label>
                                <input type="number" value={field.min ?? ''} onChange={e => update({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Max</label>
                                <input type="number" value={field.max ?? ''} onChange={e => update({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    className={inputCls} />
                            </div>
                        </>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Default value</label>
                        <input value={String(field.default ?? '')} onChange={e => update({ default: e.target.value })}
                            className={inputCls} />
                    </div>
                    <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={field.required ?? false} onChange={e => update({ required: e.target.checked })}
                                className="w-3.5 h-3.5 accent-stone-900" />
                            <span className="text-xs font-semibold text-app-foreground">Required</span>
                        </label>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Form editor modal ─────────────────────────────────────────────────────────

function FormEditorModal({
    existing,
    onClose,
    onSaved,
}: {
    existing: FormDefinition | null
    onClose: () => void
    onSaved: (form: FormDefinition) => void
}) {
    const [name, setName] = useState(existing?.name ?? '')
    const [key, setKey] = useState(existing?.key ?? '')
    const [description, setDescription] = useState(existing?.description ?? '')
    const [isActive, setIsActive] = useState(existing?.is_active ?? true)
    const [fields, setFields] = useState<FormField[]>(existing?.schema?.fields ?? [])
    const [saving, setSaving] = useState(false)
    const [previewMode, setPreviewMode] = useState(false)
    const [keyEdited, setKeyEdited] = useState(!!existing)

    const addField = () => setFields(f => [...f, newField()])

    const updateField = (i: number, updated: FormField) =>
        setFields(f => f.map((x, idx) => idx === i ? updated : x))

    const removeField = (i: number) =>
        setFields(f => f.filter((_, idx) => idx !== i))

    const moveField = (i: number, dir: -1 | 1) => {
        setFields(f => {
            const arr = [...f]
            const j = i + dir
            if (j < 0 || j >= arr.length) return arr;
            [arr[i], arr[j]] = [arr[j], arr[i]]
            return arr
        })
    }

    const handleNameChange = (val: string) => {
        setName(val)
        if (!keyEdited) {
            setKey(val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
        }
    }

    const handleSave = async () => {
        if (!name.trim() || !key.trim()) {
            toast.error('Name and key are required.')
            return
        }
        const schema = { fields }
        setSaving(true)
        try {
            let saved: FormDefinition
            if (existing) {
                saved = await updateFormDefinition(existing.id, { name, description, schema, is_active: isActive })
            } else {
                saved = await createFormDefinition({ key, name, description, schema, is_active: isActive })
            }
            toast.success(existing ? 'Form updated.' : 'Form created.')
            onSaved(saved)
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save form.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
            <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
                    <h2 className="text-lg font-bold text-app-foreground">
                        {existing ? 'Edit Form' : 'New Form Definition'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPreviewMode(p => !p)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${previewMode ? 'bg-app-bg text-white' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-app-surface-2'}`}>
                            {previewMode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {previewMode ? 'Edit' : 'Preview'}
                        </button>
                        <button onClick={onClose} className="p-1.5 text-app-muted-foreground hover:text-app-foreground rounded-lg hover:bg-app-surface-2">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {previewMode ? (
                        <div>
                            <p className="text-xs text-app-muted-foreground mb-4 uppercase tracking-wider font-bold">Live Preview</p>
                            {fields.length > 0
                                ? <DynamicFormRenderer
                                    form={{ ...( existing ?? { id: 0, key, name, description, is_active: isActive, field_count: fields.length, created_at: '', updated_at: '' }), schema: { fields } }}
                                    hideSubmit
                                />
                                : <div className="text-center text-app-muted-foreground text-sm p-8 border-2 border-dashed border-app-border rounded-xl">Add fields to see a preview.</div>
                            }
                        </div>
                    ) : (
                        <>
                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Form Name *</label>
                                    <input value={name} onChange={e => handleNameChange(e.target.value)}
                                        placeholder="e.g. Supplier Custom Fields"
                                        className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-border" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Key * <span className="normal-case font-normal text-app-muted-foreground">(slug, unique per org)</span></label>
                                    <input value={key}
                                        onChange={e => { setKey(e.target.value); setKeyEdited(true) }}
                                        disabled={!!existing}
                                        placeholder="supplier_custom_fields"
                                        className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-border font-mono disabled:bg-app-surface disabled:text-app-muted-foreground" />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Description</label>
                                    <input value={description} onChange={e => setDescription(e.target.value)}
                                        placeholder="What this form is used for"
                                        className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-border" />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 accent-stone-900" />
                                <span className="text-sm font-semibold text-app-foreground">Active</span>
                                <span className="text-xs text-app-muted-foreground">(inactive forms can't accept new responses)</span>
                            </label>

                            {/* Fields */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-app-foreground">
                                        Fields <span className="text-app-muted-foreground font-normal">({fields.length})</span>
                                    </h3>
                                    <button onClick={addField}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-app-bg text-white rounded-lg text-xs font-bold hover:bg-app-surface">
                                        <Plus className="h-3 w-3" /> Add Field
                                    </button>
                                </div>

                                {fields.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed border-app-border rounded-xl text-app-muted-foreground text-sm">
                                        No fields yet. Click "Add Field" to start.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {fields.map((f, i) => (
                                            <FieldEditor
                                                key={i}
                                                field={f}
                                                index={i}
                                                onChange={updated => updateField(i, updated)}
                                                onRemove={() => removeField(i)}
                                                onMoveUp={() => moveField(i, -1)}
                                                onMoveDown={() => moveField(i, 1)}
                                                isFirst={i === 0}
                                                isLast={i === fields.length - 1}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-app-border flex justify-between items-center">
                    <span className="text-xs text-app-muted-foreground">
                        {fields.length} field{fields.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 border border-app-border rounded-xl text-sm font-bold text-app-foreground hover:bg-app-surface">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 bg-app-bg text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface disabled:opacity-40">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {existing ? 'Save Changes' : 'Create Form'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FormDefinitionsPage() {
    const [forms, setForms] = useState<FormDefinition[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<FormDefinition | null | 'new'>(null)
    const [deleting, setDeleting] = useState<number | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setForms(await getFormDefinitions())
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const handleSaved = (saved: FormDefinition) => {
        setForms(prev => {
            const idx = prev.findIndex(f => f.id === saved.id)
            return idx >= 0 ? prev.map((f, i) => i === idx ? saved : f) : [saved, ...prev]
        })
        setEditing(null)
    }

    const handleToggleActive = async (form: FormDefinition) => {
        try {
            const updated = await updateFormDefinition(form.id, { is_active: !form.is_active })
            setForms(prev => prev.map(f => f.id === updated.id ? updated : f))
        } catch {
            toast.error('Failed to update form.')
        }
    }

    const handleDelete = async (id: number) => {
        setDeleting(id)
        try {
            await deleteFormDefinition(id)
            setForms(prev => prev.filter(f => f.id !== id))
            toast.success('Form deleted.')
        } catch {
            toast.error('Failed to delete form.')
        } finally {
            setDeleting(null)
        }
    }

    const handleDuplicate = async (form: FormDefinition) => {
        const newKey = `${form.key}_copy_${Date.now().toString(36)}`
        try {
            const saved = await createFormDefinition({
                key: newKey,
                name: `${form.name} (copy)`,
                description: form.description,
                schema: form.schema,
                is_active: false,
            })
            setForms(prev => [saved, ...prev])
            toast.success('Form duplicated. It is inactive by default.')
        } catch {
            toast.error('Failed to duplicate form.')
        }
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground mb-1">Form Definitions</h1>
                    <p className="text-sm text-app-muted-foreground">
                        Define custom JSON-schema forms for tax rules, expense categories, supplier profiles, and more.
                    </p>
                </div>
                <button
                    onClick={() => setEditing('new')}
                    className="flex items-center gap-2 bg-app-bg text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface transition-all"
                >
                    <Plus className="h-4 w-4" /> New Form
                </button>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-app-muted-foreground" />
                </div>
            ) : forms.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-app-border rounded-2xl">
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="font-bold text-app-foreground mb-1">No form definitions yet</h3>
                    <p className="text-app-muted-foreground text-sm mb-4">Create your first schema-driven form to add custom fields to any entity.</p>
                    <button onClick={() => setEditing('new')}
                        className="inline-flex items-center gap-2 bg-app-bg text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-app-surface">
                        <Plus className="h-4 w-4" /> Create First Form
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {forms.map(form => (
                        <div key={form.id}
                            className="bg-app-surface border border-app-border rounded-xl px-5 py-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                            {/* Status dot */}
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${form.is_active ? 'bg-app-success' : 'bg-stone-300'}`} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-app-foreground text-sm">{form.name}</h3>
                                    <span className="font-mono text-[10px] text-app-muted-foreground bg-app-surface-2 px-1.5 py-0.5 rounded">{form.key}</span>
                                    {!form.is_active && (
                                        <span className="text-[10px] font-bold text-app-muted-foreground bg-app-surface-2 border border-app-border px-1.5 py-0.5 rounded uppercase tracking-wider">Inactive</span>
                                    )}
                                </div>
                                {form.description && (
                                    <p className="text-xs text-app-muted-foreground mt-0.5 truncate">{form.description}</p>
                                )}
                                <p className="text-xs text-app-muted-foreground mt-1">
                                    {form.field_count} field{form.field_count !== 1 ? 's' : ''}
                                    {' · '}Updated {new Date(form.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => handleToggleActive(form)}
                                    title={form.is_active ? 'Deactivate' : 'Activate'}
                                    className="p-2 text-app-muted-foreground hover:text-app-foreground rounded-lg hover:bg-app-surface-2 transition-colors"
                                >
                                    {form.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => handleDuplicate(form)}
                                    title="Duplicate"
                                    className="p-2 text-app-muted-foreground hover:text-app-foreground rounded-lg hover:bg-app-surface-2 transition-colors"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setEditing(form)}
                                    className="p-2 text-app-muted-foreground hover:text-app-foreground rounded-lg hover:bg-app-surface-2 transition-colors"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(form.id)}
                                    disabled={deleting === form.id}
                                    className="p-2 text-app-faint hover:text-app-error rounded-lg hover:bg-app-error-bg transition-colors disabled:opacity-40"
                                >
                                    {deleting === form.id
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Trash2 className="h-4 w-4" />
                                    }
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Usage guide */}
            {forms.length > 0 && (
                <div className="mt-8 p-4 bg-app-surface border border-app-border rounded-xl text-xs text-app-muted-foreground space-y-1">
                    <div className="font-bold text-app-foreground mb-2">Using forms in your code</div>
                    <div>Render: <code className="font-mono bg-app-surface-2 px-1 rounded">{'<DynamicFormRenderer form={formDef} onSubmit={saveFormResponse} />'}</code></div>
                    <div>Save response: <code className="font-mono bg-app-surface-2 px-1 rounded">{'saveFormResponse({ form_key, entity_type, entity_id, data })'}</code></div>
                    <div>Load response: <code className="font-mono bg-app-surface-2 px-1 rounded">{'getFormResponses({ formKey, entityType, entityId })'}</code></div>
                </div>
            )}

            {/* Modal */}
            {editing !== null && (
                <FormEditorModal
                    existing={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    )
}
