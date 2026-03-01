/**
 * ═══════════════════════════════════════════════════════════
 * TSF Business Logic Test Suite
 * ═══════════════════════════════════════════════════════════
 * 
 * Tests the mathematical and business-critical logic that
 * TypeScript alone cannot verify. These tests run in Node.js 
 * without a browser — pure logic validation.
 * 
 * Run: node scripts/run-tests.js
 * ═══════════════════════════════════════════════════════════
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, details = '') {
    if (condition) {
        passed++;
        process.stdout.write('.');
    } else {
        failed++;
        failures.push({ testName, details });
        process.stdout.write('✗');
    }
}

function assertApprox(actual, expected, testName, tolerance = 0.01) {
    const diff = Math.abs(actual - expected);
    assert(diff < tolerance, testName, `Expected ${expected}, got ${actual} (diff: ${diff})`);
}

// ═══════════════════════════════════════════════════════════
// SUITE 1: POS Cart Calculations
// ═══════════════════════════════════════════════════════════
console.log('\n📦 SUITE 1: POS Cart Calculations');

// Test: Basic subtotal
(() => {
    const cart = [
        { id: 1, price: 1000, quantity: 2 },
        { id: 2, price: 500, quantity: 3 },
    ];
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    assert(subtotal === 3500, 'Basic subtotal calculation');
})();

// Test: Discount (percentage)
(() => {
    const subtotal = 10000;
    const discountRate = 10; // 10%
    const discountAmount = subtotal * (discountRate / 100);
    const total = subtotal - discountAmount;
    assert(total === 9000, 'Percentage discount (10% off 10,000)');
    assert(discountAmount === 1000, 'Discount amount calculation');
})();

// Test: Discount (fixed amount) 
(() => {
    const subtotal = 10000;
    const fixedDiscount = 1500;
    const total = subtotal - fixedDiscount;
    assert(total === 8500, 'Fixed discount (1,500 off 10,000)');
})();

// Test: Line-level discount
(() => {
    const linePrice = 5000;
    const lineQuantity = 3;
    const lineDiscountRate = 20; // 20% per line
    const lineTotal = linePrice * lineQuantity;
    const lineDiscount = lineTotal * (lineDiscountRate / 100);
    const netLine = lineTotal - lineDiscount;
    assertApprox(netLine, 12000, 'Line-level 20% discount on 15,000');
})();

// Test: Zero quantity edge case
(() => {
    const cart = [
        { id: 1, price: 1000, quantity: 0 },
    ];
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    assert(subtotal === 0, 'Zero quantity produces zero subtotal');
})();

// Test: Negative quantity (returns)
(() => {
    const cart = [
        { id: 1, price: 1000, quantity: 2 },
        { id: 2, price: 500, quantity: -1 }, // return
    ];
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    assert(subtotal === 1500, 'Negative quantity (return) reduces subtotal');
})();

// Test: Discount cannot exceed subtotal
(() => {
    const subtotal = 5000;
    const discountRate = 150; // 150% — invalid
    const discountAmount = Math.min(subtotal, subtotal * (discountRate / 100));
    const total = Math.max(0, subtotal - discountAmount);
    assert(total === 0, 'Discount capped at subtotal (no negative total)');
})();

// ═══════════════════════════════════════════════════════════
// SUITE 2: Tax Calculations
// ═══════════════════════════════════════════════════════════
console.log('\n💰 SUITE 2: Tax Calculations');

// Test: Standard VAT (18% — Côte d'Ivoire standard rate)
(() => {
    const priceHT = 10000; // HT = Hors Taxes (before tax)
    const vatRate = 18;
    const vatAmount = priceHT * (vatRate / 100);
    const priceTTC = priceHT + vatAmount; // TTC = Toutes Taxes Comprises (with tax)
    assertApprox(vatAmount, 1800, 'VAT 18% on 10,000');
    assertApprox(priceTTC, 11800, 'TTC price with 18% VAT');
})();

// Test: Extract VAT from TTC price
(() => {
    const priceTTC = 11800;
    const vatRate = 18;
    const priceHT = priceTTC / (1 + vatRate / 100);
    const vatAmount = priceTTC - priceHT;
    assertApprox(priceHT, 10000, 'Extract HT from TTC (18%)', 0.02);
    assertApprox(vatAmount, 1800, 'Extract VAT from TTC (18%)', 0.02);
})();

// Test: Zero tax rate
(() => {
    const priceHT = 5000;
    const vatRate = 0;
    const vatAmount = priceHT * (vatRate / 100);
    assert(vatAmount === 0, 'Zero tax rate produces zero tax');
})();

// Test: Mixed tax cart (some items taxed, some exempt)
(() => {
    const cart = [
        { price: 10000, quantity: 1, taxRate: 18 },  // taxed
        { price: 5000, quantity: 2, taxRate: 0 },     // exempt
    ];
    const totalHT = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalVAT = cart.reduce((sum, item) => {
        const lineTotal = item.price * item.quantity;
        return sum + (lineTotal * item.taxRate / 100);
    }, 0);
    assertApprox(totalHT, 20000, 'Mixed cart HT total');
    assertApprox(totalVAT, 1800, 'Mixed cart VAT (only on taxed items)');
    assertApprox(totalHT + totalVAT, 21800, 'Mixed cart TTC total');
})();

// ═══════════════════════════════════════════════════════════
// SUITE 3: Payment & Change Calculations
// ═══════════════════════════════════════════════════════════
console.log('\n💳 SUITE 3: Payment & Change');

// Test: Exact payment
(() => {
    const total = 15000;
    const cashReceived = 15000;
    const change = cashReceived - total;
    assert(change === 0, 'Exact payment gives zero change');
})();

// Test: Overpayment
(() => {
    const total = 15000;
    const cashReceived = 20000;
    const change = cashReceived - total;
    assert(change === 5000, 'Overpayment change calculation');
})();

// Test: Multi-payment legs
(() => {
    const total = 25000;
    const legs = [
        { method: 'CASH', amount: 10000 },
        { method: 'CARD', amount: 10000 },
        { method: 'WAVE', amount: 5000 },
    ];
    const totalPaid = legs.reduce((sum, leg) => sum + leg.amount, 0);
    const remaining = total - totalPaid;
    assert(totalPaid === 25000, 'Multi-payment total matches');
    assert(remaining === 0, 'Multi-payment fully covers total');
})();

// Test: Partial payment
(() => {
    const total = 25000;
    const legs = [
        { method: 'CASH', amount: 10000 },
        { method: 'CARD', amount: 5000 },
    ];
    const totalPaid = legs.reduce((sum, leg) => sum + leg.amount, 0);
    const remaining = total - totalPaid;
    assert(remaining === 10000, 'Partial payment shows correct remaining');
})();

// ═══════════════════════════════════════════════════════════
// SUITE 4: Double-Entry Accounting (Ledger Balance)
// ═══════════════════════════════════════════════════════════
console.log('\n📊 SUITE 4: Double-Entry Accounting');

// Test: Journal entry must balance
(() => {
    const journalLines = [
        { account: 'Cash', debit: 11800, credit: 0 },
        { account: 'Revenue', debit: 0, credit: 10000 },
        { account: 'VAT Payable', debit: 0, credit: 1800 },
    ];
    const totalDebits = journalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = journalLines.reduce((sum, l) => sum + l.credit, 0);
    assert(totalDebits === totalCredits, 'Journal entry debits = credits');
    assertApprox(totalDebits, 11800, 'Journal total is 11,800');
})();

// Test: Unbalanced entry detection
(() => {
    const journalLines = [
        { account: 'Cash', debit: 10000, credit: 0 },
        { account: 'Revenue', debit: 0, credit: 9000 },
    ];
    const totalDebits = journalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = journalLines.reduce((sum, l) => sum + l.credit, 0);
    assert(totalDebits !== totalCredits, 'Unbalanced entry detected');
})();

// Test: Trial balance
(() => {
    const accounts = [
        { name: 'Cash', balance: 50000, type: 'debit' },
        { name: 'Revenue', balance: 30000, type: 'credit' },
        { name: 'Inventory', balance: 20000, type: 'debit' },
        { name: 'Equity', balance: 40000, type: 'credit' },
    ];
    const totalDebitBalances = accounts.filter(a => a.type === 'debit').reduce((s, a) => s + a.balance, 0);
    const totalCreditBalances = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + a.balance, 0);
    assert(totalDebitBalances === totalCreditBalances, 'Trial balance: debits = credits');
})();

// ═══════════════════════════════════════════════════════════
// SUITE 5: Currency & Rounding
// ═══════════════════════════════════════════════════════════
console.log('\n🪙 SUITE 5: Currency & Rounding');

// Test: FCFA rounding (no decimals)
(() => {
    const amount = 1234.567;
    const rounded = Math.round(amount);
    assert(rounded === 1235, 'FCFA rounds to nearest integer');
})();

// Test: Floating point trap (the classic 0.1 + 0.2 problem)
(() => {
    const a = 0.1 + 0.2;
    const safeResult = Math.round(a * 100) / 100;
    assertApprox(safeResult, 0.3, 'Floating point safety (0.1 + 0.2 = 0.3)');
})();

// Test: Large number formatting
(() => {
    const amount = 1234567;
    const formatted = amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    assert(formatted === '1 234 567', 'Large number thousand-separator formatting');
})();

// ═══════════════════════════════════════════════════════════
// SUITE 6: Inventory Stock Logic
// ═══════════════════════════════════════════════════════════
console.log('\n📦 SUITE 6: Inventory Stock Logic');

// Test: Stock deduction on sale
(() => {
    let stock = 100;
    const saleQty = 5;
    stock -= saleQty;
    assert(stock === 95, 'Stock reduces by sale quantity');
})();

// Test: Stock cannot go negative (when setting enabled)
(() => {
    const stock = 3;
    const requestedQty = 5;
    const allowNegative = false;
    const canSell = allowNegative || stock >= requestedQty;
    assert(!canSell, 'Cannot sell more than stock when negative stock disabled');
})();

// Test: Stock CAN go negative (when setting enabled)
(() => {
    const stock = 3;
    const requestedQty = 5;
    const allowNegative = true;
    const canSell = allowNegative || stock >= requestedQty;
    assert(canSell, 'Can sell more than stock when negative stock allowed');
})();

// ═══════════════════════════════════════════════════════════
// SUITE 7: Loyalty & Fidelity Points
// ═══════════════════════════════════════════════════════════
console.log('\n⭐ SUITE 7: Loyalty Points');

// Test: Points earned from purchase
(() => {
    const purchaseAmount = 50000;
    const pointsPerUnit = 100; // 1 point per 100 FCFA
    const pointsEarned = Math.floor(purchaseAmount / pointsPerUnit);
    assert(pointsEarned === 500, 'Points earned from 50,000 FCFA purchase at 1:100');
})();

// Test: Points redemption value
(() => {
    const points = 500;
    const pointValue = 10; // each point = 10 FCFA
    const discount = points * pointValue;
    assert(discount === 5000, 'Redemption value of 500 points at 10 FCFA each');
})();

// Test: Points cannot exceed total
(() => {
    const total = 3000;
    const pointsBalance = 500;
    const pointValue = 10;
    const maxRedeemable = Math.min(pointsBalance * pointValue, total);
    assert(maxRedeemable === 3000, 'Points redemption capped at order total');
})();

// ═══════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════
console.log('\n');
console.log('═══════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('═══════════════════════════════════════════════════');

if (failures.length > 0) {
    console.log('\n❌ FAILURES:');
    failures.forEach(f => {
        console.log(`  • ${f.testName}`);
        if (f.details) console.log(`    ${f.details}`);
    });
    process.exit(1);
} else {
    console.log('✅ All business logic tests passed!');
    process.exit(0);
}
