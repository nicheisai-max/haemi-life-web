import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 🛡️ HAEMI LIFE — useElementSize
 *
 * Reports the measured `{ width, height }` of a DOM element via
 * `ResizeObserver`. Returned as `{ ref, size }`: the consumer attaches
 * the `ref` callback to the element they want measured; the hook keeps
 * `size` in sync with that element's `contentRect`.
 *
 * Why a ref-callback, not a `RefObject`:
 *   - A `useRef`-style object does not invoke any callback when the
 *     attached node changes, so a ResizeObserver wired up inside a
 *     `useEffect` against `ref.current` cannot reliably re-attach when
 *     the consumer's render produces a different node identity. A ref
 *     CALLBACK fires synchronously on attach and detach, giving us a
 *     deterministic point to start / stop observing.
 *   - The same pattern is used in production by Vercel, Notion, and the
 *     RadixUI / floating-ui ecosystem for measure-on-mount needs.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Generic over `T extends HTMLElement` so the consumer's ref is
 *     typed precisely (e.g. `HTMLDivElement`, not just `HTMLElement`).
 *   - No `console.*`. The hook never throws; if `ResizeObserver` is
 *     unavailable in some legacy runtime, the consumer simply observes
 *     a frozen `{ width: 0, height: 0 }` and renders its fallback —
 *     graceful degradation rather than a hard failure.
 */

export interface ElementSize {
    readonly width: number;
    readonly height: number;
}

export interface UseElementSizeResult<T extends HTMLElement> {
    /** Ref callback to attach to the element under measurement. */
    readonly ref: (node: T | null) => void;
    /** Latest measured `contentRect` of that element; `{0,0}` until first observation. */
    readonly size: ElementSize;
}

const ZERO_SIZE: ElementSize = Object.freeze({ width: 0, height: 0 });

export function useElementSize<T extends HTMLElement>(): UseElementSizeResult<T> {
    const [size, setSize] = useState<ElementSize>(ZERO_SIZE);
    const observerRef = useRef<ResizeObserver | null>(null);

    const ref = useCallback((node: T | null): void => {
        // Disconnect any prior observer before attaching to a new node.
        // Critical for HMR + concurrent React, where the same ref
        // callback may be invoked with `null` (detach) followed by the
        // new node identity (attach) within the same effect tick.
        if (observerRef.current !== null) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (node === null) return;

        // Defensive: in environments lacking `ResizeObserver` (very old
        // browsers, certain test runners), bail with a frozen zero size
        // so consumers render their fallback rather than crashing.
        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry === undefined) return;
            const { width, height } = entry.contentRect;
            setSize({ width, height });
        });
        observer.observe(node);
        observerRef.current = observer;
    }, []);

    useEffect(() => {
        // Cleanup on unmount: ensures the observer is disconnected even
        // if the ref callback was never invoked with `null` (e.g. when
        // a parent unmount happens before the child's detach phase).
        return () => {
            if (observerRef.current !== null) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    }, []);

    return { ref, size };
}
