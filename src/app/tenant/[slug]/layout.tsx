import { PortalProvider } from '@/context/PortalContext'
import { StorefrontHeader } from '@/components/tenant/StorefrontHeader'

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
        </PortalProvider>
    )
}
