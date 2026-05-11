import React, { useCallback, useMemo, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import type {
    PatientRegistryAdvancedFilters,
    PatientRegistrySortKey,
    PatientRegistrySortOrder,
} from '@/services/doctor.service';
import { countActiveAdvancedFilters } from './advanced-filter-utils';

/**
 * 🩺 HAEMI LIFE — ADVANCED FILTER DRAWER
 *
 * Side sheet that lets a doctor refine the registry by age, gender, blood
 * group, minimum visit count, last-visit date range, and sort dimension.
 * Every dimension is independent — a missing value short-circuits that
 * dimension server-side. The drawer is dumb: it only collects values and
 * hands them back via `onApply`. URL state sync, refetch, and chip badge
 * counts stay in the registry page.
 *
 * The inner form (`AdvancedFilterForm`) is rendered conditionally on
 * `open` so its `useState` initializers hydrate from `initialFilters`
 * on every open transition — no effect-based prop-sync needed.
 */

interface AdvancedFilterDrawerProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly initialFilters: PatientRegistryAdvancedFilters;
    readonly onApply: (filters: PatientRegistryAdvancedFilters) => void;
    readonly onReset: () => void;
}

const GENDER_OPTIONS: ReadonlyArray<{ value: 'male' | 'female' | 'other'; label: string }> = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
];

const BLOOD_GROUPS: ReadonlyArray<'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'> = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

const SORT_OPTIONS: ReadonlyArray<{ value: PatientRegistrySortKey; label: string }> = [
    { value: 'last-visit', label: 'Most recent visit' },
    { value: 'name', label: 'Patient name' },
    { value: 'total-visits', label: 'Most visits' },
    { value: 'age', label: 'Age' },
];

const ORDER_OPTIONS: ReadonlyArray<{ value: PatientRegistrySortOrder; label: string }> = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' },
];

/** Sentinel used for Select "any" rows — Radix Select disallows empty
 *  string values, so we use this marker and convert back to `undefined`
 *  at the wire boundary. */
const ANY = '__any__';

interface AdvancedFilterFormProps {
    readonly initialFilters: PatientRegistryAdvancedFilters;
    readonly onApply: (filters: PatientRegistryAdvancedFilters) => void;
    readonly onReset: () => void;
    readonly onCancel: () => void;
}

