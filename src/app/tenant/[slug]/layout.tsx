import { PortalProvider } from '@/context/PortalContext'
import { ThemeLayout } from './ThemeLayout'
import { Metadata } from 'next'
import { getStorefrontConfig, getOrganizationBySlug } from './actions'
import { OrgNotFoundPage } from './OrgNotFoundPage'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
 const { slug } = await params
 const config = await getStorefrontConfig(slug)

 if (!config) return { title: 'Storefront | TSFSYSTEM' }

 return {
 title: config.seo_title || config.storefront_title || slug,
 description: config.seo_description || config.storefront_tagline,
 openGraph: {
 title: config.seo_title || config.storefront_title || slug,
 description: config.seo_description || config.storefront_tagline,
 images: config.og_image_url ? [config.og_image_url] : [],
 },
 }
}

export default async function TenantLayout({
 children,
 params,
}: {
 children: React.ReactNode
 params: Promise<{ slug: string }>
}) {
 const { slug } = await params

 // Validate that this organization actually exists before rendering any child route
 const org = await getOrganizationBySlug(slug)
 if (!org) {
 return <OrgNotFoundPage slug={slug} />
 }

 const config = await getStorefrontConfig(slug)

 return (
 <PortalProvider slug={slug} initialConfig={config || undefined}>
 <ThemeLayout>
 {children}
 </ThemeLayout>
 </PortalProvider>
 )
}

