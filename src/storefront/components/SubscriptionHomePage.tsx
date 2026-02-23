'use client'

import { useConfig } from '@/storefront/engine/hooks/useConfig'
import { Check, Star, Zap, Crown, ArrowRight } from 'lucide-react'

/**
 * Subscription homepage — pricing plans grid, feature comparison.
 * Used when storefront_type = SUBSCRIPTION.
 */
const PLANS = [
    {
        name: 'Starter',
        price: '9',
        period: '/mo',
        desc: 'Perfect for getting started',
        icon: Zap,
        color: '#3b82f6',
        features: ['Up to 100 items', 'Basic analytics', 'Email support', 'Standard API'],
        popular: false,
    },
    {
        name: 'Professional',
        price: '29',
        period: '/mo',
        desc: 'For growing businesses',
        icon: Star,
        color: '#8b5cf6',
        features: ['Unlimited items', 'Advanced analytics', 'Priority support', 'Full API access', 'Custom branding', 'Team collaboration'],
        popular: true,
    },
    {
        name: 'Enterprise',
        price: '99',
        period: '/mo',
        desc: 'For large-scale operations',
        icon: Crown,
        color: '#f59e0b',
        features: ['Everything in Pro', 'Dedicated account manager', 'SLA guarantee', 'Custom integrations', 'White-label options', 'On-premise deploy'],
        popular: false,
    },
]

export default function SubscriptionHomePage() {
    const { orgName, config } = useConfig()

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
            {/* Hero */}
            <section style={{
                padding: '5rem 2rem', textAlign: 'center',
                background: 'linear-gradient(160deg, #0f172a; 0%, #1e1b4b 50%, #312e81 100%)',
                color: '#fff',
            }}>
                <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, margin: 0 }}>
                    Choose Your Plan
                </h1>
                <p style={{ fontSize: '1.15rem', opacity: 0.8, marginTop: '1rem', maxWidth: '600px', margin: '1rem auto 0' }}>
                    {config?.storefront_tagline || `Start with ${orgName} today — upgrade anytime.`}
                </p>
            </section>

            {/* Pricing Grid */}
            <section style={{ padding: '4rem 2rem', background: '#f8fafc' }}>
                <div style={{
                    maxWidth: '1100px', margin: '0 auto',
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem',
                    alignItems: 'start',
                }}>
                    {PLANS.map(plan => (
                        <div key={plan.name} style={{
                            background: '#fff', borderRadius: '20px',
                            border: plan.popular ? `2px solid ${plan.color}` : '1px solid #e2e8f0',
                            padding: '2rem', position: 'relative',
                            boxShadow: plan.popular ? `0 8px 30px ${plan.color}20` : 'none',
                            transform: plan.popular ? 'scale(1.03)' : 'none',
                        }}>
                            {plan.popular && (
                                <div style={{
                                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                                    background: plan.color, color: '#fff', padding: '0.25rem 1rem',
                                    borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                                }}>Most Popular</div>
                            )}
                            <plan.icon size={28} color={plan.color} />
                            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0.75rem 0 0.25rem' }}>{plan.name}</h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{plan.desc}</p>
                            <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>$</span>
                                <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>{plan.price}</span>
                                <span style={{ color: '#64748b' }}>{plan.period}</span>
                            </div>
                            <button style={{
                                width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none',
                                background: plan.popular ? plan.color : '#f1f5f9',
                                color: plan.popular ? '#fff' : '#1e293b',
                                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                marginBottom: '1.5rem',
                            }}>
                                Get Started <ArrowRight size={16} />
                            </button>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                {plan.features.map(f => (
                                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Check size={16} color={plan.color} />
                                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section style={{ padding: '4rem 2rem', background: '#fff' }}>
                <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>Frequently Asked Questions</h2>
                    {[
                        { q: 'Can I change plans later?', a: 'Yes, you can upgrade or downgrade anytime.' },
                        { q: 'Is there a free trial?', a: 'All plans come with a 14-day free trial.' },
                        { q: 'What payment methods do you accept?', a: 'We accept all major credit cards and bank transfers.' },
                    ].map((faq, i) => (
                        <div key={i} style={{
                            textAlign: 'left', padding: '1.25rem 1.5rem', borderRadius: '12px',
                            border: '1px solid #e2e8f0', marginBottom: '0.75rem',
                        }}>
                            <h4 style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>{faq.q}</h4>
                            <p style={{ margin: 0, color: '#64748b' }}>{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
