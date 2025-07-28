// Service Worker for offline functionality
const CACHE_NAME = "just-let-it-out-v4-qr-enhanced"
const urlsToCache = [
  "/",
  "/index.html",
  "/chat.html",
  "/stories.html",
  "/support.html",
  "/qa.html",
  "/profile.html",
  "/pair.html",
  "/ask.html",
  "/community.html",
  "/css/styles.css",
  "/css/chat-styles.css",
  "/css/stories-styles.css",
  "/css/support-styles.css",
  "/css/qa-styles.css",
  "/css/pair-styles.css",
  "/css/ask-styles.css",
  "/js/app.js",
  "/js/qa.js",
  "/js/stories.js",
  "/js/support.js",
  "/js/pair.js",
  "/js/profile.js",
  "/js/ask.js",
  "/js/firebase-config.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js",
  "https://unpkg.com/qrcode@1.5.4/build/qrcode.min.js",
  "https://cdn.skypack.dev/qrcode@1.5.4",
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
