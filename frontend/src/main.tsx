import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { logger } from './utils/logger'

// INSTITUTIONAL BOOTSTRAP: Capture precise start time for network layer grace periods
window.__HAEMI_BOOT_TIME__ = Date.now();

import './styles/brand.css'
import '@fontsource/roboto/100.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/900.css';
// Signature Fonts locally imported
import '@fontsource/great-vibes';
import '@fontsource/sacramento';
import '@fontsource/allura';
import App from './app.tsx'

// DEFENSIVE SAFEGUARD: Hard-block PWA installability signals
// This prevents the 'beforeinstallprompt' event from propagating,
// ensuring the browser never shows an automated install banner.
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  return false;
});

// ─── INSTITUTIONAL THIRD-PARTY NOISE FILTER ──────────────────────────────────
//
// Some browser extensions (password managers, grammar tools, dev-extensions
// like React DevTools' background bridge) post promise-rejections into the
// host page when their own background script is unavailable. The most common
// pattern is `chrome.runtime.sendMessage` reporting:
//
//   "Could not establish connection. Receiving end does not exist."
//
// These rejections are NOT originated by Haemi Life code (we ship no Chrome
// extension), they cannot be fixed by us, and they pollute the developer
// console — masking real application errors. We intercept ONLY this
// well-known third-party signature, log it once at debug level for
// traceability, and let every other rejection propagate untouched so real
// errors stay visible to error-monitoring and to the engineer.
//
// Strict posture:
//   - Pattern match is intentionally narrow (regex on the exact phrase).
//     A single false-positive here would silently swallow a real bug, so
//     the bar for adding patterns is "documented third-party origin only".
//   - `event.reason` crosses an `unknown` boundary; narrowed structurally,
//     no `any`, no `as unknown as` double-cast.
//   - All output via project `logger` (zero `console.*`).

const KNOWN_THIRD_PARTY_REJECTION_PATTERNS: ReadonlyArray<RegExp> = [
    // Chrome extension messaging API — background script unreachable.
    // Signature: chrome.runtime.sendMessage / chrome.tabs.sendMessage from
    // any extension whose service worker has unloaded.
    /Could not establish connection\. Receiving end does not exist\./i,
];

const extractRejectionMessage = (reason: unknown): string | null => {
    if (reason instanceof Error) return reason.message;
    if (typeof reason === 'string') return reason;
    if (reason !== null && typeof reason === 'object' && 'message' in reason) {
        // After `'message' in reason`, TS narrows to `object & { message: unknown }` —
        // direct property access is type-safe with no cast.
        const { message: candidate } = reason;
        if (typeof candidate === 'string') return candidate;
    }
    return null;
};

const isKnownThirdPartyNoise = (reason: unknown): boolean => {
    const message = extractRejectionMessage(reason);
    if (message === null) return false;
    return KNOWN_THIRD_PARTY_REJECTION_PATTERNS.some((pattern) => pattern.test(message));
};

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (isKnownThirdPartyNoise(event.reason)) {
        event.preventDefault();
        const suppressedMessage = extractRejectionMessage(event.reason) ?? '<non-string reason>';
        logger.debug('[Global] Suppressed third-party promise rejection', {
            message: suppressedMessage,
            origin: 'browser-extension',
        });
    }
    // Otherwise: do nothing — let the rejection propagate so real errors
    // remain visible to the developer console and to error-monitoring.
});

import { BrowserRouter } from 'react-router-dom';
import { GlobalLoaderProvider } from './context/global-loader-context';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root mount point #root not found in document; index.html is misconfigured.');
}
createRoot(rootElement).render(
  <StrictMode>
    <GlobalLoaderProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GlobalLoaderProvider>
  </StrictMode>,
)
