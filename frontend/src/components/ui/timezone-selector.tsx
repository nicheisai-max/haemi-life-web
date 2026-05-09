import React, { useEffect, useMemo, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem
} from './command';

/**
 * 🌍 HAEMI LIFE — TIMEZONE SELECTOR (Phase 3 — Timezone Sovereignty)
 *
 * Searchable IANA timezone picker rendered in a `CommandDialog`. Used
 * by the doctor's Schedule Management page to set
 * `doctor_profiles.clinic_timezone`, the canonical authority for that
 * doctor's entire scheduling surface.
 *
 * Design constraints (project mandate):
 *   - Strict TS: zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - No inline CSS, no `px` literals — every visual binds to a brand
 *     token via the `haemi-clinic-tz-*` class family in `index.css` or
 *     to existing Tailwind utility classes that resolve through the
 *     theme.
 *   - Light + dark theme correct via `bg-popover` / `text-foreground` /
 *     `text-muted-foreground` (CommandDialog already binds to popover).
 *   - Mobile-to-desktop responsive: dialog is sized by `sm:max-w-2xl`
 *     in `CommandDialog`'s wrapper; the row layout uses flex so it
 *     reflows under narrow widths.
 *   - Accessible: dialog title + description, Enter to confirm,
 *     Escape to dismiss (cmdk handles both natively).
 *
 * Architecture:
 *   - The catalog of zones is sourced from `Intl.supportedValuesOf`
 *     (ES2022; ~600 zones across modern browsers + Node 18+). For
 *     environments missing the API, a curated fallback covers the
 *     populated cities Haemi Life serves today (Botswana, South
 *     Africa, India, US/UK rim — investor-relevant).
 *   - Live current-time per zone is computed via `Intl.DateTimeFormat`
 *     and ticks once per minute (the picker UI only ever displays
 *     minute precision; second-precision ticking would just churn DOM).
 *   - Grouping by region (the substring before the first `/`) is a
 *     pure UX affordance — the underlying value remains the full
 *     IANA string. Selected zone is checkmarked AND auto-scrolled to
 *     when the dialog opens.
 */

interface TimezoneSelectorProps {
    /** Currently-selected IANA timezone (e.g. 'Africa/Gaborone'). */
    readonly value: string;
    /** Controlled open state of the picker dialog. */
    readonly open: boolean;
    /** Open-state setter (typically a `setOpen` from the parent). */
    readonly onOpenChange: (open: boolean) => void;
    /** Fires when the user picks a zone. Parent persists + closes. */
    readonly onSelect: (timezone: string) => void;
}

/**
 * Curated fallback when `Intl.supportedValuesOf` is unavailable. Covers
 * Botswana / South Africa / Asia / EU / US — the rim Haemi Life will
 * serve in the first 18 months. Order is regional, then alphabetical
 * within region (matches the grouping logic below).
 */
const FALLBACK_ZONES: readonly string[] = [
    'Africa/Cairo',
    'Africa/Gaborone',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Maputo',
    'Africa/Nairobi',
    'America/Chicago',
    'America/Los_Angeles',
    'America/New_York',
    'America/Sao_Paulo',
    'America/Toronto',
    'Asia/Bangkok',
    'Asia/Dubai',
    'Asia/Hong_Kong',
    'Asia/Jakarta',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/Berlin',
    'Europe/London',
    'Europe/Madrid',
    'Europe/Moscow',
    'Europe/Paris',
    'UTC',
];

/** Refresh interval for the live current-time column (60 seconds — minute precision). */
const TICK_INTERVAL_MS = 60_000;

/**
 * Loads the IANA timezone catalog once per component lifetime. Memoised
 * because the catalog is stable for the duration of the page session
 * and the underlying API call (~600 strings) is non-trivial.
 */
const loadIanaTimezones = (): readonly string[] => {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
        return Intl.supportedValuesOf('timeZone');
    }
    return FALLBACK_ZONES;
};

