'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormDefinition, FormField, ValidationResult } from '@/app/actions/finance/forms'

// ── Field components ──────────────────────────────────────────────────────────

function FieldWrapper({
    field,
    error,
    children,
}: {
    field: FormField
    error?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1">
            <label className="block text-sm font-semibold text-app-muted-foreground">
                {field.label}
                {field.required && <span className="text-app-error ml-1">*</span>}
            </label>
            {children}
            {field.help && !error && (
                <p className="text-xs text-app-muted-foreground">{field.help}</p>
            )}
            {error && (
                <p className="text-xs text-app-error font-medium">{error}</p>
            )}
        </div>
    )
}

const BASE_INPUT =
    'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors'
const INPUT_NORMAL = `${BASE_INPUT} border-app-border focus:ring-app-border focus:border-app-border`
const INPUT_ERROR  = `${BASE_INPUT} border-app-error focus:ring-app-error focus:border-app-error bg-app-error-soft`

function renderField(
    field: FormField,
    value: unknown,
    onChange: (val: unknown) => void,
    error?: string,
    disabled?: boolean,
) {
    const inputClass = error ? INPUT_ERROR : INPUT_NORMAL
    const common = { disabled, id: `field-${field.key}` }

    switch (field.type) {
        case 'textarea':
            return (
                <textarea
                    {...common}
                    rows={3}
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className={`${inputClass} resize-y`}
                />
            )

        case 'number':
        case 'decimal':
            return (
                <input
                    {...common}
                    type="number"
                    step={field.type === 'decimal' ? '0.01' : '1'}
                    min={field.min}
                    max={field.max}
                    value={value === null || value === undefined ? '' : String(value)}
                    onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder={field.placeholder ?? '0'}
                    className={inputClass}
                />
            )

        case 'date':
            return (
                <input
                    {...common}
                    type="date"
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    className={inputClass}
                />
            )

        case 'select':
            return (
                <select
                    {...common}
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    className={inputClass}
                >
                    <option value="">— Select —</option>
                    {(field.options ?? []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            )

        case 'checkbox':
            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        {...common}
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={e => onChange(e.target.checked)}
                        className="w-4 h-4 rounded accent-stone-900"
                    />
                    <span className="text-sm text-app-muted-foreground">{field.placeholder ?? field.label}</span>
                </label>
            )

        case 'email':
            return (
                <input
                    {...common}
                    type="email"
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder ?? 'name@example.com'}
                    className={inputClass}
                />
            )

        case 'url':
            return (
                <input
                    {...common}
                    type="url"
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder ?? 'https://'}
                    className={inputClass}
                />
            )

        default: // text
            return (
                <input
                    {...common}
                    type="text"
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className={inputClass}
                />
            )
    }
}

// ── Main component ────────────────────────────────────────────────────────────

export interface DynamicFormRendererProps {
    /** The form definition to render */
    form: FormDefinition

    /** Initial field values (optional) */
    initialData?: Record<string, unknown>

    /** Called with the current data object whenever a field changes */
    onChange?: (data: Record<string, unknown>) => void

    /**
     * Called on submit with the final data object.
     * Return a ValidationResult to show server-side errors inline,
     * or throw to show a generic error.
     */
    onSubmit?: (data: Record<string, unknown>) => Promise<ValidationResult | void>

    /** Override submit button label */
    submitLabel?: string

    /** Disable all fields */
    disabled?: boolean

    /** Hide the submit button (controlled externally) */
    hideSubmit?: boolean

    /** Extra CSS classes for the form wrapper */
    className?: string

    /** Layout: 'single' (one column) | 'double' (two columns, default) */
    layout?: 'single' | 'double'
}

