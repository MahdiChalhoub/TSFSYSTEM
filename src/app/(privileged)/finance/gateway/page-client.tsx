'use client'

import { useState, useEffect } from 'react'
import { getGatewayConfigs, createGatewayConfig, deleteGatewayConfig, setGatewayKeys, testGatewayConnection } from '@/app/actions/finance/einvoice'
import { CreditCard, Plus, Key, Wifi, WifiOff, Trash2, CheckCircle, XCircle, Shield, RefreshCw, Eye, EyeOff } from 'lucide-react'

type Gateway = {
 id: number
 gateway_type: string
 name: string
 is_active: boolean
 is_test_mode: boolean
 webhook_url?: string
 organization: number
}

const GATEWAYS = [
 { type: 'STRIPE', label: 'Stripe', icon: '💳', desc: 'Accept card payments with Stripe Elements' },
 { type: 'PAYPAL', label: 'PayPal', icon: '🅿️', desc: 'PayPal Checkout integration' },
 { type: 'MANUAL', label: 'Manual', icon: '🏦', desc: 'Bank transfer, cash, or custom methods' },
]

export default function PaymentGatewayPage() {
 const [configs, setConfigs] = useState<Gateway[]>([])
 const [loading, setLoading] = useState(true)
 const [showNew, setShowNew] = useState(false)
 const [form, setForm] = useState({ gateway_type: 'STRIPE', name: '', is_test_mode: true })
 const [keyForm, setKeyForm] = useState<{ id: number | null; api_key: string; webhook_secret: string }>({ id: null, api_key: '', webhook_secret: '' })
 const [showKey, setShowKey] = useState(false)
 const [testing, setTesting] = useState<number | null>(null)
 const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string }>>({})
 const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 const data = await getGatewayConfigs()
 setConfigs(Array.isArray(data) ? data : (data?.results ?? []))
 setLoading(false)
 }

 async function handleCreate() {
 if (!form.name) return showToast('Name is required', 'err')
 await createGatewayConfig(form)
 setShowNew(false)
 load()
 showToast('Gateway created', 'ok')
 }

 async function handleSetKeys() {
 if (!keyForm.id || !keyForm.api_key) return showToast('API key required', 'err')
 await setGatewayKeys(keyForm.id, keyForm.api_key, keyForm.webhook_secret || undefined)
 setKeyForm({ id: null, api_key: '', webhook_secret: '' })
 showToast('Keys saved securely', 'ok')
 }

 async function handleTest(id: number) {
 setTesting(id)
 try {
 const res = await testGatewayConnection(id)
 setTestResult(prev => ({ ...prev, [id]: { ok: res?.connected ?? false, msg: res?.message || 'Connected' } }))
 } catch (e: any) {
 setTestResult(prev => ({ ...prev, [id]: { ok: false, msg: e?.message || 'Connection failed' } }))
 } finally { setTesting(null) }
 }

 async function handleDelete(id: number) {
 await deleteGatewayConfig(id)
 load()
 showToast('Gateway removed', 'ok')
 }

 function showToast(msg: string, type: 'ok' | 'err') {
 setToast({ msg, type })
 setTimeout(() => setToast(null), 4000)
 }

 return (
 <div className="min-h-screen bg-[#070D1B] text-app-foreground p-6 flex flex-col gap-6 bg-app-background">
 {toast && (
 <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-app-success/80 border-app-success/30 text-app-success' : 'bg-app-error/80 border-app-error/30 text-app-error'}`}>
 {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
 {toast.msg}
 </div>
 )}

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-primary flex items-center justify-center shadow-lg shadow-app-primary/20">
 <CreditCard size={22} className="text-app-foreground" />
 </div>
 <div>
 <h1 className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-violet-200">
 <CreditCard size={28} className="text-app-foreground" />
 </div>
 Payment <span className="text-app-primary">Gateway</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Online Payments</p>
 </div>
 </div>
 <button onClick={() => setShowNew(v => !v)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-primary hover:bg-app-primary text-app-foreground text-sm font-semibold transition-colors">
 <Plus size={14} />
 Add Gateway
 </button>
 </div>

 {/* Available gateways */}
 <div className="grid grid-cols-3 gap-4">
 {GATEWAYS.map(g => (
 <div key={g.type} className="bg-[#0F1729] rounded-2xl border border-app-border p-4">
 <div className="text-2xl mb-2">{g.icon}</div>
 <div className="font-semibold text-app-foreground text-sm">{g.label}</div>
 <div className="text-xs text-app-muted-foreground mt-1">{g.desc}</div>
 <div className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${configs.some(c => c.gateway_type === g.type) ? 'bg-app-success/40 text-app-primary border border-app-success/30' : 'bg-app-surface-2 text-app-muted-foreground'}`}>
 {configs.some(c => c.gateway_type === g.type) ? '✓ Configured' : 'Not configured'}
 </div>
 </div>
 ))}
 </div>

 {/* New gateway form */}
 {showNew && (
 <div className="bg-[#0F1729] rounded-2xl border border-app-success/30/50 p-6 flex flex-col gap-4">
 <h3>Add Payment Gateway</h3>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="text-xs text-app-muted-foreground mb-1 block">Gateway Type</label>
 <select value={form.gateway_type} onChange={e => setForm({ ...form, gateway_type: e.target.value })} className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-app-primary">
 {GATEWAYS.map(g => <option key={g.type} value={g.type}>{g.label}</option>)}
 </select>
 </div>
 <div>
 <label className="text-xs text-app-muted-foreground mb-1 block">Display Name</label>
 <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Stripe Live" className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-app-primary" />
 </div>
 <div className="flex items-end pb-0.5">
 <label className="flex items-center gap-2 cursor-pointer">
 <input type="checkbox" checked={form.is_test_mode} onChange={e => setForm({ ...form, is_test_mode: e.target.checked })} className="w-4 h-4 rounded accent-emerald-500" />
 <span className="text-sm text-app-muted-foreground">Test Mode</span>
 </label>
 </div>
 </div>
 <div className="flex gap-3">
 <button onClick={handleCreate} className="px-4 py-2 rounded-xl bg-app-primary hover:bg-app-primary text-app-foreground text-sm font-semibold">Create Gateway</button>
 <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-app-surface-2 hover:bg-app-surface text-app-muted-foreground text-sm">Cancel</button>
 </div>
 </div>
 )}

 {/* Configured gateways */}
 <div className="flex flex-col gap-3">
 <h3 className="text-app-muted-foreground uppercase">Configured Gateways</h3>
 {loading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 bg-app-surface-2/50 rounded-xl animate-pulse" />) :
 configs.length === 0 ? (
 <div className="bg-[#0F1729] rounded-2xl border border-app-border p-8 text-center text-app-muted-foreground text-sm">No gateways configured yet.</div>
 ) : configs.map(cfg => (
 <div key={cfg.id} className="bg-[#0F1729] rounded-2xl border border-app-border p-5">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-app-surface-2 flex items-center justify-center text-lg">
 {GATEWAYS.find(g => g.type === cfg.gateway_type)?.icon || '💳'}
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <span className="font-semibold text-app-foreground">{cfg.name}</span>
 <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-app-info/40 text-app-info border border-app-info/30">{cfg.gateway_type}</span>
 {cfg.is_test_mode && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-app-warning/40 text-app-warning border border-app-warning/30">TEST MODE</span>}
 </div>
 {testResult[cfg.id] && (
 <div className={`text-xs mt-1 flex items-center gap-1 ${testResult[cfg.id].ok ? 'text-app-primary' : 'text-app-error'}`}>
 {testResult[cfg.id].ok ? <Wifi size={10} /> : <WifiOff size={10} />}
 {testResult[cfg.id].msg}
 </div>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button onClick={() => setKeyForm({ id: cfg.id, api_key: '', webhook_secret: '' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-surface-2 hover:bg-app-surface text-app-muted-foreground text-xs transition-colors">
 <Key size={12} />
 Set Keys
 </button>
 <button onClick={() => handleTest(cfg.id)} disabled={testing === cfg.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-info/40 hover:bg-app-info/40 text-app-info text-xs border border-app-info/30 transition-colors disabled:opacity-50">
 {testing === cfg.id ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
 Test
 </button>
 <button onClick={() => handleDelete(cfg.id)} className="p-1.5 rounded-xl hover:bg-app-error/40 text-app-muted-foreground hover:text-app-error transition-colors">
 <Trash2 size={14} />
 </button>
 </div>
 </div>

 {keyForm.id === cfg.id && (
 <div className="mt-4 pt-4 border-t border-app-border flex flex-col gap-3">
 <div className="flex items-center gap-2">
 <Shield size={14} className="text-app-warning" />
 <span className="text-xs text-app-warning font-medium">Keys are stored encrypted (AES-256). They are never returned in plaintext.</span>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs text-app-muted-foreground mb-1 block">API Key (sk_...)</label>
 <div className="relative">
 <input
 type={showKey ? 'text' : 'password'}
 value={keyForm.api_key}
 onChange={e => setKeyForm({ ...keyForm, api_key: e.target.value })}
 placeholder="sk_live_..."
 className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 pr-10 py-2 text-sm text-app-foreground focus:outline-none focus:border-app-warning/30 font-mono"
 />
 <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-muted-foreground">
 {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>
 <div>
 <label className="text-xs text-app-muted-foreground mb-1 block">Webhook Secret (whsec_...)</label>
 <input
 type="password"
 value={keyForm.webhook_secret}
 onChange={e => setKeyForm({ ...keyForm, webhook_secret: e.target.value })}
 placeholder="whsec_..."
 className="w-full bg-[#070D1B] border border-app-border rounded-xl px-3 py-2 text-sm text-app-foreground focus:outline-none focus:border-app-warning/30 font-mono"
 />
 </div>
 </div>
 <div className="flex gap-2">
 <button onClick={handleSetKeys} className="px-4 py-2 rounded-xl bg-app-warning hover:bg-app-warning text-app-foreground text-sm font-semibold">Save Keys</button>
 <button onClick={() => setKeyForm({ id: null, api_key: '', webhook_secret: '' })} className="px-4 py-2 rounded-xl bg-app-surface-2 text-app-muted-foreground text-sm">Cancel</button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )
}
