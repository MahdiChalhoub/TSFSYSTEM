'use client'

import { useActionState, useEffect, useState, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { loginAction } from "@/app/actions/auth";
import { getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const initialState = {
    error: {},
};

function LoginContent() {
    const [state, action, isPending] = useActionState(loginAction, initialState);
    const [config, setConfig] = useState<any>({ tenant: null }); // Init null to distinguish 'loading' vs 'no tenant'
    const searchParams = useSearchParams();

    let prefilledUsername = "";
    const uParam = searchParams.get('u');
    const userParam = searchParams.get('username');

    if (uParam) {
        try {
            prefilledUsername = atob(uParam);
        } catch (e) {
            console.error("Failed to decode username");
        }
    } else if (userParam) {
        prefilledUsername = userParam;
    }

    useEffect(() => {
        getPublicConfig().then(setConfig);
    }, []);

    const tenant = config.tenant;
    // If tenant is null/empty object after loading (config usually returns empty tenant obj if root), check logic
    // Backend returns "tenant": {} if no tenant context.
    const isRoot = !tenant || !tenant.name;

    const tenantName = tenant?.name || "TSF Cloud";
    const tenantLogo = tenant?.logo;
    const sites = tenant?.sites || [];

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                {tenantLogo && (
                    <div className="flex justify-center mb-4">
                        <img src={tenantLogo} alt="Logo" className="h-16 object-contain" />
                    </div>
                )}
                <CardTitle className="text-2xl font-bold">{tenantName}</CardTitle>
                <CardDescription>
                    {isRoot ? "Enter your workspace details to continue" : "Enter your credentials to access the ERP"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={action} className="space-y-4">
                    {state?.error?.root && (
                        <Alert variant="destructive">
                            <AlertDescription>{state.error.root[0]}</AlertDescription>
                        </Alert>
                    )}

                    {/* If Root, show Workspace ID Input */}
                    {isRoot && (
                        <div className="space-y-2">
                            <Label htmlFor="slug">Workspace ID / Business Name</Label>
                            <div className="flex items-center space-x-2">
                                <Input id="slug" name="slug" placeholder="e.g. acme" required className="flex-1" />
                            </div>
                            <p className="text-xs text-gray-500">Enter your Workspace ID to continue.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            name="username"
                            placeholder="jdoe"
                            required
                            defaultValue={prefilledUsername}
                        />
                        {state?.error?.username && (
                            <p className="text-sm text-red-500">{state.error.username[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" name="password" type="password" required />
                        {state?.error?.password && (
                            <p className="text-sm text-red-500">{state.error.password[0]}</p>
                        )}
                    </div>

                    {sites.length > 0 && !isRoot && (
                        <div className="space-y-2">
                            <Label htmlFor="site">Select Branch</Label>
                            <Select name="site_id" defaultValue={sites[0]?.id?.toString()}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sites.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isRoot ? "Find Workspace" : "Sign In")}
                    </Button>

                    <div className="text-center text-sm text-gray-500 mt-2 space-y-2">
                        <div>
                            <a href="/register/user" className="text-blue-600 hover:underline">Request Account Access</a>
                        </div>
                        {isRoot && (
                            <div>
                                <a href="/register/business" className="text-gray-400 hover:text-gray-600 text-xs">Register New Business</a>
                            </div>
                        )}
                    </div>

                </form>
            </CardContent>
            <CardFooter className="justify-center text-xs text-gray-400">
                SECURED BY TSF CLOUD
            </CardFooter>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
            <Suspense fallback={<Loader2 className="animate-spin" />}>
                <LoginContent />
            </Suspense>
        </div>
    );
}
