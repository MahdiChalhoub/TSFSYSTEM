import type { ThemeModule, SectionComponent } from '../../engine/types'

import HomePage from './HomePage'
import ProductCard from './ProductCard'
import ProductDetail from './ProductDetail'
import Header from './Header'
import Footer from './Footer'
import CartPage from './CartPage'
import CartDrawer from './CartDrawer'
import CheckoutPage from './CheckoutPage'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import DashboardPage from './DashboardPage'
import OrdersPage from './OrdersPage'
import OrderDetailPage from './OrderDetailPage'
import SearchPage from './SearchPage'
import CategoriesPage from './CategoriesPage'

// ─── Sections ───────────────────────────────────────────────────────────────

import MidnightHero from './sections/Hero'
import MidnightFeaturedCollection from './sections/FeaturedCollection'
import MidnightPromoBanner from './sections/PromoBanner'
import MidnightCategoryExplorer from './sections/CategoryExplorer'
import MidnightBrandShowcase from './sections/BrandShowcase'

const sections: Record<string, SectionComponent> = {
    'hero': MidnightHero,
    'featured_collection': MidnightFeaturedCollection,
    'promo_banner': MidnightPromoBanner,
    'category_explorer': MidnightCategoryExplorer,
    'brand_showcase': MidnightBrandShowcase,
}

// ─── Component Registry ─────────────────────────────────────────────────────

const components = {
    HomePage,
    ProductCard,
    ProductDetail,
    Header,
    Footer,
    CartPage,
    CartDrawer,
    CheckoutPage,
    LoginPage,
    RegisterPage,
    DashboardPage,
    OrdersPage,
    OrderDetailPage,
    SearchPage,
    CategoriesPage,
}

// ─── Theme Module ───────────────────────────────────────────────────────────

import { THEME_CONFIGS } from '../../engine/ThemeConfigs'

const midnightModule: ThemeModule = {
    config: THEME_CONFIGS.midnight,
    components,
    sections,
}

export default midnightModule
