'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { Save, ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-app-surface/50 p-5 space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--app-accent)' }}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Field({ label, help, children, full }: { label: string; help?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-muted)' }}>{label}</label>
      {children}
      {help && <p className="mt-1 text-[10px]" style={{ color: 'var(--app-muted)', opacity: 0.7 }}>{help}</p>}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 rounded-xl text-sm border border-white/10 bg-app-surface focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none transition-colors"

export default function CounterpartyTaxProfileFormPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id === 'new' ? null : params?.id ? Number(params.id) : null
  const isEdit = id !== null

  const [form, setForm] = useState<Record<string, any>>({
    name: '', country_code: 'CI', state_code: '',
    vat_registered: true, reverse_charge: false, airsi_subject: false,
    allowed_scopes: ['OFFICIAL', 'INTERNAL'],
    required_documents: [], enforce_compliance: false,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (isEdit && id) {
      erpFetch(`finance/counterparty-tax-profiles/${id}/`).then(data => {
        setForm(data)
        setLoading(false)
      })
    }
  }, [id, isEdit])

  const upd = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  async function handleSave() {
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `finance/counterparty-tax-profiles/${id}/` : 'finance/counterparty-tax-profiles/'
      await erpFetch(url, { method, body: JSON.stringify(form) })
      toast.success(isEdit ? 'Profile updated' : 'Profile created')
      router.push('/finance/counterparty-tax-profiles')
    } catch (err: any) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--app-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-app-surface/80 transition-colors">
            <ArrowLeft size={18} style={{ color: 'var(--app-muted)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--app-foreground)' }}>
              {isEdit ? 'Edit Tax Profile' : 'New Tax Profile'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--app-muted)' }}>Supplier or client fiscal identity</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}
          className="h-9 px-5 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
          <Save size={14} className="mr-2" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Section title="Identity">
        <Field label="Profile Name" help="e.g. 'Assujetti TVA', 'Foreign B2B'">
          <input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} />
        </Field>
        <Field label="Country Code" help="ISO country code">
          <input className={inputCls} value={form.country_code} onChange={e => upd('country_code', e.target.value.toUpperCase())} maxLength={3} />
        </Field>
        <Field label="State / Region Code" help="For sub-national taxes (leave blank if not applicable)">
          <input className={inputCls} value={form.state_code || ''} onChange={e => upd('state_code', e.target.value)} placeholder="e.g. CA, ON" />
        </Field>
      </Section>

      <Section title="Tax Behavior">
        <Field label="VAT Registered" help="Does this counterparty charge VAT?">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.vat_registered} onChange={e => upd('vat_registered', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>VAT Registered</span>
          </label>
        </Field>
        <Field label="Reverse Charge" help="Foreign B2B inbound only — triggers autoliquidation">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.reverse_charge} onChange={e => upd('reverse_charge', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Enable Reverse Charge</span>
          </label>
        </Field>
        <Field label="Withholding Subject" help="Buying from this supplier triggers purchase withholding tax">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.airsi_subject} onChange={e => upd('airsi_subject', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Withholding Subject</span>
          </label>
        </Field>
      </Section>

      <Section title="Scopes & Compliance">
        <Field label="Allowed Scopes" full>
          <div className="flex gap-3">
            {['OFFICIAL', 'INTERNAL'].map(scope => (
              <label key={scope} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form.allowed_scopes || []).includes(scope)}
                  onChange={e => {
                    const scopes = [...(form.allowed_scopes || [])]
                    if (e.target.checked) scopes.push(scope)
                    else scopes.splice(scopes.indexOf(scope), 1)
                    upd('allowed_scopes', scopes)
                  }}
                  className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--app-foreground)' }}>{scope}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Enforce Compliance" help="Block transactions if required documents are missing">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enforce_compliance} onChange={e => upd('enforce_compliance', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Enforce</span>
          </label>
        </Field>
      </Section>
    </div>
  )
}
