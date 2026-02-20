import { PortalProvider } from '@/context/PortalContext'
import { ThemeLayout } from './ThemeLayout'

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
            <ThemeLayout>
                {children}
            </ThemeLayout>
        </PortalProvider>
    )
}
