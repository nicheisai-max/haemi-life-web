import type { PatientRegistryAdvancedFilters } from '@/services/doctor.service';

/**
 * Count how many advanced filter dimensions are set. Surfaced as a badge
 * on the drawer's trigger button so the doctor can see at a glance
 * whether the registry is filtered. Lives outside the drawer component
 * file so Fast Refresh stays clean (the drawer file only exports
 * components).
 */
export const countActiveAdvancedFilters = (f: PatientRegistryAdvancedFilters): number => {
    let n = 0;
    if (f.ageMin !== undefined) n += 1;
    if (f.ageMax !== undefined) n += 1;
    if (f.gender !== undefined) n += 1;
    if (f.bloodGroup !== undefined) n += 1;
    if (f.minVisits !== undefined) n += 1;
    if (f.lastVisitFrom !== undefined && f.lastVisitFrom.length > 0) n += 1;
    if (f.lastVisitTo !== undefined && f.lastVisitTo.length > 0) n += 1;
    return n;
};
