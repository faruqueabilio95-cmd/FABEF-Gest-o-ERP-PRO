/* =====================================================
   FABEF ERP â€” Service Worker
   Guarda o "esqueleto" da aplicaÃ§Ã£o (HTML/JS/manifest) no
   telemÃ³vel, para que abrir a aplicaÃ§Ã£o funcione mesmo sem
   nenhuma ligaÃ§Ã£o Ã  internet â€” mesmo depois de fechar tudo.

   Os DADOS (produtos, vendas, clientes, etc.) nÃ£o passam por
   aqui: esses jÃ¡ ficam guardados pelo prÃ³prio Firestore
   (ativado em app.js com enableIndexedDbPersistence). Este
   ficheiro cuida sÃ³ dos ficheiros do programa em si.
===================================================== */

const NOME_CACHE = "fabef-erp-v1";

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
            .catch((erro) => console.error("Erro ao preparar a cache offline:", erro))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // Remove versÃµes antigas da cache quando a app Ã© atualizada
    event.waitUntil(
        caches.keys().then((chaves) =>
            Promise.all(chaves.filter((chave) => chave !== NOME_CACHE).map((chave) => caches.delete(chave)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const url = event.request.url;

    // Nunca intercepta pedidos ao Firebase/Firestore/Auth â€” esses jÃ¡ tÃªm o
    // seu prÃ³prio mecanismo de sincronizaÃ§Ã£o offline, e interferir aqui
    // poderia causar conflitos ou dados desatualizados.
    if (url.includes("googleapis.com") || url.includes("google.com") || url.includes("gstatic.com/firebasejs")) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((respostaGuardada) => {
            if (respostaGuardada) {
                return respostaGuardada;
            }

            return fetch(event.request)
                .then((respostaRede) => {
                    // Guarda uma cÃ³pia da resposta para a prÃ³xima vez que estiver offline
                    const copia = respostaRede.clone();
                    caches.open(NOME_CACHE).then((cache) => cache.put(event.request, copia));
                    return respostaRede;
                })
                .catch(() => {
                    // Sem rede e sem nada em cache: se for a prÃ³pria pÃ¡gina, mostra o index.html guardado
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                });
        })
    );
});
