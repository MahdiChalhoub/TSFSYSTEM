const { erpFetch } = require('./src/lib/erp-api');
async function test() {
    try {
        const data = await erpFetch('pos/orders/?type=SALE');
        console.log('DATA:', JSON.stringify(data, null, 2).substring(0, 1000));
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
test();
