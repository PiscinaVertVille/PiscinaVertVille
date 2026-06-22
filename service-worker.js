// Service Worker - Piscina Vertville
// Cache básico para permitir instalação como PWA (iOS/Android) e uso offline do shell.
// Dados (Firestore) nunca são cacheados aqui — sempre online/real-time.

const CACHE_NAME = 'piscina-vv-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './painel.html',
  './manifest.json',
  './css/styles.css',
  './js/firebase-config.js',
  './js/emailjs-config.js',
  './js/auth.js',
  './js/disponibilidade.js',
  './js/agendamento.js',
  './js/painel.js',
  './js/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Nunca interceptar chamadas ao Firebase/Firestore/EmailJS — sempre direto pra rede.
  const url = event.request.url;
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('emailjs.com') ||
    url.includes('api.emailjs.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
