import { useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getApiUrl } from "@/lib/utils"

const formSchema = z.object({
    name: z.string().min(2, "Store name is required"),
    platform: z.enum(["SHOPIFY", "WOOCOMMERCE"]),
    base_url: z.string().url("Must be a valid URL"),
    api_key: z.string().min(1, "API Key is required"),
    api_secret: z.string().min(1, "API Secret is required"),
})

interface StoreDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function StoreDialog({ open, onOpenChange, onSuccess }: StoreDialogProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            platform: "SHOPIFY",
            base_url: "",
            api_key: "",
            api_secret: "",
        },
    })

    // We save first, then we can optionally test.
    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            const res = await fetch(getApiUrl("stores/"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Tenant-ID": localStorage.getItem("tenant_id") || "hq",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    ...values,
                    is_active: true
                }),
            })

            if (!res.ok) throw new Error("Failed to create integration")

            toast({ title: "Success", description: "Store added successfully." })
            form.reset()
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Connect external store</DialogTitle>
                    <DialogDescription>
                        Add a new e-commerce integration. The API secrets will be encrypted.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Store Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="My Shopify Store" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="platform"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Platform</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a platform" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="SHOPIFY">Shopify</SelectItem>
                                            <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="base_url"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Store URL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://mystore.myshopify.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="api_key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>API Key</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="shpat_..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="api_secret"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>API Secret</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button disabled={loading} type="submit">
                                {loading ? "Saving..." : "Save Connection"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
