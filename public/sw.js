// Service Worker for offline functionality
const CACHE_NAME = "just-let-it-out-v1"
const urlsToCache = [
  "/",
  "/index.html",
  "/chat.html",
  "/stories.html",
  "/support.html",
  "/styles.css",
  "/chat-styles.css",
  "/stories-styles.css",
  "/support-styles.css",
  "/app.js",
  "/chat-rooms.js",
  "/room-chat.js",
  "/stories.js",
  "/support.js",
  "/firebase-config.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
]

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache")
      return cache.addAll(urlsToCache)
    }),
  )
})

// Fetch event
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      if (response) {
        return response
      }
      return fetch(event.request)
    }),
  )
})

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName)
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
})
