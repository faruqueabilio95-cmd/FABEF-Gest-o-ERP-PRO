const NOME_CACHE = "fabef-erp-v2";

const FICHEIROS_ESSENCIAIS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(NOME_CACHE)
      .then((cache) => cache.addAll(FICHEIROS_ESSENCIAIS))
      .catch((erro) => console.error("Erro ao preparar cache offline:", erro))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((chave) => chave !== NOME_CACHE).map((chave) => caches.delete(chave)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (url.includes("googleapis.com") || url.includes("google.com") || url.includes("gstatic.com/firebasejs")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((respostaGuardada) => {
      if (respostaGuardada) return respostaGuardada;

      return fetch(event.request)
        .then((respostaRede) => {
          const copia = respostaRede.clone();
          caches.open(NOME_CACHE).then((cache) => cache.put(event.request, copia));
          return respostaRede;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
