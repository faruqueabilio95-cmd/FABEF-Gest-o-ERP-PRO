/* =====================================================
   FABEF ERP — Service Worker (Modo Offline Seguro & Atualização em Tempo Real)
   Versão: fabef-erp-v12.3.0-20260926
   - Limpa caches antigas automaticamente
   - Network-First com bypass de cache para HTML e Scripts (sempre versão nova online)
   - Funciona 100% offline se não houver internet
   - Suporte a ativação imediata (skipWaiting e clients.claim)
===================================================== */
const VERSAO_SW = "fabef-erp-v12.25.0-20261006";
const NOME_CACHE = "fabef-cache-" + VERSAO_SW;

const FICHEIROS_ESSENCIAIS = [
    "./",
    "./index.html",
    "./src/app.js",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
    // Força o novo service worker a assumir imediatamente
    self.skipWaiting();
    event.waitUntil(
        caches.open(NOME_CACHE)
            .then(async (cache) => {
                for (const url of FICHEIROS_ESSENCIAIS) {
                    try {
                        const resposta = await fetch(url, { cache: "reload" });
                        if (resposta && resposta.status === 200) {
                            await cache.put(url, resposta);
                        }
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
                    .map((chave) => {
                        console.log("A remover cache antiga:", chave);
                        return caches.delete(chave);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
    if (event.data === "LIMPAR_CACHE") {
        caches.keys().then((chaves) =>
            Promise.all(chaves.map((c) => caches.delete(c)))
        );
    }
});

self.addEventListener("fetch", (event) => {
    const url = event.request.url;

    // Não intercepta chamadas Firebase, Google APIs ou métodos que não sejam GET
    if (
        url.includes("googleapis.com") ||
        url.includes("google.com") ||
        url.includes("gstatic.com") ||
        url.includes("firebase") ||
        event.request.method !== "GET"
    ) {
        return;
    }

    // Para requisições de página (HTML/navegação) ou scripts, busca sempre a versão fresca do servidor sem cache de disco
    const ehNavegacaoOuScript = event.request.mode === "navigate" || 
                               url.endsWith(".html") || 
                               url.includes("/src/") ||
                               url.endsWith("app.js");

    if (ehNavegacaoOuScript) {
        event.respondWith(
            fetch(event.request, { cache: "no-cache" })
                .then((respostaRede) => {
                    if (respostaRede && respostaRede.status === 200) {
                        const copia = respostaRede.clone();
                        caches.open(NOME_CACHE).then((cache) => cache.put(event.request, copia));
                    }
                    return respostaRede;
                })
                .catch(async () => {
                    const respostaGuardada = await caches.match(event.request);
                    if (respostaGuardada) return respostaGuardada;
                    return caches.match("./index.html") || caches.match("./");
                })
        );
        return;
    }

    // Para outros recursos estáticos (ícones, imagens): Network-First com cache de fallback
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
                if (respostaGuardada) return respostaGuardada;
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html");
                }
            })
    );
});
