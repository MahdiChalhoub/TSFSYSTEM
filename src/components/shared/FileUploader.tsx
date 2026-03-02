'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText, Image, FileSpreadsheet, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { uploadFile } from '@/modules/storage/actions';

// ─── Types ───────────────────────────────────────────────────────
interface UploadedFile {
 uuid: string;
 original_filename: string;
 file_size_display: string;
 content_type: string;
 category: string;
}

export interface FileUploaderProps {
 category?: string;
 linkedModel?: string;
 linkedId?: number;
 maxSizeMb?: number;
 acceptedTypes?: string[];
 multiple?: boolean;
 onUploadComplete?: (file: UploadedFile) => void;
 className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────
function getFileIcon(mime: string) {
 if (mime.startsWith('image/')) return Image;
 if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
 if (mime.includes('pdf') || mime.includes('document') || mime.includes('word')) return FileText;
 return File;
}

function formatBytes(bytes: number) {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ───────────────────────────────────────────────────
export function FileUploader({
 category = 'ATTACHMENT',
 linkedModel = '',
 linkedId,
 maxSizeMb = 50,
 acceptedTypes,
 multiple = true,
 onUploadComplete,
 className = '',
}: FileUploaderProps) {
 const [uploading, setUploading] = useState(false);
 const [dragOver, setDragOver] = useState(false);
 const [files, setFiles] = useState<{ name: string; size: number; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string; result?: UploadedFile }[]>([]);
 const inputRef = useRef<HTMLInputElement>(null);

 const handleFiles = useCallback(async (fileList: FileList | null) => {
 if (!fileList || fileList.length === 0) return;

 const newFiles = Array.from(fileList).map(f => ({
 name: f.name,
 size: f.size,
 status: 'pending' as const,
 file: f,
 }));

 setFiles(prev => [...prev, ...newFiles.map(f => ({ name: f.name, size: f.size, status: f.status }))]);
 setUploading(true);

 for (let i = 0; i < newFiles.length; i++) {
 const f = newFiles[i];
 const idx = files.length + i;

 // Validate size
 if (f.size > maxSizeMb * 1024 * 1024) {
 setFiles(prev => prev.map((p, j) => j === idx ? { ...p, status: 'error', error: `Too large (max ${maxSizeMb} MB)` } : p));
 continue;
 }

 setFiles(prev => prev.map((p, j) => j === idx ? { ...p, status: 'uploading' } : p));

 try {
 const formData = new FormData();
 formData.append('file', f.file);
 formData.append('category', category);
 if (linkedModel) formData.append('linked_model', linkedModel);
 if (linkedId) formData.append('linked_id', String(linkedId));

 const result = await uploadFile(formData);

 if (result?.uuid) {
 setFiles(prev => prev.map((p, j) => j === idx ? { ...p, status: 'done', result } : p));
 onUploadComplete?.(result);
 } else {
 setFiles(prev => prev.map((p, j) => j === idx ? { ...p, status: 'error', error: result?.error || 'Upload failed' } : p));
 }
 } catch (err) {
 setFiles(prev => prev.map((p, j) => j === idx ? { ...p, status: 'error', error: 'Network error' } : p));
 }
 }

 setUploading(false);
 }, [category, linkedModel, linkedId, maxSizeMb, onUploadComplete, files.length]);

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 setDragOver(false);
 handleFiles(e.dataTransfer.files);
 }, [handleFiles]);

 const removeFile = (idx: number) => {
 setFiles(prev => prev.filter((_, i) => i !== idx));
 };

 const acceptAttr = acceptedTypes?.map(t => `.${t}`).join(',');

 return (
 <div className={className}>
 {/* Drop Zone */}
 <div
 onClick={() => inputRef.current?.click()}
 onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
 onDragLeave={() => setDragOver(false)}
 onDrop={handleDrop}
 className={`
 relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
 transition-all duration-200 group
 ${dragOver
 ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]'
 : 'border-gray-700 hover:border-gray-500 bg-gray-900/30 hover:bg-gray-800/30'
 }
 `}
 >
 <input
 ref={inputRef}
 type="file"
 className="hidden"
 multiple={multiple}
 accept={acceptAttr}
 onChange={(e) => handleFiles(e.target.files)}
 />
 <Upload size={32} className={`mx-auto mb-3 transition-colors ${dragOver ? 'text-emerald-400' : 'text-app-text-muted group-hover:text-gray-300'}`} />
 <p className="text-sm text-app-text-faint group-hover:text-gray-200 transition-colors">
 <span className="text-emerald-400 font-medium">Click to upload</span> or drag & drop
 </p>
 <p className="text-xs text-app-text-muted mt-2">
 Max {maxSizeMb} MB{acceptedTypes ? ` · ${acceptedTypes.join(', ').toUpperCase()}` : ''}
 </p>
 </div>

 {/* File List */}
 {files.length > 0 && (
 <div className="mt-4 space-y-2">
 {files.map((f, idx) => {
 const Icon = getFileIcon(f.result?.content_type || '');
 return (
 <div key={idx} className="flex items-center gap-3 px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
 <Icon size={18} className="text-app-text-faint shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-gray-200 truncate">{f.name}</p>
 <p className="text-xs text-app-text-muted">{formatBytes(f.size)}</p>
 </div>
 {f.status === 'uploading' && <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />}
 {f.status === 'done' && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
 {f.status === 'error' && (
 <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
 <AlertCircle size={14} />
 {f.error}
 </span>
 )}
 <button
 onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
 className="text-app-text-muted hover:text-red-400 transition-colors shrink-0"
 >
 <X size={14} />
 </button>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
