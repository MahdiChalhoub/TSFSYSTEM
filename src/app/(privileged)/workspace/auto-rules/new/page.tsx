'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { ArrowLeft, Zap, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function CreateAutoRulesPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData.entries())

      await erpFetch('workspace/auto-rules/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      setSuccess(true)
      setTimeout(() => router.push('/workspace/auto-rules'), 500)
    } catch (err: any) {
      setError(err.message || 'Failed to create item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0 mb-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all flex-shrink-0"
        >
          <ArrowLeft size={13} />
          <span className="hidden md:inline">Back</span>
        </button>
        <div className="page-header-icon bg-app-primary"
             style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1>Create Auto Rule</h1>
          <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
            Add new auto-rule record
          </p>
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 p-5 rounded-2xl overflow-y-auto custom-scrollbar"
        style={{
          background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
          border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
        }}
      >
        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-xl flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
              color: 'var(--app-error, #ef4444)',
              border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
            }}
          >
            <AlertCircle size={14} />
            <span className="text-[12px] font-bold">{error}</span>
          </div>
        )}

        {success && (
          <div
            className="mb-4 px-3 py-2 rounded-xl flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
              color: 'var(--app-success, #22c55e)',
              border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)',
            }}
          >
            <CheckCircle2 size={14} />
            <span className="text-[12px] font-bold">Created. Redirecting…</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="p-5 rounded-2xl text-center"
            style={{
              background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
              border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)',
            }}
          >
            <p className="text-[12px] font-bold text-app-muted-foreground">
              This schema currently exposes no editable fields.
            </p>
            <p className="text-[11px] font-medium text-app-muted-foreground mt-1">
              Use{' '}
              <button
                type="button"
                onClick={() => router.push('/workspace/auto-task-rules')}
                className="font-bold underline"
                style={{ color: 'var(--app-primary)' }}
              >
                Auto-Task Rules
              </button>{' '}
              to create full rules with triggers, conditions, and assignments.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
              style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
