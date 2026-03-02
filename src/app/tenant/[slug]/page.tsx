import {
 getOrganizationBySlug,
 getPublicProducts,
 getStorefrontConfig,
 getPublicCategories,
 getPublicBrands
} from "./actions"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ThemedHomePage } from "./ThemedHomePage"
import { LandingHomePage } from "./LandingHomePage"
import { BlogHomePage } from "./BlogHomePage"
import { OrgNotFoundPage } from "./OrgNotFoundPage"
export default async function TenantWelcomePage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params
 const org = await getOrganizationBySlug(slug)
 const products = await getPublicProducts(slug)
 const storefrontConfig = await getStorefrontConfig(slug)
 const categories = await getPublicCategories(slug)
 const brands = await getPublicBrands(slug)
 if (!org) {
 return <OrgNotFoundPage slug={slug} />
 }
 if ((org as any).error === "ACCOUNT_SUSPENDED") {
 return (
 <div className="min-h-screen bg-black flex items-center justify-center p-6">
 <div className="max-w-md w-full text-center space-y-6">
 <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
 <ShieldCheck size={40} />
 </div>
 <h1 className="text-3xl font-black text-white">Instance Suspended</h1>
 <p className="text-app-text-faint">The account for <span className="text-white font-bold">{org.name}</span> has been temporarily suspended. Please contact platform administration.</p>
 <Link href="/">
 <Button variant="outline" className="border-gray-800 text-white rounded-xl">
 Back to Home
 </Button>
 </Link>
 </div>
 </div>
 )
 }
 const homePageType = storefrontConfig?.storefront_type || 'PRODUCT_STORE'
 if (homePageType === 'LANDING_PAGE' || homePageType === 'PORTFOLIO') {
 return <LandingHomePage org={org} />
 }
 if (homePageType === 'CATALOGUE' || homePageType === 'SUBSCRIPTION') {
 return <BlogHomePage org={org} />
 }
 return <ThemedHomePage products={products} categories={categories} brands={brands} />
}
