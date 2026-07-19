const CACHE_NAME = 'regalo-papi-v1.1';

// L'elenco di tutti i file statici che l'app deve salvare per funzionare offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/poster.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// 1. Evento di Installazione: creiamo la cache e salviamo gli asset
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: File messi in cache con successo');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Forza il Service Worker a diventare attivo subito
  );
});

// 2. Evento di Attivazione: eliminiamo vecchie versioni della cache se presenti
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Rimozione vecchia cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Prende il controllo immediato della pagina
  );
});

// 3. Evento Fetch: intercettiamo le richieste di rete
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se il file è nella cache, lo restituiamo subito senza usare internet
        if (cachedResponse) {
          return cachedResponse;
        }
        // Altrimenti, lo scarichiamo normalmente dalla rete
        return fetch(event.request);
      })
  );
});