'use client'

import { useEffect, useState } from "react"
import { SaasSite } from "@/types/erp"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Building, Plus, MapPin } from "lucide-react"
import { toast } from "sonner"
import { erpFetch } from "@/lib/erp-api"

export default function SitesPage() {
 const [sites, setSites] = useState<SaasSite[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 async function load() {
 try {
 const data = await fetch('/api/sites').then(r => r.json()).catch(() => [])
 setSites(Array.isArray(data) ? data : [])
 } catch {
 toast.error("Failed to load sites")
 } finally {
 setLoading(false)
 }
 }
 load()
 }, [])

 return (
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 <div className="flex justify-between items-end">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-app-foreground shadow-lg">
 <MapPin size={28} />
 </div>
 </div>
 <h2 className="text-3xl font-black text-app-foreground tracking-tight">Sites & Branches</h2>
 <p className="text-app-muted-foreground mt-2 font-medium">Manage physical locations and branch offices</p>
 </div>
 <Button className="bg-app-primary hover:bg-app-primary gap-2 text-app-foreground">
 <Plus size={18} />
 New Site
 </Button>
 </div>

 {loading ? (
 <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-app-primary" /></div>
 ) : sites.length === 0 ? (
 <Card className="py-16 text-center border-dashed">
 <CardContent>
 <MapPin className="mx-auto text-app-muted-foreground mb-4" size={48} />
 <h3 className="text-lg font-bold text-app-muted-foreground">No Sites Configured</h3>
 <p className="text-app-muted-foreground text-sm mt-2">Sites represent physical locations like stores, warehouses, or offices.</p>
 </CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {sites.map((site) => (
 <Card key={site.id} className="hover:border-app-primary/30 transition-all">
 <CardHeader>
 <div className="flex justify-between items-start">
 <div className="p-3 bg-app-primary-light rounded-xl text-app-primary">
 <Building size={20} />
 </div>
 <Badge className={site.is_active ? "bg-app-primary-light text-app-primary" : "bg-app-surface-2 text-app-muted-foreground"}>
 {site.is_active ? 'Active' : 'Inactive'}
 </Badge>
 </div>
 <CardTitle className="mt-4">{site.name}</CardTitle>
 <CardDescription>{site.address || 'No address set'}</CardDescription>
 </CardHeader>
 </Card>
 ))}
 </div>
 )}
 </div>
 )
}
