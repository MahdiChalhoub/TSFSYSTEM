'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
 Building2, Landmark, MapPin,
 ChevronRight, ChevronLeft, Check, Sparkles,
 Phone, Mail, MapPinned, Clock,
 Banknote, BookOpen, ToggleLeft, CalendarDays,
 Warehouse as WarehouseIcon, Plus, Trash2,
 CheckCircle2, Rocket, ArrowRight,
 Upload, FileSpreadsheet, ArrowUpRight,
 Scale, Shield, User, Building,
 Camera, Fingerprint, FileText, Map as MapIcon,
 Wallet, CreditCard, Coins, AlertCircle, Paintbrush
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
 saveBusinessProfile, saveFinancialSetup, saveFiscalRegime,
 bulkCreateWarehouses, completeOnboarding, createFinancialAccount,
 bulkCreatePriceGroups, bulkCreateDepartments,
 savePOSSettings, saveStorefrontConfig, bulkCreateChecklistTemplates
} from '@/app/actions/setup-wizard'
import { setOrgDefaultTheme } from '@/app/actions/settings/theme'
import type { AppThemeName } from '@/app/actions/settings/theme'

// ─── Types ──────────────────────────────────────────────────────

interface WizardConfig { currencies: any[]; businessTypes: any[]; coaTemplates: any[]; warehouses: any[]; modules: any[]; coaItems: any[]; posAccounts: any[]; tenant: any }
interface StepProps { config: WizardConfig; data: WizardData; setData: (u: Partial<WizardData>) => void; orgProfile: any; createdAccounts?: any[]; onAccountCreated?: (acc: any) => void }
interface WizardData {
 fiscal_regime: string
 business_name: string; business_email: string; phone: string; website: string
 address: string; city: string; state: string; zip_code: string; country: string; timezone: string
 business_type_id: string; base_currency_id: string; coa_template: string; works_in_ttc: boolean
 fiscal_year_name: string; fiscal_year_start: string; fiscal_year_end: string
 vat_number: string; legal_entity: string; logo: string
 want_migration: boolean | null
 warehouses: { name: string; code: string; type: string; address: string; city: string; is_company_address?: boolean }[]
 crm_price_groups: { name: string; description: string }[]
 hr_departments: { name: string; code: string }[]
 pos_settings: { allow_negative_stock: boolean }
 ecommerce_config: { theme: string; primary_color: string; custom_domain: string }
 workspace_checklists: { name: string; trigger: string; points: number }[]
 app_default_theme: AppThemeName | null
}

// ─── Constants ──────────────────────────────────────────────────

const STEPS = [
 { id: 'legal', title: 'Company Structure', subtitle: 'Legal & financial identity', icon: Scale, color: 'sky' },
 { id: 'financial', title: 'Financial Foundation', subtitle: 'Currency, COA & fiscal year', icon: Landmark, color: 'emerald' },
 { id: 'migration', title: 'Data Import', subtitle: 'Migrate from another system?', icon: Upload, color: 'orange' },
 { id: 'profile', title: 'Business Profile', subtitle: 'Contact & address details', icon: Building2, color: 'indigo' },
 { id: 'locations', title: 'Locations', subtitle: 'Warehouses & branches', icon: MapPin, color: 'violet' },
 { id: 'crm', title: 'CRM Setup', subtitle: 'Customer tiers & categories', icon: User, color: 'blue' },
 { id: 'hr', title: 'HR Setup', subtitle: 'Departments & teams', icon: Building, color: 'teal' },
 { id: 'pos', title: 'POS Config', subtitle: 'Sales & Inventory rules', icon: Wallet, color: 'emerald' },
 { id: 'ecommerce', title: 'Storefront', subtitle: 'Branding & Theme', icon: CreditCard, color: 'indigo' },
 { id: 'appearance', title: 'Appearance', subtitle: 'Org default theme', icon: Paintbrush, color: 'violet' },
 { id: 'workspace', title: 'Workspace', subtitle: 'Daily Checklists', icon: CheckCircle2, color: 'blue' },
 { id: 'payments', title: 'Payments', subtitle: 'Cash drawers', icon: Coins, color: 'amber' },
 { id: 'launch', title: 'Launch', subtitle: 'You\'re ready!', icon: Rocket, color: 'rose' },
]

const FISCAL_REGIMES = [
 { code: 'REGULAR', name: 'Standard (Régulier)', desc: 'Standard tax-inclusive pricing. Taxes are embedded in selling price. Most common for retail and B2C.', icon: Building, taxMode: 'TTC', vatRecovery: false },
 { code: 'MICRO', name: 'Micro-Enterprise', desc: 'Simplified flat-tax regime. No VAT declarations. Ideal for small businesses and auto-entrepreneurs.', icon: User, taxMode: 'TTC', vatRecovery: false },
 { code: 'REAL', name: 'Réel (Real)', desc: 'Professional accounting regime. Prices are HT (tax-exclusive). Full VAT tracking and recovery on purchases.', icon: Scale, taxMode: 'HT', vatRecovery: true },
 { code: 'MIXED', name: 'Mixed (Mixte)', desc: 'Dual-scope regime: Official scope uses HT, Internal scope uses TTC. For businesses with both B2B and B2C activity.', icon: Shield, taxMode: 'MIXED', vatRecovery: false },
]



const TIMEZONES = [
 'UTC', 'Africa/Abidjan', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Lagos',
 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
 'Asia/Beirut', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Riyadh',
 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul', 'Pacific/Auckland',
]

const COA_DISPLAY: Record<string, { name: string; flag: string; desc: string }> = {
 'IFRS_COA': { name: 'IFRS Standard', flag: '🌐', desc: 'International Financial Reporting Standards' },
 'LEBANESE_PCN': { name: 'Lebanese PCN', flag: '🇱🇧', desc: 'Plan Comptable National Libanais' },
 'FRENCH_PCG': { name: 'French PCG', flag: '🇫🇷', desc: 'Plan Comptable Général (France)' },
 'SYSCOHADA': { name: 'SYSCOHADA', flag: '🌍', desc: 'Système Comptable OHADA (Africa)' },
 'SAUDI_SOCPA': { name: 'Saudi SOCPA', flag: '🇸🇦', desc: 'Saudi Organization for CPAs' },
 'US_GAAP': { name: 'US GAAP', flag: '🇺🇸', desc: 'Generally Accepted Accounting Principles' },
}

const INPUT_CLS = "w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface-2/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-app-primary focus:border-app-primary/30 transition-all"


// ═══════════════════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════════════════

