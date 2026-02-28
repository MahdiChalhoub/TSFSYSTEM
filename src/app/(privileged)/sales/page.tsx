'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { CartItem } from '@/types/pos';
import { POSLayoutVariant } from '@/types/pos-layout';
import { POSLayoutClassic } from '@/components/pos/layouts/POSLayoutClassic';
import { POSLayoutModern } from '@/components/pos/layouts/POSLayoutModern';
import { POSLayoutCompact } from '@/components/pos/layouts/POSLayoutCompact';
import { POSLayoutSelector } from '@/components/pos/layouts/POSLayoutSelector';
import { ManagerOverride } from '@/components/pos/ManagerOverride';
import POSLobby from '@/components/pos/POSLobby';
import CloseRegisterModal from '@/components/pos/CloseRegisterModal';
import ReturnOrderModal from '@/components/pos/ReturnOrderModal';
import POSKeyboardShortcuts from '@/components/pos/POSKeyboardShortcuts';
import { saveHold } from '@/components/pos/POSQuickHold';
import { getCategories, processSale, getDeliveryZones, getPosSettings } from './actions';
import { getCommercialContext } from '@/app/actions/commercial';
import { getUser } from '@/app/actions/auth';
import { searchContacts } from '@/app/actions/crm/contacts';
import { erpFetch } from "@/lib/erp-api";
import { useAdmin } from '@/context/AdminContext';

// ─── Sound Utility ───
const playSound = (type: 'beep' | 'error' | 'success') => {
    try {
        const file = type === 'beep' ? 'scan.mp3' : type === 'error' ? 'error.mp3' : 'success.mp3';
        const audio = new Audio(`/sounds/${file}`);
        audio.play().catch(() => { });
    } catch (e) { }
};

// ─── Audit Logger ───
const logAuditEvent = (eventType: string, eventName: string, details: any = {}) => {
    erpFetch('pos-audit-events/', {
        method: 'POST',
        body: JSON.stringify({
            event_type: eventType,
            event_name: eventName,
            details: details
        })
    }).catch(e => console.error("Failed to log audit event", e));
};

type SidebarMode = 'hidden' | 'normal' | 'expanded';

const LAYOUT_STORAGE_KEY = 'pos-layout-preference';

