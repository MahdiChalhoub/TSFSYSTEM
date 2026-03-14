'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';

export function CreateCategoryButton({ potentialParents = [] }: { potentialParents?: Record<string, any>[] }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-app-primary text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-app-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
                <Plus size={20} />
                <span>Create Category</span>
            </button>

            <CategoryFormModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                potentialParents={potentialParents}
            />
        </>
    );
}