'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Building, ArrowRight, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { getOrganizations } from "@/app/(privileged)/(saas)/organizations/actions"

export default function SwitcherPage() {
    const [orgs, setOrgs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const data = await getOrganizations()
                setOrgs(Array.isArray(data) ? data : [])
            } catch {
                toast.error("Failed to load organizations")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    function handleSwitch(slug: string) {
        if (slug === 'saas') {
            window.location.href = '/dashboard'
        } else {
            // Redirect to tenant subdomain
            const host = window.location.host
            if (host.includes('localhost')) {
                window.location.href = `http://${slug}.localhost:3000/`
            } else {
                const baseDomain = host.split('.').slice(-2).join('.')
                window.location.href = `https://${slug}.${baseDomain}/`
            }
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Instance Switcher</h2>
                <p className="text-gray-500 mt-2 font-medium">Switch between your authorized organization workspaces</p>
            </div>

            {loading ? (
                <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orgs.map((org) => (
                        <Card
                            key={org.id}
                            className="hover:border-emerald-500/30 transition-all cursor-pointer group"
                            onClick={() => handleSwitch(org.slug)}
                        >
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        <Building size={20} />
                                    </div>
                                    <Badge className={org.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}>
                                        {org.isActive ? 'Active' : 'Suspended'}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-4 flex items-center justify-between">
                                    {org.name}
                                    <ArrowRight className="text-gray-300 group-hover:text-emerald-500 transition-colors" size={20} />
                                </CardTitle>
                                <CardDescription className="font-mono text-xs">{org.slug}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
