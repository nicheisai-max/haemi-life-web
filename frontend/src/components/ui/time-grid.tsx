import React from 'react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Sunset, Moon } from "lucide-react";

interface TimeGridProps {
    slots: string[];
    selectedTime: string;
    onTimeSelect: (time: string) => void;
    loading?: boolean;
    /**
     * The date these slots belong to (`yyyy-MM-dd`). When equal to today's
     * date we filter out slots whose start time is already in the past
     * (with a small lead-time buffer) so the patient cannot select a slot
     * that has already started. The backend `getAvailableSlots` applies the
     * same filter — this is defense-in-depth against clock skew and stale
     * server responses.
     */
    selectedDate?: string;
}

/**
 * Minimum lead time, in minutes, between "now" and the start of a bookable
 * slot. Prevents patients from booking a slot that begins in the next 60
 * seconds (which the doctor cannot realistically prep for) while still
 * allowing same-day same-hour booking parity with consumer systems.
 */
const BOOKING_LEAD_TIME_MINUTES = 15;

const isTodayLocal = (yyyymmdd: string | undefined): boolean => {
    if (!yyyymmdd) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return yyyymmdd === todayStr;
};

const slotIsBookable = (slot: string, selectedDate: string | undefined): boolean => {
    if (!isTodayLocal(selectedDate)) return true;
    const [hh, mm] = slot.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
    const slotDate = new Date();
    slotDate.setHours(hh, mm, 0, 0);
    const earliestBookable = new Date(Date.now() + BOOKING_LEAD_TIME_MINUTES * 60_000);
    return slotDate.getTime() >= earliestBookable.getTime();
};

export const TimeGrid: React.FC<TimeGridProps> = ({
    slots,
    selectedTime,
    onTimeSelect,
    loading,
    selectedDate
}) => {
    if (loading) {
        return (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="h-11 bg-muted rounded-[var(--card-radius)]" />
                ))}
            </div>
        );
    }

    const bookableSlots = (slots ?? []).filter(s => slotIsBookable(s, selectedDate));

    if (bookableSlots.length === 0) {
        const emptyCopy = isTodayLocal(selectedDate) && (slots?.length ?? 0) > 0
            ? "All of today's remaining slots have passed. Select a future date."
            : "No available slots for this date.";
        return (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border bg-muted/30">
                <p className="text-muted-foreground text-sm italic">{emptyCopy}</p>
            </div>
        );
    }

    const categorizeSlots = () => {
        const morning: string[] = [];
        const afternoon: string[] = [];
        const evening: string[] = [];

        bookableSlots.forEach(slot => {
            const hour = parseInt(slot.split(':')[0], 10);
            if (hour < 12) morning.push(slot);
            else if (hour < 17) afternoon.push(slot);
            else evening.push(slot);
        });

        return { morning, afternoon, evening };
    };

    const categories = categorizeSlots();
    const { morning, afternoon, evening } = categories;

    return (
        <div className="space-y-6">
            <AnimatePresence mode="wait">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                >
                    <Section
                        title="Morning"
                        items={morning}
                        icon={Sun}
                        selectedTime={selectedTime}
                        onTimeSelect={onTimeSelect}
                    />
                    <Section
                        title="Afternoon"
                        items={afternoon}
                        icon={Sunset}
                        selectedTime={selectedTime}
                        onTimeSelect={onTimeSelect}
                    />
                    <Section
                        title="Evening"
                        items={evening}
                        icon={Moon}
                        selectedTime={selectedTime}
                        onTimeSelect={onTimeSelect}
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

interface SectionProps {
    title: string;
    items: string[];
    icon: React.ElementType;
    selectedTime: string;
    onTimeSelect: (time: string) => void;
}

const Section = ({ title, items, icon: Icon, selectedTime, onTimeSelect }: SectionProps) => {
    if (items.length === 0) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Icon className="h-3.5 w-3.5" />
                {title}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {items.map(slot => {
                    const isSelected = selectedTime === slot;
                    const formattedTime = new Date(`2000-01-01T${slot}`).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });

                    return (
                        <motion.button
                            key={slot}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onTimeSelect(slot)}
                            type="button"
                            className={cn(
                                "py-2.5 px-3 rounded-[var(--card-radius)] border text-sm font-medium transition-all duration-200",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                    : "bg-background border-border hover:border-primary/50 hover:bg-primary/5 text-foreground"
                            )}
                        >
                            {formattedTime}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
