'use client';

/**
 * Migration v2.0 Wizard - CORRECTED FLOW
 * =======================================
 * URL: /migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS
 *
 * Correct Steps:
 * 1. REVIEW_SCOPE - Show selected scope & source (from URL)
 * 2. SELECT_ORG - Choose target organization
 * 3. SELECT_DATA_SOURCE - Upload from PC OR pick from Cloud Storage ⭐
 * 4. VALIDATE - Pre-flight validation (COA + posting rules)
 * 5. MASTER_DATA - Import master data
 * 6. ENTITIES - Import customers/suppliers
 * 7. COMPLETE - Summary
 */

import { useState, useEffect } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppCard } from '@/components/app/ui/AppCard';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Upload,
    Database,
    Users,
    Package,
    ShoppingCart,
    Loader2,
    Building2,
    FileUp,
    Cloud,
    HardDrive,
    CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    createMigrationJob,
    validateJob,
    executeMasterData,
    executeEntities,
    pollJobStatus,
    getOrganizations,
    linkMigrationFile,
} from '@/lib/api/migration-v2-client';
import type {
    MigrationV2Job,
    ValidationResult,
    Organization,
} from '@/types/migration-v2';

// ─── Types ──────────────────────────────────────────────────────

type WizardStep =
    | 'REVIEW_SCOPE'
    | 'SELECT_DATA_SOURCE'
    | 'SELECT_ORG'
    | 'VALIDATE'
    | 'MASTER_DATA'
    | 'ENTITIES'
    | 'COMPLETE';

type DataSourceType = 'UPLOAD' | 'CLOUD';

// ─── Constants ──────────────────────────────────────────────────

const SOURCE_INFO: Record<string, { label: string; icon: string; desc: string }> = {
    ULTIMATE_POS: { label: 'UltimatePOS', icon: '🛒', desc: 'Laravel/MySQL POS system' },
    ODOO: { label: 'Odoo ERP', icon: '🔮', desc: 'Open-source ERP platform' },
    EXCEL_CSV: { label: 'Excel / CSV', icon: '📊', desc: 'Spreadsheet files' },
};

const SCOPE_INFO: Record<string, { label: string; desc: string }> = {
    FULL: { label: 'Full Migration', desc: 'All data (products, contacts, transactions, stock)' },
    PRODUCTS: { label: 'Products Only', desc: 'Master data: categories, brands, products' },
    CONTACTS: { label: 'Contacts Only', desc: 'Customers and suppliers' },
    TRANSACTIONS: { label: 'Transactions Only', desc: 'Sales and purchases' },
    STOCK: { label: 'Stock/Inventory', desc: 'Inventory levels and movements' },
};

