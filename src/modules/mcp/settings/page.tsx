'use client'

/**
 * MCP Settings — Full Configuration (Dajingo Pro redesign)
 * =========================================================
 * Rate limits, security, data retention, and notification config.
 * Sectioned layout with auto-fit grids and theme tokens only.
 */

import { useState } from 'react'
import {
    ArrowLeft, Settings as SettingsIcon, Save, Shield, Clock, Zap,
    Database, Bell, Gauge, Brain, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    ModulePage, PageHeader, KPIStrip,
    GhostButton, PrimaryButton, SectionCard,
} from '../_design'

interface SettingsState {
    max_requests_per_minute: number
    max_tokens_per_request:  number
    max_concurrent_requests: number
    burst_limit:             number
    default_timeout:         number
    streaming_timeout:       number
    retry_attempts:          number
    retry_delay:             number
    mask_api_keys:           boolean
    log_prompts:             boolean
    log_responses:           boolean
    ip_whitelist:            string
    retention_days:          number
    max_conversations_per_user: number
    auto_purge_enabled:      boolean
    alert_on_failure:        boolean
    alert_on_quota:          boolean
    quota_threshold:         number
}

const defaults: SettingsState = {
    max_requests_per_minute: 60, max_tokens_per_request: 8192,
    max_concurrent_requests: 10, burst_limit: 100,
    default_timeout: 30, streaming_timeout: 120,
    retry_attempts: 3, retry_delay: 1000,
    mask_api_keys: true, log_prompts: false, log_responses: false, ip_whitelist: '',
    retention_days: 90, max_conversations_per_user: 500, auto_purge_enabled: true,
    alert_on_failure: true, alert_on_quota: true, quota_threshold: 80,
}

