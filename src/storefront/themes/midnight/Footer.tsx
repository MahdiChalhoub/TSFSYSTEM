'use client'

import { useConfig } from '../../engine/hooks'

export default function MidnightFooter() {
    const { orgName } = useConfig()

    return (
        <footer className="bg-slate-950 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">{orgName}</h3>
                        <p className="text-xs text-app-muted-foreground leading-relaxed">
                            Your trusted digital marketplace. Quality products, seamless experience.
                        </p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Quick Links</div>
                        <div className="space-y-2">
                            <p className="text-xs text-app-muted-foreground hover:text-app-muted-foreground cursor-pointer transition-colors">Products</p>
                            <p className="text-xs text-app-muted-foreground hover:text-app-muted-foreground cursor-pointer transition-colors">Categories</p>
                            <p className="text-xs text-app-muted-foreground hover:text-app-muted-foreground cursor-pointer transition-colors">My Account</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Support</div>
                        <div className="space-y-2">
                            <p className="text-xs text-app-muted-foreground hover:text-app-muted-foreground cursor-pointer transition-colors">Contact Us</p>
                            <p className="text-xs text-app-muted-foreground hover:text-app-muted-foreground cursor-pointer transition-colors">FAQ</p>
                            <p className="text-xs text-app-muted-foreground hover:text-app-muted-foreground cursor-pointer transition-colors">Returns</p>
                        </div>
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-app-foreground font-bold uppercase tracking-widest">
                        Powered by TSF Platform
                    </span>
                    <span className="text-[10px] text-app-foreground">
                        &copy; {new Date().getFullYear()} {orgName}
                    </span>
                </div>
            </div>
        </footer>
    )
}
