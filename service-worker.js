const CACHE_NAME = "box-machine-offline-v48";
const OFFLINE_FILES = [
  "./",
  "./index.html",
  "./update.html",
  "./styles.css",
  "./app.js",
  "./vendor/tesseract/tesseract.min.js",
  "./vendor/tesseract/worker.min.js",
  "./vendor/tesseract-core/tesseract-core.js",
  "./vendor/tesseract-core/tesseract-core.wasm",
  "./vendor/tesseract-core/tesseract-core.wasm.js",
  "./vendor/tesseract-core/tesseract-core-lstm.js",
  "./vendor/tesseract-core/tesseract-core-lstm.wasm",
  "./vendor/tesseract-core/tesseract-core-lstm.wasm.js",
  "./vendor/tesseract-core/tesseract-core-simd.js",
  "./vendor/tesseract-core/tesseract-core-simd.wasm",
  "./vendor/tesseract-core/tesseract-core-simd.wasm.js",
  "./vendor/tesseract-core/tesseract-core-simd-lstm.js",
  "./vendor/tesseract-core/tesseract-core-simd-lstm.wasm",
  "./vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js",
  "./vendor/tesseract-core/tesseract-core-relaxedsimd.js",
  "./vendor/tesseract-core/tesseract-core-relaxedsimd.wasm",
  "./vendor/tesseract-core/tesseract-core-relaxedsimd.wasm.js",
  "./vendor/tesseract-core/tesseract-core-relaxedsimd-lstm.js",
  "./vendor/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm",
  "./vendor/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "./tessdata/chi_sim.traineddata.gz",
  "./tessdata/eng.traineddata.gz",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
