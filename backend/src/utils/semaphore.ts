/**
 * HAEMI LIFE — IN-PROCESS CONCURRENCY LIMITER
 *
 * Tiny zero-dependency semaphore for capping concurrent execution of
 * expensive async work (Gemini scorer calls, S3 uploads, etc.) without
 * pulling in `p-limit` or `bottleneck`. The implementation is FIFO —
 * waiters resolve in the order they called `acquire()`, which keeps
 * tail-latency predictable under burst load.
 *
 * Usage:
 *
 *   const limiter = createSemaphore(10);
 *   const result = await limiter.run(() => callGeminiApi(prompt));
 *
 * `run` is the recommended entry point: it acquires before the
 * function runs and releases in a `finally` block, so an exception
 * inside the wrapped work never leaks a permit. The lower-level
 * `acquire` / `release` pair is exposed for callers that need
 * fine-grained control (e.g. holding a permit across multiple awaits).
 *
 * Strict-TS posture:
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`
 *   - Result type narrowed via generic `T`; the limiter is transparent
 *     to the wrapped function's return type
 *
 * Failure model:
 *   - `acquire` never rejects — it waits until a permit becomes available
 *   - `release` is idempotent in spirit but should be called exactly once
 *     per acquire; double-release would corrupt the counter, so callers
 *     are expected to use the `run` wrapper unless they have a specific
 *     reason not to
 */

export interface Semaphore {
    /** Wait until a permit is available, then take one. */
    readonly acquire: () => Promise<void>;
    /** Return a permit to the pool, releasing the next waiter (if any). */
    readonly release: () => void;
    /** Run `fn` under a permit; releases automatically on resolve or reject. */
    readonly run: <T>(fn: () => Promise<T>) => Promise<T>;
    /** Permits currently held by callers. Read-only; for diagnostics. */
    readonly inFlight: () => number;
    /** Waiters currently queued. Read-only; for diagnostics. */
    readonly queued: () => number;
}

export const createSemaphore = (maxConcurrent: number): Semaphore => {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent <= 0) {
        throw new Error(`[Semaphore] maxConcurrent must be a positive integer; received ${String(maxConcurrent)}`);
    }

    let held: number = 0;
    const waiters: Array<() => void> = [];

    const acquire = (): Promise<void> => {
        if (held < maxConcurrent) {
            held += 1;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            waiters.push(() => {
                held += 1;
                resolve();
            });
        });
    };

    const release = (): void => {
        held -= 1;
        const next = waiters.shift();
        if (next !== undefined) next();
    };

    const run = async <T>(fn: () => Promise<T>): Promise<T> => {
        await acquire();
        try {
            return await fn();
        } finally {
            release();
        }
    };

    const inFlight = (): number => held;
    const queued = (): number => waiters.length;

    return { acquire, release, run, inFlight, queued };
};
