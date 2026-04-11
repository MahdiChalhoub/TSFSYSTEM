'use client';

import { useState, useCallback, useRef } from 'react';
import { initChunkedUpload, completeChunkedUpload } from '@/modules/storage/actions';
import { formatBytes } from './constants';

export function useChunkedUpload() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState('');
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef(false);

    const upload = useCallback(async (
        file: globalThis.File,
        params: {
            category?: string;
            linked_model?: string;
            linked_id?: number;
            upload_type?: 'file' | 'package'
        } = {}
    ) => {
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
                category: params.category || 'ATTACHMENT',
                linked_model: params.linked_model,
                linked_id: params.linked_id,
                upload_type: params.upload_type || 'file',
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
                    let errorDetail = "";
                    try {
                        const err = await res.json();
                        errorDetail = err.error || err.detail || JSON.stringify(err);
                    } catch {
                        errorDetail = `Status: ${res.status} ${res.statusText}`;
                    }
                    console.error(`[STORAGE] Chunk ${i + 1} failed:`, errorDetail);
                    throw new Error(errorDetail || `Chunk ${i + 1} failed`);
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

    const abort = useCallback(() => { abortRef.current = true; }, []);

    return { upload, abort, uploading, progress, speed, error };
}