export default function SetupWizardClient({ config, orgProfile }: { config: WizardConfig; orgProfile: any }) {
 const router = useRouter()
 const year = new Date().getFullYear()

 const [data, setDataRaw] = useState<WizardData>({
 fiscal_regime: orgProfile?.company_type || '',
 business_name: orgProfile?.name || '',
 business_email: orgProfile?.business_email || '',
 phone: orgProfile?.phone || '', website: orgProfile?.website || '',
 address: orgProfile?.address || '', city: orgProfile?.city || '',
 state: orgProfile?.state || '', zip_code: orgProfile?.zip_code || '',
 country: orgProfile?.country || '', timezone: orgProfile?.timezone || 'UTC',
 business_type_id: orgProfile?.business_type_id || '',
 base_currency_id: orgProfile?.base_currency?.id?.toString() || '',
 coa_template: 'IFRS_COA', works_in_ttc: true,
 fiscal_year_name: `FY ${year}`,
 fiscal_year_start: `${year}-01-01`,
 fiscal_year_end: `${year}-12-31`,
 vat_number: orgProfile?.vat_number || '',
 legal_entity: orgProfile?.legal_entity || 'INDIVIDUAL',
 logo: orgProfile?.logo || '',
 want_migration: null,
 warehouses: [],
 crm_price_groups: [
 { name: 'Standard', description: 'Default retail pricing' },
 { name: 'VIP', description: 'Loyal customer discounts' },
 { name: 'Wholesale', description: 'Bulk B2B pricing' }
 ],
 hr_departments: [
 { name: 'Management', code: 'MGT' },
 { name: 'Sales & Marketing', code: 'SALES' },
 { name: 'Operations', code: 'OPS' }
 ],
 pos_settings: { allow_negative_stock: false },
 ecommerce_config: { theme: 'DEFAULT', primary_color: '#4f46e5', custom_domain: '' },
 workspace_checklists: [
 { name: 'Start of Shift Requirements', trigger: 'SHIFT_START', points: 5 },
 { name: 'End of Shift Closing', trigger: 'SHIFT_END', points: 10 }
 ],
 app_default_theme: null,
 })

 const getInitialStep = () => {
 // Step 0: Fiscal Regime — check if already saved
 const hasFiscalRegime = !!orgProfile?.company_type || !!data.fiscal_regime
 if (!hasFiscalRegime) return 0

 // Step 1: Financial Foundation — check if currency is set
 const hasCurrency = !!orgProfile?.base_currency?.id
 const hasCOA = config.coaItems.length > 0
 if (!hasCurrency || !hasCOA) return 1

 // Step 2: Migration — on resume, skip this since they already decided
 // (if they're back here, they either skipped or went to migration and came back)
 // Only show if it's a fresh first-time session (want_migration still null and no later data exists)
 const hasAddress = !!orgProfile?.address && !!orgProfile?.city
 const hasWarehouses = config.warehouses.length > 0
 const hasPOSAccounts = config.posAccounts.length > 0
 const hasLaterProgress = hasAddress || hasWarehouses || hasPOSAccounts
 if (!hasLaterProgress && data.want_migration === null) return 2

 // Step 3: Business Profile
 if (!hasAddress) return 3

 // Step 4: Locations (Warehouses)
 if (!hasWarehouses) return 4

 // Step 10: Payment Accounts (index 10)
 if (!hasPOSAccounts) return 10

 // Step 11: Launch — everything is ready
 return 11
 }

 const [step, setStep] = useState(0)
 const [initialized, setInitialized] = useState(false)
 const [saving, setSaving] = useState(false)
 const [completed, setCompleted] = useState(false)
 const [createdAccounts, setCreatedAccounts] = useState<any[]>([])
 const onAccountCreated = useCallback((acc: any) => setCreatedAccounts(prev => [...prev, acc]), [])

 useEffect(() => {
 if (!initialized) {
 setStep(getInitialStep())
 setInitialized(true)
 }
 }, [initialized])

 const setData = useCallback((u: Partial<WizardData>) => setDataRaw(p => ({ ...p, ...u })), [])

 const canGoNext = () => {
 if (step === 0) return !!data.fiscal_regime // Fiscal regime required
 if (step === 1) return !!data.base_currency_id && !!data.coa_template && !!data.fiscal_year_start && !!data.fiscal_year_end // Full financial foundation
 if (step === 2) return data.want_migration !== null // Must choose
 return true
 }

 const handleNext = async () => {
 // Migration redirect
 if (step === 2 && data.want_migration) { router.push('/migration'); return }

 if (step === STEPS.length - 1) {
 setSaving(true)
 try {
 const r = await completeOnboarding()
 if (r.success) { setCompleted(true); toast.success('🎉 Your organization is ready!'); setTimeout(() => router.push('/dashboard'), 2000) }
 else toast.error(r.error || 'Failed')
 } finally { setSaving(false) }
 return
 }

 setSaving(true)
 try {
 let result: any = { success: true }

 if (step === 0) {
 // Save fiscal regime — auto-set pricing mode
 const regime = FISCAL_REGIMES.find(r => r.code === data.fiscal_regime)
 if (regime) {
 setData({ works_in_ttc: regime.taxMode === 'TTC' })
 }
 result = await saveFiscalRegime(data.fiscal_regime)
 } else if (step === 1) {
 // MANDATORY: Save currency + COA + fiscal year
 result = await saveFinancialSetup({
 base_currency_id: data.base_currency_id,
 coa_template: data.coa_template,
 works_in_ttc: data.works_in_ttc,
 fiscal_year_name: data.fiscal_year_name,
 fiscal_year_start: data.fiscal_year_start,
 fiscal_year_end: data.fiscal_year_end,
 })
 } else if (step === 3) {
 result = await saveBusinessProfile({
 name: data.business_name, business_email: data.business_email,
 phone: data.phone, website: data.website, address: data.address,
 city: data.city, state: data.state, zip_code: data.zip_code,
 country: data.country, timezone: data.timezone,
 business_type_id: data.business_type_id || undefined,
 vat_number: data.vat_number, legal_entity: data.legal_entity,
 logo: data.logo,
 })
 } else if (step === 4) {
 const whToCreate = data.warehouses.filter(w => w.name).map(wh => ({
 name: wh.name,
 code: wh.code || wh.name.substring(0, 4).toUpperCase(),
 location_type: wh.type || 'WAREHOUSE',
 address: wh.address,
 city: wh.city
 }))
 if (whToCreate.length > 0) result = await bulkCreateWarehouses(whToCreate)
 } else if (step === 5) { // CRM
 const groupsToCreate = data.crm_price_groups.filter(g => g.name).map(g => ({
 name: g.name, description: g.description
 }))
 if (groupsToCreate.length > 0) result = await bulkCreatePriceGroups(groupsToCreate)
 } else if (step === 6) { // HR
 const deptsToCreate = data.hr_departments.filter(d => d.name).map(d => ({
 name: d.name, code: d.code
 }))
 if (deptsToCreate.length > 0) result = await bulkCreateDepartments(deptsToCreate)
 } else if (step === 7) { // POS
 result = await savePOSSettings(data.pos_settings)
 } else if (step === 8) { // E-Commerce
 result = await saveStorefrontConfig(data.ecommerce_config)
 } else if (step === 9) { // Appearance
 if (data.app_default_theme) {
 await setOrgDefaultTheme(data.app_default_theme)
 }
 // Always succeeds (theme is optional)
 } else if (step === 10) { // Workspace
 const checklistsToCreate = data.workspace_checklists.filter(cl => cl.name).map(cl => ({
 name: cl.name, trigger: cl.trigger, points: cl.points
 }))
 if (checklistsToCreate.length > 0) result = await bulkCreateChecklistTemplates(checklistsToCreate)
 } else if (step === 11) {
 // Moving from Payments to Launch — check if we have at least one POS account
 const totalAccounts = config.posAccounts.length + createdAccounts.length
 if (totalAccounts === 0) {
 toast.error("You must create at least one payment account for POS and Accounting.")
 setSaving(false); return
 }
 }

 if (result.success) setStep(s => s + 1)
 else toast.error(result.error || 'Failed to save.')
 } catch (err: any) { toast.error(err?.message || 'Error') }
 finally { setSaving(false) }
 }

 if (completed) return <LaunchAnimation />

 const StepComponents = [StepLegalForm, StepFinancialFoundation, StepDataMigration, StepBusinessProfile, StepLocations, StepCRMSetup, StepHRSetup, StepPOSSetup, StepECommerceSetup, StepAppearance, StepWorkspaceSetup, StepPaymentAccounts, StepLaunch]
 const CurrentStep = StepComponents[step]

 // Steps 0, 1, and 11 are MANDATORY — no skip button
 const canSkip = step > 2 && step !== 11 && step < STEPS.length - 1

 return (
 <div className="flex flex-col items-center animate-in fade-in duration-500 w-full">
 <div className="w-full max-w-4xl mx-auto px-4 pt-2">
 <div className="text-center mb-4">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-app-primary/5 text-app-primary mb-2">
 <Sparkles size={14} className="animate-pulse" />
 <span className="text-[11px] font-black uppercase tracking-widest">Organization Setup</span>
 </div>
 <h1 className="page-header-title">
 Let&apos;s set up <span className="text-app-primary">{data.business_name || 'your business'}</span>
 </h1>
 <p className="text-sm text-app-muted-foreground mt-2 font-medium">Complete these steps to unlock your full ERP experience</p>
 </div>
 {/* Progress */}
 <div className="flex items-center justify-center gap-0.5 mb-8 flex-wrap">
 {STEPS.map((s, i) => {
 const Icon = s.icon; const isActive = i === step; const isDone = i < step
 const isMandatory = i <= 1
 return (
 <div key={s.id} className="flex items-center">
 <button onClick={() => i < step && setStep(i)} disabled={i > step}
 className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold transition-all duration-300
 ${isActive ? 'bg-app-surface text-app-foreground shadow-lg shadow-app-border/20 scale-105' : isDone ? 'bg-app-primary-light text-app-primary hover:bg-app-primary-light cursor-pointer' : 'bg-app-background text-app-muted-foreground cursor-not-allowed'}`}>
 {isDone ? <CheckCircle2 size={14} className="text-app-primary" /> : <Icon size={14} />}
 <span className="hidden lg:inline">{s.title}</span>
 {isMandatory && isActive && <span className="text-rose-400 text-[9px]">*</span>}
 </button>
 {i < STEPS.length - 1 && <ChevronRight size={12} className={`mx-0.5 ${i < step ? 'text-app-success' : 'text-app-foreground'}`} />}
 </div>
 )
 })}
 </div>
 </div>
 <div className="w-full max-w-4xl mx-auto px-4 flex-1">
 <div className="bg-app-surface rounded-[2rem] border border-app-border shadow-sm">
 <div className="px-8 pt-8 pb-4 border-b border-app-border">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-2xl bg-app-surface-2 text-app-muted-foreground flex items-center justify-center">
 {(() => { const Icon = STEPS[step].icon; return <Icon size={24} /> })()}
 </div>
 <div>
 <h2>{STEPS[step].title}</h2>
 <p className="text-xs text-app-muted-foreground font-medium">{STEPS[step].subtitle}</p>
 </div>
 <div className="ml-auto flex items-center gap-2">
 {step <= 1 && <Badge className="bg-app-error-soft text-app-error border-0 font-black text-[9px] uppercase tracking-widest">Required</Badge>}
 <Badge className="bg-app-background text-app-muted-foreground border-0 font-black text-[10px] uppercase tracking-widest">Step {step + 1}/{STEPS.length}</Badge>
 </div>
 </div>
 </div>
 <div className="p-8 animate-in fade-in slide-in-from-right-4 duration-300" key={step}>
 <CurrentStep config={config} data={data} setData={setData} orgProfile={orgProfile} createdAccounts={createdAccounts} onAccountCreated={onAccountCreated} />
 </div>
 <div className="px-8 py-6 bg-app-surface-2/50 border-t border-app-border flex items-center justify-between">
 <button onClick={() => step > 0 && setStep(s => s - 1)} disabled={step === 0}
 className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${step === 0 ? 'text-app-muted-foreground cursor-not-allowed' : 'text-app-muted-foreground hover:bg-app-surface-2'}`}>
 <ChevronLeft size={18} /> Back
 </button>
 <div className="flex items-center gap-3">
 {canSkip && (
 <button onClick={() => setStep(s => s + 1)} className="px-6 py-3 rounded-xl font-bold text-sm text-app-muted-foreground hover:text-app-muted-foreground transition-all">Skip</button>
 )}
 <button onClick={handleNext} disabled={!canGoNext() || saving}
 className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg
 ${step === STEPS.length - 1 ? 'bg-app-primary text-app-foreground hover:bg-app-success shadow-emerald-200' : 'bg-app-surface text-app-foreground hover:bg-app-surface-2 shadow-app-border/20'}
 disabled:opacity-50 disabled:cursor-not-allowed`}>
 {saving ? (<><div className="w-4 h-4 border-2 border-app-foreground/30 border-t-white rounded-full animate-spin" /> Saving...</>)
 : step === 2 && data.want_migration ? (<><Upload size={18} /> Go to Migration</>)
 : step === STEPS.length - 1 ? (<><Rocket size={18} /> Launch Dashboard</>)
 : (<>Continue <ArrowRight size={18} /></>)}
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 0: Fiscal Regime (MANDATORY)
// ═══════════════════════════════════════════════════════════════

function StepLegalForm({ config, data, setData, orgProfile }: StepProps) {
 return (
 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-app-error-soft border border-rose-100 mb-2">
 <p className="text-xs font-bold text-app-error">
 ⚠️ This is <strong>required</strong> before you can use the system. It determines your tax mode (HT or TTC), VAT recovery, and accounting behavior.
 </p>
 </div>
 <p className="text-sm text-app-muted-foreground font-medium">
 What is the fiscal regime of your company? This determines how taxes are calculated, whether you work in HT or TTC, and your VAT obligations.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {FISCAL_REGIMES.map(fr => {
 const Icon = fr.icon; const isActive = data.fiscal_regime === fr.code
 return (
 <button key={fr.code} onClick={() => setData({ fiscal_regime: fr.code })}
 className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-300
 ${isActive ? 'border-app-border bg-app-surface text-app-foreground shadow-xl shadow-app-border/20' : 'border-app-border bg-app-surface hover:border-app-border hover:shadow-md'}`}>
 <div className="flex items-start gap-4">
 <div className={`w-12 h-12 rounded-xl ${isActive ? 'bg-app-foreground/20' : 'bg-app-info-soft'} flex items-center justify-center shrink-0`}>
 <Icon size={24} className={isActive ? 'text-app-foreground' : 'text-app-info'} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-black">{fr.name}</div>
 <div className={`text-[11px] mt-1 font-medium leading-relaxed ${isActive ? 'text-app-foreground/60' : 'text-app-muted-foreground'}`}>{fr.desc}</div>
 <div className={`mt-2 flex items-center gap-2`}>
 <Badge className={`text-[9px] font-black uppercase border-0 ${isActive ? 'bg-app-foreground/20 text-app-foreground/80' : fr.taxMode === 'HT' ? 'bg-app-info-bg text-app-info' : 'bg-app-warning-bg text-app-warning'}`}>
 {fr.taxMode === 'MIXED' ? 'HT + TTC' : fr.taxMode}
 </Badge>
 {fr.vatRecovery && <Badge className={`text-[9px] font-black uppercase border-0 ${isActive ? 'bg-app-success/10/30 text-app-foreground/80' : 'bg-app-primary-light text-app-primary'}`}>VAT Recovery</Badge>}
 </div>
 </div>
 </div>
 {isActive && <CheckCircle2 size={18} className="absolute top-3 right-3 text-app-primary" />}
 </button>
 )
 })}
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: Financial Foundation (MANDATORY - Currency + COA + FY)
// ═══════════════════════════════════════════════════════════════

