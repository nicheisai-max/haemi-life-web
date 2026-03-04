import React, { useRef } from 'react';
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface DateScrollerProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    daysCount?: number;
}

export const DateScroller: React.FC<DateScrollerProps> = ({
    selectedDate,
    onDateSelect,
    daysCount = 14
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const dates = Array.from({ length: daysCount }, (_, i) => {
        const date = addDays(new Date(), i + 1);
        return {
            full: format(date, 'yyyy-MM-dd'),
            dayName: format(date, 'EEE'),
            dayNum: format(date, 'd'),
            month: format(date, 'MMM')
        };
    });

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative group px-1">
            {/* Navigation Buttons - Always visible now */}
            <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/95 dark:bg-background/80 backdrop-blur-md border border-input shadow-sm flex items-center justify-center text-foreground transition-all duration-300 hover:bg-primary hover:border-primary hover:text-primary-foreground hover:shadow-lg dark:hover:bg-primary dark:hover:shadow-primary/30"
                type="button"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto py-2 px-8 scrollbar-none snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {dates.map((date) => {
                    const isSelected = selectedDate === date.full;
                    return (
                        <motion.button
                            key={date.full}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onDateSelect(date.full)}
                            type="button"
                            className={cn(
                                "flex-shrink-0 w-20 py-4 rounded-xl border transition-all duration-300 snap-center cursor-pointer",
                                "flex flex-col items-center justify-center gap-1",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                                    : "bg-background/60 border-border/60 text-muted-foreground hover:bg-primary/5 hover:border-primary hover:text-foreground hover:shadow-md dark:hover:bg-primary/15 dark:hover:shadow-lg dark:hover:shadow-primary/20"
                            )}
                        >
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider transition-colors duration-300",
                                isSelected 
                                    ? "text-primary-foreground/80" 
                                    : "text-muted-foreground group-hover:text-foreground"
                            )}>
                                {date.month}
                            </span>
                            <span className="text-h3 leading-none transition-colors duration-300">
                                {date.dayNum}
                            </span>
                            <span className={cn(
                                "text-xs font-medium transition-colors duration-300",
                                isSelected 
                                    ? "text-primary-foreground/90" 
                                    : "text-primary hover:text-primary-600 dark:hover:text-primary-400"
                            )}>
                                {date.dayName}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/95 dark:bg-background/80 backdrop-blur-md border border-input shadow-sm flex items-center justify-center text-foreground transition-all duration-300 hover:bg-primary hover:border-primary hover:text-primary-foreground hover:shadow-lg dark:hover:bg-primary dark:hover:shadow-primary/30"
                type="button"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
};
