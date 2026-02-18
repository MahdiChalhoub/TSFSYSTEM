'use client'

import { useState, useEffect } from "react";
import type { UserApproval } from '@/types/erp';
import {
    fetchPendingUsers,
    approveUserAction,
    rejectUserAction,
    requestCorrectionAction
} from "@/app/actions/manager";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, Check, X, UserCheck,
    MessageSquare, ShieldAlert, Fingerprint,
    Clock, RefreshCw, Send, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function ApprovalsPage() {
    const [users, setUsers] = useState<UserApproval[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<number | null>(null);
    const [correctionUser, setCorrectionUser] = useState<UserApproval | null>(null);
    const [correctionNotes, setCorrectionNotes] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchPendingUsers();
            setUsers(data);
        } catch (e) {
            toast.error("Failed to load requests");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number) => {
        setProcessing(id);
        const res = await approveUserAction(id);
        if (res.success) {
            toast.success("User approved", {
                description: "The user can now login to their dashboard."
            });
            await loadData();
        } else {
            toast.error("Approval failed", { description: res.error });
        }
        setProcessing(null);
    };

    const [rejectTarget, setRejectTarget] = useState<number | null>(null);

    const handleReject = async (id: number) => {
        setRejectTarget(id);
    };

    const confirmReject = async () => {
        if (rejectTarget === null) return;
        setProcessing(rejectTarget);
        const res = await rejectUserAction(rejectTarget);
        if (res.success) {
            toast.success("User rejected");
            await loadData();
        } else {
            toast.error("Process failed", { description: res.error });
        }
        setProcessing(null);
        setRejectTarget(null);
    };

    const submitCorrection = async () => {
        if (!correctionUser || !correctionNotes.trim()) return;

        setProcessing(correctionUser.id);
        const res = await requestCorrectionAction(correctionUser.id, correctionNotes);
        if (res.success) {
            toast.info("Correction requested", {
                description: "User will be notified to update their information."
            });
            setCorrectionUser(null);
            setCorrectionNotes("");
            await loadData();
        } else {
            toast.error("Action failed", { description: res.error });
        }
        setProcessing(null);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Scanning identity pool...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-background to-muted/30 p-6 rounded-2xl border">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                        Management Terminal
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2 font-medium italic">
                        <Fingerprint className="h-4 w-4" />
                        Identity Verification & Authorization Desk
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end mr-4">
                        <span className="text-2xl font-bold text-primary">{users.length}</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Pending</span>
                    </div>
                    <Button onClick={loadData} variant="outline" className="rounded-xl px-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 border">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sync Data
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-sm overflow-hidden rounded-3xl ring-1 ring-white/10">
                <CardHeader className="bg-gradient-to-b from-muted/50 to-transparent pb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldAlert className="h-5 w-5 text-yellow-500" />
                        <CardTitle className="text-xl">Authentication Queue</CardTitle>
                    </div>
                    <CardDescription className="text-foreground/60 leading-relaxed">
                        The following users requested access to your organization. Each profile requires manual validation
                        to ensure security compliance and organizational integrity.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <div className="text-center py-24 space-y-4 rounded-2xl border-2 border-dashed border-muted/50">
                            <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <UserCheck className="h-10 w-10 text-muted-foreground opacity-30" />
                            </div>
                            <h3 className="text-xl font-semibold">Gateway is Clear</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">
                                All identity requests have been processed. New requests will appear here in real-time.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/30 rounded-t-xl">
                                    <TableRow className="hover:bg-transparent border-b">
                                        <TableHead className="py-4 font-bold text-foreground">Identity Profile</TableHead>
                                        <TableHead className="py-4 font-bold text-foreground">Assigned Rank</TableHead>
                                        <TableHead className="py-4 font-bold text-foreground">Deployment</TableHead>
                                        <TableHead className="py-4 font-bold text-foreground text-center">Security Status</TableHead>
                                        <TableHead className="py-4 font-bold text-foreground text-right px-6">Resolution</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u) => (
                                        <TableRow key={u.id} className="group transition-all hover:bg-muted/10">
                                            <TableCell className="py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                                                        {u.first_name?.[0]}{u.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-lg tracking-tight">{u.first_name} {u.last_name}</div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 w-fit px-2 py-0.5 rounded-full mt-1 font-medium border border-muted-foreground/10">
                                                            <Send className="h-3 w-3" /> {u.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold uppercase text-[10px] tracking-wider">
                                                    {u.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="text-sm font-semibold text-foreground/80">{u.employee_details?.phone || "No Comms"}</div>
                                                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-tighter font-bold text-muted-foreground opacity-70">
                                                        <AlertCircle className="h-3 w-3" /> {u.employee_details?.nationality || "Global"}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    {u.status === 'PENDING' ? (
                                                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                                                            <Clock className="h-3 w-3" />
                                                            <span className="text-[10px] font-bold tracking-tight">WAITING AUTH</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 font-bold">
                                                            <RefreshCw className="h-3 w-3" />
                                                            <span className="text-[10px] font-bold">RE-EVALUATING</span>
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-6 pr-6">
                                                <div className="inline-flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-muted-foreground/10 shadow-inner">
                                                    <Button
                                                        size="sm"
                                                        className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 border-none"
                                                        onClick={() => handleApprove(u.id)}
                                                        disabled={processing === u.id}
                                                    >
                                                        {processing === u.id ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Check className="h-5 w-5 text-white" />}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-10 px-4 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-all border-none"
                                                        onClick={() => setCorrectionUser(u)}
                                                        disabled={processing === u.id}
                                                    >
                                                        <MessageSquare className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-10 px-4 bg-muted text-muted-foreground hover:bg-red-500 hover:text-white rounded-xl transition-all border-none"
                                                        onClick={() => handleReject(u.id)}
                                                        disabled={processing === u.id}
                                                    >
                                                        <X className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Correction Dialog */}
            <Dialog open={!!correctionUser} onOpenChange={() => setCorrectionUser(null)}>
                <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none shadow-3xl overflow-hidden p-0">
                    <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 pb-2">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <MessageSquare className="h-6 w-6 text-primary" />
                                </div>
                                Request Correction
                            </DialogTitle>
                            <DialogDescription className="font-medium text-muted-foreground mt-2">
                                Specify what information needs to be corrected by <span className="text-foreground font-extrabold">{correctionUser?.first_name}</span>.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-6 pt-2">
                        <div className="py-4">
                            <Textarea
                                placeholder="e.g. Please upload a clear ID scan or correct your birth date."
                                value={correctionNotes}
                                onChange={(e) => setCorrectionNotes(e.target.value)}
                                className="min-h-[120px] rounded-2xl bg-muted/50 border-none focus-visible:ring-primary/20 p-4 resize-none font-medium text-sm leading-relaxed shadow-inner"
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="ghost"
                                onClick={() => setCorrectionUser(null)}
                                className="rounded-xl font-bold px-6"
                            >
                                Cancel
                            </Button>
                            <Button
                                className="rounded-xl px-8 bg-primary text-white shadow-lg shadow-primary/20 font-bold hover:bg-primary/90"
                                onClick={submitCorrection}
                                disabled={!correctionNotes.trim() || processing === correctionUser?.id}
                            >
                                {processing === correctionUser?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                Send Instructions
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={rejectTarget !== null}
                onOpenChange={(open) => { if (!open) setRejectTarget(null) }}
                onConfirm={confirmReject}
                title="Reject Registration?"
                description="This will permanently reject this user registration. This action cannot be undone."
                variant="danger"
            />
        </div>
    );
}