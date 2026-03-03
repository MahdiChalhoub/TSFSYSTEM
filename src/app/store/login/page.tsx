'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clientLogin } from '@/app/actions/ecommerce/store-auth'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, Store } from 'lucide-react'

export default function StoreLoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const nextPath = searchParams.get('next') || '/store/account'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) { setError('Please fill in all fields'); return }
        setError('')
        startTransition(async () => {
            const res = await clientLogin(email, password)
            if (!res.ok) { setError(res.error ?? 'Login failed'); return }
            router.push(nextPath)
            router.refresh()
        })
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8fafc', padding: '2rem',
        }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '1rem',
                        background: 'var(--store-accent, #10b981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                    }}>
                        <Store size={28} style={{ color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Sign In</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>Access your account and orders</p>
                </div>

                {/* Card */}
                <div className="store-card" style={{ padding: '2rem' }}>
                    {error && (
                        <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '0.625rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="store-label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input id="login-email" type="email" className="store-input" required
                                    value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com" style={{ paddingLeft: '2.5rem' }} />
                            </div>
                        </div>
                        <div>
                            <label className="store-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input id="login-password" type={showPw ? 'text' : 'password'} className="store-input" required
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} />
                                <button type="button" onClick={() => setShowPw(s => !s)}
                                    style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button id="login-submit" type="submit" disabled={isPending}
                            className="store-btn store-btn-primary"
                            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }}>
                            {isPending ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '1.25rem', color: '#64748b', fontSize: '0.9375rem' }}>
                    Don't have an account?{' '}
                    <Link href="/store/register" style={{ color: 'var(--store-accent, #10b981)', fontWeight: 600, textDecoration: 'none' }}>
                        Register
                    </Link>
                </p>
                <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <Link href="/store" style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none' }}>
                        ← Back to store
                    </Link>
                </p>
            </div>
        </div>
    )
}
