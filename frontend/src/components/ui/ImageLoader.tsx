import React, { useState, useEffect } from 'react';
import './ImageLoader.css';

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

        const element = document.getElementById(`img-${src}`);
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
            id={`img-${src}`}
            className={`image-loader-container ${circle ? 'image-loader-circle' : ''} ${className}`}
            style={{ width, height }}
        >
            {/* Skeleton Loader */}
            {!loaded && (
                <div className={`image-skeleton ${circle ? 'skeleton-circle' : ''} ${skeletonClassName}`}>
                    <div className="skeleton-shimmer"></div>
                </div>
            )}

            {/* Actual Image */}
            {inView && (
                <img
                    src={src}
                    alt={alt}
                    className={`loaded-image ${loaded ? 'image-loaded' : 'image-loading'} ${error ? 'image-error' : ''}`}
                    onLoad={handleLoad}
                    onError={handleError}
                    style={{ display: loaded ? 'block' : 'none' }}
                />
            )}

            {/* Error Fallback */}
            {error && (
                <div className="image-error-fallback">
                    <span className="material-icons-outlined">broken_image</span>
                </div>
            )}
        </div>
    );
};
