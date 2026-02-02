'use client'

import { useState, useActionState, useEffect } from "react";
import { registerUserAction, getPublicConfig } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function UserRegisterPage() {
    const [state, action, isPending] = useActionState(registerUserAction, null);
    const [config, setConfig] = useState<any>({ tenant: { roles: [] } });

    useEffect(() => {
        getPublicConfig().then(setConfig);
    }, []);

    if (state?.success) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Card className="w-[400px]">
                    <CardHeader>
                        <CardTitle className="text-green-600">Registration Submitted</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p>Your account has been created successfully.</p>
                        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                            <p className="text-yellow-800 font-semibold">Pending Approval</p>
                            <p className="text-sm text-yellow-700 mt-1">
                                An administrator must review and approve your account before you can log in.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => window.location.href = '/login'}>
                            Return to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const tenantName = config.tenant?.name || "TSF Cloud";
    const roles = config.tenant?.roles || [];

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50 py-10">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Join {tenantName}</CardTitle>
                    <CardDescription>Create your employee account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={action} className="space-y-4">
                        {state?.error?.root && (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{state.error.root}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name">First Name</Label>
                                <Input id="first_name" name="first_name" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" name="last_name" required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" required />
                            {state?.error?.email && <p className="text-red-500 text-sm">{state.error.email}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" name="username" required />
                            {state?.error?.username && <p className="text-red-500 text-sm">{state.error.username}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Requested Role</Label>
                            <Select name="role_id" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.length > 0 ? (
                                        roles.map((r: any) => (
                                            <SelectItem key={r.id} value={r.id.toString()}>
                                                {r.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="0" disabled>No public roles available</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {state?.error?.role_id && <p className="text-red-500 text-sm">{state.error.role_id}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" name="phone" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dob">Date of Birth</Label>
                                <Input id="dob" name="date_of_birth" type="date" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Address / Location</Label>
                            <Input id="address" name="address" />
                        </div>

                        <Button type="submit" className="w-full mt-4" disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign Up"}
                        </Button>

                        <div className="text-center text-sm text-gray-500 mt-2">
                            Already have an account? <a href="/login" className="text-blue-600 hover:underline">Log in</a>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
