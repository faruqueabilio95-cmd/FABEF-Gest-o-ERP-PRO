/* =====================================================
   FABEF ERP — Service Worker
   Guarda o "esqueleto" da aplicação (HTML/JS/manifest) no
   telemóvel, para que abrir a aplicação funcione mesmo sem
   nenhuma ligação à internet — mesmo depois de fechar tudo.

   Os DADOS (produtos, vendas, clientes, etc.) não passam por
   aqui: esses já ficam guardados pelo próprio Firestore
   (ativado em app.js com enableIndexedDbPersistence). Este
   ficheiro cuida só dos ficheiros do programa em si.
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
    // Remove versões antigas da cache quando a app é atualizada
    event.waitUntil(
        caches.keys().then((chaves) =>
            Promise.all(chaves.filter((chave) => chave !== NOME_CACHE).map((chave) => caches.delete(chave)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const url = event.request.url;

    // Nunca intercepta pedidos ao Firebase/Firestore/Auth — esses já têm o
    // seu próprio mecanismo de sincronização offline, e interferir aqui
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
                    // Guarda uma cópia da resposta para a próxima vez que estiver offline
                    const copia = respostaRede.clone();
                    caches.open(NOME_CACHE).then((cache) => cache.put(event.request, copia));
                    return respostaRede;
                })
                .catch(() => {
                    // Sem rede e sem nada em cache: se for a própria página, mostra o index.html guardado
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                });
        })
    );
});
