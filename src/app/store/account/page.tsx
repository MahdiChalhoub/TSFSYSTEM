import { getAccountSummary } from '@/app/actions/ecommerce/account'
import Link from 'next/link'
import { ShoppingBag, Star, Wallet, Package, ArrowRight } from 'lucide-react'

export const metadata = { title: 'My Account | Store' }

export default async function AccountPage() {
    const summary = await getAccountSummary().catch(() => null)

    const kpis = [
        { label: 'Total Orders', value: summary?.orders_count ?? '—', icon: Package },
        { label: 'Total Spent', value: summary?.total_spent ? parseFloat(summary.total_spent).toLocaleString() : '—', icon: ShoppingBag },
        { label: 'Loyalty Points', value: summary?.loyalty_points ?? '—', icon: Star },
        { label: 'Wallet Balance', value: summary?.wallet_balance ? parseFloat(summary.wallet_balance).toLocaleString() : '—', icon: Wallet },
    ]

    const quickLinks = [
        { href: '/store/account/orders', label: 'View All Orders', icon: Package },
        { href: '/store/catalog', label: 'Continue Shopping', icon: ShoppingBag },
        { href: '/store/cart', label: 'View Cart', icon: ShoppingBag },
    ]

    return (
        <div className="store-section">
            <div className="store-container">
                <h1 className="store-section-title">My Account</h1>

                {/* KPI tiles */}
                <div className="store-3col" style={{ marginBottom: '2rem' }}>
                    {kpis.map(({ label, value, icon: Icon }) => (
                        <div key={label} className="store-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={20} style={{ color: 'var(--store-accent, #10b981)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                <p style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--app-surface-2)' }}>{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {quickLinks.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} className="store-card"
                            style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', transition: 'transform 0.15s' }}
                            id={`acct-link-${label.replace(/\s+/g, '-').toLowerCase()}`}>
                            <Icon size={18} style={{ color: 'var(--store-accent, #10b981)' }} />
                            <span style={{ fontWeight: 600, color: 'var(--app-surface-2)', flex: 1 }}>{label}</span>
                            <ArrowRight size={16} style={{ color: 'var(--app-faint)' }} />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
