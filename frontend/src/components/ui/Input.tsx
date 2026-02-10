import React from 'react';
import { clsx } from 'clsx';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
    className,
    label,
    error,
    fullWidth = false,
    id,
    ...props
}) => {
    const inputId = id || props.name || Math.random().toString(36).substr(2, 9);

    return (
        <div className={clsx('input-wrapper', fullWidth && 'w-full', className)}>
            {label && (
                <label htmlFor={inputId} className="input-label">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={clsx('input-field', error && 'input-error')}
                {...props}
            />
            {error && <span className="input-error-message">{error}</span>}
        </div>
    );
};
