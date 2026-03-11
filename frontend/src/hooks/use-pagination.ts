import { useState, useMemo, useCallback } from 'react';

const DEFAULT_PAGE_SIZE = 10;

export interface UsePaginationReturn<T> {
    /** The currently visible page number (always clamped to valid range). */
    currentPage: number;
    /** Stable setter — safe to use in useEffect dependency arrays. */
    setCurrentPage: (page: number) => void;
    /** Stable reset — goes back to page 1. Safe in useEffect dep arrays. */
    resetPage: () => void;
    totalPages: number;
    paginatedData: T[];
    /** True only when totalItems > itemsPerPage — drives auto-hide logic. */
    showPagination: boolean;
    totalItems: number;
    /** 0-based index of the first item on the current page. */
    startIndex: number;
    /** 0-based index (exclusive) of the last item on the current page. */
    endIndex: number;
}

/**
 * Enterprise-grade pagination hook for Haemi Life.
 *
 * - All returned functions are stable (useCallback-memoized).
 * - `currentPage` is always clamped so it never exceeds `totalPages`.
 * - `showPagination` is true only when `data.length > itemsPerPage`.
 * - Safe to call unconditionally at the top of any component — no early-return
 *   violations of React Rules of Hooks.
 */
export function usePagination<T>(
    data: T[],
    itemsPerPage: number = DEFAULT_PAGE_SIZE
): UsePaginationReturn<T> {
    const [currentPage, setCurrentPageInternal] = useState(1);

    const totalItems = data.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const showPagination = totalItems > itemsPerPage;

    // Clamp so stale page values never go out of range after data changes.
    const safePage = Math.min(currentPage, totalPages);

    const startIndex = (safePage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const paginatedData = useMemo(
        () => data.slice(startIndex, endIndex),
        [data, startIndex, endIndex]
    );

    /**
     * Stable page setter — clamped to [1, totalPages].
     * Re-memoized only when totalPages changes, which is acceptable.
     */
    const setCurrentPage = useCallback(
        (page: number) => {
            const clamped = Math.max(1, Math.min(page, totalPages));
            setCurrentPageInternal(clamped);
        },
        [totalPages]
    );

    /**
     * Stable reset to page 1 — the raw useState setter is always stable,
     * so this function reference never changes across renders.
     */
    const resetPage = useCallback(() => {
        setCurrentPageInternal(1);
    }, []);

    return {
        currentPage: safePage,
        setCurrentPage,
        resetPage,
        totalPages,
        paginatedData,
        showPagination,
        totalItems,
        startIndex,
        endIndex,
    };
}