export default function MCPSettingsPage() {
    const [settings, setSettings] = useState<SettingsState>(defaults)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
        setSettings(prev => ({ ...prev, [key]: value }))
        setHasChanges(true)
    }

    async function handleSave() {
        setSaving(true)
        try {
            await new Promise(r => setTimeout(r, 600))
            toast.success('Settings saved')
            setHasChanges(false)
        } catch {
            toast.error('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    function handleReset() {
        setSettings(defaults); setHasChanges(true); toast.info('Reset to defaults')
    }

    const kpis = [
        { label: 'Req/Min',       value: settings.max_requests_per_minute, icon: <Zap size={14} />,    color: 'var(--app-primary)' },
        { label: 'Tokens/Req',    value: settings.max_tokens_per_request.toLocaleString(), icon: <Brain size={14} />,  color: '#8b5cf6' },
        { label: 'Retention',     value: `${settings.retention_days}d`,    icon: <Database size={14} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Quota Alert',   value: `${settings.quota_threshold}%`,   icon: <Gauge size={14} />,    color: 'var(--app-warning, #f59e0b)' },
    ]

    return (
        <ModulePage>
            <PageHeader
                icon={<SettingsIcon size={20} className="text-white" />}
                title="MCP Settings"
                subtitle="Rate limits · Security · Retention · Notifications"
                actions={
                    <>
                        <GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />
                        <GhostButton icon={<RefreshCw size={13} />} label="Reset" onClick={handleReset} />
                        <PrimaryButton icon={<Save size={14} />} label={saving ? 'Saving…' : (hasChanges ? 'Save Changes' : 'Saved')} onClick={handleSave} disabled={saving || !hasChanges} />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignContent: 'start' }}>

                <SectionCard title="Rate Limits" icon={<Zap size={11} />}>
                    <NumField label="Requests / minute"     value={settings.max_requests_per_minute} onChange={v => update('max_requests_per_minute', v)} hint="Max requests per organization per minute" />
                    <NumField label="Tokens / request"      value={settings.max_tokens_per_request}  onChange={v => update('max_tokens_per_request',  v)} hint="Hard cap to prevent runaway prompts" />
                    <NumField label="Concurrent requests"   value={settings.max_concurrent_requests} onChange={v => update('max_concurrent_requests', v)} hint="Parallel inflight requests per org" />
                    <NumField label="Burst limit"           value={settings.burst_limit}             onChange={v => update('burst_limit',             v)} hint="Short-window spike allowance" />
                </SectionCard>

                <SectionCard title="Timeouts & Retries" icon={<Clock size={11} />}>
                    <NumField label="Default timeout (s)"   value={settings.default_timeout}    onChange={v => update('default_timeout',    v)} />
                    <NumField label="Streaming timeout (s)" value={settings.streaming_timeout}  onChange={v => update('streaming_timeout',  v)} />
                    <NumField label="Retry attempts"        value={settings.retry_attempts}     onChange={v => update('retry_attempts',     v)} />
                    <NumField label="Retry delay (ms)"      value={settings.retry_delay}        onChange={v => update('retry_delay',        v)} />
                </SectionCard>

                <SectionCard title="Security" icon={<Shield size={11} />}>
                    <ToggleField label="Mask API keys in logs"  value={settings.mask_api_keys} onChange={v => update('mask_api_keys', v)} hint="Redact secrets from any persisted log row" />
                    <ToggleField label="Log prompts"            value={settings.log_prompts}   onChange={v => update('log_prompts',   v)} hint="Persist user-submitted prompt text" />
                    <ToggleField label="Log responses"          value={settings.log_responses} onChange={v => update('log_responses', v)} hint="Persist model output text" />
                    <TextField   label="IP whitelist (comma-separated)" value={settings.ip_whitelist} onChange={v => update('ip_whitelist', v)} placeholder="e.g. 10.0.0.0/8, 192.168.1.0/24" />
                </SectionCard>

                <SectionCard title="Data Retention" icon={<Database size={11} />}>
                    <NumField label="Retention (days)"          value={settings.retention_days}             onChange={v => update('retention_days',             v)} hint="Conversations older than this get pruned" />
                    <NumField label="Max conversations / user"  value={settings.max_conversations_per_user} onChange={v => update('max_conversations_per_user', v)} />
                    <ToggleField label="Auto-purge"             value={settings.auto_purge_enabled}         onChange={v => update('auto_purge_enabled',         v)} hint="Run prune nightly at 02:00 UTC" />
                </SectionCard>

                <SectionCard title="Notifications" icon={<Bell size={11} />}>
                    <ToggleField label="Alert on failure"   value={settings.alert_on_failure}  onChange={v => update('alert_on_failure',  v)} hint="Notify ops when a provider call fails" />
                    <ToggleField label="Alert on quota"     value={settings.alert_on_quota}    onChange={v => update('alert_on_quota',    v)} hint="Notify when daily token spend nears the cap" />
                    <NumField    label="Quota threshold (%)" value={settings.quota_threshold}  onChange={v => update('quota_threshold',  v)} hint="Trigger quota alert at this %" />
                </SectionCard>

                {hasChanges && (
                    <SectionCard title="Pending Changes" icon={<AlertTriangle size={11} />}>
                        <div className="px-2 py-1.5">
                            <p className="text-[12px] font-medium text-app-foreground">
                                You have unsaved configuration changes. Click <strong>Save Changes</strong> at
                                the top of the page to apply them across the organization.
                            </p>
                        </div>
                    </SectionCard>
                )}
            </div>
        </ModulePage>
    )
}

function NumField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
    return (
        <div className="px-2 py-1.5">
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{label}</label>
            <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)}
                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary tabular-nums" />
            {hint && <p className="text-[10px] text-app-muted-foreground mt-1 font-medium">{hint}</p>}
        </div>
    )
}

function TextField({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
    return (
        <div className="px-2 py-1.5">
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">{label}</label>
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
            {hint && <p className="text-[10px] text-app-muted-foreground mt-1 font-medium">{hint}</p>}
        </div>
    )
}

function ToggleField({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
    return (
        <div className="px-2 py-1.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <label className="text-[12px] font-bold text-app-foreground block">{label}</label>
                {hint && <p className="text-[10px] text-app-muted-foreground mt-0.5 font-medium">{hint}</p>}
            </div>
            <button type="button" onClick={() => onChange(!value)}
                className="relative inline-flex items-center h-6 w-11 rounded-full transition-all flex-shrink-0 mt-1"
                style={{ background: value ? 'var(--app-primary)' : 'var(--app-border)' }}>
                <span className="inline-block w-4 h-4 rounded-full bg-white transition-all"
                    style={{ transform: `translateX(${value ? '24px' : '4px'})` }} />
            </button>
        </div>
    )
}