export default function POSPage() {
    // ─── Layout System ───
    const [currentLayout, setCurrentLayout] = useState<POSLayoutVariant>('classic');
    const [isLayoutSelectorOpen, setIsLayoutSelectorOpen] = useState(false);
    const { viewScope } = useAdmin();

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

    // ─── Client State ───
    const [clients, setClients] = useState<any[]>([
        { id: 1, name: 'Walk-in Customer', phone: 'N/A', balance: 0, loyalty: 0, address: 'Counter Sales', zone: '' }
    ]);

    // ─── Multi-Order Sessions ───
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    // ─── User Role State ───
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
    const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null);

    // ─── UI State ───
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);
    const [sidebarMode, setSidebarMode] = useState<SidebarMode>('normal');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currency, setCurrency] = useState('$');

    // ─── Barcode Product Index ───
    // Map of barcode/SKU → product for instant O(1) lookup during scanning
    const productIndex = useRef<Map<string, any>>(new Map());
    const onProductsLoaded = useCallback((products: any[]) => {
        products.forEach(p => {
            if (p.barcode) productIndex.current.set(String(p.barcode).toLowerCase(), p);
            if (p.sku) productIndex.current.set(String(p.sku).toLowerCase(), p);
            if (p.id) productIndex.current.set(String(p.id), p);
        });
    }, []);
    // Stable refs so barcode keydown handler (registered once) always has the latest functions
    const addToCartRef = useRef<(p: any) => void>(null as any);
    const onProductsLoadedRef = useRef<(products: any[]) => void>(null as any);
    // Stock policy: loaded from pos-settings on mount. Using a ref so addToCart always reads the
    // latest value without needing to be included in its dependency array.
    const allowNegativeStockRef = useRef<boolean>(false);

    // Load org stock policy from pos_security_rules on mount (SecurityTab manages this setting)
    useEffect(() => {
        erpFetch('settings/item/pos_security_rules/').then((s: any) => {
            if (typeof s?.allowNegativeStock === 'boolean') {
                allowNegativeStockRef.current = s.allowNegativeStock;
            }
        }).catch(() => { });
    }, []);

    // ─── Register / Lobby State ───
    const [registerConfig, setRegisterConfig] = useState<{
        registerId: number;
        registerName: string;
        sessionId: number;
        cashierId: number;
        cashierName: string;
        warehouseId: number | null;
        cashAccountId: number | null;
        allowedAccounts: any[];
        siteName: string;
        paymentMethods: Array<{ key: string; label: string; accountId: number | null }>;
    } | null>(null);
    const [showCloseRegister, setShowCloseRegister] = useState(false);
    const [showReturn, setShowReturn] = useState(false);
    const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
    const [deliveryZone, setDeliveryZone] = useState('');
    const [loyaltyPointValue, setLoyaltyPointValue] = useState(1); // monetary value per point
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

    // ─── Session Setup & Persistence ───
    useEffect(() => {
        const saved = localStorage.getItem('pos_sessions');
        let initialSessions = [];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    initialSessions = parsed;
                }
            } catch (e) { console.error(e); }
        }

        if (initialSessions.length === 0) {
            const initialId = Date.now().toString();
            initialSessions = [{ id: initialId, clientId: 1, cart: [], name: 'Ticket 1' }];
        }

        setSessions(initialSessions);
        setActiveSessionId(initialSessions[0].id);

        // Fetch cloud backup for redundancy
        erpFetch('pos-tickets/').then((cloudTickets: any) => {
            if (Array.isArray(cloudTickets) && cloudTickets.length > 0) {
                const mapped = cloudTickets.map((ct: any) => ({
                    id: ct.ticket_id,
                    name: ct.name,
                    clientId: ct.client_id || 1,
                    cart: ct.cart_data || []
                }));

                setSessions(prev => {
                    const merged = [...prev];
                    mapped.forEach(ct => {
                        if (!merged.find(m => m.id === ct.id)) {
                            merged.push(ct);
                        }
                    });
                    return merged;
                });
            }
        }).catch(e => console.warn("[POS] Cloud Restore Failed:", e));
    }, []);

    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('pos_sessions', JSON.stringify(sessions));
        }

        // Debounced Cloud Sync
        const timer = setTimeout(() => {
            if (sessions.length > 0) {
                erpFetch('pos-tickets/sync-all/', {
                    method: 'POST',
                    body: JSON.stringify({
                        tickets: sessions.map(s => ({
                            ticket_id: s.id,
                            name: s.name,
                            client_id: s.clientId,
                            cart_data: s.cart
                        }))
                    })
                }).catch(e => console.warn("[POS] Cloud Sync Failed:", e));
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [sessions]);

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || { cart: [], clientId: 1 };
    const cart = activeSession.cart;
    const selectedClientId = activeSession.clientId;
    const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0] || { name: 'Walk-in' };

    const updateActiveSession = useCallback((updatesOrUpdater: any) => {
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const updates = typeof updatesOrUpdater === 'function' ? updatesOrUpdater(s) : updatesOrUpdater;
                return { ...s, ...updates };
            }
            return s;
        }));
    }, [activeSessionId]);

    const createNewSession = () => {
        const newId = Date.now().toString();
        const newSession = { id: newId, clientId: 1, cart: [], name: `Ticket ${sessions.length + 1}` };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newId);
        toast.success("New ticket created");
    };

    const removeSession = (id: string, force: boolean = false) => {
        if (sessions.length <= 1) {
            toast.error("At least one ticket must remain open");
            return;
        }

        const sessionToRemove = sessions.find(s => s.id === id);
        if (sessionToRemove && sessionToRemove.cart.length > 0 && !isSuperAdmin && !force) {
            setPendingOverrideAction({
                label: `Close Ticket "${sessionToRemove.name}"`,
                execute: () => removeSession(id, true)
            });
            setIsOverrideOpen(true);
            return;
        }

        setSessions(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeSessionId === id) setActiveSessionId(next[0].id);
            return next;
        });
        toast.info("Ticket closed");
    };

    // ─── Load Context ───
    useEffect(() => {
        getUser().then(user => {
            if (user && user.is_superuser) setIsSuperAdmin(true);
        });

        // Clients are now fetched async when searching to avoid huge initial payload
        // The default "Walk-in Customer" (ID: 1) is already in the state.

        getCommercialContext().then(ctx => {
            setCurrency(ctx.currency === 'USD' ? '$' : ctx.currency);
            if (ctx.posPaymentMethods && Array.isArray(ctx.posPaymentMethods) && ctx.posPaymentMethods.length > 0) {
                // Normalize: support both string[] and object[] from settings
                const normalized = ctx.posPaymentMethods.map((m: any) => {
                    if (typeof m === 'string') return { key: m, label: m, accountId: null };
                    return { key: m.key, label: m.label || m.key, accountId: m.accountId || null };
                }).filter((m: any) => m.accountId || ['MULTI', 'DELIVERY'].includes(m.key)); // Strict Financial Link Rule
                setPaymentMethods(normalized);
                if (normalized.length > 0) {
                    const hasCash = normalized.some((m: any) => m.key === 'CASH');
                    if (!hasCash) setPaymentMethod(normalized[0].key);
                } else {
                    setPaymentMethod(''); // Clear if no valid payment methods are linked
                }
            }
        });

        getCategories()
            .then((data: any) => {
                const cats = Array.isArray(data)
                    ? data
                    : (data?.results && Array.isArray(data.results) ? data.results : []);
                setCategories(cats.slice(0, 500));
            })
            .catch(() => setCategories([]))
            .finally(() => setCategoriesLoading(false));

        getDeliveryZones().then(zones => {
            setDeliveryZones(zones);
            if (zones.length > 0) {
                setDeliveryZone(zones[0].name);
            }
        });

        getPosSettings().then(s => {
            setLoyaltyPointValue(s.loyaltyPointValue);
        });
    }, []);

    // ─── Cart Logic ───
    const addToCart = useCallback((product: Record<string, any>) => {
        const basePrice = Number(product.basePrice || product.price || 0);
        const taxRate = Number(product.taxRate || 0);
        const stockQty = Number(product.total_stock || product.stock || product.stockLevel || 0);

        if (isNaN(basePrice)) {
            toast.error(`Invalid price for ${product.name}`);
            return;
        }

        // Stock policy: if allow_negative_stock = true, skip all stock checks
        if (!allowNegativeStockRef.current) {
            // Block completely if stock is 0 (and stock tracking is on)
            if (stockQty === 0 && product.track_stock !== false) {
                toast.error(`❌ Out of stock: ${product.name}`, { duration: 2500 });
                playSound('beep');
                return;
            }
        }

        updateActiveSession((prevSession: any) => {
            const currentCart = prevSession.cart || [];
            const existingIndex = currentCart.findIndex((p: any) => (p as any).productId === product.id);
            let newCart: any[];

            if (existingIndex !== -1) {
                const currentQty = currentCart[existingIndex].quantity;
                // Warn but allow if going over stock (only when negative stock is NOT allowed)
                if (!allowNegativeStockRef.current && stockQty > 0 && currentQty + 1 > stockQty) {
                    toast.warning(`⚠ Overselling: only ${stockQty} in stock`, { duration: 2000 });
                }
                // Update in-place — don't reorder to top
                newCart = currentCart.map((item: any, i: number) =>
                    i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
                );
                toast.info(`Updated piece: ${product.name}`, { duration: 1000, icon: '⚡' });
            } else {
                newCart = [{
                    productId: product.id,
                    name: product.name,
                    price: basePrice,
                    taxRate: taxRate,
                    quantity: 1,
                    isTaxIncluded: product.isTaxIncluded,
                    sku: product.sku,
                    barcode: product.barcode,
                    stock: stockQty,
                    imageUrl: product.imageUrl || product.image_url || '',
                    note: '',  // per-line note (gift message, customization, etc.)
                }, ...currentCart];
                toast.success(`New item: ${product.name}`, { duration: 1000 });
            }

            return { cart: newCart };
        });

        playSound('beep');
        setHighlightedItemId(product.id);
        setLastAddedItemId(null);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [updateActiveSession]);
    // Keep stable refs in sync
    addToCartRef.current = addToCart;
    onProductsLoadedRef.current = onProductsLoaded;

    const updateQuantity = useCallback((productId: number, delta: number) => {
        const newCart = cart.map((item: any) => {
            if (item.productId === productId) {
                if (delta < 0) {
                    logAuditEvent('DECREASE_QTY', 'Item Quantity Decreased', { product: item.name, old_qty: item.quantity, new_qty: item.quantity + delta });
                }
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter((i: any) => {
            if (i.quantity <= 0) {
                logAuditEvent('REMOVE_ITEM', 'Item Removed from Cart', { product: i.name });
                return false;
            }
            return true;
        });
        playSound('beep');
        updateActiveSession({ cart: newCart });
        setHighlightedItemId(productId);
        setLastAddedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [cart, updateActiveSession]);

    const updatePrice = useCallback((productId: number, price: number) => {
        const newCart = cart.map((item: any) => {
            if (item.productId === productId) {
                return { ...item, price: price };
            }
            return item;
        });
        updateActiveSession({ cart: newCart });
        setHighlightedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [cart, updateActiveSession]);

    const updateLineDiscount = useCallback((productId: number, discountRate: number) => {
        const newCart = cart.map((item: any) => {
            if (item.productId === productId) {
                return { ...item, discountRate: Math.max(0, Math.min(100, discountRate)) };

            }
            return item;
        });
        updateActiveSession({ cart: newCart });
        setHighlightedItemId(productId);
        setTimeout(() => setHighlightedItemId(null), 500);
    }, [cart, updateActiveSession]);

    const updateLineNote = useCallback((productId: number, note: string) => {
        const newCart = cart.map((item: any) =>
            item.productId === productId ? { ...item, note } : item
        );
        updateActiveSession({ cart: newCart });
    }, [cart, updateActiveSession]);

    const clearCart = useCallback((force: boolean = false) => {
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession && currentSession.cart.length > 0 && !isSuperAdmin && !force) {
            setPendingOverrideAction({
                label: 'Clear Entire Ticket',
                execute: () => clearCart(true)
            });
            setIsOverrideOpen(true);
            return;
        }

        if (currentSession && currentSession.cart.length > 0) {
            logAuditEvent('CLEAR_CART', 'Cart Cleared', { items_count: currentSession.cart.length, ticket_name: currentSession.name });
        }

        updateActiveSession({ cart: [] });
        toast.info("Ticket cleared");
    }, [updateActiveSession, sessions, activeSessionId, isSuperAdmin]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    }, []);

    const cycleSidebarMode = useCallback(() => {
        setSidebarMode(prev => {
            if (prev === 'hidden') return 'normal';
            if (prev === 'normal') return 'expanded';
            return 'hidden';
        });
    }, []);

    const handleSync = useCallback(async () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: 'Synchronizing with Central Server...',
                success: 'All data synchronized successfully!',
                error: 'Synchronization failed. Check connection.'
            }
        );
    }, []);

    // ─── Payment State ───
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [cashReceived, setCashReceived] = useState<string>('');
    const [storeChangeInWallet, setStoreChangeInWallet] = useState(false);
    const [pointsRedeemed, setPointsRedeemed] = useState(0);
    const [notes, setNotes] = useState('');
    const [paymentLegs, setPaymentLegs] = useState<Array<{ method: string; amount: number }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Global Keyboard Shortcuts (Moved below handleCharge)    // Reset payment state when switching tickets — isolate per-session
    useEffect(() => {
        setCashReceived('');
        setPaymentMethod('CASH');
        setStoreChangeInWallet(false);
        setPointsRedeemed(0);
        setNotes('');
        setPaymentLegs([]);
        setDiscount(0);
        setDiscountType('fixed');
    }, [activeSessionId]);

    const total = cart.reduce((acc: number, item: any) => acc + (Number(item.price) * item.quantity), 0);
    const totalPieces = cart.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const uniqueItems = cart.length;

    // Discount State
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');

    // Calculate final total based on discount type
    const discountAmount = discountType === 'percentage'
        ? total * (discount / 100)
        : discount;
    const loyaltyDiscount = pointsRedeemed * loyaltyPointValue;
    const totalAmount = Math.max(0, total - discountAmount - loyaltyDiscount);

    // ─── Override & Receipt ───
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [pendingOverrideAction, setPendingOverrideAction] = useState<{ label: string; execute: () => void } | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<{ id: number; ref: string } | null>(null);
    // CREDIT payment warning state
    const [showCreditWarning, setShowCreditWarning] = useState(false);
    const [creditWarningAmount, setCreditWarningAmount] = useState(0);

    // Determines if any payment is CREDIT-on-account (client owes)
    const isCreditPayment = (
        paymentMethod === 'CREDIT' ||
        (paymentLegs.length > 0 && paymentLegs.some((l: any) => l.method === 'CREDIT'))
    );

    const handleCharge = useCallback(async (skipCreditWarning = false) => {
        if (cart.length === 0 || isProcessing) return;

        if (!paymentMethod && totalAmount > 0 && paymentLegs.length === 0) {
            toast.error("Please select a valid payment method. Check POS settings if none are available.");
            return;
        }

        // 1. Balance check — multi-payment legs must exactly equal totalAmount (Debit = Credit)
        if (paymentLegs.length > 0) {
            const legsTotal = paymentLegs.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
            const diff = Math.abs(legsTotal - totalAmount);
            if (diff > 0.01) {
                toast.error(
                    `⚖️ Payment imbalance: legs total ${legsTotal.toFixed(2)} ≠ order total ${totalAmount.toFixed(2)}`,
                    { duration: 4000 }
                );
                return;
            }
        }

        // 2. CREDIT method: require explicit confirmation before processing
        if (isCreditPayment && !skipCreditWarning) {
            setCreditWarningAmount(totalAmount);
            setShowCreditWarning(true);
            return; // paused — will resume when user confirms
        }
        setIsProcessing(true);
        try {
            const parsedCash = cashReceived ? parseFloat(cashReceived.replace(/\s/g, '')) : 0;
            // Look up the linked account for the selected payment method
            const methodConfig = paymentMethods.find((m: any) => (m.key || m) === paymentMethod);
            const linkedAccountId = methodConfig?.accountId || undefined;
            const result = await processSale({
                cart,
                paymentMethod,
                totalAmount: totalAmount,
                scope: viewScope,
                clientId: selectedClientId,
                storeChangeInWallet,
                pointsRedeemed,
                notes,
                cashReceived: parsedCash,
                paymentAccountId: linkedAccountId,
                globalDiscount: discountAmount,
                paymentLegs: paymentLegs.length > 0 ? paymentLegs : undefined
            });

            if (result.success) {
                playSound('success');
                toast.success(`Sale Processed: ${result.ref}`);
                clearCart(true);
                setCashReceived('');
                setStoreChangeInWallet(false);
                setPointsRedeemed(0);
                setNotes('');
                setPaymentLegs([]);
                setDiscount(0);
                setIsReceiptOpen(true);
                setLastOrder({ id: result.orderId, ref: result.ref });
            }
        } catch (error) {
            playSound('error');
            toast.error("Process Logic Failure.");
        } finally {
            setIsProcessing(false);
        }
    }, [cart, isProcessing, paymentMethod, totalAmount, clearCart, selectedClientId, storeChangeInWallet, pointsRedeemed, cashReceived, notes, paymentLegs, discountAmount, isCreditPayment]);

    // ─── Global Barcode Scanner + Keyboard Shortcuts ───
    useEffect(() => {
        let barcodeBuffer = '';
        let lastKeyTime = 0;
        const BARCODE_GAP_MS = 80; // Scanners type < 80ms between chars

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

            // ── Named shortcuts (always active, even in inputs) ──
            if (e.key === 'F2') { e.preventDefault(); handleCharge(); return; }
            if (e.key === 'Escape' && !inInput) {
                e.preventDefault();
                setIsOverrideOpen(false); setIsReceiptOpen(false); setSearchQuery('');
                return;
            }
            if (e.key === 'F4') {
                e.preventDefault();
                const si = document.getElementById('pos-product-search') as HTMLInputElement | null
                    || document.querySelector('input[placeholder*="Search product"]') as HTMLInputElement | null;
                if (si) { si.focus(); si.select(); }
                return;
            }
            if (e.key === 'Delete' && !inInput) {
                e.preventDefault();
                if (cart.length > 0) { clearCart(); toast.info("Cart cleared via shortcut"); }
                return;
            }

            // ── Barcode scanner detection ──
            // If gap since last char is too large, reset buffer (human typing, not scanner)
            if (now - lastKeyTime > BARCODE_GAP_MS && barcodeBuffer.length > 0) {
                barcodeBuffer = '';
            }
            lastKeyTime = now;

            if (e.key === 'Enter' && barcodeBuffer.length >= 3) {
                // Barcode complete — try index first (instant), then direct API, then search box fallback
                e.preventDefault();
                const code = barcodeBuffer.trim();
                barcodeBuffer = '';

                // Clear the visual search box immediately
                const si = document.getElementById('pos-product-search') as HTMLInputElement | null;
                if (si) si.value = '';

                // ── Path 1: In-memory index lookup (O(1), 0ms) ──
                const cached = productIndex.current.get(code) || productIndex.current.get(code.toLowerCase());
                if (cached) {
                    addToCartRef.current(cached);
                    return;
                }

                // ── Path 2: Direct API call using products/search_enhanced (correct endpoint + param) ──
                erpFetch(`products/search_enhanced/?query=${encodeURIComponent(code)}&limit=2`)
                    .then((data: any) => {
                        const results: any[] = Array.isArray(data) ? data : data?.results || [];
                        if (results.length === 1) {
                            // Cache it for next time
                            onProductsLoadedRef.current(results);
                            addToCartRef.current(results[0]);
                        } else if (results.length > 1) {
                            // Multiple matches — show in search box so cashier can pick
                            setSearchQuery(code);
                            if (si) { si.value = code; si.focus(); }
                        } else {
                            // Not found
                            playSound('error');
                            toast.error(`"${code}" not found`, { duration: 2500 });
                        }
                    })
                    .catch(() => {
                        playSound('error');
                        toast.error('Scanner error — check connection');
                    });
                return;
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Accumulate into barcode buffer
                barcodeBuffer += e.key;

                // If not in an input, redirect printable chars visually to the product search box
                // IMPORTANT: do NOT call setSearchQuery here — that would trigger N debounced
                // searches for an N-char barcode, causing onAutoAdd to fire multiple times.
                // We only commit the search once (on barcode Enter below).
                if (!inInput) {
                    e.preventDefault();
                    const si = document.getElementById('pos-product-search') as HTMLInputElement | null;
                    if (si) {
                        si.focus();
                        const newVal = barcodeBuffer.length === 1 ? e.key : si.value + e.key;
                        si.value = newVal; // DOM only — React state stays untouched until Enter
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCharge, cart.length, clearCart]);

    // ─── Render ───
    // Show lobby if no register is selected
    if (!registerConfig) {
        return (
            <POSLobby
                currency={currency}
                onEnterPOS={(config) => {
                    setRegisterConfig(config);
                    // Use this register's payment methods if configured, else keep current
                    if (config.paymentMethods && config.paymentMethods.length > 0) {
                        // Only show methods that are linked to a financial account
                        const linked = config.paymentMethods.filter(
                            (m: any) => m.accountId || ['MULTI', 'DELIVERY'].includes(m.key)
                        );
                        if (linked.length > 0) setPaymentMethods(linked);
                    }
                    toast.success(`Entered ${config.registerName} as ${config.cashierName}`);
                }}
            />
        );
    }

    // ─── Shared Props ───
    const layoutProps = {
        cart, clients, selectedClient, selectedClientId, categories,
        sessions, activeSessionId, currency, total, discount, discountType, totalAmount,
        totalPieces, uniqueItems, searchQuery, activeCategoryId, currentParentId, sidebarMode,
        isFullscreen, paymentMethod, cashReceived, isProcessing,
        isOverrideOpen, isReceiptOpen, lastOrder,
        storeChangeInWallet, pointsRedeemed, highlightedItemId, lastAddedItemId,
        isOnline, clientSearchQuery, deliveryZone, deliveryZones,
        paymentMethods, pendingOverrideAction,

        // Register context
        registerConfig,
        onCloseRegister: () => setShowCloseRegister(true),
        onOpenReturn: () => setShowReturn(true),

        onSetSearchQuery: setSearchQuery,
        onSetActiveCategoryId: setActiveCategoryId,
        onSetCurrentParentId: setCurrentParentId,
        onSetActiveSessionId: setActiveSessionId,
        onSetPaymentMethod: setPaymentMethod,
        onSetCashReceived: setCashReceived,
        onSetDiscount: setDiscount,
        onSetDiscountType: setDiscountType,
        onSetOverrideOpen: setIsOverrideOpen,
        onSetPendingOverrideAction: setPendingOverrideAction,
        onSetReceiptOpen: setIsReceiptOpen,
        onSetStoreChangeInWallet: setStoreChangeInWallet,
        onSetPointsRedeemed: setPointsRedeemed,
        onAddToCart: addToCart,
        onProductsLoaded: onProductsLoaded,
        onUpdateQuantity: updateQuantity,
        onUpdatePrice: updatePrice,
        onUpdateLineDiscount: updateLineDiscount,
        onUpdateLineNote: updateLineNote,
        onClearCart: clearCart,
        onCreateNewSession: createNewSession,
        onRemoveSession: removeSession,
        onUpdateActiveSession: updateActiveSession,
        onToggleFullscreen: toggleFullscreen,
        onCycleSidebarMode: cycleSidebarMode,
        onCharge: handleCharge,
        onSync: handleSync,
        onSetIsOnline: setIsOnline,
        onSetClientSearchQuery: setClientSearchQuery,

        onSearchClients: async (query: string) => {
            const results = await searchContacts(query);
            if (Array.isArray(results) && results.length > 0) {
                const mapped = results.map(c => ({
                    id: c.id,
                    name: c.name || 'Unknown',
                    phone: c.phone || 'N/A',
                    balance: Number(c.wallet_balance || 0),
                    creditLimit: Number(c.credit_limit || 0),
                    currentBalance: Number(c.current_balance || 0),
                    loyalty: Number(c.loyalty_points || 0),
                    address: c.address || 'N/A',
                    zone: c.home_zone_name || '',          // ← Now from real home_zone FK
                    home_zone_id: c.home_zone || null,
                    customer_tier: c.customer_tier || null,
                    customer_type: c.customer_type || null,
                }));

                setClients(prev => {
                    const prevKept = prev.filter(p => p.id === 1 || p.id === selectedClientId);
                    const newClients = mapped.filter(m => !prevKept.some(p => p.id === m.id));
                    return [...prevKept, ...newClients];
                });
            }
        },

        onSetDeliveryZone: setDeliveryZone,
        onSetNotes: setNotes,
        onSetPaymentLegs: setPaymentLegs,

        currentLayout,
        onOpenLayoutSelector: () => setIsLayoutSelectorOpen(true),
        onLockRegister: () => setRegisterConfig(null),
    };

    return (
        <>
            {/* Global keyboard shortcuts */}
            <POSKeyboardShortcuts
                paymentMethods={paymentMethods || []}
                cartHasItems={cart.length > 0}
                onCharge={handleCharge}
                onSetPaymentMethod={setPaymentMethod}
                onHoldCart={() => {
                    if (!cart.length) return;
                    const orgKey = `reg_${registerConfig?.registerId || 'global'}`;
                    const label = `Hold ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                    saveHold(orgKey, {
                        id: crypto.randomUUID(),
                        label,
                        savedAt: new Date().toISOString(),
                        cart: JSON.parse(JSON.stringify(cart)),
                        clientId: selectedClientId || null,
                        clientName: clients.find(c => c.id === selectedClientId)?.name || 'Walk-In',
                        total: totalAmount,
                        currency,
                    });
                    import('sonner').then(m => m.toast.success(`Cart held as "${label}"`));
                }}
            />
            {currentLayout === 'classic' && <POSLayoutClassic {...layoutProps} />}
            {currentLayout === 'modern' && <POSLayoutModern {...layoutProps} />}
            {currentLayout === 'compact' && <POSLayoutCompact {...layoutProps} />}

            <POSLayoutSelector
                isOpen={isLayoutSelectorOpen}
                currentLayout={currentLayout}
                onSelect={handleLayoutChange}
                onClose={() => setIsLayoutSelectorOpen(false)}
            />

            {showCloseRegister && registerConfig && (
                <CloseRegisterModal
                    sessionId={registerConfig.sessionId}
                    registerName={registerConfig.registerName}
                    cashierName={registerConfig.cashierName}
                    openingBalance={0}
                    currency={currency}
                    onClose={() => {
                        setShowCloseRegister(false);
                        setRegisterConfig(null);   // return to lobby
                    }}
                    onCancel={() => setShowCloseRegister(false)}
                />
            )}

            {showReturn && (
                <ReturnOrderModal
                    currency={currency}
                    onClose={() => setShowReturn(false)}
                />
            )}

            <ManagerOverride
                isOpen={isOverrideOpen}
                onClose={() => setIsOverrideOpen(false)}
                onSuccess={() => {
                    if (pendingOverrideAction) {
                        pendingOverrideAction.execute();
                        setPendingOverrideAction(null);
                    }
                }}
                actionLabel={pendingOverrideAction?.label || "Protected Action"}
            />

            {/* ═══════ CREDIT PAYMENT WARNING MODAL ═══════ */}
            {showCreditWarning && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
                        {/* Amber header bar */}
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
                            {/* Amount owed */}
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Amount to be credited to client account</p>
                                <p className="text-4xl font-black text-amber-700 tabular-nums">{currency}{creditWarningAmount.toFixed(2)}</p>
                            </div>

                            {/* Warning text */}
                            <div className="space-y-2 text-sm text-gray-600">
                                <p className="flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">📋</span>
                                    <span>This order will be recorded as a <strong>credit sale</strong>. The client's account will be debited — they owe this amount.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">💳</span>
                                    <span>No cash, card, or wallet payment is collected at this time.</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">📒</span>
                                    <span>The debt will show in the client's outstanding balance and accounts receivable.</span>
                                </p>
                            </div>

                            {/* Confirm / Cancel */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowCreditWarning(false)}
                                    className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-gray-700 font-bold text-sm hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreditWarning(false);
                                        handleCharge(true); // skipCreditWarning=true
                                    }}
                                    className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-200 transition-all"
                                >
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