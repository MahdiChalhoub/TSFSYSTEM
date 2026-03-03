'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Cloud, HardDrive, RefreshCcw, CheckCircle2, XCircle,
    Save, TestTube, Shield, Upload, FileText, Image, Loader2,
    Settings, Database, Lock, Unlock, Search, Filter, Trash2,
    Download, MoreVertical, FolderOpen, FileSpreadsheet, File,
    ArrowUpDown, Package, AlertTriangle, X, Eye
} from 'lucide-react';
import {
    getStorageProvider, updateStorageProvider, testStorageConnection,
    listFiles, deleteFile, getDownloadUrl, initChunkedUpload,
    completeChunkedUpload, getUploadStatus, getActiveUploads, abortChunkedUpload
} from '@/modules/storage/actions';

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
    file_size: number;
    file_size_display: string;
    content_type: string;
    category: string;
    uploaded_by_name: string | null;
    uploaded_at: string;
    checksum: string;
    storage_key: string;
}

interface ActiveUpload {
    session_id: string;
    filename: string;
    total_size: number;
    bytes_received: number;
    progress: number;
    upload_type: string;
    created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────
const PROVIDER_OPTIONS = [
    { value: 'R2', label: 'Cloudflare R2', icon: Cloud, color: 'text-orange-500' },
    { value: 'S3', label: 'AWS S3', icon: Cloud, color: 'text-yellow-600' },
    { value: 'MINIO', label: 'MinIO', icon: Database, color: 'text-purple-500' },
    { value: 'LOCAL', label: 'Local Server', icon: HardDrive, color: 'text-app-text-faint' },
];

const CATEGORY_OPTIONS = [
    { value: '', label: 'All Categories' },
    { value: 'ATTACHMENT', label: 'Attachments' },
    { value: 'RECEIPT', label: 'Receipts' },
    { value: 'INVOICE', label: 'Invoices' },
    { value: 'PROFORMA', label: 'Proformas' },
    { value: 'SIGNED_ORDER', label: 'Signed Orders' },
    { value: 'PURCHASE_DOC', label: 'Purchase Docs' },
    { value: 'EMPLOYEE_DOC', label: 'Employee Docs' },
    { value: 'PRODUCT_IMAGE', label: 'Product Images' },
    { value: 'PAYMENT_RECEIPT', label: 'Payment Receipts' },
    { value: 'LOGO', label: 'Logos' },
    { value: 'OTHER', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
    ATTACHMENT: 'bg-blue-50 text-blue-600 border-blue-200',
    RECEIPT: 'bg-green-50 text-green-600 border-green-200',
    INVOICE: 'bg-amber-50 text-amber-600 border-amber-200',
    PROFORMA: 'bg-orange-50 text-orange-600 border-orange-200',
    SIGNED_ORDER: 'bg-purple-50 text-purple-600 border-purple-200',
    PURCHASE_DOC: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    EMPLOYEE_DOC: 'bg-rose-50 text-rose-600 border-rose-200',
    PRODUCT_IMAGE: 'bg-pink-50 text-pink-600 border-pink-200',
    PAYMENT_RECEIPT: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    LOGO: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    OTHER: 'bg-app-bg text-app-text-muted border-app-border',
};

function getFileIcon(mime: string) {
    if (mime?.startsWith('image/')) return Image;
    if (mime?.includes('spreadsheet') || mime?.includes('excel') || mime?.includes('csv')) return FileSpreadsheet;
    if (mime?.includes('pdf') || mime?.includes('document') || mime?.includes('word')) return FileText;
    return File;
}

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Chunked Upload Hook ─────────────────────────────────────────
function useChunkedUpload() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState('');
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    const upload = useCallback(async (file: globalThis.File, category = 'ATTACHMENT') => {
        setUploading(true);
        setProgress(0);
        setError(null);
        abortRef.current = false;

        const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        try {
            const session = await initChunkedUpload({
                filename: file.name,
                total_size: file.size,
                content_type: file.type || 'application/octet-stream',
                category,
                upload_type: 'file',
            });

            if (!session?.session_id) {
                throw new Error(session?.error || 'Failed to initialize upload');
            }

            let bytesSent = 0;
            const startTime = Date.now();

            for (let i = 0; i < totalChunks; i++) {
                if (abortRef.current) break;

                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk', blob, `chunk_${i}`);
                formData.append('offset', String(bytesSent));

                const res = await fetch(`/api/proxy/storage/upload/${session.session_id}/chunk/`, {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Chunk ${i + 1} failed`);
                }

                bytesSent = end;
                const pct = Math.round((bytesSent / file.size) * 100);
                setProgress(pct);

                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0) {
                    const bytesPerSec = bytesSent / elapsed;
                    setSpeed(`${formatBytes(bytesPerSec)}/s`);
                }
            }

            const result = await completeChunkedUpload(session.session_id);
            setProgress(100);
            setUploading(false);
            return result;

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            setError(message);
            setUploading(false);
            return null;
        }
    }, []);

    const resume = useCallback(async (sessionId: string, file: globalThis.File) => {
        setUploading(true);
        setError(null);
        abortRef.current = false;

        try {
            const status = await getUploadStatus(sessionId);
            if (!status || status.error) throw new Error(status?.error || 'Failed to get status');

            let bytesSent = status.bytes_received;
            const CHUNK_SIZE = 2 * 1024 * 1024;
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const startChunk = Math.floor(bytesSent / CHUNK_SIZE);

            const startTime = Date.now();

            for (let i = startChunk; i < totalChunks; i++) {
                if (abortRef.current) break;

                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const blob = file.slice(start, end);

                const formData = new FormData();
                formData.append('chunk', blob, `chunk_${i}`);
                formData.append('offset', String(start));

                const res = await fetch(`/api/proxy/storage/upload/${sessionId}/chunk/`, {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Chunk ${i + 1} failed`);
                }

                bytesSent = end;
                setProgress(Math.round((bytesSent / file.size) * 100));

                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0) setSpeed(`${formatBytes(bytesSent / elapsed)}/s`);
            }

            const result = await completeChunkedUpload(sessionId);
            setProgress(100);
            setUploading(false);
            return result;

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Resume failed');
            setUploading(false);
            return null;
        }
    }, []);

