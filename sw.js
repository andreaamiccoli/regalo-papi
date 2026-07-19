"use strict";

// Incrementa questo valore ad ogni modifica dei file per invalidare la vecchia cache
const CACHE_NAME = 'regalo-papi-v1.6';

// Percorsi RIGOROSAMENTE relativi (./) per funzionare in una sottocartella
// del tipo username.github.io/repo/
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./assets/poster.jpg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/qr-1.png",
  "./assets/qr-2.png",
];

/* -----------------------------------------------------------
   INSTALL
   Precarica tutti gli asset del progetto e forza l'attivazione
   immediata del nuovo Service Worker (skipWaiting).
----------------------------------------------------------- */
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((error) => {
        console.error("[SW] Errore durante il precaching:", error);
      })
  );
});

/* -----------------------------------------------------------
   ACTIVATE
   Ripulisce le cache vecchie e prende il controllo immediato
   di tutte le pagine aperte (clients.claim).
----------------------------------------------------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* -----------------------------------------------------------
   FETCH — Strategia Cache-First
   1. Se la risorsa è già in cache, la restituisce subito.
   2. Altrimenti va in rete, la salva in cache per il futuro
      e la restituisce.
   3. In caso di navigazione offline senza cache, fa fallback
      su ./index.html.
----------------------------------------------------------- */
self.addEventListener("fetch", (event) => {
  // Gestiamo solo richieste GET: POST/PUT ecc. non vanno mai messe in cache.
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Non mettiamo in cache risposte non valide o di tipo "opaco" (cross-origin)
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => {
          // Offline e nessuna cache disponibile: se è una navigazione
          // di pagina, mostriamo comunque l'app shell.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return undefined;
        });
    })
  );
});