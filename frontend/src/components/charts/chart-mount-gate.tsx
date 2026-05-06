import React, { type ReactNode } from 'react';
import { useElementSize, type ElementSize } from '@/hooks/use-element-size';

/**
 * 🛡️ HAEMI LIFE — ChartMountGate (Google/Meta Grade)
 *
 * Two-layer responsibility:
 *
 *   1. Mount discipline — defers the rendering of a Recharts subtree
 *      until the wrapper element has been measured at non-zero
 *      dimensions by `ResizeObserver`. This eliminates the family of
 *      `width(-1)/height(-1)` warnings caused by Recharts' own
 *      `ResponsiveContainer` measuring a not-yet-laid-out parent.
 *
 *   2. Dimension hand-off — exposes the measured `{ width, height }`
 *      to its children via a render-prop. Consumers MUST pass these
 *      dimensions to Recharts' `<ResponsiveContainer initialDimension>`
 *      so the chart's INTERNAL initial state (which Recharts otherwise
 *      defaults to `{ width: -1, height: -1 }` and warns about) is
 *      seeded with real values from frame 1. Without this hand-off,
 *      the warning fires once on every chart mount even when the
 *      parent is already measured — the warning is internal to
 *      Recharts and independent of parent measurement.
 *
 * Architecture:
 *   1. The wrapper `<div>` always renders (its frame class — defaults
 *      to `.haemi-chart-frame`, override via `className` — gives it a
 *      stable rem-based width × height so the grid layout reserves
 *      space immediately, no CLS on first paint).
 *   2. `useElementSize` attaches a `ResizeObserver` and reports the
 *      wrapper's measured `contentRect`.
 *   3. Once `width > 0 && height > 0`, the gate flips and the children
 *      function is called with the measured size. The Recharts subtree
 *      mounts at that moment — guaranteed to measure a stable parent
 *      AND seeded with non-negative initial dimensions internally.
 *   4. Until then, the supplied `fallback` (typically a skeleton)
 *      renders inside the same wrapper so the visual height is held.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Children is typed as a function `(size: ElementSize) => ReactNode`
 *     so consumers MUST destructure the size — the API itself enforces
 *     the dimension hand-off contract at compile time. The previous
 *     `ReactNode` form is intentionally NOT supported; the migration
 *     is mechanical (one wrapper line per call site) and gives every
 *     chart correct initial dimensions for free.
 *   - All visual concerns in `index.css` (`.haemi-chart-frame*` class).
 *     No inline styles, no px values, no hardcoded colours.
 *
 * Usage:
 *   <ChartMountGate fallback={<Skeleton />} className="haemi-chart-frame--md">
 *     {(size) => (
 *       <ResponsiveContainer
 *         width="100%"
 *         height="100%"
 *         initialDimension={size}
 *       >
 *         <AreaChart>...</AreaChart>
 *       </ResponsiveContainer>
 *     )}
 *   </ChartMountGate>
 */

export interface ChartMountGateProps {
    /**
     * Rendered while the gate is closed (parent measured at zero size).
     * Typically a skeleton matching the chart's eventual height.
     */
    readonly fallback: ReactNode;

    /**
     * Render-prop. Invoked once the wrapper has been measured at
     * non-zero `{ width, height }`. The Recharts subtree goes here.
     * Consumers MUST pass `size` to `<ResponsiveContainer initialDimension>`
     * so Recharts does not warn about its internal `-1` default.
     */
    readonly children: (size: ElementSize) => ReactNode;

    /**
     * Optional CSS class override for the wrapper. Defaults to
     * `haemi-chart-frame` (defined in `index.css`). Override only when
     * a chart variant needs a non-standard frame size; otherwise the
     * default keeps every chart on the same sizing contract.
     */
    readonly className?: string;
}

const DEFAULT_FRAME_CLASS = 'haemi-chart-frame';

export const ChartMountGate: React.FC<ChartMountGateProps> = ({
    fallback,
    children,
    className,
}) => {
    const { ref, size } = useElementSize<HTMLDivElement>();
    const isReady: boolean = size.width > 0 && size.height > 0;
    const frameClass: string =
        className !== undefined && className.length > 0
            ? className
            : DEFAULT_FRAME_CLASS;

    return (
        <div ref={ref} className={frameClass}>
            {isReady ? children(size) : fallback}
        </div>
    );
};
