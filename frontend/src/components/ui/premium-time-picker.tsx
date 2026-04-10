import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumTimePickerProps {
    value: string; // HH:mm (24h format)
    onChange: (value: string) => void;
    className?: string;
}

export const PremiumTimePicker: React.FC<PremiumTimePickerProps> = ({
    value,
    onChange,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial parse of the value
    const [h24, m24] = value.split(':').map(Number);
    const initialPeriod = h24 >= 12 ? 'PM' : 'AM';
    let initialH12 = h24 % 12;
    if (initialH12 === 0) initialH12 = 12;

    const [hour, setHour] = useState(initialH12);
    const [minute, setMinute] = useState(m24);
    const [period, setPeriod] = useState(initialPeriod);

    // Sync state if prop changes externally
    useEffect(() => {
        const [nh24, nm24] = value.split(':').map(Number);
        const np = nh24 >= 12 ? 'PM' : 'AM';
        let nh12 = nh24 % 12;
        if (nh12 === 0) nh12 = 12;

        Promise.resolve().then(() => {
            setHour(nh12);
            setMinute(nm24);
            setPeriod(np);
        });
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateTime = (newH: number, newM: number, newP: string) => {
        let finalH24 = newH;
        if (newP === 'PM' && newH !== 12) finalH24 += 12;
        if (newP === 'AM' && newH === 12) finalH24 = 0;

        const hStr = finalH24.toString().padStart(2, '0');
        const mStr = newM.toString().padStart(2, '0');
        onChange(`${hStr}:${mStr}`);
    };

    const handleHourChange = (newHour: number) => {
        setHour(newHour);
        updateTime(newHour, minute, period);
    };

    const handleMinuteChange = (newMinute: number) => {
        setMinute(newMinute);
        updateTime(hour, newMinute, period);
    };

    const handlePeriodChange = (newPeriod: string) => {
        setPeriod(newPeriod);
        updateTime(hour, minute, newPeriod);
    };

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className={cn("relative inline-block w-full md:w-48", className)} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between w-full h-11 px-4 rounded-xl border transition-all duration-200",
                    "bg-card border-border hover:border-primary/50 text-foreground shadow-sm",
                    isOpen && "ring-2 ring-primary/20 border-primary"
                )}
            >
                <div className="flex items-center gap-2">
                    <span className="font-medium tracking-wide">
                        {hour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')} {period}
                    </span>
                </div>
                <Clock className={cn("h-4 w-4 transition-colors", isOpen ? "text-primary" : "text-muted-foreground")} />
            </button>

            {/* Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 5, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className={cn(
                            "absolute z-50 mt-1 w-64 bg-card border border-border rounded-2xl shadow-2xl p-4",
                            "flex flex-col gap-4 overflow-hidden"
                        )}
                    >
                        <div className="flex items-start justify-between">
                            {/* Hours Column */}
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Hour</span>
                                <div className="h-40 overflow-y-auto w-full no-scrollbar space-y-1 py-1">
                                    {hours.map((h) => (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => handleHourChange(h)}
                                            className={cn(
                                                "w-full py-1.5 rounded-[var(--card-radius)] text-sm font-medium transition-all duration-200",
                                                hour === h
                                                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {h.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-40 w-[1px] bg-border/50 mx-2 mt-6" />

                            {/* Minutes Column */}
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Min</span>
                                <div className="h-40 overflow-y-auto w-full no-scrollbar space-y-1 py-1">
                                    {/* Medical style: 00, 15, 30, 45 or full 00-55 */}
                                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => handleMinuteChange(m)}
                                            className={cn(
                                                "w-full py-1.5 rounded-[var(--card-radius)] text-sm font-medium transition-all duration-200",
                                                minute === m
                                                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {m.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-40 w-[1px] bg-border/50 mx-2 mt-6" />

                            {/* AM/PM Column */}
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Period</span>
                                <div className="flex flex-col gap-2 w-full mt-2">
                                    {['AM', 'PM'].map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handlePeriodChange(p)}
                                            className={cn(
                                                "w-full py-2.5 rounded-[var(--card-radius)] text-xs font-bold transition-all duration-300",
                                                period === p
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Done Button */}
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="mt-2 w-full py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all duration-300 border border-primary/20"
                        >
                            SET TIME
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <style dangerouslySetInnerHTML={{
                __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
};
