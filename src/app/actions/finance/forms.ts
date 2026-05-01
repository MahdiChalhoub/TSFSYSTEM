'use server'

import { erpFetch, handleAuthError } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldType =
    | 'text' | 'textarea' | 'number' | 'decimal'
    | 'date' | 'select' | 'checkbox' | 'email' | 'url'

export type FormField = {
    key: string
    label: string
    type: FieldType
    required?: boolean
    placeholder?: string
    help?: string
    options?: string[]     // for type=select
    min?: number           // for type=number/decimal
    max?: number
    default?: string | number | boolean
}

export type FormSchema = {
    fields: FormField[]
}

export type FormDefinition = {
    id: number
    key: string
    name: string
    description: string
    schema: FormSchema
    is_active: boolean
    field_count: number
    created_at: string
    updated_at: string
}

export type FormResponse = {
    id: number
    form_definition: number
    form_key: string
    form_name: string
    entity_type: string
    entity_id: number | null
    data: Record<string, unknown>
    created_by: number | null
    created_at: string
    updated_at: string
}

export type ValidationResult = {
    valid: boolean
    errors: Record<string, string>
}

// ── Form Definitions ──────────────────────────────────────────────────────────

export async function getFormDefinitions(activeOnly = false): Promise<FormDefinition[]> {
    try {
        const path = activeOnly ? 'form-definitions/?active_only=true' : 'form-definitions/'
        const data = await erpFetch(path)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to fetch form definitions:', e)
        return []
    }
}

export async function getFormDefinition(key: string): Promise<FormDefinition | null> {
    try {
        // Try fetching by key via filter
        const data = await erpFetch(`form-definitions/?key=${encodeURIComponent(key)}`)
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        return list.find((f: FormDefinition) => f.key === key) ?? null
    } catch (e) {
        handleAuthError(e)
        console.error(`Failed to fetch form definition "${key}":`, e)
        return null
    }
}

export async function createFormDefinition(payload: {
    key: string
    name: string
    description?: string
    schema: FormSchema
    is_active?: boolean
}): Promise<FormDefinition> {
    const result = await erpFetch('form-definitions/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    revalidatePath('/finance/settings/form-definitions')
    return result
}

export async function updateFormDefinition(
    id: number,
    payload: Partial<{
        name: string
        description: string
        schema: FormSchema
        is_active: boolean
    }>
): Promise<FormDefinition> {
    const result = await erpFetch(`form-definitions/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
    revalidatePath('/finance/settings/form-definitions')
    return result
}

export async function deleteFormDefinition(id: number): Promise<void> {
    await erpFetch(`form-definitions/${id}/`, { method: 'DELETE' })
    revalidatePath('/finance/settings/form-definitions')
}

export async function validateFormData(
    formId: number,
    data: Record<string, unknown>
): Promise<ValidationResult> {
    try {
        return await erpFetch(`form-definitions/${formId}/validate/`, {
            method: 'POST',
            body: JSON.stringify({ data }),
        })
    } catch (e) {
        console.error('Validation request failed:', e)
        return { valid: false, errors: { _request: 'Validation request failed.' } }
    }
}

// ── Form Responses ────────────────────────────────────────────────────────────

export async function getFormResponses(opts: {
    formKey?: string
    formId?: number
    entityType?: string
    entityId?: number
}): Promise<FormResponse[]> {
    try {
        const params = new URLSearchParams()
        if (opts.formKey)    params.set('form_key',    opts.formKey)
        if (opts.formId)     params.set('form_id',     String(opts.formId))
        if (opts.entityType) params.set('entity_type', opts.entityType)
        if (opts.entityId)   params.set('entity_id',   String(opts.entityId))
        const data = await erpFetch(`form-responses/?${params.toString()}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (e) {
        handleAuthError(e)
        console.error('Failed to fetch form responses:', e)
        return []
    }
}

export async function saveFormResponse(payload: {
    form_key: string
    entity_type?: string
    entity_id?: number
    data: Record<string, unknown>
}): Promise<FormResponse> {
    const result = await erpFetch('form-responses/upsert/', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    return result
}

export async function deleteFormResponse(id: number): Promise<void> {
    await erpFetch(`form-responses/${id}/`, { method: 'DELETE' })
}
