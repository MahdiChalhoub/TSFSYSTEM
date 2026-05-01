'use client'

/**
 * VERIFICATION ENGINE PANEL (Enhanced)
 * Discrepancies, Notes, Approval Actions, Audit Trail
 *
 * Features:
 * - Real-time mismatch detection summary
 * - Audit trail timeline with all changes
 * - Quick verification actions
 * - Internal notes system
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, MessageSquare, CheckCircle2, XCircle, Clock, Send, History, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useVerification } from '@/lib/workspace/VerificationContext'

export function ActionsPanel({
  invoice = null,
  onAddNote,
  onApprove,
  onReject
}: {
  invoice?: Record<string, any> | null;
  onAddNote?: (id: number, text: string) => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
}) {
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState<Record<string, any>[]>([])

  // Verification context for audit trail and mismatches
  const {
    mismatches,
    auditTrail,
    fieldLinks,
    addAuditEntry
  } = useVerification()

  if (!invoice) {
    return (
      <Card className="h-full flex items-center justify-center border-app-border/30">
        <div className="text-center p-8">
          <MessageSquare size={48} className="mx-auto mb-4 text-app-text-muted opacity-30" />
          <p className="text-sm font-bold text-app-text-muted">No invoice selected</p>
          <p className="text-xs text-app-text-faint mt-1">Select to see actions</p>
        </div>
      </Card>
    )
  }

  const handleAddNote = () => {
    if (!note.trim()) return

    const newNote = {
      id: Date.now(),
      text: note,
      timestamp: new Date().toISOString(),
      author: 'Current User'
    }

    setNotes(prev => [newNote, ...prev])
    onAddNote?.(invoice.id, note)
    setNote('')
    toast.success('Note added')
  }

  const hasDiscrepancy = invoice.status === 'DISCREPANCY' || mismatches.length > 0

  // Calculate verification score
  const totalFields = fieldLinks.size
  const validatedFields = Array.from(fieldLinks.values()).filter(f => f.status === 'validated').length
  const verificationScore = totalFields > 0 ? Math.round((validatedFields / totalFields) * 100) : 0

  return (
    <Card className="h-full flex flex-col border-app-border/30">
      <CardHeader className="pb-3 border-b border-app-border/30">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <TrendingUp size={14} className="text-app-primary" />
          Verification Engine
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Verification Score */}
        <Card className={`${verificationScore === 100 ? 'bg-app-success-bg border-app-success' : 'bg-app-info-bg border-app-info'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-app-text-muted uppercase tracking-wider">Verification Score</p>
              <Badge className={verificationScore === 100 ? 'bg-app-primary text-white' : 'bg-app-info text-white'}>
                {verificationScore}%
              </Badge>
            </div>
            <div className="w-full bg-app-surface-2 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${verificationScore === 100 ? 'bg-app-primary' : 'bg-app-info'}`}
                style={{ width: `${verificationScore}%` }}
              />
            </div>
            <p className="text-[10px] text-app-text-muted mt-2">
              {validatedFields} of {totalFields} fields verified
            </p>
          </CardContent>
        </Card>

        {/* Status Section */}
        <div className="space-y-2">
          <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">Current Status</p>
          <Badge className={
            invoice.status === 'VERIFIED' ? 'bg-app-success-bg text-app-success border-app-success' :
            invoice.status === 'DISCREPANCY' ? 'bg-app-warning-bg text-app-warning border-app-warning' :
            invoice.status === 'REJECTED' ? 'bg-app-error-bg text-app-error border-app-error' :
            'bg-app-info-bg text-app-info border-app-info'
          }>
            {invoice.status}
          </Badge>
        </div>

        {/* Mismatch Summary */}
        {mismatches.length > 0 && (
          <Card className="bg-app-warning-bg border-app-warning">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 text-app-warning">
                <AlertTriangle size={12} />
                {mismatches.length} Active Mismatches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mismatches.slice(0, 3).map((m, i) => (
                <div key={i} className="text-xs text-app-warning border-b border-app-warning pb-2 last:border-0 last:pb-0">
                  <div className="font-bold">{m.fieldKey}</div>
                  <div className="text-[10px]">{m.reason}</div>
                </div>
              ))}
              {mismatches.length > 3 && (
                <p className="text-[10px] text-app-warning font-bold">
                  +{mismatches.length - 3} more
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">Quick Actions</p>
          <div className="space-y-2">
            <Button
              onClick={() => onApprove?.(invoice.id)}
              disabled={hasDiscrepancy}
              className="w-full h-10 bg-app-primary hover:bg-app-primary-dark text-white gap-2 text-sm"
            >
              <CheckCircle2 size={14} />
              Approve for Payment
            </Button>
            <Button
              onClick={() => onReject?.(invoice.id)}
              variant="outline"
              className="w-full h-10 border-app-error text-app-error hover:bg-app-error-bg gap-2 text-sm"
            >
              <XCircle size={14} />
              Reject Invoice
            </Button>
            <Button
              variant="outline"
              className="w-full h-10 gap-2 text-sm"
            >
              <Clock size={14} />
              Request Clarification
            </Button>
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-2">
          <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">Internal Notes</p>
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this invoice..."
              className="text-sm min-h-[80px]"
            />
            <Button
              onClick={handleAddNote}
              disabled={!note.trim()}
              size="sm"
              className="w-full h-9 gap-2"
            >
              <Send size={12} />
              Add Note
            </Button>
          </div>
        </div>

        {/* Notes List */}
        {notes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">History</p>
            <div className="space-y-2">
              {notes.map(n => (
                <Card key={n.id} className="bg-app-surface/50 border-app-border/30">
                  <CardContent className="p-3">
                    <p className="text-xs text-app-text mb-1">{n.text}</p>
                    <div className="flex justify-between text-[10px] text-app-text-faint">
                      <span>{n.author}</span>
                      <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents */}
        <div className="space-y-2">
          <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">Related</p>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs h-9">
              📄 PO #{invoice.po_number}
            </Button>
            {invoice.receipt_number && (
              <Button variant="outline" size="sm" className="w-full justify-start text-xs h-9">
                📦 GRN #{invoice.receipt_number}
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full justify-start text-xs h-9">
              👤 Supplier: {invoice.supplier_name}
            </Button>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">Audit Trail</p>
            <Badge variant="outline" className="text-[9px] h-4">
              <History size={8} className="mr-1" />
              {auditTrail.length} events
            </Badge>
          </div>
          {auditTrail.length > 0 ? (
            <div className="audit-timeline space-y-2">
              {auditTrail.slice(0, 5).map((entry) => (
                <div key={entry.id} className="audit-entry flex items-start gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    entry.action === 'field_validated' ? 'bg-app-primary' :
                    entry.action === 'mismatch_detected' ? 'bg-app-warning' :
                    entry.action === 'mismatch_resolved' ? 'bg-app-info' :
                    entry.action === 'field_edited' ? 'bg-purple-500' :
                    'bg-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-app-text truncate">
                      {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      {entry.fieldKey && ` - ${entry.fieldKey}`}
                    </p>
                    <p className="text-[10px] text-app-text-faint">
                      {new Date(entry.timestamp).toLocaleTimeString()} by {entry.user}
                    </p>
                    {entry.note && (
                      <p className="text-[10px] text-app-text-muted italic mt-0.5">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
              {auditTrail.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full h-7 text-[10px]">
                  View All {auditTrail.length} Events
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <History size={24} className="mx-auto mb-2 text-app-text-muted opacity-30" />
              <p className="text-[10px] text-app-text-faint">No audit events yet</p>
            </div>
          )}
        </div>

        {/* Document Timeline */}
        <div className="space-y-2">
          <p className="text-xs font-black text-app-text-faint uppercase tracking-wider">Document Timeline</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-app-info mt-1.5" />
              <div>
                <p className="font-bold text-app-text">Invoice Received</p>
                <p className="text-app-text-faint">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-app-primary mt-1.5" />
              <div>
                <p className="font-bold text-app-text">PO Created</p>
                <p className="text-app-text-faint">2 days ago</p>
              </div>
            </div>
            {invoice.receipt_number && (
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                <div>
                  <p className="font-bold text-app-text">Goods Received</p>
                  <p className="text-app-text-faint">{invoice.received_date ? new Date(invoice.received_date).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
