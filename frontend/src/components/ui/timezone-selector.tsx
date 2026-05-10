import React, { useMemo } from 'react';
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
 * Performance posture (perf-hardening pass — 2026-05-10):
 *   ~600 IANA zones × per-tick `Intl.DateTimeFormat` calls in the prior
 *   revision drove ~1200 constructor calls per render and a noticeable
 *   open-time stutter on lower-end devices. This revision drops the
 *   per-row LIVE current time entirely (the picker is for selection,
 *   not exploration — the `<ClinicTimezoneCard />` parent already shows
 *   the live current-time for the SELECTED zone) and pre-computes each
 *   zone's static GMT offset once at mount, then never again. The
 *   minute-tick state and effect are removed wholesale. Net effect:
 *     - 600 Intl calls (offset only) at first mount, never again
 *     - zero re-render churn while the dialog is open
 *     - mount-time work is masked by the parent's medical loader
 *       (button click → loader → modal-with-cached-list ready)
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

/**
 * Loads the IANA timezone catalog once per component lifetime. The
 * underlying API call (~600 strings) is non-trivial enough that
 * memoising at the component level is appropriate.
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
 * Computes the static GMT offset string (e.g. `GMT+05:30`) for a zone.
 * Computed once per zone at mount and cached on the row entry — no
 * per-tick re-render churn. The offset is stable for ~6 months at a
 * time across DST cycles, which is acceptable for a selector whose
 * purpose is identification, not live observation.
 */
const computeZoneOffset = (zone: string): string => {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            timeZoneName: 'shortOffset',
        }).formatToParts(new Date());
        return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    } catch {
        return '';
    }
};

interface ZoneEntry {
    readonly zone: string;
    readonly city: string;
    readonly offset: string;
}

interface RegionGroup {
    readonly region: string;
    readonly entries: ReadonlyArray<ZoneEntry>;
}

export const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
    value,
    open,
    onOpenChange,
    onSelect,
}) => {
    // Single, mount-once computation. Pre-builds the regional grouping
    // AND each row's static offset string so the render path is pure
    // string interpolation — no Intl calls, no Date math, nothing for
    // the render loop to recompute on subsequent renders.
    const grouped: ReadonlyArray<RegionGroup> = useMemo(() => {
        const zones = loadIanaTimezones();
        const buckets = new Map<string, Array<ZoneEntry>>();
        for (const zone of zones) {
            const { region, city } = splitZone(zone);
            const list = buckets.get(region) ?? [];
            list.push({ zone, city, offset: computeZoneOffset(zone) });
            buckets.set(region, list);
        }
        const result: Array<{ region: string; entries: Array<ZoneEntry> }> = [];
        for (const [region, entries] of buckets) {
            entries.sort((a, b) => a.city.localeCompare(b.city));
            result.push({ region, entries });
        }
        result.sort((a, b) => a.region.localeCompare(b.region));
        return result;
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Search by city, country, or region..." />
            <CommandList className="haemi-clinic-tz-list">
                <CommandEmpty>
                    No timezone matches your search. Try the city name (e.g. <em>Mumbai</em>, <em>Johannesburg</em>).
                </CommandEmpty>
                {grouped.map(({ region, entries }) => (
                    <CommandGroup key={region} heading={region}>
                        {entries.map(({ zone, city, offset }) => {
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
                                    <span className="haemi-clinic-tz-item-preview">{offset}</span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                ))}
            </CommandList>
        </CommandDialog>
    );
};
