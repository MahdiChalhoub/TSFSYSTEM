'use client'

import { useState, useActionState, useEffect } from "react";
import { registerBusinessAction, getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Helper to slugify text
const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};

export default function BusinessRegisterPage() {
    const [state, action, isPending] = useActionState(registerBusinessAction, null);
    const [config, setConfig] = useState<{ business_types: any[], currencies: any[] }>({ business_types: [], currencies: [] });
    const [businessName, setBusinessName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    useEffect(() => {
        getPublicConfig().then(setConfig);
    }, []);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        setBusinessName(name);
        if (!slugManuallyEdited) {
            setSlug(slugify(name));
        }
    };

    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value);
        setSlugManuallyEdited(true);
    };

    if (state?.success && state?.login_url) {
        window.location.href = state.login_url;
        return (
            <div className="flex justify-center items-center h-screen">
                <Card className="w-[400px]">
                    <CardContent className="pt-6 text-center">
                        <h2 className="text-xl font-bold text-green-600 mb-2">Registration Successful!</h2>
                        <p>Redirecting you to your new workspace...</p>
                        <Loader2 className="mx-auto mt-4 h-8 w-8 animate-spin text-green-600" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50 py-10">
            {/* Removed w-full max-w-2xl constraints if they were causing layout issues, 
          but usually Card overflow needs visible for Select to pop out properly 
          if using Portal. Radix Select uses Portal by default so overflow shouldn't kill it.
          "Collapsed with other name" usually means z-index overlap. 
      */}
            <Card className="w-full max-w-2xl relative z-0">
                <CardHeader>
                    <CardTitle>Register Your Business</CardTitle>
                    <CardDescription>Start your journey with TSF Cloud ERP</CardDescription>
                </CardHeader>
                <CardContent className="overflow-visible"> {/* Ensure content allows popovers */}
                    <form action={action} className="space-y-6">
                        {state?.error?.root && (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{state.error.root}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Business Info */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Business Details</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="business_name">Business Name</Label>
                                    <Input
                                        id="business_name"
                                        name="business_name"
                                        required
                                        placeholder="Acme Corp"
                                        value={businessName}
                                        onChange={handleNameChange}
                                    />
                                    {state?.error?.business_name && <p className="text-red-500 text-sm">{state.error.business_name}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="slug">Workspace ID (Slug)</Label>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-gray-500 text-sm">https://</span>
                                        <Input
                                            id="slug"
                                            name="slug"
                                            required
                                            placeholder="acme-corp"
                                            value={slug}
                                            onChange={handleSlugChange}
                                            className="font-mono text-sm"
                                        />
                                        <span className="text-gray-500 text-sm">.tsfcloud.com</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">This will be your unique URL.</p>
                                    {state?.error?.slug && <p className="text-red-500 text-sm">{state.error.slug}</p>}
                                </div>

                                <div className="space-y-2 relative">
                                    <Label htmlFor="business_type">Business Type</Label>
                                    <Select name="business_type_id" required>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] overflow-y-auto z-50">
                                            {config.business_types.map((t: any) => (
                                                <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2 relative">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Select name="currency_id" required defaultValue="1">
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select currency" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px] overflow-y-auto z-50">
                                            {config.currencies.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.code})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Business Email</Label>
                                    <Input id="email" name="email" type="email" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input id="phone" name="phone" />
                                </div>
                            </div>

                            {/* Admin Info */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Super Admin</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="admin_first_name">First Name</Label>
                                        <Input id="admin_first_name" name="admin_first_name" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="admin_last_name">Last Name</Label>
                                        <Input id="admin_last_name" name="admin_last_name" required />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="admin_email">Admin Email</Label>
                                    <Input id="admin_email" name="admin_email" type="email" required />
                                    {state?.error?.admin_email && <p className="text-red-500 text-sm">{state.error.admin_email}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="admin_username">Username</Label>
                                    <Input id="admin_username" name="admin_username" required />
                                    {state?.error?.admin_username && <p className="text-red-500 text-sm">{state.error.admin_username}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="admin_password">Password</Label>
                                    <Input id="admin_password" name="admin_password" type="password" required />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button type="submit" className="w-full" size="lg" disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Register Business & Create Workspace"}
                            </Button>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
