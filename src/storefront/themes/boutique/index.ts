import type { ThemeModule } from '../../engine/types'
import { THEME_CONFIGS } from '../../engine/ThemeConfigs'

import HomePage from './HomePage'
import ProductCard from './ProductCard'
import ProductDetail from './ProductDetail'
import Header from './Header'
import Footer from './Footer'
import CartPage from './CartPage'
import CartDrawer from './CartDrawer'
import CheckoutPage from './CheckoutPage'
import LoginPage from './LoginPage'
import SearchPage from './SearchPage'
import CategoriesPage from './CategoriesPage'

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
    SearchPage,
    CategoriesPage,
}

const themeModule: ThemeModule = {
    config: THEME_CONFIGS.boutique,
    components,
    sections: {},
}

export default themeModule
