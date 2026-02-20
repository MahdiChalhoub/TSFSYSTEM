// ─── Boutique Theme — Component Barrel Export ───────────────────────────────
// Light, elegant storefront theme with violet/pink color palette.

import type { ThemeComponents } from '../../engine/types'

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

const components: ThemeComponents = {
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

export default components
