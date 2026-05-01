/**
 * VERIFICATION WORKSPACE CONTEXT
 * ================================
 * Manages interactive field-to-document linking for dual verification mode
 *
 * Features:
 * - Field highlighting and linking
 * - Confidence scoring
 * - Mismatch detection
 * - Interactive document zones
 * - Synchronized scrolling
 */

'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type ValidationStatus = 'validated' | 'warning' | 'mismatch' | 'pending'

export interface FieldLink {
  fieldKey: string
  fieldLabel: string
  systemValue: unknown
  documentValue: unknown
  confidence: ConfidenceLevel
  status: ValidationStatus
  documentZone?: {
    x: number
    y: number
    width: number
    height: number
    page?: number
  }
}

export interface MismatchSuggestion {
  fieldKey: string
  systemValue: unknown
  documentValue: unknown
  suggestedAction: 'accept_system' | 'accept_document' | 'manual_review'
  reason: string
}

interface VerificationContextValue {
  // Active field tracking
  activeFieldKey: string | null
  setActiveFieldKey: (key: string | null) => void

  // Field links
  fieldLinks: Map<string, FieldLink>
  registerFieldLink: (link: FieldLink) => void
  updateFieldLink: (fieldKey: string, updates: Partial<FieldLink>) => void

  // Mismatch detection
  mismatches: MismatchSuggestion[]
  addMismatch: (mismatch: MismatchSuggestion) => void
  resolveMismatch: (fieldKey: string, action: 'accept_system' | 'accept_document') => void

  // Document interaction
  highlightedZone: FieldLink['documentZone'] | null
  setHighlightedZone: (zone: FieldLink['documentZone'] | null) => void

  // Editing state
  editedFields: Map<string, any>
  setFieldValue: (fieldKey: string, value: unknown) => void
  clearEditedFields: () => void

  // Validation
  getFieldStatus: (fieldKey: string) => ValidationStatus
  getFieldConfidence: (fieldKey: string) => ConfidenceLevel

  // Audit trail
  auditTrail: AuditEntry[]
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void
}

export interface AuditEntry {
  id: string
  timestamp: string
  action: 'field_edited' | 'field_validated' | 'mismatch_detected' | 'mismatch_resolved' | 'document_linked'
  fieldKey?: string
  oldValue?: unknown
  newValue?: unknown
  user: string
  note?: string
}

// ─── Context ────────────────────────────────────────────────────────

const VerificationContext = createContext<VerificationContextValue | null>(null)

export function useVerification() {
  const context = useContext(VerificationContext)
  if (!context) {
    throw new Error('useVerification must be used within VerificationProvider')
  }
  return context
}

// ─── Provider ───────────────────────────────────────────────────────

interface VerificationProviderProps {
  children: React.ReactNode
  invoiceId?: string | number
}

