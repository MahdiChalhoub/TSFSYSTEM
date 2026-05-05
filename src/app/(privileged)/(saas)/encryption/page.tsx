'use client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Shield, Lock, Unlock, Key, RefreshCw, AlertTriangle,
    CheckCircle2, XCircle, RotateCcw, Building2, Zap,
    ShieldCheck, ShieldOff, Eye, EyeOff, Info
} from "lucide-react"
import { getOrganizations, getEncryptionStatus, activateEncryption, deactivateEncryption, rotateEncryptionKey } from './actions'

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
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${active ? 'bg-app-primary' : 'bg-app-surface-hover'}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${active ? 'bg-app-primary' : 'bg-app-surface-2'}`} />
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
    const [showRotateConfirm, setShowRotateConfirm] = useState(false)

    // Load organizations
    const fetchOrgs = useCallback(async () => {
        try {
            const orgList = await getOrganizations()
            setOrgs(orgList)
            if (orgList.length > 0 && !selectedOrgId) {
                setSelectedOrgId(orgList[0].id)
            }
        } catch (e: unknown) {
            console.error('Failed to load orgs:', e)
        }
    }, [selectedOrgId])

    // Load encryption status
    const fetchStatus = useCallback(async () => {
        try {
            const data = await getEncryptionStatus()
            setStatus(data)
            setError(null)
        } catch (e: unknown) {
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
            const result = await activateEncryption(selectedOrgId)
            if (result.success) {
                setSuccess(result.message || 'Encryption activated!')
                fetchStatus()
            } else {
                setError(result.error || 'Failed to activate encryption')
            }
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || 'Failed to activate encryption')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDeactivate = async () => {
        setActionLoading('deactivate')
        setError(null)
        setSuccess(null)
        try {
            const result = await deactivateEncryption(selectedOrgId)
            if (result.success) {
                setSuccess(result.message || 'Encryption deactivated')
                fetchStatus()
            } else {
                setError(result.error || 'Failed to deactivate')
            }
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || 'Failed to deactivate')
        } finally {
            setActionLoading(null)
        }
    }

    const handleRotateKey = async () => {
        setActionLoading('rotate')
        setError(null)
        setSuccess(null)
        try {
            const result = await rotateEncryptionKey(selectedOrgId)
            if (result.success) {
                setSuccess(result.message || 'Key rotated successfully')
                fetchStatus()
            } else {
                setError(result.error || 'Failed to rotate key')
            }
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || 'Failed to rotate key')
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
                    <Shield className="animate-pulse text-app-info mx-auto mb-4" size={48} />
                    <p className="text-app-muted-foreground text-sm">Loading encryption status...</p>
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
                    <h2 className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-info flex items-center justify-center">
                            <Shield className="text-white" size={22} />
                        </div>
                        AES-256 Encryption
                    </h2>
                    <p className="text-app-muted-foreground mt-2 font-medium">Field-level encryption for sensitive data · Per-organization key management</p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="p-2.5 rounded-xl bg-app-surface hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all border border-app-border shadow-sm"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="p-4 bg-app-error-bg border border-app-error rounded-xl text-app-error text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <AlertTriangle size={18} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-app-error hover:text-app-error">✕</button>
                </div>
            )}
            {success && (
                <div className="p-4 bg-app-success-bg border border-app-success rounded-xl text-app-success text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <CheckCircle2 size={18} />
                    {success}
                    <button onClick={() => setSuccess(null)} className="ml-auto text-app-success hover:text-app-success">✕</button>
                </div>
            )}

            {/* Main Status Card */}
            <Card className={`bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden border-l-4 ${isActive ? 'border-l-emerald-500' : 'border-l-gray-300'}`}>
                <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-5 ${isActive ? 'bg-app-primary' : 'bg-app-surface-hover'}`} />
                <CardContent className="pt-8 pb-8 relative">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${isActive ? 'bg-app-primary-soft border border-app-success' : 'bg-app-surface border border-app-border'}`}>
                            {isActive ? (
                                <Lock className="text-app-success" size={36} />
                            ) : (
                                <Unlock className="text-app-muted-foreground" size={36} />
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <StatusPulse active={isActive} />
                                <h3>
                                    {isActive ? 'Encryption Active' : 'Encryption Inactive'}
                                </h3>
                            </div>
                            <p className="text-app-muted-foreground text-sm">
                                {isActive
                                    ? 'All sensitive fields are encrypted at rest using AES-256-GCM authenticated encryption.'
                                    : 'Field-level encryption is not enabled. Sensitive data is stored as plaintext.'}
                            </p>
                            {status?.organization && (
                                <div className="flex items-center gap-2 mt-3">
                                    <Building2 className="text-app-muted-foreground" size={14} />
                                    <span className="text-xs text-app-muted-foreground">Organization: <span className="text-app-muted-foreground font-medium">{status.organization}</span></span>
                                </div>
                            )}
                        </div>
                        <Badge className={`px-4 py-2 text-sm font-bold ${isActive
                            ? 'bg-app-success-bg text-app-success border-app-success'
                            : 'bg-app-surface text-app-muted-foreground border-app-border'}`}>
                            {isActive ? 'PROTECTED' : 'UNPROTECTED'}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Shield className="text-app-info" size={22} />
                            <Badge className={`${isActive ? 'bg-app-success-bg text-app-success border-app-success' : 'bg-app-surface text-app-muted-foreground border-app-border'}`}>
                                {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        <h3>Algorithm</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">AES-256-GCM · Authenticated</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Key className="text-app-warning" size={22} />
                            <Badge className={`${hasKey ? 'bg-app-warning-bg text-app-warning border-app-warning' : 'bg-app-surface text-app-muted-foreground border-app-border'}`}>
                                {hasKey ? 'Generated' : 'None'}
                            </Badge>
                        </div>
                        <h3>Encryption Key</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">256-bit · Per-organization</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Zap className="text-app-accent" size={22} />
                            <Badge className={`${status?.addon_entitled ? 'bg-app-accent-bg text-app-accent border-app-accent' : 'bg-app-surface text-app-muted-foreground border-app-border'}`}>
                                {status?.addon_entitled ? 'Licensed' : 'Not Licensed'}
                            </Badge>
                        </div>
                        <h3>Add-on License</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">{status?.plan || 'No plan'}</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Building2 className="text-app-info" size={22} />
                            <span className="text-xl font-black text-app-foreground tabular-nums">{orgs.length}</span>
                        </div>
                        <h3>Organizations</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">Total registered instances</p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controls */}
                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-app-info" size={20} />
                            <CardTitle className="text-app-foreground text-lg">Encryption Controls</CardTitle>
                        </div>
                        <CardDescription className="text-app-muted-foreground">Manage encryption for your organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Organization Selector */}
                        {orgs.length > 0 && (
                            <div>
                                <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-2 block">Target Organization</label>
                                <select
                                    value={selectedOrgId}
                                    onChange={(e) => setSelectedOrgId(e.target.value)}
                                    className="w-full bg-app-surface border border-app-border rounded-xl px-4 py-3 text-app-foreground text-sm focus:outline-none focus:border-app-info focus:ring-1 focus:ring-app-info/20 transition-all"
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
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-app-primary hover:brightness-110 text-white font-bold transition-all duration-200 shadow-lg shadow-app-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-app-surface-2 hover:bg-app-surface-2 border border-app-border text-app-muted-foreground font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    onClick={() => setShowRotateConfirm(true)}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-app-warning-bg hover:bg-app-warning-bg border border-app-warning text-app-warning font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <Info className="text-app-info" size={20} />
                            <CardTitle className="text-app-foreground text-lg">How It Works</CardTitle>
                        </div>
                        <CardDescription className="text-app-muted-foreground">AES-256-GCM authenticated encryption</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            {[
                                { icon: Key, color: 'text-app-warning', bg: 'bg-app-warning-bg', title: '256-bit Key', desc: 'Unique key generated per organization' },
                                { icon: Lock, color: 'text-app-success', bg: 'bg-app-success-bg', title: 'Encrypt on Write', desc: 'Sensitive fields encrypted before saving to database' },
                                { icon: Unlock, color: 'text-app-info', bg: 'bg-app-info-bg', title: 'Decrypt on Read', desc: 'Transparently decrypted when accessed by authorized users' },
                                { icon: ShieldCheck, color: 'text-app-accent', bg: 'bg-app-accent-bg', title: 'Tamper Detection', desc: 'GCM mode detects any unauthorized data modification' },
                                { icon: RotateCcw, color: 'text-app-info', bg: 'bg-app-info-bg', title: 'Key Rotation', desc: 'Rotate keys without downtime or data loss' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 py-2">
                                    <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                                        <item.icon className={item.color} size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-app-foreground">{item.title}</h4>
                                        <p className="text-xs text-app-muted-foreground">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Demo Toggle */}
                        <button
                            onClick={toggleDemo}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-app-surface hover:bg-app-surface-2 border border-app-border text-app-muted-foreground hover:text-app-foreground text-sm font-medium transition-all"
                        >
                            {showDemo ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showDemo ? 'Hide' : 'Show'} Encryption Demo
                        </button>
                    </CardContent>
                </Card>
            </div>

            {/* Demo Panel */}
            {showDemo && demoData && (
                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden border-l-4 border-l-cyan-500 animate-in slide-in-from-top duration-300">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <Eye className="text-app-info" size={20} />
                            <CardTitle className="text-app-foreground text-lg">Encryption Demo</CardTitle>
                        </div>
                        <CardDescription className="text-app-muted-foreground">See how AES-256 encryption transforms your data</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="rounded-xl bg-app-success-bg border border-app-success/60 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-app-success font-bold mb-2">Original Data</div>
                                <div className="font-mono text-app-foreground text-sm bg-app-surface rounded-lg p-3 border border-app-success">{demoData.original}</div>
                            </div>
                            <div className="rounded-xl bg-app-error-bg border border-app-error/60 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-app-error font-bold mb-2">Stored in DB (Encrypted)</div>
                                <div className="font-mono text-app-error text-xs bg-app-surface rounded-lg p-3 border border-app-error break-all">{demoData.encrypted}</div>
                            </div>
                            <div className="rounded-xl bg-app-warning-bg border border-app-warning/60 p-4">
                                <div className="text-[10px] uppercase tracking-widest text-app-warning font-bold mb-2">Display (Masked)</div>
                                <div className="font-mono text-app-warning text-sm bg-app-surface rounded-lg p-3 border border-app-warning">{demoData.masked}</div>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-app-info-bg border border-app-info/60 rounded-xl">
                            <p className="text-xs text-app-info">
                                <strong>Flow:</strong> User enters plaintext → EncryptedCharField encrypts with org key → Database stores ciphertext → On read, decrypts transparently → UI can optionally mask for display
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <ConfirmDialog
                open={showRotateConfirm}
                onOpenChange={(open) => { if (!open) setShowRotateConfirm(false) }}
                onConfirm={() => {
                    handleRotateKey()
                    setShowRotateConfirm(false)
                }}
                title="Rotate Encryption Key"
                description="Key rotation will re-encrypt ALL encrypted data with a new key. This operation cannot be undone. Are you sure you want to continue?"
                confirmText="Rotate Key"
                variant="warning"
            />

            {/* Security Footer */}
            <div className="flex items-center gap-3 py-4 px-5 rounded-xl bg-app-surface border border-app-border/60">
                <Shield className="text-app-muted-foreground" size={16} />
                <p className="text-xs text-app-muted-foreground">
                    Encryption uses <span className="text-app-muted-foreground font-medium">AES-256-GCM</span> with per-organization keys.
                    Data is encrypted at rest in the database. TLS 1.3 protects data in transit.
                </p>
            </div>
        </div>
    )
}
