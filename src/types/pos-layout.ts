import { CartItem } from './pos';

export type POSLayoutVariant = 'classic' | 'modern' | 'compact';

export interface POSClient {
    id: number;
    name: string;
    phone: string;
    balance: number;
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
    searchQuery: string;
    activeCategoryId: number | null;
    sidebarMode: 'hidden' | 'normal' | 'expanded';
    isFullscreen: boolean;
    paymentMethod: string;
    cashReceived: string;
    isProcessing: boolean;
    isOverrideOpen: boolean;
    isReceiptOpen: boolean;
    lastOrder: { id: number; ref: string } | null;
    storeChangeInWallet: boolean;
    pointsRedeemed: number;

    // Handlers
    onSetSearchQuery: (q: string) => void;
    onSetActiveCategoryId: (id: number | null) => void;
    onSetActiveSessionId: (id: string) => void;
    onSetPaymentMethod: (m: string) => void;
    onSetCashReceived: (v: string) => void;
    onSetDiscount: (v: number) => void;
    onSetDiscountType: (type: 'fixed' | 'percentage') => void;
    onSetOverrideOpen: (v: boolean) => void;
    onSetReceiptOpen: (v: boolean) => void;
    onSetStoreChangeInWallet: (v: boolean) => void;
    onSetPointsRedeemed: (v: number) => void;
    onAddToCart: (product: Record<string, any>) => void;
    onUpdateQuantity: (productId: number, delta: number) => void;
    onClearCart: () => void;
    onCreateNewSession: () => void;
    onRemoveSession: (id: string) => void;
    onUpdateActiveSession: (updates: any) => void;
    onToggleFullscreen: () => void;
    onCycleSidebarMode: () => void;
    onCharge: () => void;

    // Layout switching
    currentLayout: POSLayoutVariant;
    onOpenLayoutSelector: () => void;
}
