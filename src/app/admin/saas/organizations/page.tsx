'use client'

import { useEffect, useState } from "react"
import { getOrganizations, toggleOrganizationStatus } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building, Plus, Globe, ShieldCheck, Activity, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function OrganizationsPage() {
    const [orgs, setOrgs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const data = await getOrganizations()
            setOrgs(data)
        } catch (error) {
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
        } catch (error) {
            toast.error("Failed to update status")
        }
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">Organizations</h2>
                    <p className="text-gray-400 mt-2 font-medium">Manage multi-tenant company instances</p>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-6 rounded-2xl flex gap-2 font-bold shadow-lg shadow-emerald-900/20">
                    <Plus size={20} />
                    New Organization
                </Button>
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
                                    <div className="text-xl font-bold text-white">{org._count.sites}</div>
                                </div>
                                <div className="p-4 bg-[#0B1120] rounded-2xl border border-gray-800/50">
                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Users</div>
                                    <div className="text-xl font-bold text-white">{org._count.users}</div>
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
                                <Button variant="ghost" className="p-6 rounded-2xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                    <Trash2 size={20} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
