'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Shield, Lock, Unlock, Key, RefreshCw, AlertTriangle,
    CheckCircle2, XCircle, RotateCcw, Building2, Zap,
    ShieldCheck, ShieldOff, Eye, EyeOff, Info
} from "lucide-react"
import { erpFetch } from '@/lib/erp-api'

interface EncryptionStatus {
    organization: string
    encryption_enabled: boolean
    has_key: boolean
    addon_entitled: boolean
    plan: string | null
}

interface OrgItem {
    id: string
    name: string
    slug: string
}

function StatusPulse({ active }: { active: boolean }) {
    return (
        <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
        </span>
    )
}

export default function EncryptionPage() {
    const [status, setStatus] = useState<EncryptionStatus | null>(null)
    const [orgs, setOrgs] = useState<OrgItem[]>([])
    const [selectedOrgId, setSelectedOrgId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showDemo, setShowDemo] = useState(false)
    const [demoData, setDemoData] = useState<{ original: string; encrypted: string; masked: string } | null>(null)

    // Load organizations
    const fetchOrgs = useCallback(async () => {
        try {
            const data = await erpFetch('organizations/')
            const orgList = Array.isArray(data) ? data : (data?.results || [])
            setOrgs(orgList)
            if (orgList.length > 0 && !selectedOrgId) {
                setSelectedOrgId(orgList[0].id)
            }
        } catch (e: any) {
            console.error('Failed to load orgs:', e)
        }
    }, [selectedOrgId])

    // Load encryption status
    const fetchStatus = useCallback(async () => {
        try {
            const data = await erpFetch('saas/modules/encryption/status/')
            setStatus(data)
            setError(null)
        } catch (e: any) {
            // If no org context, status shows as unknown
            setStatus(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchOrgs()
        fetchStatus()
    }, [fetchOrgs, fetchStatus])

    const handleActivate = async () => {
        setActionLoading('activate')
        setError(null)
        setSuccess(null)
        try {
            const result = await erpFetch('saas/modules/encryption/activate/', {
                method: 'POST',
                body: JSON.stringify({
                    organization_id: selectedOrgId,
                    force: true
                }),
            })
            if (result.success) {
                setSuccess(result.message || 'Encryption activated!')
                fetchStatus()
            } else {
                setError(result.error || 'Failed to activate encryption')
            }
        } catch (e: any) {
            setError(e.message || 'Failed to activate encryption')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeactivate = async () => {
        setActionLoading('deactivate')
        setError(null)
        setSuccess(null)
        try {
            const result = await erpFetch('saas/modules/encryption/deactivate/', {
                method: 'POST',
                body: JSON.stringify({ organization_id: selectedOrgId }),
            })
            if (result.success) {
                setSuccess(result.message || 'Encryption deactivated')
                fetchStatus()
            } else {
                setError(result.error || 'Failed to deactivate')
            }
        } catch (e: any) {
            setError(e.message || 'Failed to deactivate')
        } finally {
            setActionLoading(null)
        }
    }

    const handleRotateKey = async () => {
        if (!confirm('⚠️ Key rotation will re-encrypt ALL encrypted data with a new key. This cannot be undone. Continue?')) return
        setActionLoading('rotate')
        setError(null)
        setSuccess(null)
        try {
            const result = await erpFetch('saas/modules/encryption/rotate-key/', {
                method: 'POST',
                body: JSON.stringify({ organization_id: selectedOrgId }),
            })
            if (result.success) {
                setSuccess(result.message || 'Key rotated successfully')
                fetchStatus()
            } else {
                setError(result.error || 'Failed to rotate key')
            }
        } catch (e: any) {
            setError(e.message || 'Failed to rotate key')
        } finally {
            setActionLoading(null)
        }
    }

    const toggleDemo = () => {
        if (!showDemo) {
            // Show demo encryption
            const original = 'SSN-123-45-6789'
            const encrypted = 'enc:IebWb75LKH2bUGIM:/v1iy+Qt5eJCNEGK...'
            const masked = '•••••••••••6789'
            setDemoData({ original, encrypted, masked })
        }
        setShowDemo(!showDemo)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <Shield className="animate-pulse text-cyan-500 mx-auto mb-4" size={48} />
                    <p className="text-slate-500 text-sm">Loading encryption status...</p>
                </div>
            </div>
        )
    }

    const isActive = status?.encryption_enabled || false
    const hasKey = status?.has_key || false

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <Shield className="text-white" size={22} />
                        </div>
                        AES-256 Encryption
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium">Field-level encryption for sensitive data · Per-organization key management</p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700/50"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <AlertTriangle size={18} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
                </div>
            )}
            {success && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <CheckCircle2 size={18} />
                    {success}
                    <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400/60 hover:text-emerald-400">✕</button>
                </div>
            )}

            {/* Main Status Card */}
            <Card className={`bg-slate-800/50 border-slate-700/50 border-l-4 ${isActive ? 'border-l-emerald-500' : 'border-l-slate-600'} overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-5 ${isActive ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                <CardContent className="pt-8 pb-8 relative">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${isActive ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30' : 'bg-slate-700/50 border border-slate-600/50'}`}>
                            {isActive ? (
                                <Lock className="text-emerald-400" size={36} />
                            ) : (
                                <Unlock className="text-slate-500" size={36} />
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <StatusPulse active={isActive} />
                                <h3 className="text-xl font-bold text-white">
                                    {isActive ? 'Encryption Active' : 'Encryption Inactive'}
                                </h3>
                            </div>
                            <p className="text-slate-400 text-sm">
                                {isActive
                                    ? 'All sensitive fields are encrypted at rest using AES-256-GCM authenticated encryption.'
                                    : 'Field-level encryption is not enabled. Sensitive data is stored as plaintext.'}
                            </p>
                            {status?.organization && (
                                <div className="flex items-center gap-2 mt-3">
                                    <Building2 className="text-slate-500" size={14} />
                                    <span className="text-xs text-slate-500">Organization: <span className="text-slate-400 font-medium">{status.organization}</span></span>
                                </div>
                            )}
                        </div>
                        <Badge className={`px-4 py-2 text-sm font-bold ${isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}>
                            {isActive ? 'PROTECTED' : 'UNPROTECTED'}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Shield className="text-cyan-400" size={22} />
                            <Badge className={`${isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        <h3 className="font-bold text-white">Algorithm</h3>
                        <p className="text-xs text-slate-500 mt-1">AES-256-GCM · Authenticated</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Key className="text-amber-400" size={22} />
                            <Badge className={`${hasKey ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {hasKey ? 'Generated' : 'None'}
                            </Badge>
                        </div>
                        <h3 className="font-bold text-white">Encryption Key</h3>
                        <p className="text-xs text-slate-500 mt-1">256-bit · Per-organization</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Zap className="text-violet-400" size={22} />
                            <Badge className={`${status?.addon_entitled ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {status?.addon_entitled ? 'Licensed' : 'Not Licensed'}
                            </Badge>
                        </div>
                        <h3 className="font-bold text-white">Add-on License</h3>
                        <p className="text-xs text-slate-500 mt-1">{status?.plan || 'No plan'}</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Building2 className="text-blue-400" size={22} />
                            <span className="text-xl font-black text-white tabular-nums">{orgs.length}</span>
                        </div>
                        <h3 className="font-bold text-white">Organizations</h3>
                        <p className="text-xs text-slate-500 mt-1">Total registered instances</p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controls */}
                <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-cyan-400" size={20} />
                            <CardTitle className="text-white text-lg">Encryption Controls</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500">Manage encryption for your organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Organization Selector */}
                        {orgs.length > 0 && (
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Target Organization</label>
                                <select
                                    value={selectedOrgId}
                                    onChange={(e) => setSelectedOrgId(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                                >
                                    {orgs.map(org => (
                                        <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3 pt-2">
                            {!isActive ? (
                                <button
                                    onClick={handleActivate}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold transition-all duration-200 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading === 'activate' ? (
                                        <RefreshCw className="animate-spin" size={18} />
                                    ) : (
                                        <Lock size={18} />
                                    )}
                                    Activate AES-256 Encryption
                                </button>
                            ) : (
                                <button
                                    onClick={handleDeactivate}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading === 'deactivate' ? (
                                        <RefreshCw className="animate-spin" size={18} />
                                    ) : (
                                        <Unlock size={18} />
                                    )}
                                    Deactivate Encryption
                                </button>
                            )}

                            {isActive && hasKey && (
                                <button
                                    onClick={handleRotateKey}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading === 'rotate' ? (
                                        <RefreshCw className="animate-spin" size={18} />
                                    ) : (
                                        <RotateCcw size={18} />
                                    )}
                                    Rotate Encryption Key
                                </button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* How It Works */}
                <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <Info className="text-blue-400" size={20} />
                            <CardTitle className="text-white text-lg">How It Works</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500">AES-256-GCM authenticated encryption</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            {[
                                { icon: Key, color: 'text-amber-400', bg: 'bg-amber-500/10', title: '256-bit Key', desc: 'Unique key generated per organization' },
                                { icon: Lock, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Encrypt on Write', desc: 'Sensitive fields encrypted before saving to database' },
                                { icon: Unlock, color: 'text-cyan-400', bg: 'bg-cyan-500/10', title: 'Decrypt on Read', desc: 'Transparently decrypted when accessed by authorized users' },
                                { icon: ShieldCheck, color: 'text-violet-400', bg: 'bg-violet-500/10', title: 'Tamper Detection', desc: 'GCM mode detects any unauthorized data modification' },
                                { icon: RotateCcw, color: 'text-blue-400', bg: 'bg-blue-500/10', title: 'Key Rotation', desc: 'Rotate keys without downtime or data loss' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 py-2">
                                    <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                                        <item.icon className={item.color} size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-white">{item.title}</h4>
                                        <p className="text-xs text-slate-500">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Demo Toggle */}
                        <button
                            onClick={toggleDemo}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 text-slate-400 hover:text-white text-sm font-medium transition-all"
                        >
                            {showDemo ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showDemo ? 'Hide' : 'Show'} Encryption Demo
                        </button>
                    </CardContent>
                </Card>
            </div>

            {/* Demo Panel */}
            {showDemo && demoData && (
                <Card className="bg-slate-800/50 border-slate-700/50 border-l-4 border-l-cyan-500 animate-in slide-in-from-top duration-300">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <Eye className="text-cyan-400" size={20} />
                            <CardTitle className="text-white text-lg">Encryption Demo</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500">See how AES-256 encryption transforms your data</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-2">Original Data</div>
                                <div className="font-mono text-white text-sm bg-slate-800/50 rounded-lg p-3">{demoData.original}</div>
                            </div>
                            <div className="rounded-xl bg-slate-900/50 border border-red-500/20 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-2">Stored in DB (Encrypted)</div>
                                <div className="font-mono text-red-400/80 text-xs bg-slate-800/50 rounded-lg p-3 break-all">{demoData.encrypted}</div>
                            </div>
                            <div className="rounded-xl bg-slate-900/50 border border-amber-500/20 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">Display (Masked)</div>
                                <div className="font-mono text-amber-400 text-sm bg-slate-800/50 rounded-lg p-3">{demoData.masked}</div>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                            <p className="text-xs text-cyan-400/80">
                                <strong>Flow:</strong> User enters plaintext → EncryptedCharField encrypts with org key → Database stores ciphertext → On read, decrypts transparently → UI can optionally mask for display
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Security Footer */}
            <div className="flex items-center gap-3 py-4 px-5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <Shield className="text-slate-600" size={16} />
                <p className="text-xs text-slate-600">
                    Encryption uses <span className="text-slate-500 font-medium">AES-256-GCM</span> with per-organization keys.
                    Data is encrypted at rest in the database. TLS 1.3 protects data in transit.
                </p>
            </div>
        </div>
    )
}
