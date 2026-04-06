import React, { useState, useEffect, useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { ImageIcon, Loader2 } from 'lucide-react';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AUTHENTICATED IMAGE HANDLER
 * Restoration: Bit-for-Bit Hybrid (Verified Sandbox Logic)
 * Logic: Fetches clinical binary data (Blobs) via authenticated tunnel.
 * Correction: Bypassing '/api' prefix for static assets to eliminate 404 DRIFT.
 */

interface AuthenticatedImageProps {
    src: string;
    alt: string;
    className?: string;
}

// Institutional Cache (Global Memory Space)
const imageCache = new Map<string, string>();

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ src, alt, className }) => {
    const [imgUrl, setImgUrl] = useState<string | null>(imageCache.get(src) || null);
    const [loading, setLoading] = useState<boolean>(!imageCache.has(src));
    const [error, setError] = useState<boolean>(false);

    /**
     * 🧬 CLINICAL BINARY TUNNEL
     * Architecture: Single-flight authenticated fetch with absolute path resolution.
     */
    const fetchImage = useCallback(async (targetSrc: string) => {
        if (!targetSrc) return;
        
        if (imageCache.has(targetSrc)) {
            setImgUrl(imageCache.get(targetSrc)!);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(false);

            // Access token from sessionStorage (Institutional Consensus)
            const token = sessionStorage.getItem('token');
            
            /**
             * 🎯 FORENSIC CORRECTION: Routing Bypass
             * Logic: Using a direct axios instance to bypass the global '/api' baseURL.
             * This ensures 'uploads/' paths point to the root backend instead of /api/uploads/.
             */
            let finalUrl = targetSrc;
            
            // 🩺 HAEMI RESOLVER: Institutional Path Mapping
            // Logic: Catch raw 'uploads/' paths and route them through the authorized /api/files/temp tunnel.
            if (targetSrc.includes('uploads/chat/')) {
                const fileName = targetSrc.split('/').pop();
                if (fileName) {
                    finalUrl = `/api/files/temp/${fileName}`;
                }
            }

            const response: AxiosResponse<Blob> = await axios.get<Blob>(finalUrl, {
                baseURL: import.meta.env.VITE_API_URL || '',
                responseType: 'blob',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            
            if (!(response.data instanceof Blob)) {
                throw new Error('INVALD_BINARY_BUFFER');
            }

            const objectUrl = URL.createObjectURL(response.data);
            setImgUrl(objectUrl);
            imageCache.set(targetSrc, objectUrl);

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'BINARY_FETCH_FAILURE';
            console.error(`[InstitutionalAudit] Image failed: ${targetSrc}`, message);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchImage(src);
    }, [src, fetchImage]);

    if (loading) {
        return (
            <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`}>
                <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
            </div>
        );
    }

    if (error || !imgUrl) {
        return (
            <div className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 gap-1 ${className}`}>
                <ImageIcon className="h-6 w-6 opacity-40" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#DC2626]">Failed to load image</span>
            </div>
        );
    }

    return (
        <img
            src={imgUrl}
            alt={alt}
            className={className}
            loading="lazy"
        />
    );
};
