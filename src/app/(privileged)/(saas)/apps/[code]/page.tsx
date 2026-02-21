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

    // 1. In a real scenario, we would check if this organization has the module enabled here.
    // const isEnabled = await checkModuleEnabled(code); 
    // if (!isEnabled) notFound();

    // 2. Dynamically import the module entry point from src/modules
    // We use a safe-guard to prevent arbitrary path traversal
    const ModuleEntry = dynamic(
        () => import(`../../modules/${code}`).catch(() => ({
            default: () => notFound()
        })),
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