export default function MigrationWizardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: userLoading } = useUser();

    // URL parameters
    const sourceParam = searchParams.get('source') || 'ULTIMATE_POS';
    const scopeParam = searchParams.get('scope') || 'FULL';

    // State
    const [currentStep, setCurrentStep] = useState<WizardStep>('REVIEW_SCOPE');
    const [job, setJob] = useState<MigrationV2Job | null>(null);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [, setSelectedOrg] = useState<Organization | null>(null);
    const [dataSourceType, setDataSourceType] = useState<DataSourceType | null>(null);
    const [selectedFile, setSelectedFile] = useState<any | null>(null);
    const [cloudFiles, setCloudFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load organizations when user is ready and we reach the org selection step
    useEffect(() => {
        if (currentStep === 'SELECT_ORG' && !userLoading) {
            loadOrganizations();
        }
    }, [currentStep, userLoading, user]);

    // Load cloud files when cloud storage tab is opened
    useEffect(() => {
        if (currentStep === 'SELECT_DATA_SOURCE' && dataSourceType === 'CLOUD') {
            loadCloudFiles();
        }
    }, [currentStep, dataSourceType]);

    async function loadOrganizations() {
        try {
            // In TSFSYSTEM, UserSerializer returns { organization: { id, name, slug } }
            const org = user?.organization;
            if (org && org.id && org.name) {
                const currentOrg: Organization = {
                    id: org.id,
                    name: org.name,
                    business_name: org.name,
                    slug: org.slug,
                    is_active: true,
                };
                setOrganizations([currentOrg]);
                console.log('Using current user organization:', currentOrg);
            } else {
                // Fallback: try to load from API
                const orgs = await getOrganizations();
                console.log('Loaded organizations from API:', orgs);
                if (orgs && orgs.length > 0) {
                    setOrganizations(orgs);
                } else {
                    setError('No organization found. Please make sure you are logged in with an organization account.');
                    toast.error('No organization found');
                }
            }
        } catch (err: any) {
            console.error('Failed to load organizations:', err);
            setError(err.message || 'Failed to load organizations');
            toast.error('Failed to load organizations');
        }
    }

    async function loadCloudFiles() {
        try {
            setLoading(true);
            // Call your storage API to list .sql files
            const data = await erpFetch('/storage/files/?category=MIGRATION');
            const sqlFiles = (data?.results || []).filter((f: any) =>
                (f.original_filename || f.filename || '').toLowerCase().endsWith('.sql')
            );
            setCloudFiles(sqlFiles);
        } catch (err) {
            toast.error('Failed to load cloud files');
        } finally {
            setLoading(false);
        }
    }

    // ─── Step Handlers ──────────────────────────────────────────────

    function handleConfirmScope() {
        setCurrentStep('SELECT_DATA_SOURCE');
    }

    async function handleSelectOrganization(org: Organization) {
        setSelectedOrg(org);
        setLoading(true);
        try {
            const newJob = await createMigrationJob({
                name: `${SCOPE_INFO[scopeParam].label} from ${SOURCE_INFO[sourceParam].label} - ${new Date().toLocaleDateString()}`,
                target_organization_id: org.id,
                coa_template: 'SYSCOHADA',
            });

            // Link the selected file
            if (selectedFile?.uuid) {
                await linkMigrationFile(newJob.id, {
                    file_uuid: selectedFile.uuid,
                    name: selectedFile.filename || selectedFile.original_filename || 'migration.sql'
                });
            }

            setJob(newJob);
            toast.success('Migration job created & file linked!');
            setCurrentStep('VALIDATE');
        } catch (err: any) {
            setError(err.message || 'Failed to create migration job');
            toast.error('Failed to create job');
        } finally {
            setLoading(false);
        }
    }

    async function handleUploadFile() {
        if (!selectedFile) return;
        setLoading(true);
        try {
            // TODO: Implement chunked upload
            toast.info('File upload coming soon. Proceeding to organization selection...');
            setCurrentStep('SELECT_ORG');
        } catch (err: any) {
            setError(err.message || 'Upload failed');
            toast.error('Upload failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleSelectCloudFile(file: any) {
        setLoading(true);
        try {
            toast.success('File selected! Now choose target organization...');
            setSelectedFile(file);
            setCurrentStep('SELECT_ORG');
        } catch (err: any) {
            setError(err.message || 'Failed to select file');
            toast.error('Failed to select file');
        } finally {
            setLoading(false);
        }
    }

    async function handleValidation() {
        if (!job) return;
        setLoading(true);
        try {
            const result = await validateJob(job.id);
            setValidation(result);
            if (result.is_valid) {
                toast.success('Validation passed!');
                setCurrentStep('MASTER_DATA');
            } else {
                toast.error(`Validation failed with ${result.errors.length} errors`);
            }
        } catch (err: any) {
            setError(err.message || 'Validation failed');
            toast.error('Validation failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleMasterDataImport() {
        if (!job) return;
        setLoading(true);
        try {
            const updated = await executeMasterData(job.id);
            setJob(updated);
            toast.success('Master data import started!');

            await pollJobStatus(
                job.id,
                (updatedJob) => setJob(updatedJob),
                3000,
                (updatedJob) => updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED'
            );

            setCurrentStep('ENTITIES');
        } catch (err: any) {
            setError(err.message || 'Import failed');
            toast.error('Import failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleEntityMigration() {
        if (!job) return;
        setLoading(true);
        try {
            const updated = await executeEntities(job.id);
            setJob(updated);
            toast.success('Entity migration started!');

            await pollJobStatus(
                job.id,
                (updatedJob) => setJob(updatedJob),
                3000,
                (updatedJob) => updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED'
            );

            setCurrentStep('COMPLETE');
        } catch (err: any) {
            setError(err.message || 'Migration failed');
            toast.error('Migration failed');
        } finally {
            setLoading(false);
        }
    }

    // ─── Render ─────────────────────────────────────────────────────

    const sourceInfo = SOURCE_INFO[sourceParam] || SOURCE_INFO.ULTIMATE_POS;
    const scopeInfo = SCOPE_INFO[scopeParam] || SCOPE_INFO.FULL;

    return (
        <div className="min-h-screen bg-app-bg p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/migration_v2/jobs')}
                        className="h-12 w-12 rounded-xl"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1>
                            Migration Wizard <span className="text-app-success">v2.0</span>
                        </h1>
                        <p className="text-sm text-app-muted-foreground font-medium">
                            {scopeInfo.label} from {sourceInfo.label}
                        </p>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <AppCard variant="flat" padding="md" className="mb-6 border-app-error/30 bg-app-error-bg">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-app-error" />
                            <span className="text-app-error font-medium">{error}</span>
                            <button onClick={() => setError(null)} className="ml-auto text-app-error">✕</button>
                        </div>
                    </AppCard>
                )}

                {/* Step Content */}
                <AppCard variant="default" padding="lg">
                    {/* STEP 1: Review Scope & Source */}
                    {currentStep === 'REVIEW_SCOPE' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="text-6xl mb-4">{sourceInfo.icon}</div>
                                <h2>Confirm Migration Settings</h2>
                                <p className="text-app-muted-foreground mt-2">Review your import configuration</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 bg-app-surface rounded-2xl border border-app-border">
                                    <h3 className="mb-2">Import Scope</h3>
                                    <p className="text-xl font-black text-app-success">{scopeInfo.label}</p>
                                    <p className="text-sm text-app-muted-foreground mt-1">{scopeInfo.desc}</p>
                                </div>

                                <div className="p-6 bg-app-surface rounded-2xl border border-app-border">
                                    <h3 className="mb-2">Source Application</h3>
                                    <p className="text-xl font-black text-app-info">{sourceInfo.label}</p>
                                    <p className="text-sm text-app-muted-foreground mt-1">{sourceInfo.desc}</p>
                                </div>
                            </div>

                            <Button
                                onClick={handleConfirmScope}
                                className="w-full bg-app-primary hover:bg-app-primary-dark text-white font-bold py-6 rounded-xl"
                            >
                                Continue <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                            </Button>
                        </div>
                    )}

                    {/* STEP 2: Select Organization */}
                    {currentStep === 'SELECT_ORG' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <Building2 className="w-16 h-16 text-app-success mx-auto mb-4" />
                                <h2>Select Target Organization</h2>
                                <p className="text-app-muted-foreground mt-2">Choose which organization to import data INTO</p>
                            </div>

                            {userLoading || organizations.length === 0 ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-app-muted-foreground mx-auto mb-4" />
                                    <p className="text-app-muted-foreground">
                                        {userLoading ? 'Loading user information...' : 'Loading organizations...'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {organizations.map((org) => (
                                        <button
                                            key={org.id}
                                            onClick={() => handleSelectOrganization(org)}
                                            disabled={loading}
                                            className="text-left p-6 rounded-2xl bg-app-surface border border-app-border hover:border-app-success/50 hover:shadow-lg transition-all disabled:opacity-50"
                                        >
                                            <Building2 className="w-8 h-8 text-app-success mb-3" />
                                            <h3>{org.name}</h3>
                                            <p className="text-xs text-app-muted-foreground mt-1">{org.slug}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Select Data Source ⭐ THIS IS THE KEY STEP */}
                    {currentStep === 'SELECT_DATA_SOURCE' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <Database className="w-16 h-16 text-app-success mx-auto mb-4" />
                                <h2>Select Data Source</h2>
                                <p className="text-app-muted-foreground mt-2">
                                    Upload SQL dump from your computer or pick from cloud storage
                                </p>
                            </div>

                            {/* Choose Upload or Cloud */}
                            {!dataSourceType ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setDataSourceType('UPLOAD')}
                                        className="p-8 rounded-2xl bg-app-surface border-2 border-app-border hover:border-app-success/50 hover:shadow-lg transition-all text-center"
                                    >
                                        <HardDrive className="w-12 h-12 text-app-info mx-auto mb-4" />
                                        <h3 className="mb-2">Upload from PC</h3>
                                        <p className="text-sm text-app-muted-foreground">
                                            Select a .sql file from your local computer
                                        </p>
                                    </button>

                                    <button
                                        onClick={() => setDataSourceType('CLOUD')}
                                        className="p-8 rounded-2xl bg-app-surface border-2 border-app-border hover:border-app-success/50 hover:shadow-lg transition-all text-center"
                                    >
                                        <Cloud className="w-12 h-12 text-app-success mx-auto mb-4" />
                                        <h3 className="mb-2">Pick from Cloud Storage</h3>
                                        <p className="text-sm text-app-muted-foreground">
                                            Choose a file already uploaded to TSF Cloud
                                        </p>
                                    </button>
                                </div>
                            ) : dataSourceType === 'UPLOAD' ? (
                                <div className="space-y-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setDataSourceType(null)}
                                        className="mb-4"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to options
                                    </Button>

                                    <div className="border-2 border-dashed border-app-border rounded-2xl p-16 text-center">
                                        <FileUp className="w-16 h-16 text-app-muted-foreground mx-auto mb-4" />
                                        <p className="text-app-muted-foreground mb-6">Drag & drop or click to browse</p>
                                        <input
                                            type="file"
                                            accept=".sql"
                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <label htmlFor="file-upload" className="cursor-pointer">
                                            <span className="inline-flex items-center justify-center bg-app-primary hover:bg-app-primary-dark text-white font-bold px-8 py-4 rounded-xl transition-colors">
                                                Browse Files
                                            </span>
                                        </label>
                                        {selectedFile && (
                                            <div className="mt-4 p-4 bg-app-success-bg rounded-xl">
                                                <p className="text-sm font-bold text-app-success">{selectedFile.name}</p>
                                                <p className="text-xs text-app-success">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        )}
                                    </div>

                                    {selectedFile && (
                                        <Button
                                            onClick={handleUploadFile}
                                            disabled={loading}
                                            className="w-full bg-app-primary hover:bg-app-primary-dark text-white font-bold py-6 rounded-xl"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-5 h-5 mr-2" />
                                                    Upload & Continue
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setDataSourceType(null)}
                                        className="mb-4"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to options
                                    </Button>

                                    {loading ? (
                                        <div className="text-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-app-muted-foreground mx-auto mb-4" />
                                            <p className="text-app-muted-foreground">Loading cloud files...</p>
                                        </div>
                                    ) : cloudFiles.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed border-app-border rounded-2xl">
                                            <Cloud className="w-12 h-12 text-app-muted-foreground mx-auto mb-4" />
                                            <p className="text-app-muted-foreground">No .sql files found in cloud storage</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                            {cloudFiles.map((file) => (
                                                <button
                                                    key={file.uuid}
                                                    onClick={() => handleSelectCloudFile(file)}
                                                    className="w-full text-left p-4 rounded-xl bg-app-surface border border-app-border hover:border-app-success/30 transition-all flex items-center gap-4"
                                                >
                                                    <Database className="w-8 h-8 text-app-success shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-app-foreground truncate">
                                                            {file.original_filename || file.filename}
                                                        </p>
                                                        <p className="text-xs text-app-muted-foreground">
                                                            {(file.file_size / 1024 / 1024).toFixed(2)} MB •
                                                            {new Date(file.uploaded_at || file.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <CheckCircle2 className="w-5 h-5 text-app-success" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Validation */}
                    {currentStep === 'VALIDATE' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <CheckCircle2 className="w-16 h-16 text-app-success mx-auto mb-4" />
                                <h2>Pre-Flight Validation</h2>
                                <p className="text-app-muted-foreground mt-2">Checking COA and posting rules</p>
                            </div>

                            {validation ? (
                                <div className="space-y-4">
                                    <div className={`p-6 rounded-2xl ${validation.is_valid ? 'bg-app-success-bg border border-app-success' : 'bg-app-error-bg border border-app-error'}`}>
                                        <div className="flex items-center gap-3 mb-4">
                                            {validation.is_valid ? (
                                                <CheckCircle2 className="w-6 h-6 text-app-success" />
                                            ) : (
                                                <XCircle className="w-6 h-6 text-app-error" />
                                            )}
                                            <h3>
                                                {validation.is_valid ? 'Validation Passed ✓' : 'Validation Failed'}
                                            </h3>
                                        </div>

                                        {validation.errors.length > 0 && (
                                            <div className="space-y-2">
                                                {validation.errors.map((err, i) => (
                                                    <div key={i} className="p-3 rounded-xl bg-app-error-bg text-app-error">
                                                        <p className="font-bold">{err.code}</p>
                                                        <p className="text-sm">{err.message}</p>
                                                        {err.action_url && (
                                                            <a href={err.action_url} className="text-xs underline mt-1 block">
                                                                Fix this →
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {validation.is_valid && (
                                        <Button
                                            onClick={() => setCurrentStep('MASTER_DATA')}
                                            className="w-full bg-app-primary hover:bg-app-primary-dark text-white font-bold py-6 rounded-xl"
                                        >
                                            Continue to Import
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Button
                                        onClick={handleValidation}
                                        disabled={loading}
                                        className="bg-app-primary hover:bg-app-primary-dark text-white font-bold px-12 py-6 rounded-xl"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Validating...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                                Run Validation
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 5-7: Import Steps (simplified for now) */}
                    {(currentStep === 'MASTER_DATA' || currentStep === 'ENTITIES') && (
                        <div className="space-y-6">
                            <div className="text-center">
                                {currentStep === 'MASTER_DATA' ? (
                                    <>
                                        <Package className="w-16 h-16 text-app-success mx-auto mb-4" />
                                        <h2>Import Master Data</h2>
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-16 h-16 text-app-success mx-auto mb-4" />
                                        <h2>Import Customers & Suppliers</h2>
                                    </>
                                )}
                            </div>

                            {job && job.status === 'RUNNING' ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-12 h-12 animate-spin text-app-success mx-auto mb-4" />
                                    <p className="text-app-foreground font-bold">{job.current_step}</p>
                                    <div className="mt-6 max-w-md mx-auto">
                                        <div className="w-full h-2 bg-app-surface-2 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-app-primary transition-all duration-500"
                                                style={{ width: `${job.progress_percent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Button
                                        onClick={currentStep === 'MASTER_DATA' ? handleMasterDataImport : handleEntityMigration}
                                        disabled={loading}
                                        className="bg-app-primary hover:bg-app-primary-dark text-white font-bold px-12 py-6 rounded-xl"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Starting...
                                            </>
                                        ) : (
                                            <>
                                                Start Import
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 8: Complete */}
                    {currentStep === 'COMPLETE' && (
                        <div className="space-y-6 text-center py-12">
                            <CheckCircle2 className="w-24 h-24 text-app-success mx-auto" />
                            <h2>Migration Complete!</h2>
                            <p className="text-app-muted-foreground max-w-md mx-auto">
                                Your data has been successfully migrated.
                            </p>

                            {job && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mt-8">
                                    <div className="p-4 bg-app-surface rounded-xl border border-app-border">
                                        <Package className="w-6 h-6 text-app-info mx-auto mb-2" />
                                        <p className="text-2xl font-black text-app-foreground">{job.imported_products}</p>
                                        <p className="text-xs text-app-muted-foreground">Products</p>
                                    </div>
                                    <div className="p-4 bg-app-surface rounded-xl border border-app-border">
                                        <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                                        <p className="text-2xl font-black text-app-foreground">
                                            {job.imported_customers + job.imported_suppliers}
                                        </p>
                                        <p className="text-xs text-app-muted-foreground">Contacts</p>
                                    </div>
                                    <div className="p-4 bg-app-surface rounded-xl border border-app-border">
                                        <ShoppingCart className="w-6 h-6 text-app-warning mx-auto mb-2" />
                                        <p className="text-2xl font-black text-app-foreground">{job.imported_sales}</p>
                                        <p className="text-xs text-app-muted-foreground">Sales</p>
                                    </div>
                                    <div className="p-4 bg-app-surface rounded-xl border border-app-border">
                                        <CheckSquare className="w-6 h-6 text-app-success mx-auto mb-2" />
                                        <p className="text-2xl font-black text-app-foreground">{job.total_verified}</p>
                                        <p className="text-xs text-app-muted-foreground">Verified</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 justify-center mt-8">
                                <Button
                                    onClick={() => router.push('/migration_v2/jobs')}
                                    variant="outline"
                                    className="px-8 py-4 rounded-xl font-bold"
                                >
                                    View All Jobs
                                </Button>
                                {job && (
                                    <Button
                                        onClick={() => router.push(`/migration_v2/jobs/${job.id}`)}
                                        className="bg-app-primary hover:bg-app-primary-dark text-white px-8 py-4 rounded-xl font-bold"
                                    >
                                        View Details
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </AppCard>
            </div>
        </div>
    );
}