export function DynamicFormRenderer({
    form,
    initialData = {},
    onChange,
    onSubmit,
    submitLabel = 'Save',
    disabled = false,
    hideSubmit = false,
    className = '',
    layout = 'double',
}: DynamicFormRendererProps) {
    const fields = form.schema?.fields ?? []

    // ── State ──────────────────────────────────────────────────────
    const [data, setData] = useState<Record<string, unknown>>(() => {
        const defaults: Record<string, unknown> = {}
        for (const f of fields) {
            defaults[f.key] = initialData[f.key] ?? f.default ?? (f.type === 'checkbox' ? false : '')
        }
        return defaults
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submitting, setSubmitting] = useState(false)
    const [globalError, setGlobalError] = useState<string | null>(null)

    // Sync initialData changes (e.g. when loading existing response)
    useEffect(() => {
        if (Object.keys(initialData).length === 0) return
        setData(prev => {
            const next = { ...prev }
            for (const f of fields) {
                if (initialData[f.key] !== undefined) next[f.key] = initialData[f.key]
            }
            return next
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(initialData)])

    const handleChange = useCallback((key: string, val: unknown) => {
        setData(prev => {
            const next = { ...prev, [key]: val }
            onChange?.(next)
            return next
        })
        // Clear field error on change
        if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e })
    }, [errors, onChange])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!onSubmit) return
        setSubmitting(true)
        setGlobalError(null)
        setErrors({})
        try {
            const result = await onSubmit(data)
            if (result && !result.valid) {
                setErrors(result.errors)
            }
        } catch (err: unknown) {
            setGlobalError(err instanceof Error ? err.message : 'An error occurred.')
        } finally {
            setSubmitting(false)
        }
    }

    if (fields.length === 0) {
        return (
            <div className="p-6 text-center text-app-muted-foreground text-sm border border-dashed border-app-border rounded-xl">
                This form has no fields defined.
            </div>
        )
    }

    const gridClass = layout === 'double'
        ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
        : 'space-y-4'

    // Checkboxes and textareas span full width regardless of layout
    const fullWidthTypes: FormField['type'][] = ['textarea', 'checkbox']

    return (
        <form onSubmit={handleSubmit} className={className} noValidate>
            {globalError && (
                <div className="mb-4 p-3 bg-app-error-soft border border-app-error rounded-lg text-app-error text-sm">
                    {globalError}
                </div>
            )}

            <div className={gridClass}>
                {fields.map(field => {
                    const spanFull = fullWidthTypes.includes(field.type) ||
                        (layout === 'double' && fields.length % 2 !== 0 && field === fields[fields.length - 1])
                    return (
                        <div
                            key={field.key}
                            className={spanFull && layout === 'double' ? 'md:col-span-2' : ''}
                        >
                            <FieldWrapper field={field} error={errors[field.key]}>
                                {renderField(
                                    field,
                                    data[field.key],
                                    val => handleChange(field.key, val),
                                    errors[field.key],
                                    disabled,
                                )}
                            </FieldWrapper>
                        </div>
                    )
                })}
            </div>

            {!hideSubmit && onSubmit && (
                <div className="mt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={disabled || submitting}
                        className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {submitting && (
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                        )}
                        {submitLabel}
                    </button>
                </div>
            )}
        </form>
    )
}

// ── Read-only display ─────────────────────────────────────────────────────────

export function DynamicFormDisplay({
    form,
    data,
    className = '',
}: {
    form: FormDefinition
    data: Record<string, unknown>
    className?: string
}) {
    const fields = form.schema?.fields ?? []
    if (fields.length === 0) return null

    return (
        <dl className={`grid grid-cols-2 gap-x-6 gap-y-3 ${className}`}>
            {fields.map(field => {
                const val = data[field.key]
                let display: string
                if (val === null || val === undefined || val === '') {
                    display = '—'
                } else if (field.type === 'checkbox') {
                    display = val ? 'Yes' : 'No'
                } else {
                    display = String(val)
                }
                return (
                    <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                        <dt className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">{field.label}</dt>
                        <dd className={`text-sm text-app-foreground mt-0.5 ${field.type === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>{display}</dd>
                    </div>
                )
            })}
        </dl>
    )
}
