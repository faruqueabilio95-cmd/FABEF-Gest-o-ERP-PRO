import {
    initializeApp,
    deleteApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    increment,
    enableIndexedDbPersistence,
    disableNetwork,
    enableNetwork
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =====================================================
   CONFIGURAÇÃO FIREBASE — PRODUÇÃO
===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyCVUl2eRJSkXzz8MMYv_HI_AUkNNJ_btU0",
    authDomain: "fabef-erp.firebaseapp.com",
    projectId: "fabef-erp",
    storageBucket: "fabef-erp.firebasestorage.app",
    messagingSenderId: "260237196469",
    appId: "1:260237196469:web:97f2584bdd5714815e92fc",
    measurementId: "G-Z2DJE1K547"
};


const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);

// A sessão fica guardada no dispositivo (não expira ao fechar o navegador/app).
// Isto é necessário para o aplicativo funcionar OFFLINE — sem isto, reabrir sem
// internet obrigaria sempre a um novo login, que precisa de rede. A segurança de
// "pedir sempre alguma coisa ao reabrir" passa a ser feita pelo ecrã de PIN local
// (ver módulo PIN mais abaixo), que não depende de internet.
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Erro ao configurar persistência de sessão:", err));

const db = getFirestore(appFirebase);

// Guarda em cache local (IndexedDB) os dados já lidos, para continuarem
// disponíveis sem internet, e permite que escritas feitas offline fiquem
// em fila e sincronizem sozinhas quando a rede voltar.
enableIndexedDbPersistence(db).catch(err => {
    if (err.code === "failed-precondition") {
        console.warn("Modo offline: só é suportado numa aba aberta de cada vez.");
    } else if (err.code === "unimplemented") {
        console.warn("Este navegador não suporta o modo offline.");
    }
});

/* =====================================================
   POLÍTICA DE OPERAÇÕES CRÍTICAS
   O navegador apenas solicita a operação. A autorização real
   continua dependente do Firebase Authentication + Firestore Rules.
   Não existe modo de demonstração nem aprovação local de pagamento.
===================================================== */
const FABEF_PRODUCAO = true;
const FABEF_API_BASE = window.FABEF_API_BASE || "";


/* =====================================================
   ESTADO GLOBAL DA APLICAÇÃO (FABEF GLOBAL MEMORY)
===================================================== */

window.FABEF = {
    user: null,
    userData: null,
    empresaId: null,
    empresa: null,
    ramo: "Mercearia / Minimercado",
    produtos: [],
    clientes: [],
    fornecedores: [],
    compras: [],
    vendas: [],
    despesas: [],
    dividas: [],
    encomendas: [],
    funcionarios: [],
    pagamentos: [],
    auditoria: [],
    carrinho: [],
    turnoId: null,
    turno: null,
    listeners: []
};


/* =====================================================
   LISTAGEM OFICIAL DE RAMOS DE ACTIVIDADE
===================================================== */

const RAMOS_PADRAO = [
    "Mercearia / Minimercado",
    "Supermercado",
    "Boutique / Moda",
    "Calçados",
    "Salão de Beleza",
    "Barbearia",
    "Restaurante",
    "Lanchonete",
    "Bar / Bebidas",
    "Pastelaria",
    "Padaria",
    "Doceria / Bolos",
    "Talho / Açougue",
    "Peixaria",
    "Frutaria",
    "Hortícola",
    "Farmácia / Perfumaria",
    "Cosméticos",
    "Material de Construção",
    "Ferragem",
    "Elétrica",
    "Canalização",
    "Serralharia",
    "Serralharia de Alumínio",
    "Vidraçaria",
    "Carpintaria / Marcenaria",
    "Estofaria",
    "Colchoaria",
    "Tintas e Vernizes",
    "Informática",
    "Manutenção de Computadores",
    "Telemóveis e Acessórios",
    "Electrónica",
    "Cyber Café",
    "Papelaria",
    "Papelaria e Material Escolar",
    "Livraria",
    "Móveis",
    "Móveis de Escritório",
    "Electrodomésticos",
    "Oficina Auto",
    "Peças Auto",
    "Mecânica",
    "Motorizadas",
    "Lavagem de Carros (Lavajato)",
    "Aluguer de Equipamentos",
    "Hotel / Hospedagem",
    "Agência de Viagens",
    "Transporte de Carga",
    "Taxi / Moto-Taxi",
    "Posto de Combustível",
    "Distribuidora de Gás",
    "Serviços de Limpeza",
    "Serviços de Impressão",
    "Gráfica",
    "Fotografia / Estúdio",
    "Florista",
    "Decoração de Eventos",
    "Aluguer de Salas / Eventos",
    "DJ / Som e Iluminação",
    "Pet Shop",
    "Agropecuária",
    "Agro-veterinária",
    "Loja de Sementes",
    "Restaurante / Catering",
    "Joalharia / Bijuteria",
    "Relojoaria",
    "Óptica",
    "Artigos Religiosos",
    "Loja de Brinquedos",
    "Artigos de Festa",
    "Loja de Bebé",
    "Loja de Desporto",
    "Loja de Bicicletas",
    "Ginásio / Academia",
    "Clínica Médica",
    "Clínica Dentária",
    "Costura / Alfaiataria",
    "Sapataria (Conserto)",
    "Lavandaria",
    "Escola / Explicações",
    "Infantário / Creche",
    "Estúdio de Música",
    "Contabilidade / Consultoria",
    "Advocacia",
    "Imobiliária",
    "Seguros",
    "Agência de Emprego",
    "Segurança Privada",
    "Artesanato",
    "Comércio Geral",
    "Outro"
];

// Ramos personalizados adicionados pela própria empresa (guardados em
// empresa.ramos_atividade) juntam-se aos RAMOS_PADRAO na hora de montar
// os selects — ver renderRamos().
let RAMOS = RAMOS_PADRAO.slice();


/* =====================================================
   DICIONÁRIO SISTÉMICO DE IDIOMAS (TRADUÇÃO DE TERMOS)
===================================================== */

const IDIOMAS = {
    pt: {
        idioma: "Idioma",
        entrar: "Entrar",
        sair: "Sair",
        inicio: "Início",
        vendas: "Vendas",
        produtos: "Produtos",
        inventario: "Inventário",
        compras: "Compras",
        clientes: "Clientes",
        fornecedores: "Fornecedores",
        relatorios: "Relatórios",
        subscricao: "Subscrição"
    },
    en: {
        idioma: "Language",
        entrar: "Login",
        sair: "Logout",
        inicio: "Home",
        vendas: "Sales",
        produtos: "Products",
        inventario: "Inventory",
        compras: "Purchases",
        clientes: "Customers",
        fornecedores: "Suppliers",
        relatorios: "Reports",
        subscricao: "Subscription"
    },
    xch: {
        idioma: "Ririmi",
        entrar: "Nghena",
        sair: "Huma",
        inicio: "Kusungula",
        vendas: "Mavhengele",
        produtos: "Switirhisiwa",
        inventario: "Ndhawu ya swilo",
        compras: "Mavhengele ya swilo",
        clientes: "Vaxavi",
        fornecedores: "Vaphakeri",
        relatorios: "Miviko",
        subscricao: "Mali ya n'hweti"
    },
    emw: {
        idioma: "Ephirimi",
        entrar: "Nkhumeli",
        sair: "Nkhuma",
        inicio: "Etthu",
        vendas: "Othuma",
        produtos: "Eprodhutu",
        inventario: "Eestoque",
        compras: "Okhuma",
        clientes: "Akhili",
        fornecedores: "Aphakeli",
        relatorios: "Miviko",
        subscricao: "Osubscriva"
    }
};


/* =====================================================
   SUGESTÕES DE ARTIGOS POR RAMO DE NEGÓCIO
===================================================== */

const SUGESTOES = {
    "Mercearia / Minimercado": [
        "Arroz", "Açúcar", "Óleo", "Farinha de milho", "Farinha de trigo", "Feijão",
        "Sal", "Sabão azul e branco", "Sabão em pó", "Leite em pó", "Bolachas",
        "Massa esparguete", "Chá", "Café", "Fósforos", "Velas", "Pilhas"
    ],
    "Supermercado": [
        "Arroz", "Óleo alimentar", "Açúcar", "Leite", "Refrigerante", "Água mineral",
        "Detergente", "Papel higiénico", "Pasta de dentes", "Sabonete", "Manteiga",
        "Queijo", "Iogurte", "Ovos", "Carvão", "Fraldas"
    ],
    "Boutique / Moda": [
        "T-shirt", "Calça de ganga", "Vestido", "Saia", "Camisa social", "Casaco",
        "Cinto", "Boné", "Meias", "Lenço", "Bolsa"
    ],
    "Calçados": [
        "Sapato social", "Sandália", "Chinelo", "Sapatilha desportiva", "Bota",
        "Sapato de criança", "Palmilha", "Cadarço"
    ],
    "Salão de Beleza": [
        "Corte de cabelo", "Penteado / Trança", "Manicure", "Pedicure",
        "Shampoo", "Condicionador", "Creme alisante", "Tinta de cabelo",
        "Extensão de cabelo", "Óleo capilar"
    ],
    "Barbearia": [
        "Corte de cabelo", "Barba", "Corte + Barba", "Gel", "Pomada", "Shampoo",
        "Máquina de corte (manutenção)"
    ],
    "Restaurante": [
        "Arroz", "Frango grelhado", "Carne assada", "Peixe grelhado", "Batata frita",
        "Salada", "Sumo natural", "Refrigerante", "Água", "Sobremesa"
    ],
    "Lanchonete": [
        "Hambúrguer", "Cachorro-quente", "Sanduíche", "Batata frita", "Sumo",
        "Água", "Pastel", "Rissol", "Chamuça"
    ],
    "Bar / Bebidas": [
        "Água", "Sumo", "Cerveja", "Vinho", "Whisky", "Gin", "Vodka", "Gelo",
        "Refrigerante", "Petiscos"
    ],
    "Pastelaria": [
        "Pão", "Croissant", "Bolo", "Pastel de nata", "Empada", "Chamuça",
        "Rissol", "Sumo", "Café", "Chá"
    ],
    "Padaria": [
        "Pão de trigo", "Pão de forma", "Pão integral", "Bolo simples",
        "Bolachas", "Farinha", "Fermento", "Manteiga"
    ],
    "Doceria / Bolos": [
        "Bolo de aniversário", "Cupcake", "Brigadeiro", "Torta", "Bolo de casamento",
        "Docinhos", "Biscoitos decorados"
    ],
    "Talho / Açougue": [
        "Carne de vaca (kg)", "Carne de porco (kg)", "Frango inteiro (kg)",
        "Peito de frango (kg)", "Miúdos", "Linguiça", "Salsicha", "Osso para caldo"
    ],
    "Peixaria": [
        "Peixe fresco (kg)", "Camarão (kg)", "Lagosta (kg)", "Polvo (kg)",
        "Caranguejo", "Gelo para conservação"
    ],
    "Frutaria": [
        "Banana", "Manga", "Laranja", "Maçã", "Abacaxi", "Melancia", "Papaia",
        "Limão", "Abacate"
    ],
    "Hortícola": [
        "Tomate (kg)", "Cebola (kg)", "Repolho", "Alface", "Cenoura (kg)",
        "Batata (kg)", "Couve", "Pimento"
    ],
    "Farmácia / Perfumaria": [
        "Paracetamol", "Ibuprofeno", "Soro fisiológico", "Álcool gel",
        "Máscara", "Preservativo", "Perfume", "Sabonete líquido", "Vitaminas"
    ],
    "Cosméticos": [
        "Base", "Batom", "Rímel", "Pó compacto", "Esmalte", "Creme facial",
        "Protetor solar", "Removedor de maquilhagem"
    ],
    "Material de Construção": [
        "Cimento (saco)", "Areia (m³)", "Brita (m³)", "Ferro de construção",
        "Bloco / Tijolo", "Tinta", "Tubo PVC", "Prego"
    ],
    "Ferragem": [
        "Martelo", "Chave de fendas", "Fita métrica", "Corda", "Cadeado",
        "Dobradiça", "Fechadura", "Arame"
    ],
    "Elétrica": [
        "Lâmpada", "Fio elétrico (metro)", "Tomada", "Interruptor", "Disjuntor",
        "Fita isoladora", "Extensão elétrica"
    ],
    "Informática": [
        "Manutenção de computador", "Instalação de Windows", "Rato",
        "Teclado", "Pen drive", "Cabo HDMI", "Impressão de documentos"
    ],
    "Telemóveis e Acessórios": [
        "Capa de telemóvel", "Película de vidro", "Carregador", "Auricular",
        "Cartão de memória", "Bateria", "Reparação de ecrã"
    ],
    "Papelaria": [
        "Caderno", "Caneta", "Lápis", "Borracha", "Régua", "Cola", "Tesoura",
        "Papel A4 (resma)", "Impressão / Fotocópia"
    ],
    "Móveis": [
        "Cama", "Sofá", "Mesa", "Cadeira", "Armário", "Estante", "Colchão"
    ],
    "Electrodomésticos": [
        "Frigorífico", "Fogão", "Micro-ondas", "Ventilador", "Ferro de engomar",
        "Liquidificador", "Rádio"
    ],
    "Oficina Auto": [
        "Mudança de óleo", "Alinhamento", "Balanceamento", "Revisão geral",
        "Diagnóstico eletrónico", "Troca de pastilhas de travão"
    ],
    "Peças Auto": [
        "Óleo de motor", "Filtro de óleo", "Filtro de ar", "Pastilha de travão",
        "Vela de ignição", "Bateria de carro", "Pneu"
    ],
    "Motorizadas": [
        "Mudança de óleo", "Revisão", "Pneu", "Vela", "Corrente", "Travões"
    ],
    "Hotel / Hospedagem": [
        "Diária quarto simples", "Diária quarto duplo", "Pequeno-almoço",
        "Lavandaria", "Estacionamento"
    ],
    "Transporte de Carga": [
        "Frete curta distância", "Frete longa distância", "Mudança residencial",
        "Carregamento / Descarregamento"
    ],
    "Taxi / Moto-Taxi": [
        "Corrida curta", "Corrida longa", "Corrida noturna", "Aluguer por hora"
    ],
    "Posto de Combustível": [
        "Gasolina (litro)", "Gasóleo (litro)", "Petróleo (litro)", "Óleo de motor"
    ],
    "Distribuidora de Gás": [
        "Botija de gás 6kg", "Botija de gás 12kg", "Botija de gás 45kg",
        "Regulador de gás", "Mangueira de gás"
    ],
    "Serviços de Limpeza": [
        "Limpeza residencial", "Limpeza de escritório", "Limpeza pós-obra",
        "Lavagem de estofos", "Lavagem de tapetes"
    ],
    "Gráfica": [
        "Impressão de cartões", "Impressão de banners", "Impressão de flyers",
        "Plastificação", "Encadernação"
    ],
    "Fotografia / Estúdio": [
        "Sessão fotográfica", "Cobertura de evento", "Revelação de fotos",
        "Edição de vídeo", "Impressão de fotos"
    ],
    "Florista": [
        "Ramo de flores", "Arranjo de mesa", "Coroa de flores", "Vaso decorativo"
    ],
    "Pet Shop": [
        "Ração para cão", "Ração para gato", "Banho e tosquia", "Coleira",
        "Vacina", "Brinquedo para animal"
    ],
    "Agropecuária": [
        "Ração animal", "Vacina veterinária", "Adubo", "Semente", "Ferramenta agrícola"
    ],
    "Joalharia / Bijuteria": [
        "Anel", "Colar", "Pulseira", "Brincos", "Relógio", "Corrente de prata"
    ],
    "Óptica": [
        "Óculos de grau", "Óculos de sol", "Lente de contacto", "Exame de vista",
        "Conserto de armação"
    ],
    "Clínica Médica": [
        "Consulta geral", "Consulta especializada", "Exame de rotina",
        "Injeção / Curativo", "Aferição de tensão"
    ],
    "Clínica Dentária": [
        "Consulta dentária", "Limpeza dentária", "Extração", "Obturação",
        "Branqueamento"
    ],
    "Costura / Alfaiataria": [
        "Ajuste de calça", "Confecção de fato", "Bainha", "Reparação de roupa",
        "Confecção de capulana"
    ],
    "Lavandaria": [
        "Lavagem de roupa (kg)", "Passar a ferro", "Lavagem a seco",
        "Lavagem de edredon"
    ],
    "Escola / Explicações": [
        "Explicação de Matemática", "Explicação de Português", "Explicação de Inglês",
        "Explicação de Física", "Curso de informática"
    ],
    "Contabilidade / Consultoria": [
        "Declaração de impostos", "Contabilidade mensal", "Abertura de empresa",
        "Consultoria financeira"
    ],
    "Segurança Privada": [
        "Vigilância diurna", "Vigilância noturna", "Instalação de câmaras",
        "Ronda de segurança"
    ],
    "Comércio Geral": [
        "Produto diverso 1", "Produto diverso 2", "Produto diverso 3"
    ]
};
/* =====================================================
   FUNÇÕES UTILITÁRIAS DO SISTEMA
===================================================== */

