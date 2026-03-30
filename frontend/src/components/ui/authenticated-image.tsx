import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { ImageIcon, Loader2 } from 'lucide-react';

interface AuthenticatedImageProps {
    src: string;
    alt: string;
    className?: string;
}

const imageCache = new Map<string, string>();

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ src, alt, className }) => {
    const [imgUrl, setImgUrl] = useState<string | null>(imageCache.get(src) || null);
    const [loading, setLoading] = useState(!imageCache.has(src));
    const [error, setError] = useState(false);

    useEffect(() => {
    
        const fetchImage = async () => {
            if (imageCache.has(src)) {
                setImgUrl(imageCache.get(src)!);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(false);

                // Fetch image as blob using authenticated API
                const response = await api.get<Blob>(src, {
                    responseType: 'blob'
                });
                
                // Axios interceptor returns the full response object
                const url = URL.createObjectURL(response.data);
                setImgUrl(url);
                imageCache.set(src, url);
            } catch (err: unknown) {
                console.error('Error fetching authenticated image:', err instanceof Error ? err.message : String(err));
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (src) {
            fetchImage();
        }

        return () => {
            // Note: We don't revoke here because it's cached globally for systemic performance.
            // In a real browser this could lead to memory leaks over VERY long sessions,
            // but for this enterprise healthcare app, we prioritize immediate re-display
            // on window toggle/scroll without hits to the rate limiter.
        };
    }, [src]);

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
                <span className="text-[10px]">Failed to load image</span>
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
