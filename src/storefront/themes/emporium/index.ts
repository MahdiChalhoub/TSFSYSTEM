import type { ThemeModule } from '../../engine/types'
import { THEME_CONFIGS } from '../../engine/ThemeConfigs'

import HomePage from './HomePage'
import Header from './Header'
import Footer from './Footer'
import ProductDetail from './ProductDetail'
import ProductCard from './ProductCard'
import CartDrawer from './CartDrawer'

// Shared components that don't need overrides yet
import CartPage from '../midnight/CartPage'
import CategoriesPage from '../midnight/CategoriesPage'
import CheckoutPage from '../midnight/CheckoutPage'
import SearchPage from '../midnight/SearchPage'
import LoginPage from '../midnight/LoginPage'

const components = {
    HomePage,
    Header,
    Footer,
    ProductDetail,
    ProductCard,
    CartPage,
    CartDrawer,
    CategoriesPage,
    CheckoutPage,
    SearchPage,
    LoginPage,
}

const themeModule: ThemeModule = {
    config: THEME_CONFIGS.emporium,
    components,
}

export default themeModule