export function VerificationProvider({ children, invoiceId }: VerificationProviderProps) {
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null)
  const [fieldLinks, setFieldLinks] = useState<Map<string, FieldLink>>(new Map())
  const [mismatches, setMismatches] = useState<MismatchSuggestion[]>([])
  const [highlightedZone, setHighlightedZone] = useState<FieldLink['documentZone'] | null>(null)
  const [editedFields, setEditedFieldsState] = useState<Map<string, unknown>>(new Map())
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([])

  // ─── Field Link Management ─────────────────────────────────────

  const registerFieldLink = useCallback((link: FieldLink) => {
    setFieldLinks(prev => {
      const next = new Map(prev)
      next.set(link.fieldKey, link)
      return next
    })

    // Auto-detect mismatches
    if (link.status === 'mismatch' && link.systemValue !== link.documentValue) {
      const suggestion: MismatchSuggestion = {
        fieldKey: link.fieldKey,
        systemValue: link.systemValue,
        documentValue: link.documentValue,
        suggestedAction: 'manual_review',
        reason: `System shows ${link.systemValue}, document shows ${link.documentValue}`
      }
      addMismatch(suggestion)
    }
  }, [])

  const updateFieldLink = useCallback((fieldKey: string, updates: Partial<FieldLink>) => {
    setFieldLinks(prev => {
      const next = new Map(prev)
      const existing = next.get(fieldKey)
      if (existing) {
        next.set(fieldKey, { ...existing, ...updates })
      }
      return next
    })
  }, [])

  // ─── Mismatch Management ───────────────────────────────────────

  const addMismatch = useCallback((mismatch: MismatchSuggestion) => {
    setMismatches(prev => {
      // Avoid duplicates
      const exists = prev.some(m => m.fieldKey === mismatch.fieldKey)
      if (exists) return prev
      return [...prev, mismatch]
    })

    // Add audit entry
    addAuditEntry({
      action: 'mismatch_detected',
      fieldKey: mismatch.fieldKey,
      oldValue: mismatch.systemValue,
      newValue: mismatch.documentValue,
      user: 'System',
      note: mismatch.reason
    })
  }, [])

  const resolveMismatch = useCallback((fieldKey: string, action: 'accept_system' | 'accept_document') => {
    const mismatch = mismatches.find(m => m.fieldKey === fieldKey)
    if (!mismatch) return

    const newValue = action === 'accept_system' ? mismatch.systemValue : mismatch.documentValue

    // Update edited fields
    setFieldValue(fieldKey, newValue)

    // Update field link status
    updateFieldLink(fieldKey, { status: 'validated', confidence: 'high' })

    // Remove from mismatches
    setMismatches(prev => prev.filter(m => m.fieldKey !== fieldKey))

    // Add audit entry
    addAuditEntry({
      action: 'mismatch_resolved',
      fieldKey,
      oldValue: mismatch.systemValue,
      newValue,
      user: 'Current User',
      note: `Resolved by accepting ${action === 'accept_system' ? 'system' : 'document'} value`
    })
  }, [mismatches])

  // ─── Field Editing ─────────────────────────────────────────────

  const setFieldValue = useCallback((fieldKey: string, value: unknown) => {
    setEditedFieldsState(prev => {
      const next = new Map(prev)
      const oldValue = next.get(fieldKey)
      next.set(fieldKey, value)

      // Add audit entry if value changed
      if (oldValue !== value) {
        addAuditEntry({
          action: 'field_edited',
          fieldKey,
          oldValue,
          newValue: value,
          user: 'Current User'
        })
      }

      return next
    })
  }, [])

  const clearEditedFields = useCallback(() => {
    setEditedFieldsState(new Map())
  }, [])

  // ─── Status Helpers ────────────────────────────────────────────

  const getFieldStatus = useCallback((fieldKey: string): ValidationStatus => {
    const link = fieldLinks.get(fieldKey)
    if (!link) return 'pending'
    return link.status
  }, [fieldLinks])

  const getFieldConfidence = useCallback((fieldKey: string): ConfidenceLevel => {
    const link = fieldLinks.get(fieldKey)
    if (!link) return 'low'
    return link.confidence
  }, [fieldLinks])

  // ─── Audit Trail ───────────────────────────────────────────────

  const addAuditEntry = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    }
    setAuditTrail(prev => [newEntry, ...prev])
  }, [])

  // ─── Context Value ─────────────────────────────────────────────

  const value: VerificationContextValue = {
    activeFieldKey,
    setActiveFieldKey,
    fieldLinks,
    registerFieldLink,
    updateFieldLink,
    mismatches,
    addMismatch,
    resolveMismatch,
    highlightedZone,
    setHighlightedZone,
    editedFields,
    setFieldValue,
    clearEditedFields,
    getFieldStatus,
    getFieldConfidence,
    auditTrail,
    addAuditEntry
  }

  return (
    <VerificationContext.Provider value={value}>
      {children}
    </VerificationContext.Provider>
  )
}
