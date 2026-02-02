'use client'

import { useState, useEffect } from "react";
import { fetchPendingUsers, approveUserAction, rejectUserAction } from "@/app/actions/manager";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, UserCheck } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner or useToast is available, otherwise alert

export default function ApprovalsPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchPendingUsers();
        setUsers(data);
        setLoading(false);
    };

    const handleApprove = async (id: number) => {
        setProcessing(id);
        const res = await approveUserAction(id);
        if (res.success) {
            toast.success("User approved");
            await loadData();
        } else {
            toast.error("Failed to approve");
        }
        setProcessing(null);
    };

    const handleReject = async (id: number) => {
        if (!confirm("Are you sure you want to reject this user?")) return;
        setProcessing(id);
        const res = await rejectUserAction(id);
        if (res.success) {
            toast.success("User rejected");
            await loadData();
        } else {
            toast.error("Failed to reject");
        }
        setProcessing(null);
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
                <Button variant="outline" onClick={loadData}>Refresh</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registration Requests</CardTitle>
                    <CardDescription>Review and approve new user sign-ups.</CardDescription>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <UserCheck className="mx-auto h-12 w-12 mb-4 opacity-20" />
                            No pending requests found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell>
                                            <div className="font-medium">{u.first_name} {u.last_name}</div>
                                            <div className="text-xs text-muted-foreground">{u.email}</div>
                                            <div className="text-xs text-muted-foreground">@{u.username}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{u.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{u.employee_details?.phone || "-"}</div>
                                            <div className="text-xs text-gray-500">{u.employee_details?.nationality}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                                {u.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                onClick={() => handleApprove(u.id)}
                                                disabled={processing === u.id}
                                            >
                                                {processing === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                <span className="ml-2 hidden sm:inline">Approve</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleReject(u.id)}
                                                disabled={processing === u.id}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
