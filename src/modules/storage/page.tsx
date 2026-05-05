'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Cloud, HardDrive, RefreshCcw, CheckCircle2, XCircle,
    Save, TestTube, Shield, Upload, FileText, Image, Loader2,
    Settings, Database, Lock, Unlock
} from 'lucide-react';
import {
    getStorageProvider, updateStorageProvider, testStorageConnection, listFiles
} from '@/modules/storage/actions';
import { FileUploader } from '@/components/shared/FileUploader';

// ─── Types ───────────────────────────────────────────────────────
interface ProviderConfig {
    id?: number;
    provider_type: string;
    endpoint_url: string;
    bucket_name: string;
    access_key_masked?: string;
    region: string;
    path_prefix: string;
    is_active: boolean;
    max_file_size_mb: number;
    allowed_extensions: string[];
}

interface StoredFile {
    uuid: string;
    original_filename: string;
    file_size_display: string;
    content_type: string;
    category: string;
    uploaded_by_name: string | null;
    uploaded_at: string;
}

const PROVIDER_OPTIONS = [
    { value: 'R2', label: 'Cloudflare R2', icon: Cloud, color: 'text-orange-400' },
    { value: 'S3', label: 'AWS S3', icon: Cloud, color: 'text-yellow-400' },
    { value: 'MINIO', label: 'MinIO', icon: Database, color: 'text-purple-400' },
    { value: 'LOCAL', label: 'Local Server', icon: HardDrive, color: 'text-app-muted-foreground' },
];

const CATEGORY_OPTIONS = [
    'ATTACHMENT', 'RECEIPT', 'INVOICE', 'PROFORMA', 'SIGNED_ORDER',
    'PURCHASE_DOC', 'EMPLOYEE_DOC', 'PRODUCT_IMAGE', 'PAYMENT_RECEIPT', 'LOGO', 'OTHER'
];

