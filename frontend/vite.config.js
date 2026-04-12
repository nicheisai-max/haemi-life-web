// Trigger Dev Server Restart
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import * as path from 'path';
import { visualizer } from "rollup-plugin-visualizer";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        visualizer({
            open: false,
            filename: "bundle-report.html",
            gzipSize: true,
            brotliSize: true,
        }),
    ],
    optimizeDeps: {
        include: [
            'react-is',
            'react-virtuoso',
            'recharts',
            'framer-motion',
            'lucide-react',
            'axios'
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "react-is": path.resolve(__dirname, "node_modules/react-is"),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
            },
            '/socket.io': {
                target: 'http://localhost:5000',
                ws: true,
                changeOrigin: true
            }
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'ui-vendor': [
                        '@radix-ui/react-avatar',
                        '@radix-ui/react-checkbox',
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-label',
                        '@radix-ui/react-scroll-area',
                        '@radix-ui/react-select',
                        '@radix-ui/react-separator',
                        '@radix-ui/react-slot',
                        '@radix-ui/react-switch',
                        '@radix-ui/react-tabs',
                    ],
                    'charts-vendor': ['recharts'],
                    'utility-vendor': ['axios', 'date-fns', 'framer-motion', 'lucide-react'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setup-tests.ts',
    },
});
