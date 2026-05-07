import React from 'react';
import { SuspenseLoaderTrigger } from '@/context/global-loader-context';

/**
 * Suspense-fallback shim. Renders nothing visible; on mount it activates
 * the application's single persistent loader via the global provider,
 * and on unmount it releases the request — same DOM stays live across
 * the suspend/resume cycle, so no entrance animation replays.
 */
export const DelayedFallback: React.FC = () => {
    return <SuspenseLoaderTrigger message="Securing clinical data..." />;
};
