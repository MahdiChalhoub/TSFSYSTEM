import { erpFetch } from "@/lib/erp-api";
import { BrandsClient } from "./BrandsClient";

export const dynamic = 'force-dynamic';

async function getBrandsData() {
 try {
 const brands = await erpFetch('brands/');
 const data = (brands as any);
 return Array.isArray(data) ? data : data?.results || [];
 } catch {
 return [];
 }
}

async function getCountriesData() {
 try {
 const countries = await erpFetch('countries/');
 const data = (countries as any);
 return Array.isArray(data) ? data : data?.results || [];
 } catch {
 return [];
 }
}

async function getCategoriesData() {
 try {
 const categories = await erpFetch('inventory/categories/with_counts/');
 const data = (categories as any);
 return Array.isArray(data) ? data : data?.results || [];
 } catch {
 return [];
 }
}

export default async function BrandsPage() {
 const [brands, countries, categories] = await Promise.all([
 getBrandsData(),
 getCountriesData(),
 getCategoriesData()
 ]);

 return (
 <BrandsClient
 initialBrands={brands}
 countries={countries}
 categories={categories}
 />
 );
}