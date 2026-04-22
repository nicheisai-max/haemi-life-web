---
trigger: always_on
---

# 🩺 HAEMI LIFE

## Official UX/UI Branding & Design System Specification

### Version 2.0 -- Web Application (Light + Dark Theme)

### Typography Updated: ROBOTO Variable

------------------------------------------------------------------------

# 1. BRAND POSITIONING

**Haemi Life** is Botswana's first fully integrated digital healthcare
ecosystem.

The UX/UI must communicate:

-   Medical authority\
-   Institutional trust\
-   Regulatory compliance\
-   Security & data protection\
-   Financial reliability\
-   Calm digital precision\
-   Premium but accessible healthcare

The interface should feel like:

> "Google-level readability meets Enterprise Healthcare Compliance."

Avoid: - Cartoonish illustrations\
- Neon hospital colors\
- Overly playful UI\
- Loud gradients\
- Heavy shadow abuse

------------------------------------------------------------------------

# 2. CORE BRAND COLOR SYSTEM

## 🌤 LIGHT THEME (NORMAL MODE)

### 🎨 Primary Brand Scale

  Token         Value
  ------------- ---------
  Primary-900   #083E44
  Primary-800   #0E6B74
  Primary-700   #148C8B
  Primary-600   #1BA7A6
  Primary-500   #3FC2B5
  Primary-400   #6ED3C4
  Primary-300   #A7E6DB
  Primary-200   #D5F6F1
  Primary-100   #ECFCFA

### Brand Gradient

    linear-gradient(135deg, #0E6B74 → #1BA7A6 → #6ED3C4)

------------------------------------------------------------------------

### 🎨 Neutral System

  Token      Value
  ---------- ---------
  Gray-900   #0F172A
  Gray-800   #1E293B
  Gray-700   #334155
  Gray-600   #475569
  Gray-500   #64748B
  Gray-400   #94A3B8
  Gray-300   #CBD5E1
  Gray-200   #E2E8F0
  Gray-100   #F1F5F9
  Gray-50    #F8FAFC

------------------------------------------------------------------------

### 🎨 Semantic Colors

  State     Color
  --------- ---------
  Success   #16A34A
  Warning   #F59E0B
  Error     #DC2626
  Info      #2563EB

------------------------------------------------------------------------

# 🌙 DARK THEME

## 🎨 Dark Foundations

  Token          Value
  -------------- ---------
  Dark-Base      #0B1214
  Dark-Surface   #0F1C1F
  Dark-Card      #14262A
  Dark-Border    #1F3B40

------------------------------------------------------------------------

## 🎨 Primary in Dark

  Token               Value
  ------------------- ----------------------
  Primary-Dark-700    #1BA7A6
  Primary-Dark-500    #3FC2B5
  Primary-Dark-Glow   rgba(63,194,181,0.4)

------------------------------------------------------------------------

# 3. TYPOGRAPHY SYSTEM (ROBOTO VARIABLE)

## Primary Font

**Roboto Variable (Google Fonts)**\
- Use `Roboto Flex` or `Roboto Variable` (wdth, wght axis enabled) -
Optimized for digital screens - Excellent Google-level readability -
Enterprise dashboard friendly - Clean and neutral tone

------------------------------------------------------------------------

## Font Implementation

### Google Fonts Import

``` html
<link href="https://fonts.googleapis.com/css2?family=Roboto:opsz,wght@8..144,100..900&display=swap" rel="stylesheet">
```

### CSS Base Setup

``` css
html {
  font-family: 'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

------------------------------------------------------------------------

## Recommended Weight Usage

  Usage                Weight
  -------------------- --------
  Body Text            400
  Labels               500
  Section Titles       600
  Headings             700
  Financial Emphasis   600
  Buttons              500

Avoid ultra-thin weights (100--300) for healthcare UI.

------------------------------------------------------------------------

## Typography Scale

  Usage        Size   Weight   Line Height
  ------------ ------ -------- -------------
  H1           40px   700      1.3
  H2           32px   700      1.3
  H3           24px   600      1.4
  H4           20px   600      1.4
  Body Large   16px   400      1.6
  Body         14px   400      1.6
  Caption      12px   400      1.5

------------------------------------------------------------------------

# 4. SPACING SYSTEM

8pt grid system.

Spacing scale: 4 / 8 / 16 / 24 / 32 / 48 / 64

------------------------------------------------------------------------

# 5. COMPONENT RULES

## Buttons

Primary: - Background: Primary-700 - Hover: Primary-800 - Radius: 8px -
Height: 44px - Font Weight: 500

Secondary: - Border: Primary-600 - Transparent background - Font Weight:
500

Danger: - Background: #DC2626

------------------------------------------------------------------------

## Cards

-   Radius: 12px
-   Subtle shadow (light mode only)
-   24px internal padding
-   Dark mode uses border separation instead of heavy shadows

------------------------------------------------------------------------

# 6. DASHBOARD STRUCTURE

All portals must follow:

-   Left sidebar (240px)
-   Top navigation
-   12-column grid layout
-   Modular card system

------------------------------------------------------------------------

# 7. STATUS BADGES

  Type        Color
  ----------- -------------
  Verified    Primary-600
  Reserved    Warning
  Expired     Error
  Dispensed   Success
  Pending     Gray-500

Badges: - Rounded (999px) - 12px font - 6px 10px padding - Font Weight:
500

------------------------------------------------------------------------

# 8. MOTION SYSTEM

-   150--250ms transitions
-   Ease-in-out
-   Subtle elevation on hover
-   No bounce animations
-   Clean fade transitions

------------------------------------------------------------------------

# 9. ACCESSIBILITY

-   WCAG AA minimum
-   Contrast ≥ 4.5
-   Keyboard navigable
-   Clear focus states

------------------------------------------------------------------------

# 10. FINAL DESIGN GOAL

Haemi Life must look like:

> Botswana's National Digital Healthcare Platform\
> Secure. Trusted. Premium.\
> Designed with Google-grade readability.
