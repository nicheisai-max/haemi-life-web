// Phase 3 — Timezone Sovereignty.
//
// `Intl.supportedValuesOf` is part of ECMAScript 2022 (proposal stage 4
// — finalized) and is implemented across Chrome 99+, Firefox 93+,
// Safari 15.4+, and Node 18+. The shipped TypeScript lib for this
// project targets ES2020 (see `frontend/tsconfig.json` -> `lib`), which
// pre-dates this addition. Rather than upgrading the global lib (which
// could surface unrelated type drift across the codebase), we declare
// the API surface we actually use here. The implementation is provided
// by the runtime; this file only teaches the compiler about it.
declare namespace Intl {
    function supportedValuesOf(
        key: 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit'
    ): string[];
}
