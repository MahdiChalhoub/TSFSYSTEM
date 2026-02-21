"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StoreDialog } from "./components/StoreDialog"
import { StoreCard } from "./components/StoreCard"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { getApiUrl } from "@/lib/utils"

export default function IntegrationsPage() {
    const { toast } = useToast()
    const [stores, setStores] = useState([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)

    const fetchStores = async () => {
        try {
            setLoading(true)
            // Use flat API mount points for backwards-compatibility or namespaced endpoints
            // Backend router handles /api/stores/ and /api/integrations/stores/
            const res = await fetch(getApiUrl("stores/"), {
                headers: {
                    "X-Tenant-ID": localStorage.getItem("tenant_id") || "hq",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            })
            if (res.ok) {
                const data = await res.json()
                setStores(data.results || data)
            } else {
                toast({ title: "Error", description: "Failed to load integrations", variant: "destructive" })
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStores()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Integrations</h2>
                    <p className="text-muted-foreground">
                        Manage connections to third-party platforms like Shopify and WooCommerce.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Connect Store
                    </Button>
                </div>
            </div>

            <StoreDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={fetchStores}
            />

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-[250px] w-full" />
                    <Skeleton className="h-[250px] w-full" />
                </div>
            ) : stores.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-8 text-center h-[300px]">
                    <CardHeader>
                        <CardTitle>No integrations found</CardTitle>
                        <CardDescription>
                            You have not connected any external stores yet.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Connect your first store
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {stores.map((store: any) => (
                        <StoreCard
                            key={store.id}
                            store={store}
                            onRefresh={fetchStores}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
