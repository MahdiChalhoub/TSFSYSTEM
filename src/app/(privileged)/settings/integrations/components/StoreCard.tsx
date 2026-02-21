import { useState } from "react"
import { Activity, RefreshCw, ShoppingBag, PackageOpen, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { getApiUrl } from "@/lib/utils"

interface StoreCardProps {
    store: any
    onRefresh: () => void
}

export function StoreCard({ store, onRefresh }: StoreCardProps) {
    const { toast } = useToast()
    const [syncing, setSyncing] = useState<string | null>(null)
    const [testing, setTesting] = useState(false)

    const handleAction = async (action: string) => {
        setSyncing(action)
        try {
            const res = await fetch(getApiUrl(`stores/${store.id}/${action}/`), {
                method: "POST",
                headers: {
                    "X-Tenant-ID": localStorage.getItem("tenant_id") || "hq",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error || "Action failed")

            toast({
                title: "Success",
                description: `Action '${action}' completed successfully.`
            })
            onRefresh()
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setSyncing(null)
        }
    }

    const handleTest = async () => {
        setTesting(true)
        try {
            const res = await fetch(getApiUrl(`stores/${store.id}/test_connection/`), {
                method: "POST",
                headers: {
                    "X-Tenant-ID": localStorage.getItem("tenant_id") || "hq",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Connection failed")

            toast({ title: "Connected", description: "Successfully verified API keys." })
        } catch (error: any) {
            toast({ title: "Connection Failed", description: error.message, variant: "destructive" })
        } finally {
            setTesting(false)
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xl font-bold">{store.name}</CardTitle>
                <Badge variant={store.is_active ? "default" : "secondary"}>
                    {store.platform}
                </Badge>
            </CardHeader>
            <CardContent>
                <CardDescription className="mb-4">{store.base_url}</CardDescription>
                <div className="text-sm font-medium flex items-center mb-2">
                    <Activity className="mr-2 h-4 w-4 text-muted-foreground" />
                    Last Sync: {store.last_sync_at ? new Date(store.last_sync_at).toLocaleString() : "Never"}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
                <div className="flex w-full space-x-2">
                    <Button
                        variant="outline"
                        className="w-full flex-1"
                        onClick={() => handleAction("sync_products")}
                        disabled={syncing !== null || testing}
                    >
                        {syncing === "sync_products" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <PackageOpen className="mr-2 h-4 w-4" />}
                        Products
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full flex-1"
                        onClick={() => handleAction("sync_orders")}
                        disabled={syncing !== null || testing}
                    >
                        {syncing === "sync_orders" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                        Orders
                    </Button>
                </div>
                <div className="flex w-full space-x-2">
                    <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => handleAction("sync_all")}
                        disabled={syncing !== null || testing}
                    >
                        {syncing === "sync_all" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync Everything
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleTest}
                        disabled={syncing !== null || testing}
                        title="Test Connection"
                    >
                        {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
}
