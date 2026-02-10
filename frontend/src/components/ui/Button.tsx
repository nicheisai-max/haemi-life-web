import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './Button.css';

// Utility for merging classes
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    isLoading,
    fullWidth,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
}) => {
    return (
        <button
            className={cn(
                'btn',
                `btn-${variant}`,
                `btn-${size}`,
                isLoading && 'btn-loading',
                fullWidth && 'w-full',
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <span className="spinner" aria-hidden="true"></span>
            )}
            {!isLoading && leftIcon && <span className="btn-icon-left">{leftIcon}</span>}
            {children}
            {!isLoading && rightIcon && <span className="btn-icon-right">{rightIcon}</span>}
        </button>
    );
};
