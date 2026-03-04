import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    id?: string;
    name?: string;
}

export const PremiumNumberInput: React.FC<PremiumNumberInputProps> = ({
    value,
    onChange,
    min = 0,
    max = 1000000,
    step = 1,
    className,
    id,
    name
}) => {
    const [inputValue, setInputValue] = useState(value.toString());
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const initialDelayRef = useRef<NodeJS.Timeout | null>(null);
    const valueRef = useRef(value);

    const stopContinuous = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (initialDelayRef.current) clearTimeout(initialDelayRef.current);
        timerRef.current = null;
        initialDelayRef.current = null;
    }, []);

    const startContinuous = useCallback((action: () => void) => {
        stopContinuous(); // Safety clear
        action();
        initialDelayRef.current = setTimeout(() => {
            timerRef.current = setInterval(() => {
                action();
            }, 80);
        }, 500);
    }, [stopContinuous]);

    const handleIncrement = useCallback(() => {
        const next = Math.min(valueRef.current + step, max);
        const fixedNext = parseFloat(next.toFixed(2));
        onChange(fixedNext);
    }, [max, onChange, step]);

    const handleDecrement = useCallback(() => {
        const next = Math.max(valueRef.current - step, min);
        const fixedNext = parseFloat(next.toFixed(2));
        onChange(fixedNext);
    }, [min, onChange, step]);

    // Sync state and ref if prop changes
    useEffect(() => {
        Promise.resolve().then(() => {
            setInputValue(value.toString());
        });
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        return () => stopContinuous();
    }, [stopContinuous]);

    const handleBlur = () => {
        let val = parseFloat(inputValue);
        if (isNaN(val) || val < min) {
            val = min;
        } else if (val > max) {
            val = max;
        }
        const fixedVal = parseFloat(val.toFixed(2));
        setInputValue(fixedVal.toString());
        onChange(fixedVal);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            setInputValue('');
            return;
        }
        // Allow digits and a single decimal point
        if (/^\d*\.?\d{0,2}$/.test(val)) {
            setInputValue(val);
            const parsed = parseFloat(val);
            if (!isNaN(parsed) && parsed >= min && parsed <= max) {
                onChange(parsed);
            }
        }
    };

    return (
        <div className={cn(
            "premium-counter-container focus-within:ring-2 focus-within:ring-primary/20",
            className
        )}>
            <button
                type="button"
                onMouseDown={() => startContinuous(handleDecrement)}
                onMouseUp={stopContinuous}
                onMouseLeave={stopContinuous}
                onTouchStart={() => startContinuous(handleDecrement)}
                onTouchEnd={stopContinuous}
                className="premium-counter-btn disabled:opacity-30 disabled:pointer-events-none"
                disabled={value <= min}
            >
                <Minus className="h-4 w-4" />
            </button>

            <input
                type="text"
                id={id}
                name={name}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                maxLength={8}
                className="premium-counter-input"
            />

            <button
                type="button"
                onMouseDown={() => startContinuous(handleIncrement)}
                onMouseUp={stopContinuous}
                onMouseLeave={stopContinuous}
                onTouchStart={() => startContinuous(handleIncrement)}
                onTouchEnd={stopContinuous}
                className="premium-counter-btn disabled:opacity-30 disabled:pointer-events-none"
                disabled={value >= max}
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
};
