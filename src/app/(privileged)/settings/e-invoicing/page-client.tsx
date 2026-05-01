'use client'

import { useState, useEffect, useMemo } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { fneTestConnection } from '@/app/actions/finance/einvoice'
import Link from 'next/link'
import {
  Shield, Save, Loader2, CheckCircle, XCircle, Wifi,
  Eye, EyeOff, Globe, Building2, MessageSquare, Zap,
  AlertTriangle, ExternalLink, QrCode, FileText, Key,
  Image as ImageIcon, ArrowRight, Info, Settings2
} from 'lucide-react'
import { toast } from 'sonner'
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell'

/* ═════════════════════════════════════════════════════════════════
   Types — driven by SaaS EInvoiceStandard definitions
   ═════════════════════════════════════════════════════════════════ */

type FieldDef = {
  key: string
  label: string
  type: string  // text, password, url, email, file, image, textarea
  required: boolean
  placeholder?: string
  help?: string
}

type EInvoiceStandard = {
  id: number
  code: string
  name: string
  description: string
  region: string
  invoice_format: string
  schema_version: string
  required_credentials: FieldDef[]
  branding_fields: FieldDef[]
  setup_guide: string
  portal_url: string
  documentation_url: string
}

type ResolvedState = {
  resolved: boolean
  standard: EInvoiceStandard | null
  enforcement: 'NONE' | 'OPTIONAL' | 'RECOMMENDED' | 'MANDATORY'
  country_code: string | null
  country_name: string | null
  saved_credentials: Record<string, string>
  saved_branding: Record<string, string>
  is_active: boolean
  message: string | null
}

/* ═════════════════════════════════════════════════════════════════
   Page Component
   ═════════════════════════════════════════════════════════════════ */