function dinheiro(v) {
    return "MT " + Number(v || 0).toLocaleString(
        "pt-MZ",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}


function numero(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}


function uid(prefix = "ID") {
    return prefix + "-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        Math.random().toString(36).substring(2, 7).toUpperCase();
}


function escapeHTML(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function dataTexto(v) {
    if (!v) return "—";

    let d;
    if (typeof v === "object" && typeof v.toDate === "function") {
        d = v.toDate();
    } else {
        d = new Date(v);
    }

    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString("pt-MZ");
}


function dataHoje() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}


function diasAtras(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
}


function toast(msg) {
    alert(msg);
}


window.fecharModal = function (id) {
    document.getElementById(id)?.classList.remove("show");
};


/* =====================================================
   REFERÊNCIAS DE SEGURANÇA MULTIEMPRESA (FIRESTORE)
===================================================== */

function empresaRef() {
    return doc(db, "empresas", FABEF.empresaId);
}


function subRef(nome) {
    return collection(db, "empresas", FABEF.empresaId, nome);
}


function produtoRef(id) {
    return doc(db, "empresas", FABEF.empresaId, "produtos", id);
}


/* =====================================================
   MÓDULO LÓGICO: REGISTO DE AUDITORIA
   FUNÇÃO EM FALTA NO FICHEIRO ORIGINAL — é chamada em cerca
   de 20 sítios (produtos, vendas, compras, caixa, etc.) mas
   nunca tinha sido definida, o que gerava ReferenceError e
   interrompia a operação a meio (ex: guardarConfiguracoes).
===================================================== */
async function gravarAuditoria(mensagem, nivel) {
    if (!FABEF.empresaId || !FABEF.user) return;

    try {
        await addDoc(subRef("auditoria_logs"), {
            mensagem: mensagem,
            nivel: nivel || "INFO",
            utilizadorId: FABEF.user.uid,
            utilizadorNome: FABEF.userData?.nome || FABEF.user.email,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        });
    } catch (error) {
        // Um erro no registo de auditoria nunca deve travar a operação principal.
        console.error("Não foi possível gravar o registo de auditoria:", error);
    }
}


/* =====================================================
   MÓDULO LÓGICO: AUTENTICAÇÃO E CICLO DE ARRANQUE V9.9
   - Um único fluxo de login/registo
   - Sem fallback inseguro de perfil
   - Bloqueio de corrida durante criação da conta
   - Não faz logout automático quando Firestore falha
===================================================== */

let FABEF_registoEmCurso = false;
let FABEF_arranqueEmCurso = false;

const elAuth = id => document.getElementById(id);

const btnLogin = elAuth("btn-login");
if (btnLogin && !btnLogin.dataset.fabefBound) {
    btnLogin.dataset.fabefBound = "1";
    btnLogin.addEventListener("click", async () => {
        const email = elAuth("login-email")?.value?.trim() || "";
        const senha = elAuth("login-senha")?.value || "";
        const status = elAuth("login-status");

        if (!email || !senha) {
            if (status) status.textContent = "Introduza o e-mail e a senha.";
            return;
        }

        btnLogin.disabled = true;
        if (status) status.textContent = "⏳ A autenticar...";

        try {
            await signInWithEmailAndPassword(auth, email, senha);
            if (status) status.textContent = "🟢 Login realizado. A carregar...";
        } catch (error) {
            console.error("Erro de login:", error);
            if (status) status.textContent = "🔴 " + mensagemFirebase(error);
        } finally {
            btnLogin.disabled = false;
        }
    });
}

const btnMostrarRegisto = elAuth("btn-mostrar-registo");
if (btnMostrarRegisto && !btnMostrarRegisto.dataset.fabefBound) {
    btnMostrarRegisto.dataset.fabefBound = "1";
    btnMostrarRegisto.addEventListener("click", () => {
        elAuth("login-form")?.classList.add("hidden");
        elAuth("registo-form")?.classList.remove("hidden");
    });
}

const btnVoltarLogin = elAuth("btn-voltar-login");
if (btnVoltarLogin && !btnVoltarLogin.dataset.fabefBound) {
    btnVoltarLogin.dataset.fabefBound = "1";
    btnVoltarLogin.addEventListener("click", () => {
        elAuth("registo-form")?.classList.add("hidden");
        elAuth("login-form")?.classList.remove("hidden");
        if (elAuth("reg-status")) elAuth("reg-status").textContent = "";
    });
}

const btnEsqueciSenha = elAuth("btn-esqueci-senha");
if (btnEsqueciSenha && !btnEsqueciSenha.dataset.fabefBound) {
    btnEsqueciSenha.dataset.fabefBound = "1";
    btnEsqueciSenha.addEventListener("click", async () => {
        const email = elAuth("login-email")?.value.trim();
        const status = elAuth("login-status");
        if (!email) {
            if (status) status.textContent = "🔴 Escreva primeiro o seu e-mail no campo acima, depois clique em \"Esqueci a senha\".";
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            if (status) status.textContent = "🟢 Enviámos um e-mail para " + email + " com as instruções para definir uma nova senha. Verifique também a pasta de spam.";
        } catch (error) {
            console.error(error);
            if (status) status.textContent = "🔴 " + mensagemFirebase(error);
        }
    });
}

const btnRegistar = elAuth("btn-registar");
if (btnRegistar && !btnRegistar.dataset.fabefBound) {
    btnRegistar.dataset.fabefBound = "1";
    btnRegistar.addEventListener("click", criarConta);
}

async function criarConta() {
    if (FABEF_registoEmCurso) return;

    const empresaNome = elAuth("reg-empresa")?.value?.trim() || "";
    const gerente = elAuth("reg-gerente")?.value?.trim() || "";
    const telefone = elAuth("reg-telefone")?.value?.trim() || "";
    const ramo = elAuth("reg-ramo")?.value?.trim() || "Comércio Geral";
    const email = elAuth("reg-email")?.value?.trim() || "";
    const senha = elAuth("reg-senha")?.value || "";
    const status = elAuth("reg-status");

    if (!empresaNome || !gerente || !email || !senha) {
        if (status) status.textContent = "⚠️ Preencha os campos obrigatórios.";
        return;
    }

    if (senha.length < 6) {
        if (status) status.textContent = "⚠️ A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    FABEF_registoEmCurso = true;
    if (btnRegistar) btnRegistar.disabled = true;
    if (status) status.textContent = "⏳ A criar a conta...";

    try {
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);
        const uidUser = credencial.user.uid;
        const empresaId = uidUser;
        const agora = new Date().toISOString();

        const empresa = {
            id: empresaId,
            nome: empresaNome,
            telefone,
            endereco: "",
            gerenteId: uidUser,
            ramo_ativo: ramo,
            ramos_atividade: [ramo],
            estado_licenca: "TESTE",
            subscricao_paga: false,
            data_registo: agora,
            validade_subscricao: null,
            valor_mensalidade_atual: 250,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp()
        };

        const utilizador = {
            uid: uidUser,
            email,
            nome: gerente,
            telefone,
            empresaId,
            perfil: "gerente",
            role: "gerente",
            estado: "ATIVO",
            criadoEm: serverTimestamp()
        };

        // Os dois documentos só são criados para o UID autenticado.
        await setDoc(doc(db, "empresas", empresaId), empresa);
        await setDoc(doc(db, "utilizadores", uidUser), utilizador);

        if (status) status.textContent = "🟢 Conta criada com sucesso. A abrir o sistema...";

        // CORREÇÃO: o onAuthStateChanged já disparou (ignorado, porque
        // FABEF_registoEmCurso estava ativo) e não volta a disparar sozinho,
        // porque o estado de autenticação não muda outra vez. Por isso,
        // depois de os documentos existirem, arrancamos a sessão manualmente.
        FABEF_registoEmCurso = false;
        if (auth.currentUser) {
            await iniciarSessaoFABEF(auth.currentUser);
        }
        return;
    } catch (error) {
        console.error("Erro ao criar conta:", error);
        if (status) status.textContent = "🔴 " + mensagemFirebase(error);
    } finally {
        FABEF_registoEmCurso = false;
        if (btnRegistar) btnRegistar.disabled = false;
    }
}

async function limparEstadoFABEF() {
    if (FABEF.listeners && FABEF.listeners.length) {
        FABEF.listeners.forEach(unsub => {
            try { if (typeof unsub === "function") unsub(); } catch (_) {}
        });
    }
    FABEF.listeners = [];
    FABEF_UNSUB_CAIXA = null;
    FABEF_STOCK_NEGATIVO_ALERTADO.clear();
    FABEF.user = null;
    FABEF.userData = null;
    FABEF.empresaId = null;
    FABEF.empresa = null;
    FABEF.produtos = [];
    FABEF.clientes = [];
    FABEF.fornecedores = [];
    FABEF.compras = [];
    FABEF.vendas = [];
    FABEF.despesas = [];
    FABEF.dividas = [];
    FABEF.encomendas = [];
    FABEF.funcionarios = [];
    FABEF.pagamentos = [];
    FABEF.auditoria = [];
    FABEF.sugestoes = [];
    FABEF.carrinho = [];
    FABEF.turnoId = null;
    FABEF.turno = null;
    FABEF.carregado = false;
}

async function iniciarSessaoFABEF(user) {
    if (FABEF_arranqueEmCurso) return;
    FABEF_arranqueEmCurso = true;

    const loginStatus = elAuth("login-status");
    try {
        FABEF.user = user;
        if (loginStatus) loginStatus.textContent = "⏳ A carregar a empresa...";

        // NÃO existe fallback para perfil inexistente.
        await carregarPerfil(user);
        await carregarEmpresa();
        await carregarDados();

        abrirAplicacao();
        FABEF.carregado = true;
    } catch (error) {
        console.error("Erro crítico ao iniciar a aplicação:", error);
        const mensagem = mensagemFirebase(error);
        if (loginStatus) loginStatus.textContent = "🔴 Não foi possível carregar a conta: " + mensagem;

        const regStatus = elAuth("reg-status");
        if (regStatus && !FABEF_registoEmCurso) {
            regStatus.textContent = "🔴 Não foi possível carregar a empresa: " + mensagem;
        }

        // Mantém a sessão autenticada para permitir diagnóstico/retry.
        // Não usamos signOut() aqui, porque um erro do Firestore não significa senha inválida.
        FABEF.carregado = false;
        elAuth("app")?.classList.add("hidden");
        if (elAuth("tela-login")) elAuth("tela-login").style.display = "flex";
    } finally {
        FABEF_arranqueEmCurso = false;
    }
}

/* =====================================================
   MÓDULO LÓGICO: BLOQUEIO POR PIN LOCAL (funciona offline)
   Como a sessão agora fica guardada no dispositivo (para o modo
   offline funcionar), a segurança de "pedir sempre algo ao reabrir"
   passa a ser um PIN de 4 dígitos verificado localmente — não
   depende de internet, ao contrário de pedir e-mail+senha outra vez.
===================================================== */
function chavePinLocal(uid) {
    return "fabef_pin_" + uid;
}

async function calcularHashPin(pin) {
    const dados = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function configurarNovoPin(uid) {
    let pin = prompt("Defina um PIN de 4 dígitos para desbloquear a aplicação rapidamente da próxima vez (mesmo sem internet):");
    if (pin === null) return; // o utilizador optou por não definir agora
    pin = pin.trim();
    if (!/^\d{4,6}$/.test(pin)) { alert("O PIN deve ter entre 4 e 6 números."); return; }
    const confirmacao = prompt("Confirme o PIN novamente:");
    if (pin !== (confirmacao || "").trim()) { alert("Os PINs não coincidem. Tente novamente mais tarde em Configurações."); return; }

    const hash = await calcularHashPin(pin);
    localStorage.setItem(chavePinLocal(uid), hash);
    alert("PIN definido com sucesso. Da próxima vez que abrir a aplicação, vai usar este PIN em vez do e-mail e senha.");
}

function mostrarEcraPin() {
    elAuth("app")?.classList.add("hidden");
    if (elAuth("tela-login")) elAuth("tela-login").style.display = "none";
    const telaPin = document.getElementById("tela-pin");
    if (telaPin) telaPin.style.display = "flex";
    const inputPin = document.getElementById("pin-input");
    if (inputPin) { inputPin.value = ""; inputPin.focus(); }
    const statusPin = document.getElementById("pin-status");
    if (statusPin) statusPin.textContent = "";
}

function esconderEcraPin() {
    const telaPin = document.getElementById("tela-pin");
    if (telaPin) telaPin.style.display = "none";
}

document.getElementById("btn-pin-entrar")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) { mostrarEcraPin(); return; }

    const pinDigitado = (document.getElementById("pin-input")?.value || "").trim();
    const hashGuardado = localStorage.getItem(chavePinLocal(user.uid));
    const statusPin = document.getElementById("pin-status");

    if (!pinDigitado) { if (statusPin) statusPin.textContent = "Introduza o PIN."; return; }

    const hashDigitado = await calcularHashPin(pinDigitado);
    if (hashDigitado === hashGuardado) {
        esconderEcraPin();
        await iniciarSessaoFABEF(user);
    } else {
        if (statusPin) statusPin.textContent = "🔴 PIN incorreto. Tente novamente.";
    }
});

document.getElementById("btn-pin-sair")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (user) localStorage.removeItem(chavePinLocal(user.uid));
    esconderEcraPin();
    await signOut(auth);
});


onAuthStateChanged(auth, async user => {
    if (!user) {
        await limparEstadoFABEF();
        esconderEcraPin();
        if (elAuth("app")) elAuth("app").classList.add("hidden");
        if (elAuth("tela-login")) elAuth("tela-login").style.display = "flex";
        return;
    }

    // Durante o registo, o Auth pode emitir o utilizador antes dos documentos Firestore.
    // Esperamos a conclusão de criarConta() para evitar uma corrida de inicialização.
    if (FABEF_registoEmCurso) return;

    // Se já existe um PIN definido neste dispositivo para este utilizador, exige-o
    // em vez de abrir diretamente — isto substitui o pedido de e-mail/senha,
    // mas continua a funcionar sem internet.
    const temPinLocal = !!localStorage.getItem(chavePinLocal(user.uid));
    if (temPinLocal) {
        mostrarEcraPin();
        return;
    }

    await iniciarSessaoFABEF(user);
});

async function carregarPerfil(user) {
    if (!user?.uid) throw new Error("Utilizador autenticado inválido.");

    const snap = await getDoc(doc(db, "utilizadores", user.uid));

    if (!snap.exists()) {
        throw new Error("Perfil do utilizador não encontrado no Firebase. A conta não está configurada corretamente.");
    }

    const dados = snap.data();
    const empresaId = dados.empresaId;

    if (!empresaId || typeof empresaId !== "string") {
        throw new Error("O perfil do utilizador não possui uma empresaId válida.");
    }

    if (dados.uid && dados.uid !== user.uid) {
        throw new Error("Inconsistência de segurança: o UID do perfil não corresponde ao utilizador autenticado.");
    }

    // Bloqueia o acesso de contas de funcionário que o gerente tenha desativado
    if (dados.perfil === "funcionario" && dados.estado && dados.estado !== "ATIVO") {
        await signOut(auth);
        throw new Error("Esta conta foi desativada pelo gerente. Contacte o gerente do negócio.");
    }

    FABEF.userData = { uid: user.uid, ...dados };
    FABEF.empresaId = empresaId;
}

async function carregarEmpresa() {
    if (!FABEF.empresaId) throw new Error("Nenhuma empresa foi associada ao utilizador.");

    const snap = await getDoc(empresaRef());
    if (!snap.exists()) {
        throw new Error("Documento da empresa não encontrado na base de dados do Firebase.");
    }

    const dados = snap.data();
    if (dados.id && dados.id !== FABEF.empresaId) {
        throw new Error("Inconsistência de segurança: o ID da empresa não corresponde ao documento.");
    }
    if (dados.gerenteId && FABEF.userData?.perfil === "gerente" && dados.gerenteId !== FABEF.user.uid) {
        throw new Error("Inconsistência de segurança: o gerente da empresa não corresponde ao utilizador autenticado.");
    }

    FABEF.empresa = { id: FABEF.empresaId, ...dados };
    FABEF.ramo = FABEF.empresa.ramo_ativo || FABEF.empresa.ramoAtivo || "Mercearia / Minimercado";
}

async function carregarDados() {
    await Promise.all([
        escutarColecao("produtos", "produtos"),
        escutarColecao("clientes", "clientes"),
        escutarColecao("fornecedores", "fornecedores"),
        escutarColecao("compras", "compras"),
        escutarColecao("vendas", "vendas"),
        escutarColecao("despesas", "despesas"),
        escutarColecao("dividas", "dividas"),
        escutarColecao("encomendas", "encomendas"),
        escutarColecao("funcionarios", "funcionarios"),
        escutarColecao("pagamentos", "pagamentos"),
        escutarColecao("auditoria_logs", "auditoria"),
        escutarColecao("sugestoes", "sugestoes")
    ]);
    await ouvirCaixa();
}

// Agrupa várias atualizações em tempo real que cheguem quase ao mesmo tempo
// (normal quando vários dispositivos sincronizam de uma vez) numa única
// renderização, para não sobrecarregar o ecrã com repaints repetidos.
let FABEF_RENDER_PENDENTE = null;
function pedirRenderTudo() {
    if (FABEF_RENDER_PENDENTE) clearTimeout(FABEF_RENDER_PENDENTE);
    FABEF_RENDER_PENDENTE = setTimeout(() => {
        FABEF_RENDER_PENDENTE = null;
        if (FABEF.carregado) renderTudo();
    }, 150);
}

/* =====================================================
   ESCUTA EM TEMPO REAL DAS COLEÇÕES DA EMPRESA
   Substitui o antigo carregamento "uma vez só" (getDocs). Com
   onSnapshot, qualquer alteração feita noutro dispositivo (outro
   funcionário, ou o próprio gerente no telemóvel) aparece aqui
   automaticamente, sem precisar de recarregar a página. Também
   é assim que os dados chegam quando o dispositivo estava offline
   e volta a ligar-se à internet.
===================================================== */
function escutarColecao(nome, estado) {
    return new Promise((resolve) => {
        let primeiraVez = true;
        const unsub = onSnapshot(
            subRef(nome),
            (snap) => {
                FABEF[estado] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                // A cada atualização de produtos, verifica se algum ficou com
                // stock negativo (sinal de duas vendas offline em conflito).
                if (estado === "produtos") {
                    verificarReconciliacaoStock();
                }

                if (primeiraVez) {
                    primeiraVez = false;
                    resolve();
                } else {
                    pedirRenderTudo();
                }
            },
            (erro) => {
                console.error(`Erro ao escutar a coleção "${nome}" em tempo real:`, erro);
                if (primeiraVez) { primeiraVez = false; resolve(); }
            }
        );
        FABEF.listeners.push(unsub);
    });
}

/* =====================================================
   MÓDULO LÓGICO: INDICADOR DE LIGAÇÃO / MODO OFFLINE
===================================================== */
function atualizarIndicadorLigacao() {
    const indicador = document.getElementById("indicador-ligacao");
    if (!indicador) return;
    if (navigator.onLine) {
        indicador.textContent = "🟢 Online";
        indicador.style.color = "#10b981";
        indicador.title = "Ligado à internet — os dados sincronizam em tempo real.";
    } else {
        indicador.textContent = "🔴 Offline";
        indicador.style.color = "#ef4444";
        indicador.title = "Sem internet. Pode continuar a vender e a trabalhar — tudo será sincronizado assim que a ligação voltar.";
    }
}
window.addEventListener("online", atualizarIndicadorLigacao);
window.addEventListener("offline", atualizarIndicadorLigacao);


function abrirAplicacao() {
    elAuth("tela-login")?.style && (elAuth("tela-login").style.display = "none");
    esconderEcraPin();
    elAuth("app")?.classList.remove("hidden");

    const headerUser = elAuth("header-user");
    if (headerUser) {
        headerUser.textContent = FABEF.userData?.nome || FABEF.user?.email || "Utilizador";
    }

    aplicarRestricoesDeAcessoPorPapel();
    renderTudo();
    verificarSubscricao();
    atualizarIndicadorLigacao();

    // Primeira vez neste dispositivo: sugere definir um PIN para acesso rápido offline
    if (FABEF.user?.uid && !localStorage.getItem(chavePinLocal(FABEF.user.uid))) {
        setTimeout(() => configurarNovoPin(FABEF.user.uid), 600);
    }
}


/* =====================================================
   MÓDULO LÓGICO: CONTROLO DE ACESSO POR PAPEL
   O gerente é a conta de controlo do negócio: define preços,
   stock, funcionários e vê relatórios — mas NÃO regista vendas.
   Só as contas de funcionário têm acesso à página "Vender".
===================================================== */
function aplicarRestricoesDeAcessoPorPapel() {
    const perfil = FABEF.userData?.perfil || FABEF.userData?.role;
    const ehGerenteLogado = perfil === "gerente";

    const botaoVender = document.querySelector('.sidebar button[data-sec="pos"]');
    if (botaoVender) {
        botaoVender.style.display = ehGerenteLogado ? "none" : "";
    }

    // Proteção extra: se por acaso a secção "Vender" ficar ativa (ex: sessão antiga),
    // redireciona o gerente para o Início com uma explicação clara.
    if (ehGerenteLogado && document.getElementById("sec-pos")?.classList.contains("active")) {
        mostrarSecao("inicio");
        alert("A conta de gerente é só para controlo do negócio (preços, stock, funcionários e relatórios). Para vender, entre com uma conta de funcionário.");
    }

    // Páginas de controlo do negócio: só o gerente as vê. O funcionário fica
    // limitado às páginas operacionais do dia a dia, para não ver dados
    // sensíveis (margens, avaliação de desempenho, auditoria, subscrição).
    const secoesReservadasAoGerente = ["compras", "relatorios", "metas", "desempenho", "funcionarios", "auditoria", "subscricao", "config", "ramos"];
    secoesReservadasAoGerente.forEach(sec => {
        const botao = document.querySelector(`.sidebar button[data-sec="${sec}"]`);
        if (botao) botao.style.display = ehGerenteLogado ? "" : "none";
    });

    // Se o funcionário estava numa dessas secções reservadas (sessão antiga), devolve ao Início
    if (!ehGerenteLogado && secoesReservadasAoGerente.some(sec => document.getElementById("sec-" + sec)?.classList.contains("active"))) {
        mostrarSecao("inicio");
    }

    // O seletor rápido de ramo na página Produtos também é exclusivo do gerente
    const seletorRamoProdutos = document.getElementById("select-ramo");
    if (seletorRamoProdutos) seletorRamoProdutos.style.display = ehGerenteLogado ? "" : "none";
}

/* =====================================================
   MÓDULO LÓGICO: COMPORTAMENTO DO MENU (SIDEBAR)
===================================================== */

document.getElementById("btn-menu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("closed");
});


document.querySelectorAll(".sidebar button[data-sec]").forEach(btn => {
    btn.addEventListener("click", () => {
        mostrarSecao(btn.dataset.sec);

        // Se estiver no telemóvel, fecha o menu automaticamente após o clique
        if (window.innerWidth <= 850) {
            document.getElementById("sidebar").classList.add("closed");
        }
    });
});


function mostrarSecao(nome) {
    // Remove o estado ativo de todas as secções
    document.querySelectorAll(".secao").forEach(s => s.classList.remove("active"));

    // Exibe a secção selecionada pelo ID estrutural
    const sec = document.getElementById("sec-" + nome);
    if (sec) sec.classList.add("active");

    // Atualiza visualmente o botão ativo no menu lateral
    document.querySelectorAll(".sidebar button[data-sec]").forEach(b => {
        b.classList.toggle("active", b.dataset.sec === nome);
    });
}


/* =====================================================
   MÓDULO LÓGICO: ENCERRAR SESSÃO (LOGOUT)
===================================================== */

document.getElementById("btn-logout").addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao efetuar logout seguro:", error);
    }
});


/* =====================================================
   MÓDULO LÓGICO: DICIONÁRIO E SELEÇÃO DE IDIOMA
===================================================== */

document.getElementById("select-idioma").addEventListener("change", e => {
    aplicarIdioma(e.target.value);
});


function aplicarIdioma(idioma) {
    const d = IDIOMAS[idioma] || IDIOMAS.pt;

    const mapa = {
        inicio: d.inicio,
        pos: "Ponto de Venda",
        vendas: d.vendas,
        produtos: d.produtos,
        inventario: d.inventario,
        compras: d.compras,
        fornecedores: d.fornecedores,
        clientes: d.clientes,
        dividas: "Fiado / Dívidas",
        encomendas: "Encomendas",
        caixa: "Caixa / Turnos",
        despesas: "Despesas",
        relatorios: d.relatorios,
        funcionarios: "Funcionários",
        ramos: "Ramos",
        auditoria: "Auditoria",
        subscricao: d.subscricao,
        config: "Configurações"
    };

    Object.entries(mapa).forEach(([id, text]) => {
        const btn = document.querySelector(`.sidebar button[data-sec="${id}"]`);
        if (btn) btn.textContent = text;
    });
}


/* =====================================================
   MÓDULO LÓGICO: GESTÃO MULTIEMPRESA DE RAMOS
===================================================== */

