// @ts-nocheck
'use client'

/**
 * Comparison Panel - Shows system data vs physical document
 * ===========================================================
 * Features:
 * - Side-by-side field comparison
 * - Highlight discrepancies
 * - Inline editing
 * - Difference calculations
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CheckCircle2, AlertCircle, Edit3, Save, X,
  ArrowRight, Calculator, FileCheck
} from 'lucide-react'
import { useCurrency } from '@/lib/utils/currency'

interface ComparisonField {
  key: string
  label: string
  systemValue: any
  physicalValue?: any
  editable?: boolean
  type?: 'text' | 'number' | 'currency' | 'date'
}

interface ComparisonPanelProps {
  title?: string
  systemData: {
    label: string
    fields: ComparisonField[]
  }
  physicalData?: {
    label: string
    fields: ComparisonField[]
  }
  receiptData?: {
    label: string
    fields: ComparisonField[]
  }
  onSave?: (updatedFields: Record<string, any>) => void
  onVerify?: () => void
  onReject?: () => void
  className?: string
}

export function ComparisonPanel({
  title = 'Data Comparison',
  systemData,
  physicalData,
  receiptData,
  onSave,
  onVerify,
  onReject,
  className = ''
}: ComparisonPanelProps) {
  const { fmt } = useCurrency()
  const [editing, setEditing] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, any>>({})

  const handleEdit = (key: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    onSave?.(editedValues)
    setEditing(false)
    setEditedValues({})
  }

  const handleCancel = () => {
    setEditing(false)
    setEditedValues({})
  }

  const getValue = (field: ComparisonField, source: 'system' | 'physical' | 'receipt') => {
    if (source === 'system') {
      return editedValues[field.key] ?? field.systemValue
    }
    if (source === 'physical') {
      return field.physicalValue
    }
    return null
  }

  const formatValue = (value: any, type?: string) => {
    if (value === null || value === undefined) return '—'
    if (type === 'currency') return fmt(parseFloat(value))
    if (type === 'date') return new Date(value).toLocaleDateString()
    if (type === 'number') return value.toString()
    return value
  }

  const hasDiscrepancy = (field: ComparisonField) => {
    if (!field.physicalValue) return false
    const sys = getValue(field, 'system')
    const phys = field.physicalValue
    return sys != phys // Loose comparison for numbers
  }

  const totalDiscrepancies = systemData.fields.filter(hasDiscrepancy).length

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-3 border-b border-app-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileCheck size={14} className="text-app-primary" />
            {title}
          </CardTitle>
          {totalDiscrepancies > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {totalDiscrepancies} {totalDiscrepancies === 1 ? 'Discrepancy' : 'Discrepancies'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* 3-Column Layout or 2-Column */}
        <div className="space-y-1">
          {/* Header Row */}
          <div className={`grid ${receiptData ? 'grid-cols-3' : 'grid-cols-2'} gap-4 pb-2 border-b border-app-border/30`}>
            <div className="text-xs font-black text-app-muted-foreground uppercase tracking-wider">
              {systemData.label}
            </div>
            {receiptData && (
              <div className="text-xs font-black text-app-muted-foreground uppercase tracking-wider">
                {receiptData.label}
              </div>
            )}
            {physicalData && (
              <div className="text-xs font-black text-app-muted-foreground uppercase tracking-wider">
                {physicalData.label}
              </div>
            )}
          </div>

          {/* Data Rows */}
          {systemData.fields.map((field, idx) => {
            const discrepancy = hasDiscrepancy(field)
            const sysValue = getValue(field, 'system')
            const physValue = field.physicalValue

            return (
              <div
                key={field.key}
                className={`grid ${receiptData ? 'grid-cols-3' : 'grid-cols-2'} gap-4 py-3 border-b border-app-border/10 ${
                  discrepancy ? 'bg-amber-50/30 border-amber-200' : ''
                }`}
              >
                {/* System Value */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wide">
                    {field.label}
                  </p>
                  {editing && field.editable ? (
                    <Input
                      value={editedValues[field.key] ?? field.systemValue}
                      onChange={(e) => handleEdit(field.key, e.target.value)}
                      className="h-8 text-sm"
                      type={field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
                    />
                  ) : (
                    <p className="text-sm font-bold text-app-foreground">
                      {formatValue(sysValue, field.type)}
                    </p>
                  )}
                </div>

                {/* Receipt Value (if exists) */}
                {receiptData && receiptData.fields[idx] && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wide opacity-0">
                      {field.label}
                    </p>
                    <p className="text-sm font-semibold text-blue-600">
                      {formatValue(receiptData.fields[idx].systemValue, field.type)}
                    </p>
                  </div>
                )}

                {/* Physical Value */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wide opacity-0">
                    {field.label}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${discrepancy ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatValue(physValue, field.type)}
                    </p>
                    {discrepancy && <AlertCircle size={14} className="text-amber-500" />}
                    {!discrepancy && physValue && <CheckCircle2 size={14} className="text-emerald-500" />}
                  </div>
                  {discrepancy && field.type === 'currency' && (
                    <p className="text-xs text-amber-600 font-semibold">
                      Diff: {fmt(Math.abs(parseFloat(physValue) - parseFloat(sysValue)))}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-app-border/30">
          {!editing ? (
            <>
              <Button
                onClick={() => setEditing(true)}
                variant="outline"
                className="flex-1 h-11 gap-2"
              >
                <Edit3 size={16} />
                Edit to Match
              </Button>
              {onVerify && (
                <Button
                  onClick={onVerify}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  disabled={totalDiscrepancies > 0}
                >
                  <CheckCircle2 size={16} />
                  Verify & Approve
                </Button>
              )}
              {onReject && (
                <Button
                  onClick={onReject}
                  variant="outline"
                  className="h-11 px-4 border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <X size={16} />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 h-11 bg-app-primary text-white gap-2"
              >
                <Save size={16} />
                Save Changes
              </Button>
            </>
          )}
        </div>

        {/* Summary */}
        {totalDiscrepancies > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900 mb-1">
                  {totalDiscrepancies} {totalDiscrepancies === 1 ? 'Field' : 'Fields'} Don't Match
                </p>
                <p className="text-xs text-amber-700">
                  Review the highlighted fields. Edit system data to match physical document, or reject if incorrect.
                </p>
              </div>
            </div>
          </div>
        )}

        {totalDiscrepancies === 0 && physicalData && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900 mb-1">
                  All Fields Match ✓
                </p>
                <p className="text-xs text-emerald-700">
                  System data matches the physical document. Ready to verify and approve.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
