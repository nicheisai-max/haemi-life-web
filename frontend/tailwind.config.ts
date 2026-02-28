import type { Config } from "tailwindcss";

export default {
    darkMode: "class",
    content: [
        "./pages/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./app/**/*.{ts,tsx}",
        "./src/**/*.{ts,tsx}",
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                sans: ["Roboto", "sans-serif"],
            },
            fontSize: {
                // Hierarchical Scale
                "h1": ["var(--font-h1)", { lineHeight: "var(--lh-h1)", letterSpacing: "-0.02em", fontWeight: "700" }],
                "h2": ["var(--font-h2)", { lineHeight: "var(--lh-h2)", letterSpacing: "-0.01em", fontWeight: "700" }],
                "h3": ["var(--font-h3)", { lineHeight: "var(--lh-h3)", letterSpacing: "-0.01em", fontWeight: "600" }],
                "h4": ["var(--font-h4)", { lineHeight: "var(--lh-h4)", letterSpacing: "0em", fontWeight: "600" }],
                "h5": ["var(--font-h5)", { lineHeight: "var(--lh-body)", letterSpacing: "0em", fontWeight: "500" }],
                "h6": ["var(--font-h6)", { lineHeight: "var(--lh-body)", letterSpacing: "0.01em", fontWeight: "500" }],
            },
            colors: {
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "var(--primary-foreground)",
                    900: "var(--primary-900)",
                    800: "var(--primary-800)",
                    700: "var(--primary-700)",
                    600: "var(--primary-600)",
                    500: "var(--primary-500)",
                    400: "var(--primary-400)",
                    300: "var(--primary-300)",
                    200: "var(--primary-200)",
                    100: "var(--primary-100)",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "var(--secondary-foreground)",
                },
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)",
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                popover: {
                    DEFAULT: "var(--popover)",
                    foreground: "var(--popover-foreground)",
                },
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                card: "0.75rem",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
            transitionDuration: {
                "fast": "150ms",
                "medium": "250ms",
                "slow": "300ms",
            },
            transitionTimingFunction: {
                "premium": "cubic-bezier(0.25, 0.1, 0.25, 1.0)",
                "standard": "cubic-bezier(0.4, 0.0, 0.2, 1)",
            },
            boxShadow: {
                "elevation-rest": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                "elevation-hover": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                "elevation-glow": "0 4px 20px -4px rgba(27, 167, 166, 0.3)",
            },
        },
    },
    plugins: [],
} satisfies Config;
