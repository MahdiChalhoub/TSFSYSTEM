const { processSale } = require('./.next/server/app/(privileged)/sales/actions.js');
// Mocking the required Next.js environment variables or functions if necessary
async function runTest() {
  try {
    const result = await processSale({
       cart: [{
           productId: 1, // Assumption: product 1 exists
           quantity: 2,
           price: 15.00,
           discountRate: 10 // 10% discount
       }],
       paymentMethod: 'CASH',
       totalAmount: 27.00, // 2 * 15 = 30; 10% off = 3; 30 - 3 = 27
       cashReceived: 30.00,
       warehouseId: 1
    });
    console.log("TEST RESULT:", result);
  } catch (e) {
    console.error("TEST FAILED:", e);
  }
}
runTest();
