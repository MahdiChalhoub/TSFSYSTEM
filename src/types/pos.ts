export type CartItem = {
    productId: number;
    name: string;
    price: number;
    taxRate: number;
    quantity: number;
    isTaxIncluded: boolean;
    barcode?: string;
    stock?: number;
    imageUrl?: string;
    note?: string;
    discountRate?: number;
    [key: string]: any;
};
