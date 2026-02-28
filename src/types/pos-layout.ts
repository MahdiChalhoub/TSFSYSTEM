import { CartItem } from './pos';

export type POSLayoutVariant = 'classic' | 'modern' | 'compact';

export interface POSClient {
    id: number;
    name: string;
    phone: string;
    balance: number;
    creditLimit: number;
    currentBalance: number;
    loyalty: number;
    address: string;
    zone: string;
}

export interface POSCategory {
    id: number;
    name: string;
}

export interface POSSession {
    id: string;
    clientId: number;
    cart: CartItem[];
    name: string;
}

export interface POSLayoutProps {
    // Data
    cart: CartItem[];
    clients: POSClient[];
    selectedClient: POSClient;
    selectedClientId: number;
    categories: POSCategory[];
    sessions: POSSession[];
    activeSessionId: string | null;
    currency: string;

    // Computed
    total: number;
    discount: number;
    discountType: 'fixed' | 'percentage';
    totalAmount: number;
    totalPieces: number;
    uniqueItems: number;

    // UI State
    highlightedItemId: number | null;
    lastAddedItemId: number | null;
    searchQuery: string;
    activeCategoryId: number | null;
    currentParentId: number | null;
    sidebarMode: 'hidden' | 'normal' | 'expanded';
    isFullscreen: boolean;
    paymentMethod: string;
    cashReceived: string;
    isProcessing: boolean;
    isOverrideOpen: boolean;
    pendingOverrideAction: { label: string; execute: () => void } | null;
    isReceiptOpen: boolean;
    lastOrder: { id: number; ref: string } | null;
    storeChangeInWallet: boolean;
    pointsRedeemed: number;
    isOnline: boolean;
    clientSearchQuery: string;
    deliveryZone: string;
    deliveryZones: any[];

    // Handlers
    onSetSearchQuery: (q: string) => void;
    onSetActiveCategoryId: (id: number | null) => void;
    onSetCurrentParentId: (id: number | null) => void;
    onSetActiveSessionId: (id: string) => void;
    onSetPaymentMethod: (m: string) => void;
    onSetCashReceived: (v: string) => void;
    onSetDiscount: (v: number) => void;
    onSetDiscountType: (type: 'fixed' | 'percentage') => void;
    onSetOverrideOpen: (v: boolean) => void;
    onSetPendingOverrideAction: (action: { label: string; execute: () => void } | null) => void;
    onSetReceiptOpen: (v: boolean) => void;
    onSetStoreChangeInWallet: (v: boolean) => void;
    onSetPointsRedeemed: (v: number) => void;
    onAddToCart: (product: Record<string, any>) => void;
    onUpdateQuantity: (productId: number, delta: number) => void;
    onUpdatePrice: (productId: number, price: number) => void;
    onUpdateLineDiscount: (productId: number, discountRate: number) => void;
    onClearCart: (force?: boolean) => void;
    onCreateNewSession: () => void;
    onRemoveSession: (id: string, force?: boolean) => void;
    onUpdateActiveSession: (updates: any) => void;
    onToggleFullscreen: () => void;
    onCycleSidebarMode: () => void;
    onCharge: () => void;
    onSync: () => void;
    onSetIsOnline: (v: boolean) => void;
    onSetClientSearchQuery: (v: string) => void;
    onSearchClients?: (query: string) => Promise<void>;
    onSetDeliveryZone: (v: string) => void;
    onSetNotes: (v: string) => void;
    onSetPaymentLegs?: (legs: Array<{ method: string; amount: number }>) => void;
    onUpdateLineNote?: (productId: number, note: string) => void;

    // Register context
    registerConfig?: {
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
    } | null;
    onCloseRegister?: () => void;

    // Layout switching
    currentLayout: POSLayoutVariant;
    onOpenLayoutSelector: () => void;
}
