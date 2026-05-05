'use client'
import { Mail, Phone, MapPin, Globe, CreditCard, ShieldCheck } from 'lucide-react'
import { useConfig } from '../../engine/hooks/useConfig'
import Link from 'next/link'
export default function EmporiumFooter() {
    const { orgName, slug } = useConfig()
    const year = new Date().getFullYear()
    return (
        <footer className="bg-app-surface border-t border-app-border mt-20">
            {/* Value Bar */}
            <div className="border-b border-app-border bg-slate-50/50">
                <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-app-surface rounded-2xl border border-app-border shadow-sm flex items-center justify-center mx-auto md:mx-0 text-yellow-500">
                            <ShieldCheck size={24} />
                        </div>
                        <h4 className="font-black text-app-foreground uppercase tracking-wider text-sm">Secure Shopping</h4>
                        <p className="text-sm text-app-muted-foreground leading-relaxed font-medium">Your data is protected by industry-leading encryption and buyer protection policies.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-app-surface rounded-2xl border border-app-border shadow-sm flex items-center justify-center mx-auto md:mx-0 text-indigo-500">
                            <Globe size={24} />
                        </div>
                        <h4 className="font-black text-app-foreground uppercase tracking-wider text-sm">Worldwide Delivery</h4>
                        <p className="text-sm text-app-muted-foreground leading-relaxed font-medium">We partner with global logistics leaders to ensure fast delivery to over 120 countries.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-app-surface rounded-2xl border border-app-border shadow-sm flex items-center justify-center mx-auto md:mx-0 text-emerald-500">
                            <CreditCard size={24} />
                        </div>
                        <h4 className="font-black text-app-foreground uppercase tracking-wider text-sm">Flexible Payments</h4>
                        <p className="text-sm text-app-muted-foreground leading-relaxed font-medium">Choose from a variety of payment methods including Cards, Wallets, and Installments.</p>
                    </div>
                </div>
            </div>
            {/* Main Links */}
            <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 lg:grid-cols-4 gap-12">
                <div className="space-y-6 col-span-2 lg:col-span-1">
                    <h5 className="font-black text-app-foreground italic tracking-tighter text-xl lowercase">{orgName?.replace(/\s+/g, '') || slug}</h5>
                    <p className="text-sm text-app-muted-foreground leading-relaxed font-medium">
                        The elite marketplace for quality products and verified vendors. Join thousands of satisfied customers worldwide.
                    </p>
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-app-surface-2 hover:bg-yellow-400 transition-colors cursor-pointer" />
                        <div className="w-8 h-8 rounded-lg bg-app-surface-2 hover:bg-yellow-400 transition-colors cursor-pointer" />
                        <div className="w-8 h-8 rounded-lg bg-app-surface-2 hover:bg-yellow-400 transition-colors cursor-pointer" />
                    </div>
                </div>
                <div className="space-y-6">
                    <h5 className="font-black text-app-foreground uppercase tracking-widest text-xs">Platform</h5>
                    <nav className="flex flex-col gap-3">
                        <Link href={`/tenant/${slug}`} className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Home</Link>
                        <Link href={`/tenant/${slug}/categories`} className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Categories</Link>
                        <Link href={`/tenant/${slug}/search`} className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Search Results</Link>
                        <Link href={`/tenant/${slug}/register`} className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors text-amber-600">Flash Sales</Link>
                    </nav>
                </div>
                <div className="space-y-6">
                    <h5 className="font-black text-app-foreground uppercase tracking-widest text-xs">Customer Service</h5>
                    <nav className="flex flex-col gap-3">
                        <Link href="#" className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Order Tracking</Link>
                        <Link href="#" className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Shipping Policy</Link>
                        <Link href="#" className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Returns & Refunds</Link>
                        <Link href="#" className="text-sm font-bold text-app-muted-foreground hover:text-app-foreground transition-colors">Privacy Policy</Link>
                    </nav>
                </div>
                <div className="space-y-6">
                    <h5 className="font-black text-app-foreground uppercase tracking-widest text-xs">Contact Us</h5>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-app-bg rounded-xl flex items-center justify-center text-app-muted-foreground shrink-0">
                                <Mail size={18} />
                            </div>
                            <div className="text-xs font-bold text-app-foreground">support@{slug}.com</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-app-bg rounded-xl flex items-center justify-center text-app-muted-foreground shrink-0">
                                <Phone size={18} />
                            </div>
                            <div className="text-xs font-bold text-app-foreground">+1 800-PLATFORM</div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Copyright Bar */}
            <div className="border-t border-app-border py-6 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                        © {year} {orgName} • Powered by TSF PLATFORM ENTERPRISE
                    </p>
                    <div className="flex items-center gap-6 grayscale opacity-40">
                        <div className="text-[10px] font-black uppercase tracking-tighter">VISA</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter">MASTERCARD</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter">PAYPAL</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter">STRIPE</div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
