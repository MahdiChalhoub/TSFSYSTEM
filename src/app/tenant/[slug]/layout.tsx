import { PortalProvider } from '@/context/PortalContext'

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
            {children}
        </PortalProvider>
    )
}
