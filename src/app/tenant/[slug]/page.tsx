import { getOrganizationBySlug, getPublicProducts } from "./actions"
import { notFound } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ThemedHomePage } from "./ThemedHomePage"

export default async function TenantWelcomePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const org = await getOrganizationBySlug(slug)
    const products = await getPublicProducts(slug)

    if (!org) {
        return notFound()
    }

    if ((org as any).error === "ACCOUNT_SUSPENDED") {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-app-error/10 border border-app-error/20 rounded-full flex items-center justify-center mx-auto text-app-error">
                        <ShieldCheck size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white">Instance Suspended</h1>
                    <p className="text-gray-400">The account for <span className="text-white font-bold">{org.name}</span> has been temporarily suspended. Please contact platform administration.</p>
                    <Link href="/">
                        <Button variant="outline" className="border-gray-800 text-white rounded-xl">
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    // Derive categories from products
    const categoryMap = new Map<string, { id: string; name: string; product_count: number }>()
    products.forEach((p: any) => {
        const key = p.category_name || 'Uncategorized'
        if (categoryMap.has(key)) {
            categoryMap.get(key)!.product_count++
        } else {
            categoryMap.set(key, { id: p.category_id || key, name: key, product_count: 1 })
        }
    })
    const categories = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    return <ThemedHomePage products={products} categories={categories} />
}
