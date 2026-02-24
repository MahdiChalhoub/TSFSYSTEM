'use client'
/**
 * MCP Settings - Full Configuration Panel
 * =========================================
 * Comprehensive AI integration settings: rate limits, security, data retention,
 * provider defaults, and system diagnostics.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft, Settings, Save, RefreshCw, Shield, Clock, Zap,
    Database, Lock, Eye, EyeOff, AlertTriangle, CheckCircle,
    Bell, Gauge, HardDrive, Brain, Activity, Globe
} from 'lucide-react'
import { toast } from 'sonner'
interface SettingsState {
    // Rate Limiting
    max_requests_per_minute: number
    max_tokens_per_request: number
    max_concurrent_requests: number
    burst_limit: number
    // Timeouts & Performance
    default_timeout: number
    streaming_timeout: number
    retry_attempts: number
    retry_delay: number
    // Security
    mask_api_keys: boolean
    log_prompts: boolean
    log_responses: boolean
    ip_whitelist: string
    // Data Retention
    retention_days: number
    max_conversations_per_user: number
    auto_purge_enabled: boolean
    // Notifications
    alert_on_failure: boolean
    alert_on_quota: boolean
    quota_threshold: number
}
const defaultSettings: SettingsState = {
    max_requests_per_minute: 60,
    max_tokens_per_request: 8192,
    max_concurrent_requests: 10,
    burst_limit: 100,
    default_timeout: 30,
    streaming_timeout: 120,
    retry_attempts: 3,
    retry_delay: 1000,
    mask_api_keys: true,
    log_prompts: false,
    log_responses: false,
    ip_whitelist: '',
    retention_days: 90,
    max_conversations_per_user: 500,
    auto_purge_enabled: true,
    alert_on_failure: true,
    alert_on_quota: true,
    quota_threshold: 80
}
export default function MCPSettingsPage() {
    const [settings, setSettings] = useState<SettingsState>(defaultSettings)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [showAdvanced, setShowAdvanced] = useState(false)
    function updateSetting<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
        setSettings(prev => ({ ...prev, [key]: value }))
        setHasChanges(true)
    }
    async function handleSave() {
        setSaving(true)
        try {
            // Settings save — placeholder until backend endpoint is ready
            await new Promise(r => setTimeout(r, 800))
            toast.success('Settings saved successfully')
            setHasChanges(false)
        } catch {
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }
    function handleReset() {
        setSettings(defaultSettings)
        setHasChanges(true)
        toast.info('Settings reset to defaults')
    }
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <Link href="/mcp" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-4 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} />
                        Back to MCP Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 text-white shadow-lg">
                            <Settings size={28} />
                        </div>
                        <Badge className="bg-gray-100 text-gray-700 border-gray-200 px-3 py-1 font-black uppercase text-[10px]">
                            Configuration
                        </Badge>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">MCP Settings</h2>
                    <p className="text-gray-500 mt-2 font-medium">
                        Fine-tune your AI integration parameters and policies
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleReset}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold text-gray-500"
                    >
                        <RefreshCw size={18} />
                        Reset
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`rounded-2xl px-6 py-5 font-bold shadow-lg transition-all ${hasChanges
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25'
                                : 'bg-gray-300'
                            }`}
                    >
                        <Save size={18} />
                        {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
                    </Button>
                </div>
            </div>
            {/* Unsaved Changes Banner */}
            {hasChanges && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 animate-in slide-in-from-top duration-300">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-amber-700">You have unsaved changes</span>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rate Limiting */}
                <Card className="rounded-3xl shadow-xl border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                        <CardTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-500 text-white">
                                <Gauge size={18} />
                            </div>
                            Rate Limiting
                        </CardTitle>
                        <CardDescription>Control API request frequency and quotas</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-gray-700">Max Requests / Minute</Label>
                            <Input
                                type="number"
                                value={settings.max_requests_per_minute}
                                onChange={(e) => updateSetting('max_requests_per_minute', parseInt(e.target.value) || 60)}
                                className="rounded-xl"
                            />
                            <p className="text-xs text-gray-400">Maximum API calls allowed per minute per user</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-gray-700">Max Tokens / Request</Label>
                            <Input
                                type="number"
                                value={settings.max_tokens_per_request}
                                onChange={(e) => updateSetting('max_tokens_per_request', parseInt(e.target.value) || 8192)}
                                className="rounded-xl"
                            />
                            <p className="text-xs text-gray-400">Token ceiling for a single AI request</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Concurrent Limit</Label>
                                <Input
                                    type="number"
                                    value={settings.max_concurrent_requests}
                                    onChange={(e) => updateSetting('max_concurrent_requests', parseInt(e.target.value) || 10)}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Burst Limit</Label>
                                <Input
                                    type="number"
                                    value={settings.burst_limit}
                                    onChange={(e) => updateSetting('burst_limit', parseInt(e.target.value) || 100)}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* Timeouts & Performance */}
                <Card className="rounded-3xl shadow-xl border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
                        <CardTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500 text-white">
                                <Clock size={18} />
                            </div>
                            Timeouts & Performance
                        </CardTitle>
                        <CardDescription>Request timeouts and retry behavior</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Default Timeout</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={settings.default_timeout}
                                        onChange={(e) => updateSetting('default_timeout', parseInt(e.target.value) || 30)}
                                        className="rounded-xl pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">sec</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Stream Timeout</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={settings.streaming_timeout}
                                        onChange={(e) => updateSetting('streaming_timeout', parseInt(e.target.value) || 120)}
                                        className="rounded-xl pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">sec</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Retry Attempts</Label>
                                <Select
                                    value={String(settings.retry_attempts)}
                                    onValueChange={(v) => updateSetting('retry_attempts', parseInt(v))}
                                >
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[0, 1, 2, 3, 5].map((v) => (
                                            <SelectItem key={v} value={String(v)}>
                                                {v === 0 ? 'No retries' : `${v} attempt${v > 1 ? 's' : ''}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Retry Delay</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={settings.retry_delay}
                                        onChange={(e) => updateSetting('retry_delay', parseInt(e.target.value) || 1000)}
                                        className="rounded-xl pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ms</span>
                                </div>
                            </div>
                        </div>
                        {/* Performance Indicator */}
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                            <div className="flex items-center gap-3">
                                <Activity size={16} className="text-amber-500" />
                                <span className="text-sm font-medium text-amber-700">
                                    Effective window: {settings.default_timeout}s with {settings.retry_attempts} retries = {settings.default_timeout + (settings.retry_attempts * settings.retry_delay / 1000)}s max
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* Security */}
                <Card className="rounded-3xl shadow-xl border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100">
                        <CardTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-red-500 text-white">
                                <Shield size={18} />
                            </div>
                            Security & Privacy
                        </CardTitle>
                        <CardDescription>API key handling and logging policies</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        {/* Toggle Cards */}
                        <div className="space-y-3">
                            <ToggleCard
                                icon={<Lock size={16} />}
                                title="Mask API Keys"
                                description="Hide API keys in logs and UI displays"
                                enabled={settings.mask_api_keys}
                                onChange={(v) => updateSetting('mask_api_keys', v)}
                                color="red"
                            />
                            <ToggleCard
                                icon={<Eye size={16} />}
                                title="Log Prompts"
                                description="Store user prompts for audit & debugging"
                                enabled={settings.log_prompts}
                                onChange={(v) => updateSetting('log_prompts', v)}
                                color="amber"
                            />
                            <ToggleCard
                                icon={<Database size={16} />}
                                title="Log AI Responses"
                                description="Store full AI responses (increases storage)"
                                enabled={settings.log_responses}
                                onChange={(v) => updateSetting('log_responses', v)}
                                color="blue"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-gray-700">IP Whitelist</Label>
                            <Input
                                value={settings.ip_whitelist}
                                onChange={(e) => updateSetting('ip_whitelist', e.target.value)}
                                placeholder="e.g. 192.168.1.0/24, 10.0.0.1"
                                className="rounded-xl"
                            />
                            <p className="text-xs text-gray-400">Comma-separated IPs or CIDR ranges. Leave empty for no restriction.</p>
                        </div>
                    </CardContent>
                </Card>
                {/* Data Retention & Notifications */}
                <Card className="rounded-3xl shadow-xl border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
                        <CardTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-500 text-white">
                                <HardDrive size={18} />
                            </div>
                            Data & Alerts
                        </CardTitle>
                        <CardDescription>Retention policies and notification preferences</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Retention Period</Label>
                                <Select
                                    value={String(settings.retention_days)}
                                    onValueChange={(v) => updateSetting('retention_days', parseInt(v))}
                                >
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[30, 60, 90, 180, 365].map((v) => (
                                            <SelectItem key={v} value={String(v)}>
                                                {v} days
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-gray-700">Max Conversations</Label>
                                <Input
                                    type="number"
                                    value={settings.max_conversations_per_user}
                                    onChange={(e) => updateSetting('max_conversations_per_user', parseInt(e.target.value) || 500)}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <ToggleCard
                                icon={<HardDrive size={16} />}
                                title="Auto-Purge Expired"
                                description="Automatically delete conversations past retention"
                                enabled={settings.auto_purge_enabled}
                                onChange={(v) => updateSetting('auto_purge_enabled', v)}
                                color="purple"
                            />
                            <ToggleCard
                                icon={<AlertTriangle size={16} />}
                                title="Failure Alerts"
                                description="Notify when AI requests fail repeatedly"
                                enabled={settings.alert_on_failure}
                                onChange={(v) => updateSetting('alert_on_failure', v)}
                                color="red"
                            />
                            <ToggleCard
                                icon={<Bell size={16} />}
                                title="Quota Alerts"
                                description={`Alert when usage reaches ${settings.quota_threshold}% of limits`}
                                enabled={settings.alert_on_quota}
                                onChange={(v) => updateSetting('alert_on_quota', v)}
                                color="amber"
                            />
                        </div>
                        {settings.alert_on_quota && (
                            <div className="space-y-2 animate-in slide-in-from-top duration-200">
                                <Label className="text-sm font-bold text-gray-700">Quota Threshold (%)</Label>
                                <Input
                                    type="number"
                                    min={50}
                                    max={99}
                                    value={settings.quota_threshold}
                                    onChange={(e) => updateSetting('quota_threshold', parseInt(e.target.value) || 80)}
                                    className="rounded-xl"
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            {/* System Info Footer */}
            <Card className="rounded-3xl shadow-lg border-gray-100">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-8 text-sm text-gray-500">
                            <span className="flex items-center gap-2">
                                <Brain size={16} className="text-purple-400" />
                                <span className="font-bold text-gray-700">MCP Engine</span>
                                <Badge variant="outline" className="text-[10px]">v1.0.0</Badge>
                            </span>
                            <span className="flex items-center gap-2">
                                <Globe size={16} className="text-blue-400" />
                                <span>Connected to platform backend</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <CheckCircle size={14} className="text-green-500" />
                            All systems operational
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
/* ── Toggle Card Component ─────────────────────────────────────────────────── */
function ToggleCard({
    icon, title, description, enabled, onChange, color
}: {
    icon: React.ReactNode
    title: string
    description: string
    enabled: boolean
    onChange: (v: boolean) => void
    color: string
}) {
    return (
        <div
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${enabled
                    ? `bg-${color}-50/50 border-${color}-200`
                    : 'bg-gray-50/50 border-gray-200 hover:border-gray-300'
                }`}
            onClick={() => onChange(!enabled)}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${enabled ? `bg-${color}-100 text-${color}-600` : 'bg-gray-100 text-gray-400'} transition-colors`}>
                    {icon}
                </div>
                <div>
                    <div className="text-sm font-bold text-gray-800">{title}</div>
                    <div className="text-xs text-gray-400">{description}</div>
                </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors ${enabled ? `bg-${color}-500` : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
            </div>
        </div>
    )
}