function StepFinancialFoundation({ config, data, setData }: StepProps) {
 return (
 <div className="space-y-8">
 <div className="p-4 rounded-xl bg-app-error-soft border border-rose-100">
 <p className="text-xs font-bold text-app-error">
 ⚠️ All three sections below are <strong>mandatory</strong>. Without a currency, chart of accounts, and fiscal year, no financial operations can be performed.
 </p>
 </div>

 {/* Currency */}
 <div>
 <h3 className="uppercase mb-4 flex items-center gap-2">
 <Banknote size={16} className="text-app-primary" /> Base Currency <span className="text-rose-400">*</span>
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {config.currencies.map((c: any) => (
 <button key={c.id} onClick={() => setData({ base_currency_id: c.id.toString() })}
 className={`p-4 rounded-2xl border-2 text-left transition-all duration-200
 ${data.base_currency_id === c.id.toString() ? 'border-app-primary bg-app-primary-light shadow-lg shadow-emerald-100' : 'border-app-border bg-app-surface hover:border-app-border'}`}>
 <div className="text-2xl font-black mb-1">{c.symbol}</div>
 <div className="text-xs font-bold text-app-foreground uppercase">{c.code}</div>
 <div className="text-[10px] text-app-muted-foreground font-medium mt-0.5">{c.name}</div>
 {data.base_currency_id === c.id.toString() && <CheckCircle2 size={16} className="text-app-primary mt-2" />}
 </button>
 ))}
 </div>
 </div>

 {/* COA Template */}
 <div>
 <h3 className="uppercase mb-2 flex items-center gap-2">
 <BookOpen size={16} className="text-app-primary" /> Chart of Accounts <span className="text-rose-400">*</span>
 </h3>
 <p className="text-xs text-app-muted-foreground font-medium mb-4">Select the accounting standard for your country. This creates your entire account tree.</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {Object.entries(COA_DISPLAY).map(([key, info]) => (
 <button key={key} onClick={() => setData({ coa_template: key })}
 className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 flex items-start gap-4
 ${data.coa_template === key ? 'border-app-primary/30 bg-app-primary/5 shadow-lg shadow-indigo-100' : 'border-app-border bg-app-surface hover:border-app-border'}`}>
 <span className="text-3xl">{info.flag}</span>
 <div className="flex-1">
 <div className="text-sm font-black text-app-foreground">{info.name}</div>
 <div className="text-xs text-app-muted-foreground font-medium mt-0.5">{info.desc}</div>
 </div>
 {data.coa_template === key && <CheckCircle2 size={18} className="text-app-primary mt-1" />}
 </button>
 ))}
 </div>
 </div>

 {/* Fiscal Year */}
 <div>
 <h3 className="uppercase mb-2 flex items-center gap-2">
 <CalendarDays size={16} className="text-app-primary" /> Fiscal Year <span className="text-rose-400">*</span>
 </h3>
 <p className="text-xs text-app-muted-foreground font-medium mb-4">Your first accounting period. Most companies use Jan 1 — Dec 31.</p>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase tracking-wider">Name</label>
 <input type="text" value={data.fiscal_year_name} onChange={e => setData({ fiscal_year_name: e.target.value })} placeholder="FY 2026" className={INPUT_CLS} />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase tracking-wider">Start Date</label>
 <input type="date" value={data.fiscal_year_start} onChange={e => setData({ fiscal_year_start: e.target.value })} className={INPUT_CLS} />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase tracking-wider">End Date</label>
 <input type="date" value={data.fiscal_year_end} onChange={e => setData({ fiscal_year_end: e.target.value })} className={INPUT_CLS} />
 </div>
 </div>
 <div className="mt-4 p-4 rounded-xl bg-violet-50/50 border border-violet-100 flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-surface flex items-center justify-center text-app-primary shadow-sm font-black text-xs">12</div>
 <p className="text-xs text-app-primary font-medium line-clamp-1">
 We will automatically generate <strong>12 monthly periods</strong> (P01 to P12) for this fiscal year.
 </p>
 </div>
 </div>

 {/* Pricing Mode */}
 <div>
 <h3 className="uppercase mb-2 flex items-center gap-2">
 <ToggleLeft size={16} className="text-app-warning" /> Pricing Mode
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {[{ ttc: true, title: 'Tax Inclusive (TTC)', desc: 'Prices include tax. Common in retail/B2C.' },
 { ttc: false, title: 'Tax Exclusive (HT)', desc: 'Prices exclude tax. Common in B2B/wholesale.' }].map(opt => (
 <button key={String(opt.ttc)} onClick={() => setData({ works_in_ttc: opt.ttc })}
 className={`p-5 rounded-2xl border-2 text-left transition-all
 ${data.works_in_ttc === opt.ttc ? 'border-app-warning bg-app-warning-bg shadow-lg shadow-amber-100' : 'border-app-border bg-app-surface hover:border-app-border'}`}>
 <div className="text-sm font-black text-app-foreground">{opt.title}</div>
 <div className="text-xs text-app-muted-foreground font-medium mt-1">{opt.desc}</div>
 {data.works_in_ttc === opt.ttc && <CheckCircle2 size={16} className="text-app-warning mt-2" />}
 </button>
 ))}
 </div>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: Data Migration
// ═══════════════════════════════════════════════════════════════

function StepDataMigration({ config, data, setData, orgProfile }: StepProps) {
 return (
 <div className="space-y-6">
 <p className="text-sm text-app-muted-foreground font-medium">
 Now that your financial foundation is set, do you want to import existing data from another system?
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <button onClick={() => setData({ want_migration: true })}
 className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 relative
 ${data.want_migration === true ? 'border-app-warning bg-app-warning-soft shadow-lg shadow-orange-100' : 'border-app-border bg-app-surface hover:border-app-border hover:shadow-md'}`}>
 <div className="w-14 h-14 rounded-2xl bg-app-warning flex items-center justify-center mb-4 shadow-lg">
 <FileSpreadsheet size={28} className="text-app-foreground" />
 </div>
 <div className="text-lg font-black text-app-foreground">Yes, import my data</div>
 <div className="text-xs text-app-muted-foreground font-medium mt-1">Import products, contacts, or transactions from Excel, CSV, or another system</div>
 <div className="mt-3 flex items-center gap-1 text-xs font-bold text-app-warning"><ArrowUpRight size={14} /> Opens the Migration Center</div>
 {data.want_migration === true && <CheckCircle2 size={18} className="absolute top-3 right-3 text-app-warning" />}
 </button>
 <button onClick={() => setData({ want_migration: false })}
 className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 relative
 ${data.want_migration === false ? 'border-app-primary bg-app-primary-light shadow-lg shadow-emerald-100' : 'border-app-border bg-app-surface hover:border-app-border hover:shadow-md'}`}>
 <div className="w-14 h-14 rounded-2xl bg-app-primary flex items-center justify-center mb-4 shadow-lg">
 <Sparkles size={28} className="text-app-foreground" />
 </div>
 <div className="text-lg font-black text-app-foreground">No, start fresh</div>
 <div className="text-xs text-app-muted-foreground font-medium mt-1">Setting up a new business or adding data manually later</div>
 <div className="mt-3 flex items-center gap-1 text-xs font-bold text-app-primary"><ArrowRight size={14} /> Continue setup</div>
 {data.want_migration === false && <CheckCircle2 size={18} className="absolute top-3 right-3 text-app-primary" />}
 </button>
 </div>
 <div className="p-4 rounded-xl bg-app-info-bg border border-app-info/30">
 <p className="text-xs font-bold text-app-info">💡 You can always import data later from <strong>Import from Third Party</strong> in the sidebar.</p>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: Business Profile (optional)
// ═══════════════════════════════════════════════════════════════

function StepBusinessProfile({ config, data, setData }: StepProps) {
 const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (file) {
 const reader = new FileReader()
 reader.onloadend = () => setData({ logo: reader.result as string })
 reader.readAsDataURL(file)
 }
 }

 return (
 <div className="space-y-8">
 <div className="flex flex-col md:flex-row gap-8">
 {/* Logo Upload */}
 <div className="shrink-0 flex flex-col items-center">
 <label className="block text-xs font-bold text-app-muted-foreground mb-3 uppercase tracking-wider">Company Logo</label>
 <div className="relative group">
 <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-app-border bg-app-background flex items-center justify-center overflow-hidden transition-all group-hover:border-app-primary/30 group-hover:bg-app-primary/5/30">
 {data.logo ? (
 <img src={data.logo} alt="Logo" className="w-full h-full object-contain p-2" />
 ) : (
 <Camera size={32} className="text-app-muted-foreground group-hover:text-app-primary transition-colors" />
 )}
 </div>
 <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
 <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-app-surface shadow-md border border-app-border flex items-center justify-center text-app-muted-foreground group-hover:text-app-primary transition-colors">
 <Upload size={14} />
 </div>
 </div>
 </div>

 <div className="flex-1 space-y-6">
 <div>
 <h3 className="uppercase mb-4 flex items-center gap-2">
 <Building2 size={16} className="text-app-primary" /> Business Identity
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div className="md:col-span-2">
 <label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Company Name</label>
 <input type="text" value={data.business_name} onChange={e => setData({ business_name: e.target.value })} placeholder="Acme Corporation" className={INPUT_CLS} />
 </div>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Legal Entity</label>
 <select value={data.legal_entity} onChange={e => setData({ legal_entity: e.target.value })} className={INPUT_CLS}>
 <option value="INDIVIDUAL">Individual / Sole Proprietorship</option>
 <option value="SARL">SARL / limited Liability</option>
 <option value="SA">SA / Corporation</option>
 <option value="NON_PROFIT">Association / Non-Profit</option>
 <option value="OTHER">Other</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">
 <Fingerprint size={12} className="inline mr-1" /> Tax ID / VAT Number
 </label>
 <input type="text" value={data.vat_number} onChange={e => setData({ vat_number: e.target.value })} placeholder="VAT-12345678" className={INPUT_CLS} />
 </div>
 </div>
 </div>

 <div>
 <h3 className="uppercase mb-4 flex items-center gap-2">
 <Clock size={16} className="text-app-warning" /> Timezone
 </h3>
 <select value={data.timezone} onChange={e => setData({ timezone: e.target.value })} className={INPUT_CLS}>
 {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
 </select>
 </div>
 </div>
 </div>

 <div>
 <h3 className="uppercase mb-4 flex items-center gap-2"><Mail size={16} className="text-app-primary" /> Contact</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div><label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Email</label>
 <input type="email" value={data.business_email} onChange={e => setData({ business_email: e.target.value })} placeholder="hello@acme.com" className={INPUT_CLS} /></div>
 <div><label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Phone</label>
 <input type="tel" value={data.phone} onChange={e => setData({ phone: e.target.value })} placeholder="+1 555 123 4567" className={INPUT_CLS} /></div>
 <div className="md:col-span-2"><label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Website</label>
 <input type="url" value={data.website} onChange={e => setData({ website: e.target.value })} placeholder="https://www.acme.com" className={INPUT_CLS} /></div>
 </div>
 </div>
 <div>
 <h3 className="uppercase mb-4 flex items-center gap-2"><MapPinned size={16} className="text-app-primary" /> Address</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div className="md:col-span-2"><label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Street</label>
 <input type="text" value={data.address} onChange={e => setData({ address: e.target.value })} placeholder="123 Main Street" className={INPUT_CLS} /></div>
 <div><label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">City</label>
 <input type="text" value={data.city} onChange={e => setData({ city: e.target.value })} placeholder="New York" className={INPUT_CLS} /></div>
 <div><label className="block text-xs font-bold text-app-muted-foreground mb-1.5 uppercase tracking-wider">Country</label>
 <input type="text" value={data.country} onChange={e => setData({ country: e.target.value })} placeholder="United States" className={INPUT_CLS} /></div>
 </div>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: Locations (optional)
// ═══════════════════════════════════════════════════════════════

function StepLocations({ config, data, setData }: StepProps) {
 const add = () => setData({ warehouses: [...data.warehouses, { name: '', code: '', type: 'WAREHOUSE', address: '', city: '', is_company_address: false }] })
 const upd = (i: number, f: string, v: any) => {
 const u = [...data.warehouses]
 u[i] = { ...u[i], [f]: v }

 // If toggling company address, auto-fill fields
 if (f === 'is_company_address' && v === true) {
 u[i].address = data.address
 u[i].city = data.city
 }

 setData({ warehouses: u })
 }
 const rm = (i: number) => setData({ warehouses: data.warehouses.filter((_, j) => j !== i) })

 return (
 <div className="space-y-6">
 <div className="p-5 rounded-2xl bg-app-primary-light border border-app-success/30">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-primary-light text-app-primary flex items-center justify-center"><Check size={20} /></div>
 <div><p className="text-sm font-bold text-app-success">Main Warehouse already created</p>
 <p className="text-xs text-app-primary font-medium">Default &quot;Main Warehouse&quot; (WH01) was set up during registration.</p></div>
 </div>
 </div>
 {config.warehouses.length > 0 && (
 <div>
 <h3 className="uppercase mb-3">Existing ({config.warehouses.length})</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {config.warehouses.map((wh: any) => (
 <div key={wh.id} className="p-4 rounded-xl border border-app-border bg-app-surface-2/50 flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-primary/10 text-app-primary flex items-center justify-center text-xs font-black">{wh.code?.substring(0, 2) || 'WH'}</div>
 <div><p className="text-sm font-bold text-app-foreground">{wh.name}</p><p className="text-[10px] text-app-muted-foreground uppercase font-bold">{wh.code}</p></div>
 </div>
 ))}
 </div>
 </div>
 )}
 <div>
 <div className="flex items-center justify-between mb-3">
 <h3 className="uppercase">Add More</h3>
 <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-primary/5 text-app-primary font-bold text-xs hover:bg-app-primary/10 transition-all"><Plus size={14} /> Add</button>
 </div>
 {data.warehouses.length === 0 && (
 <div className="p-8 rounded-2xl border-2 border-dashed border-app-border text-center">
 <WarehouseIcon size={32} className="mx-auto text-app-muted-foreground mb-3" />
 <p className="text-sm font-bold text-app-muted-foreground">No additional locations</p>
 </div>
 )}
 <div className="space-y-4 mt-4">
 {data.warehouses.map((wh, i) => (
 <div key={i} className="p-5 rounded-2xl border border-app-border bg-app-surface space-y-4 group relative">
 <button onClick={() => rm(i)} className="absolute top-3 right-3 p-1.5 rounded-lg text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="lg:col-span-2"><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Name</label><input type="text" value={wh.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="Store Downtown" className={INPUT_CLS} /></div>
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Code</label><input type="text" value={wh.code} onChange={e => upd(i, 'code', e.target.value.toUpperCase())} placeholder="SD01" maxLength={8} className={INPUT_CLS + ' uppercase'} /></div>
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Type</label>
 <select value={wh.type} onChange={e => upd(i, 'type', e.target.value)} className={INPUT_CLS}>
 <option value="BRANCH">Branch</option><option value="STORE">Store</option><option value="WAREHOUSE">Warehouse</option><option value="VIRTUAL">Virtual</option>
 </select></div>
 </div>
 <div className="pt-2 border-t border-app-border flex items-center justify-between">
 <label className="flex items-center gap-2 cursor-pointer group/label">
 <div className="relative">
 <input type="checkbox" checked={wh.is_company_address} onChange={e => upd(i, 'is_company_address', e.target.checked)} className="sr-only" />
 <div className={`w-8 h-4 rounded-full transition-colors ${wh.is_company_address ? 'bg-app-primary' : 'bg-app-border'}`} />
 <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-app-surface transition-transform ${wh.is_company_address ? 'translate-x-4' : 'translate-x-0'}`} />
 </div>
 <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground group-hover/label:text-app-muted-foreground transition-colors flex items-center gap-1">
 <MapIcon size={10} /> Same as company address
 </span>
 </label>
 </div>
 {!wh.is_company_address && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Street Address</label><input type="text" value={wh.address} onChange={e => upd(i, 'address', e.target.value)} placeholder="123 Main St" className={INPUT_CLS} /></div>
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">City</label><input type="text" value={wh.city} onChange={e => upd(i, 'city', e.target.value)} placeholder="New York" className={INPUT_CLS} /></div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 5: CRM Setup (optional)
// ═══════════════════════════════════════════════════════════════

function StepCRMSetup({ config, data, setData }: StepProps) {
 const add = () => setData({ crm_price_groups: [...data.crm_price_groups, { name: '', description: '' }] })
 const upd = (i: number, f: string, v: any) => {
 const u = [...data.crm_price_groups]
 u[i] = { ...u[i], [f]: v }
 setData({ crm_price_groups: u })
 }
 const rm = (i: number) => setData({ crm_price_groups: data.crm_price_groups.filter((_, j) => j !== i) })

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="uppercase mb-1">Pricing Tiers</h3>
 <p className="text-xs text-app-muted-foreground">Configure default customer categories for CRM and POS.</p>
 </div>
 <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-info-bg text-app-info font-bold text-xs hover:bg-app-info-bg transition-all"><Plus size={14} /> Add Tier</button>
 </div>
 {data.crm_price_groups.length === 0 && (
 <div className="p-8 rounded-2xl border-2 border-dashed border-app-border text-center">
 <User size={32} className="mx-auto text-app-muted-foreground mb-3" />
 <p className="text-sm font-bold text-app-muted-foreground">No pricing tiers defined</p>
 </div>
 )}
 <div className="space-y-4 mt-4">
 {data.crm_price_groups.map((g, i) => (
 <div key={i} className="p-4 rounded-2xl border border-app-border bg-app-surface group relative">
 <button onClick={() => rm(i)} className="absolute top-4 right-4 p-1.5 rounded-lg text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mr-8">
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Tier Name</label><input type="text" value={g.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="VIP" className={INPUT_CLS} /></div>
 <div className="md:col-span-2"><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Description</label><input type="text" value={g.description} onChange={e => upd(i, 'description', e.target.value)} placeholder="Customers with 10%+ lifetime discount" className={INPUT_CLS} /></div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 6: HR Setup (optional)
// ═══════════════════════════════════════════════════════════════

function StepHRSetup({ config, data, setData }: StepProps) {
 const add = () => setData({ hr_departments: [...data.hr_departments, { name: '', code: '' }] })
 const upd = (i: number, f: string, v: any) => {
 const u = [...data.hr_departments]
 u[i] = { ...u[i], [f]: v }
 setData({ hr_departments: u })
 }
 const rm = (i: number) => setData({ hr_departments: data.hr_departments.filter((_, j) => j !== i) })

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="uppercase mb-1">Departments</h3>
 <p className="text-xs text-app-muted-foreground">Set up the organizational structure of your company.</p>
 </div>
 <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-success-soft text-app-success font-bold text-xs hover:bg-app-success-soft transition-all"><Plus size={14} /> Add Dept</button>
 </div>
 {data.hr_departments.length === 0 && (
 <div className="p-8 rounded-2xl border-2 border-dashed border-app-border text-center">
 <Building size={32} className="mx-auto text-app-muted-foreground mb-3" />
 <p className="text-sm font-bold text-app-muted-foreground">No departments defined</p>
 </div>
 )}
 <div className="space-y-4 mt-4">
 {data.hr_departments.map((d, i) => (
 <div key={i} className="p-4 rounded-2xl border border-app-border bg-app-surface group relative">
 <button onClick={() => rm(i)} className="absolute top-4 right-4 p-1.5 rounded-lg text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mr-8">
 <div className="md:col-span-2"><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Department Name</label><input type="text" value={d.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="Sales & Marketing" className={INPUT_CLS} /></div>
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Code</label><input type="text" value={d.code} onChange={e => upd(i, 'code', e.target.value.toUpperCase())} placeholder="SALES" maxLength={10} className={INPUT_CLS + ' uppercase'} /></div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 7: POS Setup (optional)
// ═══════════════════════════════════════════════════════════════

function StepPOSSetup({ config, data, setData }: StepProps) {
 const upd = (v: boolean) => setData({ pos_settings: { ...data.pos_settings, allow_negative_stock: v } })
 return (
 <div className="space-y-6">
 <h3 className="uppercase mb-3">POS Configuration</h3>
 <div className="p-4 rounded-2xl border border-app-border bg-app-surface">
 <div className="flex items-start justify-between">
 <div>
 <label className="block text-sm font-bold text-app-foreground mb-1">Allow Negative Stock Override</label>
 <p className="text-xs text-app-muted-foreground max-w-sm">When enabled, cashiers can sell items even if the system shows zero inventory. This is useful for high-volume retail where physical counts drift from digital counts.</p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer ml-4">
 <input type="checkbox" className="sr-only peer" checked={data.pos_settings.allow_negative_stock} onChange={e => upd(e.target.checked)} />
 <div className="w-11 h-6 bg-app-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-app-surface after:border-app-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-app-primary"></div>
 </label>
 </div>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 8: E-Commerce Setup (optional)
// ═══════════════════════════════════════════════════════════════

function StepECommerceSetup({ config, data, setData }: StepProps) {
 const upd = (k: string, v: string) => setData({ ecommerce_config: { ...data.ecommerce_config, [k]: v } })
 return (
 <div className="space-y-6">
 <h3 className="uppercase mb-3">Online Storefront</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-4 rounded-2xl border border-app-border bg-app-surface">
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-2 uppercase">Theme Primary Color</label>
 <div className="flex items-center gap-3">
 <input type="color" value={data.ecommerce_config.primary_color} onChange={e => upd('primary_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
 <span className="font-mono text-xs font-medium text-app-muted-foreground uppercase">{data.ecommerce_config.primary_color}</span>
 </div>
 </div>
 <div className="p-4 rounded-2xl border border-app-border bg-app-surface flex flex-col justify-center">
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-2 uppercase">Theme Style</label>
 <select value={data.ecommerce_config.theme} onChange={e => upd('theme', e.target.value)} className={INPUT_CLS}>
 <option value="DEFAULT">Default (Clean & Modern)</option>
 <option value="DARK">Dark Mode (Premium)</option>
 <option value="MINIMAL">Minimalist (White & Mono)</option>
 </select>
 </div>
 <div className="p-4 rounded-2xl border border-app-border bg-app-surface md:col-span-2">
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Custom Domain (Optional)</label>
 <input type="text" value={data.ecommerce_config.custom_domain} onChange={e => upd('custom_domain', e.target.value)} placeholder="shop.yourcompany.com" className={INPUT_CLS} />
 <p className="text-[10px] text-app-muted-foreground mt-2">You will need to configure DNS settings later if you provide a custom domain.</p>
 </div>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 9: Appearance — Org Default Theme (optional)
// ═══════════════════════════════════════════════════════════════

const WIZARD_THEMES: { name: AppThemeName; label: string; description: string; bg: string; primary: string; accent: string; mode: 'dark' | 'light' }[] = [
 { name: 'midnight-pro', label: 'Midnight Pro', description: 'Dark & professional', bg: '#0a0f1e', primary: '#818cf8', accent: '#312e81', mode: 'dark' },
 { name: 'ivory-market', label: 'Ivory Market', description: 'Clean & minimal light', bg: '#faf9f7', primary: '#b45309', accent: '#fef3c7', mode: 'light' },
 { name: 'neon-rush', label: 'Neon Rush', description: 'Bold cyberpunk energy', bg: '#050510', primary: '#f0abfc', accent: '#4c1d95', mode: 'dark' },
 { name: 'savane-earth', label: 'Savane Earth', description: 'Warm organic tones', bg: '#1c1510', primary: '#c08d50', accent: '#3d2b1a', mode: 'dark' },
 { name: 'arctic-glass', label: 'Arctic Glass', description: 'Cool frosted clarity', bg: '#f0f6ff', primary: '#0369a1', accent: '#bae6fd', mode: 'light' },
]

function StepAppearance({ data, setData }: StepProps) {
 return (
 <div className="space-y-6">
 <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 flex items-center gap-3">
 <Paintbrush size={18} className="text-app-primary shrink-0" />
 <p className="text-xs font-bold text-app-primary">
 Choose the <strong>default visual theme</strong> for your organisation. Every user sees this on first login — they can always change it themselves later.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {WIZARD_THEMES.map(t => {
 const isSelected = data.app_default_theme === t.name
 return (
 <button
 key={t.name}
 onClick={() => setData({ app_default_theme: t.name })}
 aria-label={`Select ${t.label} as org default theme`}
 className="relative p-5 rounded-2xl border-2 text-left transition-all duration-300"
 style={{
 background: t.bg,
 borderColor: isSelected ? t.primary : 'color-mix(in srgb, var(--app-muted-foreground) 15%, transparent)',
 boxShadow: isSelected ? `0 0 0 3px ${t.primary}33, 0 8px 24px var(--app-border)` : '0 1px 4px var(--app-border)',
 transform: isSelected ? 'scale(1.03)' : 'scale(1)',
 }}
 >
 {/* Preview swatch */}
 <div className="w-full h-14 rounded-xl mb-3 overflow-hidden" style={{ background: t.accent }}>
 <div className="w-full h-full opacity-80" style={{ background: `linear-gradient(135deg, ${t.primary}44 0%, ${t.accent} 100%)` }} />
 </div>

 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-black tracking-tight" style={{ color: t.primary }}>{t.label}</p>
 <p className="text-[10px] font-medium opacity-60" style={{ color: t.primary }}>{t.description}</p>
 </div>
 {isSelected && (
 <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: t.primary }}>
 <Check size={12} color="#fff" strokeWidth={3} />
 </div>
 )}
 </div>

 <div className="mt-2 flex gap-1">
 <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
 style={{ background: t.mode === 'dark' ? 'var(--app-border)' : 'var(--app-surface)', color: t.primary }}>
 {t.mode}
 </span>
 {isSelected && (
 <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
 style={{ background: t.primary + '22', color: t.primary }}>
 Selected
 </span>
 )}
 </div>
 </button>
 )
 })}
 </div>

 {!data.app_default_theme && (
 <p className="text-xs text-app-muted-foreground font-medium text-center">
 No theme selected — org will default to <strong>Midnight Pro</strong>. You can always change this later from <em>Settings → Appearance</em>.
 </p>
 )}
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 10: Workspace Setup (optional)
// ═══════════════════════════════════════════════════════════════

function StepWorkspaceSetup({ config, data, setData }: StepProps) {
 const add = () => setData({ workspace_checklists: [...data.workspace_checklists, { name: '', trigger: 'CUSTOM', points: 5 }] })
 const upd = (i: number, f: string, v: any) => {
 const u = [...data.workspace_checklists]
 u[i] = { ...u[i], [f]: v }
 setData({ workspace_checklists: u })
 }
 const rm = (i: number) => setData({ workspace_checklists: data.workspace_checklists.filter((_, j) => j !== i) })

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="uppercase mb-1">Daily Checklists</h3>
 <p className="text-xs text-app-muted-foreground">Define operational checklists for your team (e.g., Opening, Closing).</p>
 </div>
 <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-info-bg text-app-info font-bold text-xs hover:bg-app-info-bg transition-all"><Plus size={14} /> Add Checklist</button>
 </div>
 {data.workspace_checklists.length === 0 && (
 <div className="p-8 rounded-2xl border-2 border-dashed border-app-border text-center">
 <CheckCircle2 size={32} className="mx-auto text-app-muted-foreground mb-3" />
 <p className="text-sm font-bold text-app-muted-foreground">No checklists defined</p>
 </div>
 )}
 <div className="space-y-4 mt-4">
 {data.workspace_checklists.map((c, i) => (
 <div key={i} className="p-4 rounded-2xl border border-app-border bg-app-surface group relative">
 <button onClick={() => rm(i)} className="absolute top-4 right-4 p-1.5 rounded-lg text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mr-8">
 <div className="md:col-span-2"><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Name</label><input type="text" value={c.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="Store Opening" className={INPUT_CLS} /></div>
 <div>
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Trigger</label>
 <select value={c.trigger} onChange={e => upd(i, 'trigger', e.target.value)} className={INPUT_CLS}>
 <option value="SHIFT_START">Start of Shift</option>
 <option value="SHIFT_MID">Mid Shift</option>
 <option value="SHIFT_END">End of Shift</option>
 <option value="DAILY">Daily</option>
 <option value="CUSTOM">Custom</option>
 </select>
 </div>
 <div><label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Reward Points</label><input type="number" value={c.points} onChange={e => upd(i, 'points', parseInt(e.target.value) || 0)} className={INPUT_CLS} min={0} /></div>
 </div>
 </div>
 ))}
 </div>
 <div className="bg-app-warning-bg rounded-xl p-4 flex items-start gap-3 mt-4">
 <AlertCircle className="text-app-warning mt-1 shrink-0" size={16} />
 <p className="text-xs text-app-warning leading-relaxed">
 <strong>Note:</strong> You can add specific items (checkboxes) to these checklists later from the Workspace module. Right now, we are just creating the top-level templates.
 </p>
 </div>
 </div>
 )
}

// ═══════════════════════════════════════════════════════════════
// STEP 10: Payment Accounts (MANDATORY for operation)
// ═══════════════════════════════════════════════════════════════

function StepPaymentAccounts({ config, data, setData, orgProfile, createdAccounts = [], onAccountCreated }: StepProps) {
 const [adding, setAdding] = useState(false)
 const [name, setName] = useState('')
 const [type, setType] = useState('CASH')
 const [coa, setCoa] = useState('')
 const [saving, setSaving] = useState(false)

 // Combine server-loaded accounts with locally created ones
 const allAccounts = [...config.posAccounts, ...createdAccounts]

 // Filter COA items to only show ASSET-type accounts (Cash, Bank, etc.)
 const assetCoaItems = config.coaItems.filter((c: any) =>
 c.type === 'ASSET' || c.code?.startsWith('1') // ASSET accounts or class 1 (Assets in SYSCOHADA/PCG)
 )

 const handleAdd = async () => {
 setSaving(true)
 try {
 const cur = config.currencies.find((c: any) => c.id.toString() === data.base_currency_id)
 const res = await createFinancialAccount({
 name, type,
 currency: cur?.code || 'USD',
 is_pos_enabled: true,
 linked_coa: coa || undefined
 })
 if (res.success) {
 toast.success("Payment account created!")
 // Update local state immediately so Continue works
 if (onAccountCreated && res.data) {
 onAccountCreated(res.data)
 }
 setName(''); setAdding(false); setCoa('')
 } else toast.error(res.error)
 } finally { setSaving(false) }
 }

 // Find the selected COA label for hint
 const selectedCoa = assetCoaItems.find((c: any) => c.id.toString() === coa)

 return (
 <div className="space-y-6">
 <div className="p-4 rounded-xl bg-app-warning-bg border border-app-warning/30 flex gap-3">
 <Coins className="text-app-warning shrink-0" size={20} />
 <div>
 <p className="text-xs font-bold text-app-warning">Mandatory Payment Account</p>
 <p className="text-[11px] text-app-warning leading-relaxed mt-0.5">
 To process sales and record payments, you must have at least one <strong>POS-enabled account</strong>.
 This acts as your digital cash drawer or bank ledger.
 </p>
 </div>
 </div>

 {allAccounts.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {allAccounts.map((acc: any, idx: number) => (
 <div key={acc.id || `new-${idx}`} className="p-4 rounded-xl border border-app-success/30 bg-app-primary-light/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-surface border border-app-success/30 flex items-center justify-center text-app-primary">
 {acc.type === 'BANK' ? <Landmark size={20} /> : <Wallet size={20} />}
 </div>
 <div>
 <p className="text-sm font-bold text-app-foreground">{acc.name}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase">{acc.type}</p>
 </div>
 </div>
 <CheckCircle2 size={20} className="text-app-primary" />
 </div>
 ))}
 </div>
 )}

 {!adding ? (
 <button onClick={() => setAdding(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-app-border text-app-muted-foreground hover:border-app-primary/30 hover:text-app-primary hover:bg-app-primary/5/30 transition-all flex items-center justify-center gap-2 font-bold text-sm">
 <Plus size={18} /> Add Payment Account
 </button>
 ) : (
 <div className="p-6 rounded-2xl border-2 border-app-primary/30 bg-app-surface space-y-4 animate-in slide-in-from-top-4 duration-300">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="md:col-span-2">
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Account Name</label>
 <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Main Cash Register" className={INPUT_CLS} />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Type</label>
 <select value={type} onChange={e => setType(e.target.value)} className={INPUT_CLS}>
 <option value="CASH">Cash Drawer</option>
 <option value="BANK">Bank Account</option>
 <option value="MOBILE">Mobile Wallet</option>
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-app-muted-foreground mb-1 uppercase">Ledger Parent (COA)</label>
 <select value={coa} onChange={e => setCoa(e.target.value)} className={INPUT_CLS}>
 <option value="">Auto-assign...</option>
 {assetCoaItems.map((c: any) => (
 <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
 ))}
 </select>
 </div>
 </div>
 {selectedCoa && (
 <div className="p-3 rounded-lg bg-app-info-soft border border-sky-100 text-[11px] text-app-info">
 <span className="font-bold">📂 COA Mapping:</span> A child account will be created under <strong>{selectedCoa.code} - {selectedCoa.name}</strong> (e.g., <code>{selectedCoa.code}.001 - {name || 'Account Name'}</code>)
 </div>
 )}
 <div className="flex gap-2">
 <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-app-muted-foreground hover:bg-app-background flex-1">Cancel</button>
 <button onClick={handleAdd} disabled={!name || saving} className="px-4 py-2 rounded-xl bg-app-primary text-app-foreground text-xs font-bold flex-1 disabled:opacity-50">
 {saving ? 'Creating...' : 'Create Account'}
 </button>
 </div>
 </div>
 )}
 </div>
 )
}
// ═══════════════════════════════════════════════════════════════
// STEP 6: Launch
// ═══════════════════════════════════════════════════════════════

function StepLaunch({ config, data, setData, orgProfile }: StepProps) {
 const cur = config.currencies.find((c: any) => c.id.toString() === data.base_currency_id)
 const coa = COA_DISPLAY[data.coa_template]
 const fr = FISCAL_REGIMES.find(r => r.code === data.fiscal_regime)
 return (
 <div className="space-y-6">
 <div className="text-center mb-8">
 <div className="w-20 h-20 rounded-[2rem] bg-app-primary flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-emerald-200"><Rocket size={36} className="text-app-foreground" /></div>
 <h3>Everything looks great!</h3>
 <p className="text-sm text-app-muted-foreground mt-1 font-medium">Review your setup and launch</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Card className="rounded-2xl border-app-border shadow-sm"><CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3"><Scale size={16} className="text-app-info" /><span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Fiscal Regime</span></div>
 <p className="text-lg font-black text-app-foreground">{fr?.name || data.fiscal_regime}</p>
 <p className="text-xs text-app-muted-foreground mt-1">{fr?.taxMode === 'HT' ? 'Tax Exclusive (HT)' : fr?.taxMode === 'MIXED' ? 'Mixed (HT + TTC)' : 'Tax Inclusive (TTC)'}</p>
 </CardContent></Card>
 <Card className="rounded-2xl border-app-border shadow-sm"><CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3"><Landmark size={16} className="text-app-primary" /><span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Financial</span></div>
 {cur && <div className="flex items-center gap-2"><span className="text-lg font-black">{cur.symbol}</span><span className="text-sm font-bold text-app-muted-foreground">{cur.code}</span></div>}
 {coa && <p className="text-xs text-app-muted-foreground mt-1">{coa.flag} {coa.name}</p>}
 <p className="text-xs text-app-muted-foreground">{data.works_in_ttc ? 'Tax Inclusive' : 'Tax Exclusive'}</p>
 </CardContent></Card>
 <Card className="rounded-2xl border-app-border shadow-sm"><CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3"><CalendarDays size={16} className="text-app-primary" /><span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Fiscal Year</span></div>
 <p className="text-lg font-black text-app-foreground">{data.fiscal_year_name}</p>
 <p className="text-xs text-app-muted-foreground">{data.fiscal_year_start} → {data.fiscal_year_end}</p>
 </CardContent></Card>
 <Card className="rounded-2xl border-app-border shadow-sm"><CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3"><MapPin size={16} className="text-app-primary" /><span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Locations</span></div>
 <p className="text-lg font-black text-app-foreground">{config.warehouses.length + data.warehouses.filter(w => w.name).length}</p>
 <p className="text-xs text-app-muted-foreground">{config.warehouses.length} existing + {data.warehouses.filter(w => w.name).length} new</p>
 </CardContent></Card>
 <Card className="rounded-2xl border-app-border shadow-sm"><CardContent className="p-5">
 <div className="flex items-center gap-2 mb-3"><Coins size={16} className="text-app-warning" /><span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Payments</span></div>
 <p className="text-lg font-black text-app-foreground">{config.posAccounts.length}</p>
 <p className="text-xs text-app-muted-foreground">POS-enabled accounts ready</p>
 </CardContent></Card>
 </div>
 <Card className="rounded-[2rem] border-app-success/30 bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden">
 <CardContent className="p-8">
 <div className="text-sm font-black text-app-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
 <Sparkles size={16} className="text-app-primary" /> What happens next?
 </div>
 <div className="space-y-4">
 {[
 { title: 'POS Initialization', desc: 'A default "Main Register" has been created and linked to your first cash drawer.' },
 { title: 'Modules Activation', desc: 'Your subscription plan (Standard/Premium) will automatically enable relevant modules.' },
 { title: 'Master Data Setup', desc: 'You should start by adding your Products, Customers, and Suppliers in the sidebar.' },
 { title: 'Opening Balances', desc: 'Use the Finance module to record your initial cash/bank balances.' },
 { title: 'Team Access', desc: 'Invite your colleagues from the Users & Roles menu to start collaborating.' }
 ].map((item, i) => (
 <div key={i} className="flex gap-4 group">
 <div className="w-6 h-6 rounded-full bg-app-surface border border-app-success/30 text-[10px] font-black text-app-primary flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
 {i + 1}
 </div>
 <div>
 <p className="text-sm font-bold text-app-foreground mb-0.5">{item.title}</p>
 <p className="text-xs text-app-muted-foreground leading-relaxed">{item.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 <div className="p-5 rounded-2xl bg-app-surface text-app-foreground shadow-xl shadow-app-border/20">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-app-primary flex items-center justify-center shrink-0">
 <Rocket size={20} className="text-app-foreground" />
 </div>
 <div>
 <p className="text-sm font-bold">Ready to go live!</p>
 <p className="text-xs text-app-foreground/60 mt-1 leading-relaxed">
 By clicking launch, your <span className="text-app-primary font-bold">{data.fiscal_year_name}</span> will be initialized and you&apos;ll be redirected to your new dashboard.
 </p>
 </div>
 </div>
 </div>
 </div>
 )
}

function LaunchAnimation() {
 return (
 <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
 <div className="text-center animate-in fade-in zoom-in-95 duration-700">
 <div className="relative mx-auto mb-6">
 <div className="w-24 h-24 rounded-[2rem] bg-app-primary flex items-center justify-center shadow-2xl shadow-emerald-200 animate-bounce"><CheckCircle2 size={48} className="text-app-foreground" /></div>
 <div className="absolute -inset-4 rounded-[3rem] bg-app-success/10/20 animate-ping" />
 </div>
 <h2 className="mb-2">You&apos;re all set! 🎉</h2>
 <p className="text-sm text-app-muted-foreground font-medium mb-6">Redirecting to your dashboard...</p>
 <div className="flex items-center justify-center gap-2">
 <div className="w-2 h-2 rounded-full bg-app-primary animate-bounce" style={{ animationDelay: '0s' }} />
 <div className="w-2 h-2 rounded-full bg-app-primary animate-bounce" style={{ animationDelay: '0.15s' }} />
 <div className="w-2 h-2 rounded-full bg-app-primary animate-bounce" style={{ animationDelay: '0.3s' }} />
 </div>
 </div>
 </div>
 )
}
