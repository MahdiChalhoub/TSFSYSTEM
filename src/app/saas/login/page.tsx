'use client'

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Command } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/branding";

const initialState: { error: Record<string, any>; success?: boolean } = {
    error: {},
};

export default function SaaSLoginPage() {
    const [state, action, isPending] = useActionState(loginAction, initialState);

    return (
        <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden">
            {/* Tactical Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-20 dark:opacity-5" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-app-bg/80 to-app-bg pointer-events-none" />

            <Card className="w-full max-w-lg bg-app-surface/90 backdrop-blur-xl border-app-border shadow-xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-app-primary to-transparent opacity-50" />

                <CardHeader className="text-center pb-2 pt-8">
                    <div className="w-16 h-16 rounded-xl bg-app-primary/10 border border-app-primary/20 flex items-center justify-center text-app-primary mx-auto mb-4 shadow-[0_0_20px_var(--app-primary-rgb)]">
                        <Command size={32} />
                    </div>
                    <CardTitle className="text-2xl font-black text-app-text uppercase tracking-widest">Admin Login</CardTitle>
                    <CardDescription className="font-mono text-app-primary/80 text-xs mt-2 uppercase tracking-widest">Restricted Access // Level 5 Clearance</CardDescription>
                </CardHeader>

                <CardContent className="p-8 space-y-6">
                    <form action={action} className="space-y-6">
                        {(state?.error as any)?.root && (
                            <div className="p-3 bg-app-error-bg border border-app-error/20 rounded text-app-error text-xs font-mono mb-4 text-center">
                                {(state?.error as any).root[0]}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Hidden slug field to ensure correct redirection after login */}
                            <input type="hidden" name="slug" value="saas" />

                            <div className="space-y-1">
                                <Label className="text-[10px] text-app-text-muted uppercase tracking-widest font-bold">Commander ID</Label>
                                <Input
                                    name="username"
                                    required
                                    autoComplete="off"
                                    className="bg-app-surface border-app-border h-12 text-app-text font-mono focus:ring-app-primary/30 focus:border-app-primary/50 placeholder:text-app-text-muted/50"
                                    placeholder="IDENTIFIER"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-app-text-muted uppercase tracking-widest font-bold">Access Key</Label>
                                <Input
                                    name="password"
                                    type="password"
                                    required
                                    className="bg-app-surface border-app-border h-12 text-app-text font-mono focus:ring-app-primary/30 focus:border-app-primary/50 placeholder:text-app-text-muted/50"
                                    placeholder="••••••••••••"
                                />
                            </div>
                        </div>

                        <Button className="w-full h-14 bg-app-primary hover:bg-app-primary/90 text-primary-foreground font-bold tracking-widest uppercase transition-all shadow-md shadow-app-primary/20" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin" /> : "Sign In"}
                        </Button>
                    </form>

                    <div className="flex justify-center pt-4 opacity-30 hover:opacity-100 transition-opacity">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-app-primary font-mono">
                            {PLATFORM_CONFIG.name} Control v{PLATFORM_CONFIG.version}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
