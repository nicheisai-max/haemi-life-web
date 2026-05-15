import { createContext } from 'react';

/**
 * 🩺 HAEMI LIFE — CLINICAL COPILOT TOGGLE CONTEXT (definition only)
 *
 * Definition-only module so the `react-refresh/only-export-components`
 * rule stays clean: the Provider component lives in
 * `clinical-copilot-context.tsx`; the consumer hook lives in
 * `hooks/use-clinical-copilot.ts`; the type + `createContext` live
 * here.
 *
 * The context value carries the live admin-controlled enabled flag
 * + a hydration boolean so consumers (the doctor copilot widget,
 * the admin toggle UI) can wait for the first fetch to resolve
 * before rendering against a possibly-stale optimistic default.
 */
export interface ClinicalCopilotContextValue {
    /**
     * `true` when the admin has the copilot enabled (default state for
     * backward compat). During the hydration window before the
     * `/api/platform/clinical-copilot-enabled` fetch resolves, this
     * surfaces `true` optimistically so the doctor's chat UI doesn't
     * flash a "disabled" banner on every page load.
     */
    readonly enabled: boolean;
    /**
     * `true` once the initial GET has resolved (successfully or
     * otherwise). Consumers that need to gate UX on the live value
     * (the admin toggle's "current state" display, the doctor banner)
     * read this flag before acting.
     */
    readonly isHydrated: boolean;
}

export const ClinicalCopilotContext = createContext<ClinicalCopilotContextValue | undefined>(
    undefined,
);
