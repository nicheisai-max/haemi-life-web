import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { ImageIcon, Loader2 } from 'lucide-react';

interface AuthenticatedImageProps {
    src: string;
    alt: string;
    className?: string;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ src, alt, className }) => {
    const [imgUrl, setImgUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;

        const fetchImage = async () => {
            try {
                setLoading(true);
                setError(false);

                // Fetch image as blob using authenticated api instance
                const response = await api.get(src, {
                    responseType: 'blob'
                });

                objectUrl = URL.createObjectURL(response.data);
                setImgUrl(objectUrl);
            } catch (err) {
                console.error('Error fetching authenticated image:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (src) {
            fetchImage();
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
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
