'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search, Barcode, Package, Plus, AlertCircle, CheckCircle2,
    XCircle, ArrowRightLeft, ShoppingCart, Truck, History,
    MoreHorizontal, Filter, Loader2, Maximize2, Smartphone,
    ChevronDown, ChevronUp, Box, Warehouse, Building2, User,
    FileText, Calendar, TrendingUp, ShieldAlert, BadgeCheck,
    RotateCcw, Trash2, Camera, Info, Target, Zap, Clock, Scan
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Sheet, SheetContent, SheetDescription,
    SheetHeader, SheetTitle, SheetTrigger, SheetFooter
} from '@/components/ui/sheet';
import { toast } from 'sonner';

import {
    startReceivingSession, getReceivingSession, addReceivingLine,
    receiveLine, rejectLine, resetLine, finalizeReceiving,
    getDecisionPreview, type GoodsReceipt, type GoodsReceiptLine
} from '@/app/actions/inventory/goods-receipt';

export default function ReceivingWorkspaceClient({ initialMetadata, context }: { initialMetadata: any, context: any }) {
    const [mode, setMode] = useState<'DIRECT' | 'PO_BASED'>('PO_BASED');
    const [activeTab, setActiveTab] = useState<'pending' | 'received' | 'rejected'>('pending');
    const [warehouseId, setWarehouseId] = useState<string>('');
    const [selectedPOId, setSelectedPOId] = useState<string>('');
    const [isMobileScan, setIsMobileScan] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [scanBuffer, setScanBuffer] = useState('');

    // Core Data
    const [session, setSession] = useState<GoodsReceipt | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Dialog/Sheet State
    const [activeLine, setActiveLine] = useState<GoodsReceiptLine | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [procMode, setProcMode] = useState<'RECEIVE' | 'REJECT' | 'PREVIEW'>('PREVIEW');
    const [inputQty, setInputQty] = useState('');
    const [inputExpiry, setInputExpiry] = useState('');
    const [inputBatch, setInputBatch] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectionNotes, setRejectionNotes] = useState('');

    // Filtered lists
    const lines = session?.lines || [];
    const pendingLines = useMemo(() => lines.filter(l => ['PENDING', 'SCANNED', 'NEEDS_APPROVAL'].includes(l.line_status)), [lines]);
    const receivedLines = useMemo(() => lines.filter(l => l.line_status.startsWith('RECEIVED')), [lines]);
    const rejectedLines = useMemo(() => lines.filter(l => l.line_status === 'REJECTED'), [lines]);

    // Handle Scan logic
    useEffect(() => {
        if (!session) return;
        const handleKeyPress = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            if (e.key === 'Enter') {
                if (scanBuffer.length > 2) {
                    processScan(scanBuffer);
                    setScanBuffer('');
                }
            } else if (e.key.length === 1) {
                setScanBuffer(prev => prev + e.key);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [scanBuffer, session]);

    const processScan = async (barcode: string) => {
        if (!session) return;
        // Search for line by barcode
        const existingLine = lines.find(l => l.product_barcode === barcode || l.product_sku === barcode);
        if (existingLine) {
            handleOpenProcess(existingLine);
            toast.success(`Product recognized: ${existingLine.product_name}`);
        } else if (mode === 'DIRECT') {
            // In direct mode, we might want to add a new line immediately
            toast.info(`Scanning new product: ${barcode}`);
            // TODO: Search product in catalog and call addReceivingLine
        } else {
            toast.error(`Product ${barcode} not found in this PO`);
        }
    };

    const handleStartSession = async () => {
        if (!warehouseId) return toast.error("Please select a receiving location");
        if (mode === 'PO_BASED' && !selectedPOId) return toast.error("Please select a Purchase Order");

        setIsLoading(true);
        try {
            const res = await startReceivingSession({
                mode,
                warehouse_id: parseInt(warehouseId),
                purchase_order_id: mode === 'PO_BASED' ? parseInt(selectedPOId) : null,
            });
            setSession(res);
            toast.success(`Session ${res.receipt_number} initialized`);
        } catch (err: any) {
            toast.error(err?.message || "Failed to start session");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenProcess = (line: GoodsReceiptLine) => {
        setActiveLine(line);
        setInputQty(line.qty_ordered > 0 ? (line.qty_ordered - line.qty_received).toString() : '1');
        setInputExpiry(line.expiry_date || '');
        setInputBatch(line.batch_number || '');
        setProcMode('RECEIVE');
        setIsSheetOpen(true);
    };

    const handleReceiveSubmit = async () => {
        if (!session || !activeLine) return;
        const qty = parseFloat(inputQty);
        if (isNaN(qty) || qty <= 0) return toast.error("Invalid quantity");

        setIsActionLoading(true);
        try {
            await receiveLine(session.id, {
                line_id: activeLine.id,
                qty_received: qty,
                expiry_date: inputExpiry || null,
                batch_number: inputBatch || ''
            });
            const updated = await getReceivingSession(session.id);
            setSession(updated);
            setIsSheetOpen(false);
            toast.success(`Received ${qty} of ${activeLine.product_name}`);
        } catch (err: any) {
            toast.error(err?.message || "Reception failed");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRejectSubmit = async () => {
        if (!session || !activeLine) return;
        const qty = parseFloat(inputQty);
        if (isNaN(qty) || qty <= 0) return toast.error("Invalid quantity");
        if (!rejectionReason) return toast.error("Please select a reason");

        setIsActionLoading(true);
        try {
            await rejectLine(session.id, {
                line_id: activeLine.id,
                qty_rejected: qty,
                rejection_reason: rejectionReason,
                rejection_notes: rejectionNotes
            });
            const updated = await getReceivingSession(session.id);
            setSession(updated);
            setIsSheetOpen(false);
            toast.error(`Rejected ${qty} of ${activeLine.product_name}`);
        } catch (err: any) {
            toast.error(err?.message || "Rejection failed");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!session) return;
        if (receivedLines.length === 0) return toast.warning("No accepted items to post");

        setIsActionLoading(true);
        try {
            await finalizeReceiving(session.id);
            toast.success("Reception finalized. Inventory updated.");
            setSession(null);
            setWarehouseId('');
            setSelectedPOId('');
        } catch (err: any) {
            toast.error(err?.message || "Finalization failed");
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-app-background text-app-foreground animate-in fade-in duration-700">
            {/* ── Header Actions ── */}
            <div className="sticky top-0 z-50 px-6 py-4 border-b border-app-border bg-app-background/80 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                            <Truck className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tighter uppercase italic">
                                Receiving <span className="text-primary">Intelligence</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="bg-app-background/40 border-app-border/40 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5">
                                    {mode === 'DIRECT' ? 'Direct Receipt' : 'PO-Based Workflow'}
                                </Badge>
                                <Separator className="w-[1px] h-3 mx-1 bg-app-border/40" />
                                <div className="flex items-center gap-1.5 text-[11px] text-app-muted-foreground font-medium">
                                    <Clock className="w-3.5 h-3.5" />
                                    {new Date().toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative group w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search or suggest products..."
                                className="pl-10 h-11 bg-app-background/40 border-app-border/60 hover:border-primary/40 focus:border-primary transition-all rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <Button
                            variant="outline"
                            className="h-11 px-4 gap-2 bg-app-background/40 border-app-border/60 hover:bg-primary/5 rounded-xl group"
                            onClick={() => setIsMobileScan(!isMobileScan)}
                        >
                            <Smartphone className={`w-5 h-5 ${isMobileScan ? 'text-primary' : 'text-app-muted-foreground'} group-hover:scale-110 transition-transform`} />
                            {isMobileScan ? 'Scan Mode: ON' : 'Scan Mode: OFF'}
                        </Button>

                        {!session && (
                            <div className="h-11 flex p-1 bg-app-muted/30 rounded-xl border border-app-border/40">
                                <Button
                                    variant={mode === 'DIRECT' ? 'secondary' : 'ghost'}
                                    onClick={() => setMode('DIRECT')}
                                    className="h-full px-3 text-xs font-bold uppercase tracking-tight rounded-lg transition-all"
                                >
                                    Direct
                                </Button>
                                <Button
                                    variant={mode === 'PO_BASED' ? 'secondary' : 'ghost'}
                                    onClick={() => setMode('PO_BASED')}
                                    className="h-full px-3 text-xs font-bold uppercase tracking-tight rounded-lg transition-all"
                                >
                                    PO-Based
                                </Button>
                            </div>
                        )}

                        <Select value={warehouseId} onValueChange={setWarehouseId} disabled={!!session}>
                            <SelectTrigger className="w-[180px] h-11 bg-app-background/40 border-app-border/60 rounded-xl">
                                <SelectValue placeholder="Receipt Location" />
                            </SelectTrigger>
                            <SelectContent className="bg-app-background/95 backdrop-blur-xl border-app-border">
                                {initialMetadata?.warehouses?.map((w: any) => (
                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {session ? (
                            <Button
                                onClick={handleFinalize}
                                disabled={isActionLoading || receivedLines.length === 0}
                                className="h-11 px-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                            >
                                {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                Post Final Receipt
                            </Button>
                        ) : (
                            <Button
                                onClick={handleStartSession}
                                disabled={isLoading}
                                className="h-11 px-8 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                Start Session
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <main className="flex-1 p-6 space-y-6">
                {/* ── Intelligence Overview ── */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard label="Pending Items" value={pendingLines.length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" />
                    <StatCard label="Received Items" value={receivedLines.length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" />
                    <StatCard label="Rejected Items" value={rejectedLines.length} icon={XCircle} color="text-rose-500" bg="bg-rose-500/10" />
                    <StatCard label="Supplier Health" value="92%" icon={ShieldAlert} color="text-primary" bg="bg-primary/10" />
                </div>

                {/* ── PO Selection (if PO mode) ── */}
                {mode === 'PO_BASED' && !session && (
                    <Card className="border-dashed border-2 py-12 bg-app-muted/10 animate-in slide-in-from-bottom-4">
                        <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
                                <ShoppingCart className="w-10 h-10 text-primary/40" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Import Purchase Order</h3>
                                <p className="text-app-muted-foreground text-sm max-w-sm mx-auto">
                                    Select an existing PO to begin the intelligent receiving process based on ordered quantities.
                                </p>
                            </div>
                            <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                                <SelectTrigger className="w-[300px] h-12 bg-app-background rounded-xl">
                                    <SelectValue placeholder="Select Purchase Order..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="214">PO-214: Sephora Global</SelectItem>
                                    <SelectItem value="215">PO-215: Fragrance Hub</SelectItem>
                                    <SelectItem value="216">PO-216: Beauty Distribution</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>
                )}

                {/* ── Main Workspace Tabs ── */}
                {session && (
                    <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
                        <div className="flex items-center justify-between mb-2">
                            <TabsList className="bg-app-muted/30 p-1 rounded-xl h-11 border border-app-border/40">
                                <TabsTrigger value="pending" className="px-6 rounded-lg font-bold text-xs uppercase tracking-wider gap-2">
                                    <Clock className="w-4 h-4" /> Pending
                                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[20px] text-[10px]">{pendingLines.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="received" className="px-6 rounded-lg font-bold text-xs uppercase tracking-wider gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Received
                                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[20px] text-[10px]">{receivedLines.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="rejected" className="px-6 rounded-lg font-bold text-xs uppercase tracking-wider gap-2">
                                    <XCircle className="w-4 h-4" /> Rejected
                                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[20px] text-[10px]">{rejectedLines.length}</Badge>
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="text-xs font-bold gap-2" onClick={() => setSession(null)}>
                                    <RotateCcw className="w-4 h-4" /> Reset Workspace
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs font-bold gap-2 border-app-border/60">
                                    <Maximize2 className="w-4 h-4" /> Full View
                                </Button>
                            </div>
                        </div>

                        <TabsContent value="pending" className="space-y-4 animate-in slide-in-from-left-4 duration-300">
                            {pendingLines.length === 0 ? (
                                <EmptyState icon={Package} title="No Pending Items" desc="Scan a product or use the search box to start receiving." />
                            ) : (
                                <div className="space-y-3">
                                    {pendingLines.map((line) => (
                                        <ReceivingIntelligenceRow
                                            key={line.id}
                                            line={line}
                                            onAction={() => handleOpenProcess(line)}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="received" className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {receivedLines.length === 0 ? (
                                <EmptyState icon={BadgeCheck} title="Nothing Received Yet" desc="Accepted items will transition here after processing." />
                            ) : (
                                <div className="space-y-3">
                                    {receivedLines.map((line) => (
                                        <ReceivingIntelligenceRow key={line.id} line={line} isResult />
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="rejected" className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                            {rejectedLines.length === 0 ? (
                                <EmptyState icon={AlertCircle} title="Clean Sheet" desc="Items marked as rejected with evidence will appear here." />
                            ) : (
                                <div className="space-y-3">
                                    {rejectedLines.map((line) => (
                                        <ReceivingIntelligenceRow key={line.id} line={line} isResult isRejected />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}

                {!session && mode === 'DIRECT' && (
                    <EmptyState
                        icon={Barcode}
                        title="Ready to Capture"
                        desc="Select a warehouse and start scanning products to begin direct receiving."
                    />
                )}
            </main>

            {/* ── Sticky Intelligence Bar ── */}
            {session && (
                <div className="sticky bottom-4 mx-6 p-4 rounded-2xl bg-app-background/60 backdrop-blur-2xl border border-app-border/80 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black text-app-muted-foreground tracking-tighter">Fulfillment Velocity</span>
                            <div className="flex items-center gap-2">
                                <div className="w-32 h-2 bg-app-muted/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: '65%' }} />
                                </div>
                                <span className="text-sm font-black tabular-nums">65%</span>
                            </div>
                        </div>
                        <Separator className="w-[1px] h-8 bg-app-border/40" />
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                            <span className="text-xs font-bold leading-tight">
                                <span className="text-amber-500">Intelligent Verification Active</span><br />
                                <span className="text-app-muted-foreground/60">{session.receipt_number} — {session.warehouse_name}</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="ghost" className="rounded-xl px-4 font-bold text-xs gap-2">
                            <History className="w-4 h-4" /> View History
                        </Button>
                        <Separator className="w-[1px] h-8 bg-app-border/40" />
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase text-app-muted-foreground px-4">
                            <User className="w-4 h-4" />
                            User: {context?.user?.full_name || 'Admin'}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Action Sheet (Mobile/Web Hybrid) ── */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md bg-app-background/95 backdrop-blur-2xl border-l border-app-border p-0 overflow-hidden flex flex-col">
                    {activeLine && (
                        <>
                            <div className="p-6 bg-app-muted/20 border-b border-app-border">
                                <SheetHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black h-6">
                                            {activeLine.product_barcode}
                                        </Badge>
                                        <Badge variant="secondary" className="h-6 font-bold uppercase text-[9px]">
                                            {activeLine.line_status}
                                        </Badge>
                                    </div>
                                    <SheetTitle className="text-xl font-black">{activeLine.product_name}</SheetTitle>
                                    <SheetDescription className="text-xs font-medium">
                                        Intelligent Intake Processor — {activeLine.product_sku}
                                    </SheetDescription>
                                </SheetHeader>
                            </div>

                            <ScrollArea className="flex-1 p-6">
                                <div className="space-y-6">
                                    {/* Modes */}
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-app-muted/30 rounded-xl border border-app-border/40">
                                        <Button
                                            variant={procMode === 'RECEIVE' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            onClick={() => setProcMode('RECEIVE')}
                                            className="font-bold text-xs uppercase"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Accept
                                        </Button>
                                        <Button
                                            variant={procMode === 'REJECT' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            onClick={() => setProcMode('REJECT')}
                                            className="font-bold text-xs uppercase text-rose-500"
                                        >
                                            <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                                        </Button>
                                    </div>

                                    {/* Core Inputs */}
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Quantity to {procMode.toLowerCase()}</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={inputQty}
                                                    onChange={(e) => setInputQty(e.target.value)}
                                                    className="h-14 text-2xl font-black bg-app-background/60 border-app-border/60 rounded-xl tabular-nums pl-10"
                                                />
                                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-app-muted-foreground/40" />
                                            </div>
                                            <p className="text-[10px] text-app-muted-foreground font-bold italic">
                                                Ordered: {activeLine.qty_ordered} | Previously Received: {activeLine.qty_received}
                                            </p>
                                        </div>

                                        {procMode === 'RECEIVE' && (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Expiry Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={inputExpiry}
                                                            onChange={(e) => setInputExpiry(e.target.value)}
                                                            className="h-11 bg-app-background/60 border-app-border/60 rounded-xl font-bold"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Batch Number</Label>
                                                        <Input
                                                            value={inputBatch}
                                                            onChange={(e) => setInputBatch(e.target.value)}
                                                            placeholder="e.g. B-012"
                                                            className="h-11 bg-app-background/60 border-app-border/60 rounded-xl font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {procMode === 'REJECT' && (
                                            <div className="space-y-4 animate-in fade-in zoom-in-95">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Rejection Reason</Label>
                                                    <Select value={rejectionReason} onValueChange={setRejectionReason}>
                                                        <SelectTrigger className="h-11 bg-app-background/60 border-app-border/60 rounded-xl">
                                                            <SelectValue placeholder="Select reason..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="DAMAGED">Damaged / Broken</SelectItem>
                                                            <SelectItem value="EXPIRED">Already Expired</SelectItem>
                                                            <SelectItem value="NEAR_EXPIRY">Near Expiry (Policy Violation)</SelectItem>
                                                            <SelectItem value="WRONG_PRODUCT">Wrong Product Variant</SelectItem>
                                                            <SelectItem value="QUALITY_ISSUE">General Quality Issue</SelectItem>
                                                            <SelectItem value="SUPPLIER_ERROR">Supplier Billing/Qty Error</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Evidence Notes</Label>
                                                    <Input
                                                        value={rejectionNotes}
                                                        onChange={(e) => setRejectionNotes(e.target.value)}
                                                        placeholder="Detailed explanation..."
                                                        className="h-11 bg-app-background/60 border-app-border/60 rounded-xl font-bold"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Intelligence Preview */}
                                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Scan className="w-4 h-4 text-primary" />
                                            <span className="text-[10px] font-black uppercase text-primary tracking-widest">Decision Engine Sandbox</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-app-muted-foreground uppercase">Shelf Pressure</span>
                                                <span className={`text-sm font-black italic ${(activeLine.shelf_pressure ?? 0) > 100 ? 'text-rose-500' : 'text-primary'}`}>{activeLine.shelf_pressure || 0}%</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-app-muted-foreground uppercase">Network Coverage</span>
                                                <span className="text-sm font-black italic">{activeLine.coverage_days || 0} Days</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-app-muted-foreground uppercase">Predictive Loss</span>
                                                <span className={`text-sm font-black italic ${(activeLine.predicted_expiry_loss ?? 0) > 0 ? 'text-rose-500' : 'text-app-muted-foreground/60'}`}>
                                                    {(activeLine.predicted_expiry_loss ?? 0) > 0 ? `${(activeLine.predicted_expiry_loss ?? 0).toLocaleString()} XOF` : 'ZERO'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-app-muted-foreground uppercase">Supplier Score</span>
                                                <span className="text-sm font-black italic">{activeLine.supplier_reliability_score || 100}%</span>
                                            </div>
                                        </div>
                                        <Separator className="bg-primary/10" />
                                        <div className="flex items-start gap-3">
                                            <ShieldAlert className="w-4 h-4 text-emerald-500 mt-0.5" />
                                            <p className="text-[11px] font-bold italic leading-tight text-emerald-700">
                                                {activeLine.recommended_action || "Current stock levels allow for safe replenishment."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="p-6 bg-app-background border-t border-app-border">
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-12 w-12 p-0 rounded-xl border-app-border/60"
                                        onClick={() => setIsSheetOpen(false)}
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </Button>
                                    {procMode === 'RECEIVE' ? (
                                        <Button
                                            onClick={handleReceiveSubmit}
                                            disabled={isActionLoading}
                                            className="h-12 flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-200"
                                        >
                                            {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Receipt"}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={handleRejectSubmit}
                                            disabled={isActionLoading}
                                            className="h-12 flex-1 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-rose-200"
                                        >
                                            {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Rejection"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

// ── Sub-Components ──

function StatCard({ label, value, icon: Icon, color, bg }: any) {
    return (
        <Card className="bg-app-background/40 border-app-border/60 hover:border-primary/20 transition-all rounded-2xl overflow-hidden group">
            <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{label}</p>
                    <p className="text-2xl font-black tabular-nums">{value}</p>
                </div>
                <div className={`p-3 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyState({ icon: Icon, title, desc }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
            <div className="p-6 rounded-full bg-app-muted/10 border border-app-border/20">
                <Icon className="w-12 h-12 text-app-muted-foreground/30" />
            </div>
            <div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="text-app-muted-foreground text-sm max-w-xs">{desc}</p>
            </div>
        </div>
    );
}

function ReceivingIntelligenceRow({
    line,
    isResult = false,
    isRejected = false,
    onAction
}: {
    line: GoodsReceiptLine,
    isResult?: boolean,
    isRejected?: boolean,
    onAction?: () => void
}) {
    const isOverstock = line.receipt_coverage_pct > 100;

    return (
        <Card className={`group relative bg-app-background/40 border-app-border/60 hover:bg-app-background/60 hover:border-primary/40 transition-all rounded-2xl overflow-hidden ${isRejected ? 'opacity-80' : ''}`}>
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isRejected ? 'bg-rose-500' :
                isOverstock ? 'bg-amber-500' :
                    line.line_status === 'PENDING' ? 'bg-app-muted-foreground/30' : 'bg-emerald-500'
                }`} />

            <CardContent className="p-0">
                <div className="flex items-center gap-6 p-4">
                    <div className="flex min-w-[300px] items-center gap-4">
                        <div className="p-3 rounded-xl bg-app-muted/20 border border-app-border/40 group-hover:scale-110 transition-transform">
                            <Box className="w-6 h-6 text-app-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                            <h4 className="font-bold text-sm tracking-tight leading-none group-hover:text-primary transition-colors">{line.product_name || 'Product'}</h4>
                            <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter bg-app-muted/40 h-4 px-1.5">
                                    {line.product_barcode || 'NO_BARCODE'}
                                </Badge>
                                <span className="text-[10px] text-app-muted-foreground font-bold flex items-center gap-1">
                                    <Warehouse className="w-3 h-3" />
                                    Loc: <span className="text-app-foreground tabular-nums">{line.stock_on_location || 0}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                        <div className="flex flex-col">
                            <Label className="text-[9px] uppercase font-black text-app-muted-foreground mb-1">Receipt</Label>
                            <span className="text-lg font-black tabular-nums">{line.qty_received || 0}</span>
                        </div>
                        <div className="flex flex-col opacity-60">
                            <Label className="text-[9px] uppercase font-black text-app-muted-foreground mb-1">Ordered</Label>
                            <span className="text-sm font-bold tabular-nums">{line.qty_ordered || 0}</span>
                        </div>
                        <div className="flex flex-col">
                            <Label className="text-[9px] uppercase font-black text-app-muted-foreground mb-1">Status</Label>
                            <Badge variant="secondary" className="w-fit text-[9px] font-black tracking-tighter uppercase h-4">
                                {line.line_status}
                            </Badge>
                        </div>
                        <div className="flex flex-col">
                            <Label className="text-[9px] uppercase font-black text-app-muted-foreground mb-1">Velocity</Label>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-black tabular-nums">{line.avg_daily_sales || '0.0'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pl-4 border-l border-app-border/40">
                        {!isResult ? (
                            <Button
                                onClick={onAction}
                                size="sm"
                                className="h-10 px-6 bg-primary hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10 active:scale-95 transition-all"
                            >
                                Process Intake
                            </Button>
                        ) : (
                            <div className="flex items-center gap-3 pr-4">
                                <div className={`p-2 rounded-lg ${isRejected ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
                                    {isRejected ? <XCircle className="w-5 h-5 text-rose-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase text-app-muted-foreground tracking-widest">{isRejected ? 'Rejected' : 'Received'}</span>
                                    <span className="text-sm font-black italic">{isRejected ? line.qty_rejected : line.qty_received} Units</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <Separator className="bg-app-border/30" />

                <div className="flex items-center justify-between gap-6 px-6 py-3 bg-app-muted/10 group-hover:bg-app-muted/20 transition-all">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-app-muted-foreground tracking-widest uppercase">Intelligence Grid</span>
                            <div className="flex items-center gap-6 mt-0.5">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold tabular-nums text-app-muted-foreground/60 whitespace-nowrap">Shelf Pressure</span>
                                    <span className={`text-xs font-black ${(line.shelf_pressure ?? 0) > 100 ? 'text-rose-500' : 'text-emerald-500'}`}>{line.shelf_pressure || '0'}%</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold tabular-nums text-app-muted-foreground/60 whitespace-nowrap">Coverage</span>
                                    <span className="text-xs font-black text-blue-500">{line.coverage_days || '0'} Days</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold tabular-nums text-app-muted-foreground/60 whitespace-nowrap">Expiry Loss</span>
                                    <span className={`text-xs font-black ${(line.predicted_expiry_loss ?? 0) > 0 ? 'text-rose-500' : 'text-app-muted-foreground/40'}`}>
                                        {(line.predicted_expiry_loss ?? 0) > 0 ? line.predicted_expiry_loss : 'SAFE'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-app-muted-foreground tracking-widest uppercase">Performance Scores</span>
                            <div className="flex items-center gap-6 mt-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-app-muted-foreground/60">Safety Ratio</span>
                                        <span className={`text-xs font-black tabular-nums ${isOverstock ? 'text-amber-500' : 'text-primary'}`}>{line.receipt_coverage_pct || '0'}%</span>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-app-muted-foreground/60">Supplier Score</span>
                                    <span className={`text-xs font-black tabular-nums ${(line.supplier_reliability_score ?? 100) < 70 ? 'text-rose-500' : 'text-app-muted-foreground/80'}`}>
                                        {line.supplier_reliability_score ?? '100'}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`px-4 py-2 rounded-xl flex items-center gap-3 border ${isRejected ? 'bg-rose-500/5 border-rose-500/20 text-rose-500' :
                        isOverstock || (line.shelf_pressure ?? 0) > 100 ? 'bg-amber-500/5 border-amber-500/20 text-amber-500' :
                            'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                        }`}>
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-tighter leading-none opacity-60">Engine Recommendation</span>
                            <span className="text-[11px] font-bold leading-tight uppercase italic">{line.recommended_action || 'Safe Intake'}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