function renderRamos() {
    // Junta os ramos padrão com os ramos personalizados que esta empresa
    // já tenha adicionado (empresa.ramos_atividade), sem duplicados.
    const personalizados = FABEF.empresa?.ramos_atividade || [];
    RAMOS = Array.from(new Set([...RAMOS_PADRAO, ...personalizados]));

    const selects = [
        document.getElementById("select-ramo"),
        document.getElementById("ramo-pagina")
    ];

    selects.forEach(select => {
        if (!select) return;

        select.innerHTML = RAMOS.map(r => 
            `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`
        ).join("");

        select.value = FABEF.ramo;
    });

    // Injeta as sugestões como checkboxes, para o gerente poder selecionar
    // várias de uma vez e adicionar tudo junto (evita ter de escrever cada
    // atividade manualmente quando o ramo já tem sugestões prontas).
    const sugestoesDoRamo = (SUGESTOES[FABEF.ramo] || []).filter(nome =>
        !FABEF.produtos.some(p => p.ramo === FABEF.ramo && String(p.nome || "").toLowerCase() === nome.toLowerCase())
    );

    const containerSugestoes = document.getElementById("sugestoes-ramo");
    if (sugestoesDoRamo.length === 0) {
        const totalSugestoes = (SUGESTOES[FABEF.ramo] || []).length;
        containerSugestoes.innerHTML = totalSugestoes > 0
            ? `<p style="color:#10b981;font-size:13px;">✔️ Já adicionou todas as sugestões prontas para este ramo.</p>`
            : `<p style="color:#64748b;font-size:13px;">Ainda não há sugestões rápidas para este ramo. Pode criar os seus produtos manualmente na página "Produtos".</p>`;
    } else {
        containerSugestoes.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <label style="font-size:13px;"><input type="checkbox" id="sugestao-marcar-todas" style="width:auto;"> Marcar todas</label>
                <button id="btn-adicionar-sugestoes-selecionadas" class="btn btn-primary btn-small" type="button">+ Adicionar selecionadas</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${sugestoesDoRamo.map(nome => `
                    <label class="btn btn-light btn-small" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                        <input type="checkbox" class="check-sugestao" value="${escapeHTML(nome)}" style="width:auto;">
                        ${escapeHTML(nome)}
                    </label>
                `).join("")}
            </div>
        `;

        document.getElementById("sugestao-marcar-todas")?.addEventListener("change", (e) => {
            document.querySelectorAll(".check-sugestao").forEach(cb => cb.checked = e.target.checked);
        });

        document.getElementById("btn-adicionar-sugestoes-selecionadas")?.addEventListener("click", async () => {
            const selecionadas = Array.from(document.querySelectorAll(".check-sugestao:checked")).map(cb => cb.value);
            if (selecionadas.length === 0) { alert("Marque pelo menos uma sugestão para adicionar."); return; }
            for (const nome of selecionadas) {
                await criarProdutoSugestao(nome, true);
            }
            renderRamos();
            alert(`${selecionadas.length} atividade(s) adicionada(s). Vá à página "Produtos" para definir os preços de cada uma.`);
        });
    }
}


document.getElementById("select-ramo").addEventListener("change", e => mudarRamo(e.target.value));
document.getElementById("ramo-pagina").addEventListener("change", e => mudarRamo(e.target.value));


/* =====================================================
   MÓDULO LÓGICO: RAMOS PERSONALIZADOS
   Permite ao gerente adicionar um ramo de atividade que não
   está na lista padrão (ex: um negócio muito específico).
===================================================== */
document.getElementById("btn-adicionar-ramo")?.addEventListener("click", adicionarRamoPersonalizado);

async function adicionarRamoPersonalizado() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o gerente pode adicionar novos ramos de atividade.");
        return;
    }

    const input = document.getElementById("novo-ramo-nome");
    const nome = input?.value.trim();
    if (!nome) { alert("Introduza o nome do novo ramo."); return; }
    if (RAMOS.some(r => r.toLowerCase() === nome.toLowerCase())) {
        alert("Este ramo já existe na lista.");
        return;
    }

    try {
        await updateDoc(empresaRef(), {
            ramos_atividade: arrayUnion(nome),
            ramo_ativo: nome,
            atualizadoEm: serverTimestamp()
        });

        FABEF.empresa.ramos_atividade = [...(FABEF.empresa.ramos_atividade || []), nome];
        FABEF.ramo = nome;
        if (input) input.value = "";

        renderTudo();
        await gravarAuditoria("Adicionou um novo ramo de atividade personalizado: " + nome, "INFO");
    } catch (error) {
        console.error(error);
        alert("Não foi possível adicionar o ramo.\n" + mensagemFirebase(error));
    }
}


async function mudarRamo(ramo) {
    if (!RAMOS.includes(ramo)) return;

    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Só o gerente pode mudar o ramo de atividade.");
        // Repõe o valor visual dos selects para o ramo atual (evita ficar "preso" na opção errada)
        renderRamos();
        return;
    }

    try {
        await updateDoc(empresaRef(), {
            ramo_ativo: ramo,
            atualizadoEm: serverTimestamp()
        });

        FABEF.ramo = ramo;
        await ouvirCaixa(); // reescuta o caixa já isolado para o novo ramo
        renderTudo();

        // Escreve de forma persistente a alteração nos registos de auditoria
        await gravarAuditoria("Alterou o ramo activo para " + ramo, "INFO");
    } catch (error) {
        console.error(error);
        alert("Não foi possível alterar o ramo.\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÓDULO LÓGICO: CRIAR PRODUTO VIA SUGESTÃO RÁPIDA
===================================================== */

async function criarProdutoSugestao(nome, silencioso) {
    const existe = FABEF.produtos.some(p => 
        p.ramo === FABEF.ramo &&
        String(p.nome || "").toLowerCase() === nome.toLowerCase()
    );

    if (existe) {
        if (!silencioso) alert("Este produto já existe neste ramo.");
        return;
    }

    try {
        const payload = {
            nome: nome,
            categoria: "Sugestão",
            codigo: "",
            custo: 0,
            preco: 0,
            stock: 0,
            stockMinimo: 5,
            ramo: FABEF.ramo,
            ativo: true,
            criadoPor: FABEF.user.uid,
            dataCriacao: serverTimestamp()
        };

        const ref = await addDoc(subRef("produtos"), payload);

        // Atualiza a memória local mantendo a integridade estrutural
        FABEF.produtos.push({
            id: ref.id,
            nome: payload.nome,
            categoria: payload.categoria,
            codigo: payload.codigo,
            custo: payload.custo,
            preco: payload.preco,
            stock: payload.stock,
            stockMinimo: payload.stockMinimo,
            ramo: payload.ramo,
            ativo: payload.ativo
        });

        if (!silencioso) renderTudo();
        await gravarAuditoria("Adicionou produto sugerido: " + nome, "INFO");
    } catch (error) {
        console.error(error);
        if (!silencioso) alert("Não foi possível adicionar o produto.\n" + mensagemFirebase(error));
    }
}
/* =====================================================
   MÓDULO LÓGICO: INTERAÇÃO DA JANELA MODAL DE PRODUTOS
===================================================== */

document.getElementById("btn-novo-produto").addEventListener("click", () => {
    limparProdutoForm();
    document.getElementById("modal-produto").classList.add("show");
});


document.getElementById("btn-salvar-produto").addEventListener("click", salvarProduto);


/* =====================================================
   MÓDULO LÓGICO: GRAVAÇÃO E VALIDAÇÃO DE PRODUTO
===================================================== */

async function salvarProduto() {
    const nome = document.getElementById("novo-produto-nome").value.trim();
    const categoria = document.getElementById("novo-produto-categoria").value.trim();
    const codigo = document.getElementById("novo-produto-codigo").value.trim();
    const custo = numero(document.getElementById("novo-produto-custo").value);
    const preco = numero(document.getElementById("novo-produto-preco").value);
    const stock = numero(document.getElementById("novo-produto-stock").value);
    const minimo = numero(document.getElementById("novo-produto-minimo").value);
    const unidade = document.getElementById("novo-produto-unidade")?.value || "unidade";
    const foto = document.getElementById("novo-produto-foto")?.value.trim() || "";
    const tamanho = document.getElementById("novo-produto-tamanho")?.value.trim() || "";
    const cor = document.getElementById("novo-produto-cor")?.value.trim() || "";
    const destaque = document.getElementById("novo-produto-destaque")?.checked || false;

    // Validação de segurança básica para integridade de dados
    if (!nome) {
        alert("Introduza o nome do produto.");
        return;
    }

    if (stock < 0 || custo < 0 || preco < 0 || minimo < 0) {
        alert("Os valores monetários ou de inventário não podem ser negativos.");
        return;
    }

    // Alerta de margem de lucro negativa ou nula
    if (preco < custo) {
        if (!confirm("O preço de venda é inferior ao custo de aquisição. Deseja continuar mesmo assim?")) {
            return;
        }
    }

    try {
        const payload = {
            nome: nome,
            categoria: categoria,
            codigo: codigo,
            custo: custo,
            preco: preco,
            stock: stock,
            stockMinimo: minimo,
            unidade: unidade,
            foto: foto,
            tamanho: tamanho,
            cor: cor,
            destaque: destaque,
            ramo: FABEF.ramo,
            ativo: true,
            criadoPor: FABEF.user.uid,
            dataCriacao: serverTimestamp()
        };

        const ref = await addDoc(subRef("produtos"), payload);

        // Atualização síncrona da memória em cache do navegador
        FABEF.produtos.push({
            id: ref.id,
            nome: payload.nome,
            categoria: payload.categoria,
            codigo: payload.codigo,
            custo: payload.custo,
            preco: payload.preco,
            stock: payload.stock,
            stockMinimo: payload.stockMinimo,
            unidade: payload.unidade,
            foto: payload.foto,
            tamanho: payload.tamanho,
            cor: payload.cor,
            destaque: payload.destaque,
            ramo: payload.ramo,
            ativo: payload.ativo
        });

        fecharModal("modal-produto");
        renderTudo();

        // Registo inalterável do log de auditoria do sistema
        await gravarAuditoria("Criou o produto no catálogo: " + nome, "INFO");
        alert("Produto criado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar o produto na base de dados:\n" + mensagemFirebase(error));
    }
}


function limparProdutoForm() {
    const campos = [
        "novo-produto-nome",
        "novo-produto-categoria",
        "novo-produto-codigo",
        "novo-produto-custo",
        "novo-produto-preco",
        "novo-produto-stock"
    ];

    campos.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });

    const stockMinimoInput = document.getElementById("novo-produto-minimo");
    if (stockMinimoInput) stockMinimoInput.value = "5";
}


/* =====================================================
   MÓDULO LÓGICO: FILTRAGEM E RENDER DO CATÁLOGO
===================================================== */

document.getElementById("produto-pesquisa").addEventListener("input", renderProdutos);


window.abrirModalEditarProduto = function(id) {
    const p=FABEF.produtos.find(x=>x.id===id); if(!p)return;
    document.getElementById("edit-produto-id").value=p.id;
    document.getElementById("edit-produto-nome").value=p.nome||"";
    document.getElementById("edit-produto-categoria").value=p.categoria||"";
    document.getElementById("edit-produto-codigo").value=p.codigo||"";
    document.getElementById("edit-produto-custo").value=numero(p.custo);
    document.getElementById("edit-produto-preco").value=numero(p.preco);
    document.getElementById("edit-produto-stock").value=numero(p.stock);
    document.getElementById("edit-produto-minimo").value=numero(p.stockMinimo||p.minimo||5);
    if (document.getElementById("edit-produto-unidade")) document.getElementById("edit-produto-unidade").value = p.unidade || "unidade";
    if (document.getElementById("edit-produto-foto")) document.getElementById("edit-produto-foto").value = p.foto || "";
    if (document.getElementById("edit-produto-tamanho")) document.getElementById("edit-produto-tamanho").value = p.tamanho || "";
    if (document.getElementById("edit-produto-cor")) document.getElementById("edit-produto-cor").value = p.cor || "";
    if (document.getElementById("edit-produto-destaque")) document.getElementById("edit-produto-destaque").checked = !!p.destaque;
    const gerente=(FABEF.userData?.perfil||FABEF.userData?.role)==="gerente";
    const eliminar=document.getElementById("btn-eliminar-produto");
    if(eliminar){eliminar.style.display=gerente?"block":"none";eliminar.disabled=!gerente;}
    ["edit-produto-custo","edit-produto-stock"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!gerente;});
    document.getElementById("modal-editar-produto")?.classList.add("show");
};

async function salvarEdicaoProduto(){
    const id=document.getElementById("edit-produto-id").value; const p=FABEF.produtos.find(x=>x.id===id); if(!p)return;
    const gerente=(FABEF.userData?.perfil||FABEF.userData?.role)==="gerente";
    const payload={nome:document.getElementById("edit-produto-nome").value.trim(),categoria:document.getElementById("edit-produto-categoria").value.trim(),codigo:document.getElementById("edit-produto-codigo").value.trim(),preco:numero(document.getElementById("edit-produto-preco").value),stockMinimo:numero(document.getElementById("edit-produto-minimo").value),unidade:document.getElementById("edit-produto-unidade")?.value||"unidade",foto:document.getElementById("edit-produto-foto")?.value.trim()||"",tamanho:document.getElementById("edit-produto-tamanho")?.value.trim()||"",cor:document.getElementById("edit-produto-cor")?.value.trim()||"",destaque:document.getElementById("edit-produto-destaque")?.checked||false,atualizadoEm:serverTimestamp()};
    if(!payload.nome){alert("Introduza o nome do produto.");return;}
    if(gerente){payload.custo=numero(document.getElementById("edit-produto-custo").value);payload.stock=numero(document.getElementById("edit-produto-stock").value);}
    try{await updateDoc(produtoRef(id),payload);Object.assign(p,payload);delete p.atualizadoEm;renderTudo();fecharModal("modal-editar-produto");await gravarAuditoria("Editou o produto: "+payload.nome,"INFO");}catch(error){console.error(error);alert("Erro ao editar o produto:\n"+mensagemFirebase(error));}
}

async function eliminarProduto(){
    if((FABEF.userData?.perfil||FABEF.userData?.role)!=="gerente"){alert("Apenas o gerente pode eliminar produtos.");return;}
    const id=document.getElementById("edit-produto-id").value; const p=FABEF.produtos.find(x=>x.id===id); if(!p)return;
    if(!confirm(`Deseja eliminar o produto "${p.nome}"?`))return;
    try{await deleteDoc(produtoRef(id));FABEF.produtos=FABEF.produtos.filter(x=>x.id!==id);fecharModal("modal-editar-produto");renderTudo();await gravarAuditoria("Eliminou o produto: "+p.nome,"INFO");}catch(error){console.error(error);alert("Erro ao eliminar o produto:\n"+mensagemFirebase(error));}
}

document.getElementById("btn-salvar-edicao-produto")?.addEventListener("click",salvarEdicaoProduto);
document.getElementById("btn-eliminar-produto")?.addEventListener("click",eliminarProduto);

function renderProdutos() {
    const pesquisa = document.getElementById("produto-pesquisa").value.toLowerCase();

    // Filtra primeiro pelo ramo activo, depois pela pesquisa de nome/código
    const produtosFiltrados = FABEF.produtos.filter(p => {
        return p.ramo === FABEF.ramo && (!pesquisa ||
            String(p.nome || "").toLowerCase().includes(pesquisa) ||
            String(p.codigo || "").toLowerCase().includes(pesquisa));
    });

    const tabelaCorpo = document.getElementById("tabela-produtos");
    if (!tabelaCorpo) return;

    const ehGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    tabelaCorpo.innerHTML = produtosFiltrados.map(p => {
        const stock = numero(p.stock);
        const minimo = numero(p.stockMinimo);
        const baixo = stock <= minimo;
        const corStock = baixo ? "#ef4444" : "#10b981";

        return `
        <tr>
            <td><strong>${escapeHTML(p.nome)}</strong></td>
            <td>${escapeHTML(p.codigo || "—")}</td>
            <td>${ehGerente ? dinheiro(p.custo) : "—"}</td>
            <td>${dinheiro(p.preco)}</td>
            <td 
                class="stock-click" 
                style="color: ${corStock}; font-weight: 900;" 
                title="Clique para ver os lotes deste stock" 
                data-stock-id="${escapeHTML(p.id)}" 
                data-stock-nome="${escapeHTML(p.nome)}"
            >
                ${stock}
            </td>
            <td>${minimo}</td>
            <td>${escapeHTML(p.ramo || "—")}</td>
            <td>
                ${baixo ? 
                    '<span class="badge badge-red">STOCK BAIXO</span>' : 
                    '<span class="badge badge-green">NORMAL</span>'
                }
            </td>
            <td>
                <button class="btn btn-light btn-small" type="button" onclick="abrirModalEditarProduto('${escapeHTML(p.id)}')">✏️ Editar</button>
            </td>
        </tr>
        `;
    }).join("") || `
    <tr>
        <td colspan="9" style="text-align: center; color: #64748b;">
            Nenhum produto encontrado no catálogo deste ramo.
        </td>
    </tr>
    `;

    // Vincula dinamicamente os escutadores para o ecrã de rastreabilidade de lotes
    document.querySelectorAll("[data-stock-id]").forEach(td => {
        td.addEventListener("click", () => {
            abrirRastreabilidadeDeLotes(td.dataset.stockId, td.dataset.stockNome);
        });
    });
}
/* =====================================================
   MÓDULO LÓGICO: CÁLCULOS E RENDERIZAÇÃO DE INVENTÁRIO
===================================================== */

function renderInventario() {
    // Só considera o inventário do ramo actualmente ativo
    const produtos = FABEF.produtos.filter(p => p.ramo === FABEF.ramo);

    // Calcula de forma somatória o total de itens físicos em stock
    const unidades = produtos.reduce((s, p) => s + numero(p.stock), 0);

    // Filtra e contabiliza quantos artigos atingiram o nível de stock crítico (mas ainda têm stock)
    const baixos = produtos.filter(p => numero(p.stock) > 0 && numero(p.stock) <= numero(p.stockMinimo)).length;

    // Produtos totalmente esgotados (stock zero ou negativo)
    const esgotados = produtos.filter(p => numero(p.stock) <= 0).length;

    // Executa a valoração monetária do stock baseado no preço de custo
    const custo = produtos.reduce((s, p) => s + (numero(p.stock) * numero(p.custo)), 0);

    const ehGerenteInv = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    // Atualiza os cartões de sumário de indicadores no topo do painel
    document.getElementById("inv-total-artigos").textContent = produtos.length;
    document.getElementById("inv-total-unidades").textContent = unidades;
    document.getElementById("inv-stock-baixo").textContent = baixos;
    if (document.getElementById("inv-esgotados")) document.getElementById("inv-esgotados").textContent = esgotados;
    document.getElementById("inv-valor-custo").textContent = ehGerenteInv ? dinheiro(custo) : "—";

    const tabelaCorpo = document.getElementById("tabela-inventario");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = produtos.map(p => {
        const stock = numero(p.stock);
        const minimo = numero(p.stockMinimo);
        const esgotado = stock <= 0;
        const baixo = !esgotado && stock <= minimo;
        const corStock = esgotado ? "#ef4444" : (baixo ? "#f59e0b" : "#10b981");

        return `
        <tr>
            <td><strong>${escapeHTML(p.nome)}</strong></td>
            <td>${escapeHTML(p.categoria || "—")}</td>
            <td 
                class="stock-click" 
                style="color: ${corStock}; font-weight: 900;" 
                data-stock-id="${escapeHTML(p.id)}" 
                data-stock-nome="${escapeHTML(p.nome)}"
            >
                ${stock}
            </td>
            <td>${minimo}</td>
            <td>${ehGerenteInv ? dinheiro(p.custo) : "—"}</td>
            <td>${ehGerenteInv ? dinheiro(stock * numero(p.custo)) : "—"}</td>
            <td>
                ${esgotado ?
                    '<span class="badge badge-red">ESGOTADO</span>' :
                    (baixo ?
                        '<span class="badge badge-yellow">STOCK BAIXO</span>' :
                        '<span class="badge badge-green">NORMAL</span>')
                }
            </td>
            <td><button class="btn btn-light btn-small" type="button" onclick="abrirModalAjusteStock('${escapeHTML(p.id)}')">⚙️ Ajustar</button></td>
        </tr>
        `;
    }).join("") || `
    <tr>
        <td colspan="8" style="text-align: center; color: #64748b;">
            Nenhum produto cadastrado para inventário neste ramo.
        </td>
    </tr>
    `;

    // Vincula dinamicamente os escutadores de evento à tabela de inventário
    document.querySelectorAll("#tabela-inventario [data-stock-id]").forEach(td => {
        td.addEventListener("click", () => {
            abrirRastreabilidadeDeLotes(td.dataset.stockId, td.dataset.stockNome);
        });
    });
}


/* =====================================================
   MÓDULO LÓGICO: AJUSTE MANUAL DE STOCK (ENTRADA / SAÍDA / PERDA)
   Só o gerente pode autorizar — conforme pedido explicitamente.
   Cada ajuste fica gravado em empresas/{id}/ajustes_stock e na
   auditoria, com o valor anterior e o valor novo.
===================================================== */

window.abrirModalAjusteStock = function(id) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o gerente pode autorizar ajustes de stock (perdas, avarias ou correções manuais).");
        return;
    }
    const p = FABEF.produtos.find(x => x.id === id);
    if (!p) return;

    document.getElementById("ajuste-produto-id").value = p.id;
    document.getElementById("ajuste-produto-nome").textContent = p.nome + " — stock atual: " + numero(p.stock);
    document.getElementById("ajuste-quantidade").value = "";
    document.getElementById("ajuste-motivo").value = "";
    document.getElementById("modal-ajuste-stock")?.classList.add("show");
};

document.getElementById("btn-confirmar-ajuste-stock")?.addEventListener("click", confirmarAjusteStock);

async function confirmarAjusteStock() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Só o gerente pode autorizar ajustes de stock (entrada, saída ou perda/avaria).");
        return;
    }

    const id = document.getElementById("ajuste-produto-id").value;
    const tipo = document.getElementById("ajuste-tipo").value; // entrada | saida | perda
    const quantidade = numero(document.getElementById("ajuste-quantidade").value);
    const motivo = document.getElementById("ajuste-motivo").value.trim();

    const produto = FABEF.produtos.find(p => p.id === id);
    if (!produto) return;

    if (quantidade <= 0) { alert("A quantidade deve ser superior a zero."); return; }
    if (!motivo) { alert("Descreva o motivo do ajuste (obrigatório para auditoria)."); return; }
    if (!confirm(`Confirma o ajuste de stock de "${produto.nome}"?\n\nEsta ação fica registada com o seu nome, data e motivo.`)) return;

    try {
        const stockAnterior = numero(produto.stock);
        const diferenca = (tipo === "entrada") ? quantidade : -quantidade;
        const stockNovo = Math.max(0, stockAnterior + diferenca);

        // COMPATÍVEL COM OFFLINE: increment() em vez de transação
        await updateDoc(produtoRef(id), { stock: increment(diferenca), atualizadoEm: serverTimestamp() });

        produto.stock = stockNovo;

        const tipoTexto = { entrada: "Entrada manual", saida: "Saída manual", perda: "Perda / Avaria" }[tipo] || tipo;

        await addDoc(subRef("ajustes_stock"), {
            produtoId: id,
            produtoNome: produto.nome,
            tipo: tipoTexto,
            quantidade: quantidade,
            stockAnterior: stockAnterior,
            stockNovo: stockNovo,
            motivo: motivo,
            autorizadoPor: FABEF.userData?.nome || FABEF.user.email,
            criadoPor: FABEF.user.uid,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        });

        fecharModal("modal-ajuste-stock");
        renderTudo();

        await gravarAuditoria(
            `Ajuste de stock (${tipoTexto}) em "${produto.nome}": ${stockAnterior} → ${stockNovo} (motivo: ${motivo})`,
            tipo === "perda" ? "AVISO" : "INFO"
        );
        alert("Ajuste de stock registado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao ajustar o stock:\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÓDULO LÓGICO: RASTREABILIDADE SEGURA DE LOTES (AUDITORIA)
   =====================================================
*/

window.abrirRastreabilidadeDeLotes = function (idProduto, nomeProduto) {
    const modal = document.getElementById("modal-detalhe-stock");
    const corpo = document.getElementById("md-tabela-lotes-corpo");
    const resumo = document.getElementById("md-resumo-stock");

    if (!modal || !corpo || !resumo) return;

    document.getElementById("md-titulo-produto").textContent = "📋 Histórico de Lotes: " + nomeProduto;
    modal.classList.add("show");

    // Usa diretamente os dados já sincronizados em FABEF.compras (memória local),
    // em vez de fazer uma nova consulta ao Firestore — isto garante que funciona
    // também offline, já que uma consulta nova com where+orderBy não é fiável
    // a partir da cache quando não há internet.
    const produto = FABEF.produtos.find(p => p.id === idProduto);

    const lotes = FABEF.compras
        .filter(c => c.produtoId === idProduto)
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    if (lotes.length === 0) {
        corpo.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; color: #64748b;">
                Nenhum lote ou compra registada para este artigo.
            </td>
        </tr>
        `;
        resumo.textContent = "Stock actual: " + numero(produto?.stock) + " unidade(s). O stock inicial pode ter sido inserido manualmente.";
        return;
    }

    let totalComprado = 0;
    let html = "";

    lotes.forEach(lote => {
        const qtd = numero(lote.quantidade);
        const custoLote = numero(lote.custoUnitario ?? lote.custo);

        totalComprado += qtd;

        html += `
        <tr>
            <td>${dataTexto(lote.data)}</td>
            <td><strong>${escapeHTML(lote.fornecedorNome || lote.fornecedor || "Grossista Geral")}</strong></td>
            <td>${qtd}</td>
            <td>${dinheiro(custoLote)}</td>
            <td>${dinheiro(qtd * custoLote)}</td>
        </tr>
        `;
    });

    corpo.innerHTML = html;
    resumo.innerHTML = `Stock actual: <strong>${numero(produto?.stock)}</strong> | Total comprado registado: <strong>${totalComprado}</strong>`;
};
/* =====================================================
   MÓDULO LÓGICO: GESTÃO E FILTRAGEM DE COMPRAS / ENTRADAS
===================================================== */