    const abort = useCallback(() => { abortRef.current = true; }, []);

    return { upload, resume, abort, uploading, progress, speed, error };
}

// ─── Tab type ────────────────────────────────────────────────────
type ViewTab = 'files' | 'settings';

// ─── Main Page ───────────────────────────────────────────────────
export default function StoragePage() {
    const [activeTab, setActiveTab] = useState<ViewTab>('files');
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);

    // Provider config state
    const [config, setConfig] = useState<ProviderConfig | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState({
        provider_type: 'LOCAL', endpoint_url: '', bucket_name: 'tsf-files',
        access_key: '', secret_key: '', region: 'auto', path_prefix: '',
        max_file_size_mb: 50, allowed_extensions: '' as string, is_active: true,
    });

    const chunked = useChunkedUpload();
    const uploadInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [filesRes, providerRes, uploadsRes] = await Promise.all([
                listFiles(categoryFilter ? { category: categoryFilter } : undefined),
                getStorageProvider(),
                getActiveUploads('file'),
            ]);
            if (Array.isArray(filesRes)) setFiles(filesRes);
            else if (filesRes?.results) setFiles(filesRes.results);

            if (providerRes && !providerRes.error) {
                setConfig(providerRes);
                setDraft({
                    provider_type: providerRes.provider_type || 'LOCAL',
                    endpoint_url: providerRes.endpoint_url || '',
                    bucket_name: providerRes.bucket_name || 'tsf-files',
                    access_key: '', secret_key: '',
                    region: providerRes.region || 'auto',
                    path_prefix: providerRes.path_prefix || '',
                    max_file_size_mb: providerRes.max_file_size_mb || 50,
                    allowed_extensions: (providerRes.allowed_extensions || []).join(', '),
                    is_active: providerRes.is_active ?? true,
                });
            }
            if (uploadsRes?.uploads) setActiveUploads(uploadsRes.uploads);
        } catch (err) {
            console.error('Failed to load storage data', err);
        }
        setLoading(false);
    }, [categoryFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setShowUpload(true);
        const result = await chunked.upload(file);
        if (result) {
            await fetchData();
            setShowUpload(false);
        }
    };

    const handleDownload = async (file: StoredFile) => {
        const res = await getDownloadUrl(file.uuid);
        if (res?.download_url) {
            window.open(res.download_url, '_blank');
        }
    };

    const handleAbortUpload = async (sessionId: string) => {
        if (!confirm('Are you sure you want to cancel and delete this upload?')) return;
        await abortChunkedUpload(sessionId);
        await fetchData();
    };

    const handleResumeUpload = async (sessionId: string, filename: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e: any) => {
            const file = e.target.files?.[0];
            if (file) {
                if (file.name !== filename) {
                    alert('Please select the original file to resume.');
                    return;
                }
                setShowUpload(true);
                const result = await chunked.resume(sessionId, file);
                if (result) {
                    await fetchData();
                    setShowUpload(false);
                }
            }
        };
        input.click();
    };

    const handleDelete = async (file: StoredFile) => {
        if (!confirm(`Delete "${file.original_filename}"?`)) return;
        await deleteFile(file.uuid);
        setFiles(f => f.filter(x => x.uuid !== file.uuid));
        if (selectedFile?.uuid === file.uuid) setSelectedFile(null);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload: Record<string, unknown> = {
            provider_type: draft.provider_type, endpoint_url: draft.endpoint_url,
            bucket_name: draft.bucket_name, region: draft.region, path_prefix: draft.path_prefix,
            max_file_size_mb: draft.max_file_size_mb,
            allowed_extensions: draft.allowed_extensions.split(',').map(s => s.trim()).filter(Boolean),
            is_active: draft.is_active,
        };
        if (draft.access_key) payload.access_key = draft.access_key;
        if (draft.secret_key) payload.secret_key = draft.secret_key;
        const res = await updateStorageProvider(payload);
        if (res && !res.error) { setConfig(res); setEditMode(false); }
        setSaving(false);
    };

    const handleTest = async () => {
        setTesting(true); setTestResult(null);
        try {
            const res = await testStorageConnection();
            setTestResult(res);
        } catch { setTestResult({ success: false, message: 'Connection test failed' }); }
        setTesting(false);
    };

    const filteredFiles = files.filter(f =>
        !search || f.original_filename.toLowerCase().includes(search.toLowerCase())
    );

    const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);
    const currentProvider = PROVIDER_OPTIONS.find(p => p.value === (config?.provider_type || 'LOCAL'));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCcw size={32} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-app-text tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-200/50">
                            <Cloud size={24} className="text-white" />
                        </div>
                        Cloud Storage
                    </h2>
                    <p className="text-app-text-faint mt-1 font-medium">Manage files, configure storage provider, and monitor uploads</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => uploadInputRef.current?.click()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-200/50 transition-all text-sm font-semibold">
                        <Upload size={16} /> Upload File
                    </button>
                    <input ref={uploadInputRef} type="file" className="hidden" onChange={handleUpload} />
                    <button onClick={fetchData}
                        className="p-2.5 rounded-xl bg-app-surface hover:bg-app-bg text-app-text-faint hover:text-app-text-muted transition-all border border-app-border shadow-sm">
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Files" value={String(files.length)} icon={FolderOpen} color="text-blue-500" bg="bg-blue-50" />
                <StatCard label="Total Size" value={formatBytes(totalSize)} icon={HardDrive} color="text-purple-500" bg="bg-purple-50" />
                <StatCard label="Provider" value={currentProvider?.label || 'Local'} icon={currentProvider?.icon || Cloud} color="text-orange-500" bg="bg-orange-50" />
                <StatCard label="Active Uploads" value={String(activeUploads.length)} icon={Upload} color={activeUploads.length > 0 ? 'text-amber-500' : 'text-app-text-faint'} bg={activeUploads.length > 0 ? 'bg-amber-50' : 'bg-app-bg'} />
            </div>

            {/* Upload Progress Bar */}
            {(showUpload || chunked.uploading) && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <Loader2 size={18} className="animate-spin text-blue-500" />
                            <span className="text-sm text-app-text font-semibold">Uploading...</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {chunked.speed && <span className="text-xs text-app-text-faint">{chunked.speed}</span>}
                            <span className="text-sm text-blue-600 font-mono font-bold">{chunked.progress}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${chunked.progress}%` }} />
                    </div>
                    {chunked.error && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                            <AlertTriangle size={14} /> {chunked.error}
                            <button onClick={() => setShowUpload(false)} className="ml-auto text-app-text-faint hover:text-app-text-muted"><X size={14} /></button>
                        </div>
                    )}
                </div>
            )}

            {/* Active Interrupted Uploads */}
            {activeUploads.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <span className="text-sm font-semibold text-amber-700">Interrupted Uploads — Action Required</span>
                    </div>
                    <div className="space-y-2">
                        {activeUploads.map(u => (
                            <div key={u.session_id} className="flex items-center gap-3 bg-app-surface rounded-xl p-3 border border-amber-100 group">
                                <File size={16} className="text-app-text-faint" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-app-text truncate mb-1">{u.filename}</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-app-surface-2 rounded-full h-1.5 max-w-[200px]">
                                            <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                                        </div>
                                        <span className="text-[10px] text-amber-600 font-bold whitespace-nowrap">{u.progress}% • {formatBytes(u.bytes_received)} / {formatBytes(u.total_size)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleResumeUpload(u.session_id, u.filename)}
                                        className="h-8 px-3 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1"
                                    >
                                        <RefreshCcw size={12} /> Resume
                                    </button>
                                    <button
                                        onClick={() => handleAbortUpload(u.session_id)}
                                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                        title="Cancel & Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-app-surface-2 p-1 rounded-xl w-fit">
                {(['files', 'settings'] as ViewTab[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-faint hover:text-app-text-muted'}`}>
                        {tab === 'files' ? 'Files' : 'Settings'}
                    </button>
                ))}
            </div>

            {activeTab === 'files' ? (
                <>
                    {/* Search & Filter Bar */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-faint" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search files..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-surface border border-app-border text-app-text text-sm placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm" />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                            className="px-4 py-2.5 rounded-xl bg-app-surface border border-app-border text-app-text-muted text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer pr-8 shadow-sm">
                            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>

                    {/* File List */}
                    <div className="bg-app-surface border border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-[1fr_120px_120px_140px_80px] gap-4 px-6 py-3 border-b border-app-border bg-gray-50/50">
                            <span className="text-xs text-app-text-faint uppercase tracking-wider font-bold">Name</span>
                            <span className="text-xs text-app-text-faint uppercase tracking-wider font-bold">Category</span>
                            <span className="text-xs text-app-text-faint uppercase tracking-wider font-bold">Size</span>
                            <span className="text-xs text-app-text-faint uppercase tracking-wider font-bold">Date</span>
                            <span className="text-xs text-app-text-faint uppercase tracking-wider font-bold text-right">Actions</span>
                        </div>

                        {filteredFiles.length === 0 ? (
                            <div className="p-16 text-center">
                                <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-app-text-faint text-lg font-medium">No files found</p>
                                <p className="text-xs text-app-text-faint mt-2">Upload your first file to get started</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-app-border">
                                {filteredFiles.map(f => {
                                    const Icon = getFileIcon(f.content_type);
                                    const catColor = CATEGORY_COLORS[f.category] || CATEGORY_COLORS.OTHER;
                                    return (
                                        <div key={f.uuid}
                                            onClick={() => setSelectedFile(selectedFile?.uuid === f.uuid ? null : f)}
                                            className={`grid grid-cols-[1fr_120px_120px_140px_80px] gap-4 px-6 py-3.5 hover:bg-app-bg transition-colors cursor-pointer ${selectedFile?.uuid === f.uuid ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''}`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${f.content_type?.startsWith('image/') ? 'bg-purple-50' : 'bg-blue-50'}`}>
                                                    <Icon size={16} className={f.content_type?.startsWith('image/') ? 'text-purple-500' : 'text-blue-500'} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm text-app-text font-medium truncate">{f.original_filename}</p>
                                                    <p className="text-xs text-app-text-faint truncate">{f.uploaded_by_name || 'System'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wide border ${catColor}`}>
                                                    {f.category.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="flex items-center text-sm text-app-text-muted">{f.file_size_display || formatBytes(f.file_size)}</div>
                                            <div className="flex items-center text-xs text-app-text-faint">{new Date(f.uploaded_at).toLocaleDateString()}</div>
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={e => { e.stopPropagation(); handleDownload(f); }}
                                                    className="p-1.5 rounded-lg text-app-text-faint hover:text-blue-500 hover:bg-blue-50 transition-all" title="Download">
                                                    <Download size={14} />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleDelete(f); }}
                                                    className="p-1.5 rounded-lg text-app-text-faint hover:text-red-500 hover:bg-red-50 transition-all" title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* File Detail Panel */}
                    {selectedFile && (
                        <div className="bg-app-surface border border-app-border rounded-[2rem] shadow-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-app-text flex items-center gap-2">
                                    <Eye size={18} className="text-app-text-faint" />
                                    File Details
                                </h3>
                                <button onClick={() => setSelectedFile(null)} className="text-app-text-faint hover:text-app-text-muted transition-colors"><X size={16} /></button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <DetailItem label="Filename" value={selectedFile.original_filename} />
                                <DetailItem label="Size" value={selectedFile.file_size_display || formatBytes(selectedFile.file_size)} />
                                <DetailItem label="Category" value={selectedFile.category} />
                                <DetailItem label="Type" value={selectedFile.content_type} />
                                <DetailItem label="Uploaded By" value={selectedFile.uploaded_by_name || 'System'} />
                                <DetailItem label="Uploaded" value={new Date(selectedFile.uploaded_at).toLocaleString()} />
                                <DetailItem label="Checksum" value={selectedFile.checksum ? `${selectedFile.checksum.slice(0, 12)}...` : '—'} />
                                <DetailItem label="Storage Key" value={selectedFile.storage_key?.split('/').pop() || '—'} />
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Settings Tab */
                <div className="bg-app-surface border border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-app-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Settings size={18} className="text-app-text-faint" />
                            <h2 className="text-lg font-bold text-app-text">Provider Configuration</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            {!editMode ? (
                                <button onClick={() => setEditMode(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface text-app-text-muted hover:text-app-text hover:bg-app-bg border border-app-border transition-all text-sm font-medium shadow-sm">
                                    <Unlock size={14} /> Edit
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setEditMode(false)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface text-app-text-faint hover:text-app-text-muted border border-app-border transition-all text-sm">Cancel</button>
                                    <button onClick={handleSave} disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all text-sm font-semibold disabled:opacity-50 shadow-sm">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Status Banner */}
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config?.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {config?.is_active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                            <span className="text-sm font-semibold">{currentProvider?.label || 'Local'} — {config?.is_active ? 'Active' : 'Inactive'}</span>
                            {config?.provider_type !== 'LOCAL' && <span className="ml-auto text-xs text-app-text-faint">Bucket: <span className="text-app-text-muted font-medium">{config?.bucket_name}</span></span>}
                        </div>

                        {editMode ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-app-text-muted mb-2">Provider Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PROVIDER_OPTIONS.map(p => (
                                            <button key={p.value} onClick={() => setDraft(d => ({ ...d, provider_type: p.value }))}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${draft.provider_type === p.value ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-200' : 'border-app-border bg-app-surface text-app-text-muted hover:border-app-border hover:bg-app-bg'}`}>
                                                <p.icon size={16} className={p.color} /> {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {draft.provider_type !== 'LOCAL' && (
                                    <SettingsInput label="Endpoint URL" value={draft.endpoint_url} onChange={v => setDraft(d => ({ ...d, endpoint_url: v }))} placeholder="https://your-account.r2.cloudflarestorage.com" />
                                )}
                                <SettingsInput label="Bucket Name" value={draft.bucket_name} onChange={v => setDraft(d => ({ ...d, bucket_name: v }))} />
                                <SettingsInput label="Region" value={draft.region} onChange={v => setDraft(d => ({ ...d, region: v }))} placeholder="auto" />
                                {draft.provider_type !== 'LOCAL' && (
                                    <>
                                        <SettingsInput label={`Access Key ${config?.access_key_masked ? `(current: ${config.access_key_masked})` : ''}`} value={draft.access_key} onChange={v => setDraft(d => ({ ...d, access_key: v }))} type="password" placeholder="Leave blank to keep current" />
                                        <SettingsInput label="Secret Key" value={draft.secret_key} onChange={v => setDraft(d => ({ ...d, secret_key: v }))} type="password" placeholder="Leave blank to keep current" />
                                    </>
                                )}
                                <SettingsInput label="Path Prefix" value={draft.path_prefix} onChange={v => setDraft(d => ({ ...d, path_prefix: v }))} placeholder="Auto: {org-slug}/" />
                                <div>
                                    <label className="block text-sm font-semibold text-app-text-muted mb-2">Max File Size (MB)</label>
                                    <input type="number" value={draft.max_file_size_mb} onChange={e => setDraft(d => ({ ...d, max_file_size_mb: parseInt(e.target.value) || 50 }))}
                                        className="w-full px-4 py-2.5 rounded-xl bg-app-surface border border-app-border text-app-text text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm" />
                                </div>
                                <div className="md:col-span-2">
                                    <SettingsInput label="Allowed Extensions (comma-separated)" value={draft.allowed_extensions} onChange={v => setDraft(d => ({ ...d, allowed_extensions: v }))} placeholder="pdf, jpg, jpeg, png, doc, docx, xls, xlsx" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <InfoCard label="Provider" value={currentProvider?.label || 'Unknown'} icon={currentProvider?.icon || Cloud} />
                                <InfoCard label="Bucket" value={config?.bucket_name || '—'} icon={Database} />
                                <InfoCard label="Region" value={config?.region || 'auto'} icon={Cloud} />
                                <InfoCard label="Max Size" value={`${config?.max_file_size_mb || 50} MB`} icon={Upload} />
                                {config?.path_prefix && <InfoCard label="Path Prefix" value={config.path_prefix} icon={FileText} />}
                                {config?.access_key_masked && <InfoCard label="Access Key" value={config.access_key_masked} icon={Lock} />}
                            </div>
                        )}

                        <div className="flex items-center gap-4 pt-4 border-t border-app-border">
                            <button onClick={handleTest} disabled={testing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all text-sm font-semibold disabled:opacity-50">
                                {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />} Test Connection
                            </button>
                            {testResult && (
                                <span className={`flex items-center gap-2 text-sm font-medium ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {testResult.message}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }) {
    return (
        <div className="bg-app-surface border border-app-border rounded-[2rem] shadow-xl p-5">
            <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
                    <Icon size={20} className={color} />
                </div>
                <div>
                    <p className="text-2xl font-black text-app-text tabular-nums">{value}</p>
                    <p className="text-xs text-app-text-faint font-medium">{label}</p>
                </div>
            </div>
        </div>
    );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
    return (
        <div className="bg-app-bg rounded-xl p-4 border border-app-border">
            <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-app-text-faint" />
                <span className="text-[10px] text-app-text-faint uppercase tracking-widest font-bold">{label}</span>
            </div>
            <p className="text-sm text-app-text font-semibold truncate">{value}</p>
        </div>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] text-app-text-faint uppercase tracking-widest font-bold mb-1">{label}</p>
            <p className="text-sm text-app-text-muted truncate font-medium" title={value}>{value}</p>
        </div>
    );
}

function SettingsInput({ label, value, onChange, placeholder = '', type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div>
            <label className="block text-sm font-semibold text-app-text-muted mb-2">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-xl bg-app-surface border border-app-border text-app-text text-sm placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm" />
        </div>
    );
}
