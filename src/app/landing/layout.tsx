import type { Metadata } from "next";
import "../globals.css";
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

import { PLATFORM_CONFIG } from "@/lib/branding";

export const metadata: Metadata = {
 title: `${PLATFORM_CONFIG.name} | Global System`,
 description: "Multi-Tenant Enterprise OS",
};

export default function LandingLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
 <div className="bg-[#020617] text-slate-100 min-h-screen flex flex-col bg-app-bg">
 <header className="fixed top-0 w-full z-50 bg-app-bg/50 backdrop-blur-xl border-b border-slate-800/50">
 <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
 <div className="flex items-center gap-2">
 <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
 <span className="text-app-text font-black text-xl">{PLATFORM_CONFIG.name.charAt(0)}</span>
 </div>
 <span className="text-2xl font-black tracking-tighter">
 {PLATFORM_CONFIG.name.split(' ')[0]}
 <span className="text-emerald-500">{PLATFORM_CONFIG.name.split(' ').slice(1).join('')}</span>
 </span>
 </div>

 <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-app-text-faint">
 <a href="#features" className="hover:text-app-text transition-colors">Features</a>
 <a href="#pricing" className="hover:text-app-text transition-colors">Pricing</a>
 <a href="#register" className="bg-emerald-600 hover:bg-emerald-500 text-app-text px-5 py-2.5 rounded-full transition-all shadow-lg shadow-emerald-900/40">
 Get Started
 </a>
 </nav>
 </div>
 </header>

 <main className="flex-1 pt-20">
 {children}
 </main>

 <footer className="bg-app-bg border-t border-slate-900 py-20">
 <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 text-app-text-faint">
 <div className="col-span-2">
 <span className="text-2xl font-black text-app-text tracking-tighter mb-4 block">
 {PLATFORM_CONFIG.name.split(' ')[0]}
 <span className="text-emerald-500">{PLATFORM_CONFIG.name.split(' ').slice(1).join('')}</span>
 </span>
 <p className="max-w-xs leading-relaxed">
 The ultimate SaaS platform for modern business management.
 Unified ERP, POS, Finance and Inventory scaling with you.
 </p>
 </div>
 <div>
 <h4 className="text-app-text font-bold mb-4 uppercase text-xs tracking-widest">Platform</h4>
 <ul className="space-y-3 text-sm">
 <li><a href="#" className="hover:text-emerald-400">Features</a></li>
 <li><a href="#" className="hover:text-emerald-400">Pricing</a></li>
 <li><a href="#" className="hover:text-emerald-400">Roadmap</a></li>
 </ul>
 </div>
 <div>
 <h4 className="text-app-text font-bold mb-4 uppercase text-xs tracking-widest">Company</h4>
 <ul className="space-y-3 text-sm">
 <li><a href="#" className="hover:text-emerald-400">About Us</a></li>
 <li><a href="#" className="hover:text-emerald-400">Privacy Policy</a></li>
 <li><a href="#" className="hover:text-emerald-400">Contact Support</a></li>
 </ul>
 </div>
 </div>
 <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-slate-900 text-center text-xs text-app-text-muted">
 &copy; {new Date().getFullYear()} {PLATFORM_CONFIG.federation_name}. All rights reserved.
 </div>
 </footer>
 </div>
 );
}