const AdvancedFilterForm: React.FC<AdvancedFilterFormProps> = ({
    initialFilters,
    onApply,
    onReset,
    onCancel,
}) => {
    const [ageMin, setAgeMin] = useState<string>(
        initialFilters.ageMin !== undefined ? String(initialFilters.ageMin) : ''
    );
    const [ageMax, setAgeMax] = useState<string>(
        initialFilters.ageMax !== undefined ? String(initialFilters.ageMax) : ''
    );
    const [gender, setGender] = useState<string>(initialFilters.gender ?? ANY);
    const [bloodGroup, setBloodGroup] = useState<string>(initialFilters.bloodGroup ?? ANY);
    const [minVisits, setMinVisits] = useState<string>(
        initialFilters.minVisits !== undefined ? String(initialFilters.minVisits) : ''
    );
    const [lastVisitFrom, setLastVisitFrom] = useState<string>(initialFilters.lastVisitFrom ?? '');
    const [lastVisitTo, setLastVisitTo] = useState<string>(initialFilters.lastVisitTo ?? '');
    const [sort, setSort] = useState<PatientRegistrySortKey>(initialFilters.sort ?? 'last-visit');
    const [order, setOrder] = useState<PatientRegistrySortOrder>(initialFilters.order ?? 'desc');

    const handleApply = useCallback((): void => {
        const next: PatientRegistryAdvancedFilters = {};
        const parsedAgeMin: number = Number(ageMin);
        const parsedAgeMax: number = Number(ageMax);
        const parsedMinVisits: number = Number(minVisits);
        if (ageMin.length > 0 && Number.isFinite(parsedAgeMin)) next.ageMin = parsedAgeMin;
        if (ageMax.length > 0 && Number.isFinite(parsedAgeMax)) next.ageMax = parsedAgeMax;
        if (gender !== ANY) next.gender = gender as 'male' | 'female' | 'other';
        if (bloodGroup !== ANY) next.bloodGroup = bloodGroup as PatientRegistryAdvancedFilters['bloodGroup'];
        if (minVisits.length > 0 && Number.isFinite(parsedMinVisits)) next.minVisits = parsedMinVisits;
        if (lastVisitFrom.length > 0) next.lastVisitFrom = lastVisitFrom;
        if (lastVisitTo.length > 0) next.lastVisitTo = lastVisitTo;
        next.sort = sort;
        next.order = order;
        onApply(next);
    }, [ageMin, ageMax, gender, bloodGroup, minVisits, lastVisitFrom, lastVisitTo, sort, order, onApply]);

    const activeCount: number = useMemo(
        () => countActiveAdvancedFilters({
            ageMin: ageMin.length > 0 ? Number(ageMin) : undefined,
            ageMax: ageMax.length > 0 ? Number(ageMax) : undefined,
            gender: gender !== ANY ? (gender as 'male' | 'female' | 'other') : undefined,
            bloodGroup: bloodGroup !== ANY
                ? (bloodGroup as PatientRegistryAdvancedFilters['bloodGroup'])
                : undefined,
            minVisits: minVisits.length > 0 ? Number(minVisits) : undefined,
            lastVisitFrom: lastVisitFrom.length > 0 ? lastVisitFrom : undefined,
            lastVisitTo: lastVisitTo.length > 0 ? lastVisitTo : undefined,
        }),
        [ageMin, ageMax, gender, bloodGroup, minVisits, lastVisitFrom, lastVisitTo]
    );

    return (
        <>
            <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
                    Advanced filters
                    {activeCount > 0 ? (
                        <Badge variant="secondary" className="ml-1">
                            {activeCount}
                        </Badge>
                    ) : null}
                </SheetTitle>
                <SheetDescription>
                    Narrow your patient panel by demographics, visit history, and ordering. Each filter is independent —
                    leave any field empty to skip it.
                </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 mt-4">
                <div className="space-y-2">
                    <Label>Age range</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            type="number"
                            min={0}
                            max={150}
                            placeholder="Min age"
                            value={ageMin}
                            onChange={(e) => setAgeMin(e.target.value)}
                        />
                        <Input
                            type="number"
                            min={0}
                            max={150}
                            placeholder="Max age"
                            value={ageMax}
                            onChange={(e) => setAgeMax(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger>
                            <SelectValue placeholder="Any gender" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY}>Any gender</SelectItem>
                            {GENDER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Blood group</Label>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}>
                        <SelectTrigger>
                            <SelectValue placeholder="Any blood group" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY}>Any blood group</SelectItem>
                            {BLOOD_GROUPS.map((bg) => (
                                <SelectItem key={bg} value={bg}>
                                    {bg}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Minimum visits</Label>
                    <Input
                        type="number"
                        min={1}
                        max={10000}
                        placeholder="e.g. 3"
                        value={minVisits}
                        onChange={(e) => setMinVisits(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Last visit between</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            type="date"
                            value={lastVisitFrom}
                            onChange={(e) => setLastVisitFrom(e.target.value)}
                            aria-label="Last visit from"
                        />
                        <Input
                            type="date"
                            value={lastVisitTo}
                            onChange={(e) => setLastVisitTo(e.target.value)}
                            aria-label="Last visit to"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>Sort by</Label>
                        <Select value={sort} onValueChange={(v) => setSort(v as PatientRegistrySortKey)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SORT_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Order</Label>
                        <Select value={order} onValueChange={(v) => setOrder(v as PatientRegistrySortOrder)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ORDER_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <SheetFooter className="border-t pt-4 mt-4 flex-row gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={onReset}>
                    <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                    Reset
                </Button>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleApply}>
                        Apply filters
                    </Button>
                </div>
            </SheetFooter>
        </>
    );
};

export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({
    open,
    onOpenChange,
    initialFilters,
    onApply,
    onReset,
}) => {
    const handleApply = useCallback((filters: PatientRegistryAdvancedFilters): void => {
        onApply(filters);
        onOpenChange(false);
    }, [onApply, onOpenChange]);

    const handleReset = useCallback((): void => {
        onReset();
        onOpenChange(false);
    }, [onReset, onOpenChange]);

    const handleCancel = useCallback((): void => {
        onOpenChange(false);
    }, [onOpenChange]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0">
                {/* Mount the form only while the sheet is open so the inner
                    `useState` initializers re-derive from `initialFilters`
                    on each open transition — no effect-based prop sync. */}
                {open ? (
                    <AdvancedFilterForm
                        initialFilters={initialFilters}
                        onApply={handleApply}
                        onReset={handleReset}
                        onCancel={handleCancel}
                    />
                ) : null}
            </SheetContent>
        </Sheet>
    );
};
