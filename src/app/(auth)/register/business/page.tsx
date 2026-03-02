"use client"
import { useState, useActionState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { registerBusinessAction, getPublicConfig } from "@/app/actions/onboarding";
import { PublicConfig } from "@/types/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Building2, ShieldCheck, Sparkles, ArrowRight, CheckCircle2, Globe, Rocket } from "lucide-react";
import { PLATFORM_CONFIG, useDynamicBranding } from "@/lib/saas_config";
import { PasswordStrength } from "@/components/ui/password-strength";
const slugify = (text: string) => {
 return text
 .toString()
 .toLowerCase()
 .trim()
 .replace(/\s+/g, '-')
 .replace(/[^\w\-]+/g, '')
 .replace(/\-\-+/g, '-');
};
function BusinessRegisterContent() {
 const searchParams = useSearchParams();
 const [state, action, isPending] = useActionState(registerBusinessAction, null);
 const [config, setConfig] = useState<PublicConfig>({ business_types: [], currencies: [] });
 const [businessName, setBusinessName] = useState("");
 const [slug, setSlug] = useState("");
 const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
 // Multi-Step State
 const [step, setStep] = useState(1);
 const [logoPreview, setLogoPreview] = useState<string | null>(null);
 const [businessTypeId, setBusinessTypeId] = useState<string>("");
 const [currencyId, setCurrencyId] = useState<string>("1");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [adminPassword, setAdminPassword] = useState("");
 const [stepErrors, setStepErrors] = useState<string[]>([]);
 const branding = useDynamicBranding();
 useEffect(() => {
 getPublicConfig().then(setConfig).catch(() => { });
 const initialSlug = searchParams.get('slug');
 const initialName = searchParams.get('name');
 if (initialSlug) { setSlug(initialSlug); setSlugManuallyEdited(true); }
 if (initialName) { setBusinessName(initialName); }
 }, [searchParams]);
 const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const name = e.target.value;
 setBusinessName(name);
 if (!slugManuallyEdited) setSlug(slugify(name));
 };
 const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => setLogoPreview(reader.result as string);
 reader.readAsDataURL(file);
 }
 };
 if (state?.success && state?.login_url) {
 window.location.href = state.login_url;
 return (
 <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
 <div className="absolute inset-0 bg-emerald-500/5 blur-[160px] rounded-full" />
 <Card className="w-full max-w-md bg-[#0f172a]/60 border-emerald-500/20 backdrop-blur-[40px] rounded-[2.5rem] text-center p-12 relative z-10 transition-all duration-1000">
 <Rocket className="mx-auto text-emerald-400 mb-6 animate-bounce" size={48} />
 <h2 className="text-3xl font-black text-white tracking-tighter italic mb-4 uppercase">Registration Complete</h2>
 <p className="text-app-text-faint font-medium mb-8">Your workspace is being set up. You'll be redirected shortly.</p>
 <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" />
 </Card>
 </div>
 );
 }
 const steps = [
 { id: 1, name: "Admin Setup", icon: ShieldCheck },
 { id: 2, name: "Business Identity", icon: Building2 },
 { id: 3, name: "Location & Contact", icon: Globe },
 ];
 return (
 <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 py-20 relative overflow-hidden">
 {/* Ambient Background Elements */}
 <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 blur-[160px] rounded-full" />
 <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[160px] rounded-full" />
 <div className="text-center mb-12 space-y-4 relative z-10 w-full max-w-lg">
 <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-4 backdrop-blur-xl">
 <Sparkles size={14} className="animate-pulse" />
 New Business Setup
 </div>
 <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter italic uppercase">
 Initialize <span className="text-transparent bg-clip-text bg-gradient-to-br from-amber-400 to-emerald-400 not-italic">{PLATFORM_CONFIG.name.split(' ')[0]}</span>
 </h1>
 </div>
 {/* Tactical Stepper Ribbon */}
 <div className="w-full max-w-4xl px-12 mb-12 relative z-10">
 <div className="flex items-center justify-between relative">
 <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -translate-y-1/2 z-0" />
 <div
 className="absolute top-1/2 left-0 h-[2px] bg-cyan-500 -translate-y-1/2 z-0 transition-all duration-500"
 style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
 />
 {steps.map((s) => (
 <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
 <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step >= s.id ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-slate-900 border-slate-700 text-app-text-muted'
 }`}>
 <span className="font-mono text-xs font-black">{s.id.toString().padStart(2, '0')}</span>
 </div>
 <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${step >= s.id ? 'text-cyan-400' : 'text-app-text-muted'
 }`}>
 {s.name}
 </span>
 </div>
 ))}
 </div>
 </div>
 <Card className="w-full max-w-4xl bg-[#0f172a]/80 border-white/5 backdrop-blur-[40px] rounded-[3rem] overflow-hidden shadow-2xl relative z-10">
 <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
 <CardContent className="p-10 md:p-16">
 <form action={action} className="space-y-12">
 {/* Error Reporting */}
 {((state as any)?.error?.root || state?.error) && (
 <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in zoom-in-95">
 <AlertCircle size={16} />
 <div className="flex-1">
 {(state as any).error.root ? (Array.isArray((state as any).error.root) ? (state as any).error.root[0] : (state as any).error.root) : "Registration failed. Please check your details and try again."}
 {Object.keys((state as any).error || {}).map(k => k !== 'root' && (
 <div key={k} className="mt-1 opacity-80 uppercase tracking-tighter">Field Error: {k}</div>
 ))}
 </div>
 </div>
 )}
 {/* STEP 01: Admin Authorization */}
 <div className={step === 1 ? "space-y-8 animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
 <div className="flex items-center gap-3 mb-8">
 <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
 <ShieldCheck size={24} />
 </div>
 <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Admin Account</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Admin First Name</Label>
 <Input name="admin_first_name" required className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-bold focus:ring-2 focus:ring-cyan-500/20" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Admin Last Name</Label>
 <Input name="admin_last_name" required className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-bold focus:ring-2 focus:ring-cyan-500/20" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Username</Label>
 <Input name="admin_username" required className="bg-slate-900/50 border-white/10 h-14 rounded-xl font-mono text-cyan-400 focus:ring-2 focus:ring-cyan-500/20" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Email</Label>
 <Input name="admin_email" type="email" required className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium focus:ring-2 focus:ring-cyan-500/20" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Password</Label>
 <Input name="admin_password" type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/20" />
 <PasswordStrength password={adminPassword} />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Confirm Password</Label>
 <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/20" />
 </div>
 </div>
 {stepErrors.length > 0 && (
 <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold animate-in zoom-in-95">
 <div className="flex items-center gap-2 mb-1"><AlertCircle size={14} /> Please fix the following:</div>
 <ul className="list-disc list-inside space-y-0.5">{stepErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
 </div>
 )}
 <div className="pt-8">
 <Button type="button" onClick={() => {
 const form = document.querySelector('form');
 const errors: string[] = [];
 const firstName = (form?.querySelector('[name=admin_first_name]') as HTMLInputElement)?.value?.trim();
 const lastName = (form?.querySelector('[name=admin_last_name]') as HTMLInputElement)?.value?.trim();
 const username = (form?.querySelector('[name=admin_username]') as HTMLInputElement)?.value?.trim();
 const email = (form?.querySelector('[name=admin_email]') as HTMLInputElement)?.value?.trim();
 const password = (form?.querySelector('[name=admin_password]') as HTMLInputElement)?.value;
 if (!firstName) errors.push('First name is required');
 if (!lastName) errors.push('Last name is required');
 if (!username) errors.push('Username is required');
 if (!email) errors.push('Email is required');
 if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
 if (password !== confirmPassword) errors.push('Passwords do not match');
 setStepErrors(errors);
 if (errors.length === 0) setStep(2);
 }} className="w-full h-16 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-lg rounded-2xl shadow-xl transition-all">
 Next: Business Identity <ArrowRight className="ml-2" />
 </Button>
 </div>
 </div>
 {/* STEP 02: Business Identity */}
 <div className={step === 2 ? "space-y-8 animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
 <div className="flex items-center gap-3 mb-8">
 <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
 <Building2 size={24} />
 </div>
 <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Business Details</h3>
 </div>
 <div className="space-y-8">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Business Name</Label>
 <Input
 name="business_name"
 required
 placeholder="e.g. Acme Corp"
 value={businessName}
 onChange={handleNameChange}
 className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-bold focus:ring-2 focus:ring-amber-500/20"
 />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Workspace URL (Slug)</Label>
 <div className="flex items-center gap-2 group">
 <div className="bg-slate-900 border border-white/10 h-14 rounded-xl flex items-center px-4 font-mono text-[10px] text-app-text-muted">https://</div>
 <Input
 name="slug"
 required
 placeholder="acme-corp"
 value={slug}
 onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
 className="bg-slate-900/50 border-white/10 h-14 rounded-xl font-mono text-amber-400 text-sm flex-1"
 />
 <div className="bg-slate-900 border border-white/10 h-14 rounded-xl flex items-center px-4 font-mono text-[10px] text-app-text-muted">{branding.suffix}</div>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-8">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Business Type</Label>
 <Select name="business_type_id" value={businessTypeId} onValueChange={setBusinessTypeId}>
 <SelectTrigger className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium">
 <SelectValue placeholder="Select type" />
 </SelectTrigger>
 <SelectContent className="bg-slate-900 border-white/10 text-white">
 {(config.business_types ?? []).map((t: Record<string, any>) => (
 <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Currency</Label>
 <Select name="currency_id" value={currencyId} onValueChange={setCurrencyId}>
 <SelectTrigger className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium">
 <SelectValue placeholder="Select currency" />
 </SelectTrigger>
 <SelectContent className="bg-slate-900 border-white/10 text-white">
 {(config.currencies ?? []).map((c: Record<string, any>) => (
 <SelectItem key={c.id} value={c.id.toString()}>{c.code}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 <div className="pt-8 flex gap-4">
 <Button type="button" onClick={() => setStep(1)} variant="outline" className="h-16 flex-1 rounded-2xl border-white/10 text-app-text-faint hover:bg-white/5">Back</Button>
 <Button
 type="button"
 onClick={() => {
 if (!businessTypeId) {
 setStepErrors(['Please select a Business Type']);
 return;
 }
 setStepErrors([]);
 setStep(3);
 }}
 className="h-16 flex-[2] bg-amber-600 hover:bg-amber-500 text-white font-black text-lg rounded-2xl shadow-xl"
 >
 Next: Location Setup <ArrowRight className="ml-2" />
 </Button>
 </div>
 </div>
 {/* STEP 03: Location & Infrastructure */}
 <div className={step === 3 ? "space-y-8 animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
 <div className="flex items-center gap-3 mb-8">
 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
 <Globe size={24} />
 </div>
 <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Location & Contact</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
 {/* Left Side: Media & Core Info */}
 <div className="space-y-8">
 <div className="space-y-4">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Logo (Optional)</Label>
 <div className="flex items-center gap-4">
 <div className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden">
 {logoPreview ? (
 <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
 ) : (
 <Building2 className="text-slate-700" size={32} />
 )}
 </div>
 <div className="flex-1">
 <Input name="logo" type="file" accept="image/*" onChange={handleLogoChange} className="bg-slate-900/50 border-white/10 h-10 rounded-lg text-xs file:bg-transparent file:border-0 file:text-[10px] file:text-cyan-400 file:font-black text-app-text-muted" />
 <p className="text-[8px] text-app-text-muted mt-2 uppercase tracking-tight">SVG, PNG, or JPG. Max 5MB recommended.</p>
 </div>
 </div>
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Official Website (Optional)</Label>
 <Input name="website" placeholder="https://..." className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium focus:ring-2 focus:ring-emerald-500/20" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Business Email</Label>
 <Input name="email" type="email" required placeholder="contact@hq.com" className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Phone</Label>
 <Input name="phone" placeholder="+1..." className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium" />
 </div>
 </div>
 </div>
 {/* Right Side: Location Info */}
 <div className="space-y-8">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Address</Label>
 <Input name="address" placeholder="HQ Physical Address" className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">City</Label>
 <Input name="city" className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Zip Code</Label>
 <Input name="zip_code" className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium font-mono" />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Country</Label>
 <Input name="country" placeholder="e.g. United Kingdom" className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium" />
 </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] uppercase tracking-widest font-black text-app-text-muted ml-1">Province (State)</Label>
 <Input name="state" className="bg-slate-900/50 border-white/10 h-14 rounded-xl text-white font-medium" />
 </div>
 </div>
 </div>
 </div>
 <div className="pt-8 flex gap-4">
 <Button type="button" onClick={() => setStep(2)} variant="outline" className="h-16 flex-1 rounded-2xl border-white/10 text-app-text-faint hover:bg-white/5">Back</Button>
 <Button type="submit" disabled={isPending} className="h-20 flex-[3] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-emerald-500/20 shadow-2xl transition-all active:scale-[0.98] group">
 {isPending ? <Loader2 className="animate-spin" /> : (
 <div className="flex items-center gap-3">
 Register Business <ArrowRight className="group-hover:translate-x-2 transition-transform" />
 </div>
 )}
 </Button>
 </div>
 </div>
 </form>
 </CardContent>
 <CardFooter className="bg-black/20 py-8 justify-center border-t border-white/5">
 <div className="grid grid-cols-4 gap-4 text-center text-[8px] font-black uppercase tracking-[0.4em] text-app-text-muted">
 <div className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-cyan-500" /> Authorized access</div>
 <div className="flex items-center gap-1.5"><Building2 size={12} className="text-amber-500" /> multi-tenant</div>
 <div className="flex items-center gap-1.5"><Globe size={12} className="text-emerald-500" /> Isolated stack</div>
 <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-400" /> compliance a-1</div>
 </div>
 </CardFooter>
 </Card>
 </div>
 );
}
export default function BusinessRegisterPage() {
 return (
 <Suspense fallback={
 <div className="min-h-screen bg-[#020617] flex items-center justify-center">
 <Loader2 className="animate-spin text-amber-500 h-12 w-12" />
 </div>
 }>
 <BusinessRegisterContent />
 </Suspense>
 );
}
