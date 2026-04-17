// @ts-nocheck
'use client'

/**
 * Opening Balance Form — V2 Dajingo Pro
 * ========================================
 * Premium opening balance entry form with:
 * - Page-header-icon with glow shadow
 * - Glassmorphism input table
 * - Live debit/credit preview with balance indicator
 * - Account type badges with color coding
 * - Auto-balance equity info card
 * - Keyboard navigation (Enter = next row)
 */

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Trash2, Save, AlertTriangle, BookOpen,
  ArrowLeft, Calendar, Hash, Scale, ChevronDown,
  Layers, CheckCircle2, Search, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'
import { createOpeningBalanceEntry } from '@/app/actions/finance/ledger'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
  accounts: Record<string, any>[]
}

type EntryRow = {
  id: number
  accountId: string
  balance: number | ''
}

/* ── Account Type Color Map ── */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ASSET: { bg: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', text: 'var(--app-primary)', border: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' },
  LIABILITY: { bg: 'color-mix(in srgb, var(--app-error) 8%, transparent)', text: 'var(--app-error)', border: 'color-mix(in srgb, var(--app-error) 20%, transparent)' },
  EQUITY: { bg: 'color-mix(in srgb, #8b5cf6 8%, transparent)', text: '#8b5cf6', border: 'color-mix(in srgb, #8b5cf6 20%, transparent)' },
  INCOME: { bg: 'color-mix(in srgb, var(--app-success) 8%, transparent)', text: 'var(--app-success)', border: 'color-mix(in srgb, var(--app-success) 20%, transparent)' },
  EXPENSE: { bg: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', text: 'var(--app-warning)', border: 'color-mix(in srgb, var(--app-warning) 20%, transparent)' },
}

