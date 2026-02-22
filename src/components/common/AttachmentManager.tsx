'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Cloud, Upload, RefreshCcw, Loader2, X, Download, Trash2,
    FileText, Plus, AlertTriangle, CheckCircle2, Eye, FolderOpen
} from 'lucide-react';
import { listFiles, deleteFile, getDownloadUrl } from '@/modules/storage/actions';
import { useChunkedUpload } from '@/modules/storage/hooks';
import { CATEGORY_COLORS, getFileIcon, formatBytes } from '@/modules/storage/constants';

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
}

interface AttachmentManagerProps {
    linkedModel: string; // e.g., 'finance.Invoice'
    linkedId: number;
    category?: string;    // Initial category for uploads
    title?: string;
    compact?: boolean;
}

export default function AttachmentManager({
    linkedModel,
    linkedId,
    category = 'ATTACHMENT',
    title = 'Attachments',
    compact = false
}: AttachmentManagerProps) {
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    const chunked = useChunkedUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = useCallback(async () => {
        if (!linkedId) return;
        setLoading(true);
        try {
            const res = await listFiles({ linked_model: linkedModel, linked_id: linkedId });
            if (Array.isArray(res)) setFiles(res);
            else if (res?.results) setFiles(res.results);
        } catch (err) {
            console.error('Failed to load attachments', err);
        }
        setLoading(false);
    }, [linkedModel, linkedId]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        handleUpload(file);
    };

    const handleUpload = async (file: globalThis.File) => {
        const result = await chunked.upload(file, {
            category,
            linked_model: linkedModel,
            linked_id: linkedId
        });
        if (result && !result.error) {
            fetchFiles();
        }
    };

    const handleDownload = async (file: StoredFile) => {
        const res = await getDownloadUrl(file.uuid);
        if (res?.download_url) {
            window.open(res.download_url, '_blank');
        }
    };

    const handleDelete = async (file: StoredFile) => {
        if (!confirm(`Delete "${file.original_filename}"?`)) return;
        await deleteFile(file.uuid);
        setFiles(prev => prev.filter(f => f.uuid !== file.uuid));
    };

    // Drag and Drop handlers
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    if (loading && files.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                <RefreshCcw className="animate-spin text-emerald-500" size={24} />
            </div>
        );
    }

    return (
        <div className={`space-y-4 animate-in fade-in duration-300 ${compact ? '' : 'mt-6'}`}>
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Cloud size={20} className="text-blue-500" />
                    {title}
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
                        {files.length}
                    </span>
                </h3>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={chunked.uploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border border-gray-200 shadow-sm transition-all text-sm font-bold disabled:opacity-50"
                >
                    <Plus size={16} /> Add File
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelect} />
            </div>

            {/* Upload Progress */}
            {chunked.uploading && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-blue-500" />
                            <span className="text-xs font-bold text-gray-900">Uploading...</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-blue-600">{chunked.progress}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${chunked.progress}%` }}
                        />
                    </div>
                    {chunked.speed && <p className="text-[10px] text-gray-500 mt-1 mt-1 font-medium">{chunked.speed}</p>}
                </div>
            )}

            {chunked.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {chunked.error}
                    <button onClick={() => chunked.abort()} className="ml-auto text-red-400 hover:text-red-700">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Drop Zone / Empty State */}
            {files.length === 0 && !chunked.uploading ? (
                <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-10 text-center rounded-[2rem] border-2 border-dashed transition-all cursor-pointer ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50/30 hover:bg-gray-50 hover:border-gray-200'
                        }`}
                >
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
                        <Upload size={24} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-bold">No attachments yet</p>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Drag and drop or click to upload</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {files.map(file => {
                        const Icon = getFileIcon(file.content_type);
                        const isImage = file.content_type?.startsWith('image/');
                        const catColor = CATEGORY_COLORS[file.category] || CATEGORY_COLORS.OTHER;

                        return (
                            <div
                                key={file.uuid}
                                className="group relative bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all flex items-center gap-3"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isImage ? 'bg-purple-50' : 'bg-blue-50'}`}>
                                    <Icon size={20} className={isImage ? 'text-purple-500' : 'text-blue-500'} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-gray-900 truncate" title={file.original_filename}>
                                        {file.original_filename}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-gray-400 font-bold">{file.file_size_display || formatBytes(file.file_size)}</span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest font-black border ${catColor}`}>
                                            {file.category.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDownload(file)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                                        title="Download"
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(file)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Compact "Add More" box if files exist */}
                    {files.length > 0 && (
                        <div
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex items-center justify-center border-2 border-dashed rounded-2xl p-3 transition-all cursor-pointer ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50/20 hover:border-gray-200'
                                }`}
                        >
                            <Plus size={16} className="text-gray-300 mr-2" />
                            <span className="text-xs font-bold text-gray-400">Add More</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
