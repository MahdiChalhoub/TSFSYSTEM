'use client'

import { useState, useEffect, useTransition } from "react"
import { getNotificationPreferences, updateNotificationPreference, getDeliveryLog } from "@/app/actions/notifications"
import { toast } from "sonner"
import {
    Bell, Mail, Smartphone, Zap, FileText, Package,
    CreditCard, Settings, Clock, CheckCircle2, XCircle,
    AlertTriangle, TrendingUp, RefreshCw
} from "lucide-react"

const CHANNEL_ICONS: Record<string, { icon: any; label: string }> = {
    IN_APP: { icon: Bell, label: 'In-App' },
    EMAIL: { icon: Mail, label: 'Email' },
}

const TYPE_ICONS: Record<string, { icon: any; color: string }> = {
    invoice_overdue: { icon: AlertTriangle, color: 'text-red-500' },
    invoice_paid: { icon: CheckCircle2, color: 'text-emerald-500' },
    stock_alert: { icon: Package, color: 'text-orange-500' },
    po_approved: { icon: FileText, color: 'text-blue-500' },
    po_received: { icon: TrendingUp, color: 'text-indigo-500' },
    payment_received: { icon: CreditCard, color: 'text-emerald-600' },
    system_update: { icon: Settings, color: 'text-app-muted-foreground' },
    daily_digest: { icon: Clock, color: 'text-purple-500' },
}

export default function NotificationPreferencesPage() {
    const [prefs, setPrefs] = useState<Record<string, any>>({})
    const [log, setLog] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [p, l] = await Promise.all([
                getNotificationPreferences(),
                getDeliveryLog(),
            ])
            setPrefs(p || {})
            setLog(Array.isArray(l) ? l : [])
        } catch {
            toast.error("Failed to load preferences")
        } finally { setLoading(false) }
    }

    function handleToggle(ntype: string, channel: string, currentValue: boolean) {
        // Optimistic update
        setPrefs(prev => ({
            ...prev,
            [ntype]: {
                ...prev[ntype],
                channels: { ...prev[ntype]?.channels, [channel]: !currentValue }
            }
        }))

        startTransition(async () => {
            try {
                await updateNotificationPreference(ntype, channel, !currentValue)
                toast.success(`${channel === 'EMAIL' ? 'Email' : 'In-app'} ${!currentValue ? 'enabled' : 'disabled'}`)
            } catch {
                // Revert on failure
                setPrefs(prev => ({
                    ...prev,
                    [ntype]: {
                        ...prev[ntype],
                        channels: { ...prev[ntype]?.channels, [channel]: currentValue }
                    }
                }))
                toast.error("Failed to update preference")
            }
        })
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
                <div className="h-10 w-64 bg-app-surface-2 rounded-xl animate-pulse" />
                <div className="h-96 bg-app-surface-2 rounded-3xl animate-pulse" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-app-foreground tracking-tighter">
                    Notification <span className="text-violet-500">Preferences</span>
                </h1>
                <p className="text-sm text-app-muted-foreground mt-1">
                    Control how and when you receive notifications across channels
                </p>
            </div>

            {/* Preferences Grid */}
            <div className="bg-app-surface rounded-3xl shadow-xl border border-app-border overflow-hidden">
                <div className="p-6 border-b border-app-border bg-[#F8FAFC]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black text-app-muted-foreground uppercase tracking-widest">Channel Settings</h2>
                        <div className="flex gap-6">
                            {Object.entries(CHANNEL_ICONS).map(([channel, { icon: Icon, label }]) => (
                                <div key={channel} className="flex items-center gap-1.5 text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    <Icon size={14} />
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-gray-50">
                    {Object.entries(prefs).map(([ntype, data]: [string, any]) => {
                        const typeIcon = TYPE_ICONS[ntype] || { icon: Bell, color: 'text-app-muted-foreground' }
                        const TypeIcon = typeIcon.icon
                        return (
                            <div key={ntype} className="p-6 flex items-center justify-between hover:bg-app-surface/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl bg-app-surface ${typeIcon.color}`}>
                                        <TypeIcon size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-app-foreground text-sm">{data.label || ntype}</h3>
                                        <p className="text-[10px] text-app-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                            {ntype.replace(/_/g, ' ')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    {Object.entries(CHANNEL_ICONS).map(([channel]) => {
                                        const isEnabled = data.channels?.[channel] ?? false
                                        return (
                                            <button
                                                key={channel}
                                                onClick={() => handleToggle(ntype, channel, isEnabled)}
                                                disabled={isPending}
                                                className={`w-12 h-7 rounded-full transition-all relative ${isEnabled
                                                        ? 'bg-violet-500 shadow-inner shadow-violet-600'
                                                        : 'bg-app-surface-2'
                                                    }`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-app-surface shadow transition-all ${isEnabled ? 'left-6' : 'left-1'
                                                    }`} />
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                    {Object.keys(prefs).length === 0 && (
                        <div className="p-16 text-center text-app-muted-foreground italic">
                            No notification types configured yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Delivery Log */}
            <div className="bg-app-surface rounded-3xl shadow-xl border border-app-border overflow-hidden">
                <div className="p-6 border-b border-app-border bg-[#F8FAFC] flex items-center justify-between">
                    <h2 className="text-sm font-black text-app-muted-foreground uppercase tracking-widest">Recent Deliveries</h2>
                    <button onClick={loadData} className="text-app-muted-foreground hover:text-violet-500 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
                <div className="divide-y divide-gray-50">
                    {log.length === 0 ? (
                        <div className="p-12 text-center text-app-muted-foreground italic text-sm">
                            No delivery history yet.
                        </div>
                    ) : (
                        log.map((entry: any) => (
                            <div key={entry.id} className="p-4 px-6 flex items-center gap-4 hover:bg-app-surface/50 transition-colors">
                                <div className={`p-2 rounded-lg ${entry.status === 'SENT' || entry.status === 'DELIVERED'
                                        ? 'bg-emerald-50 text-emerald-500'
                                        : entry.status === 'FAILED'
                                            ? 'bg-red-50 text-red-500'
                                            : 'bg-app-surface text-app-muted-foreground'
                                    }`}>
                                    {entry.channel === 'EMAIL' ? <Mail size={14} /> : <Bell size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-app-foreground truncate">{entry.subject}</p>
                                    <p className="text-[10px] text-app-muted-foreground mt-0.5">
                                        {entry.channel} • {entry.created_at ? new Date(entry.created_at).toLocaleString('fr-FR') : '—'}
                                    </p>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${entry.status === 'SENT' || entry.status === 'DELIVERED'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : entry.status === 'FAILED'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-app-surface-2 text-app-muted-foreground'
                                    }`}>
                                    {entry.status}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
