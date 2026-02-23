'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../engine/hooks/useAuth'
import { useConfig } from '../../engine/hooks/useConfig'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function BoutiqueLoginPage() {
    const { login } = useAuth()
    const { slug } = useConfig()
    const base = `/tenant/${slug}`

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        const result = await login(email, password)
        if (!result.success) {
            setError(result.error || 'Invalid credentials')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-6 py-16"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4 shadow-lg shadow-violet-200"
                        style={{ fontFamily: "'Playfair Display', serif" }}>
                        B
                    </div>
                    <h1 className="text-3xl font-bold text-indigo-950" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Welcome Back
                    </h1>
                    <p className="text-gray-400 text-sm mt-2">Sign in to access your account</p>
                </div>

                <form onSubmit={handleSubmit}
                    className="bg-white rounded-3xl border border-violet-100 p-8 shadow-xl shadow-violet-100/30">
                    {error && (
                        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Email</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-400" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-violet-200 bg-violet-50/30 text-indigo-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-400" />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-violet-200 bg-violet-50/30 text-indigo-950 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm"
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-600">
                                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full mt-6 py-4 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition shadow-lg shadow-violet-200 flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading ? 'Signing in...' : <>Sign In <ArrowRight size={16} /></>}
                    </button>

                    <div className="mt-6 text-center space-y-2">
                        <Link href={`${base}/register`}
                            className="text-sm text-violet-600 font-medium hover:underline">
                            Create an account
                        </Link>
                        <span className="text-gray-300 mx-2">·</span>
                        <Link href={base}
                            className="text-sm text-gray-400 hover:text-violet-600">
                            Continue as guest
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
