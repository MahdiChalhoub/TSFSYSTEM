import { erpFetch } from './src/lib/erp-api'

async function run() {
    const data = await erpFetch('pos/orders/?type=SALE')
    if (data.results && data.results.length > 0) {
        console.log(data.results[0].journal_entry)
        console.log(data.results[0].ref_code)
    }
}
run()
