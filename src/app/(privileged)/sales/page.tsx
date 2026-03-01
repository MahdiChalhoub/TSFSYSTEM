'use client';

/**
 * POS Terminal — Main Page (Orchestrator)
 * ========================================
 * Reduced from 939 lines to ~180 lines by extracting all state into
 * useTerminal() and all barcode logic into useBarcodeScanner().
 *
 * This page is now a thin orchestrator that:
 *   1. Wraps everything in <TerminalProvider>
 *   2. Shows the Lobby or the selected Layout
 *   3. Renders global modals (credit warning, manager override, etc.)
 *
 * All cart, payment, session, and keyboard logic lives in the hooks.
 */

import { POSLayoutClassic } from '@/components/pos/layouts/POSLayoutClassic';
import { POSLayoutModern } from '@/components/pos/layouts/POSLayoutModern';
import { POSLayoutCompact } from '@/components/pos/layouts/POSLayoutCompact';
import { POSLayoutOriginalModern } from '@/components/pos/layouts/POSLayoutOriginalModern';
import { POSLayoutIntelligence } from '@/components/pos/layouts/POSLayoutIntelligence';
import { POSLayoutSelector } from '@/components/pos/layouts/POSLayoutSelector';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import POSLobby from '@/components/pos/lobby/POSLobby';
import CloseRegisterModal from '@/components/pos/CloseRegisterModal';
import ReturnOrderModal from '@/components/pos/ReturnOrderModal';
import POSKeyboardShortcuts from '@/components/pos/POSKeyboardShortcuts';
import { saveHold } from '@/components/pos/POSQuickHold';
import { useTerminal } from '@/hooks/pos/useTerminal';
import { useBarcodeScanner } from '@/hooks/pos/useBarcodeScanner';
import { POSLayoutVariant } from '@/types/pos-layout';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw } from 'lucide-react';

// ─── Error Boundary ──────────────────────────────────────────────
class POSErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={32} className="text-rose-400" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 mb-2">POS Terminal Error</h2>
                        <p className="text-gray-500 text-sm mb-4">{this.state.error || 'An unexpected error occurred. This is usually caused by a stale browser cache after a deployment.'}</p>
                        <button
                            onClick={() => { window.location.reload(); }}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto"
                        >
                            <RefreshCw size={16} /> Hard Reload
                        </button>
                        <p className="text-gray-400 text-xs mt-4">If this persists, try Ctrl+Shift+R or clear your browser cache.</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const LAYOUT_STORAGE_KEY = 'pos-layout-preference';