// ─── Main Page ───────────────────────────────────────────────────
export default function StorageSettingsPage() {
    const [config, setConfig] = useState<ProviderConfig | null>(null);
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [showUploader, setShowUploader] = useState(false);

    // Draft state for editing
    const [draft, setDraft] = useState({
        provider_type: 'LOCAL',
        endpoint_url: '',
        bucket_name: 'tsf-files',
        access_key: '',
        secret_key: '',
        region: 'auto',
        path_prefix: '',
        max_file_size_mb: 50,
        allowed_extensions: '' as string,
        is_active: true,
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [providerRes, filesRes] = await Promise.all([
                getStorageProvider(),
                listFiles(),
            ]);
            if (providerRes && !providerRes.error) {
                setConfig(providerRes);
                setDraft({
                    provider_type: providerRes.provider_type || 'LOCAL',
                    endpoint_url: providerRes.endpoint_url || '',
                    bucket_name: providerRes.bucket_name || 'tsf-files',
                    access_key: '',
                    secret_key: '',
                    region: providerRes.region || 'auto',
                    path_prefix: providerRes.path_prefix || '',
                    max_file_size_mb: providerRes.max_file_size_mb || 50,
                    allowed_extensions: (providerRes.allowed_extensions || []).join(', '),
                    is_active: providerRes.is_active ?? true,
                });
            }
            if (Array.isArray(filesRes)) {
                setFiles(filesRes);
            } else if (filesRes?.results) {
                setFiles(filesRes.results);
            }
        } catch (err) {
            console.error('Failed to load storage config', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                provider_type: draft.provider_type,
                endpoint_url: draft.endpoint_url,
                bucket_name: draft.bucket_name,
                region: draft.region,
                path_prefix: draft.path_prefix,
                max_file_size_mb: draft.max_file_size_mb,
                allowed_extensions: draft.allowed_extensions.split(',').map(s => s.trim()).filter(Boolean),
                is_active: draft.is_active,
            };
            if (draft.access_key) payload.access_key = draft.access_key;
            if (draft.secret_key) payload.secret_key = draft.secret_key;

            const res = await updateStorageProvider(payload as any);
            if (res && !res.error) {
                setConfig(res);
                setEditMode(false);
                setTestResult(null);
            }
        } catch (err) {
            console.error('Save failed', err);
        }
        setSaving(false);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await testStorageConnection();
            setTestResult(res);
        } catch (err) {
            setTestResult({ success: false, message: 'Connection test failed' });
        }
        setTesting(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 size={32} className="animate-spin text-emerald-400" />
            </div>
        );
    }

    const currentProvider = PROVIDER_OPTIONS.find(p => p.value === (config?.provider_type || 'LOCAL'));

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-white flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
                            <Cloud size={24} className="text-white" />
                        </div>
                        Cloud Storage
                    </h1>
                    <p className="text-app-muted-foreground mt-2">Configure external file storage for documents, images, and attachments</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowUploader(!showUploader)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-success/20 text-emerald-400 hover:bg-app-success/30 border border-app-success/30 transition-all text-sm font-medium"
                    >
                        <Upload size={16} />
                        Upload File
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 text-app-muted-foreground hover:text-white hover:bg-gray-700 border border-gray-700 transition-all text-sm"
                    >
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </div>

            {/* Upload Panel (collapsible) */}
            {showUploader && (
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 backdrop-blur-xl">
                    <h2 className="text-white mb-4 flex items-center gap-2">
                        <Upload size={18} className="text-emerald-400" />
                        Upload Files
                    </h2>
                    <FileUploader
                        category="ATTACHMENT"
                        maxSizeMb={config?.max_file_size_mb || 50}
                        acceptedTypes={config?.allowed_extensions}
                        onUploadComplete={() => fetchData()}
                    />
                </div>
            )}

            {/* Provider Configuration Card */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-xl">
                <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Settings size={18} className="text-app-muted-foreground" />
                        <h2 className="text-white">Provider Configuration</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {!editMode ? (
                            <button
                                onClick={() => setEditMode(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-app-muted-foreground hover:text-white hover:bg-gray-700 border border-gray-700 transition-all text-sm"
                            >
                                <Unlock size={14} />
                                Edit
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => setEditMode(false)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-app-muted-foreground hover:text-white border border-gray-700 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-success text-white hover:bg-app-success transition-all text-sm font-medium disabled:opacity-50"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Banner */}
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config?.is_active ? 'bg-app-success/10 border-app-success/30 text-emerald-400' : 'bg-app-error/10 border-app-error/30 text-red-400'}`}>
                        {config?.is_active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        <span className="text-sm font-medium">
                            {currentProvider?.label || 'Local'} — {config?.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {config?.provider_type !== 'LOCAL' && (
                            <span className="ml-auto text-xs text-app-muted-foreground">
                                Bucket: <span className="text-app-muted-foreground">{config?.bucket_name}</span>
                            </span>
                        )}
                    </div>

                    {editMode ? (
                        /* Edit Form */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Provider Type */}
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-2">Provider Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PROVIDER_OPTIONS.map(p => (
                                        <button
                                            key={p.value}
                                            onClick={() => setDraft(d => ({ ...d, provider_type: p.value }))}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${draft.provider_type === p.value
                                                ? 'border-app-success/50 bg-app-success/10 text-emerald-400'
                                                : 'border-gray-700 bg-gray-800/50 text-app-muted-foreground hover:border-gray-600'
                                                }`}
                                        >
                                            <p.icon size={16} className={p.color} />
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Endpoint URL */}
                            {draft.provider_type !== 'LOCAL' && (
                                <div>
                                    <label className="block text-sm font-medium text-app-muted-foreground mb-2">Endpoint URL</label>
                                    <input
                                        value={draft.endpoint_url}
                                        onChange={e => setDraft(d => ({ ...d, endpoint_url: e.target.value }))}
                                        placeholder="https://your-account.r2.cloudflarestorage.com"
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                    />
                                </div>
                            )}

                            {/* Bucket Name */}
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-2">Bucket Name</label>
                                <input
                                    value={draft.bucket_name}
                                    onChange={e => setDraft(d => ({ ...d, bucket_name: e.target.value }))}
                                    placeholder="tsf-files"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                />
                            </div>

                            {/* Region */}
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-2">Region</label>
                                <input
                                    value={draft.region}
                                    onChange={e => setDraft(d => ({ ...d, region: e.target.value }))}
                                    placeholder="auto"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                />
                            </div>

                            {/* Access Key */}
                            {draft.provider_type !== 'LOCAL' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-app-muted-foreground mb-2">
                                            Access Key {config?.access_key_masked && <span className="text-app-muted-foreground ml-1">(current: {config.access_key_masked})</span>}
                                        </label>
                                        <input
                                            type="password"
                                            value={draft.access_key}
                                            onChange={e => setDraft(d => ({ ...d, access_key: e.target.value }))}
                                            placeholder="Leave blank to keep current"
                                            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-app-muted-foreground mb-2">Secret Key</label>
                                        <input
                                            type="password"
                                            value={draft.secret_key}
                                            onChange={e => setDraft(d => ({ ...d, secret_key: e.target.value }))}
                                            placeholder="Leave blank to keep current"
                                            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Path Prefix */}
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-2">Path Prefix</label>
                                <input
                                    value={draft.path_prefix}
                                    onChange={e => setDraft(d => ({ ...d, path_prefix: e.target.value }))}
                                    placeholder="Auto: {org-slug}/"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                />
                            </div>

                            {/* Max File Size */}
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-2">Max File Size (MB)</label>
                                <input
                                    type="number"
                                    value={draft.max_file_size_mb}
                                    onChange={e => setDraft(d => ({ ...d, max_file_size_mb: parseInt(e.target.value) || 50 }))}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                />
                            </div>

                            {/* Allowed Extensions */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-app-muted-foreground mb-2">Allowed Extensions (comma-separated)</label>
                                <input
                                    value={draft.allowed_extensions}
                                    onChange={e => setDraft(d => ({ ...d, allowed_extensions: e.target.value }))}
                                    placeholder="pdf, jpg, jpeg, png, doc, docx, xls, xlsx"
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:border-app-success focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                                />
                            </div>
                        </div>
                    ) : (
                        /* Read-only Display */
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <InfoCard label="Provider" value={currentProvider?.label || 'Unknown'} icon={currentProvider?.icon || Cloud} />
                            <InfoCard label="Bucket" value={config?.bucket_name || '—'} icon={Database} />
                            <InfoCard label="Region" value={config?.region || 'auto'} icon={Cloud} />
                            <InfoCard label="Max Size" value={`${config?.max_file_size_mb || 50} MB`} icon={Upload} />
                            {config?.path_prefix && (
                                <InfoCard label="Path Prefix" value={config.path_prefix} icon={FileText} />
                            )}
                            {config?.access_key_masked && (
                                <InfoCard label="Access Key" value={config.access_key_masked} icon={Lock} />
                            )}
                        </div>
                    )}

                    {/* Test Connection */}
                    <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-info/20 text-blue-400 hover:bg-app-info/30 border border-app-info/30 transition-all text-sm font-medium disabled:opacity-50"
                        >
                            {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                            Test Connection
                        </button>
                        {testResult && (
                            <span className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                {testResult.message}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Files */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-xl">
                <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-white flex items-center gap-2">
                        <FileText size={18} className="text-app-muted-foreground" />
                        Recent Files
                        <span className="text-sm text-app-muted-foreground font-normal">({files.length})</span>
                    </h2>
                </div>

                {files.length === 0 ? (
                    <div className="p-12 text-center">
                        <Cloud size={48} className="mx-auto text-app-muted-foreground mb-4" />
                        <p className="text-app-muted-foreground">No files uploaded yet</p>
                        <p className="text-xs text-app-muted-foreground mt-1">Upload your first file to get started</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800/50">
                        {files.map(f => (
                            <div key={f.uuid} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/30 transition-colors">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.content_type?.startsWith('image/') ? 'bg-purple-500/20' : 'bg-app-info/20'
                                    }`}>
                                    {f.content_type?.startsWith('image/') ?
                                        <Image size={18} className="text-purple-400" /> :
                                        <FileText size={18} className="text-blue-400" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-200 truncate">{f.original_filename}</p>
                                    <p className="text-xs text-app-muted-foreground">
                                        {f.file_size_display} · {f.category} · {f.uploaded_by_name || 'System'}
                                    </p>
                                </div>
                                <span className="text-xs text-app-muted-foreground shrink-0">
                                    {new Date(f.uploaded_at).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────
function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
    return (
        <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-app-muted-foreground" />
                <span className="text-xs text-app-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-sm text-white font-medium truncate">{value}</p>
        </div>
    );
}
