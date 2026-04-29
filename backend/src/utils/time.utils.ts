/**
 * 🕒 HAEMI LIFE: INSTITUTIONAL TEMPORAL INTELLIGENCE (v12.0 Platinum)
 * Policy: Timezone Sovereignty, Deterministic Buffering, Zero-Any Compliance.
 */

// Institutional Standard: Botswana (GMT+02:00)
export const SYSTEM_TIMEZONE: string = 'Africa/Gaborone';
export const MIN_BOOKING_BUFFER_MINUTES: number = 30;

/**
 * Returns the current date-time adjusted for the institutional timezone.
 * Standard: Google/Meta Strict Type Compliance.
 */
export const getCurrentTimeInTZ = (): Date => {
    const now: Date = new Date();
    // Using Intl to avoid external dependencies and maintain 100% cost-efficiency
    const tzString: string = now.toLocaleString('en-US', { timeZone: SYSTEM_TIMEZONE });
    return new Date(tzString);
};

/**
 * Formats a Date object to institutional HH:mm (24h) format.
 * No 'any' used.
 */
export const formatToTimeStr = (date: Date): string => {
    const hours: string = String(date.getHours()).padStart(2, '0');
    const minutes: string = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

/**
 * Institutional Slot Validator.
 * Determines if a slot is bookable based on current time and buffer.
 */
export const isSlotAvailable = (slotTimeStr: string, bookingDateStr: string): boolean => {
    const nowInTZ: Date = getCurrentTimeInTZ();
    
    // Parse booking date safely (YYYY-MM-DD)
    const dateParts: number[] = bookingDateStr.split('-').map((part: string) => parseInt(part, 10));
    if (dateParts.length !== 3) return false;

    const bookingDate: Date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    
    // Comparison baseline (Zero-hour normalization)
    const today: Date = new Date(nowInTZ);
    today.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);

    // 1. Governance: Future dates are inherently valid for schedule slots.
    if (bookingDate.getTime() > today.getTime()) return true;
    
    // 2. Governance: Past dates are strictly forbidden.
    if (bookingDate.getTime() < today.getTime()) return false;

    // 3. Governance: Today's slots require the MIN_BOOKING_BUFFER (30 mins).
    const thresholdDate: Date = new Date(nowInTZ);
    thresholdDate.setMinutes(thresholdDate.getMinutes() + MIN_BOOKING_BUFFER_MINUTES);
    
    const thresholdTimeStr: string = formatToTimeStr(thresholdDate);
    
    // Lexicographical comparison for HH:mm strings (O(1) efficiency)
    return slotTimeStr >= thresholdTimeStr;
};

/**
 * Validates if a date string represents Today or a Future Date.
 */
export const isFutureOrToday = (dateStr: string): boolean => {
    const nowInTZ: Date = getCurrentTimeInTZ();
    const dateParts: number[] = dateStr.split('-').map((part: string) => parseInt(part, 10));
    if (dateParts.length !== 3) return false;

    const targetDate: Date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    
    const today: Date = new Date(nowInTZ);
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    return targetDate.getTime() >= today.getTime();
};
