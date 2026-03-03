'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { clientRegister, clientLogin } from '@/app/actions/ecommerce/store-auth'
import Link from 'next/link'
import { User, Mail, Lock, Phone, Store } from 'lucide-react'

export default function StoreRegisterPage() {
    const router = useRouter()
    const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name || !form.email || !form.password) { setError('Name, email, and password are required.'); return }
        setError('')
        startTransition(async () => {
            const reg = await clientRegister(form)
            if (!reg.ok) { setError(reg.error ?? 'Registration failed'); return }
            // Auto-login after register
            const login = await clientLogin(form.email, form.password)
            if (login.ok) {
                router.push('/store')
                router.refresh()
            } else {
                router.push('/store/login')
            }
        })
    }

    const fields = [
        { key: 'name' as const, label: 'Full Name', type: 'text', Icon: User, placeholder: 'Jane Doe' },
        { key: 'email' as const, label: 'Email Address', type: 'email', Icon: Mail, placeholder: 'you@example.com' },
        { key: 'password' as const, label: 'Password', type: 'password', Icon: Lock, placeholder: '8+ characters' },
        { key: 'phone' as const, label: 'Phone (optional)', type: 'tel', Icon: Phone, placeholder: '+1 555 000 0000' },
    ]

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8fafc', padding: '2rem',
        }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '1rem',
                        background: 'var(--store-accent, #10b981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                    }}>
                        <Store size={28} style={{ color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Create Account</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>Shop, track orders, and earn rewards</p>
                </div>

                <div className="store-card" style={{ padding: '2rem' }}>
                    {error && (
                        <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '0.625rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {fields.map(({ key, label, type, Icon, placeholder }) => (
                            <div key={key}>
                                <label className="store-label">{label}</label>
                                <div style={{ position: 'relative' }}>
                                    <Icon size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input id={`register-${key}`} type={type} className="store-input"
                                        required={key !== 'phone'}
                                        value={form[key]} onChange={set(key)}
                                        placeholder={placeholder} style={{ paddingLeft: '2.5rem' }} />
                                </div>
                            </div>
                        ))}
                        <button id="register-submit" type="submit" disabled={isPending}
                            className="store-btn store-btn-primary"
                            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }}>
                            {isPending ? 'Creating account…' : 'Create Account'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '1.25rem', color: '#64748b', fontSize: '0.9375rem' }}>
                    Already have an account?{' '}
                    <Link href="/store/login" style={{ color: 'var(--store-accent, #10b981)', fontWeight: 600, textDecoration: 'none' }}>
                        Sign in
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
