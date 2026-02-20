// ─── Storefront Engine — Theme API Contract ─────────────────────────────────
// Every theme MUST export components matching ThemeComponents.
// Themes get data ONLY through the provided hooks — never call APIs directly.

import { ReactNode } from 'react'

// ─── Data Types ─────────────────────────────────────────────────────────────

export interface Product {
    id: string
    name: string
    sku: string
    description?: string
    selling_price_ttc: number
    selling_price_ht?: number
    cost_price?: number
    tax_rate?: number
    image_url?: string
    category_name?: string
    category_id?: string
    stock_quantity?: number
    is_active?: boolean
    barcode?: string
    unit_of_measure?: string
}

export interface Category {
    id: string
    name: string
    slug?: string
    parent_id?: string
    product_count?: number
    image_url?: string
}

export interface CartItem {
    product_id: string
    product_name: string
    unit_price: number
    quantity: number
    image_url?: string
    tax_rate: number
}

export interface Order {
    id: string
    order_number: string
    status: string
    total_amount: number
    created_at: string
    items_count?: number
    lines?: OrderLine[]
}

export interface OrderLine {
    id: string
    product_name: string
    quantity: number
    unit_price: number
    total: number
}

export interface CustomerUser {
    id: string
    email: string
    name: string
    tier?: string
    loyalty_points?: number
    wallet_balance?: number
    barcode?: string
}

export interface StorefrontConfig {
    store_mode: 'B2C' | 'B2B' | 'CATALOG_QUOTE' | 'HYBRID'
    storefront_title: string
    storefront_tagline: string
    show_stock_levels: boolean
    allow_guest_browsing: boolean
    ecommerce_enabled: boolean
    loyalty_enabled: boolean
    wallet_enabled: boolean
    tickets_enabled: boolean
    require_approval_for_orders: boolean
    currency_symbol?: string
    currency_code?: string
}

// ─── Theme Component Interfaces ─────────────────────────────────────────────

export interface HomePageProps {
    products: Product[]
    categories: Category[]
}

export interface ProductCardProps {
    product: Product
}

export interface ProductDetailProps {
    product: Product
}

export interface SearchPageProps {
    initialQuery?: string
}

export interface AccountLayoutProps {
    children: ReactNode
}

// ─── Theme Definition ───────────────────────────────────────────────────────

export interface ThemeComponents {
    // Required pages
    HomePage: React.ComponentType<HomePageProps>
    ProductCard: React.ComponentType<ProductCardProps>
    ProductDetail: React.ComponentType<ProductDetailProps>
    Header: React.ComponentType
    Footer: React.ComponentType
    CartPage: React.ComponentType
    CheckoutPage: React.ComponentType

    // Optional pages (engine provides defaults if missing)
    SearchPage?: React.ComponentType<SearchPageProps>
    CategoriesPage?: React.ComponentType
    AccountLayout?: React.ComponentType<AccountLayoutProps>
    LoginPage?: React.ComponentType
    RegisterPage?: React.ComponentType
    OrdersPage?: React.ComponentType
    OrderDetailPage?: React.ComponentType<{ orderId: string }>
    WalletPage?: React.ComponentType
    WishlistPage?: React.ComponentType
    TicketsPage?: React.ComponentType
    NotificationsPage?: React.ComponentType
    ProfilePage?: React.ComponentType
    DashboardPage?: React.ComponentType
}

export interface ThemeConfig {
    id: string
    name: string
    description: string
    author?: string
    version?: string
    preview?: string          // Screenshot path
    colors: {
        primary: string
        secondary: string
        accent: string
        background: string
        surface: string
        text: string
    }
    supports: ('b2c' | 'b2b' | 'catalog_quote' | 'hybrid')[]
    fonts?: {
        heading?: string
        body?: string
    }
}

export interface ThemeModule {
    config: ThemeConfig
    components: ThemeComponents
}

// ─── Hook Return Types ──────────────────────────────────────────────────────

export interface UseStoreReturn {
    products: Product[]
    categories: Category[]
    loading: boolean
    error: string | null
    searchProducts: (query: string) => Product[]
    getProductsByCategory: (categoryId: string) => Product[]
}

export interface UseCartReturn {
    cart: CartItem[]
    cartCount: number
    cartTotal: number
    addToCart: (item: CartItem) => void
    removeFromCart: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
}

export interface UseAuthReturn {
    user: CustomerUser | null
    isAuthenticated: boolean
    loading: boolean
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    register?: (data: Record<string, string>) => Promise<{ success: boolean; error?: string }>
}

export interface UseConfigReturn {
    config: StorefrontConfig | null
    storeMode: string
    orgName: string
    orgLogo?: string
    slug: string
    showPrice: boolean
    isQuoteMode: boolean
}

export interface UseOrdersReturn {
    orders: Order[]
    loading: boolean
    getOrder: (id: string) => Promise<Order | null>
    placeOrder: (payload: Record<string, any>) => Promise<{ success: boolean; error?: string; data?: any }>
}

export interface UseWishlistReturn {
    wishlist: string[]
    wishlistCount: number
    isInWishlist: (productId: string) => boolean
    toggleWishlist: (productId: string) => void
}
