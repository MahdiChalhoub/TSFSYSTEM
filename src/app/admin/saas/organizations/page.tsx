'use client'

import { useEffect, useState } from "react"
import { getOrganizations, toggleOrganizationStatus, createOrganization } from "./actions"
import { getOrgModules, toggleOrgModule, updateOrgModuleFeatures } from "@/app/actions/saas/modules"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building, Plus, Globe, ShieldCheck, Activity, Trash2, Zap, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function OrganizationsPage() {
    const [orgs, setOrgs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const data = await getOrganizations()
            console.log("Fetched orgs:", data)
            if (Array.isArray(data)) {
                setOrgs(data)
            } else {
                setOrgs([])
                toast.error("Invalid data format received")
            }
        } catch {
            toast.error("Failed to load organizations")
        } finally {
            setLoading(false)
        }
    }

    async function handleToggle(id: string, status: boolean) {
        try {
            await toggleOrganizationStatus(id, status)
            toast.success("Status updated")
            loadData()
        } catch {
            toast.error("Failed to update status")
        }
    }

    const [newOrg, setNewOrg] = useState({ name: '', slug: '' })
    const [isCreating, setIsCreating] = useState(false)
    const [open, setOpen] = useState(false)

    async function handleCreate() {
        if (!newOrg.name || !newOrg.slug) return toast.error("Please fill all fields")
        setIsCreating(true)
        try {
            await createOrganization(newOrg)
            toast.success("Organization provisioned successfully")
            setOpen(false)
            setNewOrg({ name: '', slug: '' })
            loadData()
        } catch {
            toast.error("Provisioning failed")
        } finally {
            setIsCreating(false)
        }
    }

    const [selectedOrg, setSelectedOrg] = useState<any>(null)
    const [orgModules, setOrgModules] = useState<any[]>([])
    const [loadingModules, setLoadingModules] = useState(false)
    const [modulesOpen, setModulesOpen] = useState(false)

    async function handleOpenModules(org: any) {
        setSelectedOrg(org)
        setModulesOpen(true)
        setLoadingModules(true)
        try {
            const data = await getOrgModules(org.id)
            setOrgModules(data)
        } catch {
            toast.error("Failed to load organization modules")
        } finally {
            setLoadingModules(false)
        }
    }

    async function handleModuleToggle(moduleCode: string, currentStatus: string) {
        const action = currentStatus === 'INSTALLED' ? 'disable' : 'enable'
        try {
            await toggleOrgModule(selectedOrg.id, moduleCode, action)
            toast.success(`Module ${action}d`)
            // Refresh module list
            const data = await getOrgModules(selectedOrg.id)
            setOrgModules(data)
        } catch (e: any) {
            toast.error(e.message || "Failed to toggle module")
        }
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">Organizations</h2>
                    <p className="text-gray-400 mt-2 font-medium">Manage multi-tenant company instances</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-6 rounded-2xl flex gap-2 font-bold shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02]">
                            <Plus size={20} />
                            Register New Organization
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0F172A] border-gray-800 text-white rounded-[2rem] max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Provision Instance</DialogTitle>
                            <CardDescription className="text-gray-400">Configure the new business version identity</CardDescription>
                        </DialogHeader>
                        <div className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Business Legal Name</Label>
                                <Input
                                    placeholder="e.g. TSF Global Côte d'Ivoire"
                                    className="bg-gray-950 border-gray-800 rounded-xl py-6 focus:ring-emerald-500"
                                    value={newOrg.name}
                                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Unique URL Slug</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="tsf-global"
                                        className="bg-gray-950 border-gray-800 rounded-xl py-6 focus:ring-emerald-500 font-mono text-emerald-400"
                                        value={newOrg.slug}
                                        onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                                    />
                                    <span className="text-gray-600 font-mono text-xs">.tsf-city.com</span>
                                </div>
                            </div>
                            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                <div className="flex gap-3">
                                    <Zap className="text-emerald-400 shrink-0" size={18} />
                                    <p className="text-[10px] leading-relaxed text-emerald-300 font-medium">
                                        Submitting this will automatically provision a default branch, a super-admin user, and a full Chart of Accounts skeleton for this instance.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="pt-8">
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-6 font-black shadow-xl shadow-emerald-900/40"
                                onClick={handleCreate}
                                disabled={isCreating}
                            >
                                {isCreating ? "Initializing Engine..." : "Provision Now"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-gray-500 font-medium">Loading platform data...</div>
                ) : orgs.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-500 font-medium">No organizations found.</div>
                ) : orgs.map((org) => (
                    <Card key={org.id} className="bg-[#0F172A] border-gray-800 hover:border-emerald-500/50 transition-all rounded-3xl overflow-hidden group shadow-xl">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                    <Building size={24} />
                                </div>
                                <Badge className={org.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}>
                                    {org.isActive ? 'Active' : 'Suspended'}
                                </Badge>
                            </div>
                            <CardTitle className="text-2xl font-bold text-white mt-4">{org.name}</CardTitle>
                            <CardDescription className="text-emerald-500/70 font-mono text-xs tracking-widest uppercase mt-1">
                                {org.slug}.tsf-city.com
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-[#0B1120] rounded-2xl border border-gray-800/50">
                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Sites</div>
                                    <div className="text-xl font-bold text-white">{org._count?.sites || 0}</div>
                                </div>
                                <div className="p-4 bg-[#0B1120] rounded-2xl border border-gray-800/50">
                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Users</div>
                                    <div className="text-xl font-bold text-white">{org._count?.users || 0}</div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 py-6 rounded-2xl border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white transition-all font-bold"
                                    onClick={() => handleToggle(org.id, org.isActive)}
                                >
                                    {org.isActive ? 'Suspend' : 'Activate'}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="px-6 py-6 rounded-2xl border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/20 transition-all font-bold"
                                    onClick={() => handleOpenModules(org)}
                                >
                                    <Settings2 size={20} />
                                </Button>
                                <Button variant="ghost" className="p-6 rounded-2xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                    <Trash2 size={20} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
                <DialogContent className="bg-[#0F172A] border-gray-800 text-white rounded-[2rem] max-w-2xl overflow-hidden p-0">
                    <div className="p-8 bg-emerald-500/5 border-b border-gray-800/50">
                        <DialogTitle className="text-2xl font-black">Feature Activation</DialogTitle>
                        <CardDescription className="text-gray-400 mt-1">
                            Managing modules for <span className="text-emerald-400 font-bold">{selectedOrg?.name}</span>
                        </CardDescription>
                    </div>

                    <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                        {loadingModules ? (
                            <div className="py-12 text-center text-gray-500 italic font-medium">Scanning organizational entitlements...</div>
                        ) : orgModules.length === 0 ? (
                            <div className="py-12 text-center text-gray-500">No available features found for this instance.</div>
                        ) : orgModules.map((m) => (
                            <div key={m.code} className="p-4 bg-gray-950/50 border border-gray-800 rounded-2xl group hover:border-emerald-500/30 transition-all">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{m.name}</h4>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">{m.code}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Badge className={m.status === 'INSTALLED' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-gray-800 text-gray-500 border-transparent"}>
                                            {m.status}
                                        </Badge>
                                        {!m.is_core ? (
                                            <Button
                                                size="sm"
                                                className={m.status === 'INSTALLED' ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl px-4" : "bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl px-4"}
                                                onClick={() => handleModuleToggle(m.code, m.status)}
                                            >
                                                {m.status === 'INSTALLED' ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        ) : (
                                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter bg-indigo-500/10 px-2 py-1 rounded-md">
                                                Permanent
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Feature Flags UI */}
                                {m.status === 'INSTALLED' && m.available_features?.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-800/50 pl-2">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Extended Capabilities</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {m.available_features.map((f: any) => (
                                                <label key={f.code} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500/20"
                                                        checked={m.active_features?.includes(f.code) || false}
                                                        onChange={async (e) => {
                                                            const newFeatures = e.target.checked
                                                                ? [...(m.active_features || []), f.code]
                                                                : (m.active_features || []).filter((c: string) => c !== f.code)

                                                            // Optimistic update logic would go here, but for safety we await
                                                            try {
                                                                await updateOrgModuleFeatures(selectedOrg.id, m.code, newFeatures)
                                                                toast.success("Feature updated")
                                                                const data = await getOrgModules(selectedOrg.id)
                                                                setOrgModules(data)
                                                            } catch {
                                                                toast.error("Failed to update feature")
                                                            }
                                                        }}
                                                    />
                                                    <span className={m.active_features?.includes(f.code) ? "text-emerald-300 font-medium" : ""}>
                                                        {f.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-8 bg-gray-950 border-t border-gray-800/50 flex justify-end">
                        <Button variant="ghost" className="text-gray-400 hover:text-white rounded-xl px-8" onClick={() => setModulesOpen(false)}>
                            Close Manager
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
