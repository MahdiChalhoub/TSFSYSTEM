'use client'

import { useEffect, useState } from "react"
import { SaasPlan, SaasModule } from "@/types/erp"
import { useParams, useRouter } from "next/navigation"
import { getPlanDetail, updatePlan, togglePlanPublic, getModuleFeatures } from "./actions"
import { getSaaSModules } from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Globe, Lock, Loader2, Users, Building2, HardDrive, Package, FileText, UserCheck, Pencil, ChevronDown, ChevronRight, Clock } from "lucide-react"
import { toast } from "sonner"

export default function PlanDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const [plan, setPlan] = useState<SaasPlan | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState<'overview' | 'modules' | 'limits' | 'orgs'>('overview')
    const [editing, setEditing] = useState(false)
    const [availableModules, setAvailableModules] = useState<SaasModule[]>([])
    const [moduleFeatures, setModuleFeatures] = useState<Record<string, { name: string, features: { code: string, name: string, default: boolean }[] }>>({})
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

    // Editable state
    const [form, setForm] = useState({
        name: '', description: '', monthly_price: '0', annual_price: '0',
        is_public: true, sort_order: 0, trial_days: 0,
        modules: [] as string[],
        features: {} as Record<string, string[]>,
        limits: {} as Record<string, number>,
    })

    useEffect(() => { loadData() }, [id])

    async function loadData() {
        try {
            const [planData, modulesData, featuresData] = await Promise.all([
                getPlanDetail(id as string),
                getSaaSModules(),
                getModuleFeatures(),
            ])
            if (planData && !planData.error) {
                setPlan(planData)

                // Normalize features: old format might be a flat list, new format is {module: [features]}
                let normalizedFeatures: Record<string, string[]> = {}
                if (planData.features && typeof planData.features === 'object' && !Array.isArray(planData.features)) {
                    // Check if it's already the new format
                    const firstVal = Object.values(planData.features)[0]
                    if (Array.isArray(firstVal)) {
                        normalizedFeatures = planData.features
                    }
                }

                setForm({
                    name: planData.name || '',
                    description: planData.description || '',
                    monthly_price: planData.monthly_price || '0',
                    annual_price: planData.annual_price || '0',
                    is_public: planData.is_public ?? true,
                    sort_order: planData.sort_order || 0,
                    trial_days: planData.trial_days || 0,
                    modules: planData.modules || [],
                    features: normalizedFeatures,
                    limits: planData.limits || {},
                })
            } else {
                toast.error("Plan not found")
                router.push('/subscription-plans')
            }
            if (Array.isArray(modulesData)) setAvailableModules(modulesData)
            if (featuresData && typeof featuresData === 'object') setModuleFeatures(featuresData)
        } catch {
            toast.error("Failed to load plan")
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            await updatePlan(id as string, form)
            toast.success("Plan updated")
            setEditing(false)
            loadData()
        } catch {
            toast.error("Failed to update plan")
        } finally {
            setSaving(false)
        }
    }

    async function handleTogglePublic() {
        try {
            const result = await togglePlanPublic(id as string)
            toast.success(result.message)
            setForm(f => ({ ...f, is_public: result.is_public }))
            setPlan((p: any) => ({ ...p, is_public: result.is_public }))
        } catch {
            toast.error("Failed to toggle visibility")
        }
    }

    function toggleModule(code: string) {
        setForm(f => {
            const included = f.modules.includes(code)
            const newModules = included
                ? f.modules.filter(m => m !== code)
                : [...f.modules, code]

            // When adding a module, auto-enable default features
            const newFeatures = { ...f.features }
            if (!included && moduleFeatures[code]) {
                const defaults = moduleFeatures[code].features
                    .filter(feat => feat.default)
                    .map(feat => feat.code)
                newFeatures[code] = defaults
            }
            // When removing, clear its features
            if (included) {
                delete newFeatures[code]
            }

            return { ...f, modules: newModules, features: newFeatures }
        })
    }

    function toggleFeature(moduleCode: string, featureCode: string) {
        setForm(f => {
            const current = f.features[moduleCode] || []
            const has = current.includes(featureCode)
            return {
                ...f,
                features: {
                    ...f.features,
                    [moduleCode]: has
                        ? current.filter(fc => fc !== featureCode)
                        : [...current, featureCode]
                }
            }
        })
    }

    function toggleExpandModule(code: string) {
        setExpandedModules(prev => {
            const next = new Set(prev)
            if (next.has(code)) next.delete(code)
            else next.add(code)
            return next
        })
    }

    function updateLimit(key: string, value: string) {
        setForm(f => ({
            ...f,
            limits: { ...f.limits, [key]: parseInt(value) || 0 }
        }))
    }

    const isCustom = plan && parseFloat(String(plan.monthly_price)) < 0
    const tabs = [
        { key: 'overview', label: 'Overview' },
        { key: 'modules', label: 'Modules & Features' },
        { key: 'limits', label: 'Limits' },
        { key: 'orgs', label: `Organizations (${(plan?.organizations as any)?.length || 0})` },
    ]

    const limitConfig = [
        { key: 'max_users', label: 'Max Users', icon: Users },
        { key: 'max_sites', label: 'Max Sites', icon: Building2 },
        { key: 'max_storage_gb', label: 'Storage (GB)', icon: HardDrive },
        { key: 'max_products', label: 'Max Products', icon: Package },
        { key: 'max_invoices_per_month', label: 'Invoices / Month', icon: FileText },
        { key: 'max_customers', label: 'Max Customers', icon: UserCheck },
    ]

    if (loading) return <div className="py-20 text-center text-gray-500">Loading plan...</div>
    if (!plan) return <div className="py-20 text-center text-gray-500">Plan not found</div>

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/subscription-plans')} className="shrink-0">
                    <ArrowLeft size={20} />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">{plan.name}</h2>
                        <Badge className={form.is_public ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                            {form.is_public ? <><Globe size={12} className="mr-1" /> Public</> : <><Lock size={12} className="mr-1" /> Private</>}
                        </Badge>
                        {isCustom && <Badge className="bg-purple-100 text-purple-700">Custom</Badge>}
                        {form.trial_days > 0 && <Badge className="bg-blue-50 text-blue-700"><Clock size={12} className="mr-1" />{form.trial_days}d trial</Badge>}
                    </div>
                    <p className="text-gray-500 mt-1 text-sm">{plan.description || 'No description'}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleTogglePublic} className="gap-2 text-sm">
                        {form.is_public ? <Lock size={14} /> : <Globe size={14} />}
                        Make {form.is_public ? 'Private' : 'Public'}
                    </Button>
                    {editing ? (
                        <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Save Changes
                        </Button>
                    ) : (
                        <Button onClick={() => setEditing(true)} className="bg-gray-800 hover:bg-gray-700 text-white gap-2">
                            <Pencil size={16} /> Edit Plan
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
                {tabs.map(t => (
                    <button key={t.key}
                        onClick={() => setTab(t.key as any)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.key
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >{t.label}</button>
                ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Plan Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Name</Label>
                                <Input value={form.name} disabled={!editing}
                                    onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="bg-gray-50 border-gray-100 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</Label>
                                <Textarea value={form.description} disabled={!editing} rows={3}
                                    onChange={(e: any) => setForm(f => ({ ...f, description: e.target.value }))}
                                    className="bg-gray-50 border-gray-100 rounded-xl" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sort Order</Label>
                                    <Input type="number" value={form.sort_order} disabled={!editing}
                                        onChange={(e: any) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                                        className="bg-gray-50 border-gray-100 rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                        <Clock size={12} /> Trial Duration (days)
                                    </Label>
                                    <Input type="number" value={form.trial_days} disabled={!editing}
                                        onChange={(e: any) => setForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))}
                                        className="bg-gray-50 border-gray-100 rounded-xl"
                                        placeholder="0 = no trial" />
                                    {form.trial_days > 0 && (
                                        <p className="text-[10px] text-blue-500 font-bold">
                                            {form.trial_days} days = ~{Math.round(form.trial_days / 30)} month(s) free trial
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Pricing</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isCustom ? (
                                <div className="text-center py-8">
                                    <p className="text-3xl font-black text-purple-700">Custom Pricing</p>
                                    <p className="text-sm text-purple-500 mt-2">Contact-based — no fixed pricing</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Monthly Price ($)</Label>
                                        <Input type="number" value={form.monthly_price} disabled={!editing}
                                            onChange={(e: any) => setForm(f => ({ ...f, monthly_price: e.target.value }))}
                                            className="bg-gray-50 border-gray-100 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Annual Price ($)</Label>
                                        <Input type="number" value={form.annual_price} disabled={!editing}
                                            onChange={(e: any) => setForm(f => ({ ...f, annual_price: e.target.value }))}
                                            className="bg-gray-50 border-gray-100 rounded-xl" />
                                    </div>
                                    <div className="pt-4 border-t text-center">
                                        <p className="text-3xl font-black text-emerald-600">{parseFloat(form.monthly_price) === 0 ? 'Free' : `$${parseFloat(form.monthly_price).toFixed(0)}`}<span className="text-lg text-gray-400 font-normal">/mo</span></p>
                                        {parseFloat(form.annual_price) > 0 && (
                                            <p className="text-lg text-gray-500 mt-1">${parseFloat(form.annual_price).toFixed(0)}<span className="text-sm font-normal">/yr</span>
                                                {parseFloat(form.monthly_price) > 0 && (
                                                    <span className="text-emerald-500 text-xs ml-2 font-bold">
                                                        Save {Math.round(100 - (parseFloat(form.annual_price) / (parseFloat(form.monthly_price) * 12)) * 100)}%
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Limits Summary */}
                    <Card className="md:col-span-2 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Limits Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                {limitConfig.map(lim => (
                                    <div key={lim.key} className="text-center p-4 bg-gray-50 rounded-2xl">
                                        <lim.icon size={20} className="mx-auto text-gray-400 mb-2" />
                                        <div className="text-xs text-gray-400 font-bold uppercase">{lim.label}</div>
                                        <div className="text-xl font-black text-gray-800 mt-1">
                                            {form.limits[lim.key] != null
                                                ? (form.limits[lim.key] < 0 ? '∞' : form.limits[lim.key] >= 10000 ? `${(form.limits[lim.key] / 1000).toFixed(0)}K` : form.limits[lim.key].toLocaleString())
                                                : '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modules & Features Tab */}
            {tab === 'modules' && (
                <div className="space-y-4">
                    <Card className="bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Included Modules & Features</CardTitle>
                            <CardDescription>
                                Toggle modules on/off, then expand each module to select specific features.
                                {!editing && <span className="text-amber-600 ml-2 font-bold">Click "Edit Plan" to modify.</span>}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {availableModules
                                .filter((m: Record<string, any>) => !['core', 'coreplatform'].includes(m.manifest?.code || m.code || ''))
                                .map((m: Record<string, any>) => {
                                    const code = m.manifest?.code || m.code || m.name.toLowerCase()
                                    const isIncluded = form.modules.includes(code)
                                    const modFeats = moduleFeatures[code]
                                    const activeFeatures = form.features[code] || []
                                    const isExpanded = expandedModules.has(code)
                                    const hasFeatures = modFeats && modFeats.features.length > 0

                                    return (
                                        <div key={code} className={`rounded-2xl border-2 transition-all overflow-hidden ${isIncluded
                                            ? 'border-emerald-200 bg-white'
                                            : 'border-gray-100 bg-gray-50/50'
                                            }`}>
                                            {/* Module header row */}
                                            <div className={`flex items-center gap-4 p-4 ${editing ? 'cursor-pointer' : ''}`}
                                                onClick={() => editing && toggleModule(code)}>
                                                <Switch
                                                    checked={isIncluded}
                                                    disabled={!editing}
                                                    onCheckedChange={() => editing && toggleModule(code)}
                                                    onClick={(e: any) => e.stopPropagation()}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className={`font-bold ${isIncluded ? 'text-gray-800' : 'text-gray-400'}`}>{m.name}</p>
                                                        <span className="text-[10px] font-mono text-gray-300">{code}</span>
                                                        {m.version && <Badge className="bg-gray-100 text-gray-500 text-[9px]">v{m.version}</Badge>}
                                                        <Badge className={`text-[9px] ${m.visibility === 'public' ? 'bg-emerald-50 text-emerald-600' :
                                                            m.visibility === 'organization' ? 'bg-blue-50 text-blue-600' :
                                                                'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {m.visibility === 'public' ? '🌐 Public' :
                                                                m.visibility === 'organization' ? '🏢 Org Only' :
                                                                    '🔒 Private'}
                                                        </Badge>
                                                    </div>
                                                    {m.description && (
                                                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{m.description}</p>
                                                    )}
                                                    {hasFeatures && isIncluded && (
                                                        <p className="text-[11px] text-emerald-500 font-medium mt-0.5">
                                                            {activeFeatures.length}/{modFeats.features.length} features active
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Expand/collapse features */}
                                                {hasFeatures && isIncluded && (
                                                    <Button variant="ghost" size="sm"
                                                        className="text-gray-400 hover:text-gray-700 gap-1"
                                                        onClick={(e: any) => { e.stopPropagation(); toggleExpandModule(code) }}>
                                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        <span className="text-xs">Features</span>
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Feature toggles */}
                                            {hasFeatures && isIncluded && isExpanded && (
                                                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {modFeats.features.map(feat => {
                                                            const isActive = activeFeatures.includes(feat.code)
                                                            return (
                                                                <div key={feat.code}
                                                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive
                                                                        ? 'bg-emerald-50 border border-emerald-100'
                                                                        : 'bg-white border border-gray-100'
                                                                        } ${editing ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                                                    onClick={() => editing && toggleFeature(code, feat.code)}>
                                                                    <Checkbox
                                                                        checked={isActive}
                                                                        disabled={!editing}
                                                                        onCheckedChange={() => editing && toggleFeature(code, feat.code)}
                                                                        onClick={(e: any) => e.stopPropagation()}
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{feat.name}</p>
                                                                        <p className="text-[10px] text-gray-300 font-mono">{feat.code}</p>
                                                                    </div>
                                                                    {feat.default && (
                                                                        <Badge className="bg-blue-50 text-blue-500 text-[8px]">default</Badge>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </CardContent>
                    </Card>
                    <p className="text-xs text-gray-400 font-medium px-2">
                        {form.modules.length} module(s) included · Core modules (core, coreplatform) are always available.
                    </p>
                </div>
            )}

            {/* Limits Tab */}
            {tab === 'limits' && (
                <Card className="bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Usage Limits</CardTitle>
                        <CardDescription>Define the maximum resources for this plan. Use -1 for unlimited (custom plans).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {limitConfig.map(lim => (
                                <div key={lim.key} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <lim.icon size={16} className="text-gray-400" />
                                        <Label className="text-sm font-bold text-gray-700">{lim.label}</Label>
                                    </div>
                                    <Input
                                        type="number"
                                        value={form.limits[lim.key] ?? ''}
                                        disabled={!editing}
                                        onChange={(e: any) => updateLimit(lim.key, e.target.value)}
                                        className="bg-gray-50 border-gray-100 rounded-xl"
                                        placeholder="0"
                                    />
                                    <p className="text-[10px] text-gray-400">
                                        {form.limits[lim.key] === -1 ? 'Unlimited' : form.limits[lim.key] != null ? `Cap: ${form.limits[lim.key].toLocaleString()}` : 'Not set'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Organizations Tab */}
            {tab === 'orgs' && (
                <Card className="bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Organizations on this Plan</CardTitle>
                        <CardDescription>{(plan.organizations as any)?.length || 0} organization(s) currently subscribed</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(plan.organizations as any)?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(plan.organizations as any).map((org: Record<string, any>) => (
                                    <div key={org.id}
                                        className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
                                        onClick={() => router.push(`/organizations/${org.id}`)}
                                    >
                                        <div>
                                            <p className="font-bold text-gray-800">{org.name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{org.slug}</p>
                                        </div>
                                        <Badge className={org.is_active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}>
                                            {org.is_active ? 'Active' : 'Suspended'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-400">
                                <Users size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No organizations on this plan yet</p>
                                <p className="text-xs mt-1">Assign this plan to organizations from their detail page</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
