import { useContext } from 'react';
import {
    ClinicalCopilotContext,
    type ClinicalCopilotContextValue,
} from '../context/clinical-copilot-context-def';

/**
 * 🩺 HAEMI LIFE — CLINICAL COPILOT TOGGLE CONSUMER HOOK
 *
 * Returns `{ enabled, isHydrated }` from `<ClinicalCopilotProvider>`.
 * Throws a descriptive error when used outside the provider — same
 * pattern as `useAuth`, `useToast`, `usePlatformTimezone` — so the
 * misconfiguration surfaces at mount time in dev, never silently.
 */
export const useClinicalCopilot = (): ClinicalCopilotContextValue => {
    const ctx = useContext(ClinicalCopilotContext);
    if (ctx === undefined) {
        throw new Error(
            '[useClinicalCopilot] No ClinicalCopilotProvider found in the tree. '
            + 'Wrap the authenticated clinical layout with <ClinicalCopilotProvider> in app.tsx.'
        );
    }
    return ctx;
};