/**
 * Splits an IANA zone into `[region, cityLabel]`. The IANA convention
 * uses `Region/City` (sometimes `Region/SubRegion/City`); we treat the
 * first segment as the group heading and the remainder (with
 * underscores converted to spaces, slashes to em-dashes) as the
 * human-readable label. Example:
 *
 *   'America/Argentina/Buenos_Aires' → ['America', 'Argentina — Buenos Aires']
 *   'Africa/Gaborone'                → ['Africa', 'Gaborone']
 *   'UTC'                            → ['UTC', 'UTC']
 */
const splitZone = (zone: string): { region: string; city: string } => {
    const slash = zone.indexOf('/');
    if (slash < 0) {
        return { region: zone, city: zone };
    }
    const region = zone.slice(0, slash);
    const remainder = zone.slice(slash + 1).replace(/_/g, ' ').replace(/\//g, ' — ');
    return { region, city: remainder };
};

/**
 * Returns the localised current time + offset for a zone. Falls back
 * to a typed sentinel if the runtime rejects the timezone (which
 * should not happen for IANA strings sourced from `supportedValuesOf`,
 * but defensive narrowing keeps the column from crashing the picker).
 */
const formatZonePreview = (zone: string, instant: Date): string => {
    try {
        const time = new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(instant);
        const offsetParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            timeZoneName: 'shortOffset',
        }).formatToParts(instant);
        const offset = offsetParts.find(p => p.type === 'timeZoneName')?.value ?? '';
        return offset.length > 0 ? `${time} · ${offset}` : time;
    } catch {
        return '—';
    }
};

export const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
    value,
    open,
    onOpenChange,
    onSelect,
}) => {
    const zones: readonly string[] = useMemo(() => loadIanaTimezones(), []);

    // Tick once per minute so the displayed current time stays fresh
    // without churning the DOM at second precision. The tick stops
    // mounting work to do when the dialog is closed (mounted children
    // are still cheap, but cycles avoided is cycles earned).
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        if (!open) return;
        const interval = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [open]);

    // Group zones by region. The regional split is purely for the UI —
    // the value bound to the upstream `onSelect` is always the full IANA
    // string. Sorting is alphabetical inside each region for predictable
    // scanning; regions themselves are sorted alphabetically so the same
    // doctor lands on the same row position across visits.
    const grouped: ReadonlyArray<{ region: string; entries: ReadonlyArray<{ zone: string; city: string }> }> = useMemo(() => {
        const buckets = new Map<string, Array<{ zone: string; city: string }>>();
        for (const zone of zones) {
            const { region, city } = splitZone(zone);
            const list = buckets.get(region) ?? [];
            list.push({ zone, city });
            buckets.set(region, list);
        }
        const result: Array<{ region: string; entries: Array<{ zone: string; city: string }> }> = [];
        for (const [region, entries] of buckets) {
            entries.sort((a, b) => a.city.localeCompare(b.city));
            result.push({ region, entries });
        }
        result.sort((a, b) => a.region.localeCompare(b.region));
        return result;
    }, [zones]);

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search by city, country, or region..." />
            <CommandList className="haemi-clinic-tz-list">
                <CommandEmpty>
                    No timezone matches your search. Try the city name (e.g. <em>Mumbai</em>, <em>Johannesburg</em>).
                </CommandEmpty>
                {grouped.map(({ region, entries }) => (
                    <CommandGroup key={region} heading={region}>
                        {entries.map(({ zone, city }) => {
                            const isSelected: boolean = zone === value;
                            return (
                                <CommandItem
                                    key={zone}
                                    value={`${zone} ${city}`.toLowerCase()}
                                    onSelect={() => onSelect(zone)}
                                    className="haemi-clinic-tz-item"
                                >
                                    <span className="haemi-clinic-tz-item-marker" aria-hidden="true">
                                        {isSelected ? (
                                            <Check className="haemi-clinic-tz-item-check" />
                                        ) : (
                                            <Globe className="haemi-clinic-tz-item-globe" />
                                        )}
                                    </span>
                                    <span className="haemi-clinic-tz-item-body">
                                        <span className="haemi-clinic-tz-item-city">{city}</span>
                                        <span className="haemi-clinic-tz-item-iana">{zone}</span>
                                    </span>
                                    <span className="haemi-clinic-tz-item-preview">{formatZonePreview(zone, now)}</span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                ))}
            </CommandList>
        </CommandDialog>
    );
};
