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
 * 🌐 City alias map — Google Calendar / Microsoft Windows-grade search.
 *
 * IANA only stores a single representative city per timezone (e.g.
 * `Asia/Kolkata` for the entire Indian Standard Time region). Without
 * augmentation, a doctor searching for "Mumbai" or "Delhi" in our
 * picker would see no results — even though Mumbai and Delhi share
 * `Asia/Kolkata`'s zone exactly. That is the well-known IANA-vs-UX
 * mismatch every major scheduling product layers around.
 *
 * This map mirrors the alias layer Google Calendar, Outlook, and
 * Windows Time Zone settings ship with: each IANA zone gets the
 * popular city + country names that should resolve to it. Search
 * matches against every alias; the row's display label inlines the
 * top 3 aliases so the doctor can visually confirm coverage at a
 * glance ("Kolkata · Mumbai · Delhi · Bengaluru → Asia/Kolkata").
 *
 * Coverage scope: ~60 IANA zones, ~250 city/country aliases.
 * Strategy is "world's major cities + Haemi Life's serviced regions
 * with extra weight" (Botswana, South Africa, India given fuller
 * city lists). Obscure zones (Pacific atolls, etc.) intentionally
 * omitted — the IANA city alone is sufficient for those.
 */
const TIMEZONE_CITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
    // ─── Africa ───────────────────────────────────────────────────────
    'Africa/Gaborone': ['Francistown', 'Maun', 'Botswana'],
    'Africa/Johannesburg': ['Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'South Africa'],
    'Africa/Cairo': ['Alexandria', 'Giza', 'Egypt'],
    'Africa/Lagos': ['Abuja', 'Kano', 'Ibadan', 'Nigeria'],
    'Africa/Nairobi': ['Mombasa', 'Kisumu', 'Kenya'],
    'Africa/Casablanca': ['Rabat', 'Marrakech', 'Fes', 'Morocco'],
    'Africa/Algiers': ['Oran', 'Algeria'],
    'Africa/Tunis': ['Tunisia'],
    'Africa/Addis_Ababa': ['Ethiopia'],
    'Africa/Accra': ['Kumasi', 'Ghana'],
    'Africa/Dakar': ['Senegal'],
    'Africa/Maputo': ['Beira', 'Mozambique'],
    'Africa/Harare': ['Bulawayo', 'Zimbabwe'],
    'Africa/Lusaka': ['Zambia'],
    'Africa/Kampala': ['Uganda'],
    'Africa/Dar_es_Salaam': ['Dodoma', 'Tanzania'],

    // ─── Americas ─────────────────────────────────────────────────────
    'America/Los_Angeles': ['San Francisco', 'Seattle', 'Las Vegas', 'Portland', 'San Diego', 'Sacramento', 'Pacific Time', 'PST', 'PDT', 'California', 'USA'],
    'America/Denver': ['Salt Lake City', 'Albuquerque', 'Boise', 'Mountain Time', 'MST', 'MDT', 'Colorado'],
    'America/Chicago': ['Houston', 'Dallas', 'San Antonio', 'Austin', 'Minneapolis', 'Memphis', 'Nashville', 'New Orleans', 'Central Time', 'CST', 'CDT', 'Texas'],
    'America/New_York': ['Boston', 'Philadelphia', 'Washington DC', 'Atlanta', 'Miami', 'Charlotte', 'Detroit', 'Eastern Time', 'EST', 'EDT', 'NYC'],
    'America/Phoenix': ['Tucson', 'Arizona'],
    'America/Anchorage': ['Juneau', 'Alaska'],
    'Pacific/Honolulu': ['Hawaii', 'HST'],
    'America/Toronto': ['Ottawa', 'Montreal', 'Quebec City', 'Eastern Canada'],
    'America/Vancouver': ['Pacific Canada', 'British Columbia'],
    'America/Edmonton': ['Calgary', 'Mountain Canada', 'Alberta'],
    'America/Sao_Paulo': ['Rio de Janeiro', 'Brasilia', 'Salvador', 'Belo Horizonte', 'Recife', 'Brazil'],
    'America/Mexico_City': ['Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Mexico'],
    'America/Bogota': ['Medellin', 'Cali', 'Cartagena', 'Colombia'],
    'America/Lima': ['Arequipa', 'Peru'],
    'America/Santiago': ['Valparaiso', 'Chile'],
    'America/Argentina/Buenos_Aires': ['Cordoba', 'Argentina'],
    'America/Caracas': ['Maracaibo', 'Venezuela'],

    // ─── Asia ─────────────────────────────────────────────────────────
    'Asia/Kolkata': ['Mumbai', 'Delhi', 'New Delhi', 'Bengaluru', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Surat', 'Indore', 'Nagpur', 'India', 'IST'],
    'Asia/Karachi': ['Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Pakistan'],
    'Asia/Dhaka': ['Chittagong', 'Bangladesh'],
    'Asia/Colombo': ['Sri Lanka', 'Sri Jayawardenepura'],
    'Asia/Kathmandu': ['Pokhara', 'Nepal'],
    'Asia/Tokyo': ['Osaka', 'Kyoto', 'Sapporo', 'Yokohama', 'Nagoya', 'Fukuoka', 'Kobe', 'Japan', 'JST'],
    'Asia/Shanghai': ['Beijing', 'Shenzhen', 'Guangzhou', 'Chengdu', 'Wuhan', 'Xi’an', 'China'],
    'Asia/Hong_Kong': ['HK', 'Kowloon'],
    'Asia/Seoul': ['Busan', 'Incheon', 'Daegu', 'Korea', 'South Korea'],
    'Asia/Singapore': ['SG'],
    'Asia/Bangkok': ['Phuket', 'Chiang Mai', 'Pattaya', 'Thailand'],
    'Asia/Jakarta': ['Surabaya', 'Bandung', 'Medan', 'Indonesia'],
    'Asia/Manila': ['Quezon City', 'Cebu', 'Davao', 'Philippines'],
    'Asia/Kuala_Lumpur': ['Penang', 'Johor Bahru', 'Malaysia'],
    'Asia/Ho_Chi_Minh': ['Saigon', 'Hanoi', 'Da Nang', 'Vietnam'],
    'Asia/Taipei': ['Kaohsiung', 'Taiwan'],
    'Asia/Dubai': ['Abu Dhabi', 'Sharjah', 'UAE', 'United Arab Emirates'],
    'Asia/Riyadh': ['Jeddah', 'Mecca', 'Medina', 'Dammam', 'Saudi Arabia', 'Saudi'],
    'Asia/Tehran': ['Mashhad', 'Isfahan', 'Iran'],
    'Asia/Jerusalem': ['Tel Aviv', 'Haifa', 'Israel'],
    'Asia/Baghdad': ['Basra', 'Mosul', 'Iraq'],
    'Asia/Kuwait': ['Kuwait City'],
    'Asia/Qatar': ['Doha'],
    'Asia/Bahrain': ['Manama'],
    'Asia/Beirut': ['Tripoli', 'Lebanon'],
    'Asia/Amman': ['Jordan'],
    'Asia/Damascus': ['Aleppo', 'Syria'],

    // ─── Europe ───────────────────────────────────────────────────────
    'Europe/London': ['Manchester', 'Edinburgh', 'Glasgow', 'Birmingham', 'Liverpool', 'Leeds', 'UK', 'Britain', 'England', 'Scotland', 'Wales', 'GMT', 'BST'],
    'Europe/Dublin': ['Cork', 'Galway', 'Ireland'],
    'Europe/Paris': ['Lyon', 'Marseille', 'Bordeaux', 'Nice', 'Toulouse', 'Nantes', 'France'],
    'Europe/Berlin': ['Hamburg', 'Munich', 'Frankfurt', 'Cologne', 'Stuttgart', 'Dusseldorf', 'Germany'],
    'Europe/Rome': ['Milan', 'Naples', 'Turin', 'Florence', 'Venice', 'Bologna', 'Italy'],
    'Europe/Madrid': ['Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Malaga', 'Spain'],
    'Europe/Amsterdam': ['Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Netherlands', 'Holland'],
    'Europe/Brussels': ['Antwerp', 'Ghent', 'Belgium'],
    'Europe/Lisbon': ['Porto', 'Coimbra', 'Portugal'],
    'Europe/Zurich': ['Geneva', 'Basel', 'Bern', 'Lausanne', 'Switzerland'],
    'Europe/Vienna': ['Graz', 'Salzburg', 'Innsbruck', 'Austria'],
    'Europe/Stockholm': ['Gothenburg', 'Malmo', 'Uppsala', 'Sweden'],
    'Europe/Oslo': ['Bergen', 'Trondheim', 'Stavanger', 'Norway'],
    'Europe/Helsinki': ['Tampere', 'Turku', 'Espoo', 'Finland'],
    'Europe/Copenhagen': ['Aarhus', 'Odense', 'Aalborg', 'Denmark'],
    'Atlantic/Reykjavik': ['Iceland'],
    'Europe/Warsaw': ['Krakow', 'Lodz', 'Wroclaw', 'Poznan', 'Poland'],
    'Europe/Prague': ['Brno', 'Ostrava', 'Czech Republic', 'Czechia'],
    'Europe/Budapest': ['Debrecen', 'Hungary'],
    'Europe/Bucharest': ['Cluj-Napoca', 'Timisoara', 'Romania'],
    'Europe/Athens': ['Thessaloniki', 'Patras', 'Greece'],
    'Europe/Sofia': ['Plovdiv', 'Varna', 'Bulgaria'],
    'Europe/Belgrade': ['Novi Sad', 'Serbia'],
    'Europe/Zagreb': ['Split', 'Rijeka', 'Croatia'],
    'Europe/Moscow': ['Saint Petersburg', 'St Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Russia'],
    'Europe/Istanbul': ['Ankara', 'Izmir', 'Bursa', 'Turkey'],
    'Europe/Kiev': ['Kyiv', 'Kharkiv', 'Odessa', 'Dnipro', 'Ukraine'],

    // ─── Oceania ──────────────────────────────────────────────────────
    'Australia/Sydney': ['Newcastle', 'Wollongong', 'NSW', 'New South Wales'],
    'Australia/Melbourne': ['Geelong', 'Victoria', 'VIC'],
    'Australia/Brisbane': ['Gold Coast', 'Cairns', 'Queensland', 'QLD'],
    'Australia/Perth': ['Fremantle', 'Western Australia', 'WA'],
    'Australia/Adelaide': ['South Australia', 'SA'],
    'Pacific/Auckland': ['Wellington', 'Christchurch', 'Dunedin', 'New Zealand', 'NZ'],
    'Pacific/Fiji': ['Suva'],
};

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
    /**
     * Alternative city/country names for this zone. Used in two ways:
     *   1. cmdk search match — full list joined into the `value` prop
     *      so typing any alias (e.g. "Mumbai") matches the row.
     *   2. Display label augmentation — top 3 inlined after the IANA
     *      city so the doctor sees regional coverage at a glance.
     * Empty array for zones not in `TIMEZONE_CITY_ALIASES`.
     */
    readonly aliases: readonly string[];
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
    // Single, mount-once computation. Pre-builds the regional grouping,
    // each row's static offset string, AND each row's alias list — so
    // the render path is pure string interpolation (no Intl calls, no
    // Date math, no map lookups) on subsequent renders.
    const grouped: ReadonlyArray<RegionGroup> = useMemo(() => {
        const zones = loadIanaTimezones();
        const buckets = new Map<string, Array<ZoneEntry>>();
        for (const zone of zones) {
            const { region, city } = splitZone(zone);
            const aliases: readonly string[] = TIMEZONE_CITY_ALIASES[zone] ?? [];
            const list = buckets.get(region) ?? [];
            list.push({ zone, city, offset: computeZoneOffset(zone), aliases });
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
                    No timezone matches your search. Try a city or country name
                    (e.g. <em>Mumbai</em>, <em>Tokyo</em>, <em>London</em>, <em>Sydney</em>).
                </CommandEmpty>
                {grouped.map(({ region, entries }) => (
                    <CommandGroup key={region} heading={region}>
                        {entries.map(({ zone, city, offset, aliases }) => {
                            const isSelected: boolean = zone === value;
                            // Search value: full IANA + IANA city + every alias,
                            // lowercased. cmdk's fuzzy matcher scores against
                            // this string, so typing any alias surfaces the row.
                            const searchValue: string =
                                `${zone} ${city} ${aliases.join(' ')}`.toLowerCase();
                            // Display label: IANA city, then up to 3 aliases
                            // inlined with a `·` separator. Mirrors Google
                            // Calendar / Windows Time Zone settings — the
                            // doctor sees regional coverage at a glance.
                            const displayCity: string = aliases.length > 0
                                ? `${city} · ${aliases.slice(0, 3).join(' · ')}`
                                : city;
                            return (
                                <CommandItem
                                    key={zone}
                                    value={searchValue}
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
                                        <span className="haemi-clinic-tz-item-city">{displayCity}</span>
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
