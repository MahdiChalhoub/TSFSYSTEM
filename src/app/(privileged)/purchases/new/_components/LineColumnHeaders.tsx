export function LineColumnHeaders() {
    return (
        <div className="flex-shrink-0 hidden md:flex items-center gap-0 text-[10px] font-black uppercase tracking-wider"
            style={{
                color: 'var(--app-muted-foreground)',
                background: 'var(--app-surface)',
                borderBottom: '1px solid var(--app-border)',
            }}>
            <div className="px-4 py-3 w-[200px] flex-shrink-0">Product</div>
            <div className="px-2 py-3 w-[60px] flex-shrink-0 text-center">Qty</div>
            <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">Requested</div>
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                <div>Required</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">proposed</div>
            </div>
            <div className="px-2 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block">
                <div>Stock</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">transit · total</div>
            </div>
            <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden lg:block">
                <div>PO</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">Count</div>
            </div>
            <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center">Status</div>
            <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center hidden xl:block">
                <div>Sales</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">monthly</div>
            </div>
            <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden xl:block">
                <div>Score</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">adjust</div>
            </div>
            <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">
                <div>Purchased</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">sold</div>
            </div>
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                <div>Cost</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">sell price</div>
            </div>
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                <div>Supplier</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">price</div>
            </div>
            <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                <div>Expiry</div>
                <div className="font-semibold normal-case text-[9px] opacity-60">safety</div>
            </div>
            <div className="px-2 py-3 w-[45px] flex-shrink-0 text-center" style={{ borderLeft: '1px solid var(--app-border)' }}>SUP+</div>
        </div>
    )
}
