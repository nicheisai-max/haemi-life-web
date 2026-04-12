import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    startIndex: number;
    endIndex: number;
    showPagination: boolean;
    onPageChange: (page: number) => void;
    itemLabel?: string;
}

/**
 * Smart pagination component for Haemi Life tables.
 * Automatically hides when totalItems <= 10 (showPagination = false).
 * Uses only hl-pagination-* CSS classes defined in index.css.
 */
export const TablePagination: React.FC<TablePaginationProps> = ({
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    showPagination,
    onPageChange,
    itemLabel = 'records',
}) => {
    if (!showPagination) return null;

    // Build visible page numbers with ellipsis logic
    const getPageNumbers = (): (number | 'ellipsis')[] => {
        const delta = 1; // pages to show around current
        const range: number[] = [];
        const pages: (number | 'ellipsis')[] = [];

        for (
            let i = Math.max(2, currentPage - delta);
            i <= Math.min(totalPages - 1, currentPage + delta);
            i++
        ) {
            range.push(i);
        }

        pages.push(1);

        if (range.length > 0) {
            if (range[0] > 2) {
                // If only one page (2) is missing, show it instead of ellipsis
                if (range[0] === 3) pages.push(2);
                else pages.push('ellipsis');
            }

            range.forEach(p => pages.push(p));

            if (range[range.length - 1] < totalPages - 1) {
                // If only one page (totalPages - 1) is missing, show it instead of ellipsis
                if (range[range.length - 1] === totalPages - 2) pages.push(totalPages - 1);
                else pages.push('ellipsis');
            }
        } else if (totalPages > 1) {
            // If totalPages is 3 and current is 1 or 3, range might be empty if we don't handle it
            // But with delta=1, for totalPages=3, currentPage=1: rangeStart=2, rangeEnd=2, range=[2].
            // If range is empty, it means we only have 1 and totalPages or just 1.
            if (totalPages > 2) pages.push('ellipsis');
        }

        if (totalPages > 1) pages.push(totalPages);

        return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="hl-pagination">
            {/* Row info */}
            <span className="hl-pagination-info">
                Showing {startIndex + 1}–{endIndex} of {totalItems} {itemLabel}
            </span>

            {/* Prev button */}
            <button
                className="hl-pagination-btn"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
            >
                <ChevronLeft className="hl-pagination-icon" aria-hidden="true" />
            </button>

            {/* Page numbers */}
            {pageNumbers.map((page, idx) =>
                page === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="hl-pagination-ellipsis" aria-hidden="true">
                        ···
                    </span>
                ) : (
                    <button
                        key={page}
                        className={`hl-pagination-btn${currentPage === page ? ' active' : ''}`}
                        onClick={() => onPageChange(page)}
                        aria-label={`Page ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                    >
                        {page}
                    </button>
                )
            )}

            {/* Next button */}
            <button
                className="hl-pagination-btn"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
            >
                <ChevronRight className="hl-pagination-icon" aria-hidden="true" />
            </button>
        </div>
    );
};
