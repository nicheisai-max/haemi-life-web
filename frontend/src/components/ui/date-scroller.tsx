import React, { useRef } from 'react';
import { format, addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateScrollerProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    daysCount?: number;
}

/**
 * Premium institutional date carousel.
 *
 * All visuals (colour, radius, motion, hover/selected/focus states) are
 * driven from `index.css` against the brand-token system — `--sidebar-active`
 * for selection continuity with primary navigation, `--card-radius` as the
 * single source of truth for corner radius, and motion tokens
 * (`--duration-hover`, `--ease-premium`) for transition timing.
 *
 * The track reserves a half-arrow-width gutter at each end so the
 * left/right scroller arrows naturally overlap their edge pill by 50%,
 * the standard premium-carousel affordance (Apple, Netflix).
 */
export const DateScroller: React.FC<DateScrollerProps> = ({
    selectedDate,
    onDateSelect,
    daysCount = 14
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Index 0 is today. Past time-slots for today are filtered at the
    // TimeGrid layer with a server-side guard in `getAvailableSlots`.
    const dates = Array.from({ length: daysCount }, (_, i) => {
        const date = addDays(new Date(), i);
        return {
            full: format(date, 'yyyy-MM-dd'),
            dayName: format(date, 'EEE'),
            dayNum: format(date, 'd'),
            month: format(date, 'MMM'),
            isToday: i === 0,
        };
    });

    const scroll = (direction: 'left' | 'right'): void => {
        if (!scrollRef.current) return;
        const step = scrollRef.current.clientWidth * 0.6;
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -step : step,
            behavior: 'smooth'
        });
    };

    return (
        <div className="haemi-date-scroller">
            <button
                type="button"
                aria-label="Scroll to earlier dates"
                onClick={() => scroll('left')}
                className="haemi-date-scroller__arrow haemi-date-scroller__arrow--left"
            >
                <ChevronLeft className="haemi-date-scroller__arrow-icon" aria-hidden="true" />
            </button>

            <div ref={scrollRef} className="haemi-date-scroller__track">
                {dates.map((date) => (
                    <button
                        key={date.full}
                        type="button"
                        onClick={() => onDateSelect(date.full)}
                        data-selected={selectedDate === date.full ? 'true' : 'false'}
                        data-today={date.isToday ? 'true' : 'false'}
                        aria-pressed={selectedDate === date.full}
                        aria-label={
                            date.isToday
                                ? `Today, ${date.month} ${date.dayNum}, ${date.dayName}`
                                : `${date.month} ${date.dayNum}, ${date.dayName}`
                        }
                        className="haemi-date-pill"
                    >
                        <span className="haemi-date-pill__month">{date.month}</span>
                        <span className="haemi-date-pill__num">{date.dayNum}</span>
                        <span className="haemi-date-pill__day">{date.dayName}</span>
                    </button>
                ))}
            </div>

            <button
                type="button"
                aria-label="Scroll to later dates"
                onClick={() => scroll('right')}
                className="haemi-date-scroller__arrow haemi-date-scroller__arrow--right"
            >
                <ChevronRight className="haemi-date-scroller__arrow-icon" aria-hidden="true" />
            </button>
        </div>
    );
};
