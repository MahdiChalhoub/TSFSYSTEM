
import { prisma } from './src/lib/db';

async function main() {
    const countries = await prisma.country.findMany();
    console.log('Countries count:', countries.length);
    console.log('Countries:', countries);

    const products = await prisma.product.findMany({ include: { country: true } });
    console.log('Products:', products.slice(0, 3));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