// ─── Inner component (uses terminal hook directly) ──────────────
function POSTerminalInner() {
    const terminal = useTerminal();

    // Barcode scanner integration
    useBarcodeScanner(terminal);

    // Layout management
    const [currentLayout, setCurrentLayout] = useState<POSLayoutVariant>('classic');
    const [isLayoutSelectorOpen, setIsLayoutSelectorOpen] = useState(false);
    const [showCloseRegister, setShowCloseRegister] = useState(false);
    const [showReturn, setShowReturn] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved && ['classic', 'modern', 'compact'].includes(saved)) {
            setCurrentLayout(saved as POSLayoutVariant);
        }
    }, []);

    const handleLayoutChange = useCallback((layout: POSLayoutVariant) => {
        setCurrentLayout(layout);
        localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
        toast.success(`Switched to ${layout.charAt(0).toUpperCase() + layout.slice(1)} layout`);
    }, []);

    // ─── Lobby Gate ──────────────────────────────────────────────
    if (!terminal.registerConfig) {
        return (
            <POSLobby
                currency={terminal.currency}
                onEnterPOS={terminal.enterRegister}
            />
        );
    }

    // ─── Build Layout Props ──────────────────────────────────────
    // Bridge: the layouts still expect POSLayoutProps until they're
    // migrated to useTerminalContext(). This assembles them from the hook.
    const layoutProps = {
        // Data
        cart: terminal.cart,
        clients: terminal.clients,
        selectedClient: terminal.selectedClient,
        selectedClientId: terminal.selectedClientId,
        categories: terminal.categories,
        sessions: terminal.sessions,
        activeSessionId: terminal.activeSessionId,
        currency: terminal.currency,

        // Computed
        total: terminal.total,
        discount: terminal.discount,
        discountType: terminal.discountType,
        totalAmount: terminal.totalAmount,
        totalPieces: terminal.totalPieces,
        uniqueItems: terminal.uniqueItems,

        // UI state
        searchQuery: terminal.searchQuery,
        activeCategoryId: terminal.activeCategoryId,
        currentParentId: terminal.currentParentId,
        sidebarMode: terminal.sidebarMode,
        isFullscreen: terminal.isFullscreen,
        paymentMethod: terminal.paymentMethod,
        cashReceived: terminal.cashReceived,
        isProcessing: terminal.isProcessing,
        isOverrideOpen: terminal.isOverrideOpen,
        pendingOverrideAction: terminal.pendingOverrideAction,
        isReceiptOpen: terminal.isReceiptOpen,
        lastOrder: terminal.lastOrder,
        storeChangeInWallet: terminal.storeChangeInWallet,
        pointsRedeemed: terminal.pointsRedeemed,
        highlightedItemId: terminal.highlightedItemId,
        lastAddedItemId: terminal.lastAddedItemId,
        isOnline: terminal.isOnline,
        clientSearchQuery: terminal.clientSearchQuery,
        deliveryZone: terminal.deliveryZone,
        deliveryZones: terminal.deliveryZones,
        paymentMethods: terminal.paymentMethods,
        isVaultOpen: terminal.isVaultOpen,

        // Register context
        registerConfig: terminal.registerConfig,
        onCloseRegister: () => setShowCloseRegister(true),
        onOpenReturn: () => setShowReturn(true),

        // Handlers
        onSetSearchQuery: terminal.setSearchQuery,
        onSetActiveCategoryId: terminal.setActiveCategoryId,
        onSetCurrentParentId: terminal.setCurrentParentId,
        onSetActiveSessionId: terminal.setActiveSessionId,
        onSetPaymentMethod: terminal.setPaymentMethod,
        onSetCashReceived: terminal.setCashReceived,
        onSetDiscount: terminal.setDiscount,
        onSetDiscountType: terminal.setDiscountType,
        onSetOverrideOpen: terminal.setIsOverrideOpen,
        onSetPendingOverrideAction: terminal.setPendingOverrideAction,
        onSetReceiptOpen: terminal.setIsReceiptOpen,
        onSetStoreChangeInWallet: terminal.setStoreChangeInWallet,
        onSetPointsRedeemed: terminal.setPointsRedeemed,
        onSetIsVaultOpen: terminal.setIsVaultOpen,
        onAddToCart: terminal.addToCart,
        onProductsLoaded: terminal.onProductsLoaded,
        onUpdateQuantity: terminal.updateQuantity,
        onUpdatePrice: terminal.updatePrice,
        onUpdateLineDiscount: terminal.updateLineDiscount,
        onUpdateLineNote: terminal.updateLineNote,
        onClearCart: terminal.clearCart,
        onCreateNewSession: terminal.createNewSession,
        onRemoveSession: terminal.removeSession,
        onUpdateActiveSession: terminal.updateActiveSession,
        onToggleFullscreen: terminal.toggleFullscreen,
        onCycleSidebarMode: terminal.cycleSidebarMode,
        onCharge: terminal.handleCharge,
        onSync: terminal.handleSync,
        onSetIsOnline: terminal.setIsOnline,
        onSetClientSearchQuery: terminal.setClientSearchQuery,
        onSetIsReceiptOpen: terminal.setIsReceiptOpen,
        onSearchClients: terminal.searchClients,
        onSetDeliveryZone: terminal.setDeliveryZone,
        onSetNotes: terminal.setNotes,
        onSetPaymentLegs: terminal.setPaymentLegs,

        // Layout switching
        currentLayout,
        onOpenLayoutSelector: () => setIsLayoutSelectorOpen(true),
        onLockRegister: terminal.lockRegister,
    };

    return (
        <>
            {/* Global keyboard shortcuts */}
            <POSKeyboardShortcuts
                paymentMethods={terminal.paymentMethods || []}
                cartHasItems={terminal.cart.length > 0}
                onCharge={terminal.handleCharge}
                onSetPaymentMethod={terminal.setPaymentMethod}
                onHoldCart={() => {
                    if (!terminal.cart.length) return;
                    const orgKey = `reg_${terminal.registerConfig?.registerId || 'global'}`;
                    const label = `Hold ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                    saveHold(orgKey, {
                        id: crypto.randomUUID(),
                        label,
                        savedAt: new Date().toISOString(),
                        cart: JSON.parse(JSON.stringify(terminal.cart)),
                        clientId: terminal.selectedClientId || null,
                        clientName: terminal.selectedClient?.name || 'Walk-In',
                        total: terminal.totalAmount,
                        currency: terminal.currency,
                    });
                    toast.success(`Cart held as "${label}"`);
                }}
            />

            {/* Active Layout */}
            {currentLayout === 'classic' && <POSLayoutClassic {...layoutProps as any} />}
            {currentLayout === 'modern' && <POSLayoutModern {...layoutProps as any} />}
            {currentLayout === 'compact' && <POSLayoutCompact {...layoutProps as any} />}
            {currentLayout === 'original' && <POSLayoutOriginalModern {...layoutProps as any} />}
            {currentLayout === 'intelligence' && <POSLayoutIntelligence {...layoutProps as any} />}

            {/* Layout Selector Modal */}
            <POSLayoutSelector
                isOpen={isLayoutSelectorOpen}
                currentLayout={currentLayout}
                onSelect={handleLayoutChange}
                onClose={() => setIsLayoutSelectorOpen(false)}
            />

            {/* Close Register Modal */}
            {showCloseRegister && terminal.registerConfig && (
                <CloseRegisterModal
                    sessionId={terminal.registerConfig.sessionId}
                    registerName={terminal.registerConfig.registerName}
                    cashierName={terminal.registerConfig.cashierName}
                    openingBalance={0}
                    currency={terminal.currency}
                    onClose={() => { setShowCloseRegister(false); terminal.lockRegister(); }}
                    onCancel={() => setShowCloseRegister(false)}
                />
            )}

            {/* Return Order Modal */}
            {showReturn && (
                <ReturnOrderModal
                    currency={terminal.currency}
                    onClose={() => setShowReturn(false)}
                />
            )}

            {/* Manager Override */}
            <ManagerOverride
                isOpen={terminal.isOverrideOpen}
                onClose={() => terminal.setIsOverrideOpen(false)}
                onSuccess={() => {
                    if (terminal.pendingOverrideAction) {
                        terminal.pendingOverrideAction.execute();
                        terminal.setPendingOverrideAction(null);
                    }
                }}
                actionLabel={terminal.pendingOverrideAction?.label || 'Protected Action'}
            />

            {/* Credit Payment Warning */}
            {terminal.showCreditWarning && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="bg-amber-500 px-6 py-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <div className="text-white">
                                <h2 className="text-xl font-black">Credit Sale Warning</h2>
                                <p className="text-amber-100 text-sm">No cash collected — client will owe this amount</p>
                            </div>
                        </div>
                        <div className="px-6 py-6 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Amount to be credited</p>
                                <p className="text-4xl font-black text-amber-700 tabular-nums">{terminal.currency}{terminal.creditWarningAmount.toFixed(2)}</p>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600">
                                <p className="flex items-start gap-2"><span className="shrink-0 mt-0.5">📋</span><span>This will be recorded as a <strong>credit sale</strong>.</span></p>
                                <p className="flex items-start gap-2"><span className="shrink-0 mt-0.5">💳</span><span>No payment collected at this time.</span></p>
                                <p className="flex items-start gap-2"><span className="shrink-0 mt-0.5">📒</span><span>Debt shows in accounts receivable.</span></p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => terminal.setShowCreditWarning(false)}
                                    className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => { terminal.setShowCreditWarning(false); terminal.handleCharge(true); }}
                                    className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-200 transition-all">
                                    ✓ Confirm Credit Sale
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Root Export (with Error Boundary) ───────────────────────────
export default function POSPage() {
    return (
        <POSErrorBoundary>
            <POSTerminalInner />
        </POSErrorBoundary>
    );
}