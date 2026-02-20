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
            {/* Navigation Buttons */}
            <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-primary-foreground disabled:opacity-0"
                type="button"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory px-8"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {dates.map((date) => {
                    const isSelected = selectedDate === date.full;
                    return (
                        <motion.button
                            key={date.full}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onDateSelect(date.full)}
                            type="button"
                            className={cn(
                                "flex-shrink-0 w-20 py-4 rounded-xl border transition-all duration-300 snap-center",
                                "flex flex-col items-center justify-center gap-1",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                                    : "bg-background/50 hover:bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                            )}>
                                {date.month}
                            </span>
                            <span className="text-h3 leading-none">
                                {date.dayNum}
                            </span>
                            <span className={cn(
                                "text-xs font-medium",
                                isSelected ? "text-primary-foreground/90" : "text-primary"
                            )}>
                                {date.dayName}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 backdrop-blur-md border border-border/50 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-primary-foreground disabled:opacity-0"
                type="button"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
};
