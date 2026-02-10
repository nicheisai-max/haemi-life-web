import React, { useState } from 'react';
import { clsx } from 'clsx';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    className,
    label,
    error,
    fullWidth = false,
    id,
    startIcon,
    endIcon,
    onFocus,
    onBlur,
    ...props
}) => {
    const inputId = id || props.name || Math.random().toString(36).substr(2, 9);
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        setHasValue(!!e.target.value);
        if (onBlur) onBlur(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHasValue(!!e.target.value);
        if (props.onChange) props.onChange(e);
    };

    return (
        <div className={clsx('input-group', fullWidth && 'w-full', className)}>
            <div className={clsx(
                'input-container',
                isFocused && 'input-focused',
                error && 'input-error-state',
                props.disabled && 'input-disabled'
            )}>
                {startIcon && <span className="input-icon-start">{startIcon}</span>}

                <div className="input-content">
                    <input
                        id={inputId}
                        className="input-field-premium"
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onChange={handleChange}
                        {...props}
                        placeholder={isFocused ? props.placeholder : ''}
                    />
                    {label && (
                        <label
                            htmlFor={inputId}
                            className={clsx('input-label-floating', (isFocused || hasValue || props.value) && 'label-active')}
                        >
                            {label}
                        </label>
                    )}
                </div>

                {endIcon && <span className="input-icon-end">{endIcon}</span>}
            </div>

            {error && (
                <div className="input-error-message fade-in">
                    <span className="material-icons-outlined text-xs">error_outline</span>
                    {error}
                </div>
            )}
        </div>
    );
};
