import React, { type ReactNode } from 'react';
import { useElementSize } from '@/hooks/use-element-size';

/**
 * 🛡️ HAEMI LIFE — ChartMountGate
 *
 * Defers the rendering of a Recharts subtree until the wrapper element
 * has been measured at non-zero dimensions by `ResizeObserver`. Replaces
 * the previous `setTimeout(setIsMounted, 300)` band-aid that was
 * insufficient when the chart's parent was wrapped in a Framer Motion
 * spring entrance — those animations exceed 300 ms in practice, so the
 * chart was still mounting against a 0-width parent and emitting the
 * `width(-1) and height(-1) of chart should be greater than 0` warning.
 *
 * Architecture:
 *   1. The wrapper `<div>` always renders (the `.haemi-chart-frame`
 *      class gives it a stable `width: 100%; height: 21.875rem` so the
 *      grid layout reserves space immediately — no CLS on first paint).
 *   2. `useElementSize` attaches a `ResizeObserver` and reports the
 *      wrapper's measured `contentRect`.
 *   3. Once `width > 0 && height > 0`, the gate flips and the Recharts
 *      subtree mounts — guaranteed to measure a stable parent.
 *   4. Until then, the supplied `fallback` (typically a skeleton)
 *      renders inside the same wrapper so the visual height is held.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Children are typed `ReactNode` so the gate is composable with
 *     any chart subtree, generic or not.
 *   - All visual concerns in `index.css` (`.haemi-chart-frame` class).
 *     No inline styles, no px values, no hardcoded colours.
 */

export interface ChartMountGateProps {
    /**
     * Rendered while the gate is closed (parent measured at zero size).
     * Typically a skeleton matching the chart's eventual height.
     */
    readonly fallback: ReactNode;

    /**
     * Rendered once the gate is open (parent measured at non-zero
     * `width` AND `height`). The Recharts subtree goes here.
     */
    readonly children: ReactNode;

    /**
     * Optional CSS class override for the wrapper. Defaults to
     * `haemi-chart-frame` (defined in `index.css`). Override only when
     * a chart variant needs a non-standard frame; otherwise the
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
            {isReady ? children : fallback}
        </div>
    );
};
