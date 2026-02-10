/* eslint-disable no-restricted-globals */

// Service Worker for Haemi Life PWA
// Optimized for Botswana's low bandwidth conditions

const CACHE_VERSION = 'haemi-life-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/static/css/main.css',
    '/static/js/main.js',
    '/manifest.json',
    '/logo.svg',
];

// Cache size limits (for low storage devices)
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_IMAGE_CACHE_SIZE = 30;

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((err) => {
                console.error('[SW] Failed to cache static assets:', err);
            })
    );

    // Force the waiting service worker to become active
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('haemi-life-') && !name.startsWith(CACHE_VERSION))
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
    );

    // Take control of all pages immediately
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API requests (always fetch fresh)
    if (url.pathname.startsWith('/api')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Handle images with cache-first strategy
    if (request.destination === 'image') {
        event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
        return;
    }

    // Handle static assets with cache-first
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // Handle pages with network-first (for dynamic content)
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE));
});

// Strategy: Cache First (for static assets)
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        throw error;
    }
}

// Strategy: Cache First with Size Limit (for images)
async function cacheFirstWithLimit(request, cacheName, maxSize) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        const cache = await caches.open(cacheName);

        // Limit cache size
        const keys = await cache.keys();
        if (keys.length >= maxSize) {
            await cache.delete(keys[0]); // Delete oldest
        }

        cache.put(request, response.clone());
        return response;
    } catch (error) {
        console.error('[SW] Image fetch failed:', error);
        // Return placeholder or cached version if available
        return caches.match('/offline-image.png') || new Response('Image unavailable', { status: 503 });
    }
}

// Strategy: Network First (for API calls)
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch (error) {
        console.error('[SW] Network request failed:', error);
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Strategy: Network First with Cache Fallback (for pages)
async function networkFirstWithCache(request, cacheName, maxSize) {
    try {
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            const cache = await caches.open(cacheName);

            // Limit cache size
            const keys = await cache.keys();
            if (keys.length >= maxSize) {
                await cache.delete(keys[0]);
            }

            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cached = await caches.match(request);

        if (cached) {
            return cached;
        }

        // Return offline page for navigation requests
        if (request.destination === 'document') {
            return caches.match('/offline.html') || new Response('Offline', { status: 503 });
        }

        throw error;
    }
}

// Background sync for form submissions (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-appointments') {
        event.waitUntil(syncAppointments());
    }
});

async function syncAppointments() {
    // Placeholder for background sync logic
    console.log('[SW] Syncing appointments...');
}

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Haemi Life';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: data.url || '/',
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
    );
});