function preencherProdutosCompra() {
    const select = document.getElementById("compra-produto");
    if (!select) return;

    select.innerHTML = `
    <option value="">Seleccione o produto</option>
    ` + FABEF.produtos
        .filter(p => p.ramo === FABEF.ramo)
        .map(p => `
        <option value="${escapeHTML(p.id)}">
            ${escapeHTML(p.nome)}
        </option>
        `).join("");
}


document.getElementById("btn-registar-compra").addEventListener("click", registarCompra);


/* =====================================================
   MÓDULO LÓGICO: GRAVAÇÃO ATÓMICA DE COMPRA E INVENTÁRIO
===================================================== */

async function registarCompra() {
    const produtoId = document.getElementById("compra-produto").value;
    const fornecedor = document.getElementById("compra-fornecedor").value.trim();
    const quantidade = numero(document.getElementById("compra-quantidade").value);
    const custo = numero(document.getElementById("compra-custo").value);
    const pagamento = document.getElementById("compra-pagamento")?.value || "Dinheiro";

    // Validação rígida dos dados de entrada
    if (!produtoId || !fornecedor || quantidade <= 0 || custo < 0) {
        alert("Preencha correctamente todos os dados obrigatórios da compra.");
        return;
    }

    const produto = FABEF.produtos.find(p => p.id === produtoId);
    if (!produto) {
        alert("O produto seleccionado não foi encontrado no sistema.");
        return;
    }

    try {
        const dataStr = new Date().toISOString();
        const totalCompra = quantidade * custo;

        const compra = {
            produtoId: produtoId,
            produtoNome: produto.nome,
            quantidade: quantidade,
            custoUnitario: custo,
            fornecedorNome: fornecedor,
            pagamento: pagamento,
            ramo: FABEF.ramo,
            data: dataStr,
            criadoPor: FABEF.user.uid,
            criadoEm: serverTimestamp()
        };

        // Grava o histórico de compras de forma isolada
        const ref = await addDoc(subRef("compras"), compra);
        FABEF.compras.push({ id: ref.id, ...compra });

        // Se a compra foi feita a crédito, regista/atualiza a dívida ao fornecedor
        if (pagamento === "Credito") {
            const fornecedorExistente = FABEF.fornecedores.find(f => (f.nome || "").toLowerCase() === fornecedor.toLowerCase());
            if (fornecedorExistente) {
                const novaDivida = numero(fornecedorExistente.divida) + totalCompra;
                await updateDoc(doc(db, "empresas", FABEF.empresaId, "fornecedores", fornecedorExistente.id), {
                    divida: novaDivida,
                    atualizadoEm: serverTimestamp()
                });
                fornecedorExistente.divida = novaDivida;
            } else {
                const payloadFornecedor = {
                    nome: fornecedor,
                    telefone: "",
                    observacao: "Criado automaticamente a partir de uma compra a crédito.",
                    divida: totalCompra,
                    ramo: FABEF.ramo,
                    criadoPor: FABEF.user.uid,
                    data: dataStr,
                    criadoEm: serverTimestamp()
                };
                const refForn = await addDoc(subRef("fornecedores"), payloadFornecedor);
                FABEF.fornecedores.push({ id: refForn.id, ...payloadFornecedor });
            }
        }

        /*
         COMPATÍVEL COM OFFLINE: soma o stock com increment() em vez de uma
         transação (que precisa de internet). O preço de custo é atualizado
         normalmente a seguir.
        */
        await updateDoc(produtoRef(produtoId), {
            stock: increment(quantidade),
            custo: custo,
            atualizadoEm: serverTimestamp()
        });

        // Atualiza de forma síncrona os dados em cache local na memória do navegador
        produto.stock = numero(produto.stock) + quantidade;
        produto.custo = custo;

        // Limpa os campos do formulário para o próximo registo
        document.getElementById("compra-fornecedor").value = "";
        document.getElementById("compra-quantidade").value = "";
        document.getElementById("compra-custo").value = "";

        renderTudo();

        // Regista a movimentação financeira de entrada nos logs de auditoria
        await gravarAuditoria("Registou compra de " + quantidade + " unidades do artigo: " + produto.nome, "INFO");
        alert("Compra registada com sucesso e stock atualizado na base de dados.");

    } catch (error) {
        console.error("Erro crítico ao processar transação de compra:", error);
        alert("Erro ao registar a compra de mercadoria:\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÓDULO LÓGICO: RENDERIZAÇÃO DA TABELA DE ENTRADAS
===================================================== */

function renderCompras() {
    const lista = FABEF.compras
        .slice()
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    const tabelaCorpo = document.getElementById("tabela-compras");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = lista.map(c => `
    <tr>
        <td>${dataTexto(c.data)}</td>
        <td>${escapeHTML(c.produtoNome || "—")}</td>
        <td>${escapeHTML(c.fornecedorNome || "—")}</td>
        <td>${numero(c.quantidade)}</td>
        <td>${dinheiro(c.custoUnitario)}</td>
        <td>${dinheiro(numero(c.quantidade) * numero(c.custoUnitario))}</td>
    </tr>
    `).join("") || `
    <tr>
        <td colspan="6" style="text-align: center; color: #64748b;">
            Nenhuma operação de compra registada para este negócio.
        </td>
    </tr>
    `;
}


/* =====================================================
   MÓDULO LÓGICO: PONTO DE VENDA (POS FLUXO DE CAIXA)
===================================================== */

document.getElementById("pos-pesquisa").addEventListener("input", renderPOS);


function renderPOS() {
    const pesquisa = document.getElementById("pos-pesquisa").value.toLowerCase();

    // Filtra artigos ativos pertencentes estritamente ao ramo de negócio aberto no ecrã
    const lista = FABEF.produtos.filter(p => {
        return p.ativo !== false &&
            p.ramo === FABEF.ramo &&
            (!pesquisa ||
                String(p.nome || "").toLowerCase().includes(pesquisa) ||
                String(p.codigo || "").toLowerCase().includes(pesquisa));
    });

    const containerPOS = document.getElementById("produtos-pos");
    if (!containerPOS) return;

    const caixaFechado = !FABEF.turnoId;

    // Sugestões rápidas marcadas pelo gerente (só aparecem quando não há pesquisa ativa)
    const containerDestaques = document.getElementById("pos-sugestoes-rapidas");
    if (containerDestaques) {
        const destaques = pesquisa ? [] : FABEF.produtos.filter(p => p.ativo !== false && p.ramo === FABEF.ramo && p.destaque);
        containerDestaques.innerHTML = destaques.length ? `
            <p style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">⭐ SUGESTÕES RÁPIDAS</p>
            <div id="pos-sugestoes-rapidas-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));gap:8px;margin-bottom:14px;">
                ${destaques.map(p => `
                <button class="produto-pos" data-pos-produto="${escapeHTML(p.id)}" type="button" ${caixaFechado ? "disabled" : ""} style="border-color:#f59e0b;">
                    <strong>${escapeHTML(p.nome)}</strong>
                    <small>${dinheiro(p.preco)}</small>
                </button>`).join("")}
            </div>` : "";
    }

    containerPOS.innerHTML = lista.map(p => `
    <button
        class="produto-pos"
        data-pos-produto="${escapeHTML(p.id)}"
        type="button"
        ${caixaFechado ? "disabled" : ""}
        title="${caixaFechado ? "Abra o caixa / turno para vender" : "Adicionar ao carrinho"}"
    >
        ${p.foto ? `<img src="${escapeHTML(p.foto)}" alt="" style="width:100%;height:70px;object-fit:cover;border-radius:6px;margin-bottom:4px;" onerror="this.style.display='none';">` : ""}
        <strong>${escapeHTML(p.nome)}</strong>
        <small>${dinheiro(p.preco)}${p.unidade && p.unidade !== "unidade" ? " / " + escapeHTML(p.unidade) : ""}</small>
        <small>Stock: ${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + escapeHTML(p.unidade) : ""}</small>
    </button>
    `).join("") || `
    <div class="alert alert-info" style="width: 100%; text-align: center;">
        Nenhum produto disponível para faturamento neste ramo.
    </div>
    `;

    // Vincula dinamicamente a ação de clique nos cartões injetados para adição rápida
    document.querySelectorAll("[data-pos-produto]").forEach(btn => {
        btn.addEventListener("click", () => adicionarCarrinho(btn.dataset.posProduto));
    });

    // Alimenta a lista de sugestão de clientes já cadastrados (para ligar a venda a um cliente)
    const listaClientesPos = document.getElementById("lista-clientes-pos");
    if (listaClientesPos) {
        listaClientesPos.innerHTML = FABEF.clientes
            .map(c => `<option value="${escapeHTML(c.nome)}">`)
            .join("");
    }

    renderCarrinho();
}


/* =====================================================
   MÓDULO LÓGICO: ADIÇÃO E CONTROLO DE STOCK DO CARRINHO
===================================================== */

async function adicionarCarrinho(id) {
    // A conta de gerente é só de controlo — não regista vendas
    if ((FABEF.userData?.perfil || FABEF.userData?.role) === "gerente") {
        alert("A conta de gerente não pode registar vendas. Entre com uma conta de funcionário.");
        return;
    }

    // Barreira imediata de interface: o estado do caixa já é mantido em tempo real.
    if (!FABEF.turnoId) {
        alert("Operação bloqueada: abra o caixa / turno antes de realizar vendas.");
        atualizarTelaCaixa();
        return;
    }

    const produto = FABEF.produtos.find(p => p.id === id);
    if (!produto) return;

    // Impede o faturamento de artigos sem unidades físicas disponíveis (Venda Negativa Bloqueada)
    if (numero(produto.stock) <= 0) {
        alert("Este produto não possui stock disponível para venda.");
        return;
    }

    const unidadePeso = produto.unidade === "kg" || produto.unidade === "litro";

    // Produtos vendidos por peso/volume pedem a quantidade exata (aceita casas decimais)
    if (unidadePeso) {
        const quantidadeTexto = prompt(`Quantidade em ${produto.unidade} de "${produto.nome}" (stock disponível: ${numero(produto.stock)} ${produto.unidade}):`, "1");
        if (quantidadeTexto === null) return;
        const quantidadeDesejada = numero(quantidadeTexto);
        if (quantidadeDesejada <= 0) return;

        const existentePeso = FABEF.carrinho.find(x => x.produtoId === id);
        const totalPretendido = (existentePeso ? existentePeso.quantidade : 0) + quantidadeDesejada;
        if (totalPretendido > numero(produto.stock)) {
            alert(`Quantidade solicitada (${totalPretendido} ${produto.unidade}) superior ao stock físico disponível (${numero(produto.stock)} ${produto.unidade}).`);
            return;
        }

        if (existentePeso) {
            existentePeso.quantidade = totalPretendido;
        } else {
            FABEF.carrinho.push({
                produtoId: id,
                nome: produto.nome,
                preco: numero(produto.preco),
                unidade: produto.unidade,
                quantidade: quantidadeDesejada
            });
        }
        renderCarrinho();
        return;
    }

    const existente = FABEF.carrinho.find(x => x.produtoId === id);

    if (existente) {
        // Bloqueia se a quantidade pretendida ultrapassar o stock real em cache
        if (existente.quantidade + 1 > numero(produto.stock)) {
            alert("Quantidade solicitada superior ao stock físico disponível no estabelecimento.");
            return;
        }
        existente.quantidade++;
    } else {
        // Insere o primeiro item mapeando as propriedades comerciais do catálogo
        FABEF.carrinho.push({
            produtoId: id,
            nome: produto.nome,
            preco: numero(produto.preco),
            unidade: produto.unidade || "unidade",
            quantidade: 1
        });
    }

    renderCarrinho();
}


/* =====================================================
   MÓDULO LÓGICO: DESENHO DO CARRINHO DE COMPRAS
===================================================== */

/* =====================================================
   MÓDULO LÓGICO: EXECUÇÃO E RENDERIZAÇÃO DO CARRINHO
===================================================== */

function renderCarrinho() {
    const corpo = document.getElementById("carrinho-corpo");
    const totalSpan = document.getElementById("cart-total");
    
    if (!corpo || !totalSpan) return;

    if (!FABEF.carrinho || FABEF.carrinho.length === 0) {
        corpo.innerHTML = `<div class="alert alert-info">Carrinho vazio.</div>`;
        totalSpan.textContent = "MT 0,00";
        return;
    }

    let totalAcumulado = 0;

    corpo.innerHTML = FABEF.carrinho.map((item, index) => {
        const subtotal = numero(item.preco) * numero(item.quantidade);
        totalAcumulado += subtotal;

        return `
        <div class="cart-item">
            <div class="cart-info">
                <strong>${escapeHTML(item.nome)}</strong><br>
                <small>${numero(item.quantidade)}${item.unidade && item.unidade !== "unidade" ? " " + escapeHTML(item.unidade) : ""} × ${dinheiro(item.preco)}</small>
            </div>
            <div style="font-weight: 700; font-size: 13px; margin-right: 5px;">
                ${dinheiro(subtotal)}
            </div>
            <button 
                class="btn btn-danger btn-small" 
                style="padding: 2px 6px; font-size: 11px;" 
                onclick="removerItemCarrinho(${index})"
                type="button"
            >
                ✕
            </button>
        </div>
        `;
    }).join("");

    totalSpan.textContent = dinheiro(totalAcumulado);
}


window.removerItemCarrinho = function(index) {
    if (FABEF.carrinho[index]) {
        FABEF.carrinho.splice(index, 1);
        renderCarrinho();
    }
};


document.getElementById("btn-limpar-carrinho")?.addEventListener("click", () => {
    FABEF.carrinho = [];
    renderCarrinho();
});


/* =====================================================
   MÓDULO LÓGICO: FINALIZAR VENDA (TRANSAÇÃO ATÓMICA)
===================================================== */

document.getElementById("btn-finalizar-venda").addEventListener("click", finalizarVenda);


/* =====================================================
   MÓDULO LÓGICO: LEITURA DE CÓDIGO DE BARRAS POR CÂMARA
   Usa a biblioteca html5-qrcode (carregada no index.html), que
   descodifica os fotogramas da câmara em JavaScript puro — por
   isso funciona em qualquer navegador (Chrome, Safari/iOS,
   Firefox), ao contrário da função nativa BarcodeDetector.
===================================================== */
let LEITOR_CODIGO_ATIVO = null;

window.abrirLeitorCodigoBarras = async function() {
    if (typeof Html5Qrcode === "undefined") {
        alert("A biblioteca de leitura de código de barras não carregou. Verifique a ligação à internet e recarregue a página.");
        return;
    }

    document.getElementById("modal-leitor-codigo")?.classList.add("show");
    document.getElementById("leitor-codigo-status").textContent = "A iniciar a câmara...";

    try {
        LEITOR_CODIGO_ATIVO = new Html5Qrcode("leitor-codigo-camera");
        await LEITOR_CODIGO_ATIVO.start(
            { facingMode: "environment" }, // câmara traseira do telemóvel
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (codigoDetetado) => processarCodigoDetetado(codigoDetetado),
            () => { /* frame sem código legível: ignora e continua a tentar */ }
        );
        document.getElementById("leitor-codigo-status").textContent = "Aponte a câmara para o código de barras do produto.";
    } catch (error) {
        console.error(error);
        document.getElementById("leitor-codigo-status").textContent =
            "Não foi possível aceder à câmara. Verifique se deu permissão de câmara ao site, e se está a aceder por HTTPS.";
    }
};

window.fecharLeitorCodigoBarras = async function() {
    if (LEITOR_CODIGO_ATIVO) {
        try { await LEITOR_CODIGO_ATIVO.stop(); await LEITOR_CODIGO_ATIVO.clear(); } catch (e) { /* já parado */ }
        LEITOR_CODIGO_ATIVO = null;
    }
    document.getElementById("modal-leitor-codigo")?.classList.remove("show");
};

function processarCodigoDetetado(codigo) {
    const produto = FABEF.produtos.find(p =>
        p.ramo === FABEF.ramo && String(p.codigo || "").trim() === String(codigo).trim()
    );

    if (!produto) {
        document.getElementById("leitor-codigo-status").textContent =
            `Código "${codigo}" lido, mas nenhum produto deste ramo tem esse código registado. A continuar a procurar...`;
        return; // continua a câmara ligada para tentar outro código
    }

    fecharLeitorCodigoBarras();
    adicionarCarrinho(produto.id);
}

document.getElementById("btn-ler-codigo-barras")?.addEventListener("click", abrirLeitorCodigoBarras);


function alternarPagamentoMisto() {
    const marcado = document.getElementById("pos-pagamento-misto")?.checked || false;
    document.getElementById("pos-pagamento-misto-campos")?.classList.toggle("hidden", !marcado);
    const selectForma = document.getElementById("forma-pagamento");
    if (selectForma) selectForma.disabled = marcado;
}
document.getElementById("pos-pagamento-misto")?.addEventListener("change", alternarPagamentoMisto);


async function finalizarVenda() {
    // O estado do caixa já é mantido em tempo real por um listener persistente.
    if (!FABEF.turnoId || FABEF.turno?.estado !== "ABERTO") {
        FABEF.carrinho = [];
        renderCarrinho();
        atualizarTelaCaixa();
        alert("Operação bloqueada: o caixa / turno está fechado. Abra o caixa antes de realizar vendas.");
        return;
    }

    if (!FABEF.carrinho || !FABEF.carrinho.length) {
        alert("O carrinho está vazio. Adicione produtos antes de finalizar.");
        return;
    }

    const misto = document.getElementById("pos-pagamento-misto")?.checked || false;
    const pagamento = misto ? "Misto" : document.getElementById("forma-pagamento").value;
    const nuitCliente = (document.getElementById("pos-nuit-cliente")?.value.trim() || "Isento");
    const nomeClienteVenda = document.getElementById("pos-cliente-nome")?.value.trim() || "";
    if (nuitCliente !== "Isento" && !/^\d{9}$/.test(nuitCliente)) {
        alert("O NUIT do cliente deve conter exatamente 9 dígitos ou ficar em branco.");
        return;
    }
    const total = FABEF.carrinho.reduce((s, x) => s + (numero(x.preco) * numero(x.quantidade)), 0);
    const desconto = Math.min(numero(document.getElementById("pos-desconto")?.value), total);
    const totalComDesconto = total - desconto;

    // ---- Pagamento misto: soma das parcelas tem de bater certo com o total ----
    let detalhePagamento = null;
    let valorDinheiroVenda = pagamento === "Numerário" ? totalComDesconto : 0;
    let valorCreditoVenda = 0;
    if (misto) {
        detalhePagamento = {
            dinheiro: numero(document.getElementById("pos-valor-dinheiro")?.value),
            mpesa: numero(document.getElementById("pos-valor-mpesa")?.value),
            emola: numero(document.getElementById("pos-valor-emola")?.value),
            cartao: numero(document.getElementById("pos-valor-cartao")?.value),
            credito: numero(document.getElementById("pos-valor-credito")?.value)
        };
        const somaParcelas = Object.values(detalhePagamento).reduce((s, v) => s + v, 0);
        if (Math.abs(somaParcelas - totalComDesconto) > 0.5) {
            alert(`A soma das parcelas de pagamento (${dinheiro(somaParcelas)}) tem de ser igual ao total da venda (${dinheiro(totalComDesconto)}).`);
            return;
        }
        if (detalhePagamento.credito > 0 && !nomeClienteVenda) {
            alert("Para deixar uma parte da venda como crédito/fiado, indique o nome do cliente no campo \"Cliente\".");
            return;
        }
        valorDinheiroVenda = detalhePagamento.dinheiro;
        valorCreditoVenda = detalhePagamento.credito;
    }

    try {
        const vendaRef = doc(subRef("vendas"));

        /*
         COMPATÍVEL COM OFFLINE: em vez de uma transação (que exige ligação
         em tempo real ao servidor e falha sem internet), usamos increment(),
         que o Firestore sabe aplicar corretamente mesmo com o pedido em fila
         de espera offline, e resolve sozinho quando a ligação voltar.
         A validação de stock suficiente é feita com os dados mais recentes
         que já temos em cache (FABEF.produtos) — em uso normal com internet
         isto é sempre atualizado; offline, é o melhor que se pode garantir
         sem uma leitura ao servidor.
        */
        const linhas = [];

        for (const item of FABEF.carrinho) {
            const produto = FABEF.produtos.find(p => p.id === item.produtoId);
            if (!produto) throw new Error("Produto não encontrado no catálogo: " + item.nome);

            if (numero(produto.stock) < numero(item.quantidade)) {
                throw new Error("Stock insuficiente no estabelecimento para o artigo: " + item.nome);
            }

            updateDoc(produtoRef(item.produtoId), {
                stock: increment(-numero(item.quantidade)),
                atualizadoEm: serverTimestamp()
            });

            // Reflete de imediato na cache local, para a próxima venda já ver o stock correto
            produto.stock = numero(produto.stock) - numero(item.quantidade);

            linhas.push({
                produtoId: item.produtoId,
                nome: produto.nome,
                quantidade: numero(item.quantidade),
                preco: numero(produto.preco),
                unidade: produto.unidade || "unidade",
                subtotal: numero(item.quantidade) * numero(produto.preco)
            });
        }

        // Grava o documento definitivo histórico da venda (funciona offline: fica em fila)
        await setDoc(vendaRef, {
            total: totalComDesconto,
            subtotal: total,
            desconto: desconto,
            pagamento: pagamento,
            pagamentoDetalhe: detalhePagamento,
            ramo: FABEF.ramo,
            operadorId: FABEF.user.uid,
            operadorNome: FABEF.userData?.nome || FABEF.user.email,
            nuitCliente: nuitCliente,
            cliente: nomeClienteVenda,
            itens: linhas,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        });

        // Atualiza de forma somatória o fluxo financeiro do Turno de Caixa Ativo
        if (FABEF.turnoId) {
            const turnoRef = doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId);
            updateDoc(turnoRef, {
                totalVendas: increment(totalComDesconto),
                totalVendasDinheiro: increment(valorDinheiroVenda),
                atualizadoEm: serverTimestamp()
            });
        }

        // Se parte da venda ficou a crédito, lança/atualiza a conta corrente do cliente
        if (valorCreditoVenda > 0) {
            try {
                const clienteExistente = FABEF.clientes.find(c => c.nome.toLowerCase() === nomeClienteVenda.toLowerCase());
                await registrarOuAtualizarDivida(nomeClienteVenda, clienteExistente?.telefone || "", valorCreditoVenda);
            } catch (erroDivida) {
                console.error(erroDivida);
                alert("A venda foi concluída, mas não foi possível lançar a parcela de crédito na conta do cliente:\n" + erroDivida.message);
            }
        }

        // Limpa o carrinho de compras após a persistência bem-sucedida
        FABEF.carrinho = [];
        const inputNuit = document.getElementById("pos-nuit-cliente");
        if (inputNuit) inputNuit.value = "";
        const inputClientePos = document.getElementById("pos-cliente-nome");
        if (inputClientePos) inputClientePos.value = "";
        ["pos-valor-dinheiro", "pos-valor-mpesa", "pos-valor-emola", "pos-valor-cartao", "pos-valor-credito", "pos-desconto"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "0";
        });
        const checkboxMisto = document.getElementById("pos-pagamento-misto");
        if (checkboxMisto) { checkboxMisto.checked = false; alternarPagamentoMisto(); }

        // Força a atualização da cache interna local e redesenha a interface gráfica
        await carregarDados();
        renderTudo();

        // Insere o faturamento financeiro nos registos inalteráveis de auditoria
        await gravarAuditoria("Registou venda de mercadorias no valor de " + dinheiro(totalComDesconto) + (desconto > 0 ? ` (desconto de ${dinheiro(desconto)} aplicado)` : ""), "INFO");
        alert("Venda concluída com sucesso. Valor total: " + dinheiro(totalComDesconto));

    } catch (error) {
        console.error("Erro crítico ao processar faturamento no POS:", error);
        alert("A venda não pôde ser concluída de forma segura:\n" + error.message);
    }
}


/* =====================================================
   MÓDULO LÓGICO: HISTÓRICO E RENDERS DE VENDAS
===================================================== */

document.getElementById("vendas-pesquisa").addEventListener("input", renderVendas);
document.getElementById("vendas-periodo").addEventListener("change", renderVendas);


function renderVendas() {
    const pesquisa = document.getElementById("vendas-pesquisa")?.value.toLowerCase() || "";
    const periodo = document.getElementById("vendas-periodo")?.value || "todos";
    let inicio = null;
    if (periodo === "hoje") inicio = dataHoje();
    if (periodo === "7") inicio = diasAtras(7);
    if (periodo === "30") inicio = diasAtras(30);

    const listaFiltrada = FABEF.vendas.filter(v => {
        const dataVenda = new Date(v.data || v.date || 0);
        if (inicio && dataVenda < inicio) return false;
        const textoCompleto = JSON.stringify(v).toLowerCase();
        return !pesquisa || textoCompleto.includes(pesquisa);
    }).sort((a,b) => new Date(b.data || b.date || 0) - new Date(a.data || a.date || 0));

    const tabelaCorpo = document.getElementById("tabela-vendas");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = listaFiltrada.map(v => {
        const itensMapeados = (v.itens || v.items || []).map(x => escapeHTML(x.nome || "Produto") + " × " + numero(x.quantidade || x.qty)).join(", ");
        return `
        <tr>
            <td>${dataTexto(v.data || v.date)}</td>
            <td>${escapeHTML(v.operadorNome || v.user || "—")}</td>
            <td style="white-space: normal; max-width: 220px;">${itensMapeados}</td>
            <td><strong>${dinheiro(v.total)}</strong></td>
            <td>${escapeHTML(v.pagamento || v.method || "—")}</td>
            <td>${escapeHTML(v.nuitCliente || "Isento")}</td>
            <td>${escapeHTML(v.ramo || "—")}</td>
            <td>
                <div style="display:flex;gap:5px;">
                    <button class="btn btn-light btn-small" onclick="imprimirReciboVenda('${escapeHTML(v.id)}')" type="button">🖨️ Recibo</button>
                    <button class="btn btn-success btn-small" onclick="enviarReciboWhatsApp('${escapeHTML(v.id)}')" type="button" style="background-color:#25d366;">📱 WhatsApp</button>
                </div>
            </td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">Nenhuma operação de venda localizada nos critérios definidos.</td></tr>`;
}

window.imprimirReciboVenda = function(vendaId) {
    const v = FABEF.vendas.find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    const itens = (v.itens || []).map(i => `<tr><td>${escapeHTML(i.nome)}</td><td>${numero(i.quantidade)}</td><td>${dinheiro(i.subtotal)}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) { alert("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(`<html><head><title>Recibo ${escapeHTML(v.id)}</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}
    body.dark-mode {
        --bg: #0f172a;
        --card: #1e293b;
        --text: #e2e8f0;
        --muted: #94a3b8;
        --border: #334155;
        color: #e2e8f0;
    }
    body.dark-mode .card, body.dark-mode .stat-card, body.dark-mode .modal-card, body.dark-mode .table-wrap { background: #1e293b; color: #e2e8f0; border-color: #334155; }
    body.dark-mode input, body.dark-mode select, body.dark-mode textarea { background:#0f172a; color:#e2e8f0; border-color:#475569; }
    body.dark-mode table th { background:#0f172a; }
</style></head><body><h2>${escapeHTML(nomeEmpresa)}</h2><p><strong>RECIBO DIGITAL</strong><br>Código: ${escapeHTML(v.id)}<br>Data: ${dataTexto(v.data)}<br>Operador: ${escapeHTML(v.operadorNome || "Balcão")}<br>NUIT Cliente: ${escapeHTML(v.nuitCliente || "Isento")}</p><table><thead><tr><th>Artigo</th><th>Qtd.</th><th>Total</th></tr></thead><tbody>${itens}</tbody></table><h3>TOTAL: ${dinheiro(v.total)}</h3><p>Forma de pagamento: ${escapeHTML(v.pagamento || "—")}</p><script>window.print();<\/script></body></html>`);
    w.document.close();
};

window.enviarReciboWhatsApp = function(vendaId) {
    const v = FABEF.vendas.find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    const textoItens = (v.itens || []).map(item => `• ${item.nome} (x${item.quantidade}): ${dinheiro(item.subtotal)}`).join("\n");
    const mensagem = encodeURIComponent(`*${nomeEmpresa.toUpperCase()} - RECIBO DIGITAL*\n----------------------------------------\n*Código da Venda:* ${v.id}\n*Data:* ${dataTexto(v.data)}\n*Operador:* ${v.operadorNome || "Balcão"}\n*NUIT Cliente:* ${v.nuitCliente || "Isento"}\n----------------------------------------\n*ARTIGOS:*\n${textoItens}\n----------------------------------------\n*TOTAL:* ${dinheiro(v.total)}\n*Forma de Pagamento:* ${v.pagamento || "—"}\n\nObrigado pela preferência! 🎉`);
    window.open(`https://wa.me/?text=${mensagem}`, "_blank");
};

/* =====================================================
   EXPORTAÇÃO DE INVENTÁRIO CSV
===================================================== */

window.exportarInventarioCSV = function() {
    const produtosRamo = FABEF.produtos.filter(p => p.ramo === FABEF.ramo);
    if (!produtosRamo || produtosRamo.length === 0) { alert("Não existem produtos no inventário deste ramo para exportar."); return; }
    const cabecalhos = ["Produto","Categoria","Stock Existente","Stock Minimo","Preco Custo (MT)","Valor em Stock (MT)","Estado"];
    const linhas = produtosRamo.map(p => {
        const stock = numero(p.stock), custo = numero(p.custo), minimo = numero(p.stockMinimo);
        const estado = stock <= minimo ? "STOCK BAIXO" : "NORMAL";
        return [`"${String(p.nome || "").replace(/"/g,'""')}"`,`"${String(p.categoria || "—").replace(/"/g,'""')}"`,stock,minimo,custo.toFixed(2),(stock*custo).toFixed(2),estado];
    });
    const csv = [cabecalhos.join(";"), ...linhas.map(l => l.join(";"))].join("\n");
    try {
        const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]),csv], {type:"text/csv;charset=utf-8;"});
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href=url; link.download=`FABEF_Inventario_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        if (typeof gravarAuditoria === "function") gravarAuditoria("Exportou a lista de inventário para formato CSV/Excel.", "INFO");
    } catch(error) { console.error(error); alert("Não foi possível exportar o inventário."); }
};

document.getElementById("btn-exportar-inventario")?.addEventListener("click", exportarInventarioCSV);

/* =====================================================
   MÓDULO LÓGICO: GESTÃO DE FORNECEDORES
===================================================== */

document.getElementById("btn-adicionar-fornecedor").addEventListener("click", adicionarFornecedor);


async function adicionarFornecedor() {
    const nome = document.getElementById("fornecedor-nome").value.trim();
    const telefone = document.getElementById("fornecedor-telefone").value.trim();
    const observacao = document.getElementById("fornecedor-observacao").value.trim();
    const dividaInicial = numero(document.getElementById("fornecedor-divida")?.value);

    if (!nome) {
        alert("Introduza o nome do fornecedor.");
        return;
    }

    try {
        const payload = {
            nome: nome,
            telefone: telefone,
            observacao: observacao,
            divida: dividaInicial,
            ramo: FABEF.ramo,
            criadoPor: FABEF.user.uid,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("fornecedores"), payload);

        // Alimenta de forma síncrona a cache interna local
        FABEF.fornecedores.push({
            id: ref.id,
            nome: payload.nome,
            telefone: payload.telefone,
            observacao: payload.observacao,
            divida: payload.divida,
            ramo: payload.ramo,
            data: payload.data
        });

        // Limpa os elementos de texto do formulário
        document.getElementById("fornecedor-nome").value = "";
        document.getElementById("fornecedor-telefone").value = "";
        document.getElementById("fornecedor-observacao").value = "";
        if (document.getElementById("fornecedor-divida")) document.getElementById("fornecedor-divida").value = "";

        renderFornecedores();

        await gravarAuditoria("Adicionou o fornecedor ao catálogo: " + nome, "INFO");
        alert("Fornecedor guardado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar o fornecedor:\n" + mensagemFirebase(error));
    }
}


function renderFornecedores() {
    const tabelaCorpo = document.getElementById("tabela-fornecedores");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = FABEF.fornecedores.map(f => {
        const divida = numero(f.divida);
        const compras = FABEF.compras.filter(c => (c.fornecedorNome || "").toLowerCase() === (f.nome || "").toLowerCase());
        return `
    <tr>
        <td>${escapeHTML(f.nome)}</td>
        <td>${escapeHTML(f.telefone || "—")}</td>
        <td>${escapeHTML(f.observacao || "—")}</td>
        <td style="color:${divida > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(divida)}</td>
        <td>${compras.length}</td>
        <td>
            <div style="display:flex;gap:5px;">
                <button class="btn btn-light btn-small" type="button" onclick="verComprasFornecedor('${escapeHTML(f.nome)}')">🚚 Compras</button>
                <button class="btn btn-light btn-small" type="button" onclick="amortizarDividaFornecedorPrompt('${escapeHTML(f.id)}','${escapeHTML(f.nome)}')" ${divida > 0 ? '' : 'disabled'}>💵 Pagar</button>
            </div>
        </td>
    </tr>
    `;
    }).join("") || `
    <tr>
        <td colspan="6" style="text-align: center; color: #64748b;">
            Nenhum fornecedor registado para este negócio.
        </td>
    </tr>
    `;
}

window.verComprasFornecedor = function(nomeFornecedor) {
    const compras = FABEF.compras.filter(c => (c.fornecedorNome || "").toLowerCase() === nomeFornecedor.toLowerCase());
    if (compras.length === 0) { alert("Ainda não há compras registadas para " + nomeFornecedor + "."); return; }
    const linhas = compras
        .slice()
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
        .map(c => `${dataTexto(c.data)} — ${c.produtoNome} x${c.quantidade} — ${dinheiro(numero(c.quantidade) * numero(c.custoUnitario))}`)
        .join("\n");
    alert("Compras a " + nomeFornecedor + ":\n\n" + linhas);
};

window.amortizarDividaFornecedorPrompt = async function(id, nome) {
    const fornecedor = FABEF.fornecedores.find(f => f.id === id);
    if (!fornecedor) return;
    const quantiaStr = prompt("Valor pago ao fornecedor " + nome + " (dívida atual: " + dinheiro(fornecedor.divida) + "):");
    if (!quantiaStr) return;
    const quantia = numero(quantiaStr);
    if (quantia <= 0) { alert("O valor deve ser superior a zero."); return; }
    if (quantia > numero(fornecedor.divida)) { alert("O valor introduzido é superior à dívida atual."); return; }

    try {
        const novaDivida = numero(fornecedor.divida) - quantia;
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "fornecedores", id), {
            divida: novaDivida,
            atualizadoEm: serverTimestamp()
        });
        fornecedor.divida = novaDivida;
        renderFornecedores();
        await gravarAuditoria("Pagou " + dinheiro(quantia) + " ao fornecedor: " + nome, "INFO");
        alert("Pagamento registado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao registar o pagamento:\n" + mensagemFirebase(error));
    }
};


/* =====================================================
   MÓDULO LÓGICO: GESTÃO DE CLIENTES
===================================================== */

document.getElementById("btn-adicionar-cliente").addEventListener("click", adicionarCliente);


async function adicionarCliente() {
    const nome = document.getElementById("cliente-nome").value.trim();
    const telefone = document.getElementById("cliente-telefone").value.trim();
    const endereco = document.getElementById("cliente-endereco")?.value.trim() || "";
    const observacao = document.getElementById("cliente-observacao").value.trim();

    if (!nome) {
        alert("Introduza o nome do cliente.");
        return;
    }

    // Evita clientes duplicados com o mesmo nome neste estabelecimento
    if (FABEF.clientes.some(c => (c.nome || "").toLowerCase() === nome.toLowerCase())) {
        alert("Já existe um cliente registado com este nome.");
        return;
    }

    try {
        const payload = {
            nome: nome,
            telefone: telefone,
            endereco: endereco,
            observacao: observacao,
            criadoPor: FABEF.user.uid,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("clientes"), payload);

        FABEF.clientes.push({
            id: ref.id,
            nome: payload.nome,
            telefone: payload.telefone,
            endereco: payload.endereco,
            observacao: payload.observacao,
            data: payload.data
        });

        // Varre e reinicializa todos os campos de texto do cliente
        [
            "cliente-nome",
            "cliente-telefone",
            "cliente-endereco",
            "cliente-observacao"
        ].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = "";
        });

        renderClientes();

        await gravarAuditoria("Adicionou o cliente ao cadastro: " + nome, "INFO");
        alert("Cliente guardado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar o cliente:\n" + mensagemFirebase(error));
    }
}


function renderClientes() {
    const tabelaCorpo = document.getElementById("tabela-clientes");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = FABEF.clientes.map(c => {
        const dividaCliente = FABEF.dividas.find(d => (d.cliente || "").toLowerCase() === (c.nome || "").toLowerCase());
        const saldo = numero(dividaCliente?.saldo);
        return `
    <tr>
        <td>${escapeHTML(c.nome)}</td>
        <td>${escapeHTML(c.telefone || "—")}</td>
        <td>${escapeHTML(c.endereco || "—")}</td>
        <td style="color:${saldo > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(saldo)}</td>
        <td><button class="btn btn-light btn-small" type="button" onclick="verDetalheCliente('${escapeHTML(c.id)}')">👁️ Detalhes</button></td>
    </tr>
    `;
    }).join("") || `
    <tr>
        <td colspan="5" style="text-align: center; color: #64748b;">
            Nenhum cliente cadastrado neste estabelecimento.
        </td>
    </tr>
    `;
}

window.verDetalheCliente = function(id) {
    const c = FABEF.clientes.find(x => x.id === id);
    if (!c) return;

    const divida = FABEF.dividas.find(d => (d.cliente || "").toLowerCase() === (c.nome || "").toLowerCase());
    const encomendasCliente = FABEF.encomendas.filter(e => (e.cliente || "").toLowerCase() === (c.nome || "").toLowerCase());

    // Histórico de compras: vendas do POS ligadas a este cliente pelo nome
    const comprasCliente = FABEF.vendas
        .filter(v => (v.cliente || "").toLowerCase() === (c.nome || "").toLowerCase())
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    const totalPago = comprasCliente.reduce((s, v) => s + numero(v.total), 0);
    const ultimaCompra = comprasCliente.length ? dataTexto(comprasCliente[0].data) : "—";

    document.getElementById("dc-titulo").textContent = c.nome;
    document.getElementById("dc-corpo").innerHTML = `
        <p><strong>Telefone:</strong> ${escapeHTML(c.telefone || "—")}</p>
        <p><strong>Endereço:</strong> ${escapeHTML(c.endereco || "—")}</p>
        <p><strong>Observação:</strong> ${escapeHTML(c.observacao || "—")}</p>
        <p style="margin-top:10px;"><strong>Dívida atual:</strong>
            <span style="color:${numero(divida?.saldo) > 0 ? '#ef4444' : '#10b981'};font-weight:700;">
                ${dinheiro(numero(divida?.saldo))}
            </span>
        </p>
        <p><strong>Total já pago (histórico):</strong> ${dinheiro(totalPago)}</p>
        <p><strong>Última compra:</strong> ${ultimaCompra}</p>
        <p style="margin-top:10px;"><strong>Histórico de compras (${comprasCliente.length}):</strong></p>
        ${comprasCliente.length ? '<ul style="margin-top:6px;padding-left:18px;max-height:160px;overflow-y:auto;">' +
            comprasCliente.map(v => `<li>${dataTexto(v.data)} — ${dinheiro(numero(v.total))} — ${escapeHTML(v.pagamento || "—")}</li>`).join("") +
            '</ul>' : '<p style="color:#64748b;">Ainda não há compras registadas para este cliente.</p>'}
        <p style="margin-top:10px;"><strong>Encomendas registadas:</strong> ${encomendasCliente.length}</p>
        ${encomendasCliente.length ? '<ul style="margin-top:6px;padding-left:18px;">' +
            encomendasCliente.map(e => `<li>${escapeHTML(e.produto)} — x${e.quantidade} — ${escapeHTML(e.estado || 'Pendente')}</li>`).join("") +
            '</ul>' : ''}
    `;
    document.getElementById("modal-detalhe-cliente")?.classList.add("show");
};


/* =====================================================
   MÓDULO LÓGICO: GESTÃO DE FIADO / DÍVIDAS COM BARREIRA DE CRÉDITO
===================================================== */

document.getElementById("btn-registar-divida").addEventListener("click", registarDivida);


async function registrarOuAtualizarDivida(cliente, telefone, valor) {
    const existente = FABEF.dividas.find(d =>
        String(d.cliente || "").toLowerCase() === cliente.toLowerCase()
    );

    if (existente) {
        const novoSaldo = numero(existente.saldo) + valor;

        // BLINDAGEM FINANCEIRA: Bloqueia a venda fiada se estourar o limite acordado
        if (existente.limite && novoSaldo > numero(existente.limite)) {
            throw new Error("O limite de crédito deste cliente foi ultrapassado.");
        }

        await updateDoc(doc(db, "empresas", FABEF.empresaId, "dividas", existente.id), {
            saldo: novoSaldo,
            atualizadoEm: serverTimestamp()
        });

        existente.saldo = novoSaldo;
    } else {
        const payload = {
            cliente: cliente,
            telefone: telefone || "",
            saldo: valor,
            limite: 0,
            data: new Date().toISOString(),
            criadoPor: FABEF.user.uid,
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("dividas"), payload);

        FABEF.dividas.push({
            id: ref.id,
            cliente: payload.cliente,
            telefone: payload.telefone,
            saldo: payload.saldo,
            limite: payload.limite,
            data: payload.data
        });
    }

    renderDividas();
}


async function registarDivida() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) === "gerente") {
        alert("A conta de gerente não regista novas dívidas — isso é feito pelo funcionário no momento da venda ou do atendimento. O gerente pode consultar e acompanhar aqui.");
        return;
    }
    const cliente = document.getElementById("divida-cliente").value.trim();
    const telefone = document.getElementById("divida-telefone").value.trim();
    const valor = numero(document.getElementById("divida-valor").value);
    const limite = numero(document.getElementById("divida-limite").value);

    if (!cliente || valor <= 0) {
        alert("Dados inválidos. Introduza um cliente e um valor superior a zero.");
        return;
    }

    try {
        // Se já existir cliente, respeita o limite definido antes; senão usa o limite agora introduzido
        const existente = FABEF.dividas.find(d =>
            String(d.cliente || "").toLowerCase() === cliente.toLowerCase()
        );
        if (!existente && limite > 0) {
            const payload = {
                cliente, telefone, saldo: valor, limite,
                data: new Date().toISOString(), criadoPor: FABEF.user.uid, criadoEm: serverTimestamp()
            };
            const ref = await addDoc(subRef("dividas"), payload);
            FABEF.dividas.push({ id: ref.id, cliente, telefone, saldo: valor, limite, data: payload.data });
        } else {
            await registrarOuAtualizarDivida(cliente, telefone, valor);
        }

        // Limpa os campos do formulário após o registo bem-sucedido
        document.getElementById("divida-cliente").value = "";
        document.getElementById("divida-telefone").value = "";
        document.getElementById("divida-valor").value = "";

        renderDividas();

        await gravarAuditoria("Registou uma nova dívida / fiado no valor de " + dinheiro(valor) + " para o cliente: " + cliente, "INFO");
        alert("Dívida registada e conta corrente atualizada com sucesso.");

    } catch (error) {
        console.error("Erro crítico ao processar conta corrente de fiado:", error);
        alert("Não foi possível registar o fiado:\n" + mensagemFirebase(error));
    }
}
/* =====================================================
   MÓDULO LÓGICO: RENDERIZAÇÃO DA CONTA CORRENTE DE FIADO (COMPLEMENTO)
===================================================== */

function renderDividas() {
    const tabelaCorpo = document.getElementById("tabela-dividas");
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = FABEF.dividas.map(d => {
        const possuiDivida = numero(d.saldo) > 0;
        const botaoCobrar = possuiDivida
            ? `<button class="btn btn-success btn-small" onclick="enviarLembreteDivida('${escapeHTML(d.id)}')" type="button" style="background-color:#25d366;">📱 Cobrar</button>`
            : `<button class="btn btn-secondary btn-small" type="button" disabled style="opacity:.4;">📱 Pago</button>`;
        return `<tr><td><strong>${escapeHTML(d.cliente)}</strong></td><td>${escapeHTML(d.telefone || "—")}</td><td style="color:${possuiDivida ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(d.saldo)}</td><td>${dinheiro(d.limite)}</td><td><div style="display:flex;gap:5px;"><button class="btn btn-light btn-small" onclick="amortizarDividaPrompt('${escapeHTML(d.id)}','${escapeHTML(d.cliente)}')" type="button" ${possuiDivida ? '' : 'disabled'}>Amortizar</button>${botaoCobrar}</div></td></tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center;color:#64748b;">Nenhum registo de fiado ativo localizado.</td></tr>`;
}

window.enviarLembreteDivida = function(id) {
    const d = FABEF.dividas.find(x => x.id === id);
    if (!d) return;
    if (!d.telefone || d.telefone === "—") { alert("Este cliente não tem um número de telefone registado."); return; }
    let telefoneFormatado = String(d.telefone).trim().replace(/\D/g, "");
    if (telefoneFormatado.length === 9) telefoneFormatado = "258" + telefoneFormatado;
    const nomeEmpresa = FABEF.empresa?.nome || "Nosso Estabelecimento";
    const mensagem = encodeURIComponent(`Olá *${d.cliente}*,\n\nEsperamos que esteja bem. Passamos por aqui para lembrar gentilmente que possui um saldo em aberto no valor de *${dinheiro(d.saldo)}* referente às suas compras a fiado em *${nomeEmpresa}*.\n\nO seu limite de crédito atual é de ${dinheiro(d.limite)}.\n\nAgradecemos se puder passar pelo estabelecimento para regularizar o valor assim que possível. Obrigado pela compreensão! 🙏`);
    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, "_blank");
};

window.amortizarDividaPrompt = async function(id, cliente) {
    const quantiaStr = prompt("Introduza o valor recebido para amortizar a dívida de " + cliente + ":");
    if (!quantiaStr) return;
    
    const quantia = numero(quantiaStr);
    if (quantia <= 0) {
        alert("O valor de amortização deve ser superior a zero.");
        return;
    }

    const devedor = FABEF.dividas.find(d => d.id === id);
    if (!devedor) return;

    if (quantia > numero(devedor.saldo)) {
        alert("O valor introduzido é superior ao saldo devedor atual (" + dinheiro(devedor.saldo) + ").");
        return;
    }

    try {
        const novoSaldo = numero(devedor.saldo) - quantia;

        await updateDoc(doc(db, "empresas", FABEF.empresaId, "dividas", id), {
            saldo: novoSaldo,
            atualizadoEm: serverTimestamp()
        });

        devedor.saldo = novoSaldo;
        renderDividas();
        
        await gravarAuditoria("Amortizou o valor de " + dinheiro(quantia) + " na conta de: " + cliente, "INFO");
        alert("Amortização registada com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao abater a dívida:\n" + mensagemFirebase(error));
    }
};


/* =====================================================
   MÓDULO LÓGICO: GESTÃO E FILTRAGEM DE ENCOMENDAS
===================================================== */

document.getElementById("btn-registar-encomenda").addEventListener("click", registarEncomenda);


async function registarEncomenda() {
    const cliente = document.getElementById("encomenda-cliente").value.trim();
    const telefone = document.getElementById("encomenda-telefone").value.trim();
    const produto = document.getElementById("encomenda-produto").value.trim();
    const quantidade = numero(document.getElementById("encomenda-quantidade").value);
    const dataPrevista = document.getElementById("encomenda-data-prevista")?.value || "";
    const valorTotal = numero(document.getElementById("encomenda-valor-total")?.value);
    const valorPago = numero(document.getElementById("encomenda-valor-pago")?.value);

    if (!cliente || !produto || quantidade <= 0) {
        alert("Preencha correctamente todos os dados necessários da encomenda.");
        return;
    }
    if (valorPago > valorTotal) {
        alert("O valor já pago não pode ser maior do que o valor total da encomenda.");
        return;
    }

    try {
        const payload = {
            cliente: cliente,
            telefone: telefone,
            produto: produto,
            quantidade: quantidade,
            dataPrevista: dataPrevista,
            valorTotal: valorTotal,
            valorPago: valorPago,
            estado: "PENDENTE",
            ramo: FABEF.ramo,
            data: new Date().toISOString(),
            criadoPor: FABEF.user.uid,
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("encomendas"), payload);

        FABEF.encomendas.push({ id: ref.id, ...payload, criadoEm: undefined });

        // Esvazia os campos para prevenir submissões duplicadas
        [
            "encomenda-cliente",
            "encomenda-telefone",
            "encomenda-produto",
            "encomenda-quantidade",
            "encomenda-data-prevista",
            "encomenda-valor-total",
            "encomenda-valor-pago"
        ].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = "";
        });

        renderEncomendas();
        alert("Encomenda registada com sucesso.");

        await gravarAuditoria("Criou nova encomenda de cliente para: " + cliente, "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar encomenda:\n" + mensagemFirebase(error));
    }
}


const ESTADOS_ENCOMENDA = ["PENDENTE", "EM_PREPARACAO", "PRONTA", "ENTREGUE", "CANCELADA"];
const ROTULO_ESTADO_ENCOMENDA = {
    PENDENTE: "Pendente",
    EM_PREPARACAO: "Em preparação",
    PRONTA: "Pronta",
    ENTREGUE: "Entregue",
    CANCELADA: "Cancelada"
};

function renderEncomendas() {
    const tabelaCorpo = document.getElementById("tabela-encomendas");
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = FABEF.encomendas.map(e => {
        const valorTotal = numero(e.valorTotal);
        const valorPago = numero(e.valorPago);
        const valorRestante = Math.max(0, valorTotal - valorPago);

        let classeBadge = "badge-yellow";
        if (e.estado === "PRONTA") classeBadge = "badge-green";
        if (e.estado === "ENTREGUE") classeBadge = "badge-green";
        if (e.estado === "CANCELADA") classeBadge = "badge-red";

        let botoesAcao = "";
        if (e.estado === "PENDENTE") {
            botoesAcao = `<button class="btn btn-light btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','EM_PREPARACAO')" type="button">🛠️ Em preparação</button>`;
        } else if (e.estado === "EM_PREPARACAO") {
            botoesAcao = `<button class="btn btn-success btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','PRONTA')" type="button">✔️ Marcar pronta</button>`;
        } else if (e.estado === "PRONTA") {
            botoesAcao = `<button class="btn btn-danger btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','ENTREGUE')" type="button">📦 Entregar</button>`;
        } else {
            botoesAcao = `<span style="color:#64748b;font-size:12px;font-weight:600;">${e.estado === "CANCELADA" ? "Cancelada" : "Concluída"}</span>`;
        }

        if (e.estado !== "ENTREGUE" && e.estado !== "CANCELADA") {
            botoesAcao += `<button class="btn btn-success btn-small" onclick="enviarAvisoEncomenda('${escapeHTML(e.id)}')" type="button" style="background-color:#25d366;">📱 Lembrete</button>`;
            botoesAcao += `<button class="btn btn-light btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','CANCELADA')" type="button">✖️ Cancelar</button>`;
        }

        return `<tr>
            <td><strong>${escapeHTML(e.cliente)}</strong>${e.telefone ? `<br><small style="color:#64748b;">${escapeHTML(e.telefone)}</small>` : ""}</td>
            <td>${escapeHTML(e.produto)}</td>
            <td>${numero(e.quantidade)}</td>
            <td>${e.dataPrevista ? escapeHTML(e.dataPrevista) : "—"}</td>
            <td>${dinheiro(valorTotal)}</td>
            <td style="color:${valorRestante > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(valorRestante)}</td>
            <td><span class="badge ${classeBadge}">${escapeHTML(ROTULO_ESTADO_ENCOMENDA[e.estado] || e.estado || "Pendente")}</span></td>
            <td><div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">${botoesAcao}</div></td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">Nenhuma encomenda em carteira registrada.</td></tr>`;
}

window.mudarEstadoEncomenda = async function(id, novoEstado) {
    if (!ESTADOS_ENCOMENDA.includes(novoEstado)) return;
    try {
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "encomendas", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        const encLocal = FABEF.encomendas.find(x => x.id === id);
        if (encLocal) encLocal.estado = novoEstado;
        renderEncomendas();
        await gravarAuditoria(`Alterou o estado da encomenda da ID ${id} para: ${ROTULO_ESTADO_ENCOMENDA[novoEstado] || novoEstado}`, "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar o estado da encomenda:\n" + mensagemFirebase(error));
    }
};

window.enviarAvisoEncomenda = function(id) {
    const e = FABEF.encomendas.find(x => x.id === id);
    if (!e) return;
    if (!e.telefone || e.telefone === "—") { alert("Esta encomenda não possui um número de telefone registado."); return; }
    let telefoneFormatado = String(e.telefone).trim().replace(/\D/g, "");
    if (telefoneFormatado.length === 9) telefoneFormatado = "258" + telefoneFormatado;
    const nomeEmpresa = FABEF.empresa?.nome || "Nosso Estabelecimento";
    const valorRestante = Math.max(0, numero(e.valorTotal) - numero(e.valorPago));

    let corpoMensagem;
    if (e.estado === "PRONTA") {
        corpoMensagem = `Temos boas notícias! A sua encomenda do artigo *${e.produto}* (Quantidade: ${e.quantidade}) já está pronta e disponível para levantamento na *${nomeEmpresa}*.`;
    } else {
        corpoMensagem = `Passamos para lembrar sobre a sua encomenda do artigo *${e.produto}* (Quantidade: ${e.quantidade}), com estado atual: *${ROTULO_ESTADO_ENCOMENDA[e.estado] || e.estado}*.` +
            (e.dataPrevista ? `\nPrevisão de entrega: *${e.dataPrevista}*.` : "");
    }
    if (valorRestante > 0) {
        corpoMensagem += `\n\nValor pendente para esta encomenda: *${dinheiro(valorRestante)}*.`;
    }

    const mensagem = encodeURIComponent(`Olá *${e.cliente}*,\n\n${corpoMensagem}\n\nEstamos à sua espera! Muito obrigado. 🛍️`);
    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, "_blank");
};

/* =====================================================
   MÓDULO LÓGICO: CONTROLO FINANCEIRO DE CAIXA / TURNOS
===================================================== */

let FABEF_UNSUB_CAIXA = null;

function ouvirCaixa() {
    return new Promise((resolve) => {
        // Se já havia uma escuta ativa (ex: estava a ouvir o caixa de outro
        // ramo antes de trocar), termina-a primeiro — nunca ficam duas em
        // simultâneo, senão o estado do caixa ficaria instável.
        if (FABEF_UNSUB_CAIXA) {
            try { FABEF_UNSUB_CAIXA(); } catch (_) {}
            FABEF_UNSUB_CAIXA = null;
        }

        let primeiraVez = true;
        try {
            // Query de segurança: Busca se existe algum caixa com estado ativo aberto para este operador e ramo
            const q = query(
                subRef("caixas_turnos"),
                where("ramo", "==", FABEF.ramo),
                where("estado", "==", "ABERTO"),
                limit(1)
            );

            FABEF_UNSUB_CAIXA = onSnapshot(q, (snap) => {
                if (snap.empty) {
                    FABEF.turnoId = null;
                    FABEF.turno = null;
                } else {
                    const d = snap.docs[0];
                    FABEF.turnoId = d.id;
                    FABEF.turno = { id: d.id, ...d.data() };
                }

                atualizarTelaCaixa();

                if (primeiraVez) { primeiraVez = false; resolve(); }
                else pedirRenderTudo();
            }, (erro) => {
                console.error("Erro crítico na escuta do estado do caixa:", erro);
                FABEF.turnoId = null;
                FABEF.turno = null;
                atualizarTelaCaixa();
                if (primeiraVez) { primeiraVez = false; resolve(); }
            });

            FABEF.listeners.push(FABEF_UNSUB_CAIXA);
        } catch (error) {
            console.error("Erro crítico na escuta do estado do caixa:", error);
            FABEF.turnoId = null;
            FABEF.turno = null;
            atualizarTelaCaixa();
            resolve();
        }
    });
}


document.getElementById("btn-abrir-caixa").addEventListener("click", abrirCaixa);


async function abrirCaixa() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Só o gerente pode abrir o caixa. Peça ao gerente para autenticar-se e abrir o turno antes de começar a vender.");
        return;
    }

    if (FABEF.turnoId) {
        alert("Operação bloqueada: Já existe um turno de caixa em execução.");
        return;
    }

    const valor = numero(document.getElementById("caixa-valor-inicial").value);

    try {
        const payload = {
            estado: "ABERTO",
            ramo: FABEF.ramo,
            abertura: valor,
            totalVendas: 0,
            totalVendasDinheiro: 0,
            sangrias: [],
            reforcos: [],
            operadorId: FABEF.user.uid,
            operadorNome: FABEF.userData?.nome || FABEF.user.email,
            dataAbertura: new Date().toISOString(),
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("caixas_turnos"), payload);

        FABEF.turnoId = ref.id;
        FABEF.turno = {
            id: ref.id,
            estado: "ABERTO",
            ramo: payload.ramo,
            abertura: payload.abertura,
            totalVendas: payload.totalVendas,
            totalVendasDinheiro: payload.totalVendasDinheiro,
            sangrias: [],
            reforcos: []
        };

        atualizarTelaCaixa();
        await gravarAuditoria("Realizou a abertura de novo turno de caixa com fundo de faturamento inicial de " + dinheiro(valor), "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao realizar abertura de caixa:\n" + mensagemFirebase(error));
    }
}


document.getElementById("btn-fechar-caixa").addEventListener("click", fecharCaixa);
document.getElementById("btn-sangria")?.addEventListener("click", registarSangria);
document.getElementById("btn-reforco")?.addEventListener("click", registarReforco);


function saldoEsperadoCaixa() {
    const t = FABEF.turno;
    if (!t) return 0;
    const sangrias = (t.sangrias || []).reduce((s, x) => s + numero(x.valor), 0);
    const reforcos = (t.reforcos || []).reduce((s, x) => s + numero(x.valor), 0);
    return numero(t.abertura) + numero(t.totalVendasDinheiro) + reforcos - sangrias;
}


async function registarSangria() {
    if (!FABEF.turnoId) return;
    const valor = numero(prompt("Valor da sangria (retirada de dinheiro do caixa):", "0"));
    if (!valor || valor <= 0) return;
    const motivo = prompt("Motivo da sangria (ex: pagamento a fornecedor, depósito no banco):", "") || "Sem motivo indicado";

    try {
        const movimento = {
            valor: valor,
            motivo: motivo,
            data: new Date().toISOString(),
            operadorNome: FABEF.userData?.nome || FABEF.user.email
        };
        const turnoRef = doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId);
        await updateDoc(turnoRef, { sangrias: arrayUnion(movimento), atualizadoEm: serverTimestamp() });
        FABEF.turno.sangrias = [...(FABEF.turno.sangrias || []), movimento];
        atualizarTelaCaixa();
        await gravarAuditoria(`Registou uma sangria de caixa de ${dinheiro(valor)}. Motivo: ${motivo}`, "ALERTA");
    } catch (error) {
        console.error(error);
        alert("Erro ao registar a sangria:\n" + mensagemFirebase(error));
    }
}


async function registarReforco() {
    if (!FABEF.turnoId) return;
    const valor = numero(prompt("Valor do reforço (entrada extra de dinheiro no caixa):", "0"));
    if (!valor || valor <= 0) return;
    const motivo = prompt("Motivo do reforço (ex: troco adicional trazido pelo gerente):", "") || "Sem motivo indicado";

    try {
        const movimento = {
            valor: valor,
            motivo: motivo,
            data: new Date().toISOString(),
            operadorNome: FABEF.userData?.nome || FABEF.user.email
        };
        const turnoRef = doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId);
        await updateDoc(turnoRef, { reforcos: arrayUnion(movimento), atualizadoEm: serverTimestamp() });
        FABEF.turno.reforcos = [...(FABEF.turno.reforcos || []), movimento];
        atualizarTelaCaixa();
        await gravarAuditoria(`Registou um reforço de caixa de ${dinheiro(valor)}. Motivo: ${motivo}`, "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao registar o reforço:\n" + mensagemFirebase(error));
    }
}


async function fecharCaixa() {
    if (!FABEF.turnoId) return;

    // Fecho de caixa é uma ação de controlo: só o gerente confirma o fecho.
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o gerente pode confirmar o fecho do caixa. Peça ao gerente para autenticar-se e fechar o turno.");
        return;
    }

    const esperado = saldoEsperadoCaixa();
    const contadoTexto = prompt(
        `Saldo esperado em dinheiro no caixa: ${dinheiro(esperado)}\n\nConte o dinheiro físico na gaveta e introduza o valor contado:`,
        esperado.toFixed(2)
    );
    if (contadoTexto === null) return; // cancelou
    const contado = numero(contadoTexto);
    const diferenca = contado - esperado;

    if (Math.abs(diferenca) > 0.5) {
        const confirmar = confirm(
            `Atenção: existe uma diferença de caixa de ${dinheiro(diferenca)} (${diferenca > 0 ? "sobra" : "falta"}).\n\nDeseja continuar e fechar o turno mesmo assim?`
        );
        if (!confirmar) return;
    } else if (!confirm("Aviso Financeiro: Deseja realmente encerrar o caixa e fechar o turno atual de faturamento?")) {
        return;
    }

    try {
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId), {
            estado: "FECHADO",
            saldoEsperado: esperado,
            saldoContado: contado,
            diferenca: diferenca,
            fechadoPor: FABEF.userData?.nome || FABEF.user.email,
            dataFecho: new Date().toISOString(),
            atualizadoEm: serverTimestamp()
        });

        await gravarAuditoria(
            `Fechou o turno de caixa. Esperado: ${dinheiro(esperado)} | Contado: ${dinheiro(contado)} | Diferença: ${dinheiro(diferenca)}`,
            Math.abs(diferenca) > 0.5 ? "ALERTA" : "INFO"
        );

        FABEF.turnoId = null;
        FABEF.turno = null;

        // Limpa também o formulário inicial para o próximo turno
        const inputInicial = document.getElementById("caixa-valor-inicial");
        if (inputInicial) inputInicial.value = "0";

        atualizarTelaCaixa();
    } catch (error) {
        console.error(error);
        alert("Erro ao fechar o turno de caixa:\n" + mensagemFirebase(error));
    }
}


function atualizarTelaCaixa() {
    const aberto = !!FABEF.turnoId;
    const statusSpan = document.getElementById("caixa-status");

    if (statusSpan) {
        statusSpan.textContent = aberto ? "ABERTO" : "FECHADO";
        statusSpan.style.color = aberto ? "#10b981" : "#ef4444";
    }

    const vendasSpan = document.getElementById("caixa-total-vendas");
    if (vendasSpan) {
        vendasSpan.textContent = dinheiro(FABEF.turno?.totalVendas || 0);
    }

    const saldoSpan = document.getElementById("caixa-saldo-esperado");
    if (saldoSpan) {
        saldoSpan.textContent = dinheiro(saldoEsperadoCaixa());
    }

    const listaMovimentos = document.getElementById("caixa-movimentos");
    if (listaMovimentos) {
        const sangrias = (FABEF.turno?.sangrias || []).map(m => `<li style="color:#ef4444;">− ${dinheiro(m.valor)} (Sangria) — ${escapeHTML(m.motivo)} — ${escapeHTML(m.operadorNome || "")}</li>`);
        const reforcos = (FABEF.turno?.reforcos || []).map(m => `<li style="color:#10b981;">+ ${dinheiro(m.valor)} (Reforço) — ${escapeHTML(m.motivo)} — ${escapeHTML(m.operadorNome || "")}</li>`);
        const todos = [...sangrias, ...reforcos];
        listaMovimentos.innerHTML = todos.length ? `<ul style="padding-left:18px;">${todos.join("")}</ul>` : `<p style="color:#64748b;font-size:13px;">Sem sangrias ou reforços neste turno.</p>`;
    }

    // Gerencia dinamicamente a visibilidade dos ecrãs de ação com a classe hidden blindada
    document.getElementById("caixa-abertura")?.classList.toggle("hidden", aberto);
    document.getElementById("caixa-fecho")?.classList.toggle("hidden", !aberto);
    document.getElementById("aviso-pos-caixa")?.classList.toggle("hidden", aberto);

    // Abrir/fechar o caixa é uma ação exclusiva do gerente — o funcionário só
    // consulta o estado, para ficar claro quem tem de agir.
    const ehGerenteCaixa = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    const btnAbrir = document.getElementById("btn-abrir-caixa");
    const btnFechar = document.getElementById("btn-fechar-caixa");
    if (btnAbrir) btnAbrir.style.display = ehGerenteCaixa ? "" : "none";
    if (btnFechar) btnFechar.style.display = ehGerenteCaixa ? "" : "none";
    const avisoCaixaFuncionario = document.getElementById("aviso-caixa-funcionario");
    if (avisoCaixaFuncionario) {
        avisoCaixaFuncionario.style.display = (!ehGerenteCaixa && !aberto) ? "" : "none";
    }
}
/* =====================================================
   MÓDULO LÓGICO: REGISTO E LANÇAMENTO DE DESPESAS
===================================================== */

document.getElementById("btn-registar-despesa").addEventListener("click", registarDespesa);


async function registarDespesa() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) === "gerente") {
        alert("A conta de gerente não regista despesas diretamente — isso é feito pelo funcionário. O gerente pode consultar aqui.");
        return;
    }
    const descricao = document.getElementById("despesa-descricao").value.trim();
    const valor = numero(document.getElementById("despesa-valor").value);

    if (!descricao || valor <= 0) {
        alert("Introduza uma descrição válida e um valor superior a zero.");
        return;
    }

    try {
        const payload = {
            descricao: descricao,
            valor: valor,
            ramo: FABEF.ramo,
            utilizadorId: FABEF.user.uid,
            utilizadorNome: FABEF.userData?.nome || FABEF.user.email,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("despesas"), payload);

        // Alimenta de forma síncrona a cache local na memória do navegador
        FABEF.despesas.push({
            id: ref.id,
            descricao: payload.descricao,
            valor: payload.valor,
            ramo: payload.ramo,
            utilizadorNome: payload.utilizadorNome,
            data: payload.data
        });

        // Limpa os campos do formulário para o próximo lançamento
        document.getElementById("despesa-descricao").value = "";
        document.getElementById("despesa-valor").value = "";

        renderDespesas();

        // Regista a saída financeira nos logs inalteráveis de auditoria
        await gravarAuditoria("Registou despesa comercial: " + descricao + " no valor de " + dinheiro(valor), "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao registar a despesa na base de dados:\n" + mensagemFirebase(error));
    }
}


function renderDespesas() {
    const tabelaCorpo = document.getElementById("tabela-despesas");
    if (!tabelaCorpo) return;

    // Ordena as despesas de forma decrescente pela data de lançamento
    const listaOrdenada = FABEF.despesas
        .slice()
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    tabelaCorpo.innerHTML = listaOrdenada.map(d => `
    <tr>
        <td>${dataTexto(d.data)}</td>
        <td>${escapeHTML(d.descricao)}</td>
        <td style="color: #dc2626; font-weight: 600;">${dinheiro(d.valor)}</td>
        <td>${escapeHTML(d.utilizadorNome || "—")}</td>
    </tr>
    `).join("") || `
    <tr>
        <td colspan="4" style="text-align: center; color: #64748b;">
            Nenhuma despesa registada para este negócio.
        </td>
    </tr>
    `;
}


/* =====================================================
   MÓDULO LÓGICO: MOTOR DINÂMICO DE RELATÓRIOS FINANCEIROS
===================================================== */

document.getElementById("btn-atualizar-relatorio").addEventListener("click", renderRelatorios);
document.getElementById("relatorio-periodo").addEventListener("change", renderRelatorios);


function renderRelatorios() {
    const periodo = document.getElementById("relatorio-periodo").value;
    let inicio = null;

    if (periodo === "hoje") inicio = dataHoje();
    if (periodo === "7") inicio = diasAtras(7);
    if (periodo === "30") inicio = diasAtras(30);

    // Filtra vendas e despesas aplicando os limites cronológicos selecionados na interface
    const vendasFiltradas = FABEF.vendas.filter(v => {
        const d = new Date(v.data || v.date || 0);
        return !inicio || d >= inicio;
    });

    const despesasFiltradas = FABEF.despesas.filter(d => {
        const dataDespesa = new Date(d.data || 0);
        return !inicio || dataDespesa >= inicio;
    });

    // Executa as somas dos indicadores financeiros básicos
    const faturamento = vendasFiltradas.reduce((s, v) => s + numero(v.total), 0);
    const totalDespesas = despesasFiltradas.reduce((s, d) => s + numero(d.valor), 0);
    const resultado = faturamento - totalDespesas;

    // Alimenta os elementos gráficos da página de relatórios
    document.getElementById("rel-faturamento").textContent = dinheiro(faturamento);
    document.getElementById("rel-despesas").textContent = dinheiro(totalDespesas);
    
    const resultadoSpan = document.getElementById("rel-resultado");
    if (resultadoSpan) {
        resultadoSpan.textContent = dinheiro(resultado);
        resultadoSpan.style.color = resultado >= 0 ? "#16a34a" : "#dc2626";
    }

    // Invoca o motor matemático da Curva ABC de produtos baseado nas vendas filtradas
    renderABC(vendasFiltradas);

    // Análise inteligente adicional
    renderAnaliseInteligente(vendasFiltradas, despesasFiltradas);
}


function renderAnaliseInteligente(vendasFiltradas, despesasFiltradas) {
    const painel = document.getElementById("analise-inteligente");
    if (!painel) return;

    // Produto mais e menos vendido (por quantidade)
    const contagemProdutos = {};
    vendasFiltradas.forEach(v => (v.itens || []).forEach(item => {
        contagemProdutos[item.nome] = (contagemProdutos[item.nome] || 0) + numero(item.quantidade);
    }));
    const listaProdutos = Object.entries(contagemProdutos).sort((a, b) => b[1] - a[1]);
    const maisVendido = listaProdutos[0];
    const menosVendido = listaProdutos[listaProdutos.length - 1];

    // Melhor dia de vendas (por data)
    const porDia = {};
    vendasFiltradas.forEach(v => {
        const dia = dataTexto(v.data);
        porDia[dia] = (porDia[dia] || 0) + numero(v.total);
    });
    const melhorDia = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];

    // Horário com maior movimento (por hora do dia)
    const porHora = {};
    vendasFiltradas.forEach(v => {
        const hora = new Date(v.data || 0).getHours();
        if (!isNaN(hora)) porHora[hora] = (porHora[hora] || 0) + 1;
    });
    const melhorHora = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0];

    // Clientes com maior frequência de compra
    const porCliente = {};
    vendasFiltradas.forEach(v => {
        if (!v.cliente) return;
        porCliente[v.cliente] = (porCliente[v.cliente] || 0) + 1;
    });
    const clienteFrequente = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0];

    // Dívidas pendentes (global, não depende do período)
    const dividasPendentes = FABEF.dividas.filter(d => numero(d.saldo) > 0);
    const totalDividasPendentes = dividasPendentes.reduce((s, d) => s + numero(d.saldo), 0);

    // Produtos próximos de acabar (do ramo ativo)
    const produtosBaixos = FABEF.produtos.filter(p => p.ramo === FABEF.ramo && numero(p.stock) > 0 && numero(p.stock) <= numero(p.stockMinimo));

    // Despesa mais elevada do período
    const despesaMaisAlta = [...despesasFiltradas].sort((a, b) => numero(b.valor) - numero(a.valor))[0];

    const linha = (rotulo, valor) => `<p style="margin-bottom:8px;"><strong>${rotulo}:</strong> ${valor}</p>`;

    painel.innerHTML =
        linha("Produto mais vendido", maisVendido ? `${escapeHTML(maisVendido[0])} (${maisVendido[1]} unidades)` : "Sem dados no período") +
        linha("Produto menos vendido", menosVendido && listaProdutos.length > 1 ? `${escapeHTML(menosVendido[0])} (${menosVendido[1]} unidades)` : "Sem dados suficientes") +
        linha("Melhor dia de vendas", melhorDia ? `${escapeHTML(melhorDia[0])} — ${dinheiro(melhorDia[1])}` : "Sem dados no período") +
        linha("Horário com maior movimento", melhorHora ? `${melhorHora[0]}h — ${melhorHora[1]} venda(s)` : "Sem dados no período") +
        linha("Cliente mais frequente", clienteFrequente ? `${escapeHTML(clienteFrequente[0])} (${clienteFrequente[1]} compras)` : "Ainda sem vendas ligadas a clientes") +
        linha("Dívidas pendentes (total)", `${dinheiro(totalDividasPendentes)} em ${dividasPendentes.length} cliente(s)`) +
        linha("Produtos próximos de acabar", produtosBaixos.length ? produtosBaixos.map(p => escapeHTML(p.nome)).join(", ") : "Nenhum, tudo em ordem") +
        linha("Despesa mais elevada do período", despesaMaisAlta ? `${escapeHTML(despesaMaisAlta.descricao)} — ${dinheiro(despesaMaisAlta.valor)}` : "Sem despesas no período");
}


/* =====================================================
   MÓDULO LÓGICO: MOTOR ANALÍTICO DE CURVA ABC (PARETO)
===================================================== */

function renderABC(vendas) {
    const mapa = {};

    // Agrupa e consolida as quantidades e faturamento por ID/Nome do artigo
    vendas.forEach(v => {
        const itens = v.itens || v.items || [];

        itens.forEach(item => {
            const id = item.produtoId || item.id || item.nome;

            if (!mapa[id]) {
                mapa[id] = {
                    nome: item.nome || "Produto",
                    quantidade: 0,
                    faturamento: 0
                };
            }

            mapa[id].quantidade += numero(item.quantidade || item.qty);
            mapa[id].faturamento += numero(item.subtotal || (numero(item.quantidade || item.qty) * numero(item.preco || item.price)));
        });
    });

    // Ordena de forma decrescente os artigos pelo volume total faturado
    const listaOrdenada = Object.values(mapa).sort((a, b) => b.faturamento - a.faturamento);
    const totalGeral = listaOrdenada.reduce((s, x) => s + x.faturamento, 0);

    let acumulado = 0;
    const tabelaABC = document.getElementById("tabela-abc");
    if (!tabelaABC) return;

    tabelaABC.innerHTML = listaOrdenada.map((x, i) => {
        acumulado += x.faturamento;
        const percent = totalGeral > 0 ? acumulado / totalGeral : 0;

        /*
         CLASSIFICAÇÃO DE PARETO:
         Classe A: Até 80% do faturamento (Artigos mais importantes/críticos)
         Classe B: De 80% a 95% do faturamento (Importância intermédia)
         Classe C: Acima de 95% do faturamento (Baixo impacto financeiro)
        */
        let classe = "C";
        let classeBadge = "badge-red";

        if (percent <= 0.80) {
            classe = "A";
            classeBadge = "badge-green";
        } else if (percent <= 0.95) {
            classe = "B";
            classeBadge = "badge-yellow";
        }

        return `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHTML(x.nome)}</strong></td>
            <td>${x.quantidade}</td>
            <td>${dinheiro(x.faturamento)}</td>
            <td>
                <span class="badge ${classeBadge}">
                    Classe ${classe}
                </span>
            </td>
        </tr>
        `;
    }).join("") || `
    <tr>
        <td colspan="5" style="text-align: center; color: #64748b;">
            Nenhuma operação comercial localizada no período para compor a Curva ABC.
        </td>
    </tr>
    `;
}
/* =====================================================
   MÓDULO LÓGICO: CONFIGURAÇÕES CORPORATIVAS DO NEGÓCIO
===================================================== */

function renderConfiguracoes() {
    const nomeInput = document.getElementById("config-nome");
    const telInput = document.getElementById("config-telefone");
    const endInput = document.getElementById("config-endereco");

    if (nomeInput) nomeInput.value = FABEF.empresa?.nome || "";
    if (telInput) telInput.value = FABEF.empresa?.telefone || "";
    if (endInput) endInput.value = FABEF.empresa?.endereco || "";
}


document.getElementById("btn-guardar-config").addEventListener("click", guardarConfiguracoes);
document.getElementById("btn-alterar-pin")?.addEventListener("click", () => {
    if (FABEF.user?.uid) configurarNovoPin(FABEF.user.uid);
});


async function guardarConfiguracoes() {
    const nome = document.getElementById("config-nome").value.trim();
    const telefone = document.getElementById("config-telefone").value.trim();
    const endereco = document.getElementById("config-endereco").value.trim();

    if (!nome) {
        alert("O nome do negócio é um campo de preenchimento obrigatório.");
        return;
    }

    try {
        await updateDoc(empresaRef(), {
            nome: nome,
            telefone: telefone,
            endereco: endereco,
            atualizadoEm: serverTimestamp()
        });

        // Sincroniza imediatamente o estado da cache interna local
        FABEF.empresa.nome = nome;
        FABEF.empresa.telefone = telefone;
        FABEF.empresa.endereco = endereco;

        renderTudo();

        await gravarAuditoria("Actualizou as configurações estruturais da empresa / negócio.", "INFO");
        alert("Dados do negócio guardados com sucesso na nuvem.");
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar configurações do negócio:\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÓDULO LÓGICO: RENDERS E INDICADORES DO DASHBOARD (INÍCIO)
===================================================== */

/* =====================================================
   GESTÃO DE FUNCIONÁRIOS / UTILIZADORES
===================================================== */

async function cadastrarNovoFuncionario() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") { alert("Apenas o gerente pode cadastrar funcionários."); return; }

    // Limite do plano: 3 utilizadores no total (1 gerente + 2 funcionários).
    // A partir do 3º funcionário (4º utilizador), é preciso pagar uma taxa
    // extra de 20% da subscrição por cada funcionário adicional.
    const funcionariosAtivos = (FABEF.funcionarios || []).filter(f => (f.estado || "ATIVO") === "ATIVO").length;
    if (funcionariosAtivos >= 2) {
        alert(
            "O seu plano atual inclui até 2 funcionários (3 utilizadores no total, incluindo o gerente).\n\n" +
            "Para adicionar mais um funcionário, é necessária uma taxa adicional de 20% do valor da subscrição por cada funcionário extra.\n\n" +
            "Contacte o suporte para ativar esta funcionário extra na sua subscrição antes de continuar."
        );
        return;
    }

    const nome=document.getElementById("func-nome")?.value.trim();
    const email=document.getElementById("func-email")?.value.trim();
    const telefone=document.getElementById("func-telefone")?.value.trim();
    const senha=document.getElementById("func-senha")?.value || "";
    const foto=document.getElementById("func-foto")?.value.trim() || "";
    if(!nome || !email || !senha){ alert("Por favor, preencha os campos obrigatórios (Nome, E-mail e Senha)."); return; }
    if(senha.length<6){ alert("A senha do funcionário deve conter pelo menos 6 caracteres."); return; }
    let secondaryApp=null;
    try {
        secondaryApp=initializeApp(firebaseConfig, "funcionario-"+Date.now());
        const secondaryAuth=getAuth(secondaryApp);
        const cred=await createUserWithEmailAndPassword(secondaryAuth,email,senha);
        const uidFuncionario=cred.user.uid;
        const perfil={uid:uidFuncionario,nome,email,telefone,foto,empresaId:FABEF.empresaId,perfil:"funcionario",role:"operador",estado:"ATIVO",criadoPor:FABEF.user.uid,criadoEm:serverTimestamp()};
        await setDoc(doc(db,"utilizadores",uidFuncionario),perfil);
        await setDoc(doc(db,"empresas",FABEF.empresaId,"funcionarios",uidFuncionario),perfil);
        FABEF.funcionarios.push({id:uidFuncionario,...perfil});
        ["func-nome","func-email","func-telefone","func-senha","func-foto"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
        renderFuncionarios();
        await gravarAuditoria(`Cadastrou um novo funcionário na equipa: ${nome} (${email})`,"INFO");
        alert("Funcionário cadastrado com sucesso.");
    } catch(error) { console.error(error); alert("Não foi possível criar a conta do funcionário:\n"+mensagemFirebase(error)); }
    finally { if(secondaryApp){ try{await deleteApp(secondaryApp);}catch(e){} } }
}

function renderFuncionarios(){
    const tabela = document.getElementById("tabela-funcionarios");
    if (!tabela) return;

    const gerente = `
        <tr style="background:#f8fafc;">
            <td><strong>${escapeHTML(FABEF.userData?.nome || "Gerente Principal")}</strong></td>
            <td>${escapeHTML(FABEF.user?.email || "—")}</td>
            <td>${escapeHTML(FABEF.empresa?.telefone || "—")}</td>
            <td><span class="badge badge-green" style="background-color:#0f172a;color:#fff;">GERENTE</span></td>
            <td><span class="badge badge-green">ATIVO</span></td>
            <td>—</td>
        </tr>`;

    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    const funcionarios = (FABEF.funcionarios || []).map(f => {
        const ativo = (f.estado || "ATIVO") === "ATIVO";
        const acoes = souGerente ? `
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="btn btn-light btn-small" type="button" onclick="abrirEdicaoFuncionario('${escapeHTML(f.id)}')">✏️ Editar</button>
                <button class="btn ${ativo ? 'btn-danger' : 'btn-success'} btn-small" type="button" onclick="alternarEstadoFuncionario('${escapeHTML(f.id)}')">${ativo ? '🚫 Desativar' : '✅ Reativar'}</button>
            </div>` : "—";

        return `
        <tr>
            <td>${f.foto ? `<img src="${escapeHTML(f.foto)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none';">` : ""}<strong>${escapeHTML(f.nome || "—")}</strong></td>
            <td>${escapeHTML(f.email || "—")}</td>
            <td>${escapeHTML(f.telefone || "—")}</td>
            <td><span class="badge badge-yellow">OPERADOR</span></td>
            <td><span class="badge ${ativo ? 'badge-green' : 'badge-red'}">${escapeHTML(f.estado || "ATIVO")}</span></td>
            <td>${acoes}</td>
        </tr>`;
    }).join("");

    tabela.innerHTML = gerente + funcionarios;
}


window.abrirEdicaoFuncionario = function(id) {
    const f = FABEF.funcionarios.find(x => x.id === id);
    if (!f) return;
    document.getElementById("edit-func-id").value = f.id;
    document.getElementById("edit-func-nome").value = f.nome || "";
    document.getElementById("edit-func-telefone").value = f.telefone || "";
    document.getElementById("modal-editar-funcionario")?.classList.add("show");
};

document.getElementById("btn-salvar-edicao-funcionario")?.addEventListener("click", async () => {
    const id = document.getElementById("edit-func-id").value;
    const nome = document.getElementById("edit-func-nome").value.trim();
    const telefone = document.getElementById("edit-func-telefone").value.trim();
    if (!id || !nome) { alert("O nome do funcionário é obrigatório."); return; }

    try {
        const dadosAtualizados = { nome, telefone, atualizadoEm: serverTimestamp() };
        await updateDoc(doc(db, "utilizadores", id), dadosAtualizados);
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "funcionarios", id), dadosAtualizados);

        const f = FABEF.funcionarios.find(x => x.id === id);
        if (f) { f.nome = nome; f.telefone = telefone; }

        fecharModal("modal-editar-funcionario");
        renderFuncionarios();
        await gravarAuditoria("Editou os dados do funcionário: " + nome, "INFO");
        alert("Dados do funcionário atualizados com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar funcionário:\n" + mensagemFirebase(error));
    }
});

window.alternarEstadoFuncionario = async function(id) {
    const f = FABEF.funcionarios.find(x => x.id === id);
    if (!f) return;
    const novoEstado = (f.estado || "ATIVO") === "ATIVO" ? "INATIVO" : "ATIVO";
    const acao = novoEstado === "INATIVO" ? "desativar" : "reativar";

    if (!confirm(`Tem a certeza que deseja ${acao} o acesso de "${f.nome}"?` + (novoEstado === "INATIVO" ? "\n\nO funcionário deixará de conseguir entrar no sistema imediatamente." : ""))) return;

    try {
        await updateDoc(doc(db, "utilizadores", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "funcionarios", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        f.estado = novoEstado;
        renderFuncionarios();
        await gravarAuditoria(`${novoEstado === "INATIVO" ? "Desativou" : "Reativou"} o acesso do funcionário: ${f.nome}`, "ALERTA");
        alert(`Funcionário ${novoEstado === "INATIVO" ? "desativado" : "reativado"} com sucesso.`);
    } catch (error) {
        console.error(error);
        alert("Erro ao alterar o estado do funcionário:\n" + mensagemFirebase(error));
    }
};

/* CONTROLO DE SUBSCRIÇÃO */

function verificarSubscricao(){
    const aviso = document.getElementById("aviso-licenca");
    const bloqueio = document.getElementById("bloqueio-licenca");
    const estadoSpan = document.getElementById("estado-subscricao");
    if (!FABEF.empresa) return;

    const estado = FABEF.empresa.estado_licenca || "TESTE";
    const validade = FABEF.empresa.validade_subscricao;
    let expirada = false;
    if (validade) expirada = new Date() > new Date(validade);

    let testeExpirado = false;
    if (estado === "TESTE") {
        const origem = FABEF.empresa.data_registo || FABEF.empresa.criadoEm;
        const d = origem && typeof origem.toDate === "function" ? origem.toDate() : new Date(origem || Date.now());
        const fim = new Date(d);
        fim.setDate(fim.getDate() + 7);
        testeExpirado = new Date() > fim;
    }

    const ativa = estado === "ACTIVO" && !expirada;

    if (ativa) {
        if (aviso) {
            aviso.className = "alert alert-success";
            aviso.textContent = `✅ Licença Comercial Activa até: ${new Date(validade).toLocaleDateString("pt-MZ")}`;
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-success";
            estadoSpan.textContent = "Subscrição Regularizada. Obrigado por escolher o FABEF ERP!";
        }
        if (bloqueio) {
            bloqueio.classList.remove("show");
            bloqueio.style.display = "none";
        }
    } else if (estado === "TESTE" && !testeExpirado) {
        const origem = FABEF.empresa.data_registo || FABEF.empresa.criadoEm;
        const d = origem && typeof origem.toDate === "function" ? origem.toDate() : new Date(origem || Date.now());
        const fim = new Date(d);
        fim.setDate(fim.getDate() + 7);
        const dias = Math.max(0, Math.ceil((fim - Date.now()) / 86400000));
        if (aviso) {
            aviso.className = "alert alert-warning";
            aviso.textContent = `💡 Período de teste gratuito: Restam aproximadamente ${dias} dia(s).`;
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-warning";
            estadoSpan.textContent = "Período de teste gratuito activo.";
        }
        if (bloqueio) {
            bloqueio.classList.remove("show");
            bloqueio.style.display = "none";
        }
    } else {
        if (aviso) {
            aviso.className = "alert alert-danger";
            aviso.textContent = "❌ Subscrição Expirada. Por favor, regularize o pagamento mensal.";
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-danger";
            estadoSpan.textContent = "Acesso Bloqueado por falta de pagamento.";
        }
        if (bloqueio) {
            bloqueio.classList.add("show");
            bloqueio.style.display = "flex";
        }
    }
}

async function solicitarPagamentoBackend(operadora, telefone) {
    if (!FABEF_API_BASE) return null;

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sessão Firebase inválida.");

    const rota = operadora === "MPESA"
        ? "/api/pagamentos/mpesa"
        : "/api/pagamentos/emola";

    const resposta = await fetch(FABEF_API_BASE + rota, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            empresaId: FABEF.empresaId,
            telefone,
            valor: 250
        })
    });

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.mensagem || dados.erro || "Falha no servidor de pagamentos.");
    return dados;
}

async function solicitarSubscricaoMovel(){
    const operadora = document.getElementById("pagamento-operadora")?.value;
    const telefone = document.getElementById("pagamento-telefone")?.value.trim();
    const resultado = document.getElementById("resultado-pagamento");
    const botao = document.getElementById("btn-solicitar-pagamento");

    if (!telefone) { alert("Por favor, introduza o número de telefone."); return; }
    if (!/^\d{9}$/.test(telefone)) { alert("O número de telefone deve conter exatamente 9 dígitos."); return; }
    if (operadora === "MPESA" && !/^8[45]/.test(telefone)) { alert("Número inválido para M-Pesa. Deve começar com 84 ou 85."); return; }
    if (operadora === "EMOLA" && !/^8[67]/.test(telefone)) { alert("Número inválido para e-Mola. Deve começar com 86 ou 87."); return; }

    try {
        if (botao) botao.disabled = true;
        const backendResult = await solicitarPagamentoBackend(operadora, telefone);

        const payload = {
            transacaoId: backendResult?.transacaoId || backendResult?.transactionId || null,
            referenciaGateway: backendResult?.referencia || backendResult?.reference || null,
            operadora,
            contacto: telefone,
            valor: 250,
            estado: "AGUARDANDO_GATEWAY",
            data: new Date().toISOString(),
            criadoPor: FABEF.user.uid
        };
        const ref = await addDoc(subRef("pagamentos"), payload);
        FABEF.pagamentos.push({ id: ref.id, ...payload });
        if (resultado) {
            resultado.className = "alert alert-warning";
            resultado.innerHTML = `⏳ Pedido enviado. Referência: <strong>${escapeHTML(payload.referenciaGateway || ref.id)}</strong><br><small>A licença só será activada após confirmação real do gateway/backend.</small>`;
        }
        await gravarAuditoria("Solicitou subscrição mensal via " + operadora, "INFO");
    } catch (error) {
        console.error(error);
        if (resultado) {
            resultado.className = "alert alert-danger";
            resultado.textContent = "Falha ao criar o pedido de pagamento.";
        }
        alert(mensagemFirebase(error));
    } finally {
        if (botao) botao.disabled = false;
    }
}

document.getElementById("btn-solicitar-pagamento")?.addEventListener("click", solicitarSubscricaoMovel);

document.getElementById("btn-cadastrar-funcionario")?.addEventListener("click", cadastrarNovoFuncionario);

document.getElementById("btn-toggle-dark")?.addEventListener("click",()=>{
    const corpoApp=document.body; corpoApp.classList.toggle("dark-mode");
    const escuro=corpoApp.classList.contains("dark-mode");
    document.getElementById("btn-toggle-dark").textContent=escuro?"☀️ Modo Claro":"🌙 Modo Escuro";
    try{localStorage.setItem("FABEF_dark_mode",escuro?"1":"0");}catch(e){}
});
try{if(localStorage.getItem("FABEF_dark_mode")==="1"){document.body.classList.add("dark-mode");const b=document.getElementById("btn-toggle-dark");if(b)b.textContent="☀️ Modo Claro";}}catch(e){}

/* =====================================================
   MÓDULO LÓGICO: RECONCILIAÇÃO DE STOCK (CONFLITOS OFFLINE)
   Se dois dispositivos venderem offline o mesmo produto ao
   mesmo tempo, cada um só via o stock que tinha guardado
   localmente — quando ambos sincronizam, o stock real pode
   ficar negativo. Isto avisa o gerente para poder confirmar
   a quantidade física real e corrigir.
===================================================== */
const FABEF_STOCK_NEGATIVO_ALERTADO = new Set();

function verificarReconciliacaoStock() {
    const negativos = FABEF.produtos.filter(p => numero(p.stock) < 0);

    negativos.forEach(p => {
        if (!FABEF_STOCK_NEGATIVO_ALERTADO.has(p.id)) {
            FABEF_STOCK_NEGATIVO_ALERTADO.add(p.id);
            // Só grava o alerta de auditoria uma vez por produto/ocorrência,
            // para não encher o histórico com o mesmo aviso repetido.
            gravarAuditoria(
                `⚠️ Reconciliação necessária: o produto "${p.nome}" ficou com stock negativo (${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + p.unidade : ""}). Isto normalmente acontece quando dois dispositivos venderam offline o mesmo produto ao mesmo tempo, antes de sincronizar.`,
                "ALERTA"
            );
        }
    });

    // Esquece os que já foram corrigidos (stock voltou a 0 ou mais), para
    // que se voltarem a ficar negativos no futuro sejam avisados de novo.
    Array.from(FABEF_STOCK_NEGATIVO_ALERTADO).forEach(id => {
        const produto = FABEF.produtos.find(p => p.id === id);
        if (!produto || numero(produto.stock) >= 0) {
            FABEF_STOCK_NEGATIVO_ALERTADO.delete(id);
        }
    });

    renderAvisoReconciliacao();
}

function renderAvisoReconciliacao() {
    const container = document.getElementById("aviso-reconciliacao-stock");
    if (!container) return;

    const ehGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    const negativos = FABEF.produtos.filter(p => p.ramo === FABEF.ramo && numero(p.stock) < 0);

    if (!ehGerente || negativos.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <div class="alert alert-warn">
            <strong>⚠️ Reconciliação de stock necessária (${negativos.length})</strong>
            <p style="margin:6px 0;font-size:13px;">
                Estes produtos ficaram com stock negativo — normalmente porque dois dispositivos
                venderam offline o mesmo produto ao mesmo tempo, antes de sincronizar. Confirme a
                quantidade real na loja e corrija em Inventário → "⚙️ Ajustar".
            </p>
            <ul style="margin:6px 0 0 18px;font-size:13px;">
                ${negativos.map(p => `<li><strong>${escapeHTML(p.nome)}</strong>: stock atual ${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + escapeHTML(p.unidade) : ""}</li>`).join("")}
            </ul>
        </div>
    `;
}


function renderDashboard() {
    renderAvisoReconciliacao();

    const indicadorEmpresa = document.getElementById("inicio-empresa");
    const painelNomeNegocio = document.getElementById("inicio-nome-negocio");
    const painelIdEmpresa = document.getElementById("inicio-id-empresa");
    const painelUtilizador = document.getElementById("inicio-utilizador");
    const painelRamo = document.getElementById("inicio-ramo");

    if (indicadorEmpresa) indicadorEmpresa.textContent = FABEF.empresa?.nome || "—";
    if (painelNomeNegocio) painelNomeNegocio.textContent = FABEF.empresa?.nome || "—";
    if (painelIdEmpresa) painelIdEmpresa.textContent = FABEF.empresaId || "—";
    if (painelUtilizador) painelUtilizador.textContent = FABEF.user?.email || "—";
    if (painelRamo) painelRamo.textContent = FABEF.ramo;

    const hoje = dataHoje();

    // Filtra transações realizadas no dia atual para o somatório rápido do balcão
    const vendasHoje = FABEF.vendas.filter(v => {
        const dataVenda = new Date(v.data || v.date || 0);
        return dataVenda >= hoje;
    });

    const totalHoje = vendasHoje.reduce((s, v) => s + numero(v.total), 0);
    
    const painelVendas = document.getElementById("inicio-vendas");
    if (painelVendas) painelVendas.textContent = dinheiro(totalHoje);

    // Soma quantos KGs (e litros) foram vendidos hoje, além do valor em MT
    let kgHoje = 0, litroHoje = 0;
    vendasHoje.forEach(v => (v.itens || []).forEach(item => {
        if (item.unidade === "kg") kgHoje += numero(item.quantidade);
        if (item.unidade === "litro") litroHoje += numero(item.quantidade);
    }));
    const painelKg = document.getElementById("inicio-kg-vendidos");
    if (painelKg) {
        const partes = [];
        if (kgHoje > 0) partes.push(`${kgHoje.toFixed(2)} kg`);
        if (litroHoje > 0) partes.push(`${litroHoje.toFixed(2)} L`);
        painelKg.textContent = partes.length ? partes.join(" + ") : "0 kg";
    }

    const baixos = FABEF.produtos.filter(p => p.ramo === FABEF.ramo && numero(p.stock) <= numero(p.stockMinimo)).length;
    
    const painelStockBaixo = document.getElementById("inicio-stock-baixo");
    if (painelStockBaixo) painelStockBaixo.textContent = baixos;
}


/* =====================================================
   MÓDULO CENTRAL: INTERCONEXÃO E REFRESH EM MASSA (RENDER TUDO)
===================================================== */

/* =====================================================
   MÓDULO LÓGICO: HISTÓRICO DE AUDITORIA (VISUALIZAÇÃO)
===================================================== */
/* =====================================================
   MÓDULO LÓGICO: METAS (LOJA E POR FUNCIONÁRIO)
===================================================== */
function inicioDaSemana(data) {
    const d = new Date(data);
    const diaSemana = d.getDay(); // 0=domingo
    const diff = (diaSemana === 0 ? -6 : 1) - diaSemana; // segunda-feira como início
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function renderMetas() {
    const hoje = dataHoje();
    const inicioSemana = inicioDaSemana(new Date());
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

    const vendasHoje = FABEF.vendas.filter(v => new Date(v.data || 0) >= hoje);
    const vendasSemana = FABEF.vendas.filter(v => new Date(v.data || 0) >= inicioSemana);
    const vendasMes = FABEF.vendas.filter(v => new Date(v.data || 0) >= inicioMes);

    const somaTotais = arr => arr.reduce((s, v) => s + numero(v.total), 0);

    const metaDiaria = numero(FABEF.empresa?.metaDiaria);
    const metaSemanal = numero(FABEF.empresa?.metaSemanal);
    const metaMensal = numero(FABEF.empresa?.metaMensal);

    const barraHtml = (atual, meta) => {
        const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
        const cor = pct >= 100 ? "#10b981" : (pct >= 60 ? "#f59e0b" : "#2563eb");
        return `
            <div style="background:#e2e8f0;border-radius:6px;height:16px;overflow:hidden;margin:6px 0;">
                <div style="width:${pct}%;background:${cor};height:100%;"></div>
            </div>
            <p style="font-size:12px;color:#64748b;">${dinheiro(atual)} de ${dinheiro(meta)} (${pct}%)</p>`;
    };

    const painel = document.getElementById("metas-progresso-loja");
    if (painel) {
        painel.innerHTML = `
            <div class="kpi"><div class="rotulo">Meta diária</div>${barraHtml(somaTotais(vendasHoje), metaDiaria)}</div>
            <div class="kpi"><div class="rotulo">Meta semanal</div>${barraHtml(somaTotais(vendasSemana), metaSemanal)}</div>
            <div class="kpi"><div class="rotulo">Meta mensal</div>${barraHtml(somaTotais(vendasMes), metaMensal)}</div>
        `;
    }

    // Formulário de metas gerais (só o gerente edita)
    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    ["metas-input-diaria", "metas-input-semanal", "metas-input-mensal"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !souGerente;
    });
    if (document.getElementById("metas-input-diaria") && document.activeElement?.id !== "metas-input-diaria") document.getElementById("metas-input-diaria").value = metaDiaria || "";
    if (document.getElementById("metas-input-semanal") && document.activeElement?.id !== "metas-input-semanal") document.getElementById("metas-input-semanal").value = metaSemanal || "";
    if (document.getElementById("metas-input-mensal") && document.activeElement?.id !== "metas-input-mensal") document.getElementById("metas-input-mensal").value = metaMensal || "";
    const btnGuardarMetas = document.getElementById("btn-guardar-metas-loja");
    if (btnGuardarMetas) btnGuardarMetas.style.display = souGerente ? "" : "none";

    // Metas por funcionário
    const tabela = document.getElementById("tabela-metas-funcionarios");
    if (tabela) {
        const metasFunc = FABEF.empresa?.metasFuncionarios || {};
        tabela.innerHTML = (FABEF.funcionarios || []).map(f => {
            const vendasFunc = vendasMes.filter(v => v.operadorId === f.id);
            const totalFunc = somaTotais(vendasFunc);
            const metaFunc = numero(metasFunc[f.id]);
            return `<tr>
                <td><strong>${escapeHTML(f.nome)}</strong></td>
                <td style="max-width:180px;">
                    ${souGerente ? `<input type="number" min="0" step="0.01" value="${metaFunc || ""}" style="width:110px;padding:6px;border:1px solid #cbd5e1;border-radius:6px;" onchange="salvarMetaFuncionario('${escapeHTML(f.id)}', this.value)">` : dinheiro(metaFunc)}
                </td>
                <td style="min-width:160px;">${barraHtml(totalFunc, metaFunc)}</td>
            </tr>`;
        }).join("") || `<tr><td colspan="3" style="text-align:center;color:#64748b;">Sem funcionários cadastrados.</td></tr>`;
    }
}

document.getElementById("btn-guardar-metas-loja")?.addEventListener("click", async () => {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") { alert("Apenas o gerente pode definir metas."); return; }
    const metaDiaria = numero(document.getElementById("metas-input-diaria")?.value);
    const metaSemanal = numero(document.getElementById("metas-input-semanal")?.value);
    const metaMensal = numero(document.getElementById("metas-input-mensal")?.value);

    try {
        await updateDoc(empresaRef(), { metaDiaria, metaSemanal, metaMensal, atualizadoEm: serverTimestamp() });
        FABEF.empresa.metaDiaria = metaDiaria;
        FABEF.empresa.metaSemanal = metaSemanal;
        FABEF.empresa.metaMensal = metaMensal;
        renderMetas();
        await gravarAuditoria("Definiu as metas gerais da loja.", "INFO");
        alert("Metas guardadas com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar metas:\n" + mensagemFirebase(error));
    }
});

window.salvarMetaFuncionario = async function(funcionarioId, valor) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") { alert("Apenas o gerente pode definir metas."); return; }
    try {
        await updateDoc(empresaRef(), { [`metasFuncionarios.${funcionarioId}`]: numero(valor), atualizadoEm: serverTimestamp() });
        if (!FABEF.empresa.metasFuncionarios) FABEF.empresa.metasFuncionarios = {};
        FABEF.empresa.metasFuncionarios[funcionarioId] = numero(valor);
        renderMetas();
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar meta do funcionário:\n" + mensagemFirebase(error));
    }
};


/* =====================================================
   MÓDULO LÓGICO: DESEMPENHO DOS FUNCIONÁRIOS
===================================================== */
function renderDesempenho() {
    const corpo = document.getElementById("tabela-desempenho");
    if (!corpo) return;

    const equipa = [
        { id: FABEF.user?.uid, nome: (FABEF.userData?.nome || "Gerente") + " (gerente)" },
        ...(FABEF.funcionarios || []).map(f => ({ id: f.id, nome: f.nome }))
    ];

    corpo.innerHTML = equipa.map(pessoa => {
        const vendasPessoa = FABEF.vendas.filter(v => v.operadorId === pessoa.id);
        const valorVendido = vendasPessoa.reduce((s, v) => s + numero(v.total), 0);
        const descontos = vendasPessoa.reduce((s, v) => s + numero(v.desconto), 0);
        const encomendasPessoa = FABEF.encomendas.filter(e => e.criadoPor === pessoa.id).length;
        const dividasPessoa = FABEF.dividas.filter(d => d.criadoPor === pessoa.id).length;
        const sugestoesPessoa = (FABEF.sugestoes || []).filter(s => s.criadoPor === pessoa.id).length;

        return `<tr>
            <td><strong>${escapeHTML(pessoa.nome)}</strong></td>
            <td>${vendasPessoa.length}</td>
            <td>${dinheiro(valorVendido)}</td>
            <td>${dinheiro(descontos)}</td>
            <td>${encomendasPessoa}</td>
            <td>${dividasPessoa}</td>
            <td>${sugestoesPessoa}</td>
        </tr>`;
    }).join("");
}


/* =====================================================
   MÓDULO LÓGICO: SUGESTÕES DO FUNCIONÁRIO
===================================================== */
document.getElementById("btn-enviar-sugestao")?.addEventListener("click", async () => {
    const texto = document.getElementById("sugestao-texto")?.value.trim();
    if (!texto) { alert("Escreva a sua sugestão antes de enviar."); return; }

    try {
        const payload = {
            texto: texto,
            estado: "NOVA",
            criadoPor: FABEF.user.uid,
            criadoPorNome: FABEF.userData?.nome || FABEF.user.email,
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        };
        const ref = await addDoc(subRef("sugestoes"), payload);
        FABEF.sugestoes = FABEF.sugestoes || [];
        FABEF.sugestoes.push({ id: ref.id, ...payload, criadoEm: undefined });
        document.getElementById("sugestao-texto").value = "";
        renderSugestoes();
        alert("Sugestão enviada ao gerente. Obrigado!");
    } catch (error) {
        console.error(error);
        alert("Erro ao enviar sugestão:\n" + mensagemFirebase(error));
    }
});

function renderSugestoes() {
    const corpo = document.getElementById("tabela-sugestoes");
    if (!corpo) return;
    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    corpo.innerHTML = (FABEF.sugestoes || [])
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
        .map(s => `<tr>
            <td>${dataTexto(s.data)}</td>
            <td>${escapeHTML(s.criadoPorNome || "—")}</td>
            <td>${escapeHTML(s.texto)}</td>
            <td><span class="badge ${s.estado === 'ADICIONADA' ? 'badge-green' : (s.estado === 'REJEITADA' ? 'badge-red' : 'badge-yellow')}">${escapeHTML(s.estado || "NOVA")}</span></td>
            <td>${souGerente && s.estado === "NOVA" ? `
                <button class="btn btn-success btn-small" type="button" onclick="marcarSugestao('${escapeHTML(s.id)}','ADICIONADA')">✔️ Adicionar ao catálogo</button>
                <button class="btn btn-light btn-small" type="button" onclick="marcarSugestao('${escapeHTML(s.id)}','REJEITADA')">✖️ Rejeitar</button>
            ` : "—"}</td>
        </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#64748b;">Ainda não há sugestões enviadas.</td></tr>`;
}

window.marcarSugestao = async function(id, novoEstado) {
    try {
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "sugestoes", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        const s = FABEF.sugestoes.find(x => x.id === id);
        if (s) s.estado = novoEstado;
        renderSugestoes();
        await gravarAuditoria(`Marcou uma sugestão de funcionário como: ${novoEstado}`, "INFO");
        if (novoEstado === "ADICIONADA") {
            alert('Sugestão marcada como adicionada. Vá à página "Produtos" para criar o novo artigo/serviço, se ainda não o fez.');
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar sugestão:\n" + mensagemFirebase(error));
    }
};


function renderAuditoria() {
    const corpo = document.getElementById("tabela-auditoria");
    if (!corpo) return;

    const filtroTexto = (document.getElementById("auditoria-pesquisa")?.value || "").toLowerCase();

    const registos = [...FABEF.auditoria]
        .filter(a => !filtroTexto ||
            String(a.mensagem || "").toLowerCase().includes(filtroTexto) ||
            String(a.utilizadorNome || "").toLowerCase().includes(filtroTexto))
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
        .slice(0, 300); // Limita a exibição às 300 entradas mais recentes por performance

    corpo.innerHTML = registos.map(a => {
        const cor = a.nivel === "ALERTA" ? "#ef4444" : (a.nivel === "AVISO" ? "#f59e0b" : "#2563eb");
        return `<tr>
            <td style="white-space:nowrap;">${dataTexto(a.data)}</td>
            <td>${escapeHTML(a.utilizadorNome || "—")}</td>
            <td>${escapeHTML(a.mensagem || "—")}</td>
            <td><span class="badge" style="background:${cor}22;color:${cor};">${escapeHTML(a.nivel || "INFO")}</span></td>
        </tr>`;
    }).join("") || `<tr><td colspan="4" style="text-align:center;color:#64748b;">Sem registos de auditoria ainda.</td></tr>`;
}
document.getElementById("auditoria-pesquisa")?.addEventListener("input", renderAuditoria);


function renderTudo() {
    // Executa em cadeia sequencial a renderização e o desenho de cada bloco da SPA
    renderDashboard();
    renderRamos();
    renderProdutos();
    renderInventario();
    preencherProdutosCompra();
    renderCompras();
    renderPOS();
    renderVendas();
    renderFornecedores();
    renderClientes();
    renderDividas();
    renderEncomendas();
    atualizarTelaCaixa();
    renderDespesas();
    renderRelatorios();

    // Proteções de segurança contra erros de inicialização de funções secundárias
    if (typeof renderFuncionarios === "function") renderFuncionarios();
    if (typeof renderAuditoria === "function") renderAuditoria();
    if (typeof renderMetas === "function") renderMetas();
    if (typeof renderDesempenho === "function") renderDesempenho();
    if (typeof renderSugestoes === "function") renderSugestoes();
    if (typeof renderConfiguracoes === "function") renderConfiguracoes();
    if (typeof verificarSubscricao === "function") verificarSubscricao();
}


/* =====================================================
   MÓDULO TRADUTOR: CENTRAL DE TRATAMENTO DE ERROS DO FIREBASE
===================================================== */

function mensagemFirebase(error) {
    if (!error) return "Erro interno desconhecido.";

    const code = error.code || "";

    const mensagens = {
        "auth/invalid-credential": "E-mail ou palavra-passe introduzidos estão incorretos.",
        "auth/email-already-in-use": "Aviso de Segurança: Este endereço de e-mail já se encontra registado.",
        "auth/invalid-email": "O formato de e-mail introduzido não é considerado válido.",
        "auth/weak-password": "A senha introduzida é demasiado fraca. Use pelo menos 6 caracteres.",
        "permission-denied": "Acesso Recusado: Permissões insuficientes para ler ou escrever no Firebase.",
        "failed-precondition": "A base de dados do Firebase exige a criação de índices de consulta.",
        "unavailable": "O servidor do Firebase encontra-se temporariamente indisponível. Verifique a internet."
    };

    return mensagens[code] || error.message || code || "Falha operacional não catalogada.";
}


/* =====================================================
   INICIALIZAÇÃO SISTÉMICA E CONFIGURAÇÕES VISUAIS
===================================================== */

const selectIdiomaElement = document.getElementById("select-idioma");
if (selectIdiomaElement) {
    selectIdiomaElement.value = "pt";
}

/*
 OBSERVAÇÃO CRÍTICA DE PROCESSO:
 A interface da aplicação permanece totalmente oculta (.hidden) até que o 
 gatilho onAuthStateChanged confirme o token do utilizador junto à nuvem.
*/