export default function OpeningBalanceForm({ accounts }: Props) {
  const router = useRouter()
  const { fmt } = useCurrency()
  const [isPending, startTransition] = useTransition()
  const [accountSearch, setAccountSearch] = useState<Record<number, string>>({})
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null)
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const sortedAccounts = useMemo(() => {
    return accounts
      .filter(acc => !acc.children || acc.children.length === 0)
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [accounts])

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('Initial Opening Balance Import')
  const [rows, setRows] = useState<EntryRow[]>([
    { id: 1, accountId: '', balance: '' },
    { id: 2, accountId: '', balance: '' },
    { id: 3, accountId: '', balance: '' },
    { id: 4, accountId: '', balance: '' },
    { id: 5, accountId: '', balance: '' },
  ])

  const addRow = () => {
    const newRow = { id: Date.now(), accountId: '', balance: '' as '' }
    setRows([...rows, newRow])
  }

  const updateRow = (id: number, field: keyof EntryRow, val: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r))
  }

  const removeRow = (id: number) => setRows(rows.filter(r => r.id !== id))

  // Account search filtering
  const getFilteredAccounts = (rowId: number) => {
    const q = (accountSearch[rowId] || '').toLowerCase()
    if (!q) return sortedAccounts.slice(0, 50) // Show first 50 when empty
    return sortedAccounts.filter(a =>
      a.code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.type || '').toLowerCase().includes(q)
    ).slice(0, 30)
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (activeDropdown === null) return
    const handler = (e: MouseEvent) => {
      const el = document.getElementById(`dropdown-${activeDropdown}`)
      if (el && !el.contains(e.target as Node)) setActiveDropdown(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeDropdown])

  /* ── Preview Calculations ── */
  const preview = useMemo(() => {
    let totalDebit = 0
    let totalCredit = 0
    let filledRows = 0

    rows.forEach(r => {
      const acc = accounts.find(a => a.id.toString() === r.accountId)
      const amount = Number(r.balance) || 0
      if (!acc || amount === 0) return
      filledRows++

      const isNormalDebit = ['ASSET', 'EXPENSE'].includes(acc.type)
      if (isNormalDebit) {
        if (amount >= 0) totalDebit += amount
        else totalCredit += Math.abs(amount)
      } else {
        if (amount >= 0) totalCredit += amount
        else totalDebit += Math.abs(amount)
      }
    })

    return { totalDebit, totalCredit, diff: totalDebit - totalCredit, filledRows }
  }, [rows, accounts])

  const isBalanced = Math.abs(preview.diff) < 0.01

  /* ── Submit ── */
  const [showBalanceWarning, setShowBalanceWarning] = useState(false)

  const doSubmit = () => {
    const linesToPost: Record<string, any>[] = []
    rows.forEach(r => {
      const acc = accounts.find(a => a.id.toString() === r.accountId)
      const amount = Number(r.balance) || 0
      if (!acc || amount === 0) return

      const isNormalDebit = ['ASSET', 'EXPENSE'].includes(acc.type)
      let debit = 0, credit = 0
      if (isNormalDebit) {
        if (amount >= 0) debit = amount; else credit = Math.abs(amount)
      } else {
        if (amount >= 0) credit = amount; else debit = Math.abs(amount)
      }
      linesToPost.push({ accountId: parseInt(r.accountId), debit, credit })
    })

    if (linesToPost.length === 0) {
      toast.error('Please enter at least one balance.')
      return
    }

    startTransition(async () => {
      try {
        await createOpeningBalanceEntry({
          transactionDate: new Date(date),
          lines: linesToPost,
          description: description || 'Initial Opening Balance Import',
          autoBalance: true,
        })
        toast.success('Opening balances saved successfully.')
        router.push('/finance/opening-balances')
      } catch (e: unknown) {
        toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (Math.abs(preview.diff) > 0.01) { setShowBalanceWarning(true); return }
    doSubmit()
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* ═══════════ HEADER ═══════════ */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="page-header-icon bg-app-primary"
              style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Opening Balances</h1>
              <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                Set initial account balances for your fiscal year
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link href="/finance/opening-balances"
              className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
              <ArrowLeft size={13} /> Back to List
            </Link>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          {[
            { label: 'Lines Filled', value: preview.filledRows, icon: <Layers size={11} />, color: 'var(--app-info)' },
            { label: 'Total Debit', value: fmt(preview.totalDebit), icon: <Hash size={11} />, color: 'var(--app-primary)' },
            { label: 'Total Credit', value: fmt(preview.totalCredit), icon: <Hash size={11} />, color: 'var(--app-error, #ef4444)' },
            { label: 'Balance', value: isBalanced ? 'Balanced ✓' : fmt(Math.abs(preview.diff)), icon: <Scale size={11} />, color: isBalanced ? 'var(--app-success)' : 'var(--app-warning)' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
              style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ FORM BODY ═══════════ */}
      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-auto custom-scrollbar">

        {/* ── Date & Description Row ── */}
        <div className="flex-shrink-0 rounded-2xl border border-app-border/50 overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
          <div className="px-4 py-2 border-b border-app-border/30 flex items-center gap-2"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)' }}>
            <div className="w-1 h-3 rounded-full bg-app-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-app-primary">Entry Details</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                <Calendar size={10} className="inline mr-1" />Opening Date
              </label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-[12px] font-bold bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary/50 focus:ring-2 focus:ring-app-primary/10 transition-all" />
            </div>
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Opening Balance Import..."
                className="w-full px-3 py-2 text-[12px] font-bold bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary/50 focus:ring-2 focus:ring-app-primary/10 transition-all" />
            </div>
          </div>
        </div>

        {/* ── Account Lines Table ── */}
        <div className="flex-1 min-h-0 rounded-2xl border border-app-border/50 flex flex-col overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
          <div className="flex-shrink-0 px-4 py-2 border-b border-app-border/30 flex items-center justify-between"
            style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)' }}>
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-info)' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Account Balances</span>
              <span className="text-[9px] font-bold text-app-muted-foreground">· {rows.length} lines</span>
            </div>
            <button onClick={addRow}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:brightness-110 text-white"
              style={{ background: 'var(--app-primary)', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
              <Plus size={11} /> Add Line
            </button>
          </div>

          {/* ── Table Header ── */}
          <div className="flex-shrink-0 hidden sm:flex items-center gap-2 px-4 py-2 border-b border-app-border/30 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)' }}>
            <div className="w-8 text-center">#</div>
            <div className="flex-1 min-w-0">Account</div>
            <div className="w-20 text-center">Type</div>
            <div className="w-20 text-center">Side</div>
            <div className="w-32 text-right">Balance Amount</div>
            <div className="w-8" />
          </div>

          {/* ── Rows ── */}
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {rows.map((row, idx) => {
              const selectedAcc = sortedAccounts.find(a => a.id.toString() === row.accountId)
              const typeColor = selectedAcc ? (TYPE_COLORS[selectedAcc.type] || TYPE_COLORS.ASSET) : null
              const isNormalDebit = selectedAcc ? ['ASSET', 'EXPENSE'].includes(selectedAcc.type) : null
              const amount = Number(row.balance) || 0
              const side = selectedAcc && amount !== 0
                ? (isNormalDebit ? (amount >= 0 ? 'Dr' : 'Cr') : (amount >= 0 ? 'Cr' : 'Dr'))
                : null
              const filteredAccs = getFilteredAccounts(row.id)

              return (
                <div key={row.id}
                  className="flex items-center gap-2 px-4 py-2 border-b border-app-border/20 hover:bg-app-surface/40 transition-all group">
                  {/* # */}
                  <div className="w-8 text-center text-[10px] font-bold text-app-muted-foreground">{idx + 1}</div>

                  {/* Account selector */}
                  <div className="flex-1 min-w-0 relative" id={`dropdown-${row.id}`}>
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={activeDropdown === row.id
                          ? (accountSearch[row.id] ?? '')
                          : selectedAcc ? `${selectedAcc.code} — ${selectedAcc.name}` : ''
                        }
                        onFocus={() => {
                          setActiveDropdown(row.id)
                          if (selectedAcc) setAccountSearch(prev => ({ ...prev, [row.id]: '' }))
                        }}
                        onChange={e => setAccountSearch(prev => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder="Search account..."
                        className="w-full pl-8 pr-8 py-1.5 text-[11px] font-bold bg-transparent border border-app-border/40 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary/50 focus:ring-1 focus:ring-app-primary/10 transition-all"
                      />
                      {selectedAcc && activeDropdown !== row.id && (
                        <button onClick={() => { updateRow(row.id, 'accountId', ''); setActiveDropdown(row.id) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground">
                          <X size={11} />
                        </button>
                      )}
                      {!selectedAcc && (
                        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" />
                      )}
                    </div>

                    {/* Dropdown */}
                    {activeDropdown === row.id && (
                      <div className="absolute left-0 top-full mt-1 w-full z-50 max-h-48 overflow-auto rounded-xl border border-app-border/60 shadow-2xl custom-scrollbar"
                        style={{ background: 'var(--app-bg)', backdropFilter: 'blur(20px)' }}>
                        {filteredAccs.length === 0 ? (
                          <div className="px-3 py-4 text-center text-[10px] text-app-muted-foreground">No accounts match</div>
                        ) : filteredAccs.map(acc => {
                          const tc = TYPE_COLORS[acc.type] || TYPE_COLORS.ASSET
                          return (
                            <button key={acc.id}
                              onClick={() => {
                                updateRow(row.id, 'accountId', acc.id.toString())
                                setActiveDropdown(null)
                                setAccountSearch(prev => ({ ...prev, [row.id]: '' }))
                                // Focus the balance input
                                setTimeout(() => inputRefs.current[row.id]?.focus(), 50)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-app-surface/60 transition-all">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                                {acc.code}
                              </span>
                              <span className="text-[11px] font-bold text-app-foreground truncate flex-1">{acc.name}</span>
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
                                style={{ background: tc.bg, color: tc.text }}>
                                {acc.type}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <div className="w-20 text-center hidden sm:block">
                    {selectedAcc && typeColor ? (
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}` }}>
                        {selectedAcc.type}
                      </span>
                    ) : (
                      <span className="text-[10px] text-app-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Side indicator */}
                  <div className="w-20 text-center hidden sm:block">
                    {side ? (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded"
                        style={{
                          background: side === 'Dr' ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                          color: side === 'Dr' ? 'var(--app-primary)' : 'var(--app-error)',
                        }}>
                        {side === 'Dr' ? '↗ Debit' : '↙ Credit'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-app-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Balance input */}
                  <div className="w-32">
                    <input
                      ref={el => { inputRefs.current[row.id] = el }}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={row.balance}
                      onChange={e => updateRow(row.id, 'balance', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (idx === rows.length - 1) addRow()
                          else {
                            const nextRow = rows[idx + 1]
                            if (nextRow) inputRefs.current[nextRow.id]?.focus()
                          }
                        }
                      }}
                      className="w-full text-right py-1.5 px-2.5 text-[12px] font-mono font-bold bg-transparent border border-app-border/40 rounded-lg text-app-foreground outline-none focus:border-app-primary/50 focus:ring-1 focus:ring-app-primary/10 transition-all tabular-nums"
                    />
                  </div>

                  {/* Delete */}
                  <div className="w-8 text-center">
                    <button onClick={() => removeRow(row.id)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-app-muted-foreground hover:text-[var(--app-error)] hover:bg-[color-mix(in_srgb,var(--app-error)_8%,transparent)] transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add row button (bottom) */}
            <button onClick={addRow}
              className="w-full py-3 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface/40 border-b border-app-border/10 transition-all flex items-center justify-center gap-1.5">
              <Plus size={12} /> Add another line
            </button>
          </div>
        </div>

        {/* ═══════════ BOTTOM: PREVIEW + SUBMIT ═══════════ */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Auto-Balance Info */}
          <div className="rounded-2xl border border-app-border/50 overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
            <div className="px-4 py-2 border-b border-app-border/30 flex items-center gap-2"
              style={{ background: 'color-mix(in srgb, var(--app-warning) 4%, transparent)' }}>
              <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-warning)' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Auto-Balancing</span>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning)' }} />
                <p className="text-[11px] text-app-muted-foreground leading-relaxed">
                  Double-entry accounting requires <strong className="text-app-foreground">Debits = Credits</strong>.
                  If your inputs don't match, the system will automatically create an entry in
                  <strong className="text-app-foreground"> "Opening Balance Equity"</strong> to make up the difference.
                </p>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="rounded-2xl border border-app-border/50 overflow-hidden"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
            <div className="px-4 py-2 border-b border-app-border/30 flex items-center gap-2"
              style={{ background: isBalanced ? 'color-mix(in srgb, var(--app-success) 4%, transparent)' : 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
              <div className="w-1 h-3 rounded-full" style={{ background: isBalanced ? 'var(--app-success)' : 'var(--app-error)' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: isBalanced ? 'var(--app-success)' : 'var(--app-error)' }}>
                {isBalanced ? 'Balanced' : 'Out of Balance'}
              </span>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Assets/Expenses (Dr)</span>
                <span className="text-[13px] font-mono font-black tabular-nums" style={{ color: 'var(--app-primary)' }}>{fmt(preview.totalDebit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Liabilities/Equity/Income (Cr)</span>
                <span className="text-[13px] font-mono font-black tabular-nums" style={{ color: 'var(--app-error)' }}>{fmt(preview.totalCredit)}</span>
              </div>
              <div className="border-t border-app-border/30 pt-2 flex justify-between items-center">
                <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Auto-Adjustment</span>
                <span className="text-[14px] font-mono font-black tabular-nums"
                  style={{ color: isBalanced ? 'var(--app-success)' : 'var(--app-warning)' }}>
                  {isBalanced ? '✓ Balanced' : `${fmt(Math.abs(preview.diff))} → Equity`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex-shrink-0 flex items-center justify-between pb-2">
          <Link href="/finance/opening-balances"
            className="text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">
            ← Cancel
          </Link>
          <button onClick={handleSubmit} disabled={isPending || preview.filledRows === 0}
            className="flex items-center gap-2 text-[12px] font-bold px-6 py-2.5 rounded-xl text-white transition-all disabled:opacity-50 hover:brightness-110"
            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
            {isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
            ) : (
              <><Save size={14} /> Save Opening Balances</>
            )}
          </button>
        </div>
      </div>

      {/* ── Unbalanced Confirmation Dialog ── */}
      <ConfirmDialog
        open={showBalanceWarning}
        onOpenChange={setShowBalanceWarning}
        onConfirm={() => { setShowBalanceWarning(false); doSubmit() }}
        title="Unbalanced Opening Balances"
        description={`Your opening balances are not equal (Difference: ${fmt(Math.abs(preview.diff))}). The system will automatically post the difference to "Opening Balance Equity" to ensure the ledger balances.`}
        confirmText="Proceed Anyway"
        variant="warning"
      />
    </div>
  )
}