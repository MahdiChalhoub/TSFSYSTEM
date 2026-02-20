import { PortalProvider } from '@/context/PortalContext'
import { StorefrontHeader } from '@/components/tenant/StorefrontHeader'
import { StorefrontFooter } from '@/components/tenant/StorefrontFooter'

export default async function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params

    return (
        <PortalProvider slug={slug}>
            <StorefrontHeader />
            {children}
            <StorefrontFooter />
        </PortalProvider>
    )
}
