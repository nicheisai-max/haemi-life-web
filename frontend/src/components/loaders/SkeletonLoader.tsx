import React from 'react';
import './SkeletonLoader.css';

interface SkeletonLoaderProps {
    variant?: 'avatar' | 'card' | 'table' | 'list' | 'text';
    count?: number;
    width?: string;
    height?: string;
    circle?: boolean;
    className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    variant = 'text',
    count = 1,
    width,
    height,
    circle = false,
    className = '',
}) => {
    const renderSkeleton = () => {
        switch (variant) {
            case 'avatar':
                return (
                    <div className={`skeleton skeleton-avatar ${className}`}>
                        <div className="skeleton-shimmer"></div>
                    </div>
                );

            case 'card':
                return (
                    <div className={`skeleton skeleton-card ${className}`}>
                        <div className="skeleton-card-header">
                            <div className="skeleton-avatar-sm"></div>
                            <div className="skeleton-text-group">
                                <div className="skeleton-text skeleton-text-md"></div>
                                <div className="skeleton-text skeleton-text-sm"></div>
                            </div>
                        </div>
                        <div className="skeleton-card-body">
                            <div className="skeleton-text skeleton-text-lg"></div>
                            <div className="skeleton-text skeleton-text-md"></div>
                            <div className="skeleton-text skeleton-text-sm"></div>
                        </div>
                        <div className="skeleton-shimmer"></div>
                    </div>
                );

            case 'table':
                return (
                    <div className={`skeleton skeleton-table ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className="skeleton-table-row">
                                <div className="skeleton-text skeleton-text-sm"></div>
                                <div className="skeleton-text skeleton-text-md"></div>
                                <div className="skeleton-text skeleton-text-sm"></div>
                                <div className="skeleton-text skeleton-text-xs"></div>
                            </div>
                        ))}
                        <div className="skeleton-shimmer"></div>
                    </div>
                );

            case 'list':
                return (
                    <div className={`skeleton skeleton-list ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className="skeleton-list-item">
                                <div className="skeleton-avatar-sm"></div>
                                <div className="skeleton-text-group">
                                    <div className="skeleton-text skeleton-text-md"></div>
                                    <div className="skeleton-text skeleton-text-sm"></div>
                                </div>
                            </div>
                        ))}
                        <div className="skeleton-shimmer"></div>
                    </div>
                );

            case 'text':
            default:
                return (
                    <div className={`skeleton skeleton-text-group ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div
                                key={i}
                                className={`skeleton-text ${circle ? 'skeleton-circle' : ''}`}
                                style={{
                                    width: width || '100%',
                                    height: height || '1rem',
                                    borderRadius: circle ? '50%' : undefined,
                                }}
                            ></div>
                        ))}
                        <div className="skeleton-shimmer"></div>
                    </div>
                );
        }
    };

    return <>{renderSkeleton()}</>;
};

// Preset skeleton components for common use cases
export const AvatarSkeleton: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
    <div className={`skeleton-avatar skeleton-avatar-${size}`}>
        <div className="skeleton-shimmer"></div>
    </div>
);

export const CardSkeleton: React.FC = () => <SkeletonLoader variant="card" />;

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
    <SkeletonLoader variant="table" count={rows} />
);

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 3 }) => (
    <SkeletonLoader variant="list" count={items} />
);
