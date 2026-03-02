'use client'
import { Building2, ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
export function LandingHomePage({ org }: { org: any }) {
 return (
 <div className="min-h-screen bg-app-surface">
 {/* Hero Section */}
 <section className="pt-24 pb-20 px-6 max-w-7xl mx-auto text-center">
 <Badge className="mb-6 bg-indigo-50 text-indigo-600 border-indigo-100 font-bold uppercase tracking-widest px-4 py-1">
 Welcome to {org.name}
 </Badge>
 <h1 className="text-6xl md:text-8xl font-black text-app-text tracking-tighter leading-[1.1] mb-8">
 Elevating your <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">business standards.</span>
 </h1>
 <p className="text-xl text-app-text-muted max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
 We provide top-tier industry solutions backed by robust technology and a dedicated team of experts.
 </p>
 <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
 <Button size="lg" className="h-14 px-8 rounded-full text-lg font-bold shadow-xl shadow-indigo-200/50 w-full sm:w-auto hover:-translate-y-1 transition-all">
 Get Started <ArrowRight className="ml-2 w-5 h-5" />
 </Button>
 <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-lg font-bold border-2 w-full sm:w-auto hover:bg-app-bg">
 Learn More
 </Button>
 </div>
 </section>
 {/* Features Grid */}
 <section id="services" className="py-24 bg-gray-50/50 border-t border-app-border">
 <div className="max-w-7xl mx-auto px-6">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 <div className="bg-app-surface p-8 rounded-[2.5rem] border border-app-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
 <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
 <ShieldCheck size={28} />
 </div>
 <h3 className="text-xl font-bold text-app-text mb-3">Enterprise Security</h3>
 <p className="text-app-text-muted font-medium leading-relaxed">Your data and daily operations are protected by military-grade encryption and compliance standards.</p>
 </div>
 <div className="bg-app-surface p-8 rounded-[2.5rem] border border-app-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
 <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-6">
 <Zap size={28} />
 </div>
 <h3 className="text-xl font-bold text-app-text mb-3">Lightning Fast</h3>
 <p className="text-app-text-muted font-medium leading-relaxed">Built on modern edge infrastructure ensuring operations resolve in milliseconds globally.</p>
 </div>
 <div className="bg-app-surface p-8 rounded-[2.5rem] border border-app-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
 <Globe size={28} />
 </div>
 <h3 className="text-xl font-bold text-app-text mb-3">Global Reach</h3>
 <p className="text-app-text-muted font-medium leading-relaxed">Scale your localized business seamlessly to international markets with our robust network.</p>
 </div>
 </div>
 </div>
 </section>
 {/* Footer */}
 <footer className="border-t border-app-border py-12 text-center text-app-text-muted font-medium">
 <p>&copy; {new Date().getFullYear()} {org.name}. All rights reserved.</p>
 </footer>
 </div>
 )
}
import { Badge } from "@/components/ui/badge"
