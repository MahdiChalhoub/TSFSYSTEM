import AddProductForm from './form';

export default function NewProductPage() {
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Add New Product</h1>
                <p className="text-gray-500">Create a new item in the TSF Catalog.</p>
            </div>

            <AddProductForm />
        </div>
    );
}
