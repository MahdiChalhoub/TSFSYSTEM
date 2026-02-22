'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Package, Upload, RefreshCcw, CheckCircle2, XCircle, Loader2,
    Play, RotateCcw, Clock, Trash2, AlertTriangle, Server,
    Box, Globe, Shield, BarChart3, Calendar, ChevronDown,
    FileArchive, X, ArrowRight, Info, Zap
} from 'lucide-react';
import {
    listPackages, uploadPackage, applyPackage, rollbackPackage,
    schedulePackage, getPackageStats, initChunkedUpload,
    completeChunkedUpload, getActiveUploads
} from '@/modules/storage/actions';

// ─── Types ───────────────────────────────────────────────────────
interface PackageItem {
    id: string;
    package_type: string;
    name: string;
    version: string;
    file_size: number;
    upload_progress: number;
    checksum: string;
    status: string;
    changelog: string;
    error_message: string | null;
    uploaded_by: number | null;
    uploaded_at: string;
    scheduled_for: string | null;
    applied_at: string | null;
    manifest: Record<string, unknown>;
    backup_path: string | null;
}

interface PackageStats {
    total: number;
    by_type: { kernel: number; frontend: number; module: number };
    by_status: { ready: number; applied: number; scheduled: number; failed: number };
}

interface ActiveUpload {
    session_id: string;
    filename: string;
    total_size: number;
    bytes_received: number;
    progress: number;
    upload_type: string;
    package_type: string;
    created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }> = {
    uploading: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Loader2, label: 'Uploading' },
    ready: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2, label: 'Ready' },
    scheduled: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock, label: 'Scheduled' },
    applying: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Zap, label: 'Applying' },
    applied: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle2, label: 'Applied' },
    failed: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, label: 'Failed' },
    rolled_back: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: RotateCcw, label: 'Rolled Back' },
};

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
    kernel: { icon: Server, color: 'text-red-400 bg-red-500/10', label: 'Kernel' },
    frontend: { icon: Globe, color: 'text-blue-400 bg-blue-500/10', label: 'Frontend' },
    module: { icon: Box, color: 'text-purple-400 bg-purple-500/10', label: 'Module' },
};

