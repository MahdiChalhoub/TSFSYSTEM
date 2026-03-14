"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Building2, UserPlus, LogIn, ArrowRight, ShieldCheck, Zap, Globe,
  Sparkles, AlertCircle, CheckCircle2, RotateCcw, TrendingUp, Users,
  BarChart3, Lock, Cloud, Cpu, Database, Workflow, Check, Star,
  ChevronRight, PlayCircle, Menu, X, Mail, Phone, MapPin, Linkedin,
  Twitter, Github, Facebook, Instagram, Youtube
} from "lucide-react"
import { toast } from "sonner"
import { PLATFORM_CONFIG } from "@/lib/branding"
import { checkWorkspace } from "@/app/actions/onboarding"
import PricingSection from "@/components/landing/PricingSection"
import Link from "next/link"

type AuthMode = 'login' | 'signup' | 'register'

export default function LandingPage() {
  const [mode, setMode] = useState<AuthMode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    workspace: ''
  })

  // Scroll detection for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Reset states when mode changes
  useEffect(() => {
    setError(null)
    setSuggestions([])
  }, [mode])

  const generateSuggestions = (base: string) => {
    const clean = base.toLowerCase().replace(/[^a-z0-9]/g, '-')
    return [
      `${clean}-corp`,
      `${clean}-hq`,
      `${clean}-${Math.floor(Math.random() * 900) + 100}`,
      `${clean}-global`
    ]
  }

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuggestions([])

    try {
      if (mode === 'register') {
        if (!formData.name || !formData.slug) {
          throw new Error("Please enter a Business Name and Workspace ID.")
        }

        const check = await checkWorkspace(formData.slug)
        if (check.exists) {
          setError("This Workspace ID is already taken. Try one of the suggestions below.")
          setSuggestions(generateSuggestions(formData.slug))
          setLoading(false)
          return
        }

        toast.success("Workspace ID available! Redirecting to registration...")
        setTimeout(() => {
          window.location.href = `/register/business?slug=${formData.slug}&name=${encodeURIComponent(formData.name)}`
        }, 1000)
        return
      } else {
        if (!formData.workspace) throw new Error("Please enter your Workspace ID.")

        if (formData.workspace === 'saas') {
          const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(window.location.host);

          if (isIp) {
            window.location.href = `/login?slug=saas`
          } else {
            const host = window.location.host.includes('localhost')
              ? `${window.location.protocol}//saas.localhost:3000/login`
              : `${window.location.protocol}//saas.${window.location.host}/login`
            window.location.href = host
          }
          return
        }

        const check = await checkWorkspace(formData.workspace)
        if (check.exists) {
          const params = new URLSearchParams()
          const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(window.location.host);

          if (isIp) {
            const route = mode === 'login' ? '/login' : '/register/user'
            window.location.href = `${window.location.protocol}//${window.location.host}${route}?slug=${formData.workspace}`
          } else {
            const route = mode === 'login' ? '/login' : '/register/user'
            const host = window.location.host.includes('localhost')
              ? `${window.location.protocol}//${formData.workspace}.localhost:3000${route}`
              : `${window.location.protocol}//${formData.workspace}.${window.location.host}${route}`
            window.location.href = host
          }
        } else {
          setError(`Workspace '${formData.workspace}' not found. Please check the ID and try again.`)
        }
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || "Connection failed. Please check your network.")
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = (s: string) => {
    setFormData({ ...formData, slug: s })
    setError(null)
    setSuggestions([])
  }

  const renderForm = () => {
    const isLogin = mode === 'login'
    const isSignup = mode === 'signup'
    const isRegister = mode === 'register'

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {(isLogin || isSignup) && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Workspace ID
            </Label>
            <Input
              placeholder="e.g. acme"
              className={`h-14 rounded-xl text-lg font-medium transition-all focus:ring-2 ${isLogin ? 'focus:ring-emerald-500/30 border-emerald-200 dark:border-emerald-900' : 'focus:ring-cyan-500/30 border-cyan-200 dark:border-cyan-900'}`}
              value={formData.workspace}
              onChange={e => setFormData({ ...formData, workspace: e.target.value.toLowerCase().trim() })}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Connect to your organization's secure workspace.</p>
          </div>
        )}

        {isRegister && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Business Name</Label>
                <Input
                  placeholder="Acme Industries"
                  className="h-14 rounded-xl font-medium"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Workspace ID</Label>
                <Input
                  placeholder="acme"
                  className="h-14 rounded-xl font-mono"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex flex-col gap-3 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
              <AlertCircle size={16} />
              {error}
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Suggested Available IDs:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          className={`w-full h-14 rounded-xl text-base font-semibold shadow-lg transition-all active:scale-[0.98] ${isLogin ? 'bg-emerald-600 hover:bg-emerald-700 text-white' :
            isSignup ? 'bg-cyan-600 hover:bg-cyan-700 text-white' :
            'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
          }`}
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <RotateCcw className="animate-spin" size={20} />
              Connecting...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              {isLogin ? "Sign In" : isSignup ? "Join Workspace" : "Register Business"}
              <ArrowRight className="w-5 h-5" />
            </div>
          )}
        </Button>
      </div>
    )
  }

  // Navigation items
  const navItems = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" },
  ]

  // If auth mode is selected, show the modal
  if (mode !== null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-purple-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-400/20 to-purple-400/20 dark:from-blue-600/10 dark:to-purple-600/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-cyan-400/20 to-emerald-400/20 dark:from-cyan-600/10 dark:to-emerald-600/10 blur-3xl rounded-full" />

        {/* Back button */}
        <button
          onClick={() => setMode(null)}
          className="absolute top-8 left-8 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center gap-2 group z-50"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to home</span>
        </button>

        {/* Auth Card */}
        <Card className="w-full max-w-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-slate-200/50 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl relative z-10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500" />

          {/* Mode Switcher */}
          <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMode('login')}
              className={`py-6 flex flex-col items-center gap-2 transition-all relative ${mode === 'login' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <LogIn size={24} />
              <span className="text-xs font-semibold uppercase tracking-wider">Sign In</span>
              {mode === 'login' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500" />}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`py-6 flex flex-col items-center gap-2 transition-all relative ${mode === 'signup' ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <UserPlus size={24} />
              <span className="text-xs font-semibold uppercase tracking-wider">Join</span>
              {mode === 'signup' && <div className="absolute bottom-0 left-0 w-full h-1 bg-cyan-500" />}
            </button>
            <button
              onClick={() => setMode('register')}
              className={`py-6 flex flex-col items-center gap-2 transition-all relative ${mode === 'register' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Building2 size={24} />
              <span className="text-xs font-semibold uppercase tracking-wider">Register</span>
              {mode === 'register' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500" />}
            </button>
          </div>

          <CardContent className="p-8 md:p-12">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join Your Team' : 'Start Your Journey'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {mode === 'login' ? 'Sign in to access your workspace' : mode === 'signup' ? 'Connect to an existing organization' : 'Create your business workspace'}
              </p>
            </div>

            <form onSubmit={handleAction}>
              {renderForm()}
            </form>
          </CardContent>

          {/* Trust Badges */}
          <div className="px-8 py-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-slate-900 dark:text-white font-bold text-lg flex items-center justify-center gap-2">
                  <Zap size={16} className="text-emerald-500" /> 2.4s
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-medium">Response Time</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-900 dark:text-white font-bold text-lg flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} className="text-cyan-500" /> AES-256
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-medium">Encryption</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-900 dark:text-white font-bold text-lg flex items-center justify-center gap-2">
                  <Globe size={16} className="text-blue-500" /> 99.9%
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider font-medium">Uptime</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Landing page with header and footer
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-950 dark:to-purple-950">
      {/* Header / Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-lg border-b border-slate-200/50 dark:border-slate-800/50' : 'bg-transparent'}`}>
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {PLATFORM_CONFIG.name}
                </h1>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wider">Enterprise Platform</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                onClick={() => setMode('login')}
                variant="ghost"
                className="font-semibold"
              >
                Sign In
              </Button>
              <Button
                onClick={() => setMode('register')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
              >
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 dark:text-slate-300"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg">
            <div className="container mx-auto px-6 py-6 space-y-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <Button
                  onClick={() => { setMode('login'); setMobileMenuOpen(false); }}
                  variant="outline"
                  className="w-full font-semibold"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => { setMode('register'); setMobileMenuOpen(false); }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                >
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/30 to-purple-400/30 dark:from-blue-600/20 dark:to-purple-600/20 blur-3xl rounded-full animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-400/30 to-emerald-400/30 dark:from-cyan-600/20 dark:to-emerald-600/20 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg">
                <Sparkles size={16} className="text-blue-600 dark:text-blue-400 animate-pulse" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Enterprise Business Platform</span>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">NEW</span>
              </div>
            </div>

            {/* Main Heading */}
            <div className="text-center mb-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {PLATFORM_CONFIG.name.split(' ')[0]}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 dark:from-blue-400 dark:via-purple-400 dark:to-cyan-400">
                  {PLATFORM_CONFIG.name.split(' ').slice(1).join(' ')}
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
                The unified platform that transforms how businesses operate, collaborate, and scale in the digital age
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
              <Button
                onClick={() => setMode('register')}
                size="lg"
                className="h-14 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-base group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => setMode('login')}
                size="lg"
                variant="outline"
                className="h-14 px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900 font-semibold rounded-xl shadow-lg text-base group"
              >
                <PlayCircle className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
              {[
                { value: "50K+", label: "Active Users", icon: Users },
                { value: "99.9%", label: "Uptime SLA", icon: TrendingUp },
                { value: "150+", label: "Integrations", icon: Workflow },
                { value: "24/7", label: "Support", icon: ShieldCheck }
              ].map((stat, i) => (
                <div key={i} className="text-center p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:shadow-xl transition-all">
                  <stat.icon className="w-8 h-8 mx-auto mb-3 text-blue-600 dark:text-blue-400" />
                  <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
              Everything you need to run your business
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Powerful features designed for modern enterprises
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {[
              { icon: Database, title: "Unified Data Platform", desc: "All your business data in one centralized, secure location" },
              { icon: BarChart3, title: "Real-time Analytics", desc: "Make data-driven decisions with live insights and reporting" },
              { icon: Cloud, title: "Cloud Infrastructure", desc: "Scalable, reliable, and globally distributed architecture" },
              { icon: Lock, title: "Enterprise Security", desc: "Bank-level encryption and compliance with SOC 2, GDPR" },
              { icon: Cpu, title: "AI-Powered Automation", desc: "Intelligent workflows that save time and reduce errors" },
              { icon: Workflow, title: "Seamless Integrations", desc: "Connect with 150+ tools and services you already use" }
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:shadow-2xl transition-all group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400">{feature.desc}</p>
                <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 font-semibold text-sm group-hover:gap-2 transition-all">
                  Learn more <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <div id="pricing">
        <PricingSection />
      </div>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                Ready to transform your business?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Join thousands of companies already using {PLATFORM_CONFIG.name}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  onClick={() => setMode('register')}
                  size="lg"
                  className="h-14 px-8 bg-white hover:bg-slate-100 text-blue-600 font-semibold rounded-xl shadow-xl text-base group"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  onClick={() => setMode('login')}
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 bg-transparent border-2 border-white text-white hover:bg-white/10 font-semibold rounded-xl text-base"
                >
                  Sign In
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 dark:bg-slate-950 text-white pt-20 pb-12 border-t border-slate-800">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Company Info */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-black">{PLATFORM_CONFIG.name}</h3>
              </div>
              <p className="text-slate-400 mb-6 leading-relaxed">
                The unified platform that transforms how businesses operate, collaborate, and scale.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Github className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-bold text-lg mb-6">Product</h4>
              <ul className="space-y-3">
                {['Features', 'Pricing', 'Integrations', 'API', 'Documentation', 'Changelog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-bold text-lg mb-6">Company</h4>
              <ul className="space-y-3">
                {['About Us', 'Careers', 'Blog', 'Press', 'Partners', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-bold text-lg mb-6">Get in Touch</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-sm">Email</p>
                    <a href="mailto:hello@tsfsystem.com" className="text-white hover:text-blue-400 transition-colors">
                      hello@tsfsystem.com
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-sm">Phone</p>
                    <a href="tel:+1234567890" className="text-white hover:text-blue-400 transition-colors">
                      +1 (234) 567-890
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-sm">Address</p>
                    <p className="text-white">
                      Global Headquarters<br />
                      Worldwide Offices
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm text-center md:text-left">
              © 2024 {PLATFORM_CONFIG.name}. Secured by {PLATFORM_CONFIG.federation_name}. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
