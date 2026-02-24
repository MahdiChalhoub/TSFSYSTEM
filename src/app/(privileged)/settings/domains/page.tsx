'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, Plus, Trash2, CheckCircle, XCircle, Clock, Shield, ExternalLink, Copy, RefreshCw, Star, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listCustomDomains, addCustomDomain, removeCustomDomain, verifyCustomDomain, setPrimaryDomain } from '@/app/actions/domains'
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
    ssl_status: string
    is_active: boolean
    is_primary: boolean
    created_at: string
    verified_at: string | null
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

    const handleAdd = async () => {
        if (!newDomain.trim()) return
        setAdding(true)
        const result = await addCustomDomain(newDomain.trim(), newType)
        if (result.success) {
            toast.success(`Domain ${newDomain} added. Follow the DNS instructions to verify.`)
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

    const StatusBadge = ({ domain }: { domain: CustomDomain }) => {
        if (domain.is_active) return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle size={12} /> Active
            </span>
        )
        if (domain.is_verified) return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield size={12} /> Verified
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
                <Button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl px-5"
                >
                    <Plus size={16} className="mr-2" /> Add Domain
                </Button>
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
                        Point your domain's DNS to our server. After adding, you'll get a TXT record to verify ownership.
                    </p>
                </div>
            )}

            {/* How It Works */}
            {domains.length === 0 && !loading && (
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-8">
                    <h3 className="text-lg font-black text-gray-900 mb-4">How Custom Domains Work</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600 font-black">1</div>
                            <h4 className="font-bold text-gray-900">Add your domain</h4>
                            <p className="text-sm text-gray-500">Enter the domain you want to link (e.g., shop.yourbusiness.com)</p>
                        </div>
                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600 font-black">2</div>
                            <h4 className="font-bold text-gray-900">Verify ownership</h4>
                            <p className="text-sm text-gray-500">Add a DNS TXT record to prove you own the domain</p>
                        </div>
                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600 font-black">3</div>
                            <h4 className="font-bold text-gray-900">Go live</h4>
                            <p className="text-sm text-gray-500">Point your domain's CNAME to our server and you're live!</p>
                        </div>
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
                    {domains.map((domain) => (
                        <div key={domain.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            {/* Domain Header */}
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${domain.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            <Globe size={20} />
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
                                            <div className="flex items-center gap-2 mt-1">
                                                <TypeBadge type={domain.domain_type} />
                                                <StatusBadge domain={domain} />
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

                            {/* Verification Instructions (if not verified) */}
                            {!domain.is_verified && (
                                <div className="border-t border-gray-100 bg-amber-50/50 p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-amber-600" />
                                        <h4 className="text-sm font-black text-gray-900">DNS Verification Required</h4>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        Add the following TXT record to your domain's DNS settings:
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Record Type</p>
                                            <p className="text-sm font-mono font-bold text-gray-900">TXT</p>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Host / Name</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono font-bold text-gray-900 truncate">{domain.txt_record_name}</p>
                                                <button onClick={() => copyToClipboard(domain.txt_record_name)} className="text-gray-400 hover:text-gray-600">
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Value</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono font-bold text-gray-900 break-all">{domain.txt_record_value}</p>
                                                <button onClick={() => copyToClipboard(domain.txt_record_value)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                                    <Copy size={12} />
                                                </button>
                                            </div>
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
                                                <><CheckCircle size={14} className="mr-2" /> Verify Domain</>
                                            )}
                                        </Button>
                                        <p className="text-xs text-gray-400">DNS changes may take up to 48 hours to propagate.</p>
                                    </div>
                                </div>
                            )}

                            {/* CNAME Instructions (if verified but not active) */}
                            {domain.is_verified && !domain.is_active && (
                                <div className="border-t border-gray-100 bg-blue-50/50 p-6 space-y-3">
                                    <h4 className="text-sm font-black text-gray-900">Point your domain to our server</h4>
                                    <p className="text-sm text-gray-500">Add a CNAME record pointing to:</p>
                                    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                                        <p className="text-sm font-mono font-bold text-gray-900">saas.tsf.ci</p>
                                        <button onClick={() => copyToClipboard('saas.tsf.ci')} className="text-gray-400 hover:text-gray-600">
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Info Footer */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
                <h4 className="text-sm font-black text-gray-900">Domain Types Explained</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-3">
                        <span className="text-lg">🛒</span>
                        <div>
                            <p className="font-bold text-gray-900">Shop Domain</p>
                            <p className="text-gray-500">Your public storefront. Customers see this when they visit your online shop. Example: <span className="font-mono text-violet-600">shop.yourbusiness.com</span></p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="text-lg">⚙️</span>
                        <div>
                            <p className="font-bold text-gray-900">Platform Domain</p>
                            <p className="text-gray-500">Your admin control panel. Employees use this to manage inventory, finance, etc. Example: <span className="font-mono text-indigo-600">platform.yourbusiness.com</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
