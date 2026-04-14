import React, { useState, useEffect, useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { Loader2, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAccessToken } from '../../services/api';
import { logger } from '../../utils/logger';

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
    /**
     * 🧬 INSTITUTIONAL DIMENSION LOCK (CLS PREVENTION)
     * Options: 'square', 'video', 'portrait', or custom ratio strings like 'aspect-[4/3]'
     */
    aspectRatio?: 'square' | 'video' | 'portrait' | string;
    /**
     * 🛡️ D4 REMEDIATION: Optional error fallback node.
     * Rendered when the authenticated blob fetch fails (401, 404, network drop).
     * If omitted, the component returns null on error — backward-compatible quiet fail.
     */
    errorFallback?: React.ReactNode;
    /**
     * 🧬 INSTITUTIONAL LOADING FALLBACK
     * Custom loader (e.g., PremiumLoader) used during the authenticated fetch.
     */
    loadingFallback?: React.ReactNode;
}

// D5 REMEDIATION: Bounded, reference-counted blob-URL cache.
// • imageCacheRefs tracks active mounted instances per src — prevents premature
//   URL revocation when the same asset is rendered by multiple components.
// • MAX_CACHE_SIZE caps session-memory growth via LRU eviction of unused entries.
// • imageCache is module-level so identical clinical assets are fetched only once.
const MAX_CACHE_SIZE = 100 as const;
const imageCache = new Map<string, string>();       // src → objectUrl
const imageCacheRefs = new Map<string, number>();   // src → active render count

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ 
    src, 
    alt, 
    className,
    aspectRatio = 'square',
    errorFallback,
    loadingFallback,
}) => {
    const [imgUrl, setImgUrl] = useState<string | null>(imageCache.get(src) || null);
    const [loading, setLoading] = useState<boolean>(!imageCache.has(src));
    const [error, setError] = useState<boolean>(false);

    // DETERMINISTIC CLS PROTECTION: Mapping institutional tokens to Tailwind properties
    const ratioClass = React.useMemo(() => {
        switch (aspectRatio) {
            case 'square': return 'aspect-square';
            case 'video': return 'aspect-video';
            case 'portrait': return 'aspect-[3/4]';
            default: return aspectRatio.startsWith('aspect-') ? aspectRatio : '';
        }
    }, [aspectRatio]);

    /**
     * 🧬 CLINICAL BINARY TUNNEL
     * Architecture: Single-flight authenticated fetch with absolute path resolution.
     */
    const fetchImage = useCallback(async (targetSrc: string) => {
        if (!targetSrc) return;
        
        // D7 REMEDIATION: Origin-Aware Resolution Guard
        // If the URL is already a local blob (optimistic) or base64 data,
        // bypass the authenticated Axios tunnel to prevent protocol-mismatch 404s.
        if (targetSrc.startsWith('blob:') || targetSrc.startsWith('data:')) {
            setImgUrl(targetSrc);
            setLoading(false);
            return;
        }

        if (imageCache.has(targetSrc)) {
            setImgUrl(imageCache.get(targetSrc)!);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(false);

            // D6 REMEDIATION: Use getAccessToken() from api.ts instead of
            // sessionStorage.getItem() directly. After a proactive token rotation
            // the in-memory credential in api.ts is updated first; sessionStorage
            // may briefly lag, causing a stale-token 401 on the blob fetch.
            const token = getAccessToken();
            
            // 🩺 HAEMI RESOLVER: Institutional Path Resolution
            // Architecture: Direct tunnel via targetSrc. Relative paths must be resolved by the caller
            // to maintain zero-drift parity between Frontend and Backend FileServices.
            
            let finalSrc = targetSrc;
            if (targetSrc.includes('/api/files/profile/')) {
                // Ensure profile images are tunneled through the authenticated backend
                finalSrc = targetSrc.startsWith('/') ? targetSrc : `/${targetSrc}`;
            }

            const response: AxiosResponse<Blob> = await axios.get<Blob>(finalSrc, {
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

            // D5 REMEDIATION: LRU eviction — when the cache exceeds MAX_CACHE_SIZE,
            // revoke + remove the oldest entry. We only revoke entries with zero
            // active renders (checked via imageCacheRefs) to prevent breaking any
            // <img> element that is currently displaying that blob URL.
            if (imageCache.size > MAX_CACHE_SIZE) {
                const oldestEntry = imageCache.entries().next();
                if (!oldestEntry.done) {
                    const [oldKey, oldUrl] = oldestEntry.value;
                    if ((imageCacheRefs.get(oldKey) ?? 0) === 0) {
                        URL.revokeObjectURL(oldUrl);
                        imageCache.delete(oldKey);
                    }
                }
            }

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'BINARY_FETCH_FAILURE';
            logger.error(`[InstitutionalAudit] Image failed: ${targetSrc}`, { error: message });
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchImage(src);
    }, [src, fetchImage]);

    // D5 REMEDIATION: Reference-count lifecycle management.
    // Increment on mount (or src change). Decrement on unmount (or src change).
    // When the last instance using a given src unmounts, the blob URL is revoked
    // and the entry is removed from imageCache — freeing browser memory.
    useEffect(() => {
        const activeSrc = src;
        imageCacheRefs.set(activeSrc, (imageCacheRefs.get(activeSrc) ?? 0) + 1);
        return (): void => {
            const refs = imageCacheRefs.get(activeSrc) ?? 1;
            if (refs <= 1) {
                imageCacheRefs.delete(activeSrc);
                const blobUrl = imageCache.get(activeSrc);
                if (blobUrl !== undefined) {
                    URL.revokeObjectURL(blobUrl);
                    imageCache.delete(activeSrc);
                }
            } else {
                imageCacheRefs.set(activeSrc, refs - 1);
            }
        };
    }, [src]);

    // INSTITUTIONAL SKELETON: Synchronized with ratioClass
    if (loading) {
        return (
            <div className={cn(
                "flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse overflow-hidden rounded-[inherit]",
                ratioClass,
                className
            )}>
                {loadingFallback !== undefined ? (
                    loadingFallback
                ) : (
                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                )}
            </div>
        );
    }

    if (error || !imgUrl) {
        // If the caller provides a fallback node, render it (e.g. lightbox error state).
        // Otherwise provide a professional clinical placeholder to maintain UI integrity.
        return (
            <div className={cn(
                "flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 gap-2 overflow-hidden rounded-[inherit]",
                ratioClass,
                className
            )}>
                {errorFallback !== undefined ? (
                    errorFallback
                ) : (
                    <>
                        <ImageOff className="h-6 w-6 opacity-30" />
                        <span className="text-[10px] uppercase font-semibold tracking-wider opacity-50">Clinical Asset Unavailable</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <img
            src={imgUrl}
            alt={alt}
            className={cn("object-cover", ratioClass, className)}
            padding-none="true"
            loading="lazy"
        />
    );
};
