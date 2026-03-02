/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_DEMO_MODE: string
    readonly VITE_ENCRYPTION_KEY: string
    readonly VITE_DEMO_SHIELD?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
