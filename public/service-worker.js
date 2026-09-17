/* =====================================================
   FABEF ERP — Service Worker (Modo Offline Seguro)
   Garante funcionamento offline do esqueleto da aplicação.
===================================================== */
const NOME_CACHE = "fabef-erp-v9.9.9";
const FICHEIROS_ESSENCIAIS = [
    "./",
    "./index.html",
    "./src/app.js",
    "./manifest.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(NOME_CACHE)
            .then(async (cache) => {
                for (const url of FICHEIROS_ESSENCIAIS) {
                    try {
                        await cache.add(url);
                    } catch (e) {
                        console.warn("Aviso na cache offline para " + url + ":", e);
                    }
                }
            })
            .catch((erro) => console.error("Erro ao preparar a cache offline:", erro))
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
    // Não intercepta Firebase ou APIs de rede externa direta
    if (url.includes("googleapis.com") || url.includes("google.com") || url.includes("gstatic.com") || url.includes("firebase")) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((respostaGuardada) => {
            if (respostaGuardada) {
                return respostaGuardada;
            }
            return fetch(event.request)
                .then((respostaRede) => {
                    if (respostaRede && respostaRede.status === 200 && event.request.method === "GET") {
                        const copia = respostaRede.clone();
                        caches.open(NOME_CACHE).then((cache) => cache.put(event.request, copia));
                    }
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
