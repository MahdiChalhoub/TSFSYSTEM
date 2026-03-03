import { getWishlist } from '@/app/actions/ecommerce/wishlist'
import WishlistClient from './WishlistClient'

export const metadata = { title: 'My Wishlist | Store' }

export default async function WishlistPage() {
    const items = await getWishlist()
    return <WishlistClient initialItems={items} />
}
