import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AppPageProps {
    params: Promise<{ code: string }>;
}

/**
 * Dynamic Module Mounter
 * This component acts as a "Hot-Swap" loader for business modules.
 * It keeps the main route tree clean by loading modules on demand.
 */
export default async function DynamicModulePage({ params }: AppPageProps) {
    const { code } = await params;

    const ModuleEntry = dynamic(
        async () => {
            try {
                return await import(`@/modules/${code}`);
            } catch (e) {
                return { default: () => notFound() };
            }
        },
        {
            loading: () => (
                <div className="p-8 space-y-4">
                    <Skeleton className="h-12 w-[250px]" />
                    <Skeleton className="h-[400px] w-full" />
                </div>
            )
        }
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Suspense fallback={null}>
                <ModuleEntry />
            </Suspense>
        </div>
    );
}
