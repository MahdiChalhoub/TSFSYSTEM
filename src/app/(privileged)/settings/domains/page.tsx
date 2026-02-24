'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Plus, Trash2, CheckCircle, XCircle, Clock, Shield, ExternalLink, Copy, RefreshCw, Star, AlertTriangle, Zap, Server, Lock, ArrowRight, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listCustomDomains, addCustomDomain, removeCustomDomain, verifyCustomDomain, setPrimaryDomain, checkDomainCname, requestDomainSsl } from '@/app/actions/domains'
import { toast } from 'sonner'

type CustomDomain = {
    id: string
    domain: string
    domain_type: 'SHOP' | 'PLATFORM'
    organization_slug: string
    organization_name: string
    is_verified: boolean
    verification_token: string
    txt_record_name: string
    txt_record_value: string
    cname_target: string
    ssl_status: string
    is_active: boolean
    is_primary: boolean
    created_at: string
    verified_at: string | null
    ssl_provisioned_at: string | null
}

export default function CustomDomainsPage() {
    const [domains, setDomains] = useState<CustomDomain[]>([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [newDomain, setNewDomain] = useState('')
    const [newType, setNewType] = useState<'SHOP' | 'PLATFORM'>('SHOP')
    const [verifying, setVerifying] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        const data = await listCustomDomains()
        setDomains(data)
        setLoading(false)
    }, [])

    useEffect(() => { refresh() }, [refresh])

    // Auto-refresh every 15 seconds when domains are pending
    useEffect(() => {
        const hasPending = domains.some(d => !d.is_active)
        if (!hasPending) return
        const interval = setInterval(refresh, 15000)
        return () => clearInterval(interval)
    }, [domains, refresh])

    const handleAdd = async () => {
        if (!newDomain.trim()) return
        setAdding(true)
        const result = await addCustomDomain(newDomain.trim(), newType)
        if (result.success) {
            toast.success(`Domain ${newDomain} added. Follow the steps to activate it.`)
            setNewDomain('')
            setShowAddForm(false)
            refresh()
        } else {
            toast.error(result.error || 'Failed to add domain')
        }
        setAdding(false)
    }

    const handleRemove = async (id: string, domain: string) => {
        if (!confirm(`Remove ${domain}? This will stop routing traffic from this domain.`)) return
        const result = await removeCustomDomain(id)
        if (result.success) {
            toast.success(`${domain} removed`)
            refresh()
        } else {
            toast.error(result.error || 'Failed to remove')
        }
    }

    const handleVerify = async (id: string) => {
        setVerifying(id)
        const result = await verifyCustomDomain(id)
        if (result.status === 'verified') {
            toast.success(result.message)
            refresh()
        } else {
            toast.error(result.message || 'Verification failed')
        }
        setVerifying(null)
    }

    const handleCheckCname = async (id: string) => {
        const result = await checkDomainCname(id)
        toast.info(result.message || 'CNAME check queued')
        setTimeout(refresh, 3000)
    }

    const handleRequestSsl = async (id: string) => {
        const result = await requestDomainSsl(id)
        toast.info(result.message || 'SSL provisioning queued')
        setTimeout(refresh, 5000)
    }

    const handleSetPrimary = async (id: string) => {
        const result = await setPrimaryDomain(id)
        if (result.status === 'ok') {
            toast.success(result.message)
            refresh()
        } else {
            toast.error(result.message || 'Failed')
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard')
    }

    // ─── Status Components ──────────────────────────────────────────────
    const getStep = (domain: CustomDomain): number => {
        if (domain.is_active) return 4
        if (domain.ssl_status === 'ACTIVE') return 4
        if (domain.ssl_status === 'PROVISIONING') return 3
        if (domain.is_verified) return 2
        return 1
    }

    const StepIndicator = ({ step, total = 4 }: { step: number; total?: number }) => (
        <div className="flex items-center gap-1">
            {Array.from({ length: total }, (_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i < step ? 'bg-emerald-500 w-8' : 'bg-gray-200 w-4'
                    }`} />
            ))}
        </div>
    )

    const StatusBadge = ({ domain }: { domain: CustomDomain }) => {
        if (domain.is_active) return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle size={12} /> Live
            </span>
        )
        if (domain.ssl_status === 'PROVISIONING') return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                <Lock size={12} /> SSL Provisioning...
            </span>
        )
        if (domain.is_verified) return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield size={12} /> Verified — Complete Setup
            </span>
        )
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock size={12} /> Pending Verification
            </span>
        )
    }

    const TypeBadge = ({ type }: { type: string }) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider
            ${type === 'SHOP' ? 'bg-violet-50 text-violet-600 border border-violet-200' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>
            {type === 'SHOP' ? '🛒 Shop' : '⚙️ Platform'}
        </span>
    )

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200 flex items-center justify-center">
                            <Globe className="w-6 h-6 text-violet-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Custom Domains</h1>
                            <p className="text-sm text-gray-500">Link your own domains to your storefront and control panel</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={refresh} className="rounded-xl">
                        <RefreshCw size={14} className="mr-1" /> Refresh
                    </Button>
                    <Button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl px-5"
                    >
                        <Plus size={16} className="mr-2" /> Add Domain
                    </Button>
                </div>
            </div>

            {/* Add Domain Form */}
            {showAddForm && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Add Custom Domain</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            placeholder="shop.yourdomain.com"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            className="flex-1 h-12 rounded-xl border-gray-200 font-mono"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as 'SHOP' | 'PLATFORM')}
                            className="h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 min-w-[180px]"
                        >
                            <option value="SHOP">🛒 Storefront / Shop</option>
                            <option value="PLATFORM">⚙️ Control Panel</option>
                        </select>
                        <Button
                            onClick={handleAdd}
                            disabled={adding || !newDomain.trim()}
                            className="h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                        >
                            {adding ? 'Adding...' : 'Add Domain'}
                        </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        After adding, follow the 3-step verification process: DNS TXT → CNAME → SSL certificate.
                    </p>
                </div>
            )}

            {/* How It Works (empty state) */}
            {domains.length === 0 && !loading && (
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-8">
                    <h3 className="text-lg font-black text-gray-900 mb-6">How Custom Domains Work</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { step: 1, icon: <Plus size={20} />, title: 'Add Domain', desc: 'Enter the domain you want to use' },
                            { step: 2, icon: <Shield size={20} />, title: 'Verify DNS', desc: 'Add a TXT record to prove ownership' },
                            { step: 3, icon: <Server size={20} />, title: 'Point CNAME', desc: 'Route traffic to our server' },
                            { step: 4, icon: <Lock size={20} />, title: 'Auto-SSL', desc: 'Certificate provisioned automatically' },
                        ].map(s => (
                            <div key={s.step} className="space-y-2">
                                <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600">{s.icon}</div>
                                <h4 className="font-bold text-gray-900">Step {s.step}: {s.title}</h4>
                                <p className="text-sm text-gray-500">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-sm text-violet-600">
                        <Zap size={14} />
                        <span className="font-bold">Auto-verification runs every 5 minutes — no manual checking needed!</span>
                    </div>
                </div>
            )}

            {/* Domain List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-48 bg-gray-100 rounded" />
                                    <div className="h-3 w-24 bg-gray-50 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {domains.map((domain) => {
                        const step = getStep(domain)
                        return (
                            <div key={domain.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${domain.is_active ? 'border-emerald-200' : 'border-gray-200'}`}>
                                {/* Domain Header */}
                                <div className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative ${domain.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                <Globe size={20} />
                                                {domain.is_active && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-gray-900 font-mono">{domain.domain}</h3>
                                                    {domain.is_primary && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
                                                            <Star size={10} /> Primary
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <TypeBadge type={domain.domain_type} />
                                                    <StatusBadge domain={domain} />
                                                    <StepIndicator step={step} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {domain.is_active && !domain.is_primary && (
                                                <Button variant="outline" size="sm" onClick={() => handleSetPrimary(domain.id)}
                                                    className="text-xs font-bold rounded-lg">
                                                    <Star size={12} className="mr-1" /> Set Primary
                                                </Button>
                                            )}
                                            {domain.is_active && (
                                                <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="outline" size="sm" className="text-xs font-bold rounded-lg">
                                                        <ExternalLink size={12} className="mr-1" /> Visit
                                                    </Button>
                                                </a>
                                            )}
                                            <Button variant="outline" size="sm" onClick={() => handleRemove(domain.id, domain.domain)}
                                                className="text-xs font-bold rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 size={12} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* STEP 1: DNS TXT Verification (if not verified) */}
                                {!domain.is_verified && (
                                    <div className="border-t border-gray-100 bg-amber-50/30 p-6 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">1</div>
                                            <h4 className="text-sm font-black text-gray-900">Verify Domain Ownership</h4>
                                            <span className="text-xs text-gray-400">(auto-checks every 5 min)</span>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            Add this <strong>TXT record</strong> to your DNS settings to prove you own this domain:
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <DnsCard label="Record Type" value="TXT" onCopy={() => copyToClipboard('TXT')} />
                                            <DnsCard label="Host / Name" value={domain.txt_record_name} onCopy={() => copyToClipboard(domain.txt_record_name)} />
                                            <div className="md:col-span-2">
                                                <DnsCard label="Value" value={domain.txt_record_value} onCopy={() => copyToClipboard(domain.txt_record_value)} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={() => handleVerify(domain.id)}
                                                disabled={verifying === domain.id}
                                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl px-6"
                                            >
                                                {verifying === domain.id ? (
                                                    <><RefreshCw size={14} className="mr-2 animate-spin" /> Checking DNS...</>
                                                ) : (
                                                    <><CheckCircle size={14} className="mr-2" /> Verify Now</>
                                                )}
                                            </Button>
                                            <p className="text-xs text-gray-400">DNS propagation can take up to 48 hours. We auto-check every 5 minutes.</p>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: CNAME / A Record (if verified but not active) */}
                                {domain.is_verified && !domain.is_active && (
                                    <div className="border-t border-gray-100 bg-blue-50/30 p-6 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">2</div>
                                            <h4 className="text-sm font-black text-gray-900">Point Your Domain to Our Server</h4>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            Add a <strong>CNAME record</strong> (or A record for root domains) to route traffic:
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <DnsCard label="Record Type" value="CNAME" onCopy={() => copyToClipboard('CNAME')} />
                                            <DnsCard label="Target / Points To" value={domain.cname_target || 'saas.tsf.ci'} onCopy={() => copyToClipboard(domain.cname_target || 'saas.tsf.ci')} />
                                        </div>
                                        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-2">
                                            <p className="text-xs font-bold text-blue-700">Using a root domain? (e.g., acme.com instead of shop.acme.com)</p>
                                            <p className="text-xs text-gray-500">Use an A record instead: <strong className="font-mono">91.99.186.183</strong>
                                                <button onClick={() => copyToClipboard('91.99.186.183')} className="ml-2 text-blue-500 hover:text-blue-700"><Copy size={10} /></button>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={() => handleCheckCname(domain.id)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-6"
                                            >
                                                <Wifi size={14} className="mr-2" /> Check CNAME
                                            </Button>
                                            <Button
                                                onClick={() => handleRequestSsl(domain.id)}
                                                variant="outline"
                                                className="font-bold rounded-xl px-6"
                                            >
                                                <Lock size={14} className="mr-2" /> Request SSL
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* ACTIVE: Show success state */}
                                {domain.is_active && (
                                    <div className="border-t border-emerald-100 bg-emerald-50/30 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm">
                                                <CheckCircle size={14} className="text-emerald-600" />
                                                <span className="font-bold text-emerald-700">Domain is live and routing traffic</span>
                                                {domain.ssl_provisioned_at && (
                                                    <span className="text-xs text-gray-400 ml-2">
                                                        SSL since {new Date(domain.ssl_provisioned_at).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Lock size={12} className="text-emerald-500" />
                                                <span className="text-xs font-bold text-emerald-600">HTTPS</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Architecture Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
                <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Zap size={14} className="text-violet-500" /> Production Features
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <Feature icon={<RefreshCw size={14} />} title="Auto-Verification" desc="DNS checked every 5 min — no manual clicking" />
                    <Feature icon={<Server size={14} />} title="Redis-Cached" desc="Domain resolution in <1ms via Redis cache" />
                    <Feature icon={<Lock size={14} />} title="Auto-SSL" desc="Certificates provisioned and renewed automatically" />
                    <Feature icon={<Shield size={14} />} title="CNAME Validation" desc="Verifies DNS actually points to our server" />
                    <Feature icon={<Wifi size={14} />} title="Health Monitoring" desc="Active domains checked every hour" />
                    <Feature icon={<Zap size={14} />} title="Rate-Limited" desc="30 req/min per IP on resolve endpoint" />
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-black text-gray-900 mb-3">Domain Types Explained</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-3">
                            <span className="text-lg">🛒</span>
                            <div>
                                <p className="font-bold text-gray-900">Shop Domain</p>
                                <p className="text-gray-500">Public storefront for customers. <span className="font-mono text-violet-600">shop.yourbusiness.com</span> → your online store</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-lg">⚙️</span>
                            <div>
                                <p className="font-bold text-gray-900">Platform Domain</p>
                                <p className="text-gray-500">Admin panel for employees. <span className="font-mono text-indigo-600">platform.yourbusiness.com</span> → management dashboard</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Reusable Components ─────────────────────────────────────────────────

function DnsCard({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-bold text-gray-900 truncate flex-1">{value}</p>
                <button onClick={onCopy} className="text-gray-400 hover:text-gray-600 shrink-0 p-1 rounded hover:bg-gray-100 transition-colors">
                    <Copy size={12} />
                </button>
            </div>
        </div>
    )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="flex items-start gap-2">
            <div className="mt-0.5 text-violet-500">{icon}</div>
            <div>
                <p className="font-bold text-gray-900">{title}</p>
                <p className="text-gray-500 text-xs">{desc}</p>
            </div>
        </div>
    )
}
