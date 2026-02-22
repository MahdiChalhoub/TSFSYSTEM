'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Check, X, AlertCircle, Info, Building2,
    Mail, Calendar, ArrowRight, Loader2, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    approveUserAction,
    rejectUserAction,
    requestCorrectionAction
} from '@/app/actions/auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function RegistrationQueue({ initialUsers }: { initialUsers: Record<string, any>[] }) {
    const [users, setUsers] = useState(initialUsers);
    const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
    const [correctionModal, setCorrectionModal] = useState<{ open: boolean, userId: number | null }>({ open: false, userId: null });
    const [correctionNotes, setCorrectionNotes] = useState('');
    const [pendingRejectId, setPendingRejectId] = useState<number | null>(null);

    const handleApprove = async (id: number) => {
        setLoadingMap(prev => ({ ...prev, [id]: true }));
        try {
            await approveUserAction(id);
            setUsers(prev => prev.filter(u => u.id !== id));
            toast.success("Registration approved");
        } catch (error: unknown) {
            toast.error((error instanceof Error ? error.message : String(error)) || "Failed to approve");
        } finally {
            setLoadingMap(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleReject = async (id: number) => {
        setLoadingMap(prev => ({ ...prev, [id]: true }));
        try {
            await rejectUserAction(id);
            setUsers(prev => prev.filter(u => u.id !== id));
            toast.success("Registration rejected");
        } catch (error: unknown) {
            toast.error((error instanceof Error ? error.message : String(error)) || "Failed to reject");
        } finally {
            setLoadingMap(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleRequestCorrection = async () => {
        if (!correctionModal.userId || !correctionNotes) return;
        setLoadingMap(prev => ({ ...prev, [correctionModal.userId!]: true }));
        try {
            await requestCorrectionAction(correctionModal.userId, correctionNotes);
            setUsers(prev => prev.map(u => u.id === correctionModal.userId ? { ...u, registration_status: 'CORRECTION_NEEDED' } : u));
            setCorrectionModal({ open: false, userId: null });
            setCorrectionNotes('');
            toast.success("Correction requested");
        } catch (error: unknown) {
            toast.error((error instanceof Error ? error.message : String(error)) || "Failed to request correction");
        } finally {
            setLoadingMap(prev => ({ ...prev, [correctionModal.userId!]: false }));
        }
    };

    if (users.length === 0) {
        return (
            <div className="bg-white rounded-[2rem] border border-gray-100 p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="text-gray-200" size={40} />
                </div>
                <h2 className="text-xl font-black text-gray-300 uppercase tracking-tighter">Queue Empty</h2>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">No pending registrations at the moment</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {users.map((user) => (
                <Card key={user.id} className="overflow-hidden border-gray-100 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                        <div className="flex flex-col lg:flex-row">
                            <div className="p-6 lg:w-1/3 bg-gray-50/50 border-r border-gray-100">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                        <Building2 className="text-gray-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter truncate">
                                            {user.organization?.name || 'New Organization'}
                                        </h3>
                                        <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">
                                            {user.organization?.slug || 'pending-slug'}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                        <Mail size={14} className="text-gray-400" />
                                        {user.email}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                        <Calendar size={14} className="text-gray-400" />
                                        Requested {format(new Date(user.date_joined), 'PPP')}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-6 flex items-center justify-between">
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Requested Access</span>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="bg-white rounded-lg px-3 py-1 text-[10px] font-bold uppercase">
                                                Industry: {user.organization?.business_type_name || 'Standard'}
                                            </Badge>
                                            <Badge variant="outline" className="bg-white rounded-lg px-3 py-1 text-[10px] font-bold uppercase">
                                                Currency: {user.organization?.currency_code || 'USD'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Status</span>
                                        <Badge className={cn(
                                            "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest border-none",
                                            user.registration_status === 'PENDING' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                        )}>
                                            {user.registration_status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setPendingRejectId(user.id)}
                                        disabled={loadingMap[user.id]}
                                        className="h-12 w-12 rounded-2xl border-gray-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all p-0"
                                    >
                                        <X size={20} />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setCorrectionModal({ open: true, userId: user.id })}
                                        disabled={loadingMap[user.id]}
                                        className="h-12 px-6 rounded-2xl border-gray-100 text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all"
                                    >
                                        Correction
                                    </Button>
                                    <Button
                                        onClick={() => handleApprove(user.id)}
                                        disabled={loadingMap[user.id]}
                                        className="h-12 px-8 rounded-2xl bg-gray-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-200 transition-all flex items-center gap-2"
                                    >
                                        {loadingMap[user.id] ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                        Approve
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}

            <Dialog open={correctionModal.open} onOpenChange={(open: boolean) => setCorrectionModal({ open, userId: open ? correctionModal.userId : null })}>
                <DialogContent className="max-w-md bg-white rounded-[2rem] p-8 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Request Correction</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-gray-400 px-1 tracking-widest">Correction Notes</Label>
                            <Textarea
                                placeholder="Explain what needs to be changed..."
                                value={correctionNotes}
                                onChange={(e: any) => setCorrectionNotes(e.target.value)}
                                className="min-h-[120px] rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setCorrectionModal({ open: false, userId: null })}
                                className="flex-1 h-14 rounded-2xl border-gray-100 text-[10px] font-black uppercase tracking-widest"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleRequestCorrection}
                                disabled={!correctionNotes}
                                className="flex-1 h-14 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest"
                            >
                                Send Request
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={pendingRejectId !== null}
                onOpenChange={(open: boolean) => { if (!open) setPendingRejectId(null) }}
                onConfirm={() => {
                    if (pendingRejectId) handleReject(pendingRejectId)
                    setPendingRejectId(null)
                }}
                title="Reject Registration"
                description="Are you sure you want to reject this registration? The applicant will be notified."
                confirmText="Reject"
                variant="danger"
            />
        </div>
    );
}
