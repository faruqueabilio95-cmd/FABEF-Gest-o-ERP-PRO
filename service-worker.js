/* =====================================================
   FABEF ERP — Service Worker (Modo Offline Seguro & Atualização em Tempo Real)
   Estratégia Network-First para ficheiros essenciais:
   Garante que o PWA instalado recebe sempre a versão mais recente em tempo real
   quando online, e funciona 100% offline se não houver internet.
===================================================== */
const NOME_CACHE = "fabef-erp-v10.1.0";
const FICHEIROS_ESSENCIAIS = [
    "./",
    "./index.html",
    "./src/app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
    self.skipWaiting();
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
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((chaves) =>
            Promise.all(
                chaves
                    .filter((chave) => chave !== NOME_CACHE)
                    .map((chave) => caches.delete(chave))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const url = event.request.url;

    // Não intercepta Firebase ou APIs de rede externa direta
    if (
        url.includes("googleapis.com") ||
        url.includes("google.com") ||
        url.includes("gstatic.com") ||
        url.includes("firebase") ||
        event.request.method !== "GET"
    ) {
        return;
    }

    // Network-First com Fallback para Cache Offline
    event.respondWith(
        fetch(event.request)
            .then((respostaRede) => {
                if (respostaRede && respostaRede.status === 200) {
                    const copia = respostaRede.clone();
                    caches.open(NOME_CACHE).then((cache) => cache.put(event.request, copia));
                }
                return respostaRede;
            })
            .catch(async () => {
                const respostaGuardada = await caches.match(event.request);
                if (respostaGuardada) {
                    return respostaGuardada;
                }
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html");
                }
            })
    );
});