export default function EInvoiceSettingsPage() {
  const [state, setState] = useState<ResolvedState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; authenticated: boolean; message: string } | null>(null)

  // Dynamic form values (keyed by field.key)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [branding, setBranding] = useState<Record<string, string>>({})
  const [isActive, setIsActive] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set())

  useEffect(() => { loadState() }, [])

  async function loadState() {
    setLoading(true)
    try {
      const data = await erpFetch('finance/e-invoice-standards/resolve-for-tenant/')
      setState(data)
      if (data.resolved && data.standard) {
        setCredentials(data.saved_credentials || {})
        setBranding(data.saved_branding || {})
        setIsActive(data.is_active ?? false)
      }
    } catch (e) {
      // Fallback: no standard resolved
      setState({
        resolved: false,
        standard: null,
        enforcement: 'NONE',
        country_code: null,
        country_name: null,
        saved_credentials: {},
        saved_branding: {},
        is_active: false,
        message: 'Failed to load e-invoicing configuration.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const org = await erpFetch('organizations/me/')
      const existingSettings = org?.settings || {}
      await erpFetch('organizations/me/', {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            ...existingSettings,
            einvoice: {
              ...(existingSettings.einvoice || {}),
              standard_code: state?.standard?.code || '',
              credentials,
              branding,
              is_active: isActive,
              // Legacy compat: mirror api_key for FNE service
              api_key: credentials.api_key || credentials.fne_api_key || '',
              base_url: credentials.base_url || credentials.server_url || '',
              ncc: credentials.ncc || '',
              establishment: credentials.establishment || branding.establishment || '',
              point_of_sale: credentials.point_of_sale || '',
              commercial_message: branding.commercial_message || '',
              footer: branding.footer || '',
            },
          },
        }),
      })
      toast.success('E-Invoice settings saved')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestConnection() {
    const apiKey = credentials.api_key || credentials.fne_api_key || ''
    const baseUrl = credentials.base_url || credentials.server_url || ''
    if (!apiKey) {
      toast.error('Enter your API key first')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await fneTestConnection(apiKey, baseUrl) as any
      setTestResult(result)
      if (result.authenticated) {
        toast.success('Connected and authenticated!')
      } else if (result.connected) {
        toast.error('Connected but authentication failed.')
      } else {
        toast.error(result.message || 'Connection failed')
      }
    } catch (e: any) {
      setTestResult({ connected: false, authenticated: false, message: e?.message || 'Test failed' })
      toast.error('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const hasApiKey = !!(credentials.api_key || credentials.fne_api_key)

  const std = state?.standard
  const enforcementColor = state?.enforcement === 'MANDATORY' ? 'var(--app-error)' : state?.enforcement === 'RECOMMENDED' ? 'var(--app-warning)' : 'var(--app-info)'

  return (
    <SettingsPageShell
        title={std?.name || 'E-Invoice Configuration'}
        subtitle={std ? `Settings · Compliance · ${state?.country_name}` : 'Settings · Compliance'}
        icon={<Shield size={20} className="text-white" />}
        configKey="einvoice"
        config={std ? { ...credentials, ...branding, is_active: isActive } as any : null}
        hasChanges={!!std}
        onSave={std ? handleSave : undefined}
        saving={saving}
    >

    {/* ── Loading ── */}
    {loading ? (
      <div className="flex items-center justify-center py-20 animate-in fade-in">
        <div className="text-center space-y-3">
          <Loader2 size={28} className="animate-spin text-app-primary mx-auto" />
          <p className="text-[11px] font-bold text-app-muted-foreground">Resolving e-invoicing standard...</p>
        </div>
      </div>
    ) : !state?.resolved || !std ? (
      /* ── No Standard Resolved ── */
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        <div className="max-w-[700px] mx-auto w-full space-y-6">
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
            style={{
              background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
              border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)' }}>
              <AlertTriangle size={28} style={{ color: 'var(--app-warning)' }} />
            </div>
            <h2 className="text-[15px] font-black text-app-foreground mb-2">
              {state?.country_code ? 'No E-Invoice Standard Assigned' : 'Country Not Configured'}
            </h2>
            <p className="text-[12px] text-app-muted-foreground max-w-md mb-4">
              {state?.message || 'Configure your country in Settings → Regional first, then ask your SaaS admin to assign an e-invoicing standard.'}
            </p>
            {state?.country_code && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-app-muted-foreground">
                <Globe size={12} />
                <span>Country: <strong className="text-app-foreground">{state.country_name || state.country_code}</strong></span>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              {!state?.country_code && (
                <Link href="/settings/regional"
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl hover:brightness-110 transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Settings2 size={12} /> Configure Country
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : (
      /* ── Standard Resolved — Dynamic Rendering ── */
    <div className="flex flex-col h-full">
      <div className="max-w-[900px] mx-auto w-full space-y-6">

        {/* ── Standard Identity Banner ──────────── */}
        <div className="p-4 rounded-2xl" style={{
          background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
          border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
        }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--app-accent) 12%, transparent)', color: 'var(--app-accent)' }}>
              <Zap size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-black text-app-foreground">{std.name}</span>
                <span className="text-[8px] font-black px-1.5 py-px rounded-md uppercase tracking-wider"
                  style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', color: 'var(--app-accent)' }}>
                  {std.code}
                </span>
                {std.schema_version && (
                  <span className="text-[8px] font-bold text-app-muted-foreground">{std.schema_version}</span>
                )}
              </div>
              {std.description && (
                <p className="text-[10px] text-app-muted-foreground mt-0.5">{std.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider"
                style={{ background: `color-mix(in srgb, ${enforcementColor} 10%, transparent)`, color: enforcementColor }}>
                {state.enforcement}
              </span>
              {/* Active Toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                  className="rounded" />
                <span className="text-[10px] font-black text-app-foreground uppercase tracking-wider">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          </div>
          {/* Quick links */}
          {(std.portal_url || std.documentation_url) && (
            <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
              {std.portal_url && (
                <a href={std.portal_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold text-app-primary hover:underline">
                  <ExternalLink size={10} /> Official Portal
                </a>
              )}
              {std.documentation_url && (
                <a href={std.documentation_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold text-app-primary hover:underline">
                  <FileText size={10} /> Documentation
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Connection Status ─────────────────── */}
        {testResult && (
          <div className="p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              background: testResult.authenticated
                ? 'color-mix(in srgb, var(--app-success) 8%, var(--app-surface))'
                : 'color-mix(in srgb, var(--app-error) 8%, var(--app-surface))',
              border: `1px solid ${testResult.authenticated ? 'var(--app-success)' : 'var(--app-error)'}`,
            }}>
            {testResult.authenticated ? (
              <CheckCircle size={16} style={{ color: 'var(--app-success)' }} />
            ) : (
              <XCircle size={16} style={{ color: 'var(--app-error)' }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold" style={{ color: testResult.authenticated ? 'var(--app-success)' : 'var(--app-error)' }}>
                {testResult.authenticated ? 'Connected & Authenticated' : testResult.connected ? 'Connected but Auth Failed' : 'Connection Failed'}
              </div>
              <div className="text-[10px] font-bold text-app-muted-foreground">{testResult.message}</div>
            </div>
          </div>
        )}

        {/* ── Dynamic Credentials Section ─────── */}
        {std.required_credentials.length > 0 && (
          <div className="p-4 rounded-2xl" style={{
            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
          }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                <Key size={14} />
              </div>
              <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">
                Credentials ({std.required_credentials.length})
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {std.required_credentials.map((field: FieldDef) => (
                <div key={field.key}>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                    {field.label} {field.required && <span style={{ color: 'var(--app-error)' }}>*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={credentials[field.key] || ''}
                      onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all min-h-[60px]"
                    />
                  ) : field.type === 'password' ? (
                    <div className="relative">
                      <input
                        type={showSecrets.has(field.key) ? 'text' : 'password'}
                        value={credentials[field.key] || ''}
                        onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder || ''}
                        className="w-full text-[12px] font-mono font-bold px-2.5 py-2 pr-8 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"
                      />
                      <button onClick={() => toggleSecret(field.key)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-app-muted-foreground hover:text-app-foreground transition-colors">
                        {showSecrets.has(field.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  ) : (
                    <input
                      type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                      value={credentials[field.key] || ''}
                      onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      className={`w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all ${field.type === 'url' || field.key.includes('url') ? 'font-mono' : ''}`}
                    />
                  )}
                  {field.help && (
                    <p className="text-[8px] font-bold text-app-muted-foreground mt-1">{field.help}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Dynamic Branding Section ──────────── */}
        {std.branding_fields.length > 0 && (
          <div className="p-4 rounded-2xl" style={{
            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
          }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                <ImageIcon size={14} />
              </div>
              <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">
                Invoice Branding ({std.branding_fields.length})
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {std.branding_fields.map((field: FieldDef) => (
                <div key={field.key}>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                    {field.label} {field.required && <span style={{ color: 'var(--app-error)' }}>*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={branding[field.key] || ''}
                      onChange={e => setBranding(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all min-h-[60px]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={branding[field.key] || ''}
                      onChange={e => setBranding(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"
                    />
                  )}
                  {field.help && (
                    <p className="text-[8px] font-bold text-app-muted-foreground mt-1">{field.help}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Setup Guide ──────────────────────── */}
        {std.setup_guide && (
          <div className="p-4 rounded-2xl" style={{
            background: 'color-mix(in srgb, var(--app-success) 4%, var(--app-background))',
            border: '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)',
          }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                <FileText size={14} />
              </div>
              <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">Setup Guide</h3>
            </div>
            <div className="text-[11px] text-app-foreground whitespace-pre-wrap leading-relaxed font-medium">
              {std.setup_guide}
            </div>
          </div>
        )}

        {/* ── Mandatory Enforcement Warning ────── */}
        {state.enforcement === 'MANDATORY' && !isActive && (
          <div className="p-3 rounded-xl flex items-start gap-3 animate-in fade-in duration-200" style={{
            background: 'color-mix(in srgb, var(--app-error) 8%, var(--app-surface))',
            border: '1px solid var(--app-error)',
          }}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-error)' }} />
            <div>
              <div className="text-[11px] font-black" style={{ color: 'var(--app-error)' }}>E-Invoicing Required by Law</div>
              <div className="text-[10px] font-bold text-app-muted-foreground">
                {state.country_name} requires e-invoicing via {std.name}. Activate it above and fill in your credentials.
              </div>
            </div>
          </div>
        )}

        {/* ── No Fields Defined Fallback ────────── */}
        {std.required_credentials.length === 0 && std.branding_fields.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl"
            style={{
              background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
              border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <Info size={28} className="text-app-muted-foreground mb-3 opacity-40" />
            <p className="text-[12px] font-bold text-app-muted-foreground">
              No configuration fields defined for {std.name}.
            </p>
            <p className="text-[10px] text-app-muted-foreground mt-1">
              Contact your SaaS administrator to set up the credentials and branding fields for this standard.
            </p>
          </div>
        )}

        {/* ── Format + Monitor Link ──────────────── */}
        <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{
          background: 'color-mix(in srgb, var(--app-info) 5%, var(--app-background))',
          border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)',
        }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground">
              <Globe size={10} /> {state.country_name}
            </div>
            <span className="text-[9px] font-black px-1.5 py-px rounded"
              style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)' }}>
              {std.invoice_format}
            </span>
          </div>
          <Link href="/settings/e-invoicing/monitor"
            className="flex items-center gap-1 text-[10px] font-bold text-app-primary hover:underline">
            <QrCode size={10} /> Certification Monitor <ArrowRight size={10} />
          </Link>
        </div>
        {/* Test Connection button — separate from shell */}
        {hasApiKey && (
          <div className="flex items-center gap-2">
            <button onClick={handleTestConnection} disabled={testing}
              className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50">
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
              Test Connection
            </button>
          </div>
        )}
      </div>
    </div>
    )}
    </SettingsPageShell>
  )
}
