export type CartItem = {
    productId: number;
    name: string;
    price: number;
    taxRate: number;
    discountRate?: number;
    quantity: number;
    isTaxIncluded: boolean;
    barcode?: string;
    stock?: number;
    imageUrl?: string;
    note?: string;
};
