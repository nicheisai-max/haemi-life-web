# CSS GUARDRAIL SYSTEM — HAEMI LIFE

This document is the **single source of truth** for all CSS modifications in the Haemi Life project. Every AI agent must read and adhere to these rules before making any changes to the CSS codebase.

## 🚨 CSS SAFETY RULES (ULTRA-STRICT)

### 1. Never Target Tailwind Utility Classes
Tailwind utility classes control the structural floor of the application and must never be overridden.
**Forbidden Selectors:**
- `.fixed`, `.absolute`, `.relative`, `.static`, `.sticky`
- `.flex`, `.grid`, `.inline-flex`, `.block`, `.inline-block`
- `.bottom-*`, `.top-*`, `.left-*`, `.right-*`
- `.z-*`, `.p-*`, `.m-*`, `.w-*`, `.h-*`

### 2. Mandatory Component-Level Selectors
Only use high-level, component-scoped semantic class names.
**Allowed Pattern:** `.component-name` or `.component-child-name`
**Example (Chat Footer):**
- `.chat-footer`
- `.chat-input-wrapper`
- `.chat-send-button`
- `.chat-attachment-button`

### 3. Protected Container Layout Elements
Never modify selectors that define the core application shells or complex layout containers.
**Forbidden Component Targets:**
- `.chat-widget`
- `.chat-container`
- `.chat-window`
- `.message-list`
- `.dashboard-shell`
- `.sidebar-container`

### 4. Forbidden CSS Techniques
To maintain institutional trust and digital precision, the following are strictly prohibited:
- `!important` (Unless overriding a 3rd party library where no other choice exists)
- `clip-path`
- `mask`
- `radial-gradient` overlays (for layout manipulation)
- Absolute-positioned pseudo-elements (that affect flow)

### 5. Measurement Standards
Only relative units are permitted to ensure accessibility and responsive adaptability.
- `rem` (Primary for sizing and spacing)
- `em` (For text-relative adjustments)
- `%` (For fluid dimensions)
- **Forbidden:** `px` (except for 1px borders or specific legacy overrides)

### 6. Responsive Integrity
CSS must never break responsive layouts. Ensure continuity across:
- Small screens (Mobile)
- Tablet screens
- Large screens (Desktop)

---
**ENFORCEMENT PROTOCOL:**
1. READ this file.
2. VALIDATE proposed selectors against these rules.
3. REJECT any modification that targets utility classes or container layouts.
4. CONFIRM component-scoped compliance in the verification report.
