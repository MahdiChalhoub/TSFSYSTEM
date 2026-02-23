import type { ThemeModule, SectionComponent } from '../../engine/types'

import HomePage from './HomePage'
import ProductCard from './ProductCard'
import ProductDetail from './ProductDetail'
import Header from './Header'
import Footer from './Footer'
import CartPage from './CartPage'
import CheckoutPage from './CheckoutPage'
import LoginPage from './LoginPage'
import SearchPage from './SearchPage'
import CategoriesPage from './CategoriesPage'

// ─── Sections ───────────────────────────────────────────────────────────────

import MidnightHero from './sections/Hero'
import MidnightFeaturedCollection from './sections/FeaturedCollection'

const sections: Record<string, SectionComponent> = {
    'hero': MidnightHero,
    'featured_collection': MidnightFeaturedCollection,
}

// ─── Component Registry ─────────────────────────────────────────────────────

const components = {
    HomePage,
    ProductCard,
    ProductDetail,
    Header,
    Footer,
    CartPage,
    CheckoutPage,
    LoginPage,
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
