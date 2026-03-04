import React, { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ImageLoaderProps {
    src: string;
    alt: string;
    className?: string;
    skeletonClassName?: string;
    circle?: boolean;
    width?: string;
    height?: string;
    lazy?: boolean;
}

export const ImageLoader: React.FC<ImageLoaderProps> = ({
    src,
    alt,
    className = '',
    skeletonClassName = '',
    circle = false,
    width,
    height,
    lazy = true,
}) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [inView, setInView] = useState(!lazy);

    useEffect(() => {
        if (!lazy) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setInView(true);
                        observer.disconnect();
                    }
                });
            },
            { rootMargin: '50px' }
        );

        const element = document.getElementById(`img-wrapper-${src.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (element) {
            observer.observe(element);
        }

        return () => observer.disconnect();
    }, [src, lazy]);

    const handleLoad = () => {
        setLoaded(true);
    };

    const handleError = () => {
        setError(true);
        setLoaded(true);
    };

    return (
        <div
            id={`img-wrapper-${src.replace(/[^a-zA-Z0-9]/g, '-')}`}
            className={cn(
                "relative inline-block overflow-hidden bg-muted",
                circle ? "rounded-full" : "",
                className
            )}
            style={{ width, height }}
        >
            {/* Skeleton Loader */}
            {!loaded && !error && (
                <Skeleton
                    className={cn(
                        "absolute inset-0 w-full h-full",
                        circle ? "rounded-full" : "rounded-none",
                        skeletonClassName
                    )}
                />
            )}

            {/* Actual Image */}
            {inView && (
                <img
                    src={src}
                    alt={alt}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-300",
                        loaded ? "opacity-100" : "opacity-0",
                        circle ? "rounded-full" : ""
                    )}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}

            {/* Error Fallback */}
            {error && (
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground",
                    circle ? "rounded-full" : ""
                )}>
                    <ImageOff className="h-8 w-8 opacity-50" />
                </div>
            )}
        </div>
    );
};