function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ─── Main Page ───────────────────────────────────────────────────
export default function PackageManagerPage() {
    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [stats, setStats] = useState<PackageStats | null>(null);
    const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedPkg, setSelectedPkg] = useState<PackageItem | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('');
    const uploadInputRef = useRef<HTMLInputElement>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (typeFilter) params.type = typeFilter;
            if (statusFilter) params.status = statusFilter;

            const [pkgRes, statsRes, uploadsRes] = await Promise.all([
                listPackages(params),
                getPackageStats(),
                getActiveUploads('package'),
            ]);

            if (Array.isArray(pkgRes)) setPackages(pkgRes);
            else if (pkgRes?.results) setPackages(pkgRes.results);

            if (statsRes && !statsRes.error) setStats(statsRes);
            if (uploadsRes?.uploads) setActiveUploads(uploadsRes.uploads);
        } catch (err) {
            console.error('Failed to load packages', err);
        }
        setLoading(false);
    }, [typeFilter, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 10s when there are active uploads
    useEffect(() => {
        if (activeUploads.length === 0 && !uploading) return;
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [activeUploads.length, uploading, fetchData]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            showToast('Only .zip packages are allowed', 'error');
            return;
        }

        // Detect package type from filename
        let pkgType = 'module';
        if (file.name.includes('.kernel.')) pkgType = 'kernel';
        else if (file.name.includes('.frontend.')) pkgType = 'frontend';

        setUploading(true);
        setUploadProgress(0);

        const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        try {
            if (file.size > 5 * 1024 * 1024) {
                // Large file → chunked upload
                const session = await initChunkedUpload({
                    filename: file.name,
                    total_size: file.size,
                    content_type: 'application/zip',
                    upload_type: 'package',
                    package_type: pkgType as 'kernel' | 'frontend' | 'module',
                });

                if (!session?.session_id) throw new Error(session?.error || 'Init failed');

                let bytesSent = 0;
                const startTime = Date.now();

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const blob = file.slice(start, end);

                    const formData = new FormData();
                    formData.append('chunk', blob, `chunk_${i}`);
                    formData.append('offset', String(bytesSent));

                    const res = await fetch(`/api/proxy/storage/upload/${session.session_id}/chunk/`, {
                        method: 'POST', body: formData,
                    });
                    if (!res.ok) throw new Error(`Chunk ${i + 1} failed`);

                    bytesSent = end;
                    setUploadProgress(Math.round((bytesSent / file.size) * 100));
                    const elapsed = (Date.now() - startTime) / 1000;
                    if (elapsed > 0) setUploadSpeed(`${formatBytes(bytesSent / elapsed)}/s`);
                }

                await completeChunkedUpload(session.session_id);
                showToast(`Package "${file.name}" uploaded successfully`);
            } else {
                // Small file → direct upload
                const formData = new FormData();
                formData.append('file', file);
                formData.append('package_type', pkgType);
                const res = await uploadPackage(formData);
                if (res?.error) throw new Error(res.error);
                showToast(`Package "${file.name}" uploaded successfully`);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            showToast(msg, 'error');
        }

        setUploading(false);
        setUploadProgress(0);
        setUploadSpeed('');
        await fetchData();
        // Reset the input
        if (uploadInputRef.current) uploadInputRef.current.value = '';
    };

    const handleApply = async (pkg: PackageItem) => {
        if (!confirm(`Apply "${pkg.name} v${pkg.version}"? This will update the system.`)) return;
        setActionLoading(pkg.id);
        try {
            const res = await applyPackage(pkg.id);
            if (res?.error) throw new Error(res.error);
            showToast(`${pkg.name} v${pkg.version} applied successfully`);
            await fetchData();
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Apply failed', 'error');
        }
        setActionLoading(null);
    };

    const handleRollback = async (pkg: PackageItem) => {
        if (!confirm(`Rollback "${pkg.name} v${pkg.version}"?`)) return;
        setActionLoading(pkg.id);
        try {
            const res = await rollbackPackage(pkg.id);
            if (res?.error) throw new Error(res.error);
            showToast(`Rollback of ${pkg.name} completed`);
            await fetchData();
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : 'Rollback failed', 'error');
        }
        setActionLoading(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 size={32} className="animate-spin text-emerald-400" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-5 ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 text-gray-500 hover:text-white"><X size={14} /></button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/30">
                            <Package size={24} className="text-white" />
                        </div>
                        Package Manager
                    </h1>
                    <p className="text-gray-400 mt-1">Upload, deploy, and manage kernel, frontend &amp; module packages</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => uploadInputRef.current?.click()} disabled={uploading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white hover:from-violet-500 hover:to-purple-400 shadow-lg shadow-purple-900/30 transition-all text-sm font-medium disabled:opacity-50">
                        <Upload size={16} /> Upload Package
                    </button>
                    <input ref={uploadInputRef} type="file" accept=".zip" className="hidden" onChange={handleUpload} />
                    <button onClick={fetchData}
                        className="p-2.5 rounded-xl bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition-all">
                        <RefreshCcw size={16} />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatsCard label="Total" value={stats.total} icon={Package} color="text-white bg-gray-800" />
                    <StatsCard label="Kernel" value={stats.by_type.kernel} icon={Server} color={TYPE_CONFIG.kernel.color} />
                    <StatsCard label="Frontend" value={stats.by_type.frontend} icon={Globe} color={TYPE_CONFIG.frontend.color} />
                    <StatsCard label="Modules" value={stats.by_type.module} icon={Box} color={TYPE_CONFIG.module.color} />
                    <StatsCard label="Applied" value={stats.by_status.applied} icon={CheckCircle2} color="text-green-400 bg-green-500/10" />
                </div>
            )}

            {/* Upload Progress */}
            {uploading && (
                <div className="bg-gray-900/80 border border-purple-500/30 rounded-2xl p-5 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <Loader2 size={18} className="animate-spin text-purple-400" />
                            <span className="text-sm text-white font-medium">Uploading package...</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {uploadSpeed && <span className="text-xs text-gray-400">{uploadSpeed}</span>}
                            <span className="text-sm text-purple-400 font-mono">{uploadProgress}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-violet-500 to-purple-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }} />
                    </div>
                </div>
            )}

            {/* Active Interrupted Package Uploads */}
            {activeUploads.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-amber-400" />
                        <span className="text-sm font-medium text-amber-400">Interrupted Package Uploads — Action Required</span>
                    </div>
                    {activeUploads.map(u => {
                        const tc = TYPE_CONFIG[u.package_type] || TYPE_CONFIG.module;
                        return (
                            <div key={u.session_id} className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-3 mt-2">
                                <tc.icon size={16} className={tc.color.split(' ').find(c => c.startsWith('text-')) || 'text-gray-400'} />
                                <span className="text-sm text-gray-200 flex-1 truncate">{u.filename}</span>
                                <div className="w-32 bg-gray-800 rounded-full h-1.5">
                                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${u.progress}%` }} />
                                </div>
                                <span className="text-xs text-amber-400 font-mono w-10 text-right">{u.progress}%</span>
                                <span className="text-xs text-gray-500">{formatBytes(u.bytes_received)} / {formatBytes(u.total_size)}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-300 text-sm outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer pr-8">
                    <option value="">All Types</option>
                    <option value="kernel">Kernel</option>
                    <option value="frontend">Frontend</option>
                    <option value="module">Module</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-gray-900/60 border border-gray-800 text-gray-300 text-sm outline-none focus:border-purple-500/50 transition-all appearance-none cursor-pointer pr-8">
                    <option value="">All Statuses</option>
                    <option value="ready">Ready</option>
                    <option value="applied">Applied</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="failed">Failed</option>
                    <option value="rolled_back">Rolled Back</option>
                </select>
                <span className="text-sm text-gray-500 ml-auto">{packages.length} package{packages.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Package List */}
            <div className="space-y-3">
                {packages.length === 0 ? (
                    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-16 text-center backdrop-blur-xl">
                        <Package size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-500 text-lg">No packages found</p>
                        <p className="text-xs text-gray-600 mt-2">Upload a .kernel.zip, .frontend.zip, or .module.zip to get started</p>
                    </div>
                ) : (
                    packages.map(pkg => {
                        const statusCfg = STATUS_CONFIG[pkg.status] || STATUS_CONFIG.ready;
                        const typeCfg = TYPE_CONFIG[pkg.package_type] || TYPE_CONFIG.module;
                        const StatusIcon = statusCfg.icon;
                        const TypeIcon = typeCfg.icon;
                        const isSelected = selectedPkg?.id === pkg.id;
                        const isLoading = actionLoading === pkg.id;

                        return (
                            <div key={pkg.id} className={`bg-gray-900/60 border rounded-2xl overflow-hidden backdrop-blur-xl transition-all ${isSelected ? 'border-purple-500/40 ring-1 ring-purple-500/20' : 'border-gray-800 hover:border-gray-700'}`}>
                                {/* Main Row */}
                                <div className="px-6 py-4 flex items-center gap-4 cursor-pointer"
                                    onClick={() => setSelectedPkg(isSelected ? null : pkg)}>
                                    {/* Type Icon */}
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeCfg.color}`}>
                                        <TypeIcon size={20} />
                                    </div>

                                    {/* Name + Version */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white truncate">{pkg.name}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 font-mono">v{pkg.version}</span>
                                        </div>
                                        {pkg.changelog && <p className="text-xs text-gray-500 mt-0.5 truncate">{pkg.changelog}</p>}
                                    </div>

                                    {/* Upload Progress (if uploading) */}
                                    {pkg.status === 'uploading' && (
                                        <div className="w-32">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-blue-400">{pkg.upload_progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-800 rounded-full h-1.5">
                                                <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${pkg.upload_progress}%` }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 ${statusCfg.color}`}>
                                        <StatusIcon size={13} className={pkg.status === 'uploading' || pkg.status === 'applying' ? 'animate-spin' : ''} />
                                        {statusCfg.label}
                                    </div>

                                    {/* Size + Time */}
                                    <div className="text-right shrink-0 w-24">
                                        <p className="text-xs text-gray-400">{formatBytes(pkg.file_size)}</p>
                                        <p className="text-xs text-gray-600">{pkg.uploaded_at ? timeAgo(pkg.uploaded_at) : '—'}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {pkg.status === 'ready' && (
                                            <button onClick={e => { e.stopPropagation(); handleApply(pkg); }} disabled={isLoading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium transition-all disabled:opacity-50"
                                                title="Apply Now">
                                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Apply
                                            </button>
                                        )}
                                        {pkg.status === 'applied' && pkg.backup_path && (
                                            <button onClick={e => { e.stopPropagation(); handleRollback(pkg); }} disabled={isLoading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/30 text-xs font-medium transition-all disabled:opacity-50"
                                                title="Rollback">
                                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Rollback
                                            </button>
                                        )}
                                        {pkg.status === 'failed' && (
                                            <span className="text-xs text-red-400 flex items-center gap-1">
                                                <AlertTriangle size={12} /> Failed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Detail Panel */}
                                {isSelected && (
                                    <div className="px-6 py-4 border-t border-gray-800/50 bg-gray-950/30">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <DetailItem label="Package Type" value={typeCfg.label} />
                                            <DetailItem label="Version" value={pkg.version} />
                                            <DetailItem label="Size" value={formatBytes(pkg.file_size)} />
                                            <DetailItem label="Checksum" value={pkg.checksum ? `${pkg.checksum.slice(0, 16)}...` : '—'} />
                                            <DetailItem label="Status" value={statusCfg.label} />
                                            <DetailItem label="Uploaded" value={pkg.uploaded_at ? new Date(pkg.uploaded_at).toLocaleString() : '—'} />
                                            <DetailItem label="Applied" value={pkg.applied_at ? new Date(pkg.applied_at).toLocaleString() : '—'} />
                                            <DetailItem label="Scheduled" value={pkg.scheduled_for ? new Date(pkg.scheduled_for).toLocaleString() : '—'} />
                                        </div>
                                        {pkg.changelog && (
                                            <div className="mt-4 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
                                                <p className="text-xs text-gray-500 mb-1">Changelog</p>
                                                <p className="text-sm text-gray-300">{pkg.changelog}</p>
                                            </div>
                                        )}
                                        {pkg.error_message && (
                                            <div className="mt-4 p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                                                <p className="text-xs text-red-500 mb-1">Error</p>
                                                <p className="text-sm text-red-400">{pkg.error_message}</p>
                                            </div>
                                        )}
                                        {pkg.manifest && Object.keys(pkg.manifest).length > 0 && (
                                            <div className="mt-4 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
                                                <p className="text-xs text-gray-500 mb-2">Manifest</p>
                                                <pre className="text-xs text-gray-400 overflow-x-auto">{JSON.stringify(pkg.manifest, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────
function StatsCard({ label, value, icon: Icon, color }: {
    label: string; value: number; icon: React.ComponentType<{ size?: number; className?: string }>; color: string;
}) {
    return (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.split(' ').find(c => c.startsWith('bg-')) || 'bg-gray-800'}`}>
                    <Icon size={18} className={color.split(' ').find(c => c.startsWith('text-')) || 'text-gray-400'} />
                </div>
                <div>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                </div>
            </div>
        </div>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm text-gray-200 truncate" title={value}>{value}</p>
        </div>
    );
}
