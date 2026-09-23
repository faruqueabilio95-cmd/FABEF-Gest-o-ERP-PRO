import confetti from "canvas-confetti";
if (typeof window !== "undefined") { window.confetti = confetti; }
import { initializeApp, deleteApp } from "firebase/app";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence,
    sendPasswordResetEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "firebase/auth";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc as fbAddDoc,
    setDoc as fbSetDoc,
    updateDoc as fbUpdateDoc,
    deleteDoc as fbDeleteDoc,
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
} from "firebase/firestore";

// Proxies for addDoc/setDoc/updateDoc/deleteDoc to seamlessly support Demo Mode
const addDoc = async (collRef, data) => {
    if (window.FABEF?.isDemoMode) {
        const fakeId = "demo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        const item = { id: fakeId, ...data };
        const path = collRef?.path || "";
        const parts = path.split("/");
        const collName = parts[parts.length - 1];
        if (["produtos","clientes","fornecedores","compras","vendas","despesas","dividas","encomendas","auditoria_logs","sugestoes","caixas_turnos","ajustes_stock"].includes(collName) && window.FABEF?.ramo && data?.ramo == null) data={...data,ramo:window.FABEF.ramo};
        if (collName && window.FABEF[collName] && Array.isArray(window.FABEF[collName])) {
            window.FABEF[collName].unshift(item);
        }
        return { id: fakeId, path: path + "/" + fakeId };
    }
    return fbAddDoc(collRef, data);
};

const setDoc = async (documentRef, data, options) => {
    const pp=documentRef?.path||""; const aa=pp.split("/"); const cc=aa[aa.length-2]||"";
    if (["produtos","clientes","fornecedores","compras","vendas","despesas","dividas","encomendas","auditoria_logs","sugestoes","caixas_turnos","ajustes_stock"].includes(cc) && window.FABEF?.ramo && data?.ramo == null) data={...data,ramo:window.FABEF.ramo};
    if (window.FABEF?.isDemoMode) {
        const path = documentRef?.path || "";
        const parts = path.split("/");
        const id = documentRef?.id || parts[parts.length - 1] || ("demo_" + Date.now());
        const collName = (parts.length >= 2 && parts[parts.length - 2]) || (path.includes("vendas") ? "vendas" : (path.includes("caixas") ? "caixas_turnos" : ""));
        if (collName && window.FABEF[collName] && Array.isArray(window.FABEF[collName])) {
            const idx = window.FABEF[collName].findIndex(x => x.id === id);
            if (idx >= 0) {
                window.FABEF[collName][idx] = { ...window.FABEF[collName][idx], ...data, id };
            } else {
                window.FABEF[collName].unshift({ ...data, id });
            }
        } else if (path.includes("vendas")) {
            window.FABEF.vendas = window.FABEF.vendas || [];
            window.FABEF.vendas.unshift({ ...data, id });
        }
        return;
    }
    return fbSetDoc(documentRef, data, options);
};

const updateDoc = async (documentRef, data) => {
    if (window.FABEF?.isDemoMode) {
        const path = documentRef?.path || "";
        const parts = path.split("/");
        const id = parts[parts.length - 1];
        const collName = parts[parts.length - 2];
        if (collName && window.FABEF[collName] && Array.isArray(window.FABEF[collName])) {
            const idx = window.FABEF[collName].findIndex(x => x.id === id);
            if (idx >= 0) {
                const target = window.FABEF[collName][idx];
                for (const k in data) {
                    if (data[k] && typeof data[k] === 'object' && 'operand' in data[k]) {
                        target[k] = (Number(target[k]) || 0) + Number(data[k].operand || 0);
                    } else if (data[k] && typeof data[k] === 'object' && 'elements' in data[k]) {
                        target[k] = Array.isArray(target[k]) ? [...target[k], ...data[k].elements] : [...data[k].elements];
                    } else if (data[k] && typeof data[k] === 'object' && data[k]._methodName === 'serverTimestamp') {
                        target[k] = new Date().toISOString();
                    } else {
                        target[k] = data[k];
                    }
                }
            }
        }
        return;
    }
    return fbUpdateDoc(documentRef, data);
};

const deleteDoc = async (documentRef) => {
    if (window.FABEF?.isDemoMode) {
        const path = documentRef?.path || "";
        const parts = path.split("/");
        const id = parts[parts.length - 1];
        const collName = parts[parts.length - 2];
        if (collName && window.FABEF[collName] && Array.isArray(window.FABEF[collName])) {
            window.FABEF[collName] = window.FABEF[collName].filter(x => x.id !== id);
        }
        return;
    }
    return fbDeleteDoc(documentRef);
};

/* =====================================================
   CONFIGURAÇão FIREBASE — PRODUÇão
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
   ESTADO GLOBAL DA APLICAÇão (FABEF GLOBAL MEMORY)
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
    dispensas: [],
    auditoria: [],
    carrinho: [],
    turnoId: null,
    turno: null,
    dataAtiva: new Date().toLocaleDateString("en-CA"),
    _raw: {},
    listeners: []
};

/* =====================================================
   HELPER DE AUTORIZAÇÃO: VERIFICA SE É GERENTE / ADMIN
===================================================== */
function ehUsuarioGerente() {
    if (window.FABEF?.isDemoMode) {
        return (window.FABEF.demoPerfil || "gerente") === "gerente";
    }
    if (FABEF.empresa && (FABEF.empresa.donoId === FABEF.user?.uid || FABEF.empresa.criadoPor === FABEF.user?.uid)) {
        return true;
    }
    const perfil = String(FABEF.userData?.perfil || FABEF.userData?.role || "").toLowerCase();
    if (perfil === "gerente" || perfil === "admin" || perfil === "administrador" || perfil === "proprietario" || perfil === "dono") {
        return true;
    }
    // Se o usuário está autenticado e não é estritamente funcionário, assume gerente
    if (FABEF.user && perfil !== "funcionario" && perfil !== "operador") {
        return true;
    }
    return false;
}
window.ehUsuarioGerente = ehUsuarioGerente;


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
   DICIONÁRIO SISTÉMICO DE IDIOMAS (TRADUÇão DE TERMOS)
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
        "Cimento (saco)", "Areia (mÂ³)", "Brita (mÂ³)", "Ferro de construção",
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
   FUNÇão EM FALTA NO FICHEIRO ORIGINAL — é chamada em cerca
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
   MÓDULO LÓGICO: AUTENTICAÇão E CICLO DE ARRANQUE V9.9
   - Um único fluxo de login/registo
   - Sem fallback inseguro de perfil
   - Bloqueio de corrida durante criação da conta
   - Não faz logout automático quando Firestore falha
===================================================== */

let FABEF_registoEmCurso = false;
let FABEF_arranqueEmCurso = false;

const elAuth = id => document.getElementById(id);

async function executarLogin() {
    const emailInput = elAuth("login-email");
    const senhaInput = elAuth("login-senha");
    const email = (emailInput?.value || "").trim().toLowerCase();
    const senha = senhaInput?.value || "";
    const status = elAuth("login-status");

    if (!email || !senha) {
        if (status) status.textContent = "⚠️ Introduza o e-mail e a senha.";
        return;
    }

    const btn = elAuth("btn-login");
    if (btn) btn.disabled = true;
    if (status) {
        status.textContent = "⏳ A validar credenciais...";
        status.style.color = "#2563eb";
    }

    try {
        // Autentica no Firebase
        const credencial = await signInWithEmailAndPassword(auth, email, senha);
        if (status) {
            status.textContent = "🟢 Acesso autorizado! A abrir o painel...";
            status.style.color = "#10b981";
        }
        if (credencial?.user) {
            sessionStorage.setItem("fabef_sessao_desbloqueada", "true");
            await iniciarSessaoFABEF(credencial.user);
        }
    } catch (error) {
        console.error("Erro de login:", error);
        if (status) {
            status.style.color = "#dc2626";
            status.textContent = "🔴 " + mensagemFirebase(error);
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

const btnLogin = elAuth("btn-login");
if (btnLogin && !btnLogin.dataset.fabefBound) {
    btnLogin.dataset.fabefBound = "1";
    btnLogin.addEventListener("click", executarLogin);
}

elAuth("login-senha")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        executarLogin();
    }
});

elAuth("login-email")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        elAuth("login-senha")?.focus();
    }
});

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

elAuth("reg-senha")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        criarConta();
    }
});
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
        if (status) status.textContent = "⚠️ Preencha os campos obrigatórios (Negócio, Gerente, E-mail e Senha).";
        return;
    }

    if (senha.length < 6) {
        if (status) status.textContent = "⚠️ A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    FABEF_registoEmCurso = true;
    if (btnRegistar) btnRegistar.disabled = true;
    if (status) status.textContent = "⏳ A criar a conta no Firebase...";

    try {
        let credencial;
        try {
            credencial = await createUserWithEmailAndPassword(auth, email, senha);
        } catch (authError) {
            // Se o e-mail já existe no Firebase Auth (por exemplo, tentativa anterior onde o perfil não gravou),
            // autentica para auto-reparar e completar o registo da empresa e perfil.
            if (authError.code === "auth/email-already-in-use") {
                if (status) status.textContent = "⏳ E-mail já registado. A autenticar e a sincronizar o perfil...";
                credencial = await signInWithEmailAndPassword(auth, email, senha);
            } else {
                throw authError;
            }
        }

        const uidUser = credencial.user.uid;
        const empresaId = uidUser;
        const agora = new Date().toISOString();

        // 1º REGISTO: O perfil de utilizador DEVE ser gravado primeiro para satisfazer as regras de segurança do Firestore
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
        await setDoc(doc(db, "utilizadores", uidUser), utilizador);

        // 2º REGISTO: Agora que o perfil existe como gerente, grava os dados da empresa
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
        await setDoc(doc(db, "empresas", empresaId), empresa);

        if (status) status.textContent = "🟢 Conta e empresa criadas com sucesso. A abrir o sistema...";

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
    FABEF.gastosFuncionarios = [];
    FABEF.pagamentos = [];
    FABEF.auditoria = [];
    FABEF.sugestoes = [];
    FABEF.carrinho = [];
    FABEF.turnoId = null;
    FABEF.turno = null;
    FABEF.vendasTurno = [];
    FABEF.despesasTurno = [];
    FABEF.dataAtiva = new Date().toLocaleDateString("en-CA");
    FABEF._raw = {};
    FABEF.carregado = false;
}

async function iniciarSessaoFABEF(user) {
    if (FABEF_arranqueEmCurso) return;
    FABEF_arranqueEmCurso = true;

    const loginStatus = elAuth("login-status");
    try {
        FABEF.user = user;
        if (loginStatus) loginStatus.textContent = "â³ A carregar a empresa...";

        // Não existe fallback para perfil inexistente.
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
    mostrarModalConfigurarPin(auth.currentUser || { uid }, false);
}

function mostrarModalConfigurarPin(user, obrigatorio = false) {
    const modal = document.getElementById("modal-configurar-pin");
    if (!modal) return;
    const inpNovo = document.getElementById("input-novo-pin");
    const inpConf = document.getElementById("input-confirmar-pin");
    const status = document.getElementById("status-config-pin");
    const btnCancelar = document.getElementById("btn-cancelar-pin");
    const titulo = document.getElementById("titulo-config-pin");
    const desc = document.getElementById("desc-config-pin");

    if (inpNovo) inpNovo.value = "";
    if (inpConf) inpConf.value = "";
    if (status) status.textContent = "";

    if (obrigatorio) {
        if (titulo) titulo.textContent = "🛡️ Ativar PIN de Segurança (Obrigatório)";
        if (desc) desc.textContent = "Para garantir a máxima proteção do seu telemóvel e evitar acessos indevidos, crie um código PIN numérico de 4 a 6 dígitos.";
        if (btnCancelar) {
            btnCancelar.textContent = "Sair da Conta";
            btnCancelar.onclick = async () => {
                modal.classList.remove("active");
                sessionStorage.removeItem("fabef_sessao_desbloqueada");
                sessionStorage.setItem("fabef_saiu_manual", "true");
                await signOut(auth);
            };
        }
    } else {
        if (titulo) titulo.textContent = "🔑 Definir / Alterar PIN";
        if (desc) desc.textContent = "Introduza o novo código PIN de 4 a 6 dígitos para este dispositivo.";
        if (btnCancelar) {
            btnCancelar.textContent = "Cancelar";
            btnCancelar.onclick = () => modal.classList.remove("active");
        }
    }

    modal.classList.add("active");
    setTimeout(() => inpNovo?.focus(), 200);
}

function mostrarEcraPin(user) {
    if (elAuth("app")) elAuth("app").classList.add("hidden");
    if (elAuth("tela-login")) elAuth("tela-login").style.display = "none";
    const telaPin = document.getElementById("tela-pin");
    if (telaPin) telaPin.style.display = "flex";

    const identificador = user?.email || FABEF.userData?.nome || FABEF.user?.email || "Administrador";
    const sub = document.getElementById("pin-subtitulo");
    if (sub) {
        sub.innerHTML = `Sessão protegida: <strong style="color:#1e40af;">${escapeHTML(identificador)}</strong><br><span style="font-size:12px;color:#64748b;">Introduza o PIN de 4 dígitos para desbloquear</span>`;
    }

    const inputPin = document.getElementById("pin-input");
    if (inputPin) {
        inputPin.value = "";
        setTimeout(() => inputPin.focus(), 150);
    }
    const statusPin = document.getElementById("pin-status");
    if (statusPin) {
        statusPin.textContent = "";
    }
}

function esconderEcraPin() {
    const telaPin = document.getElementById("tela-pin");
    if (telaPin) telaPin.style.display = "none";
}

async function validarEEntrarPin() {
    const input = document.getElementById("pin-input");
    const pinDigitado = (input?.value || "").trim();
    const statusPin = document.getElementById("pin-status");
    if (!pinDigitado) {
        if (statusPin) {
            statusPin.textContent = "⚠️ Introduza o seu código PIN.";
            statusPin.style.color = "#b45309";
        }
        return;
    }

    if (window.FABEF?.isDemoMode) {
        if (pinDigitado.length >= 4) {
            sessionStorage.setItem("fabef_sessao_desbloqueada", "true");
            esconderEcraPin();
            document.getElementById("app")?.classList.remove("hidden");
            toast("🔓 Aplicação desbloqueada com sucesso.");
        } else {
            if (statusPin) {
                statusPin.textContent = "🔴 O PIN deve ter pelo menos 4 dígitos (ex: 1234).";
                statusPin.style.color = "#dc2626";
            }
        }
        return;
    }

    const user = auth.currentUser || FABEF.user;
    if (!user) {
        mostrarEcraPin();
        return;
    }

    let hashGuardado = localStorage.getItem(chavePinLocal(user.uid));
    if (!hashGuardado && FABEF.userData?.pinHash) {
        hashGuardado = FABEF.userData.pinHash;
        localStorage.setItem(chavePinLocal(user.uid), hashGuardado);
    }

    if (!hashGuardado) {
        mostrarModalConfigurarPin(user, true);
        return;
    }

    const hashDigitado = await calcularHashPin(pinDigitado);
    if (hashDigitado === hashGuardado) {
        if (statusPin) {
            statusPin.textContent = "🟢 PIN correto! A abrir o sistema...";
            statusPin.style.color = "#16a34a";
        }
        sessionStorage.setItem("fabef_sessao_desbloqueada", "true");
        setTimeout(async () => {
            esconderEcraPin();
            document.getElementById("app")?.classList.remove("hidden");
            await iniciarSessaoFABEF(user);
        }, 150);
    } else {
        if (input) input.value = "";
        if (statusPin) {
            statusPin.textContent = "🔴 PIN incorreto. Tente novamente ou use a palavra-passe.";
            statusPin.style.color = "#dc2626";
        }
        setTimeout(() => input?.focus(), 100);
    }
}

// Ouvintes de clique e teclado do PIN
document.getElementById("btn-pin-entrar")?.addEventListener("click", validarEEntrarPin);

document.getElementById("pin-input")?.addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "");
    if (e.target.value.length === 4) {
        validarEEntrarPin();
    }
});

document.getElementById("pin-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        validarEEntrarPin();
    }
});

// Teclas do teclado numérico táctil (touchscreen / celular)
document.querySelectorAll(".pin-num-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const input = document.getElementById("pin-input");
        if (!input) return;
        const key = btn.getAttribute("data-key");
        if (key === "clear") {
            input.value = "";
        } else if (key === "back") {
            input.value = input.value.slice(0, -1);
        } else if (/^\d$/.test(key)) {
            if (input.value.length < 6) {
                input.value += key;
                if (input.value.length === 4) {
                    validarEEntrarPin();
                }
            }
        }
    });
});

document.getElementById("btn-pin-esqueceu")?.addEventListener("click", async () => {
    if (confirm("Deseja sair para entrar com o seu e-mail e palavra-passe da conta?")) {
        sessionStorage.removeItem("fabef_sessao_desbloqueada");
        sessionStorage.setItem("fabef_saiu_manual", "true");
        esconderEcraPin();
        await signOut(auth);
    }
});

document.getElementById("btn-pin-sair")?.addEventListener("click", async () => {
    sessionStorage.removeItem("fabef_sessao_desbloqueada");
    sessionStorage.setItem("fabef_saiu_manual", "true");
    esconderEcraPin();
    if (window.FABEF?.isDemoMode) {
        window.FABEF.isDemoMode = false;
        await limparEstadoFABEF();
        if (elAuth("app")) elAuth("app").classList.add("hidden");
        if (elAuth("tela-login")) elAuth("tela-login").style.display = "flex";
        return;
    }
    const user = auth.currentUser;
    await signOut(auth);
});

// Gravação de PIN no Modal
document.getElementById("btn-salvar-pin")?.addEventListener("click", async () => {
    const inpNovo = document.getElementById("input-novo-pin");
    const inpConf = document.getElementById("input-confirmar-pin");
    const status = document.getElementById("status-config-pin");
    const modal = document.getElementById("modal-configurar-pin");

    const p1 = (inpNovo?.value || "").trim();
    const p2 = (inpConf?.value || "").trim();

    if (!/^\d{4,6}$/.test(p1)) {
        if (status) {
            status.textContent = "⚠️ O PIN deve ter entre 4 e 6 números.";
            status.style.color = "#dc2626";
        }
        return;
    }
    if (p1 !== p2) {
        if (status) {
            status.textContent = "⚠️ Os PINs introduzidos não são iguais.";
            status.style.color = "#dc2626";
        }
        return;
    }

    const user = auth.currentUser || FABEF.user;
    if (!user && !window.FABEF?.isDemoMode) {
        alert("Sessão não detetada. Inicie sessão novamente.");
        return;
    }

    try {
        const hash = await calcularHashPin(p1);
        if (user?.uid) {
            localStorage.setItem(chavePinLocal(user.uid), hash);
            try {
                await updateDoc(doc(db, "utilizadores", user.uid), { pinHash: hash });
            } catch(e){}
        }

        sessionStorage.setItem("fabef_sessao_desbloqueada", "true");
        if (modal) modal.classList.remove("active");
        esconderEcraPin();
        document.getElementById("app")?.classList.remove("hidden");

        const configPinEstado = document.getElementById("config-pin-estado");
        if (configPinEstado) {
            configPinEstado.textContent = "🟢 PIN ATIVO E PROTEGIDO";
            configPinEstado.style.color = "#16a34a";
        }

        if (user) {
            await iniciarSessaoFABEF(user);
        }

        alert("✅ PIN de segurança definido com sucesso!\nO seu aplicativo agora está 100% protegido. Sempre que for aberto no celular ou minimizado, o PIN será exigido.");
    } catch(err) {
        console.error("Erro ao guardar PIN:", err);
        if (status) {
            status.textContent = "Erro ao guardar PIN: " + err.message;
            status.style.color = "#dc2626";
        }
    }
});

// Bloqueio por PIN ao minimizar a aplicação ou suspender o telemóvel
let appFoiMinimizada = false;
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        if (FABEF.carregado && (FABEF.user || window.FABEF?.isDemoMode)) {
            appFoiMinimizada = true;
            sessionStorage.removeItem("fabef_sessao_desbloqueada");
        }
    } else {
        if (appFoiMinimizada && (FABEF.user || window.FABEF?.isDemoMode)) {
            appFoiMinimizada = false;
            mostrarEcraPin(auth.currentUser || FABEF.user);
            const statusPin = document.getElementById("pin-status");
            if (statusPin) {
                statusPin.textContent = "🔒 Aplicação suspensa. Introduza o PIN para desbloquear.";
                statusPin.style.color = "#2563eb";
            }
        }
    }
});

// Botão de bloqueio instantâneo no topo do sistema
document.getElementById("btn-bloquear-ecra")?.addEventListener("click", () => {
    sessionStorage.removeItem("fabef_sessao_desbloqueada");
    mostrarEcraPin(auth.currentUser || FABEF.user);
});

// Testar bloqueio a partir das configurações
document.getElementById("btn-testar-bloqueio")?.addEventListener("click", () => {
    sessionStorage.removeItem("fabef_sessao_desbloqueada");
    mostrarEcraPin(auth.currentUser || FABEF.user);
});


onAuthStateChanged(auth, async user => {
    if (!user) {
        await limparEstadoFABEF();
        esconderEcraPin();
        if (elAuth("app")) elAuth("app").classList.add("hidden");
        if (elAuth("tela-login")) elAuth("tela-login").style.display = "flex";
        return;
    }

    // Se saiu manualmente através do botão Sair, deve pedir e-mail e senha
    if (sessionStorage.getItem("fabef_saiu_manual") === "true") {
        sessionStorage.removeItem("fabef_saiu_manual");
        await signOut(auth);
        return;
    }

    // Durante o registo, o Auth pode emitir o utilizador antes dos documentos Firestore.
    // Esperamos a conclusão de criarConta() para evitar uma corrida de inicialização.
    if (FABEF_registoEmCurso) return;

    // VERIFICAÇÃO DE SEGURANÇA OBRIGATÓRIA NO TELEMÓVEL:
    // Se a sessão já foi validada nesta aba/sessão (acabou de fazer login com senha ou digitou o PIN), abre
    const sessaoDesbloqueada = sessionStorage.getItem("fabef_sessao_desbloqueada") === "true";
    if (sessaoDesbloqueada) {
        await iniciarSessaoFABEF(user);
        return;
    }

    // Caso contrário (aplicação reaberta no telemóvel, PWA iniciada ou reiniciada):
    // EXIGE O PIN OU CONFIGURAÇÃO IMEDIATA DO PIN
    const hashGuardado = localStorage.getItem(chavePinLocal(user.uid));
    if (hashGuardado) {
        mostrarEcraPin(user);
    } else {
        // Ainda não configurou o PIN: exige configuração para proteger o telemóvel
        mostrarModalConfigurarPin(user, true);
    }
});

async function carregarPerfil(user) {
    if (!user?.uid) throw new Error("Utilizador autenticado inválido.");

    let snap = await getDoc(doc(db, "utilizadores", user.uid));
    let dados;

    // AUTO-RECUPERAÇÃO: Se a conta existe no Auth mas o documento não foi criado, regenera-o automaticamente
    if (!snap.exists()) {
        console.warn("Perfil não encontrado no Firestore. A criar perfil de recuperação automática para:", user.email);
        dados = {
            uid: user.uid,
            email: user.email || "",
            nome: user.displayName || (user.email ? user.email.split("@")[0] : "Gerente"),
            telefone: "",
            empresaId: user.uid,
            perfil: "gerente",
            role: "gerente",
            estado: "ATIVO",
            criadoEm: serverTimestamp()
        };
        await setDoc(doc(db, "utilizadores", user.uid), dados);
    } else {
        dados = snap.data();
    }

    const empresaId = dados.empresaId || user.uid;
    if (!dados.empresaId) {
        dados.empresaId = empresaId;
        try { await updateDoc(doc(db, "utilizadores", user.uid), { empresaId }); } catch(_) {}
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

    let snap = await getDoc(empresaRef());
    let dados;

    // AUTO-RECUPERAÇÃO: Se a empresa não existir, auto-provisiona para não bloquear o acesso
    if (!snap.exists()) {
        console.warn("Empresa não encontrada no Firestore. A provisionar nova empresa para:", FABEF.empresaId);
        dados = {
            id: FABEF.empresaId,
            nome: "Minha Empresa (" + (FABEF.userData?.nome || "Comercial") + ")",
            telefone: FABEF.userData?.telefone || "",
            endereco: "",
            gerenteId: FABEF.user.uid,
            ramo_ativo: "Mercearia / Minimercado",
            ramos_atividade: ["Mercearia / Minimercado"],
            estado_licenca: "TESTE",
            subscricao_paga: false,
            data_registo: new Date().toISOString(),
            validade_subscricao: null,
            valor_mensalidade_atual: 250,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp()
        };
        await setDoc(empresaRef(), dados);
    } else {
        dados = snap.data();
    }

    FABEF.empresa = { id: FABEF.empresaId, ...dados };
    // Se o utilizador for funcionário e tiver um ramo atribuído, o seu ramo ativo é estritamente o atribuído pelo gerente
    if (FABEF.userData?.perfil === "funcionario" && FABEF.userData?.ramo) {
        FABEF.ramo = FABEF.userData.ramo;
    } else {
        FABEF.ramo = FABEF.empresa.ramo_ativo || FABEF.empresa.ramoAtivo || "Mercearia / Minimercado";
    }
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
        escutarColecao("gastos_funcionarios", "gastosFuncionarios"),
        escutarColecao("dispensas", "dispensas"),
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
const COLECOES_POR_RAMO = new Set(["produtos","compras","vendas","despesas","encomendas","funcionarios","gastos_funcionarios","auditoria_logs","sugestoes","caixas_turnos","ajustes_stock"]);
const COLECOES_POR_DIA = new Set(["despesas","compras","encomendas","auditoria_logs","sugestoes"]);
function referenciaColecaoFiltrada(nome) {
    const ref = subRef(nome);
    return COLECOES_POR_RAMO.has(nome) && FABEF.ramo ? query(ref, where("ramo", "==", FABEF.ramo)) : ref;
}
function dataDoRegisto(item) {
    const v=item?.data||item?.dataVenda||item?.dataCriacao||item?.criadoEm;
    if(!v) return "";
    if(typeof v === "object" && typeof v.toDate === "function") return v.toDate().toISOString().slice(0,10);
    const d=new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0,10);
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
}
function aplicarFiltroDia(){
    for(const nome of COLECOES_POR_DIA){
        const estado=nome==="auditoria_logs"?"auditoria":nome;
        const raw=FABEF._raw?.[nome]||[];
        if (FABEF.turnoId && ["despesas","encomendas"].includes(nome)) {
            FABEF[estado]=raw.filter(x => x.turnoId === FABEF.turnoId && dataDoRegisto(x)===FABEF.dataAtiva);
        } else {
            FABEF[estado]=raw.filter(x=>dataDoRegisto(x)===FABEF.dataAtiva);
        }
    }
    // As vendas ficam SEMPRE completas em FABEF.vendas para permitir ao gerente consultar
    // relatórios hoje, semanais, mensais, anuais ou por turno sem perder vendas anteriores!
    FABEF.vendas = FABEF._raw?.vendas || FABEF.vendas || [];
    if (FABEF.turnoId) {
        FABEF.vendasTurno = FABEF.vendas.filter(x => x.turnoId === FABEF.turnoId);
    } else {
        FABEF.vendasTurno = FABEF.vendas.filter(x => dataDoRegisto(x) === FABEF.dataAtiva);
    }
}
function definirDiaAtivo(data){ if(!/^\d{4}-\d{2}-\d{2}$/.test(data||"")) return; FABEF.dataAtiva=data; aplicarFiltroDia(); renderTudo(); }
window.definirDiaAtivo=definirDiaAtivo;

function escutarColecao(nome, estado) {
    return new Promise((resolve) => {
        let primeiraVez = true;
        const unsub = onSnapshot(referenciaColecaoFiltrada(nome), (snap) => {
            const dados=snap.docs.map(d=>({id:d.id,...d.data()}));
            if (estado === "clientes") {
                try {
                    const localRaw = localStorage.getItem("fabef_local_clientes_" + FABEF.empresaId);
                    if (localRaw) {
                        const localCli = JSON.parse(localRaw);
                        localCli.forEach(c => {
                            if (!dados.some(d => d.id === c.id || (d.nome && d.nome.toLowerCase() === (c.nome || "").toLowerCase()))) {
                                dados.push(c);
                            }
                        });
                    }
                } catch(e){}
            }
            if (estado === "dividas") {
                try {
                    const localRaw = localStorage.getItem("fabef_local_dividas_" + FABEF.empresaId);
                    if (localRaw) {
                        const localDiv = JSON.parse(localRaw);
                        localDiv.forEach(d => {
                            if (!dados.some(x => x.id === d.id || (x.cliente && x.cliente.toLowerCase() === (d.cliente || "").toLowerCase()))) {
                                dados.push(d);
                            }
                        });
                    }
                } catch(e){}
            }
            if (estado === "gastosFuncionarios") {
                try {
                    const localRaw = localStorage.getItem("fabef_local_gastos_" + FABEF.empresaId);
                    if (localRaw) {
                        const localG = JSON.parse(localRaw);
                        localG.forEach(g => {
                            if (!dados.some(d => d.id === g.id)) {
                                dados.push(g);
                            }
                        });
                    }
                } catch(e){}
            }
            if(COLECOES_POR_DIA.has(nome)){ FABEF._raw=FABEF._raw||{}; FABEF._raw[nome]=dados; } else FABEF[estado]=dados;
            aplicarFiltroDia();
            if(estado==="produtos") verificarReconciliacaoStock();
            if(primeiraVez){primeiraVez=false;resolve();} else pedirRenderTudo();
        }, (erro)=>{ console.error(`Erro ao escutar a colecção "${nome}":`,erro); if(primeiraVez){primeiraVez=false;resolve();} });
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
        indicador.innerHTML = '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;margin-right:5px;vertical-align:middle;"></span><span style="color:#10b981;font-weight:700;vertical-align:middle;">Online</span>';
        indicador.title = "Ligado à internet — os dados sincronizam em tempo real.";
    } else {
        indicador.innerHTML = '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;margin-right:5px;vertical-align:middle;"></span><span style="color:#ef4444;font-weight:700;vertical-align:middle;">Offline</span>';
        indicador.title = "Sem internet. Pode continuar a vender e a trabalhar — tudo será sincronizado assim que a ligação voltar.";
    }
}
window.addEventListener("online", () => { atualizarIndicadorLigacao(); if (typeof renderPOS === "function" && FABEF.carregado) renderPOS(); });
window.addEventListener("offline", () => { atualizarIndicadorLigacao(); if (typeof renderPOS === "function" && FABEF.carregado) renderPOS(); });


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
    // Garante que SEMPRE começa no menu inicial (painel de controlo limpo)
    setTimeout(() => {
        if (typeof mostrarSecao === "function") {
            mostrarSecao("inicio");
        }
    }, 100);

    // Se ainda não configurou PIN neste telemóvel/dispositivo, abre o modal de configuração
    if (FABEF.user?.uid && !localStorage.getItem(chavePinLocal(FABEF.user.uid))) {
        setTimeout(() => mostrarModalConfigurarPin(FABEF.user, false), 800);
    }
}


/* =====================================================
   MÓDULO LÓGICO: CONTROLO DE ACESSO POR PAPEL
   O gerente é a conta de controlo do negócio: define preços,
   stock, funcionários e vê relatórios — mas Não regista vendas.
   Só as contas de funcionário têm acesso à página "Vender".
===================================================== */
function aplicarRestricoesDeAcessoPorPapel() {
    let perfil = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfil = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfil = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }
    const ehGerenteLogado = perfil === "gerente";

    // Botão de Vender (POS) no menu lateral
    const botaoVender = document.querySelector('.sidebar button[data-sec="pos"]');
    if (botaoVender) {
        botaoVender.style.display = "";
        botaoVender.title = ehGerenteLogado ? "Supervisão do POS (O Gerente não vende)" : "Efetuar Vendas de Balcão";
    }

    // Secções estritamente reservadas ao Gerente:
    // O funcionário Não PODE ver nem alterar os ramos que o gerente está a gerir,
    // nem compras, relatórios, metas, funcionários, subscrição, etc.
    const secoesReservadasAoGerente = ["ramos", "compras", "relatorios", "metas", "desempenho", "funcionarios", "auditoria", "subscricao", "config"];
    secoesReservadasAoGerente.forEach(sec => {
        const botao = document.querySelector(`.sidebar button[data-sec="${sec}"]`);
        if (botao) botao.style.display = ehGerenteLogado ? "" : "none";
    });

    // Configuração só existe dentro do menu dos 3 pontos e só para o Gerente.
    document.querySelectorAll('[data-sec="config"]').forEach(el => {
        el.style.display = ehGerenteLogado ? "" : "none";
    });
    const secConfig = document.getElementById("sec-config");
    if (secConfig && !ehGerenteLogado) secConfig.classList.remove("active");

    // Oculta grupos inteiros da sidebar (details) para o funcionário
    document.querySelectorAll(".sidebar details").forEach(det => {
        const summaryText = det.querySelector("summary")?.textContent || "";
        if (summaryText.includes("Administração") || summaryText.includes("Gestão")) {
            det.style.display = ehGerenteLogado ? "" : "none";
        }
    });

    // Seletor de Ramos de atividade: funcionário não pode ver nem alternar ramos
    const seletorRamoProdutos = document.getElementById("select-ramo");
    if (seletorRamoProdutos) seletorRamoProdutos.style.display = ehGerenteLogado ? "" : "none";

    const bannerRamoInicio = document.getElementById("inicio-ramo");
    if (bannerRamoInicio) bannerRamoInicio.style.display = ehGerenteLogado ? "" : "none";

    // Fornecedores: apenas o gerente pode registar fornecedores
    const cardAdicionarForn = document.getElementById("card-adicionar-fornecedor");
    if (cardAdicionarForn) cardAdicionarForn.style.display = ehGerenteLogado ? "block" : "none";

    // Produtos: funcionário não pode adicionar produtos, só o gerente!
    const btnNovoProd = document.getElementById("btn-novo-produto");
    if (btnNovoProd) btnNovoProd.style.display = ehGerenteLogado ? "" : "none";

    // Regra Operacional: Gerente NÃO pode registar clientes nem registar dívidas (fiado). Essa missão é exclusiva de funcionário!
    const avisoCli = document.getElementById("aviso-gerente-bloqueado-cliente");
    const avisoDiv = document.getElementById("aviso-gerente-bloqueado-divida");
    const btnAddCli = document.getElementById("btn-adicionar-cliente");
    const btnRegDiv = document.getElementById("btn-registar-divida");

    if (ehGerenteLogado) {
        if (avisoCli) avisoCli.style.display = "block";
        if (avisoDiv) avisoDiv.style.display = "block";
        if (btnAddCli) {
            btnAddCli.disabled = true;
            btnAddCli.style.display = "";
            btnAddCli.style.opacity = "0.5";
            btnAddCli.style.cursor = "not-allowed";
            btnAddCli.title = "O Gerente não pode registar clientes. Missão exclusiva do Funcionário.";
        }
        if (btnRegDiv) {
            btnRegDiv.disabled = true;
            btnRegDiv.style.display = "";
            btnRegDiv.style.opacity = "0.5";
            btnRegDiv.style.cursor = "not-allowed";
            btnRegDiv.title = "O Gerente não pode registar dívidas. Missão exclusiva do Funcionário.";
        }
    } else {
        if (avisoCli) avisoCli.style.display = "none";
        if (avisoDiv) avisoDiv.style.display = "none";
        if (btnAddCli) {
            btnAddCli.disabled = false;
            btnAddCli.style.display = "";
            btnAddCli.style.pointerEvents = "auto";
            btnAddCli.style.opacity = "1";
            btnAddCli.style.cursor = "pointer";
            btnAddCli.title = "Adicionar novo cliente";
        }
        if (btnRegDiv) {
            btnRegDiv.disabled = false;
            btnRegDiv.style.display = "";
            btnRegDiv.style.pointerEvents = "auto";
            btnRegDiv.style.opacity = "1";
            btnRegDiv.style.cursor = "pointer";
            btnRegDiv.title = "Registar nova dívida";
        }
    }

    // Garante que o menu lateral para Clientes e Fiado/Dívidas permanece acessível
    const btnMenuClientes = document.querySelector('.sidebar button[data-sec="clientes"]');
    if (btnMenuClientes) btnMenuClientes.style.display = "";
    const btnMenuDividas = document.querySelector('.sidebar button[data-sec="dividas"]');
    if (btnMenuDividas) btnMenuDividas.style.display = "";

    // Atualiza os controles do POS de acordo com o perfil
    verificarAcessoPosGerente();

    // Sempre que entrar, abre na secção de início
    mostrarSecao("inicio");
}

function verificarAcessoPosGerente() {
    let perfilAtual = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfilAtual = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfilAtual = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }

    const ehGerente = perfilAtual === "gerente";
    const avisoPos = document.getElementById("aviso-pos-gerente-bloqueado");
    const btnFinalizar = document.getElementById("btn-finalizar-venda");

    if (avisoPos) {
        avisoPos.style.display = ehGerente ? "block" : "none";
        avisoPos.className = "alert alert-info";
        avisoPos.innerHTML = `🛡️ <strong>Modo Caixa / Operação Ativa:</strong> A sessão atual está autenticada como <strong>${ehGerente ? 'Gerente / Supervisor' : 'Funcionário Operacional'}</strong>. O funcionário pode registar vendas, calcular por kg ou preço manual, adicionar clientes e fiado.`;
    }
    if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.title = "Finalizar venda";
        btnFinalizar.style.opacity = "1";
        btnFinalizar.style.cursor = "pointer";
    }

    const btnPosNovoCliente = document.getElementById("btn-pos-novo-cliente");
    if (btnPosNovoCliente) {
        btnPosNovoCliente.style.display = ehGerente ? "none" : "";
    }
}
window.verificarAcessoPosGerente = verificarAcessoPosGerente;


/* =====================================================
   MÓDULO LÓGICO: COMPORTAMENTO DO MENU (SIDEBAR)
===================================================== */

function fecharMenuLateral() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.remove("open");
        sidebar.classList.add("closed");
    }
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.classList.add("hidden");
    document.body.classList.remove("menu-aberto");
}

function abrirMenuLateral() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.remove("closed");
        sidebar.classList.add("open");
    }
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.classList.remove("hidden");
    document.body.classList.add("menu-aberto");
}

function alternarMenuLateral() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (sidebar.classList.contains("open")) {
        fecharMenuLateral();
    } else {
        abrirMenuLateral();
    }
}

document.getElementById("btn-menu")?.addEventListener("click", alternarMenuLateral);
document.getElementById("sidebar-overlay")?.addEventListener("click", fecharMenuLateral);

// Ouvinte global para qualquer botão com data-sec na aplicação inteira
document.addEventListener("click", (e) => {
    const btnSec = e.target.closest("[data-sec]");
    if (btnSec) {
        const secNome = btnSec.dataset.sec;
        const appEl = document.getElementById("app");
        if (appEl && appEl.classList.contains("hidden")) {
            // Se a aplicação principal ainda estiver oculta no login, entra em modo demo automaticamente
            entrarModoDemo();
        }
        mostrarSecao(secNome);
    }
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

    // Garante que o grupo (categoria) do botão ativo fica aberto/visível
    const botaoAtivo = document.querySelector(`.sidebar button[data-sec="${nome}"]`);
    const grupo = botaoAtivo?.closest("details");
    if (grupo) grupo.open = true;

    // AO CLICAR NA OPÇão, OS DIZERES DOS 3 PONTOS (SIDEBAR) DESAPARECEM IMEDIATAMENTE
    // E A TELA PRINCIPAL EXIBE LIMPA A OPÇão SELECIONADA
    fecharMenuLateral();

    // Disparadores contextuais de atualização de tela
    if (nome === "inicio") {
        renderGraficoVendas(window.FABEF_GRAFICO_DIAS || 7);
    } else if (nome === "ramos") {
        renderPastaRamos();
    } else if (nome === "subscricao") {
        atualizarCalculadoraSubscricao();
    } else if (nome === "pos") {
        verificarAcessoPosGerente();
    } else if (nome === "dispensas") {
        if (typeof renderDispensas === "function") renderDispensas();
    } else if (nome === "config") {
        if (typeof renderConfiguracoes === "function") renderConfiguracoes();
    }
}
window.mostrarSecao = mostrarSecao;


/* =====================================================
   MÓDULO LÓGICO: ENCERRAR SESSão (LOGOUT)
===================================================== */

/* =====================================================
   MÓDULO LÓGICO: ALTERAR SENHA (QUALQUER UTILIZADOR)
   Acessível pelo nome no cabeçalho — qualquer funcionário ou
   gerente pode reforçar a segurança da própria conta.
===================================================== */
document.getElementById("header-user")?.addEventListener("click", () => {
    document.getElementById("senha-status").textContent = "";
    document.getElementById("senha-atual").value = "";
    document.getElementById("senha-nova").value = "";
    document.getElementById("senha-nova-confirmar").value = "";
    document.getElementById("modal-alterar-senha")?.classList.add("show");
});

document.getElementById("btn-guardar-nova-senha")?.addEventListener("click", async () => {
    const atual = document.getElementById("senha-atual").value;
    const nova = document.getElementById("senha-nova").value;
    const confirmar = document.getElementById("senha-nova-confirmar").value;
    const status = document.getElementById("senha-status");

    if (!atual || !nova || !confirmar) { status.textContent = "🔴 Preencha todos os campos."; return; }
    if (nova.length < 6) { status.textContent = "🔴 A nova senha deve ter pelo menos 6 caracteres."; return; }
    if (nova !== confirmar) { status.textContent = "🔴 A confirmação não coincide com a nova senha."; return; }

    try {
        status.textContent = "â³ A validar...";
        const credencial = EmailAuthProvider.credential(auth.currentUser.email, atual);
        await reauthenticateWithCredential(auth.currentUser, credencial);
        await updatePassword(auth.currentUser, nova);
        status.textContent = "🟢 Senha alterada com sucesso!";
        await gravarAuditoria("Alterou a própria senha de acesso.", "INFO");
        setTimeout(() => fecharModal("modal-alterar-senha"), 1500);
    } catch (error) {
        console.error(error);
        status.textContent = "🔴 " + mensagemFirebase(error);
    }
});


document.getElementById("btn-logout").addEventListener("click", async () => {
    if (window.FABEF?.isDemoMode) {
        window.FABEF.isDemoMode = false;
        await limparEstadoFABEF();
        document.getElementById("app")?.classList.add("hidden");
        const telaLogin = document.getElementById("tela-login");
        if (telaLogin) telaLogin.style.display = "flex";
        toast("Sessão terminada.");
        return;
    }
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao efetuar logout seguro:", error);
    }
});


/* =====================================================
   MÓDULO LÓGICO: DICIONÁRIO E SELEÇão DE IDIOMA
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
   MÓDULO LÓGICO: GESTão MULTIEMPRESA DE RAMOS
===================================================== */

/* =====================================================
   MÓDULO LÓGICO: VISão GERAL DE VENDAS POR RAMO
   Mostra um cartão por cada ramo que a empresa já usa (tem
   produtos ou vendas registadas), com as vendas de hoje e do
   mês, e um botão para trocar diretamente para esse ramo.
===================================================== */
function renderVisaoGeralRamos() {
    const container = document.getElementById("visao-geral-ramos");
    if (!container) return;

    const ramosEmUso = Array.from(new Set([
        ...FABEF.produtos.map(p => p.ramo),
        ...FABEF.vendas.map(v => v.ramo)
    ].filter(Boolean)));

    if (ramosEmUso.length <= 1) {
        container.innerHTML = "";
        return;
    }

    const hoje = dataHoje();
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

    container.innerHTML = `
        <div class="card">
            <h3 style="margin-bottom:10px;">Visão geral — todos os ramos em uso</h3>
            <div class="grid">
                ${ramosEmUso.map(ramo => {
                    const vendasRamo = FABEF.vendas.filter(v => v.ramo === ramo);
                    const vendasHojeRamo = vendasRamo.filter(v => new Date(v.data || 0) >= hoje).reduce((s, v) => s + numero(v.total), 0);
                    const vendasMesRamo = vendasRamo.filter(v => new Date(v.data || 0) >= inicioMes).reduce((s, v) => s + numero(v.total), 0);
                    const ativo = ramo === FABEF.ramo;
                    return `
                    <div class="kpi" style="${ativo ? 'border:2px solid #10b981;' : ''}">
                        <div class="rotulo">${escapeHTML(ramo)}${ativo ? ' (ativo)' : ''}</div>
                        <p style="font-size:13px;margin:6px 0;">Hoje: <strong>${dinheiro(vendasHojeRamo)}</strong></p>
                        <p style="font-size:13px;margin:6px 0;">Este mês: <strong>${dinheiro(vendasMesRamo)}</strong></p>
                        ${!ativo ? `<button class="btn btn-light btn-small" type="button" onclick="mudarRamo('${escapeHTML(ramo)}')">Ver este ramo</button>` : ""}
                    </div>`;
                }).join("")}
            </div>
        </div>
    `;
}


function renderRamos() {
    // Junta os ramos padrão com os ramos personalizados que esta empresa
    // já tenha adicionado (empresa.ramos_atividade), sem duplicados.
    const personalizados = FABEF.empresa?.ramos_atividade || [];
    RAMOS = Array.from(new Set([...RAMOS_PADRAO, ...personalizados]));

    renderVisaoGeralRamos();
    renderPastaRamos();

    const selects = [
        document.getElementById("select-ramo"),
        document.getElementById("ramo-pagina"),
        document.getElementById("func-ramo"),
        document.getElementById("edit-func-ramo")
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
            ? `<p style="color:#10b981;font-size:13px;">✔️ Já adicionou todas as sugestões prontas para este ramo.</p>`
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
    if (perfilFABEF() !== "gerente") {
        alert("Apenas o gerente pode adicionar novos ramos de atividade.");
        return;
    }

    const input = document.getElementById("novo-ramo-nome");
    const nome = input?.value.trim();
    const pin = document.getElementById("novo-ramo-senha-inline")?.value.trim() || "";
    if (!nome) { alert("Introduza o nome do novo ramo."); return; }

    try {
        const configRamos = obterConfigRamos();
        if (!configRamos.some(r => r.nome.toLowerCase() === nome.toLowerCase())) {
            configRamos.push({ nome: nome, tipo: nome, senha: pin });
        }
        if (!FABEF.empresa) FABEF.empresa = {};
        FABEF.empresa.ramos_config = configRamos;
        FABEF.empresa.ramos_atividade = Array.from(new Set([...(FABEF.empresa.ramos_atividade || []), nome]));
        FABEF.ramo = nome;

        if (!window.FABEF?.isDemoMode) {
            await updateDoc(empresaRef(), {
                ramos_config: configRamos,
                ramos_atividade: arrayUnion(nome),
                ramo_ativo: nome,
                atualizadoEm: serverTimestamp()
            });
        }

        if (input) input.value = "";
        const pinInput = document.getElementById("novo-ramo-senha-inline");
        if (pinInput) pinInput.value = "";

        renderTudo();
        await gravarAuditoria("Adicionou o ramo / filial: " + nome + (pin ? " (com PIN)" : ""), "INFO");
        alert(`Ramo / filial "${nome}" adicionado e ativado com sucesso!`);
    } catch (error) {
        console.error(error);
        alert("Não foi possível adicionar o ramo.\n" + mensagemFirebase(error));
    }
}


function perfilFABEF() {
    return String(FABEF.userData?.perfil || FABEF.userData?.role || "").trim().toLowerCase();
}

async function recarregarDadosDoRamoAtual() {
    // Encerra TODOS os listeners das coleções do ramo anterior antes de criar os novos.
    if (FABEF.listeners && FABEF.listeners.length) {
        FABEF.listeners.forEach(unsub => { try { if (typeof unsub === "function") unsub(); } catch (_) {} });
    }
    FABEF.listeners = [];
    FABEF._raw = {};
    FABEF.produtos = [];
    FABEF.clientes = [];
    FABEF.fornecedores = [];
    FABEF.compras = [];
    FABEF.vendas = [];
    FABEF.despesas = [];
    FABEF.dividas = [];
    FABEF.encomendas = [];
    FABEF.funcionarios = [];
    FABEF.auditoria = [];
    FABEF.sugestoes = [];
    FABEF.carrinho = [];
    FABEF.turnoId = null;
    FABEF.turno = null;
    await carregarDados();
}

async function mudarRamo(ramo) {
    if (!RAMOS.includes(ramo)) {
        const personalizados = FABEF.empresa?.ramos_atividade || [];
        RAMOS = Array.from(new Set([...RAMOS_PADRAO, ...personalizados, ramo]));
    }

    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Só o gerente pode mudar o ramo de atividade.");
        // Repõe o valor visual dos selects para o ramo atual (evita ficar "preso" na opção errada)
        renderRamos();
        return;
    }

    if (ramo === FABEF.ramo) return;

    // Verificar se o ramo alvo está protegido por PIN / Senha
    const configRamos = obterConfigRamos();
    const ramoAlvo = configRamos.find(r => r.nome === ramo);
    if (ramoAlvo && ramoAlvo.senha && ramoAlvo.senha.trim()) {
        const pinDigitado = prompt(`🔒 Segurança de Ramo / Filial:\n\nO ramo "${ramo}" está protegido por PIN.\nPor favor, introduza o PIN ou Senha de acesso configurada pelo Gerente:`);
        if (pinDigitado === null) {
            renderRamos();
            return;
        }
        if (pinDigitado.trim() !== ramoAlvo.senha.trim()) {
            alert("❌ Senha / PIN incorreto! Acesso não autorizado ao ramo " + ramo);
            renderRamos();
            return;
        }
    }

    const confirmar = confirm(
        `Vai mudar do ramo "${FABEF.ramo}" para "${ramo}".\n\n` +
        `Produtos, vendas, caixa e relatórios vão passar a mostrar apenas os dados deste novo ramo — nada é apagado, o ramo anterior continua guardado e pode voltar a ele quando quiser.\n\n` +
        `Deseja continuar?`
    );
    if (!confirmar) {
        renderRamos();
        return;
    }

    try {
        if (!window.FABEF?.isDemoMode) {
            await updateDoc(empresaRef(), {
                ramo_ativo: ramo,
                atualizadoEm: serverTimestamp()
            });
        }

        FABEF.ramo = ramo;
        ramoSendoConfigurado = ramo;
        const configRamo = typeof obterConfiguracaoRamo === "function" ? obterConfiguracaoRamo(ramo) : null;
        if (configRamo && FABEF.empresa) {
            FABEF.empresa.nome = configRamo.nome;
            FABEF.empresa.telefone = configRamo.telefone;
            FABEF.empresa.endereco = configRamo.endereco;
            FABEF.empresa.cidade = configRamo.cidade;
            FABEF.empresa.nuit = configRamo.nuit;
            FABEF.empresa.ivaRegime = configRamo.ivaRegime;
            FABEF.empresa.ivaTaxa = configRamo.ivaTaxa;
            FABEF.empresa.rodapeRecibo = configRamo.rodapeRecibo;
            FABEF.empresa.idPersonalizado = configRamo.idPersonalizado;
        }

        await recarregarDadosDoRamoAtual(); // Fecha listeners do ramo anterior e subscreve todos os dados do novo ramo
        renderTudo();
        renderPastaRamos();
        renderConfiguracoes();

        // Escreve de forma persistente a alteração nos registos de auditoria
        await gravarAuditoria("Alterou o ramo activo para " + ramo, "INFO");
    } catch (error) {
        console.error(error);
        alert("Não foi possível alterar o ramo.\n" + mensagemFirebase(error));
    }
}
window.mudarRamo = mudarRamo;


/* =====================================================
   MÓDULO LÓGICO: CRIAR PRODUTO VIA SUGESTão RÁPIDA
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
   MÓDULO LÓGICO: INTERAÇão DA JANELA MODAL DE PRODUTOS
===================================================== */

document.getElementById("btn-novo-produto").addEventListener("click", () => {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("🔒 Acesso Reservado:\n\nFuncionários não podem adicionar produtos ao catálogo. Apenas o Gerente pode cadastrar novos produtos.");
        return;
    }
    limparProdutoForm();
    document.getElementById("modal-produto").classList.add("show");
});


document.getElementById("btn-salvar-produto").addEventListener("click", salvarProduto);


/* =====================================================
   MÓDULO LÓGICO: GRAVAÇão E VALIDAÇão DE PRODUTO
===================================================== */

async function salvarProduto() {
    // 1. Apenas o Gerente pode cadastrar produtos
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("🔒 Acesso Reservado:\n\nFuncionários não podem adicionar produtos ao catálogo. Apenas o Gerente tem autorização para cadastrar novos produtos.");
        return;
    }

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
    const idCustom = document.getElementById("novo-produto-id-custom")?.value.trim() || "";

    // Validação de segurança básica para integridade de dados
    if (!nome) {
        alert("Introduza o nome do produto.");
        return;
    }

    // 2. Não permitir produtos repetidos no mesmo ramo (por nome, código de barras ou ID)
    const nomeNorm = nome.toLowerCase();
    const jaExiste = FABEF.produtos.some(p => {
        if (p.ramo !== FABEF.ramo) return false;
        const mesmoNome = (p.nome || "").trim().toLowerCase() === nomeNorm;
        const mesmoCodigo = codigo && p.codigo && p.codigo.trim() === codigo;
        const mesmoId = idCustom && p.idPersonalizado && p.idPersonalizado.trim() === idCustom;
        return mesmoNome || mesmoCodigo || mesmoId;
    });

    if (jaExiste) {
        alert(`❌ Não é permitido registar produtos repetidos!\n\nJá existe um produto com este nome ("${nome}") ou código no ramo "${FABEF.ramo}".\nSe pretender adicionar mais unidades, utilize "Ajustar Stock" ou lance uma nova Compra.`);
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
            criadoPor: FABEF.user?.uid || FABEF.userData?.uid || "admin",
            dataCriacao: serverTimestamp()
        };
        if (idCustom) payload.idPersonalizado = idCustom;

        const ref = await addDoc(subRef("produtos"), payload);

        // Atualização síncrona da memória em cache do navegador
        FABEF.produtos.push({
            id: ref.id,
            idPersonalizado: payload.idPersonalizado || ref.id,
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

        limparProdutoForm();
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
        "novo-produto-id-custom",
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

    const selUnidade = document.getElementById("novo-produto-unidade");
    if (selUnidade) {
        const ramoLower = String(FABEF.ramo || "").toLowerCase();
        if (ramoLower.includes("talho") || ramoLower.includes("açougue") || ramoLower.includes("acougue") || ramoLower.includes("peixaria")) {
            selUnidade.value = "kg";
        } else {
            selUnidade.value = "unidade";
        }
    }
}


/* =====================================================
   MÓDULO LÓGICO: FILTRAGEM E RENDER DO CATÁLOGO
===================================================== */

document.getElementById("produto-pesquisa").addEventListener("input", renderProdutos);


window.abrirModalEditarProduto = function(id) {
    const gerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    if (!gerente && !window.FABEF?.isDemoMode) {
        alert("Operação negada: Apenas o Gerente tem autorização para editar produtos.");
        return;
    }

    const p = FABEF.produtos.find(x => x.id === id); 
    if (!p) return;

    document.getElementById("edit-produto-id").value = p.id;
    if (document.getElementById("edit-produto-id-custom")) {
        document.getElementById("edit-produto-id-custom").value = p.idPersonalizado || p.codigo || p.id;
    }
    document.getElementById("edit-produto-nome").value = p.nome || "";
    document.getElementById("edit-produto-categoria").value = p.categoria || "";
    document.getElementById("edit-produto-codigo").value = p.codigo || "";
    document.getElementById("edit-produto-custo").value = numero(p.custo);
    document.getElementById("edit-produto-preco").value = numero(p.preco);
    document.getElementById("edit-produto-stock").value = numero(p.stock);
    document.getElementById("edit-produto-minimo").value = numero(p.stockMinimo || p.minimo || 5);
    if (document.getElementById("edit-produto-unidade")) document.getElementById("edit-produto-unidade").value = p.unidade || "unidade";
    if (document.getElementById("edit-produto-foto")) document.getElementById("edit-produto-foto").value = p.foto || "";
    if (document.getElementById("edit-produto-tamanho")) document.getElementById("edit-produto-tamanho").value = p.tamanho || "";
    if (document.getElementById("edit-produto-cor")) document.getElementById("edit-produto-cor").value = p.cor || "";
    if (document.getElementById("edit-produto-destaque")) document.getElementById("edit-produto-destaque").checked = !!p.destaque;
    
    const eliminar = document.getElementById("btn-eliminar-produto");
    if (eliminar) { eliminar.style.display = gerente ? "block" : "none"; eliminar.disabled = !gerente; }
    ["edit-produto-custo", "edit-produto-stock"].forEach(i => { const el = document.getElementById(i); if (el) el.disabled = !gerente; });
    document.getElementById("modal-editar-produto")?.classList.add("show");
};

async function salvarEdicaoProduto() {
    const gerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    if (!gerente && !window.FABEF?.isDemoMode) {
        alert("Operação negada: Funcionário não tem permissão para editar produtos. Esta função é exclusiva do Gerente.");
        return;
    }

    const id = document.getElementById("edit-produto-id").value; 
    const p = FABEF.produtos.find(x => x.id === id); 
    if (!p) return;

    const idCustom = document.getElementById("edit-produto-id-custom")?.value.trim() || "";
    const payload = {
        idPersonalizado: idCustom,
        nome: document.getElementById("edit-produto-nome").value.trim(),
        categoria: document.getElementById("edit-produto-categoria").value.trim(),
        codigo: document.getElementById("edit-produto-codigo").value.trim(),
        preco: numero(document.getElementById("edit-produto-preco").value),
        stockMinimo: numero(document.getElementById("edit-produto-minimo").value),
        unidade: document.getElementById("edit-produto-unidade")?.value || "unidade",
        foto: document.getElementById("edit-produto-foto")?.value.trim() || "",
        tamanho: document.getElementById("edit-produto-tamanho")?.value.trim() || "",
        cor: document.getElementById("edit-produto-cor")?.value.trim() || "",
        destaque: document.getElementById("edit-produto-destaque")?.checked || false,
        atualizadoEm: serverTimestamp()
    };
    if (!payload.nome) { alert("Introduza o nome do produto."); return; }
    payload.custo = numero(document.getElementById("edit-produto-custo").value);
    payload.stock = numero(document.getElementById("edit-produto-stock").value);

    try {
        await updateDoc(produtoRef(id), payload);
        Object.assign(p, payload);
        delete p.atualizadoEm;
        renderTudo();
        fecharModal("modal-editar-produto");
        await gravarAuditoria("Editou o produto (ID: " + (idCustom || id) + "): " + payload.nome, "INFO");
        alert("Produto atualizado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao editar o produto:\n" + mensagemFirebase(error));
    }
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
            String(p.idPersonalizado || "").toLowerCase().includes(pesquisa) ||
            String(p.codigo || "").toLowerCase().includes(pesquisa));
    });

    const tabelaCorpo = document.getElementById("tabela-produtos");
    if (!tabelaCorpo) return;

    const ehGerente = ehUsuarioGerente();

    tabelaCorpo.innerHTML = produtosFiltrados.map(p => {
        const stock = numero(p.stock);
        const minimo = numero(p.stockMinimo);
        const baixo = stock <= minimo;
        const corStock = baixo ? "#ef4444" : "#10b981";
        const custoUnit = numero(p.custo ?? p.precoCusto ?? p.preco_custo ?? 0);
        const precoUnit = numero(p.preco ?? p.precoVenda ?? 0);
        const margem = precoUnit - custoUnit;

        return `
        <tr>
            <td>
                <strong>${escapeHTML(p.nome)}</strong>
                ${(p.tamanho || p.cor) ? `<br><small style="color:#0284c7;font-weight:600;">${[p.tamanho ? 'Tam: ' + escapeHTML(p.tamanho) : '', p.cor ? 'Cor: ' + escapeHTML(p.cor) : ''].filter(Boolean).join(' | ')}</small>` : ''}
                ${p.idPersonalizado ? `<br><small style="color:#64748b;font-size:11px;">ID: ${escapeHTML(p.idPersonalizado)}</small>` : ""}
            </td>
            <td>${escapeHTML(p.codigo || "—")}</td>
            <td>
                ${ehGerente ? `
                    <div style="font-weight:700;color:#0f172a;">${custoUnit > 0 ? dinheiro(custoUnit) : '<span style="color:#94a3b8;font-size:12px;">MT 0,00</span>'}</div>
                    ${custoUnit > 0 ? `<small style="color:${margem >= 0 ? '#16a34a' : '#dc2626'};font-size:11px;font-weight:600;">Lucro: ${dinheiro(margem)}</small>` : ''}
                ` : `<span style="color:#94a3b8;font-size:12px;">🔒 Só Gerente</span>`}
            </td>
            <td><strong>${dinheiro(precoUnit)}</strong></td>
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
                ${ehGerente ? `
                    <button class="btn btn-light btn-small" type="button" onclick="abrirModalEditarProduto('${escapeHTML(p.id)}')">✏️ Editar</button>
                ` : `
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;">🔒 Só Gerente</span>
                `}
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
   MÓDULO LÓGICO: CÁLCULOS E RENDERIZAÇão DE INVENTÁRIO
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
    const custo = produtos.reduce((s, p) => s + (numero(p.stock) * numero(p.custo ?? p.precoCusto ?? p.preco_custo ?? 0)), 0);

    const ehGerenteInv = ehUsuarioGerente();

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
        const custoUnit = numero(p.custo ?? p.precoCusto ?? p.preco_custo ?? 0);

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
            <td>${ehGerenteInv ? (custoUnit > 0 ? dinheiro(custoUnit) : '<span style="color:#94a3b8;">MT 0,00</span>') : "—"}</td>
            <td>${ehGerenteInv ? (custoUnit > 0 ? dinheiro(stock * custoUnit) : '<span style="color:#94a3b8;">MT 0,00</span>') : "—"}</td>
            <td>
                ${esgotado ?
                    '<span class="badge badge-red">ESGOTADO</span>' :
                    (baixo ?
                        '<span class="badge badge-yellow">STOCK BAIXO</span>' :
                        '<span class="badge badge-green">NORMAL</span>')
                }
            </td>
            <td><button class="btn btn-light btn-small" type="button" onclick="abrirModalAjusteStock('${escapeHTML(p.id)}')">⚙️  Ajustar</button></td>
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
   MÓDULO LÓGICO: GESTão E FILTRAGEM DE COMPRAS / ENTRADAS
===================================================== */

function preencherProdutosCompra() {
    const select = document.getElementById("compra-produto");
    if (!select) return;

    // Filtra estritamente os produtos pertencentes ao ramo de atividade atual
    select.innerHTML = `
    <option value="">Seleccione o produto</option>
    ` + FABEF.produtos
        .filter(p => p.ramo === FABEF.ramo)
        .map(p => `
        <option value="${escapeHTML(p.id)}">
            ${escapeHTML(p.nome)}
        </option>
        `).join("");

    // Sugestões de fornecedores isoladas e filtradas ESTRITAMENTE para este ramo (não mistura fornecedores)
    const listaFornecedores = document.getElementById("lista-fornecedores-compra");
    if (listaFornecedores) {
        listaFornecedores.innerHTML = (FABEF.fornecedores || [])
            .filter(f => !f.ramo || f.ramo === FABEF.ramo)
            .map(f => `<option value="${escapeHTML(f.nome)}">`)
            .join("");
    }

    renderSugestoesComprasRamo();
}

// Ao selecionar o produto, preenche automaticamente o custo e sugere o fornecedor habitual do respetivo ramo
document.getElementById("compra-produto")?.addEventListener("change", (e) => {
    const prodId = e.target.value;
    if (!prodId) return;
    const prod = (FABEF.produtos || []).find(p => p.id === prodId);
    if (!prod) return;

    const inputCusto = document.getElementById("compra-custo");
    if (inputCusto && (!inputCusto.value || Number(inputCusto.value) <= 0)) {
        if (prod.custo) inputCusto.value = prod.custo;
    }

    const inputForn = document.getElementById("compra-fornecedor");
    if (inputForn && !inputForn.value) {
        const ultCompra = (FABEF.compras || [])
            .filter(c => c.produtoId === prod.id && (!c.ramo || c.ramo === FABEF.ramo))
            .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))[0];
        if (ultCompra && ultCompra.fornecedorNome) {
            inputForn.value = ultCompra.fornecedorNome;
        } else {
            const primeiroFornRamo = (FABEF.fornecedores || []).find(f => !f.ramo || f.ramo === FABEF.ramo);
            if (primeiroFornRamo) inputForn.value = primeiroFornRamo.nome;
        }
    }
});

window.renderSugestoesComprasRamo = function() {
    const labelRamo = document.getElementById("compra-ramo-atual-nome");
    if (labelRamo) labelRamo.textContent = FABEF.ramo || "Geral";

    const tbody = document.getElementById("tabela-sugestoes-compras-ramo");
    if (!tbody) return;

    // Filtra estritamente os produtos pertencentes ao ramo de atividade atual
    const produtosDoRamo = (FABEF.produtos || []).filter(p => p.ramo === FABEF.ramo);
    // Produtos que estão abaixo ou no nível de stock mínimo
    const produtosSugeridos = produtosDoRamo.filter(p => {
        const stockAtual = numero(p.stock);
        const stockMin = numero(p.minimo || p.stockMinimo || 5);
        return stockAtual <= stockMin;
    });

    if (produtosSugeridos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:14px;color:#10b981;font-weight:600;">
                    ✅ Todos os artigos do ramo <strong>"${escapeHTML(FABEF.ramo || 'Geral')}"</strong> estão com níveis regulares de stock. Não há compras urgentes recomendadas.
                </td>
            </tr>
        `;
        return;
    }

    const fornecedoresDoRamo = (FABEF.fornecedores || []).filter(f => !f.ramo || f.ramo === FABEF.ramo);

    tbody.innerHTML = produtosSugeridos.map(p => {
        const stockAtual = numero(p.stock);
        const stockMin = numero(p.minimo || p.stockMinimo || 5);
        const comprasDoProduto = (FABEF.compras || [])
            .filter(c => c.produtoId === p.id && (!c.ramo || c.ramo === FABEF.ramo))
            .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

        const ultCompra = comprasDoProduto[0];
        const fornecedorSugerido = ultCompra?.fornecedorNome || (fornecedoresDoRamo[0]?.nome || "Fornecedor do Ramo");
        const custoSugerido = ultCompra?.custoUnitario || p.custo || 0;
        const qtdSugerida = Math.max(1, (stockMin * 2) - stockAtual);

        return `
            <tr>
                <td><strong>${escapeHTML(p.nome)}</strong></td>
                <td><span style="color:${stockAtual === 0 ? '#ef4444' : '#f59e0b'};font-weight:700;">${stockAtual} un</span></td>
                <td>${stockMin} un</td>
                <td><span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;">${escapeHTML(fornecedorSugerido)}</span></td>
                <td>${dinheiro(custoSugerido)}</td>
                <td>
                    <button class="btn btn-primary btn-small" type="button" onclick="prepararCompraArtigo('${escapeHTML(p.id)}', '${escapeHTML(fornecedorSugerido)}', ${custoSugerido}, ${qtdSugerida})" style="background:#2563eb;color:#fff;font-weight:700;padding:5px 10px;font-size:12px;border:none;border-radius:6px;cursor:pointer;">
                        🛒 Preparar Compra (${qtdSugerida} un)
                    </button>
                </td>
            </tr>
        `;
    }).join("");
};

window.prepararCompraArtigo = function(produtoId, fornecedorNome, custoUnit, qtd) {
    const selProd = document.getElementById("compra-produto");
    if (selProd) selProd.value = produtoId;
    const inputForn = document.getElementById("compra-fornecedor");
    if (inputForn) inputForn.value = fornecedorNome;
    const inputCusto = document.getElementById("compra-custo");
    if (inputCusto) inputCusto.value = custoUnit;
    const inputQtd = document.getElementById("compra-quantidade");
    if (inputQtd) {
        inputQtd.value = qtd || 1;
        inputQtd.focus();
    }
    document.getElementById("compra-produto")?.scrollIntoView({ behavior: "smooth", block: "center" });
};


document.getElementById("btn-registar-compra").addEventListener("click", registarCompra);


/* =====================================================
   MÓDULO LÓGICO: GRAVAÇão ATÓMICA DE COMPRA E INVENTÁRIO
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
   MÓDULO LÓGICO: RENDERIZAÇão DA TABELA DE ENTRADAS
===================================================== */

function renderCompras() {
    const lista = FABEF.compras
        .filter(c => !c.ramo || c.ramo === FABEF.ramo)
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

    if (typeof renderSugestoesComprasRamo === "function") renderSugestoesComprasRamo();
}


/* =====================================================
   MÓDULO LÓGICO: PONTO DE VENDA (POS FLUXO DE CAIXA)
===================================================== */

document.getElementById("pos-pesquisa").addEventListener("input", renderPOS);


function renderPOS() {
    const pesquisa = document.getElementById("pos-pesquisa").value.toLowerCase();

    // Avisa quando offline: o stock mostrado pode não refletir vendas feitas
    // por outros dispositivos enquanto ambos estiverem sem internet.
    const avisoOffline = document.getElementById("aviso-pos-offline");
    if (avisoOffline) {
        avisoOffline.innerHTML = navigator.onLine ? "" :
            `<div class="alert alert-warn">🔴 Está offline. O stock apresentado é o último conhecido neste aparelho —
            se outro funcionário também estiver offline a vender o mesmo produto, pode haver stock negativo até
            os dois voltarem a ter internet e sincronizarem. Assim que sincronizar, verifique o aviso de
            reconciliação no Início, se aparecer.</div>`;
    }

    // Filtra artigos ativos pertencentes estritamente ao ramo de negócio aberto no ecrã
    const lista = FABEF.produtos.filter(p => {
        return p.ativo !== false &&
            p.ramo === FABEF.ramo &&
            (!pesquisa ||
                String(p.nome || "").toLowerCase().includes(pesquisa) ||
                String(p.codigo || "").toLowerCase().includes(pesquisa) ||
                String(p.tamanho || "").toLowerCase().includes(pesquisa) ||
                String(p.cor || "").toLowerCase().includes(pesquisa) ||
                String(p.categoria || "").toLowerCase().includes(pesquisa));
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
                <button class="produto-pos" data-pos-produto="${escapeHTML(p.id)}" type="button" style="border-color:#f59e0b;">
                    <strong>${escapeHTML(p.nome)}</strong>
                    ${(p.tamanho || p.cor) ? `<small style="color:#0284c7;font-weight:600;">${[p.tamanho ? 'Tam: ' + escapeHTML(p.tamanho) : '', p.cor ? 'Cor: ' + escapeHTML(p.cor) : ''].filter(Boolean).join(' | ')}</small>` : ''}
                    <small>${dinheiro(p.preco)}</small>
                </button>`).join("")}
            </div>` : "";
    }

    containerPOS.innerHTML = lista.map(p => {
        const atributos = [];
        if (p.tamanho) atributos.push(`Tam: ${escapeHTML(p.tamanho)}`);
        if (p.cor) atributos.push(`Cor: ${escapeHTML(p.cor)}`);
        const atrBadge = atributos.length ? `<small style="color:#0284c7;font-weight:600;display:block;margin:2px 0;">${atributos.join(" | ")}</small>` : "";

        const ehPesavel = ehArtigoPesavel(p);

        const botoesOpcaoVenda = ehPesavel ? `
            <div style="display:flex;gap:4px;width:100%;margin-top:6px;z-index:2;" onclick="event.stopPropagation();">
                <button type="button" class="btn btn-small btn-primary" onclick="abrirModalVendaFracionadaById('${escapeHTML(p.id)}', 'peso')" style="flex:1;padding:5px 4px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:3px;" title="Vender indicando o peso exato na balança em KG ou Gramas">⚖️ Pesar KG</button>
                <button type="button" class="btn btn-small btn-light" onclick="abrirModalVendaFracionadaById('${escapeHTML(p.id)}', 'valor')" style="flex:1;padding:5px 4px;font-size:11px;font-weight:700;color:#1e3a8a;border:1px solid #93c5fd;display:inline-flex;align-items:center;justify-content:center;gap:3px;" title="Vender indicando o valor em Meticais (calcula os KG automaticamente)">💵 Digitar MT</button>
            </div>
        ` : "";

        return `
        <div
            class="produto-pos"
            data-pos-produto="${escapeHTML(p.id)}"
            title="${ehPesavel ? 'Clique para escolher vender em KG ou escrever o preço' : 'Adicionar ao carrinho'}"
            style="cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;"
        >
            <div>
                ${p.foto ? `<img src="${escapeHTML(p.foto)}" alt="" style="width:100%;height:70px;object-fit:cover;border-radius:6px;margin-bottom:4px;" onerror="this.style.display='none';">` : ""}
                <strong>${escapeHTML(p.nome)}</strong>
                ${atrBadge}
                <small style="display:block;">${dinheiro(p.preco)}${p.unidade && p.unidade !== "unidade" ? " / " + escapeHTML(p.unidade) : ""}</small>
                <small style="display:block;color:#64748b;">Stock: ${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + escapeHTML(p.unidade) : ""}</small>
            </div>
            ${botoesOpcaoVenda}
        </div>
        `;
    }).join("") || `
    <div class="alert alert-info" style="width: 100%; text-align: center;">
        Nenhum produto disponível para faturamento neste ramo.
    </div>
    `;

    // Vincula dinamicamente a ação de clique no corpo do cartão
    document.querySelectorAll(".produto-pos[data-pos-produto]").forEach(btn => {
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

function ehArtigoPesavel(produto) {
    if (!produto) return false;
    const u = String(produto.unidade || "").toLowerCase().trim();
    if (["kg", "kilo", "kilos", "quilo", "quilos", "quilograma", "g", "gr", "grama", "gramas", "litro", "litros", "l"].includes(u)) {
        return true;
    }
    if (produto.vendaPorPeso || produto.fracionado) return true;

    // Atividades que exigem kg por padrão (Talho / Açougue / Peixaria / Granel)
    const ramo = String(produto.ramo || FABEF.ramo || "").toLowerCase();
    const nome = String(produto.nome || "").toLowerCase();
    if (ramo.includes("talho") || ramo.includes("açougue") || ramo.includes("acougue") || ramo.includes("peixaria")) {
        if (!produto.unidade || u === "kg" || u === "g" || u === "unidade") {
            return true;
        }
    }
    if (nome.includes("/kg") || nome.includes("/ kg") || nome.includes(" ao kg") || nome.includes(" p/ kg") || nome.includes("(kg)")) {
        return true;
    }
    return false;
}

window.abrirModalVendaFracionadaById = function(produtoId, modoInicial) {
    const produto = (FABEF.produtos || []).find(p => p.id === produtoId);
    if (!produto) return;
    abrirModalVendaFracionada(produto, modoInicial || "peso");
};

async function adicionarCarrinho(id) {
    let perfilAtual = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfilAtual = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfilAtual = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }

    // Barreira imediata de interface: caixa deve estar aberto para vender
    if (!FABEF.turnoId) {
        const abrir = confirm("⚠️ O Caixa / Turno de hoje ainda não foi aberto.\n\nPara registar vendas operacionais, o caixa precisa de estar aberto.\nDeseja ir à secção Caixa / Turnos para abrir agora?");
        if (abrir) {
            mostrarSecao("caixa");
        }
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

    const unidadeFracionada = ehArtigoPesavel(produto);

    // Em atividades que exigem kg (ex: talhos, carnes, peixarias, granel)
    // ao atender ou vender o funcionário vê de imediato a janela de peso/valor para indicar a pesagem na balança
    if (unidadeFracionada) {
        abrirModalVendaFracionada(produto, "peso");
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
            tamanho: produto.tamanho || "",
            cor: produto.cor || "",
            quantidade: 1
        });
    }

    renderCarrinho();
}

/* =====================================================
   MÓDULO: CALCULADORA DE VENDA FRACIONADA (PESO / VALOR)
===================================================== */
window.FABEF_frac_modo = "peso";

function abrirModalVendaFracionada(produto, modoInicial) {
    const modal = document.getElementById("modal-venda-fracionada");
    if (!modal) return;

    document.getElementById("frac-produto-id").value = produto.id;

    // Deteta ícone temático de acordo com a mercadoria
    const nomeBaixo = String(produto.nome || "").toLowerCase();
    let icone = "🥩";
    if (nomeBaixo.includes("peixe") || nomeBaixo.includes("camar") || nomeBaixo.includes("chicoa") || nomeBaixo.includes("carapau")) icone = "🐟";
    else if (nomeBaixo.includes("frango") || nomeBaixo.includes("galinha") || nomeBaixo.includes("moela") || nomeBaixo.includes("asa")) icone = "🍗";
    else if (nomeBaixo.includes("fruta") || nomeBaixo.includes("banana") || nomeBaixo.includes("maçã") || nomeBaixo.includes("laranja")) icone = "🍎";
    else if (nomeBaixo.includes("tomate") || nomeBaixo.includes("batata") || nomeBaixo.includes("cebola") || nomeBaixo.includes("legume")) icone = "🥔";
    else if (nomeBaixo.includes("leite") || nomeBaixo.includes("óleo") || nomeBaixo.includes("oleo") || produto.unidade === "litro") icone = "🥛";

    const unidTexto = produto.unidade || "kg";
    document.getElementById("frac-titulo").textContent = `${icone} ${produto.nome}`;
    document.getElementById("frac-subtitulo").textContent = `Preço: ${dinheiro(produto.preco)} / ${unidTexto} | Stock na banca: ${numero(produto.stock)} ${unidTexto}`;

    const inputPeso = document.getElementById("frac-peso");
    const inputValor = document.getElementById("frac-valor");
    const selectUnidade = document.getElementById("frac-unidade-medida");

    if (inputPeso) inputPeso.value = "";
    if (inputValor) inputValor.value = "";
    if (selectUnidade) selectUnidade.value = produto.unidade === "g" ? "g" : "kg";

    ativarModoCalculoFracionada(modoInicial || "peso", produto);

    modal.classList.add("show");
    setTimeout(() => {
        if (modoInicial === "valor") {
            inputValor?.focus();
        } else {
            inputPeso?.focus();
        }
    }, 150);
}

function ativarModoCalculoFracionada(modo, produto) {
    window.FABEF_frac_modo = modo;
    const btnPeso = document.getElementById("btn-calc-peso");
    const btnValor = document.getElementById("btn-calc-valor");
    const blocoPeso = document.getElementById("bloco-input-peso");
    const blocoValor = document.getElementById("bloco-input-valor");

    if (modo === "peso") {
        btnPeso?.classList.add("btn-primary");
        btnPeso?.classList.remove("btn-light");
        btnValor?.classList.add("btn-light");
        btnValor?.classList.remove("btn-primary");
        if (blocoPeso) blocoPeso.style.display = "block";
        if (blocoValor) blocoValor.style.display = "none";
        document.getElementById("frac-peso")?.focus();
    } else {
        btnValor?.classList.add("btn-primary");
        btnValor?.classList.remove("btn-light");
        btnPeso?.classList.add("btn-light");
        btnPeso?.classList.remove("btn-primary");
        if (blocoValor) blocoValor.style.display = "block";
        if (blocoPeso) blocoPeso.style.display = "none";
        document.getElementById("frac-valor")?.focus();
    }
    recalcularFracionada(produto);
}

function recalcularFracionada(produto) {
    if (!produto) {
        const id = document.getElementById("frac-produto-id")?.value;
        produto = FABEF.produtos.find(p => p.id === id);
    }
    if (!produto) return;

    const modo = window.FABEF_frac_modo || "peso";
    const precoUnit = numero(produto.preco);
    let qtdCalculada = 0;
    let totalCalculado = 0;

    if (modo === "peso") {
        const pesoDigitado = numero(document.getElementById("frac-peso")?.value);
        const unidadeSel = document.getElementById("frac-unidade-medida")?.value || "kg";
        if (unidadeSel === "g") {
            qtdCalculada = pesoDigitado / 1000;
        } else {
            qtdCalculada = pesoDigitado;
        }
        totalCalculado = qtdCalculada * precoUnit;
    } else {
        const valorDigitado = numero(document.getElementById("frac-valor")?.value);
        totalCalculado = valorDigitado;
        if (precoUnit > 0) {
            qtdCalculada = valorDigitado / precoUnit;
        }
    }

    const resumoQtd = document.getElementById("frac-resumo-qtd");
    const resumoTotal = document.getElementById("frac-resumo-total");
    if (resumoQtd) {
        if (qtdCalculada > 0) {
            const emGramas = (qtdCalculada * 1000).toFixed(0);
            resumoQtd.textContent = `${qtdCalculada.toFixed(3)} kg (${emGramas} g)`;
        } else {
            resumoQtd.textContent = "0.000 kg";
        }
    }
    if (resumoTotal) {
        resumoTotal.textContent = dinheiro(totalCalculado);
    }
}

document.getElementById("btn-calc-peso")?.addEventListener("click", () => ativarModoCalculoFracionada("peso"));
document.getElementById("btn-calc-valor")?.addEventListener("click", () => ativarModoCalculoFracionada("valor"));
document.getElementById("frac-peso")?.addEventListener("input", () => recalcularFracionada());
document.getElementById("frac-unidade-medida")?.addEventListener("change", () => recalcularFracionada());
document.getElementById("frac-valor")?.addEventListener("input", () => recalcularFracionada());

document.getElementById("frac-peso")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btn-confirmar-fracionada")?.click();
    }
});
document.getElementById("frac-valor")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btn-confirmar-fracionada")?.click();
    }
});

document.getElementById("btn-confirmar-fracionada")?.addEventListener("click", () => {
    const id = document.getElementById("frac-produto-id")?.value;
    const produto = FABEF.produtos.find(p => p.id === id);
    if (!produto) return;

    const modo = window.FABEF_frac_modo || "peso";
    const precoUnit = numero(produto.preco);
    let quantidadeDesejada = 0;

    if (modo === "peso") {
        const pesoDigitado = numero(document.getElementById("frac-peso")?.value);
        const unidadeSel = document.getElementById("frac-unidade-medida")?.value || "kg";
        quantidadeDesejada = unidadeSel === "g" ? (pesoDigitado / 1000) : pesoDigitado;
    } else {
        const valorDigitado = numero(document.getElementById("frac-valor")?.value);
        if (precoUnit > 0) quantidadeDesejada = valorDigitado / precoUnit;
    }

    if (quantidadeDesejada <= 0) {
        alert("Por favor, introduza um peso ou valor válido.");
        return;
    }

    const existentePeso = FABEF.carrinho.find(x => x.produtoId === id);
    const totalPretendido = (existentePeso ? existentePeso.quantidade : 0) + quantidadeDesejada;
    if (totalPretendido > numero(produto.stock)) {
        alert(`Quantidade solicitada (${totalPretendido.toFixed(3)} ${produto.unidade || "kg"}) superior ao stock físico disponível na banca (${numero(produto.stock)} ${produto.unidade || "kg"}).`);
        return;
    }

    if (existentePeso) {
        existentePeso.quantidade = totalPretendido;
    } else {
        FABEF.carrinho.push({
            produtoId: id,
            nome: produto.nome,
            preco: precoUnit,
            unidade: produto.unidade || "kg",
            tamanho: produto.tamanho || "",
            cor: produto.cor || "",
            quantidade: quantidadeDesejada
        });
    }

    fecharModal("modal-venda-fracionada");
    renderCarrinho();
});


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
        atualizarRestantePagamentoMisto();
        return;
    }

    let totalAcumulado = 0;

    corpo.innerHTML = FABEF.carrinho.map((item, index) => {
        const subtotal = numero(item.preco) * numero(item.quantidade);
        totalAcumulado += subtotal;

        const ehPesavel = ehArtigoPesavel(item);
        const qtdFormatada = ehPesavel ?
            `${numero(item.quantidade).toFixed(3)} ${item.unidade || "kg"}` :
            `${numero(item.quantidade)} ${item.unidade || "un"}`;

        const atributos = [];
        if (item.tamanho) atributos.push(`Tam: ${escapeHTML(item.tamanho)}`);
        if (item.cor) atributos.push(`Cor: ${escapeHTML(item.cor)}`);
        const atrTxt = atributos.length ? ` <span style="font-size:11px;color:#0284c7;font-weight:600;">(${atributos.join(", ")})</span>` : "";

        return `
        <div class="cart-item">
            <div class="cart-info">
                <strong>${escapeHTML(item.nome)}</strong>${atrTxt}<br>
                <small>${qtdFormatada} × ${dinheiro(item.preco)}</small>
            </div>
            <div style="font-weight: 700; font-size: 13px; margin-right: 5px; color: #065f46;">
                ${dinheiro(subtotal)}
            </div>
            <div style="display:flex;gap:4px;align-items:center;">
                ${ehPesavel ? `
                <button 
                    class="btn btn-light btn-small" 
                    style="padding: 2px 6px; font-size: 11px; border: 1px solid #cbd5e1;" 
                    onclick="abrirModalVendaFracionadaById('${escapeHTML(item.produtoId)}', 'peso')"
                    type="button"
                    title="Ajustar peso ou valor da pesagem"
                >
                    ⚖️
                </button>
                ` : ''}
                <button 
                    class="btn btn-danger btn-small" 
                    style="padding: 2px 6px; font-size: 11px;" 
                    onclick="removerItemCarrinho(${index})"
                    type="button"
                    title="Remover do carrinho"
                >
                    ✕
                </button>
            </div>
        </div>
        `;
    }).join("");

    totalSpan.textContent = dinheiro(totalAcumulado);
    atualizarRestantePagamentoMisto();
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
   MÓDULO LÓGICO: FINALIZAR VENDA (TRANSAÇão ATÓMICA)
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
    atualizarRestantePagamentoMisto();
}
document.getElementById("pos-pagamento-misto")?.addEventListener("change", alternarPagamentoMisto);

function atualizarRestantePagamentoMisto() {
    const span = document.getElementById("pos-pagamento-restante");
    if (!span) return;

    const total = FABEF.carrinho.reduce((s, x) => s + (numero(x.preco) * numero(x.quantidade)), 0);
    const desconto = Math.min(numero(document.getElementById("pos-desconto")?.value), total);
    const totalComDesconto = total - desconto;

    const soma = ["pos-valor-dinheiro", "pos-valor-mpesa", "pos-valor-emola", "pos-valor-cartao", "pos-valor-credito"]
        .reduce((s, id) => s + numero(document.getElementById(id)?.value), 0);

    const restante = totalComDesconto - soma;
    span.textContent = dinheiro(Math.abs(restante));
    span.style.color = Math.abs(restante) < 0.5 ? "#10b981" : (restante > 0 ? "#ef4444" : "#f59e0b");
    span.textContent += restante > 0.5 ? " em falta" : (restante < -0.5 ? " a mais" : " — tudo atribuído ✓");
}
["pos-valor-dinheiro", "pos-valor-mpesa", "pos-valor-emola", "pos-valor-cartao", "pos-valor-credito", "pos-desconto"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", atualizarRestantePagamentoMisto);
});


async function finalizarVenda() {
    let perfilAtual = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfilAtual = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfilAtual = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }

    if (perfilAtual === "gerente") {
        alert("🛡️ Operação Bloqueada ao Gerente:\n\nO perfil de Gerente é para gestão, supervisão, auditoria e edição/cadastro de artigos.\n\nPara registar vendas operacionais no caixa, aceda com o perfil de Funcionário.");
        return;
    }

    if (limiteVendasDiariasAtingido()) {
        avisoLimiteAtingido(`Atingiu o limite diário de ${LIMITES_PLANO_GRATIS.vendasDiarias} vendas do plano grátis.`);
        return;
    }

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
        const novaVendaId = vendaRef.id;

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
                unidade: produto.unidade || item.unidade || "unidade",
                tamanho: produto.tamanho || item.tamanho || "",
                cor: produto.cor || item.cor || "",
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
            turnoId: FABEF.turnoId || null,
            diaOperacional: FABEF.dataAtiva,
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
        
        // Abre o modal de recibo profissional com opções de impressão e envio por WhatsApp
        window.FABEF_ultimaVendaId = novaVendaId;
        const resumoModal = document.getElementById("recibo-sucesso-resumo");
        if (resumoModal) {
            resumoModal.innerHTML = `
                <div style="font-size: 1.4rem; font-weight: 800; color: #065f46; margin-bottom: 4px;">
                    ${dinheiro(totalComDesconto)}
                </div>
                <div style="font-size: 0.85rem; color: #475569;">
                    Recibo: <strong>${escapeHTML(novaVendaId)}</strong> • ${linhas.length} artigo(s) • Pagamento: <strong>${escapeHTML(pagamento)}</strong>
                </div>
            `;
        }
        document.getElementById("modal-recibo-sucesso")?.classList.add("show");

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
    if (periodo === "ano") inicio = new Date(new Date().getFullYear(), 0, 1);

    // Obtém todas as vendas da empresa no ramo ativo (da lista em memória ou do raw histórico)
    const fonteVendas = (FABEF.vendas && FABEF.vendas.length > 0) ? FABEF.vendas : (FABEF._raw?.vendas || []);

    const listaFiltrada = fonteVendas.filter(v => {
        if (periodo === "turno") {
            if (!v.turnoId || v.turnoId !== FABEF.turnoId) return false;
        } else if (inicio) {
            const dataVenda = new Date(v.data || v.date || 0);
            if (dataVenda < inicio) return false;
        }
        if (v.ramo && v.ramo !== FABEF.ramo) return false;
        const textoCompleto = JSON.stringify(v).toLowerCase();
        return !pesquisa || textoCompleto.includes(pesquisa);
    }).sort((a,b) => new Date(b.data || b.date || 0) - new Date(a.data || a.date || 0));

    // Cálculos de KPI para o período selecionado
    let faturamentoPeriodo = 0;
    let kgPeriodo = 0;
    let qtdValidas = 0;

    listaFiltrada.forEach(v => {
        const ehCancelada = v.status === "FALHADA_CANCELADA" || v.status === "CANCELADA";
        if (!ehCancelada) {
            faturamentoPeriodo += numero(v.total);
            qtdValidas++;
            const itens = v.itens || v.items || [];
            itens.forEach(it => {
                const un = (it.unidade || "").toLowerCase();
                const q = numero(it.quantidade);
                if (un === "kg") kgPeriodo += q;
                else if (un === "g") kgPeriodo += (q / 1000);
            });
        }
    });

    const ticketMedio = qtdValidas > 0 ? (faturamentoPeriodo / qtdValidas) : 0;

    const elKpiFat = document.getElementById("vendas-kpi-faturamento");
    const elKpiKg = document.getElementById("vendas-kpi-kg");
    const elKpiQtd = document.getElementById("vendas-kpi-qtd");
    const elKpiTicket = document.getElementById("vendas-kpi-ticket");

    if (elKpiFat) elKpiFat.textContent = dinheiro(faturamentoPeriodo);
    if (elKpiKg) elKpiKg.textContent = kgPeriodo > 0 ? `${kgPeriodo.toFixed(3)} kg` : "0.000 kg";
    if (elKpiQtd) elKpiQtd.textContent = String(qtdValidas);
    if (elKpiTicket) elKpiTicket.textContent = dinheiro(ticketMedio);

    const tabelaCorpo = document.getElementById("tabela-vendas");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = listaFiltrada.map(v => {
        const itensMapeados = (v.itens || v.items || []).map(x => {
            const qtd = numero(x.quantidade || x.qty);
            const un = (x.unidade && x.unidade !== "unidade") ? ` ${x.unidade}` : "";
            const atributos = [];
            if (x.tamanho) atributos.push(`Tam: ${escapeHTML(x.tamanho)}`);
            if (x.cor) atributos.push(`Cor: ${escapeHTML(x.cor)}`);
            const atrTxt = atributos.length ? ` <span style="color:#0284c7;font-weight:600;font-size:11px;">(${atributos.join(", ")})</span>` : "";
            return `<div style="margin-bottom:3px;">• <strong>${escapeHTML(x.nome || "Produto")}</strong>${atrTxt} × <span style="font-weight:600;">${qtd}${un}</span></div>`;
        }).join("");
        const ehFalhada = v.status === "FALHADA_CANCELADA" || v.status === "FALHADA" || v.status === "CANCELADA";
        const ehCorrigida = v.status === "CORRIGIDA_PRECO";
        return `
        <tr style="${ehFalhada ? 'background: #fff1f2; opacity: 0.88;' : (ehCorrigida ? 'background: #eff6ff;' : '')}">
            <td>
                ${dataTexto(v.data || v.date)}
                ${ehFalhada ? `
                    <div style="margin-top:4px;"><span class="badge badge-red" style="font-size:11px;">⚠️ Falhada / Cancelada</span></div>
                    <div style="font-size:11px;color:#b91c1c;margin-top:2px;"><strong>Justificativa ao Gerente:</strong> ${escapeHTML(v.justificativaGerente || v.motivoFalha || 'Venda anulada')}</div>
                ` : ""}
                ${ehCorrigida ? `
                    <div style="margin-top:4px;"><span class="badge" style="background:#0284c7;color:#fff;font-size:11px;">✏️ Preço Corrigido (Antes: ${dinheiro(v.precoOriginal)})</span></div>
                    <div style="font-size:11px;color:#1d4ed8;margin-top:2px;"><strong>Justificativa ao Gerente:</strong> ${escapeHTML(v.justificativaGerente || 'Ajuste de preço')}</div>
                ` : ""}
            </td>
            <td>${escapeHTML(v.operadorNome || v.user || "—")}</td>
            <td style="white-space: normal; max-width: 220px;">${itensMapeados}</td>
            <td><strong style="${ehFalhada ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${dinheiro(v.total)}</strong></td>
            <td>${escapeHTML(v.pagamento || v.method || "—")}</td>
            <td>${escapeHTML(v.nuitCliente || "Isento")}</td>
            <td>${escapeHTML(v.ramo || "—")}</td>
            <td>
                <details class="pasta-acoes-venda" style="display:inline-block;position:relative;">
                    <summary class="btn btn-small" style="cursor:pointer;list-style:none;background:#f8fafc;border:1.5px solid #cbd5e1;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;color:#1e293b;display:inline-flex;align-items:center;gap:6px;user-select:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);white-space:nowrap;">
                        📁 Opções da Venda ▾
                    </summary>
                    <div style="position:absolute;right:0;top:calc(100% + 4px);z-index:90;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1);min-width:190px;padding:6px;display:flex;flex-direction:column;gap:5px;">
                        <button class="btn btn-light btn-small" onclick="this.closest('details').removeAttribute('open'); imprimirReciboVenda('${escapeHTML(v.id)}')" type="button" style="text-align:left;width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px;font-weight:600;border-radius:6px;" title="Imprimir Recibo Térmico ou A4">🖨️ Imprimir Recibo</button>
                        <button class="btn btn-success btn-small" onclick="this.closest('details').removeAttribute('open'); enviarReciboWhatsApp('${escapeHTML(v.id)}')" type="button" style="background-color:#25d366;color:#fff;text-align:left;width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px;font-weight:600;border-radius:6px;border:none;" title="Enviar Recibo pelo WhatsApp">📱 Enviar WhatsApp</button>
                        <button class="btn btn-primary btn-small" onclick="this.closest('details').removeAttribute('open'); abrirModalEditarVenda('${escapeHTML(v.id)}')" type="button" style="background:#2563eb;color:#fff;font-weight:700;text-align:left;width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px;border-radius:6px;border:none;" title="Editar valor, forma de pagamento ou cliente">✏️ Editar Venda</button>
                        ${!ehFalhada ? `
                            <button class="btn btn-small" onclick="this.closest('details').removeAttribute('open'); abrirModalVendaFalhada('${escapeHTML(v.id)}')" type="button" style="background:#fff7ed;color:#c2410c;border:1px solid #fdba74;font-size:12px;text-align:left;width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;font-weight:600;border-radius:6px;" title="Registar falha ou relatar ao Gerente">⚠️ Justificar ao Gerente</button>
                        ` : ""}
                        <button class="btn btn-small" onclick="this.closest('details').removeAttribute('open'); apagarVenda('${escapeHTML(v.id)}')" type="button" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:700;text-align:left;width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12px;border-radius:6px;" title="Apagar definitivamente e repor stock">🗑️ Apagar Venda</button>
                    </div>
                </details>
            </td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">Nenhuma operação de venda localizada nos critérios definidos.</td></tr>`;
}

window.imprimirReciboVenda = function(vendaId) {
    const v = FABEF.vendas.find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }

    const ramoDaVenda = v.ramo || FABEF.ramo;
    const emp = typeof obterConfiguracaoRamo === "function" ? obterConfiguracaoRamo(ramoDaVenda) : (FABEF.empresa || {});
    const nomeEmpresa = emp.nome || ramoDaVenda || "FABEF GESTÃO ERP PRO";
    const nuitEmpresa = emp.nuit || "Isento / Não registado";
    const telEmpresa = emp.telefone || "+258 84 123 4567";
    const endEmpresa = emp.endereco || "Moçambique";
    const cidadeEmpresa = emp.cidade || "Maputo";
    const regimeIva = emp.ivaRegime === "GERAL_16" ? `IVA ${emp.ivaTaxa || 16}% Incluído` : (emp.ivaRegime === "SIMPLIFICADO_5" ? `IVA 5% Simplificado` : "Regime de Isenção (Art. 9 CIVA)");
    const rodapeMsg = emp.rodapeRecibo || "Obrigado pela sua preferência! Volte sempre.";

    const itensHtml = (v.itens || []).map(i => {
        const ehFracionado = i.unidade === "kg" || i.unidade === "litro" || i.unidade === "g";
        const qtdDesc = ehFracionado ? `${numero(i.quantidade).toFixed(3)} ${i.unidade}` : `${numero(i.quantidade)} ${i.unidade || "un"}`;
        return `
        <tr>
            <td style="padding: 4px 2px; font-weight: 600; border-bottom: 1px dashed #cbd5e1;">${escapeHTML(i.nome)}</td>
            <td style="padding: 4px 2px; text-align: center; border-bottom: 1px dashed #cbd5e1;">${qtdDesc}</td>
            <td style="padding: 4px 2px; text-align: right; border-bottom: 1px dashed #cbd5e1;">${dinheiro(i.preco)}</td>
            <td style="padding: 4px 2px; text-align: right; font-weight: 700; border-bottom: 1px dashed #cbd5e1;">${dinheiro(i.subtotal)}</td>
        </tr>
        `;
    }).join("");

    const totalVenda = numero(v.total);
    const subtotalVenda = numero(v.subtotal || totalVenda);
    const descontoVenda = numero(v.desconto || 0);

    let w = null;
    try {
        w = window.open("", "_blank");
    } catch (e) {
        w = null;
    }

    const reciboHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Recibo Comercial - ${escapeHTML(v.id)}</title>
        <style>
            @media print {
                body { margin: 0; padding: 6px; font-size: 11px; }
                @page { margin: 0; size: 80mm auto; }
            }
            body {
                font-family: 'Courier New', Courier, monospace, sans-serif;
                max-width: 320px;
                margin: 0 auto;
                padding: 16px 12px;
                color: #0f172a;
                background: #fff;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .divider { border-top: 1px dashed #475569; margin: 8px 0; }
            .double-divider { border-top: 2px double #0f172a; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { border-bottom: 1px dashed #475569; padding: 4px 2px; font-size: 11px; text-transform: uppercase; }
            .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin: 4px 0; }
        </style>
    </head>
    <body>
        <div class="center">
            <h2 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 900; text-transform: uppercase;">${escapeHTML(nomeEmpresa)}</h2>
            <div style="font-size: 11px;">${escapeHTML(endEmpresa)} - ${escapeHTML(cidadeEmpresa)}</div>
            <div style="font-size: 11px;">NUIT: <strong>${escapeHTML(nuitEmpresa)}</strong> | Tel: ${escapeHTML(telEmpresa)}</div>
            <div style="font-size: 10px; color: #475569; margin-top: 2px;">${escapeHTML(regimeIva)}</div>
        </div>

        <div class="divider"></div>

        <div class="center" style="font-weight: 800; font-size: 12px; letter-spacing: 1px;">VD / FACTURA-RECIBO</div>
        <div class="info-row" style="margin-top: 6px;">
            <span>Doc. Nº:</span><strong>${escapeHTML(v.id)}</strong>
        </div>
        <div class="info-row">
            <span>Data/Hora:</span><span>${dataTexto(v.data)}</span>
        </div>
        <div class="info-row">
            <span>Operador/Caixa:</span><span>${escapeHTML(v.operadorNome || "Balcão")}</span>
        </div>
        <div class="info-row">
            <span>Ramo/Sector:</span><span>${escapeHTML(v.ramo || FABEF.ramo || "Comercial")}</span>
        </div>
        <div class="divider"></div>

        <div class="info-row">
            <span>Cliente:</span><strong>${escapeHTML(v.cliente || "Consumidor Final")}</strong>
        </div>
        <div class="info-row">
            <span>NUIT Cliente:</span><span>${escapeHTML(v.nuitCliente || "Isento / Final")}</span>
        </div>

        <div class="divider"></div>

        <table>
            <thead>
                <tr>
                    <th style="text-align: left;">Artigo</th>
                    <th style="text-align: center;">Qtd</th>
                    <th style="text-align: right;">P.Unit</th>
                    <th style="text-align: right;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itensHtml}
            </tbody>
        </table>

        <div class="divider"></div>

        <div class="info-row">
            <span>Subtotal:</span><span>${dinheiro(subtotalVenda)}</span>
        </div>
        ${descontoVenda > 0 ? `
        <div class="info-row" style="color: #dc2626;">
            <span>Desconto Comercial:</span><span>-${dinheiro(descontoVenda)}</span>
        </div>
        ` : ""}
        <div class="double-divider"></div>
        <div class="total-row">
            <span>TOTAL PAGO:</span><span>${dinheiro(totalVenda)}</span>
        </div>
        <div class="double-divider"></div>

        <div class="info-row">
            <span>Forma Pagamento:</span><strong>${escapeHTML(v.pagamento || "Dinheiro")}</strong>
        </div>
        ${v.pagamentoDetalhe ? `<div style="font-size: 10px; color: #475569;">${escapeHTML(v.pagamentoDetalhe)}</div>` : ""}

        <div class="divider" style="margin-top: 14px;"></div>
        <div class="center" style="font-size: 10px; margin-top: 6px;">
            <div>${escapeHTML(rodapeMsg)}</div>
            <div style="margin-top: 6px; color: #64748b; font-size: 9px;">Processado por FABEF Gestão ERP PRO (Moçambique)</div>
        </div>
        <script>
            window.addEventListener('load', () => {
                setTimeout(() => { window.print(); }, 200);
            });
        </script>
    </body>
    </html>
    `;
    if (w) {
        w.document.write(reciboHtml);
        w.document.close();
    } else {
        let printIframe = document.getElementById("print-recibo-fallback-iframe");
        if (!printIframe) {
            printIframe = document.createElement("iframe");
            printIframe.id = "print-recibo-fallback-iframe";
            printIframe.style.display = "none";
            document.body.appendChild(printIframe);
        }
        printIframe.contentWindow.document.open();
        printIframe.contentWindow.document.write(reciboHtml);
        printIframe.contentWindow.document.close();
        setTimeout(() => {
            try {
                printIframe.contentWindow.focus();
                printIframe.contentWindow.print();
            } catch (err) {
                alert("Nota: Se a impressão automática for restrita nesta janela, abra o aplicativo numa nova aba.");
            }
        }, 300);
    }
};

window.enviarReciboWhatsApp = function(vendaId) {
    const v = FABEF.vendas.find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }

    const ramoDaVenda = v.ramo || FABEF.ramo;
    const emp = typeof obterConfiguracaoRamo === "function" ? obterConfiguracaoRamo(ramoDaVenda) : (FABEF.empresa || {});
    const nomeEmpresa = emp.nome || ramoDaVenda || "FABEF GESTÃO ERP PRO";
    const nuitEmpresa = emp.nuit || "Isento";
    const telEmpresa = emp.telefone || "+258 84 123 4567";

    const textoItens = (v.itens || []).map(item => {
        const ehFrac = item.unidade === "kg" || item.unidade === "litro" || item.unidade === "g";
        const qtdTxt = ehFrac ? `${numero(item.quantidade).toFixed(3)} ${item.unidade}` : `${numero(item.quantidade)} ${item.unidade || "un"}`;
        return `• *${item.nome}* (${qtdTxt}) = ${dinheiro(item.subtotal)}`;
    }).join("\n");

    const mensagem = encodeURIComponent(
        `🧾 *${nomeEmpresa.toUpperCase()}*\n` +
        `📍 ${emp.endereco || "Moçambique"} | Tel: ${telEmpresa}\n` +
        `🆔 NUIT da Empresa: *${nuitEmpresa}*\n` +
        `----------------------------------------\n` +
        `📄 *RECIBO DE VENDA:* #${v.id}\n` +
        `📅 *Data:* ${dataTexto(v.data)}\n` +
        `👤 *Cliente:* ${v.cliente || "Consumidor Final"}\n` +
        `🆔 *NUIT Cliente:* ${v.nuitCliente || "Consumidor Final"}\n` +
        `👨‍💼 *Operador:* ${v.operadorNome || "Balcão"}\n` +
        `----------------------------------------\n` +
        `*ARTIGOS:*\n${textoItens}\n` +
        `----------------------------------------\n` +
        `💰 *TOTAL PAGO:* ${dinheiro(v.total)}\n` +
        `💳 *Método de Pagamento:* ${v.pagamento || "Dinheiro"}\n` +
        `----------------------------------------\n` +
        `✨ _${emp.rodapeRecibo || "Obrigado pela preferência! Volte sempre."}_\n` +
        `_Emitido via FABEF Gestão ERP PRO_`
    );
    window.open(`https://wa.me/?text=${mensagem}`, "_blank");
};

/* =====================================================
   EXPORTAÇão DE INVENTÁRIO CSV
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
   MÓDULO LÓGICO: GESTão DE FORNECEDORES
===================================================== */

document.getElementById("btn-adicionar-fornecedor").addEventListener("click", adicionarFornecedor);


async function adicionarFornecedor() {
    const ehGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    if (!ehGerente && !window.FABEF?.isDemoMode) {
        alert("Operação negada: Funcionário não regista fornecedor, isso é do gerente.");
        return;
    }

    const idCustom = document.getElementById("fornecedor-id")?.value.trim() || "";
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
            criadoPor: FABEF.user?.uid || FABEF.userData?.uid || "admin",
            data: new Date().toISOString(),
            criadoEm: serverTimestamp()
        };
        if (idCustom) payload.idPersonalizado = idCustom;

        const ref = await addDoc(subRef("fornecedores"), payload);

        // Alimenta de forma síncrona a cache interna local
        FABEF.fornecedores.push({
            id: ref.id,
            idPersonalizado: payload.idPersonalizado || ref.id,
            nome: payload.nome,
            telefone: payload.telefone,
            observacao: payload.observacao,
            divida: payload.divida,
            ramo: payload.ramo,
            data: payload.data
        });

        // Limpa os elementos de texto do formulário
        if (document.getElementById("fornecedor-id")) document.getElementById("fornecedor-id").value = "";
        document.getElementById("fornecedor-nome").value = "";
        document.getElementById("fornecedor-telefone").value = "";
        document.getElementById("fornecedor-observacao").value = "";
        if (document.getElementById("fornecedor-divida")) document.getElementById("fornecedor-divida").value = "";

        renderFornecedores();

        await gravarAuditoria("Adicionou o fornecedor: " + nome + (idCustom ? " (ID: " + idCustom + ")" : ""), "INFO");
        alert("Fornecedor guardado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao guardar o fornecedor:\n" + mensagemFirebase(error));
    }
}

window.apagarFornecedor = async function(id, nome) {
    const ehGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    if (!ehGerente && !window.FABEF?.isDemoMode) {
        alert("Operação negada: Apenas o gerente pode apagar fornecedores.");
        return;
    }
    const f = FABEF.fornecedores.find(x => x.id === id);
    if (!f) return;
    if (!confirm(`Deseja apagar definitivamente o fornecedor "${nome || f.nome}"?`)) return;

    try {
        await deleteDoc(subRef("fornecedores", id));
        FABEF.fornecedores = FABEF.fornecedores.filter(x => x.id !== id);
        renderFornecedores();
        await gravarAuditoria("Eliminou o fornecedor: " + (nome || f.nome), "INFO");
        alert("Fornecedor eliminado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao eliminar fornecedor:\n" + mensagemFirebase(error));
    }
};

function renderFornecedores() {
    const tabelaCorpo = document.getElementById("tabela-fornecedores");
    if (!tabelaCorpo) return;

    const ehGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    // Fornecedores isolados para o respetivo ramo (não mistura fornecedores)
    const fornecedoresDoRamo = (FABEF.fornecedores || []).filter(f => !f.ramo || f.ramo === FABEF.ramo);

    tabelaCorpo.innerHTML = fornecedoresDoRamo.map(f => {
        const divida = numero(f.divida);
        const compras = (FABEF.compras || []).filter(c => (!c.ramo || c.ramo === FABEF.ramo) && (c.fornecedorNome || "").toLowerCase() === (f.nome || "").toLowerCase());
        return `
    <tr>
        <td>
            <strong>${escapeHTML(f.nome)}</strong>
            ${f.idPersonalizado ? `<br><small style="color:#64748b;font-size:11px;">ID: ${escapeHTML(f.idPersonalizado)}</small>` : ""}
        </td>
        <td>${escapeHTML(f.telefone || "—")}</td>
        <td>${escapeHTML(f.observacao || "—")}</td>
        <td style="color:${divida > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(divida)}</td>
        <td>${compras.length}</td>
        <td>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="btn btn-light btn-small" type="button" onclick="verComprasFornecedor('${escapeHTML(f.nome)}')">📦 Compras</button>
                <button class="btn btn-light btn-small" type="button" onclick="amortizarDividaFornecedorPrompt('${escapeHTML(f.id)}','${escapeHTML(f.nome)}')" ${divida > 0 ? '' : 'disabled'}>💳 Pagar</button>
                ${ehGerente ? `
                    <button class="btn btn-light btn-small" type="button" style="color:#ef4444;" onclick="apagarFornecedor('${escapeHTML(f.id)}','${escapeHTML(f.nome)}')">🗑️ Apagar</button>
                ` : ''}
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
   MÓDULO LÓGICO: GESTão DE CLIENTES
===================================================== */

document.getElementById("btn-adicionar-cliente").addEventListener("click", adicionarCliente);


function guardarClientesLocalmente() {
    try {
        if (!FABEF.empresaId) return;
        localStorage.setItem("fabef_local_clientes_" + FABEF.empresaId, JSON.stringify(FABEF.clientes || []));
    } catch (e) {
        console.warn("Erro ao salvar clientes localmente:", e);
    }
}

function guardarDividasLocalmente() {
    try {
        if (!FABEF.empresaId) return;
        localStorage.setItem("fabef_local_dividas_" + FABEF.empresaId, JSON.stringify(FABEF.dividas || []));
    } catch (e) {
        console.warn("Erro ao salvar dividas localmente:", e);
    }
}

async function adicionarCliente() {
    let perfilAtual = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfilAtual = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfilAtual = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }

    if (perfilAtual === "gerente") {
        alert("🔒 Acesso Restrito:\n\nO Gerente não tem permissão para registar clientes. Esta missão é exclusiva dos Funcionários no atendimento.");
        return;
    }

    const idCustom = document.getElementById("cliente-id")?.value.trim() || "";
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

    const payload = {
        nome: nome,
        telefone: telefone,
        endereco: endereco,
        observacao: observacao,
        ramo: FABEF.ramo || "Geral",
        criadoPor: FABEF.user?.uid || FABEF.userData?.uid || "admin",
        data: new Date().toISOString(),
        criadoEm: serverTimestamp()
    };
    if (idCustom) payload.idPersonalizado = idCustom;

    let docId = "cli_" + Date.now();
    let salvoNuvem = false;

    try {
        const ref = await addDoc(subRef("clientes"), payload);
        docId = ref.id;
        salvoNuvem = true;
    } catch (error) {
        console.warn("Firebase offline ou regras restritas, a guardar cliente na memória do dispositivo:", error);
    }

    const novoCliente = {
        id: docId,
        idPersonalizado: payload.idPersonalizado || docId,
        nome: payload.nome,
        telefone: payload.telefone,
        endereco: payload.endereco,
        observacao: payload.observacao,
        ramo: payload.ramo,
        data: payload.data
    };
    FABEF.clientes.push(novoCliente);
    guardarClientesLocalmente();

    // Varre e reinicializa todos os campos de texto do cliente
    if (document.getElementById("cliente-id")) document.getElementById("cliente-id").value = "";
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

    await gravarAuditoria("Adicionou o cliente ao cadastro: " + nome + (idCustom ? " (ID: " + idCustom + ")" : ""), "INFO");
    alert("✅ Cliente guardado com sucesso!");
}

window.abrirModalEditarCliente = function(id) {
    const c = FABEF.clientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById("edit-cliente-id").value = c.id;
    if (document.getElementById("edit-cliente-id-custom")) {
        document.getElementById("edit-cliente-id-custom").value = c.idPersonalizado || c.id;
    }
    document.getElementById("edit-cliente-nome").value = c.nome || "";
    document.getElementById("edit-cliente-telefone").value = c.telefone || "";
    document.getElementById("edit-cliente-endereco").value = c.endereco || "";
    document.getElementById("edit-cliente-observacao").value = c.observacao || "";
    document.getElementById("modal-editar-cliente")?.classList.add("show");
};

async function salvarEdicaoCliente() {
    const id = document.getElementById("edit-cliente-id").value;
    const c = FABEF.clientes.find(x => x.id === id);
    if (!c) return;

    const nome = document.getElementById("edit-cliente-nome").value.trim();
    const idCustom = document.getElementById("edit-cliente-id-custom")?.value.trim() || "";
    const telefone = document.getElementById("edit-cliente-telefone").value.trim();
    const endereco = document.getElementById("edit-cliente-endereco")?.value.trim() || "";
    const observacao = document.getElementById("edit-cliente-observacao").value.trim();

    if (!nome) { alert("Introduza o nome do cliente."); return; }

    const payload = {
        idPersonalizado: idCustom,
        nome: nome,
        telefone: telefone,
        endereco: endereco,
        observacao: observacao,
        atualizadoEm: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "clientes", id), payload);
    } catch (error) {
        console.warn("Aviso Firebase ao atualizar cliente, salvando localmente:", error);
    }

    Object.assign(c, payload);
    delete c.atualizadoEm;
    guardarClientesLocalmente();
    renderClientes();
    fecharModal("modal-editar-cliente");
    await gravarAuditoria("Editou dados do cliente: " + nome + (idCustom ? " (ID: " + idCustom + ")" : ""), "INFO");
    alert("✅ Dados do cliente atualizados com sucesso.");
}

document.getElementById("btn-salvar-edicao-cliente")?.addEventListener("click", salvarEdicaoCliente);

function renderClientes() {
    const tabelaCorpo = document.getElementById("tabela-clientes");
    if (!tabelaCorpo) return;

    tabelaCorpo.innerHTML = FABEF.clientes.map(c => {
        const dividaCliente = FABEF.dividas.find(d => (d.cliente || "").toLowerCase() === (c.nome || "").toLowerCase());
        const saldo = numero(dividaCliente?.saldo);
        return `
    <tr>
        <td>
            <strong>${escapeHTML(c.nome)}</strong>
            ${c.idPersonalizado ? `<br><small style="color:#64748b;font-size:11px;">ID: ${escapeHTML(c.idPersonalizado)}</small>` : ""}
        </td>
        <td>${escapeHTML(c.telefone || "—")}</td>
        <td>${escapeHTML(c.endereco || "—")}</td>
        <td style="color:${saldo > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(saldo)}</td>
        <td>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="btn btn-light btn-small" type="button" onclick="verDetalheCliente('${escapeHTML(c.id)}')">👁️ Detalhes</button>
                <button class="btn btn-light btn-small" type="button" onclick="abrirModalEditarCliente('${escapeHTML(c.id)}')">✏️ Editar</button>
            </div>
        </td>
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
   MÓDULO LÓGICO: GESTão DE FIADO / DÍVIDAS COM BARREIRA DE CRÉDITO
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

        try {
            await updateDoc(doc(db, "empresas", FABEF.empresaId, "dividas", existente.id), {
                saldo: novoSaldo,
                atualizadoEm: serverTimestamp()
            });
        } catch (error) {
            console.warn("Aviso ao sincronizar dívida com Firebase, gravando na memória local:", error);
        }

        existente.saldo = novoSaldo;
    } else {
        const payload = {
            cliente: cliente,
            telefone: telefone || "",
            saldo: valor,
            limite: 0,
            ramo: FABEF.ramo || "Geral",
            data: new Date().toISOString(),
            criadoPor: FABEF.user?.uid || FABEF.userData?.uid || "admin",
            criadoEm: serverTimestamp()
        };

        let idGerado = "div_" + Date.now();
        try {
            const ref = await addDoc(subRef("dividas"), payload);
            idGerado = ref.id;
        } catch (error) {
            console.warn("Aviso ao salvar nova dívida no Firebase, gravando localmente:", error);
        }

        FABEF.dividas.push({
            id: idGerado,
            cliente: payload.cliente,
            telefone: payload.telefone,
            saldo: payload.saldo,
            limite: payload.limite,
            ramo: payload.ramo,
            data: payload.data
        });
    }

    guardarDividasLocalmente();
    renderDividas();
}


async function registarDivida() {
    let perfilAtual = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfilAtual = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfilAtual = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }

    if (perfilAtual === "gerente") {
        alert("🔒 Acesso Restrito:\n\nO Gerente não tem permissão para registar dívidas (fiado). Esta missão é exclusiva dos Funcionários no atendimento.");
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
                ramo: FABEF.ramo || "Geral",
                data: new Date().toISOString(), criadoPor: FABEF.user?.uid || FABEF.userData?.uid || "admin", criadoEm: serverTimestamp()
            };
            let idGerado = "div_" + Date.now();
            try {
                const ref = await addDoc(subRef("dividas"), payload);
                idGerado = ref.id;
            } catch (err) {
                console.warn("Aviso ao gravar dívida no Firebase:", err);
            }
            FABEF.dividas.push({ id: idGerado, cliente, telefone, saldo: valor, limite, ramo: payload.ramo, data: payload.data });
            guardarDividasLocalmente();
        } else {
            await registrarOuAtualizarDivida(cliente, telefone, valor);
        }

        // Limpa os campos do formulário após o registo bem-sucedido
        document.getElementById("divida-cliente").value = "";
        document.getElementById("divida-telefone").value = "";
        document.getElementById("divida-valor").value = "";
        const elLimite = document.getElementById("divida-limite");
        if (elLimite) elLimite.value = "";

        renderDividas();

        try {
            await gravarAuditoria("Registou uma nova dívida / fiado no valor de " + dinheiro(valor) + " para o cliente: " + cliente, "INFO");
        } catch (e) {}

        alert("✅ Dívida registada e conta corrente atualizada com sucesso.");

    } catch (error) {
        console.error("Erro ao processar conta corrente de fiado:", error);
        if (error.message && error.message.includes("limite de crédito")) {
            alert("⚠️ " + error.message);
        } else {
            alert("Não foi possível registar o fiado:\n" + (error.message || error));
        }
    }
}
/* =====================================================
   MÓDULO LÓGICO: RENDERIZAÇão DA CONTA CORRENTE DE FIADO (COMPLEMENTO)
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

        try {
            await updateDoc(doc(db, "empresas", FABEF.empresaId, "dividas", id), {
                saldo: novoSaldo,
                atualizadoEm: serverTimestamp()
            });
        } catch (errDb) {
            console.warn("Aviso ao amortizar no Firebase:", errDb);
        }

        devedor.saldo = novoSaldo;
        guardarDividasLocalmente();
        renderDividas();
        
        await gravarAuditoria("Amortizou o valor de " + dinheiro(quantia) + " na conta de: " + cliente, "INFO");
        alert("✅ Amortização de " + dinheiro(quantia) + " registada com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao abater a dívida:\n" + error.message);
    }
};


/* =====================================================
   MÓDULO LÓGICO: GESTão E FILTRAGEM DE ENCOMENDAS
===================================================== */

document.getElementById("btn-registar-encomenda")?.addEventListener("click", registarEncomenda);


async function registarEncomenda() {
    if (!window.FABEF?.isDemoMode && perfilFABEF() === "gerente") { alert("O Gerente não pode registar encomendas. Esta operação é exclusiva do Funcionário."); return; }
    if (limiteEncomendasDiariasAtingido()) {
        avisoLimiteAtingido(`Atingiu o limite diário de ${LIMITES_PLANO_GRATIS.encomendasDiarias} encomendas do plano grátis.`);
        return;
    }

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
            turnoId: FABEF.turnoId || null,
            diaOperacional: FABEF.dataAtiva,
            data: new Date().toISOString(),
            criadoPor: FABEF.user.uid,
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("encomendas"), payload);

        // O onSnapshot adiciona o registo à lista local; não duplicar aqui.

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
    const formulario = document.getElementById("encomenda-formulario");
    if (formulario) formulario.style.display = perfilFABEF() === "gerente" ? "none" : "";
    const tabelaCorpo = document.getElementById("tabela-encomendas");
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = FABEF.encomendas.filter(e => e.ramo === FABEF.ramo).map(e => {
        const valorTotal = numero(e.valorTotal);
        const valorPago = numero(e.valorPago);
        const valorRestante = Math.max(0, valorTotal - valorPago);

        let classeBadge = "badge-yellow";
        if (e.estado === "PRONTA") classeBadge = "badge-green";
        if (e.estado === "ENTREGUE") classeBadge = "badge-green";
        if (e.estado === "CANCELADA") classeBadge = "badge-red";

        let botoesAcao = "";
        if (e.estado === "PENDENTE") {
            botoesAcao = `<button class="btn btn-light btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','EM_PREPARACAO')" type="button">🛠️ Em preparação</button>`;
        } else if (e.estado === "EM_PREPARACAO") {
            botoesAcao = `<button class="btn btn-success btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','PRONTA')" type="button">✔️ Marcar pronta</button>`;
        } else if (e.estado === "PRONTA") {
            botoesAcao = `<button class="btn btn-danger btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','ENTREGUE')" type="button">📦 Entregar</button>`;
        } else {
            botoesAcao = `<span style="color:#64748b;font-size:12px;font-weight:600;">${e.estado === "CANCELADA" ? "Cancelada" : "Concluída"}</span>`;
        }

        if (e.estado !== "ENTREGUE" && e.estado !== "CANCELADA") {
            botoesAcao += `<button class="btn btn-success btn-small" onclick="enviarAvisoEncomenda('${escapeHTML(e.id)}')" type="button" style="background-color:#25d366;">📱 Lembrete</button>`;
            botoesAcao += `<button class="btn btn-small" onclick="abrirModalEncomendaFalhada('${escapeHTML(e.id)}')" type="button" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:600;" title="Cancelar encomenda com justificativa obrigatória ao Gerente">⚠️ Falhou / Cancelar</button>`;
        }

        return `<tr>
            <td>
                <strong>${escapeHTML(e.cliente)}</strong>${e.telefone ? `<br><small style="color:#64748b;">${escapeHTML(e.telefone)}</small>` : ""}
                ${e.justificativaGerente ? `
                    <div style="font-size:11px;color:#b91c1c;margin-top:2px;background:#fee2e2;padding:2px 6px;border-radius:4px;">
                        <strong>Justificativa ao Gerente:</strong> ${escapeHTML(e.justificativaGerente)}
                    </div>
                ` : ""}
            </td>
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
        FABEF.dataAtiva = new Date().toLocaleDateString("en-CA");
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

        aplicarFiltroDia();
        atualizarTelaCaixa();
        renderTudo();
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

        aplicarFiltroDia();
        atualizarTelaCaixa();
        renderTudo();
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
        const sangrias = (FABEF.turno?.sangrias || []).map(m => `<li style="color:#ef4444;">âˆ’ ${dinheiro(m.valor)} (Sangria) — ${escapeHTML(m.motivo)} — ${escapeHTML(m.operadorNome || "")}</li>`);
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
    const descricao = document.getElementById("despesa-descricao").value.trim();
    const valor = numero(document.getElementById("despesa-valor").value);
    const categoria = document.getElementById("despesa-categoria")?.value || "Operacional";

    if (!descricao || valor <= 0) {
        alert("Introduza uma descrição válida e um valor superior a zero.");
        return;
    }

    const payload = {
        descricao: descricao,
        valor: valor,
        categoria: categoria,
        ramo: FABEF.ramo || "Geral",
        utilizadorId: FABEF.user?.uid || "admin",
        utilizadorNome: FABEF.userData?.nome || FABEF.user?.email || "Administrador",
        data: new Date().toISOString(),
        criadoEm: serverTimestamp()
    };

    let docId = "desp_" + Date.now();
    try {
        const ref = await addDoc(subRef("despesas"), payload);
        docId = ref.id;
    } catch (error) {
        console.warn("Aviso Firebase ao registar despesa, mantendo em memória e offline:", error);
    }

    // Alimenta de forma síncrona a cache local na memória do navegador
    FABEF.despesas.push({
        id: docId,
        descricao: payload.descricao,
        valor: payload.valor,
        categoria: payload.categoria,
        ramo: payload.ramo,
        utilizadorNome: payload.utilizadorNome,
        data: payload.data
    });

    try {
        if (FABEF.empresaId) {
            localStorage.setItem("fabef_local_despesas_" + FABEF.empresaId, JSON.stringify(FABEF.despesas));
        }
    } catch(e) {}

    // Limpa os campos do formulário para o próximo lançamento
    document.getElementById("despesa-descricao").value = "";
    document.getElementById("despesa-valor").value = "";

    renderDespesas();

    // Regista a saída financeira nos logs inalteráveis de auditoria
    await gravarAuditoria(`Registou despesa/custo comercial (${payload.ramo}): ` + descricao + " no valor de " + dinheiro(valor), "INFO");
    alert("✅ Despesa/Custo registado com sucesso para " + (FABEF.ramo || "o negócio") + ".");
}


function renderDespesas() {
    const tabelaCorpo = document.getElementById("tabela-despesas");
    if (!tabelaCorpo) return;

    // Filtra pelo ramo de atividade ativo
    const listaDoRamo = (FABEF.despesas || []).filter(d => !d.ramo || d.ramo === FABEF.ramo);

    // Ordena as despesas de forma decrescente pela data de lançamento
    const listaOrdenada = listaDoRamo
        .slice()
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    tabelaCorpo.innerHTML = listaOrdenada.map(d => `
    <tr>
        <td>${dataTexto(d.data)}</td>
        <td>
            <strong>${escapeHTML(d.descricao)}</strong>
            ${d.categoria ? `<br><small style="color:#0284c7;font-size:11px;">${escapeHTML(d.categoria)}</small>` : ""}
        </td>
        <td style="color: #dc2626; font-weight: 700;">${dinheiro(d.valor)}</td>
        <td>${escapeHTML(d.utilizadorNome || "—")}</td>
        <td><span class="badge badge-blue">${escapeHTML(d.ramo || FABEF.ramo || "—")}</span></td>
    </tr>
    `).join("") || `
    <tr>
        <td colspan="5" style="text-align: center; color: #64748b;">
            Nenhuma despesa ou custo registado para o ramo: ${escapeHTML(FABEF.ramo || "Geral")}.
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

    // Soma quantos kg/litros foram vendidos no período (produtos vendidos a peso/volume)
    let kgPeriodo = 0, litroPeriodo = 0;
    vendasFiltradas.forEach(v => (v.itens || []).forEach(item => {
        if (item.unidade === "kg") kgPeriodo += numero(item.quantidade);
        if (item.unidade === "litro") litroPeriodo += numero(item.quantidade);
    }));
    const painelKgRelatorio = document.getElementById("rel-kg-vendidos");
    if (painelKgRelatorio) {
        const partes = [];
        if (kgPeriodo > 0) partes.push(`${kgPeriodo.toFixed(2)} kg`);
        if (litroPeriodo > 0) partes.push(`${litroPeriodo.toFixed(2)} L`);
        painelKgRelatorio.textContent = partes.length ? partes.join(" + ") : "0 kg";
    }

    // Guarda o relatório atual em memória para as funções de exportação (PDF/Word/WhatsApp)
    FABEF_RELATORIO_ATUAL = {
        periodo: periodo === "hoje" ? "Hoje" : periodo === "7" ? "Últimos 7 dias" : periodo === "30" ? "Últimos 30 dias" : "Todo o período",
        faturamento, totalDespesas, resultado, kgPeriodo, litroPeriodo,
        numVendas: vendasFiltradas.length
    };

    // Curva ABC e Análise Inteligente são funcionalidades avançadas —
    // só disponíveis no Plano Pago (ou durante o período de teste).
    const planoRelatorios = obterPlanoAtual();
    const avisoAvancado = document.getElementById("aviso-relatorios-avancados");
    if (planoRelatorios === "GRATIS") {
        if (avisoAvancado) avisoAvancado.innerHTML = `<div class="alert alert-warning">🔒 A Curva ABC e a Análise Inteligente são funcionalidades do Plano Pago. <button class="btn btn-success btn-small" type="button" onclick="mostrarSecao('subscricao')">⭐ Atualizar por 250 MT</button></div>`;
        document.getElementById("tabela-abc").innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">Disponível no Plano Pago.</td></tr>`;
        document.getElementById("analise-inteligente").innerHTML = "";
    } else {
        if (avisoAvancado) avisoAvancado.innerHTML = "";
        // Invoca o motor matemático da Curva ABC de produtos baseado nas vendas filtradas
        renderABC(vendasFiltradas);
        // Análise inteligente adicional
        renderAnaliseInteligente(vendasFiltradas, despesasFiltradas);
    }
}

let FABEF_RELATORIO_ATUAL = null;

/* =====================================================
   MÓDULO LÓGICO: EXPORTAÇão DE RELATÓRIOS
===================================================== */
function textoResumoRelatorio() {
    if (!FABEF_RELATORIO_ATUAL) return "";
    const r = FABEF_RELATORIO_ATUAL;
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    let texto = `📊 Relatório — ${nomeEmpresa} (${escapeHTML(FABEF.ramo)})\n`;
    texto += `Período: ${r.periodo}\n\n`;
    texto += `Faturamento: ${dinheiro(r.faturamento)}\n`;
    texto += `Despesas: ${dinheiro(r.totalDespesas)}\n`;
    texto += `Resultado: ${dinheiro(r.resultado)}\n`;
    texto += `Número de vendas: ${r.numVendas}\n`;
    if (r.kgPeriodo > 0) texto += `Total vendido em kg: ${r.kgPeriodo.toFixed(2)} kg\n`;
    if (r.litroPeriodo > 0) texto += `Total vendido em litros: ${r.litroPeriodo.toFixed(2)} L\n`;
    return texto;
}

window.enviarRelatorioWhatsApp = function() {
    if (!FABEF_RELATORIO_ATUAL) { alert("Aguarde o relatório carregar."); return; }
    const mensagem = encodeURIComponent(textoResumoRelatorio());
    window.open(`https://wa.me/?text=${mensagem}`, "_blank");
};

window.exportarRelatorioPDF = function() {
    if (!FABEF_RELATORIO_ATUAL) { alert("Aguarde o relatório carregar."); return; }
    const r = FABEF_RELATORIO_ATUAL;
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    const relatorioHtml = `<html><head><title>Relatório - ${escapeHTML(nomeEmpresa)}</title>
    <style>body{font-family:Arial;padding:24px;color:#0f172a;} h2{margin-bottom:4px;} table{width:100%;border-collapse:collapse;margin-top:14px;} td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;}</style>
    </head><body>
    <h2>${escapeHTML(nomeEmpresa)}</h2>
    <p>Ramo: ${escapeHTML(FABEF.ramo)} | Período: ${escapeHTML(r.periodo)}</p>
    <table>
        <tr><td><strong>Faturamento</strong></td><td>${dinheiro(r.faturamento)}</td></tr>
        <tr><td><strong>Despesas</strong></td><td>${dinheiro(r.totalDespesas)}</td></tr>
        <tr><td><strong>Resultado</strong></td><td>${dinheiro(r.resultado)}</td></tr>
        <tr><td><strong>Número de vendas</strong></td><td>${r.numVendas}</td></tr>
        ${r.kgPeriodo > 0 ? `<tr><td><strong>Total vendido em kg</strong></td><td>${r.kgPeriodo.toFixed(2)} kg</td></tr>` : ""}
        ${r.litroPeriodo > 0 ? `<tr><td><strong>Total vendido em litros</strong></td><td>${r.litroPeriodo.toFixed(2)} L</td></tr>` : ""}
    </table>
    <p style="margin-top:20px;color:#64748b;font-size:12px;">Gerado pelo FABEF Gestão ERP PRO</p>
    <script>window.print();<\/script>
    </body></html>`;

    let janela = null;
    try {
        janela = window.open("", "_blank");
    } catch (e) {
        janela = null;
    }
    if (janela) {
        janela.document.write(relatorioHtml);
        janela.document.close();
    } else {
        let printIframe = document.getElementById("print-fallback-frame");
        if (!printIframe) {
            printIframe = document.createElement("iframe");
            printIframe.id = "print-fallback-frame";
            printIframe.style.display = "none";
            document.body.appendChild(printIframe);
        }
        printIframe.contentWindow.document.open();
        printIframe.contentWindow.document.write(relatorioHtml);
        printIframe.contentWindow.document.close();
        setTimeout(() => {
            try {
                printIframe.contentWindow.focus();
                printIframe.contentWindow.print();
            } catch (err) {
                alert("Aviso: Janela pop-up bloqueada. Utilize o botão 'Word' para descarregar o relatório.");
            }
        }, 500);
    }
};

window.exportarRelatorioWord = function() {
    if (!FABEF_RELATORIO_ATUAL) { alert("Aguarde o relatório carregar."); return; }
    const r = FABEF_RELATORIO_ATUAL;
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    const html = `<html><head><meta charset="utf-8"></head><body>
    <h2>${escapeHTML(nomeEmpresa)}</h2>
    <p>Ramo: ${escapeHTML(FABEF.ramo)} | Período: ${escapeHTML(r.periodo)}</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;">
        <tr><td><b>Faturamento</b></td><td>${dinheiro(r.faturamento)}</td></tr>
        <tr><td><b>Despesas</b></td><td>${dinheiro(r.totalDespesas)}</td></tr>
        <tr><td><b>Resultado</b></td><td>${dinheiro(r.resultado)}</td></tr>
        <tr><td><b>Número de vendas</b></td><td>${r.numVendas}</td></tr>
        ${r.kgPeriodo > 0 ? `<tr><td><b>Total vendido em kg</b></td><td>${r.kgPeriodo.toFixed(2)} kg</td></tr>` : ""}
        ${r.litroPeriodo > 0 ? `<tr><td><b>Total vendido em litros</b></td><td>${r.litroPeriodo.toFixed(2)} L</td></tr>` : ""}
    </table>
    </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${FABEF.ramo.replace(/[^a-zA-Z0-9]/g, "_")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


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
                    faturamento: 0,
                    unidade: item.unidade || "unidade"
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
         CLASSIFICAÇão DE PARETO:
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
            <td>${x.quantidade}${x.unidade && x.unidade !== "unidade" ? " " + escapeHTML(x.unidade) : ""}</td>
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
   MÓDULO LÓGICO: CONFIGURAÇÕES INDEPENDENTES POR RAMO & NEGÓCIO
===================================================== */

let ramoSendoConfigurado = null;

function obterConfiguracaoRamo(ramoNome) {
    const r = ramoNome || FABEF.ramo || "Comércio Geral";
    const ramosConfigs = FABEF.empresa?.ramos_configuracoes || {};
    const configEspecifica = ramosConfigs[r];
    if (configEspecifica) {
        return {
            idPersonalizado: configEspecifica.idPersonalizado || "",
            nome: configEspecifica.nome || r,
            nuit: configEspecifica.nuit !== undefined ? configEspecifica.nuit : (FABEF.empresa?.nuit || ""),
            telefone: configEspecifica.telefone !== undefined ? configEspecifica.telefone : (FABEF.empresa?.telefone || ""),
            endereco: configEspecifica.endereco !== undefined ? configEspecifica.endereco : (FABEF.empresa?.endereco || ""),
            cidade: configEspecifica.cidade !== undefined ? configEspecifica.cidade : (FABEF.empresa?.cidade || ""),
            ivaRegime: configEspecifica.ivaRegime || "ISENTO",
            ivaTaxa: configEspecifica.ivaTaxa !== undefined ? configEspecifica.ivaTaxa : 0,
            rodapeRecibo: configEspecifica.rodapeRecibo || "Obrigado pela sua preferência! Volte sempre.",
            ramo: r
        };
    }

    // Se este ramo for exatamente o ramo onde a empresa foi configurada originalmente:
    const nomePadrao = (r === (FABEF.empresa?.ramo_ativo || FABEF.empresa?.ramo_principal) && FABEF.empresa?.nome)
        ? FABEF.empresa.nome
        : r;

    return {
        idPersonalizado: FABEF.empresa?.idPersonalizado || "",
        nome: nomePadrao,
        nuit: FABEF.empresa?.nuit || "",
        telefone: FABEF.empresa?.telefone || "",
        endereco: FABEF.empresa?.endereco || "",
        cidade: FABEF.empresa?.cidade || "",
        ivaRegime: FABEF.empresa?.ivaRegime || "ISENTO",
        ivaTaxa: FABEF.empresa?.ivaTaxa !== undefined ? FABEF.empresa?.ivaTaxa : 0,
        rodapeRecibo: FABEF.empresa?.rodapeRecibo || "Obrigado pela sua preferência! Volte sempre.",
        ramo: r
    };
}
window.obterConfiguracaoRamo = obterConfiguracaoRamo;

function renderConfiguracoes() {
    const ramosDisponiveis = obterConfigRamos();
    const seletorRamo = document.getElementById("config-seletor-ramo");

    if (!ramoSendoConfigurado || !ramosDisponiveis.some(r => r.nome === ramoSendoConfigurado)) {
        ramoSendoConfigurado = FABEF.ramo || (ramosDisponiveis[0] ? ramosDisponiveis[0].nome : "Comércio Geral");
    }

    // Desenha as abas visuais de todos os negócios cadastrados para seleção rápida
    const tabsBar = document.getElementById("config-ramos-tabs-bar");
    if (tabsBar) {
        tabsBar.innerHTML = ramosDisponiveis.map(r => {
            const isCurrentConfig = r.nome === ramoSendoConfigurado;
            const isOperacionalAtivo = r.nome === FABEF.ramo;
            const cfg = (FABEF.empresa?.ramos_configuracoes || {})[r.nome] || {};
            const nomeExibicao = cfg.nome || r.nome;
            const icone = r.icone || "🏬";

            return `
            <button 
                type="button" 
                class="btn btn-small" 
                onclick="selecionarRamoParaConfigurar('${escapeHTML(r.nome)}')"
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    padding:9px 15px;
                    border-radius:10px;
                    font-weight:700;
                    cursor:pointer;
                    transition:all 0.15s ease;
                    border: 2px solid ${isCurrentConfig ? '#2563eb' : '#cbd5e1'};
                    background: ${isCurrentConfig ? '#eff6ff' : '#ffffff'};
                    color: ${isCurrentConfig ? '#1d4ed8' : '#334155'};
                    box-shadow: ${isCurrentConfig ? '0 2px 5px rgba(37,99,235,0.18)' : 'none'};
                "
            >
                <span style="font-size:18px;">${icone}</span>
                <span>${escapeHTML(nomeExibicao)}</span>
                ${isOperacionalAtivo ? '<span class="badge badge-green" style="font-size:10px;padding:2px 6px;">ATIVO</span>' : ''}
            </button>
            `;
        }).join("");
    }

    if (seletorRamo) {
        seletorRamo.innerHTML = ramosDisponiveis.map(r => {
            const ehAtivo = r.nome === FABEF.ramo;
            return `<option value="${escapeHTML(r.nome)}">${escapeHTML(r.nome)}${ehAtivo ? ' (Ramo Ativo)' : ''}</option>`;
        }).join("");
        seletorRamo.value = ramoSendoConfigurado;
    }

    const badgeRamoAtivo = document.getElementById("config-badge-ramo-ativo");
    if (badgeRamoAtivo) {
        const ehAtivo = (ramoSendoConfigurado === FABEF.ramo);
        badgeRamoAtivo.textContent = ehAtivo ? "✅ Ramo Ativo Agora" : "📁 Outro Negócio da Pasta";
        badgeRamoAtivo.className = ehAtivo ? "badge badge-green" : "badge badge-yellow";
    }

    const displayNomeRamo = document.getElementById("config-nome-ramo-display");
    if (displayNomeRamo) displayNomeRamo.textContent = ramoSendoConfigurado;

    const spanRamoAtivo = document.getElementById("config-ramo-ativo-nome");
    if (spanRamoAtivo) spanRamoAtivo.textContent = ramoSendoConfigurado;

    const config = obterConfiguracaoRamo(ramoSendoConfigurado);

    const nomeInput = document.getElementById("config-nome");
    const nuitInput = document.getElementById("config-nuit");
    const telInput = document.getElementById("config-telefone");
    const endInput = document.getElementById("config-endereco");
    const cidInput = document.getElementById("config-cidade");
    const idEmpresaInput = document.getElementById("config-id-empresa") || document.getElementById("config-id");
    const ivaRegimeInput = document.getElementById("config-iva-regime");
    const ivaTaxaInput = document.getElementById("config-iva-taxa");
    const rodapeInput = document.getElementById("config-rodape");

    if (idEmpresaInput) idEmpresaInput.value = config.idPersonalizado || "";
    if (nomeInput) nomeInput.value = config.nome || "";
    if (nuitInput) nuitInput.value = config.nuit || "";
    if (telInput) telInput.value = config.telefone || "";
    if (endInput) endInput.value = config.endereco || "";
    if (cidInput) cidInput.value = config.cidade || "";
    if (ivaRegimeInput) ivaRegimeInput.value = config.ivaRegime || "ISENTO";
    if (ivaTaxaInput) ivaTaxaInput.value = config.ivaTaxa !== undefined ? config.ivaTaxa : 0;
    if (rodapeInput) rodapeInput.value = config.rodapeRecibo || "";

    const badgePin = document.getElementById("config-pin-estado");
    if (badgePin) {
        const uid = FABEF.user?.uid;
        const temPin = uid && localStorage.getItem(chavePinLocal(uid));
        if (temPin) {
            badgePin.textContent = "🟢 PIN ATIVO E PROTEGIDO";
            badgePin.style.color = "#16a34a";
        } else {
            badgePin.textContent = "🟠 PIN AINDA NÃO DEFINIDO";
            badgePin.style.color = "#ea580c";
        }
    }
}

window.selecionarRamoParaConfigurar = function(ramoNome) {
    ramoSendoConfigurado = ramoNome;
    renderConfiguracoes();
};

document.getElementById("btn-ativar-este-ramo")?.addEventListener("click", () => {
    const ramo = ramoSendoConfigurado || FABEF.ramo;
    if (ramo) {
        mudarRamo(ramo);
        renderConfiguracoes();
        alert(`🚀 O negócio ativo foi alterado para "${ramo}"!\nTodas as telas, vendas, produtos e recibos agora pertencem a este negócio.`);
    }
});

document.getElementById("config-seletor-ramo")?.addEventListener("change", (e) => {
    ramoSendoConfigurado = e.target.value;
    renderConfiguracoes();
});

document.getElementById("btn-copiar-dados-empresa")?.addEventListener("click", () => {
    const emp = FABEF.empresa || {};
    if (emp.nuit) document.getElementById("config-nuit").value = emp.nuit;
    if (emp.telefone) document.getElementById("config-telefone").value = emp.telefone;
    if (emp.endereco) document.getElementById("config-endereco").value = emp.endereco;
    if (emp.cidade) document.getElementById("config-cidade").value = emp.cidade;
    alert("📋 Dados gerais preenchidos. Ajuste o nome e os campos necessários deste ramo e clique em 'Guardar'.");
});

document.getElementById("btn-guardar-config").addEventListener("click", guardarConfiguracoes);
document.getElementById("btn-alterar-pin")?.addEventListener("click", () => {
    if (FABEF.user?.uid) configurarNovoPin(FABEF.user.uid);
});

async function guardarConfiguracoes() {
    if (!ehUsuarioGerente()) {
        alert("Apenas o Gerente pode aceder e alterar as configurações.");
        return;
    }
    const ramo = ramoSendoConfigurado || FABEF.ramo || "Comércio Geral";
    const idPersonalizado = (document.getElementById("config-id-empresa") || document.getElementById("config-id"))?.value.trim() || "";
    const nome = document.getElementById("config-nome")?.value.trim() || "";
    const nuit = document.getElementById("config-nuit")?.value.trim() || "";
    const telefone = document.getElementById("config-telefone")?.value.trim() || "";
    const endereco = document.getElementById("config-endereco")?.value.trim() || "";
    const cidade = document.getElementById("config-cidade")?.value.trim() || "";
    const ivaRegime = document.getElementById("config-iva-regime")?.value || "ISENTO";
    const ivaTaxa = numero(document.getElementById("config-iva-taxa")?.value);
    const rodapeRecibo = document.getElementById("config-rodape")?.value.trim() || "";

    if (!nome) {
        alert("O nome do negócio para este ramo é um campo de preenchimento obrigatório.");
        return;
    }

    if (!FABEF.empresa) FABEF.empresa = {};
    if (!FABEF.empresa.ramos_configuracoes) FABEF.empresa.ramos_configuracoes = {};

    const dadosRamo = {
        idPersonalizado,
        nome,
        nuit,
        telefone,
        endereco,
        cidade,
        ivaRegime,
        ivaTaxa,
        rodapeRecibo,
        ramo,
        atualizadoEm: new Date().toISOString()
    };

    FABEF.empresa.ramos_configuracoes[ramo] = dadosRamo;

    // Se estiver a configurar o ramo atualmente em operação, atualiza os dados ativos
    if (ramo === FABEF.ramo) {
        FABEF.empresa.nome = nome;
        FABEF.empresa.telefone = telefone;
        FABEF.empresa.endereco = endereco;
        FABEF.empresa.cidade = cidade;
        FABEF.empresa.nuit = nuit;
        FABEF.empresa.ivaRegime = ivaRegime;
        FABEF.empresa.ivaTaxa = ivaTaxa;
        FABEF.empresa.rodapeRecibo = rodapeRecibo;
        FABEF.empresa.idPersonalizado = idPersonalizado;
    }

    try {
        localStorage.setItem("fabef_empresa_cache", JSON.stringify(FABEF.empresa));
    } catch (e) {}

    renderTudo();
    renderConfiguracoes();

    if (window.FABEF?.isDemoMode) {
        alert(`✅ Configurações do ramo "${ramo}" guardadas com sucesso!`);
        return;
    }

    try {
        await updateDoc(empresaRef(), {
            ramos_configuracoes: FABEF.empresa.ramos_configuracoes,
            ...(ramo === FABEF.ramo ? {
                nome: nome,
                nuit: nuit,
                telefone: telefone,
                endereco: endereco,
                cidade: cidade,
                ivaRegime: ivaRegime,
                ivaTaxa: ivaTaxa,
                rodapeRecibo: rodapeRecibo,
                idPersonalizado: idPersonalizado
            } : {}),
            atualizadoEm: serverTimestamp()
        });

        await gravarAuditoria(`Actualizou as configurações específicas do ramo "${ramo}" (${nome}).`, "INFO");
        alert(`✅ Configurações do ramo "${ramo}" guardadas com sucesso na nuvem e no dispositivo.`);
    } catch (error) {
        console.warn("Aviso ao guardar na nuvem:", error);
        alert(`✅ Configurações do ramo "${ramo}" guardadas no dispositivo com sucesso.\n(Nota: Dados gravados com segurança localmente).`);
    }
}


/* =====================================================
   MÓDULO LÓGICO: RENDERS E INDICADORES DO DASHBOARD (INÍCIO)
===================================================== */

/* =====================================================
   GESTão DE FUNCIONÁRIOS / UTILIZADORES
===================================================== */

async function cadastrarNovoFuncionario() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") { alert("Apenas o gerente pode cadastrar funcionários."); return; }

    // Limite depende do plano: Grátis = 1 funcionário; Pago/Teste = 2 funcionários
    // (3 utilizadores no total, incluindo o gerente). A partir do 3Âº
    // funcionário, é preciso pagar uma taxa extra de 20% por cada um.
    const plano = obterPlanoAtual();
    const limiteBase = plano === "GRATIS" ? LIMITES_PLANO_GRATIS.funcionarios : 2;
    const funcionariosAtivos = (FABEF.funcionarios || []).filter(f => (f.estado || "ATIVO") === "ATIVO").length;

    if (plano === "GRATIS" && funcionariosAtivos >= limiteBase) {
        avisoLimiteAtingido(`O Plano Grátis inclui apenas ${limiteBase} funcionário.`);
        return;
    }

    if (funcionariosAtivos >= limiteBase) {
        alert(
            `O seu plano atual inclui até ${limiteBase} funcionários (${limiteBase + 1} utilizadores no total, incluindo o gerente).\n\n` +
            "Para adicionar mais um funcionário, é necessária uma taxa adicional de 20% do valor da subscrição por cada funcionário extra.\n\n" +
            "Contacte o suporte para ativar esta funcionário extra na sua subscrição antes de continuar."
        );
        return;
    }

    const nome=document.getElementById("func-nome")?.value.trim();
    const email=document.getElementById("func-email")?.value.trim();
    const telefone=document.getElementById("func-telefone")?.value.trim();
    const ramoFunc=document.getElementById("func-ramo")?.value || FABEF.ramo || "";
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
        const perfil={uid:uidFuncionario,nome,email,telefone,foto,ramo:ramoFunc,empresaId:FABEF.empresaId,perfil:"funcionario",role:"operador",estado:"ATIVO",criadoPor:FABEF.user.uid,criadoEm:serverTimestamp()};
        await setDoc(doc(db,"utilizadores",uidFuncionario),perfil);
        await setDoc(doc(db,"empresas",FABEF.empresaId,"funcionarios",uidFuncionario),perfil);
        if (ramoFunc === FABEF.ramo) {
            FABEF.funcionarios.push({id:uidFuncionario,...perfil});
        }
        ["func-nome","func-email","func-telefone","func-senha","func-foto"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
        renderFuncionarios();
        await gravarAuditoria(`Cadastrou um novo funcionário na equipa: ${nome} (${email}) no ramo ${ramoFunc}`,"INFO");
        alert("Funcionário cadastrado com sucesso para o ramo: " + ramoFunc);
    } catch(error) { console.error(error); alert("Não foi possível criar a conta do funcionário:\n"+mensagemFirebase(error)); }
    finally { if(secondaryApp){ try{await deleteApp(secondaryApp);}catch(e){} } }
}

function renderFuncionarios(){
    const tabela = document.getElementById("tabela-funcionarios");
    if (!tabela) return;

    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    const gerenteId = "gerente_" + (FABEF.user?.uid || "admin");
    const gastosGerente = (FABEF.gastosFuncionarios || []).filter(g => g.funcionarioId === gerenteId || g.funcionarioId === (FABEF.user?.uid || "gerente") || g.funcionarioId?.startsWith("gerente"));
    const totalGastosGerente = gastosGerente.reduce((s, g) => s + numero(g.valor), 0);

    const acoesGerente = souGerente ? `
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn-small" type="button" onclick="abrirModalAdiantamentoSalarial('${escapeHTML(gerenteId)}')" style="background:#059669;color:#fff;font-weight:700;border:none;padding:5px 8px;border-radius:6px;cursor:pointer;" title="Registar adiantamento salarial (vale) do Gerente">💸 Vale</button>
            <button class="btn btn-warning btn-small" type="button" onclick="abrirModalGastoFuncionario('${escapeHTML(gerenteId)}')" style="background:#f59e0b;color:#fff;font-weight:700;border:none;padding:5px 8px;border-radius:6px;cursor:pointer;" title="Adicionar outros gastos ou vales do Gerente">➕ Gasto</button>
        </div>` : "—";

    const gerente = `
        <tr style="background:#f8fafc;">
            <td><strong>${escapeHTML(FABEF.userData?.nome || "Gerente Principal")}</strong></td>
            <td>${escapeHTML(FABEF.user?.email || "—")}</td>
            <td>${escapeHTML(FABEF.empresa?.telefone || "—")}</td>
            <td><span class="badge" style="background:#0284c7;color:#fff;">Todos os Ramos</span></td>
            <td><span class="badge badge-green" style="background-color:#0f172a;color:#fff;">GERENTE</span></td>
            <td>
                <strong style="${totalGastosGerente > 0 ? 'color:#b45309;' : 'color:#64748b;'}">${dinheiro(totalGastosGerente)}</strong>
                ${gastosGerente.length > 0 ? `<small style="display:block;color:#64748b;font-size:11px;">(${gastosGerente.length} registo${gastosGerente.length > 1 ? 's' : ''})</small>` : ''}
            </td>
            <td><span class="badge badge-green">ATIVO</span></td>
            <td>${acoesGerente}</td>
        </tr>`;

    // Mostra os funcionários do ramo ou todos da empresa se for Gerente
    const listaFuncionarios = (FABEF.funcionarios || []).filter(f => souGerente || !f.ramo || f.ramo === FABEF.ramo);

    const funcionarios = listaFuncionarios.map(f => {
        const ativo = (f.estado || "ATIVO") === "ATIVO";
        const gastosDoFunc = (FABEF.gastosFuncionarios || []).filter(g => g.funcionarioId === f.id);
        const totalGastos = gastosDoFunc.reduce((s, g) => s + numero(g.valor), 0);

        const acoes = souGerente ? `
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="btn btn-small" type="button" onclick="abrirModalAdiantamentoSalarial('${escapeHTML(f.id)}')" style="background:#059669;color:#fff;font-weight:700;border:none;padding:5px 8px;border-radius:6px;cursor:pointer;" title="Registar adiantamento salarial (vale)">💸 Vale</button>
                <button class="btn btn-warning btn-small" type="button" onclick="abrirModalGastoFuncionario('${escapeHTML(f.id)}')" style="background:#f59e0b;color:#fff;font-weight:700;border:none;padding:5px 8px;border-radius:6px;cursor:pointer;" title="Adicionar outros gastos ou vales na conta">➕ Gasto</button>
                <button class="btn btn-light btn-small" type="button" onclick="abrirEdicaoFuncionario('${escapeHTML(f.id)}')">✏️ Editar</button>
                <button class="btn ${ativo ? 'btn-danger' : 'btn-success'} btn-small" type="button" onclick="alternarEstadoFuncionario('${escapeHTML(f.id)}')">${ativo ? '🚫 Desativar' : '✅ Reativar'}</button>
            </div>` : "—";

        return `
        <tr>
            <td>${f.foto ? `<img src="${escapeHTML(f.foto)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none';">` : ""}<strong>${escapeHTML(f.nome || "—")}</strong></td>
            <td>${escapeHTML(f.email || "—")}</td>
            <td>${escapeHTML(f.telefone || "—")}</td>
            <td><span class="badge badge-blue">${escapeHTML(f.ramo || FABEF.ramo || "—")}</span></td>
            <td><span class="badge badge-yellow">OPERADOR</span></td>
            <td>
                <strong style="${totalGastos > 0 ? 'color:#b45309;' : 'color:#64748b;'}">${dinheiro(totalGastos)}</strong>
                ${gastosDoFunc.length > 0 ? `<small style="display:block;color:#64748b;font-size:11px;">(${gastosDoFunc.length} registo${gastosDoFunc.length > 1 ? 's' : ''})</small>` : ''}
            </td>
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
    const selectRamo = document.getElementById("edit-func-ramo");
    if (selectRamo) {
        selectRamo.value = f.ramo || FABEF.ramo;
    }
    document.getElementById("modal-editar-funcionario")?.classList.add("show");
};

document.getElementById("btn-salvar-edicao-funcionario")?.addEventListener("click", async () => {
    const id = document.getElementById("edit-func-id").value;
    const nome = document.getElementById("edit-func-nome").value.trim();
    const telefone = document.getElementById("edit-func-telefone").value.trim();
    const ramo = document.getElementById("edit-func-ramo")?.value || FABEF.ramo;
    if (!id || !nome) { alert("O nome do funcionário é obrigatório."); return; }

    try {
        const dadosAtualizados = { nome, telefone, ramo, atualizadoEm: serverTimestamp() };
        await updateDoc(doc(db, "utilizadores", id), dadosAtualizados);
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "funcionarios", id), dadosAtualizados);

        const f = FABEF.funcionarios.find(x => x.id === id);
        if (f) { 
            f.nome = nome; 
            f.telefone = telefone;
            f.ramo = ramo;
        }

        fecharModal("modal-editar-funcionario");
        renderFuncionarios();
        await gravarAuditoria("Editou os dados do funcionário: " + nome + (ramo ? ` (Ramo: ${ramo})` : ""), "INFO");
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

/* =====================================================
   MÓDULO LÓGICO: GESTÃO DE DISPENSAS, LICENÇAS & FALTAS
===================================================== */

function renderDispensas() {
    const tabela = document.getElementById("tabela-dispensas");
    if (!tabela) return;

    const termo = (document.getElementById("dispensas-pesquisa")?.value || "").toLowerCase().trim();
    const filtroEstado = document.getElementById("dispensas-filtro-estado")?.value || "TODOS";
    const hojeStr = new Date().toISOString().slice(0, 10);

    const dispensas = Array.isArray(FABEF.dispensas) ? FABEF.dispensas : [];

    // Filtros
    const listaFiltrada = dispensas.filter(d => {
        if (filtroEstado !== "TODOS" && (d.estado || "PENDENTE") !== filtroEstado) return false;
        if (termo) {
            const strBusca = `${d.funcionarioNome || ""} ${d.motivo || ""} ${d.tipo || ""} ${d.ramo || ""}`.toLowerCase();
            if (!strBusca.includes(termo)) return false;
        }
        return true;
    });

    // Ordenar da mais recente para a mais antiga
    listaFiltrada.sort((a, b) => new Date(b.criadoEm || b.dataInicio || 0) - new Date(a.criadoEm || a.dataInicio || 0));

    // Cálculos de KPIs
    let ativasHoje = 0;
    let pendentes = 0;
    let aprovadas = 0;
    let totalDiasAprovados = 0;

    dispensas.forEach(d => {
        const est = d.estado || "PENDENTE";
        if (est === "PENDENTE") pendentes++;
        if (est === "APROVADA") {
            aprovadas++;
            totalDiasAprovados += numero(d.dias || 1);
            if (d.dataInicio <= hojeStr && d.dataFim >= hojeStr) {
                ativasHoje++;
            }
        }
    });

    const kpiAtivas = document.getElementById("dispensas-kpi-ativas");
    const kpiPendentes = document.getElementById("dispensas-kpi-pendentes");
    const kpiAprovadas = document.getElementById("dispensas-kpi-aprovadas");
    const kpiDias = document.getElementById("dispensas-kpi-dias");

    if (kpiAtivas) kpiAtivas.textContent = ativasHoje;
    if (kpiPendentes) kpiPendentes.textContent = pendentes;
    if (kpiAprovadas) kpiAprovadas.textContent = aprovadas;
    if (kpiDias) kpiDias.textContent = `${totalDiasAprovados} dia${totalDiasAprovados !== 1 ? 's' : ''}`;

    const ehGerente = ehUsuarioGerente();

    tabela.innerHTML = listaFiltrada.map(d => {
        const est = d.estado || "PENDENTE";
        let badgeEstado = '<span class="badge badge-yellow">🟡 PENDENTE</span>';
        if (est === "APROVADA") badgeEstado = '<span class="badge badge-green">🟢 APROVADA</span>';
        if (est === "RECUSADA") badgeEstado = '<span class="badge badge-red">🔴 RECUSADA</span>';

        const periodoFormatado = `${dataTexto(d.dataInicio)} até ${dataTexto(d.dataFim)}`;
        const remuneraTxt = d.remunerada ? '<span style="color:#16a34a;font-weight:700;">🟢 Remunerada</span>' : '<span style="color:#64748b;">⚪ Sem Vencimento</span>';

        return `
        <tr>
            <td>
                <strong>${escapeHTML(d.funcionarioNome || "Funcionário")}</strong>
                ${d.cargo ? `<br><small style="color:#64748b;">${escapeHTML(d.cargo)}</small>` : ""}
            </td>
            <td><span class="badge badge-blue">${escapeHTML(d.ramo || "—")}</span></td>
            <td><strong>${escapeHTML(d.tipo || "Geral")}</strong></td>
            <td>${periodoFormatado}</td>
            <td><strong>${d.dias || 1} dia${numero(d.dias) !== 1 ? 's' : ''}</strong></td>
            <td>${remuneraTxt}</td>
            <td style="max-width:220px;white-space:normal;">
                ${escapeHTML(d.motivo || "—")}
                ${d.motivoRecusa ? `<br><small style="color:#dc2626;font-weight:600;">Motivo Recusa: ${escapeHTML(d.motivoRecusa)}</small>` : ""}
            </td>
            <td>${badgeEstado}</td>
            <td>
                <small style="color:#475569;font-weight:600;">${escapeHTML(d.aprovadoPor || (est === "PENDENTE" ? "Aguardando Gerente" : "—"))}</small>
            </td>
            <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                    ${(ehGerente && est === "PENDENTE") ? `
                        <button class="btn btn-success btn-small" type="button" onclick="aprovarDispensa('${escapeHTML(d.id)}')" style="background:#10b981;color:#fff;font-weight:700;padding:4px 8px;" title="Aprovar formalmente esta dispensa">✅ Aprovar</button>
                        <button class="btn btn-danger btn-small" type="button" onclick="recusarDispensa('${escapeHTML(d.id)}')" style="background:#ef4444;color:#fff;font-weight:700;padding:4px 8px;" title="Recusar pedido de dispensa">❌ Recusar</button>
                    ` : ""}
                    <button class="btn btn-light btn-small" type="button" onclick="imprimirGuiaDispensa('${escapeHTML(d.id)}')" style="padding:4px 8px;" title="Imprimir Guia de Dispensa / Comprovativo">🖨️ Guia</button>
                    ${ehGerente ? `
                        <button class="btn btn-small" type="button" onclick="apagarDispensa('${escapeHTML(d.id)}')" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:4px 8px;" title="Eliminar registo de dispensa">🗑️</button>
                    ` : ""}
                </div>
            </td>
        </tr>
        `;
    }).join("") || `
    <tr>
        <td colspan="10" style="text-align:center;color:#64748b;padding:24px;">
            Nenhum registo de dispensa ou licença encontrado. Clique em "➕ Solicitar / Registar Dispensa" acima.
        </td>
    </tr>
    `;
}
window.renderDispensas = renderDispensas;

window.abrirModalNovaDispensa = function() {
    const modal = document.getElementById("modal-dispensa-funcionario");
    if (!modal) return;

    const selectFunc = document.getElementById("dispensa-funcionario-select");
    const selectRamo = document.getElementById("dispensa-ramo");
    const dataInicio = document.getElementById("dispensa-data-inicio");
    const dataFim = document.getElementById("dispensa-data-fim");
    const inputDias = document.getElementById("dispensa-dias");
    const checkRemunerada = document.getElementById("dispensa-remunerada");
    const inputMotivo = document.getElementById("dispensa-motivo");
    const inputId = document.getElementById("dispensa-id");
    const blocoEstado = document.getElementById("bloco-dispensa-estado");
    const selectEstado = document.getElementById("dispensa-estado");

    if (inputId) inputId.value = "";
    if (inputMotivo) inputMotivo.value = "";
    if (checkRemunerada) checkRemunerada.checked = true;

    // Preenche funcionários
    if (selectFunc) {
        const funcs = FABEF.funcionarios || [];
        let html = "";
        if (ehUsuarioGerente()) {
            html += `<option value="GERENTE:${FABEF.empresa?.donoNome || 'Gerente / Proprietário'}">👑 ${FABEF.empresa?.donoNome || 'Gerente / Proprietário'} (Gerência)</option>`;
        }
        funcs.forEach(f => {
            html += `<option value="${f.id}:${escapeHTML(f.nome || 'Funcionário')}">${escapeHTML(f.nome || 'Funcionário')} (${f.ramo || 'Geral'})</option>`;
        });
        if (!html) {
            html = `<option value="FUNC:Funcionário Geral">Funcionário Geral</option>`;
        }
        selectFunc.innerHTML = html;
    }

    // Preenche ramos
    if (selectRamo) {
        const ramos = typeof obterConfigRamos === "function" ? obterConfigRamos() : [];
        selectRamo.innerHTML = ramos.map(r => `<option value="${escapeHTML(r.nome)}">${escapeHTML(r.nome)}</option>`).join("");
        selectRamo.value = FABEF.ramo || (ramos[0] ? ramos[0].nome : "Comércio Geral");
    }

    const hojeStr = new Date().toISOString().slice(0, 10);
    if (dataInicio) dataInicio.value = hojeStr;
    if (dataFim) dataFim.value = hojeStr;
    if (inputDias) inputDias.value = "1";

    const ehGerente = ehUsuarioGerente();
    if (blocoEstado) blocoEstado.style.display = ehGerente ? "block" : "none";
    if (selectEstado) selectEstado.value = ehGerente ? "APROVADA" : "PENDENTE";

    function recalcularDias() {
        if (!dataInicio?.value || !dataFim?.value) return;
        const d1 = new Date(dataInicio.value);
        const d2 = new Date(dataFim.value);
        if (d2 >= d1) {
            const diffTime = Math.abs(d2 - d1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (inputDias) inputDias.value = diffDays;
        } else {
            if (inputDias) inputDias.value = 1;
        }
    }

    if (dataInicio) dataInicio.onchange = recalcularDias;
    if (dataFim) dataFim.onchange = recalcularDias;

    modal.classList.add("show");
};

window.salvarDispensa = async function() {
    const selectFunc = document.getElementById("dispensa-funcionario-select");
    const tipo = document.getElementById("dispensa-tipo")?.value || "Baixa / Consulta Médica";
    const ramo = document.getElementById("dispensa-ramo")?.value || FABEF.ramo || "Geral";
    const dataInicio = document.getElementById("dispensa-data-inicio")?.value;
    const dataFim = document.getElementById("dispensa-data-fim")?.value;
    const dias = numero(document.getElementById("dispensa-dias")?.value || 1);
    const remunerada = Boolean(document.getElementById("dispensa-remunerada")?.checked);
    const motivo = (document.getElementById("dispensa-motivo")?.value || "").trim();
    const idExistente = document.getElementById("dispensa-id")?.value;

    if (!selectFunc || !selectFunc.value) {
        alert("Por favor, selecione o funcionário.");
        return;
    }
    if (!dataInicio || !dataFim) {
        alert("Por favor, indique as datas de início e fim da ausência.");
        return;
    }
    if (new Date(dataFim) < new Date(dataInicio)) {
        alert("A data de término não pode ser anterior à data de início.");
        return;
    }
    if (!motivo) {
        alert("Por favor, escreva o motivo ou justificação detalhada da dispensa.");
        document.getElementById("dispensa-motivo")?.focus();
        return;
    }

    const [funcId, funcNome] = selectFunc.value.split(":");
    const ehGerente = ehUsuarioGerente();
    const estadoEscolhido = document.getElementById("dispensa-estado")?.value || (ehGerente ? "APROVADA" : "PENDENTE");

    const usuarioAtual = FABEF.userData?.nome || auth.currentUser?.email || "Operador";

    const payload = {
        funcionarioId: funcId,
        funcionarioNome: funcNome || "Funcionário",
        ramo,
        tipo,
        dataInicio,
        dataFim,
        dias: Math.max(1, dias),
        remunerada,
        motivo,
        estado: estadoEscolhido,
        aprovadoPor: estadoEscolhido === "APROVADA" ? usuarioAtual : null,
        aprovadoEm: estadoEscolhido === "APROVADA" ? new Date().toISOString() : null,
        criadoPor: usuarioAtual,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    try {
        if (!Array.isArray(FABEF.dispensas)) FABEF.dispensas = [];

        if (idExistente) {
            if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
                await updateDoc(doc(db, "empresas", FABEF.empresaId, "dispensas", idExistente), payload);
            }
            const idx = FABEF.dispensas.findIndex(x => x.id === idExistente);
            if (idx >= 0) FABEF.dispensas[idx] = { id: idExistente, ...payload };
        } else {
            let novoId = "disp_" + Date.now();
            if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
                const docRef = await addDoc(collection(db, "empresas", FABEF.empresaId, "dispensas"), {
                    ...payload,
                    criadoEm: serverTimestamp(),
                    atualizadoEm: serverTimestamp()
                });
                novoId = docRef.id;
            }
            FABEF.dispensas.unshift({ id: novoId, ...payload });
        }

        await gravarAuditoria(`🏖️ DISPENSA REGISTADA (${payload.funcionarioNome} - ${payload.tipo} - ${payload.dias} dias) por ${usuarioAtual}. Estado: ${payload.estado}.`, "INFO");

        fecharModal("modal-dispensa-funcionario");
        renderDispensas();

        alert(`✅ Dispensa registada com sucesso!\n• Funcionário: ${payload.funcionarioNome}\n• Duração: ${payload.dias} dias (${dataTexto(payload.dataInicio)} a ${dataTexto(payload.dataFim)})\n• Estado: ${payload.estado}`);
    } catch (err) {
        console.error("Erro ao salvar dispensa:", err);
        alert("Erro ao gravar dispensa:\n" + (err.message || err));
    }
};

window.aprovarDispensa = async function(id) {
    if (!ehUsuarioGerente()) {
        alert("Apenas o Gerente tem autorização para aprovar dispensas.");
        return;
    }
    const d = (FABEF.dispensas || []).find(x => x.id === id);
    if (!d) return;

    if (!confirm(`Deseja APROVAR formalmente a dispensa de "${d.funcionarioNome}" (${d.dias} dias)?`)) return;

    try {
        const usuarioAtual = FABEF.userData?.nome || auth.currentUser?.email || "Gerente";
        const updateData = {
            estado: "APROVADA",
            aprovadoPor: usuarioAtual,
            aprovadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };

        if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
            await updateDoc(doc(db, "empresas", FABEF.empresaId, "dispensas", id), updateData);
        }

        Object.assign(d, updateData);
        await gravarAuditoria(`✅ DISPENSA APROVADA: ${d.funcionarioNome} (${d.dias} dias - ${d.tipo}) pelo Gerente ${usuarioAtual}.`, "INFO");

        renderDispensas();
        alert(`✅ Dispensa de "${d.funcionarioNome}" foi APROVADA com sucesso!`);
    } catch (err) {
        console.error("Erro ao aprovar dispensa:", err);
        alert("Erro ao aprovar dispensa:\n" + (err.message || err));
    }
};

window.recusarDispensa = async function(id) {
    if (!ehUsuarioGerente()) {
        alert("Apenas o Gerente tem autorização para recusar dispensas.");
        return;
    }
    const d = (FABEF.dispensas || []).find(x => x.id === id);
    if (!d) return;

    const motivoRecusa = prompt(`Indique a justificativa para a RECUSA da dispensa de "${d.funcionarioNome}":`);
    if (motivoRecusa === null) return;
    if (!motivoRecusa.trim()) {
        alert("A justificativa de recusa é obrigatória.");
        return;
    }

    try {
        const usuarioAtual = FABEF.userData?.nome || auth.currentUser?.email || "Gerente";
        const updateData = {
            estado: "RECUSADA",
            motivoRecusa: motivoRecusa.trim(),
            recusadoPor: usuarioAtual,
            recusadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };

        if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
            await updateDoc(doc(db, "empresas", FABEF.empresaId, "dispensas", id), updateData);
        }

        Object.assign(d, updateData);
        await gravarAuditoria(`🔴 DISPENSA RECUSADA: ${d.funcionarioNome} (${d.tipo}) pelo Gerente ${usuarioAtual}. Motivo: "${motivoRecusa}"`, "ALERTA");

        renderDispensas();
        alert(`Dispensa de "${d.funcionarioNome}" foi recusada.`);
    } catch (err) {
        console.error("Erro ao recusar dispensa:", err);
        alert("Erro ao recusar dispensa:\n" + (err.message || err));
    }
};

window.apagarDispensa = async function(id) {
    if (!ehUsuarioGerente()) {
        alert("Apenas o Gerente pode eliminar registos de dispensas.");
        return;
    }
    const d = (FABEF.dispensas || []).find(x => x.id === id);
    if (!d) return;

    if (!confirm(`Deseja eliminar definitivamente este registo de dispensa de "${d.funcionarioNome}"?`)) return;

    try {
        if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
            await deleteDoc(doc(db, "empresas", FABEF.empresaId, "dispensas", id));
        }
        FABEF.dispensas = (FABEF.dispensas || []).filter(x => x.id !== id);
        await gravarAuditoria(`🗑️ Eliminação de registo de dispensa de ${d.funcionarioNome}.`, "INFO");

        renderDispensas();
        alert("Registo de dispensa eliminado com sucesso.");
    } catch (err) {
        console.error("Erro ao apagar dispensa:", err);
        alert("Erro ao apagar registo:\n" + (err.message || err));
    }
};

window.imprimirGuiaDispensa = function(id) {
    const d = (FABEF.dispensas || []).find(x => x.id === id);
    if (!d) {
        alert("Registo não encontrado.");
        return;
    }

    const emp = typeof obterConfiguracaoRamo === "function" ? obterConfiguracaoRamo(d.ramo) : (FABEF.empresa || {});
    const nomeEmp = emp.nome || d.ramo || "EMPRESA";
    const nuitEmp = emp.nuit || "Isento";
    const telEmp = emp.telefone || "—";
    const endEmp = emp.endereco || "Moçambique";

    const w = window.open("", "_blank");
    const guiaHtml = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Guia de Dispensa - ${escapeHTML(d.funcionarioNome)}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.5; font-size: 14px; }
            .cabecalho { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
            .titulo { font-size: 20px; font-weight: 800; color: #0369a1; text-transform: uppercase; }
            .subtitulo { font-size: 13px; color: #64748b; }
            .dados-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
            .linha { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
            .rotulo { font-weight: 700; color: #334155; }
            .valor { font-weight: 600; color: #0f172a; }
            .assinaturas { display: flex; justify-content: space-between; margin-top: 60px; text-align: center; }
            .campo-assinatura { width: 45%; border-top: 1px solid #334155; padding-top: 8px; font-size: 12px; }
            @media print { body { margin: 15mm; } }
        </style>
    </head>
    <body>
        <div class="cabecalho">
            <div class="titulo">${escapeHTML(nomeEmp)}</div>
            <div class="subtitulo">NUIT: ${escapeHTML(nuitEmp)} | Telefone: ${escapeHTML(telEmp)} | ${escapeHTML(endEmp)}</div>
            <div style="margin-top: 8px; font-weight: 800; font-size: 16px; color: #0f172a;">
                📋 GUIA OFICIAL DE DISPENSA / AUTORIZAÇÃO DE AUSÊNCIA
            </div>
        </div>

        <div class="dados-box">
            <div class="linha">
                <span class="rotulo">Nome do Colaborador:</span>
                <span class="valor" style="font-size:15px;color:#0284c7;">${escapeHTML(d.funcionarioNome)}</span>
            </div>
            <div class="linha">
                <span class="rotulo">Ramo / Estabelecimento:</span>
                <span class="valor">${escapeHTML(d.ramo || "Geral")}</span>
            </div>
            <div class="linha">
                <span class="rotulo">Motivo / Tipo de Ausência:</span>
                <span class="valor">${escapeHTML(d.tipo || "Dispensa Geral")}</span>
            </div>
            <div class="linha">
                <span class="rotulo">Período Autorizado:</span>
                <span class="valor">De <strong>${dataTexto(d.dataInicio)}</strong> até <strong>${dataTexto(d.dataFim)}</strong></span>
            </div>
            <div class="linha">
                <span class="rotulo">Total de Dias Úteis:</span>
                <span class="valor">${d.dias || 1} dia(s)</span>
            </div>
            <div class="linha">
                <span class="rotulo">Remuneração:</span>
                <span class="valor">${d.remunerada ? "🟢 Remunerada (Sem Desconto Salarial)" : "⚪ Não Remunerada"}</span>
            </div>
            <div class="linha">
                <span class="rotulo">Estado da Solicitação:</span>
                <span class="valor" style="font-weight:800;color:${d.estado === 'APROVADA' ? '#16a34a' : '#ea580c'};">${escapeHTML(d.estado || 'PENDENTE')}</span>
            </div>
            <div class="linha">
                <span class="rotulo">Autorizado / Aprovado Por:</span>
                <span class="valor">${escapeHTML(d.aprovadoPor || "Gerência")}</span>
            </div>
            <div style="margin-top: 12px;">
                <span class="rotulo">Justificativa / Observações:</span>
                <div style="margin-top: 4px; padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px;">
                    ${escapeHTML(d.motivo || "Sem observações adicionais.")}
                </div>
            </div>
        </div>

        <div style="font-size: 11px; color: #64748b; margin-top: 10px;">
            Documento emitido em ${new Date().toLocaleDateString("pt-MZ")} às ${new Date().toLocaleTimeString("pt-MZ")} via FABEF Gestão ERP PRO.
        </div>

        <div class="assinaturas">
            <div class="campo-assinatura">
                <strong>${escapeHTML(d.funcionarioNome)}</strong><br>
                Assinatura do Colaborador
            </div>
            <div class="campo-assinatura">
                <strong>${escapeHTML(d.aprovadoPor || "A Gerência")}</strong><br>
                Assinatura & Carimbo da Empresa
            </div>
        </div>

        <script>
            window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });
        </script>
    </body>
    </html>
    `;

    if (w) {
        w.document.write(guiaHtml);
        w.document.close();
    }
};

document.getElementById("btn-nova-dispensa")?.addEventListener("click", window.abrirModalNovaDispensa);
document.getElementById("btn-guardar-dispensa")?.addEventListener("click", window.salvarDispensa);
document.getElementById("dispensas-pesquisa")?.addEventListener("input", window.renderDispensas);
document.getElementById("dispensas-filtro-estado")?.addEventListener("change", window.renderDispensas);

/* CONTROLO DE SUBSCRIÇão */

/* =====================================================
   MÓDULO LÓGICO: PLANO GRÁTIS COM LIMITES (FREEMIUM)
   Dias 1-7: acesso total (teste). A partir do dia 8, sem
   pagamento, passa a Plano Grátis com limites — em vez de
   ficar totalmente bloqueado. Pagando 250 MT, os limites
   desaparecem.
===================================================== */
const LIMITES_PLANO_GRATIS = {
    vendasDiarias: 5,
    encomendasDiarias: 3,
    funcionarios: 1
};

function obterPlanoAtual() {
    if (!FABEF.empresa) return "GRATIS";
    const estado = FABEF.empresa.estado_licenca || "TESTE";
    const validade = FABEF.empresa.validade_subscricao;
    const expirada = validade ? new Date() > new Date(validade) : false;

    if (estado === "ACTIVO" && !expirada) return "PAGO";

    if (estado === "TESTE") {
        const origem = FABEF.empresa.data_registo || FABEF.empresa.criadoEm;
        const d = origem && typeof origem.toDate === "function" ? origem.toDate() : new Date(origem || Date.now());
        const fim = new Date(d);
        fim.setDate(fim.getDate() + 7);
        if (new Date() <= fim) return "TRIAL";
    }

    return "GRATIS";
}

function avisoLimiteAtingido(mensagem) {
    alert((mensagem || "Atingiu o limite diário do plano grátis.") + "\n\nAtualize para o plano premium por apenas 250 MT para continuar!");
    mostrarSecao("subscricao");
}

function limiteVendasDiariasAtingido() {
    if (obterPlanoAtual() !== "GRATIS") return false;
    const hoje = dataHoje();
    const vendasHoje = FABEF.vendas.filter(v => new Date(v.data || 0) >= hoje).length;
    return vendasHoje >= LIMITES_PLANO_GRATIS.vendasDiarias;
}

function limiteEncomendasDiariasAtingido() {
    if (obterPlanoAtual() !== "GRATIS") return false;
    const hoje = dataHoje();
    const encomendasHoje = FABEF.encomendas.filter(e => new Date(e.data || 0) >= hoje).length;
    return encomendasHoje >= LIMITES_PLANO_GRATIS.encomendasDiarias;
}

function renderAvisoPlano() {
    const container = document.getElementById("aviso-plano-gratis");
    if (!container) return;
    const plano = obterPlanoAtual();

    if (plano !== "GRATIS") { container.innerHTML = ""; return; }

    const hoje = dataHoje();
    const vendasHoje = FABEF.vendas.filter(v => new Date(v.data || 0) >= hoje).length;
    const encomendasHoje = FABEF.encomendas.filter(e => new Date(e.data || 0) >= hoje).length;

    container.innerHTML = `
        <div class="alert alert-warning">
            <strong>🆓 Plano Grátis</strong> — Vendas hoje: ${vendasHoje}/${LIMITES_PLANO_GRATIS.vendasDiarias} ·
            Encomendas hoje: ${encomendasHoje}/${LIMITES_PLANO_GRATIS.encomendasDiarias} ·
            Funcionários: ${LIMITES_PLANO_GRATIS.funcionarios} máx.
            <button class="btn btn-success btn-small" type="button" onclick="mostrarSecao('subscricao')" style="margin-left:8px;">⭐ Passar a Premium (250 MT)</button>
        </div>
    `;
}


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
            aviso.className = "alert alert-warning";
            aviso.textContent = "🆓 Está no Plano Grátis (limites diários de vendas/encomendas e 1 funcionário). Pague 250 MT para desbloquear tudo.";
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-warning";
            estadoSpan.textContent = "Plano Grátis — com limites diários.";
        }
        if (bloqueio) {
            bloqueio.classList.remove("show");
            bloqueio.style.display = "none";
        }
    }

    FABEF_LICENCA_BLOQUEADA = false; // o plano grátis nunca bloqueia tudo, só limita
    renderAvisoPlano();
}

let FABEF_LICENCA_BLOQUEADA = false;

// Cole aqui o link completo do Workflow 1 do Pipedream (o "URL exclusivo para
// acionar este fluxo de trabalho" que apareceu ao criar o gatilho).
const FABEF_PIPEDREAM_COBRANCA_URL = "https://eoworwel5cr2z9j.m.pipedream.net";

async function solicitarPagamentoBackend(operadora, telefone) {
    if (!FABEF_PIPEDREAM_COBRANCA_URL || FABEF_PIPEDREAM_COBRANCA_URL.includes("SEU-LINK-AQUI")) {
        throw new Error("O endereço do servidor de pagamentos ainda não foi configurado.");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sessão Firebase inválida.");

    const resposta = await fetch(FABEF_PIPEDREAM_COBRANCA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            empresaId: FABEF.empresaId,
            telefone: telefone,
            valor: 250 + (typeof qtdFuncionariosExtras !== "undefined" ? (qtdFuncionariosExtras * 50) : 0),
            metodo: operadora // "MPESA" ou "EMOLA"
        })
    });

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || dados.mensagem || "Falha no servidor de pagamentos.");
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

        // O próprio servidor (Pipedream) já regista o pedido em "pagamentos" —
        // aqui só mostramos o estado, sem duplicar o registo.
        if (resultado) {
            resultado.className = "alert alert-warning";
            resultado.innerHTML = `â³ Pedido enviado. Confirme o PIN no seu telemóvel.<br>Referência: <strong>${escapeHTML(backendResult?.referencia || backendResult?.sourceId || "—")}</strong><br><small>A licença é activada automaticamente assim que o pagamento for confirmado.</small>`;
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

/* =====================================================
   MÓDULO LÓGICO: GRÁFICO DE CONTROLO DE VENDAS DIÁRIAS (TELA PRINCIPAL)
===================================================== */
window.FABEF_GRAFICO_DIAS = 7;

function renderGraficoVendas(dias = 7) {
    window.FABEF_GRAFICO_DIAS = dias;
    const container = document.getElementById("container-grafico-vendas");
    if (!container) return;

    document.querySelectorAll(".btn-filtro-grafico").forEach(btn => {
        const d = parseInt(btn.dataset.dias, 10);
        if (d === dias) {
            btn.classList.remove("btn-light");
            btn.classList.add("btn-primary");
            btn.style.fontWeight = "800";
        } else {
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-light");
            btn.style.fontWeight = "500";
        }
    });

    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    const dadosDias = [];
    for (let i = dias - 1; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        const inicioDia = new Date(d);
        inicioDia.setHours(0, 0, 0, 0);
        const fimDia = new Date(d);
        fimDia.setHours(23, 59, 59, 999);

        const vendasDia = (FABEF.vendas || []).filter(v => {
            if (v.status === "FALHADA_CANCELADA" || v.status === "FALHADA" || v.status === "CANCELADA") return false;
            const dataV = new Date(v.data || v.date || 0);
            return dataV >= inicioDia && dataV <= fimDia;
        });

        const totalDia = vendasDia.reduce((s, v) => s + numero(v.total), 0);
        const qtdVendas = vendasDia.length;
        const diaSemana = d.toLocaleDateString("pt-MZ", { weekday: "short" }).replace(".", "");
        const diaNum = String(d.getDate()).padStart(2, "0");
        const mesNum = String(d.getMonth() + 1).padStart(2, "0");

        dadosDias.push({
            dataObj: d,
            labelCurto: `${diaNum}/${mesNum}`,
            labelDia: i === 0 ? "Hoje" : `${diaSemana} ${diaNum}`,
            total: totalDia,
            qtd: qtdVendas
        });
    }

    const somaTotal = dadosDias.reduce((s, d) => s + d.total, 0);
    const mediaDiaria = dias > 0 ? (somaTotal / dias) : 0;
    let pico = { total: 0, label: "—" };
    dadosDias.forEach(d => {
        if (d.total > pico.total) {
            pico = { total: d.total, label: `${d.labelCurto} (${dinheiro(d.total)})` };
        }
    });

    const elMedia = document.getElementById("grafico-media-diaria");
    const elPico = document.getElementById("grafico-pico-venda");
    const elTotal = document.getElementById("grafico-total-periodo");
    if (elMedia) elMedia.textContent = dinheiro(mediaDiaria);
    if (elPico) elPico.textContent = pico.total > 0 ? pico.label : "0,00 MT";
    if (elTotal) elTotal.textContent = dinheiro(somaTotal);

    const svgWidth = 780;
    const svgHeight = 220;
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 28;
    const paddingBottom = 40;
    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    const maxValor = Math.max(100, ...dadosDias.map(d => d.total));
    const tetoValor = Math.ceil(maxValor * 1.18);

    const niveis = [0, 0.33, 0.66, 1];
    let linhasGrelhaSvg = "";
    niveis.forEach(nv => {
        const y = paddingTop + chartHeight - (nv * chartHeight);
        const val = Math.round(tetoValor * nv);
        const textoVal = val >= 1000 ? (val / 1000).toFixed(1) + "k" : val;
        linhasGrelhaSvg += `
            <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${nv === 0 ? '0' : '4,4'}" />
            <text x="${paddingLeft - 8}" y="${y + 3}" font-size="10" fill="#64748b" text-anchor="end" font-family="system-ui">${textoVal} MT</text>
        `;
    });

    const yMedia = paddingTop + chartHeight - ((mediaDiaria / tetoValor) * chartHeight);
    const linhaMediaSvg = mediaDiaria > 0 ? `
        <line x1="${paddingLeft}" y1="${yMedia}" x2="${svgWidth - paddingRight}" y2="${yMedia}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6,4" />
        <text x="${svgWidth - paddingRight}" y="${Math.max(14, yMedia - 5)}" font-size="10" font-weight="700" fill="#d97706" text-anchor="end" font-family="system-ui">Média: ${dinheiro(mediaDiaria)}</text>
    ` : "";

    const barSpacing = chartWidth / dadosDias.length;
    const barWidth = Math.min(46, Math.max(12, barSpacing * 0.64));
    let barrasSvg = "";

    dadosDias.forEach((d, idx) => {
        const x = paddingLeft + (idx * barSpacing) + (barSpacing - barWidth) / 2;
        const barH = Math.max(4, (d.total / tetoValor) * chartHeight);
        const y = paddingTop + chartHeight - barH;
        const isHoje = idx === dadosDias.length - 1;
        const corBarra = isHoje ? "#2563eb" : (d.total > 0 ? "#3b82f6" : "#cbd5e1");

        barrasSvg += `
            <g class="coluna-venda" style="cursor:pointer;">
                <title>${d.labelDia} (${d.labelCurto}): ${dinheiro(d.total)} em ${d.qtd} venda(s)</title>
                <rect x="${x - 4}" y="${paddingTop}" width="${barWidth + 8}" height="${chartHeight}" fill="transparent" rx="4" />
                <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${corBarra}" rx="4" />
                ${d.total > 0 ? `
                    <text x="${x + barWidth / 2}" y="${y - 5}" font-size="10" font-weight="700" fill="#1e293b" text-anchor="middle" font-family="system-ui">
                        ${d.total >= 1000 ? (d.total / 1000).toFixed(1) + "k" : Math.round(d.total)}
                    </text>
                ` : ""}
                <text x="${x + barWidth / 2}" y="${svgHeight - 14}" font-size="11" font-weight="${isHoje ? '700' : '500'}" fill="${isHoje ? '#1d4ed8' : '#64748b'}" text-anchor="middle" font-family="system-ui">
                    ${d.labelDia}
                </text>
            </g>
        `;
    });

    container.innerHTML = `
        <div style="width:100%;overflow-x:auto;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%;height:auto;min-width:560px;display:block;">
                ${linhasGrelhaSvg}
                ${linhaMediaSvg}
                ${barrasSvg}
            </svg>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:#64748b;padding:0 8px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:14px;">
                <span><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;border-radius:2px;vertical-align:middle;margin-right:4px;"></span> Vendas Realizadas</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:2px;vertical-align:middle;margin-right:4px;"></span> Dia Atual (Hoje)</span>
                <span><span style="display:inline-block;width:14px;height:2px;background:#f59e0b;vertical-align:middle;margin-right:4px;"></span> Média Diária</span>
            </div>
            <span>Passe o cursor/toque nas barras para detalhes de cada dia</span>
        </div>
    `;
}
window.renderGraficoVendas = renderGraficoVendas;

document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-filtro-grafico");
    if (btn && btn.dataset.dias) {
        const dias = parseInt(btn.dataset.dias, 10);
        renderGraficoVendas(dias);
    }
});


/* =====================================================
   MÓDULO LÓGICO: PASTA DE RAMOS (MULTI-RAMOS & SEGURANÇA)
===================================================== */
function obterConfigRamos() {
    let ramos = FABEF.empresa?.ramos_config;
    if (!Array.isArray(ramos) || ramos.length === 0) {
        const ramoAtivo = FABEF.ramo || "Comércio Geral";
        ramos = [{ nome: ramoAtivo, tipo: ramoAtivo, senha: "" }];
        const extras = FABEF.empresa?.ramos_atividade || [];
        extras.forEach(ext => {
            if (!ramos.some(r => r.nome === ext)) {
                ramos.push({ nome: ext, tipo: ext, senha: "" });
            }
        });
    }
    return ramos;
}

function renderPastaRamos() {
    const container = document.getElementById("pasta-ramos-container");
    if (!container) return;

    const ramos = obterConfigRamos();
    const hoje = dataHoje();

    container.innerHTML = ramos.map(r => {
        const ehAtivo = r.nome === FABEF.ramo;
        const totalProds = (FABEF.produtos || []).filter(p => p.ramo === r.nome).length;
        const vendasHojeRamo = (FABEF.vendas || []).filter(v => v.ramo === r.nome && new Date(v.data || 0) >= hoje && v.status !== "FALHADA_CANCELADA");
        const totalHojeRamo = vendasHojeRamo.reduce((s, v) => s + numero(v.total), 0);
        const temSenha = Boolean(r.senha && r.senha.trim());

        return `
            <div class="card card-ramo-pasta" style="border: 2px solid ${ehAtivo ? '#10b981' : '#cbd5e1'}; background:${ehAtivo ? '#f0fdf4' : '#ffffff'}; padding:16px; border-radius:12px; position:relative; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06); color:#0f172a !important;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:32px;">📁</span>
                        <div>
                            <h4 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHTML(r.nome)}</h4>
                            <small style="color:#64748b;font-weight:600;">${escapeHTML(r.tipo || r.nome)}</small>
                        </div>
                    </div>
                    <div>
                        ${ehAtivo 
                            ? `<span class="badge badge-green" style="font-size:11px;padding:3px 8px;font-weight:700;">✅ Ativo</span>` 
                            : `<span class="badge badge-yellow" style="font-size:11px;padding:3px 7px;font-weight:700;">Alternativo</span>`
                        }
                    </div>
                </div>

                <div style="background:${ehAtivo ? '#e6f7ec' : '#f8fafc'};padding:12px;border-radius:8px;margin-bottom:12px;font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border:1px solid ${ehAtivo ? '#bbf7d0' : '#e2e8f0'};color:#0f172a;">
                    <div>
                        <span style="color:#475569;display:block;font-size:11px;font-weight:700;">📦 Artigos:</span>
                        <strong style="color:#0f172a;font-size:14px;display:block;margin-top:2px;">${totalProds} no stock</strong>
                    </div>
                    <div>
                        <span style="color:#475569;display:block;font-size:11px;font-weight:700;">💰 Vendas Hoje:</span>
                        <strong style="color:${totalHojeRamo > 0 ? '#059669' : '#0f172a'};font-size:14px;display:block;margin-top:2px;">${dinheiro(totalHojeRamo)}</strong>
                    </div>
                    <div style="grid-column:1/-1;border-top:1px dashed #cbd5e1;padding-top:8px;margin-top:2px;font-size:12px;">
                        ${temSenha 
                            ? `<span style="color:#b45309;font-weight:700;display:inline-flex;align-items:center;gap:4px;">🔒 Protegido com Senha</span>` 
                            : `<span style="color:#059669;font-weight:700;display:inline-flex;align-items:center;gap:4px;">🔓 Acesso Livre</span>`
                        }
                    </div>
                </div>

                <div style="display:flex;gap:8px;flex-direction:column;">
                    ${ehAtivo ? `
                        <button class="btn btn-success btn-small" type="button" style="width:100%;font-weight:700;padding:10px;font-size:13px;background:#10b981;color:#fff;border:none;border-radius:8px;" disabled>
                            ✔ Ramo Selecionado Agora
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-small" type="button" style="width:100%;font-weight:700;padding:10px;font-size:13px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;" onclick="alternarRamoPasta('${escapeHTML(r.nome)}')">
                            📂 Alternar para este Ramo
                        </button>
                    `}
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="btn btn-light btn-small" type="button" style="flex:1;min-width:120px;font-size:12px;font-weight:700;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;padding:8px 10px;border-radius:6px;cursor:pointer;" onclick="abrirConfiguracoesRamo('${escapeHTML(r.nome)}')">
                            ⚙️ Configurar Ramo
                        </button>
                        <button class="btn btn-light btn-small" type="button" style="font-size:12px;font-weight:600;padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;border-radius:6px;cursor:pointer;" onclick="alterarPinRamo('${escapeHTML(r.nome)}')">
                            🔑 ${temSenha ? 'Alterar PIN' : 'Definir PIN'}
                        </button>
                        ${!ehAtivo ? `
                        <button class="btn btn-light btn-small" type="button" style="color:#ef4444;font-size:13px;font-weight:600;padding:8px 12px;border:1px solid #fecaca;background:#fef2f2;border-radius:6px;cursor:pointer;" onclick="removerRamoPasta('${escapeHTML(r.nome)}')" title="Remover este ramo da pasta">
                            🗑️
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join("");
}
window.renderPastaRamos = renderPastaRamos;

window.abrirConfiguracoesRamo = function(nomeRamo) {
    ramoSendoConfigurado = nomeRamo;
    mostrarSecao("config");
    renderConfiguracoes();
};

window.alternarRamoPasta = async function(nomeRamo) {
    const ramos = obterConfigRamos();
    const ramoAlvo = ramos.find(r => r.nome === nomeRamo);
    if (!ramoAlvo) {
        alert("Ramo não encontrado na pasta.");
        return;
    }

    if (ramoAlvo.senha && ramoAlvo.senha.trim()) {
        const pinDigitado = prompt(`🔒 Segurança de Filial / Ramo:\n\nO ramo "${nomeRamo}" está protegido por PIN.\nPor favor, introduza o PIN ou Senha de acesso configurada pelo Gerente:`);
        if (pinDigitado === null) return;
        if (pinDigitado.trim() !== ramoAlvo.senha.trim()) {
            alert("❌ Senha ou PIN incorreto! Acesso não autorizado para o ramo " + nomeRamo);
            return;
        }
    }

    await mudarRamo(nomeRamo);
    renderPastaRamos();
};

window.alterarPinRamo = async function(nomeRamo) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o Gerente tem autorização para configurar o PIN dos ramos.");
        return;
    }

    const ramos = obterConfigRamos();
    const index = ramos.findIndex(r => r.nome === nomeRamo);
    if (index === -1) {
        alert("Ramo não encontrado na pasta.");
        return;
    }
    const ramo = ramos[index];

    if (ramo.senha && ramo.senha.trim()) {
        const pinAtual = prompt(`🔒 Segurança de Ramo:\n\nO ramo "${nomeRamo}" possui um PIN atual.\nIntroduza o PIN atual para autorizar a alteração:`);
        if (pinAtual === null) return;
        if (pinAtual.trim() !== ramo.senha.trim()) {
            alert("❌ PIN atual incorreto! Não foi possível autorizar.");
            return;
        }
    }

    const novoPin = prompt(`🔑 Definir PIN para o ramo "${nomeRamo}":\n\nIntroduza o novo PIN (ex: 1234) para proteger este ramo.\n(Deixe em branco e clique em OK se desejar remover o PIN e deixar com acesso livre):`);
    if (novoPin === null) return;

    try {
        ramos[index].senha = novoPin.trim();
        if (!window.FABEF?.isDemoMode) {
            await updateDoc(empresaRef(), {
                ramos_config: ramos,
                atualizadoEm: serverTimestamp()
            });
        }
        if (!FABEF.empresa) FABEF.empresa = {};
        FABEF.empresa.ramos_config = ramos;

        await gravarAuditoria(`Gerente configurou/alterou o PIN de proteção do ramo "${nomeRamo}".`, "INFO");
        alert(`✅ Segurança do ramo "${nomeRamo}" atualizada com sucesso!`);
        renderPastaRamos();
    } catch (e) {
        console.error(e);
        alert("Erro ao guardar o PIN do ramo:\n" + mensagemFirebase(e));
    }
};

window.removerRamoPasta = async function(nomeRamo) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o Gerente pode remover ramos da pasta.");
        return;
    }

    if (nomeRamo === FABEF.ramo) {
        alert("⚠️ Não é possível remover o ramo que está atualmente em uso. Alterne primeiro para outro ramo antes de remover este.");
        return;
    }

    const confirmou = confirm(`⚠️ Confirmação:\n\nDeseja remover o ramo "${nomeRamo}" da pasta de ramos da empresa?\n\nOs artigos deste ramo permanecerão seguros na base de dados caso adicione novamente o ramo mais tarde.`);
    if (!confirmou) return;

    const ramos = obterConfigRamos();
    const ramoAlvo = ramos.find(r => r.nome === nomeRamo);
    if (ramoAlvo && ramoAlvo.senha && ramoAlvo.senha.trim()) {
        const pinDigitado = prompt(`🔒 Introduza o PIN do ramo "${nomeRamo}" para autorizar a remoção:`);
        if (pinDigitado === null) return;
        if (pinDigitado.trim() !== ramoAlvo.senha.trim()) {
            alert("❌ PIN incorreto!");
            return;
        }
    }

    try {
        const novaListaRamos = ramos.filter(r => r.nome !== nomeRamo);
        const novaListaNomes = (FABEF.empresa?.ramos_atividade || []).filter(n => n !== nomeRamo);

        if (!window.FABEF?.isDemoMode) {
            await updateDoc(empresaRef(), {
                ramos_config: novaListaRamos,
                ramos_atividade: novaListaNomes,
                atualizadoEm: serverTimestamp()
            });
        }

        if (!FABEF.empresa) FABEF.empresa = {};
        FABEF.empresa.ramos_config = novaListaRamos;
        FABEF.empresa.ramos_atividade = novaListaNomes;

        const personalizados = FABEF.empresa?.ramos_atividade || [];
        RAMOS = Array.from(new Set([...RAMOS_PADRAO, ...personalizados]));

        await gravarAuditoria(`Gerente removeu o ramo "${nomeRamo}" da pasta de ramos.`, "INFO");
        renderRamos();
        renderPastaRamos();
        alert(`🗑️ Ramo "${nomeRamo}" removido da pasta com sucesso.`);
    } catch (e) {
        console.error(e);
        alert("Erro ao remover ramo:\n" + mensagemFirebase(e));
    }
};

document.getElementById("btn-abrir-modal-novo-ramo")?.addEventListener("click", () => {
    const inpNome = document.getElementById("pasta-ramo-nome");
    const inpSenha = document.getElementById("pasta-ramo-senha");
    if (inpNome) inpNome.value = "";
    if (inpSenha) inpSenha.value = "";
    document.getElementById("modal-novo-ramo-pasta")?.classList.add("show");
});

document.getElementById("btn-salvar-ramo-pasta")?.addEventListener("click", async () => {
    const nome = (document.getElementById("pasta-ramo-nome")?.value || "").trim();
    const tipo = document.getElementById("pasta-ramo-tipo")?.value || "Comércio Geral";
    const senha = (document.getElementById("pasta-ramo-senha")?.value || "").trim();

    if (!nome) {
        alert("Por favor, indique o nome do novo ramo ou filial.");
        return;
    }

    const ramosAtuais = obterConfigRamos();
    if (ramosAtuais.some(r => r.nome.toLowerCase() === nome.toLowerCase())) {
        alert("Já existe um ramo registado com este nome na sua pasta.");
        return;
    }

    try {
        const novoRamoObj = {
            nome: nome,
            tipo: tipo,
            senha: senha,
            criadoEm: new Date().toISOString()
        };

        const novaListaRamos = [...ramosAtuais, novoRamoObj];
        const novaListaNomes = Array.from(new Set([...(FABEF.empresa?.ramos_atividade || []), nome]));

        await updateDoc(empresaRef(), {
            ramos_config: novaListaRamos,
            ramos_atividade: novaListaNomes,
            atualizadoEm: serverTimestamp()
        });

        if (!FABEF.empresa) FABEF.empresa = {};
        FABEF.empresa.ramos_config = novaListaRamos;
        FABEF.empresa.ramos_atividade = novaListaNomes;

        await gravarAuditoria(`Gerente adicionou o novo ramo "${nome}" (${tipo}) à pasta de ramos.${senha ? " Protegido com senha." : ""}`, "INFO");

        fecharModal("modal-novo-ramo-pasta");
        renderRamos();
        renderPastaRamos();

        if (confirm(`Ramo "${nome}" guardado com sucesso na pasta!\n\nDeseja alternar agora mesmo para operar neste novo ramo?`)) {
            await mudarRamo(nome);
        }
    } catch (error) {
        console.error("Erro ao guardar novo ramo:", error);
        alert("Erro ao adicionar ramo à pasta:\n" + mensagemFirebase(error));
    }
});


/* =====================================================
   MÓDULO LÓGICO: CALCULADORA & SUBSCRIÇão (250 MT - 30 DIAS)
===================================================== */
let qtdFuncionariosExtras = 0;

function atualizarCalculadoraSubscricao() {
    const elQtd = document.getElementById("calc-qtd-extras");
    const elTotal = document.getElementById("calc-total-pagar");
    const elBtnTotal = document.getElementById("btn-texto-valor-pagamento");
    if (!elQtd || !elTotal) return;

    const precoBase = 250;
    const taxaExtraPorFuncionario = 250 * 0.20; // 50 MT (20%)
    const valorTotal = precoBase + (qtdFuncionariosExtras * taxaExtraPorFuncionario);

    elQtd.textContent = qtdFuncionariosExtras;
    elTotal.textContent = `${valorTotal} MT`;
    if (elBtnTotal) elBtnTotal.textContent = `${valorTotal} MT`;
}
window.atualizarCalculadoraSubscricao = atualizarCalculadoraSubscricao;

document.getElementById("btn-calc-menos-func")?.addEventListener("click", () => {
    qtdFuncionariosExtras = Math.max(0, qtdFuncionariosExtras - 1);
    atualizarCalculadoraSubscricao();
});

document.getElementById("btn-calc-mais-func")?.addEventListener("click", () => {
    qtdFuncionariosExtras += 1;
    atualizarCalculadoraSubscricao();
});


// O botão de subscrição usa apenas solicitarSubscricaoMovel().
// A licença Não é activada no navegador: somente o backend/webhook, após confirmação real do pagamento, deve actualizar o Firestore.


/* =====================================================
   MÓDULO LÓGICO: MODAIS DE JUSTIFICATIVA AO GERENTE
   (VENDA FALHADA & ENCOMENDA FALHADA)
===================================================== */
window.abrirModalVendaFalhada = function(vendaId) {
    const v = (FABEF.vendas || []).find(x => x.id === vendaId) || (FABEF._raw?.vendas || []).find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }

    const elId = document.getElementById("falha-venda-id");
    const elRef = document.getElementById("falha-venda-ref");
    const elTotal = document.getElementById("falha-venda-total");
    const elItens = document.getElementById("falha-venda-itens");
    const elJust = document.getElementById("falha-venda-justificativa");
    const elAcao = document.getElementById("falha-venda-tipo-acao");
    const elNovoPreco = document.getElementById("falha-venda-novo-preco");
    const blocoPreco = document.getElementById("bloco-falha-editar-preco");
    const blocoStock = document.getElementById("bloco-falha-repor-stock");

    if (elId) elId.value = v.id;
    if (elRef) elRef.textContent = "#" + v.id.slice(0, 8);
    if (elTotal) elTotal.textContent = dinheiro(v.total);
    if (elNovoPreco) elNovoPreco.value = numero(v.total);

    const itensStr = (v.itens || v.items || []).map(it => `${escapeHTML(it.nome || "Item")} (${it.quantidade} ${it.unidade || 'un'})`).join(", ");
    if (elItens) elItens.textContent = itensStr || "—";
    if (elJust) elJust.value = "";

    function alternarAcaoFalha() {
        const acao = elAcao?.value || "EDITAR_PRECO";
        if (acao === "EDITAR_PRECO") {
            if (blocoPreco) blocoPreco.style.display = "block";
            if (blocoStock) blocoStock.style.display = "none";
        } else {
            if (blocoPreco) blocoPreco.style.display = "none";
            if (blocoStock) blocoStock.style.display = "flex";
        }
    }

    if (elAcao) {
        elAcao.value = "EDITAR_PRECO";
        elAcao.onchange = alternarAcaoFalha;
        alternarAcaoFalha();
    }

    document.getElementById("modal-venda-falhada")?.classList.add("show");
    setTimeout(() => {
        if (elNovoPreco) elNovoPreco.focus();
    }, 150);
};

document.getElementById("btn-confirmar-venda-falhada")?.addEventListener("click", async () => {
    const vendaId = document.getElementById("falha-venda-id")?.value;
    const tipoAcao = document.getElementById("falha-venda-tipo-acao")?.value || "EDITAR_PRECO";
    const motivoTipo = document.getElementById("falha-venda-motivo-tipo")?.value || "Correção de Venda";
    const justificativa = (document.getElementById("falha-venda-justificativa")?.value || "").trim();
    const reporStock = Boolean(document.getElementById("falha-venda-repor-stock")?.checked);

    if (!justificativa) {
        alert("⚠️ Justificativa Obrigatória:\nPor favor, escreva a justificativa detalhada para o Gerente explicando o motivo da alteração ou anulação desta venda.");
        document.getElementById("falha-venda-justificativa")?.focus();
        return;
    }

    const v = (FABEF.vendas || []).find(x => x.id === vendaId) || (FABEF._raw?.vendas || []).find(x => x.id === vendaId);
    if (!v) { alert("Venda não encontrada."); return; }

    try {
        const usuarioNome = FABEF.userData?.nome || auth.currentUser?.email || "Funcionário";

        if (tipoAcao === "EDITAR_PRECO") {
            const novoPreco = numero(document.getElementById("falha-venda-novo-preco")?.value);
            if (isNaN(novoPreco) || novoPreco < 0) {
                alert("Introduza um valor válido para o novo preço da venda.");
                document.getElementById("falha-venda-novo-preco")?.focus();
                return;
            }

            const precoAntigo = numero(v.total);
            const diferenca = novoPreco - precoAntigo;

            const payloadAtualizacao = {
                total: novoPreco,
                precoOriginal: precoAntigo,
                status: "CORRIGIDA_PRECO",
                motivoFalha: motivoTipo,
                justificativaGerente: justificativa,
                corrigidoPor: usuarioNome,
                corrigidoEm: new Date().toISOString()
            };

            // Se pertencer ao turno de caixa aberto, ajusta os totais do turno
            if (FABEF.turnoId && v.turnoId === FABEF.turnoId && FABEF.turno) {
                FABEF.turno.totalVendas = Math.max(0, numero(FABEF.turno.totalVendas) + diferenca);
                if (v.pagamento === "Numerário") {
                    FABEF.turno.totalVendasDinheiro = Math.max(0, numero(FABEF.turno.totalVendasDinheiro) + diferenca);
                }
                await updateDoc(doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId), {
                    totalVendas: FABEF.turno.totalVendas,
                    totalVendasDinheiro: FABEF.turno.totalVendasDinheiro || 0
                }).catch(e => console.warn("Aviso ao atualizar turno:", e));
                atualizarTelaCaixa();
            }

            await updateDoc(doc(db, "empresas", FABEF.empresaId, "vendas", vendaId), payloadAtualizacao);
            Object.assign(v, payloadAtualizacao);

            await gravarAuditoria(`✏️ PREÇO DE VENDA CORRIGIDO (#${v.id.slice(0, 8)}) por ${usuarioNome}: de ${dinheiro(precoAntigo)} para ${dinheiro(novoPreco)}. Justificativa ao Gerente: "${justificativa}"`, "ALERTA");

            fecharModal("modal-venda-falhada");
            renderVendas();
            renderDashboard();

            alert(`✅ Preço da venda corrigido para ${dinheiro(novoPreco)} com sucesso!\nA justificativa foi enviada e arquivada nos registos de auditoria do Gerente.`);
            return;
        }

        // Caso seja cancelamento total:
        const payloadAtualizacao = {
            status: "FALHADA_CANCELADA",
            motivoFalha: motivoTipo,
            justificativaGerente: justificativa,
            falhadaPor: usuarioNome,
            falhadaEm: new Date().toISOString()
        };

        if (reporStock && (v.itens || v.items)) {
            for (const item of (v.itens || v.items)) {
                const prod = (FABEF.produtos || []).find(p => p.id === item.id || p.id === item.produtoId);
                if (prod) {
                    const novoStock = numero(prod.stock) + numero(item.quantidade);
                    prod.stock = novoStock;
                    await updateDoc(produtoRef(prod.id), {
                        stock: novoStock,
                        atualizadoEm: serverTimestamp()
                    }).catch(err => console.warn("Erro ao repor stock do produto:", err));
                }
            }
        }

        await updateDoc(doc(db, "empresas", FABEF.empresaId, "vendas", vendaId), payloadAtualizacao);
        Object.assign(v, payloadAtualizacao);

        await gravarAuditoria(`⚠️ VENDA ANULADA / FALHADA (#${v.id.slice(0, 8)} - ${dinheiro(v.total)}) registada por ${usuarioNome}. Motivo ao Gerente: "${justificativa}"`, "ALERTA");

        fecharModal("modal-venda-falhada");
        renderVendas();
        renderProdutos();
        renderDashboard();

        alert("A venda foi anulada com sucesso.\nA justificativa foi arquivada para o Gerente nos registos de auditoria e o stock foi restabelecido.");
    } catch (error) {
        console.error("Erro ao registar correção/falha de venda:", error);
        alert("Erro ao processar a operação:\n" + mensagemFirebase(error));
    }
});

/* =====================================================
   MÓDULO LÓGICO: EDIÇÃO DIRETA E EXCLUSÃO DE VENDAS
===================================================== */
window.abrirModalEditarVenda = function(vendaId) {
    const v = (FABEF.vendas || []).find(x => x.id === vendaId) || (FABEF._raw?.vendas || []).find(x => x.id === vendaId);
    if (!v) {
        alert("Venda não localizada.");
        return;
    }

    const modal = document.getElementById("modal-editar-venda");
    if (!modal) return;

    const elId = document.getElementById("edit-venda-id");
    const elRef = document.getElementById("edit-venda-ref");
    const elData = document.getElementById("edit-venda-data");
    const elOp = document.getElementById("edit-venda-operador");
    const elArtigos = document.getElementById("edit-venda-artigos");
    const elTotal = document.getElementById("edit-venda-total");
    const elPagamento = document.getElementById("edit-venda-pagamento");
    const elCliente = document.getElementById("edit-venda-cliente");
    const elNuit = document.getElementById("edit-venda-nuit");
    const elJust = document.getElementById("edit-venda-justificativa");

    if (elId) elId.value = v.id;
    if (elRef) elRef.textContent = "#" + v.id.slice(0, 8);
    if (elData) elData.textContent = dataTexto(v.data || v.date);
    if (elOp) elOp.textContent = v.operadorNome || v.user || "Operador";

    const itensDesc = (v.itens || v.items || []).map(it => `${it.nome || "Item"} (${it.quantidade || it.qty || 1}${it.unidade && it.unidade !== "unidade" ? " " + it.unidade : ""})`).join(", ");
    if (elArtigos) elArtigos.textContent = itensDesc || "Artigos diversos";

    if (elTotal) elTotal.value = numero(v.total);
    if (elPagamento) elPagamento.value = v.pagamento || "Dinheiro";
    if (elCliente) elCliente.value = v.clienteNome || v.cliente || "";
    if (elNuit) elNuit.value = v.nuitCliente || "";
    if (elJust) elJust.value = v.justificativaGerente || "";

    const btnApagarModal = document.getElementById("btn-modal-apagar-venda");
    if (btnApagarModal) {
        btnApagarModal.onclick = () => window.apagarVenda(v.id);
    }

    modal.classList.add("show");
    setTimeout(() => { if (elTotal) elTotal.focus(); }, 150);
};

window.salvarEdicaoVenda = async function() {
    const vendaId = document.getElementById("edit-venda-id")?.value;
    if (!vendaId) return;

    const v = (FABEF.vendas || []).find(x => x.id === vendaId) || (FABEF._raw?.vendas || []).find(x => x.id === vendaId);
    if (!v) {
        alert("Venda não localizada.");
        return;
    }

    const novoTotal = numero(document.getElementById("edit-venda-total")?.value);
    const novoPagamento = document.getElementById("edit-venda-pagamento")?.value || "Dinheiro";
    const novoCliente = (document.getElementById("edit-venda-cliente")?.value || "").trim();
    const novoNuit = (document.getElementById("edit-venda-nuit")?.value || "").trim();
    const justificativa = (document.getElementById("edit-venda-justificativa")?.value || "").trim();

    if (isNaN(novoTotal) || novoTotal < 0) {
        alert("Por favor, introduza um valor total válido para a venda.");
        document.getElementById("edit-venda-total")?.focus();
        return;
    }

    if (!justificativa) {
        alert("⚠️ Justificativa Obrigatória:\nPor favor, informe a justificativa da alteração para o histórico do Gerente.");
        document.getElementById("edit-venda-justificativa")?.focus();
        return;
    }

    try {
        const usuarioNome = FABEF.userData?.nome || auth.currentUser?.email || "Operador";
        const totalAntigo = numero(v.total);
        const diferenca = novoTotal - totalAntigo;

        const updateData = {
            total: novoTotal,
            totalOriginal: v.totalOriginal || totalAntigo,
            pagamento: novoPagamento,
            clienteNome: novoCliente,
            cliente: novoCliente,
            nuitCliente: novoNuit,
            justificativaGerente: justificativa,
            editadoPor: usuarioNome,
            editadoEm: new Date().toISOString(),
            status: "EDITADA"
        };

        // Se a venda pertencer ao turno atual e for Dinheiro, ajusta o caixa
        if (FABEF.turnoId && v.turnoId === FABEF.turnoId && FABEF.turno) {
            FABEF.turno.totalVendas = Math.max(0, numero(FABEF.turno.totalVendas) + diferenca);
            if (novoPagamento === "Dinheiro" || v.pagamento === "Dinheiro" || v.pagamento === "Numerário") {
                FABEF.turno.totalVendasDinheiro = Math.max(0, numero(FABEF.turno.totalVendasDinheiro) + diferenca);
            }
            if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
                await updateDoc(doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId), {
                    totalVendas: FABEF.turno.totalVendas,
                    totalVendasDinheiro: FABEF.turno.totalVendasDinheiro || 0
                }).catch(e => console.warn("Aviso ao atualizar turno:", e));
            }
            atualizarTelaCaixa();
        }

        if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
            await updateDoc(doc(db, "empresas", FABEF.empresaId, "vendas", vendaId), updateData);
        }

        Object.assign(v, updateData);

        await gravarAuditoria(`✏️ VENDA EDITADA (#${v.id.slice(0, 8)}) por ${usuarioNome}. Novo total: ${dinheiro(novoTotal)} (Antes: ${dinheiro(totalAntigo)}). Motivo: "${justificativa}"`, "ALERTA");

        fecharModal("modal-editar-venda");
        renderVendas();
        renderDashboard();

        alert(`✅ Venda atualizada com sucesso!\nO novo valor de ${dinheiro(novoTotal)} e as alterações foram gravadas.`);
    } catch (err) {
        console.error("Erro ao salvar edição da venda:", err);
        alert("Erro ao salvar alterações da venda:\n" + (err.message || err));
    }
};

document.getElementById("btn-guardar-edicao-venda")?.addEventListener("click", window.salvarEdicaoVenda);

window.apagarVenda = async function(vendaId) {
    const v = (FABEF.vendas || []).find(x => x.id === vendaId) || (FABEF._raw?.vendas || []).find(x => x.id === vendaId);
    if (!v) {
        alert("Venda não encontrada.");
        return;
    }

    const valorVenda = dinheiro(v.total || 0);
    const dataVenda = dataTexto(v.data || v.date);
    const confirmMsg = `⚠️ ATENÇÃO: Deseja APAGAR definitivamente esta venda errada?\n\n` +
        `• Referência: #${v.id.slice(0, 8)}\n` +
        `• Valor: ${valorVenda}\n` +
        `• Data: ${dataVenda}\n` +
        `• Pagamento: ${v.pagamento || "Dinheiro"}\n\n` +
        `O stock de todos os artigos vendidos nesta operação será reposto automaticamente no inventário.`;

    if (!confirm(confirmMsg)) return;

    try {
        const usuarioNome = FABEF.userData?.nome || auth.currentUser?.email || "Operador";

        // 1. Repor stock dos artigos
        const itens = v.itens || v.items || [];
        for (const it of itens) {
            const prodId = it.id || it.produtoId;
            const prod = (FABEF.produtos || []).find(p => p.id === prodId);
            const qtdRepor = numero(it.quantidade || it.qty || 1);
            if (prod) {
                const novoStock = numero(prod.stock) + qtdRepor;
                prod.stock = novoStock;
                if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
                    await updateDoc(produtoRef(prod.id), {
                        stock: novoStock,
                        atualizadoEm: serverTimestamp()
                    }).catch(err => console.warn("Erro ao repor stock do produto:", err));
                }
            }
        }

        // 2. Ajustar caixa do turno se aplicável
        if (FABEF.turnoId && v.turnoId === FABEF.turnoId && FABEF.turno) {
            const totalEstornado = numero(v.total);
            FABEF.turno.totalVendas = Math.max(0, numero(FABEF.turno.totalVendas) - totalEstornado);
            if ((v.pagamento || "").toUpperCase() === "DINHEIRO" || (v.pagamento || "").toUpperCase() === "NUMERÁRIO") {
                FABEF.turno.totalVendasDinheiro = Math.max(0, numero(FABEF.turno.totalVendasDinheiro) - totalEstornado);
            }
            if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
                await updateDoc(doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId), {
                    totalVendas: FABEF.turno.totalVendas,
                    totalVendasDinheiro: FABEF.turno.totalVendasDinheiro || 0
                }).catch(e => console.warn("Aviso ao atualizar turno:", e));
            }
            atualizarTelaCaixa();
        }

        // 3. Deletar do Firestore
        if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
            await deleteDoc(doc(db, "empresas", FABEF.empresaId, "vendas", vendaId));
        }

        // 4. Remover do estado local
        FABEF.vendas = (FABEF.vendas || []).filter(x => x.id !== vendaId);
        if (FABEF._raw?.vendas) {
            FABEF._raw.vendas = FABEF._raw.vendas.filter(x => x.id !== vendaId);
        }
        if (FABEF.vendasTurno) {
            FABEF.vendasTurno = FABEF.vendasTurno.filter(x => x.id !== vendaId);
        }

        // 5. Auditoria
        await gravarAuditoria(`🗑️ VENDA APAGADA (#${v.id.slice(0, 8)} - ${valorVenda}) por ${usuarioNome}. O stock dos artigos foi reposto.`, "ALERTA");

        // 6. Fechar modal se aberto e atualizar ecrãs
        fecharModal("modal-editar-venda");
        renderVendas();
        renderProdutos();
        renderInventario();
        renderDashboard();

        alert(`✅ Venda apagada com sucesso!\nO valor de ${valorVenda} foi removido e o stock dos produtos foi reposto.`);
    } catch (err) {
        console.error("Erro ao apagar venda:", err);
        alert("Erro ao apagar venda:\n" + (err.message || err));
    }
};

window.abrirModalEncomendaFalhada = function(encomendaId) {
    const e = (FABEF.encomendas || []).find(x => x.id === encomendaId);
    if (!e) { alert("Encomenda não localizada."); return; }

    const elId = document.getElementById("falha-encomenda-id");
    const elRef = document.getElementById("falha-encomenda-ref");
    const elCli = document.getElementById("falha-encomenda-cliente");
    const elJust = document.getElementById("falha-encomenda-justificativa");

    if (elId) elId.value = e.id;
    if (elRef) elRef.textContent = "#" + e.id.slice(0, 8);
    if (elCli) elCli.textContent = e.cliente || "Cliente";
    if (elJust) elJust.value = "";

    document.getElementById("modal-encomenda-falhada")?.classList.add("show");
};

document.getElementById("btn-confirmar-encomenda-falhada")?.addEventListener("click", async () => {
    const encomendaId = document.getElementById("falha-encomenda-id")?.value;
    const justificativa = (document.getElementById("falha-encomenda-justificativa")?.value || "").trim();

    if (!justificativa) {
        alert("⚠️ Campo Obrigatório:\nPor favor, escreva a justificativa para o Gerente explicando porque a encomenda falhou ou foi cancelada.");
        document.getElementById("falha-encomenda-justificativa")?.focus();
        return;
    }

    const e = (FABEF.encomendas || []).find(x => x.id === encomendaId);
    if (!e) { alert("Encomenda não encontrada."); return; }

    try {
        const usuarioNome = FABEF.userData?.nome || auth.currentUser?.email || "Funcionário";
        const payload = {
            estado: "CANCELADA",
            justificativaGerente: justificativa,
            canceladaPor: usuarioNome,
            canceladaEm: new Date().toISOString()
        };

        await updateDoc(doc(db, "empresas", FABEF.empresaId, "encomendas", encomendaId), payload);
        Object.assign(e, payload);

        await gravarAuditoria(`⚠️ ENCOMENDA CANCELADA (${e.cliente} - ${dinheiro(e.valorTotal)}) por ${usuarioNome}. Motivo ao Gerente: "${justificativa}"`, "ALERTA");

        fecharModal("modal-encomenda-falhada");
        renderEncomendas();
        alert("A encomenda foi cancelada e a justificativa foi arquivada para o Gerente na auditoria.");
    } catch (error) {
        console.error("Erro ao cancelar encomenda:", error);
        alert("Erro ao registar o cancelamento da encomenda:\n" + mensagemFirebase(error));
    }
});

document.getElementById("btn-toggle-dark")?.addEventListener("click",()=>{
    const corpoApp=document.body; corpoApp.classList.toggle("dark-mode");
    const escuro=corpoApp.classList.contains("dark-mode");
    document.getElementById("btn-toggle-dark").textContent=escuro?"☀️ Modo Claro":"🌙 Modo Escuro";
    try{localStorage.setItem("FABEF_dark_mode",escuro?"1":"0");}catch(e){}
});
try{if(localStorage.getItem("FABEF_dark_mode")==="1"){document.body.classList.add("dark-mode");const b=document.getElementById("btn-toggle-dark");if(b)b.textContent="☀️ Modo Claro";}}catch(e){}

/* =====================================================
   MÓDULO LÓGICO: RECONCILIAÇão DE STOCK (CONFLITOS OFFLINE)
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
                `⚠️ Reconciliação necessária: o produto "${p.nome}" ficou com stock negativo (${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + p.unidade : ""}). Isto normalmente acontece quando dois dispositivos venderam offline o mesmo produto ao mesmo tempo, antes de sincronizar.`,
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
            <strong>⚠️ Reconciliação de stock necessária (${negativos.length})</strong>
            <p style="margin:6px 0;font-size:13px;">
                Estes produtos ficaram com stock negativo — normalmente porque dois dispositivos
                venderam offline o mesmo produto ao mesmo tempo, antes de sincronizar. Confirme a
                quantidade real na loja e corrija em Inventário → "⚙️ Ajustar".
            </p>
            <ul style="margin:6px 0 0 18px;font-size:13px;">
                ${negativos.map(p => `<li><strong>${escapeHTML(p.nome)}</strong>: stock atual ${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + escapeHTML(p.unidade) : ""}</li>`).join("")}
            </ul>
        </div>
    `;
}


function renderDashboard() {
    renderAvisoReconciliacao();

    const configRamo = typeof obterConfiguracaoRamo === "function" ? obterConfiguracaoRamo(FABEF.ramo) : (FABEF.empresa || {});
    const indicadorEmpresa = document.getElementById("inicio-empresa");
    const painelNomeNegocio = document.getElementById("inicio-nome-negocio");
    const painelIdEmpresa = document.getElementById("inicio-id-empresa");
    const painelUtilizador = document.getElementById("inicio-utilizador");
    const painelRamo = document.getElementById("inicio-ramo");

    const nomeDoNegocio = configRamo.nome || FABEF.ramo || FABEF.empresa?.nome || "—";
    if (indicadorEmpresa) indicadorEmpresa.textContent = nomeDoNegocio;
    if (painelNomeNegocio) painelNomeNegocio.textContent = nomeDoNegocio;
    if (painelIdEmpresa) painelIdEmpresa.textContent = configRamo.idPersonalizado || FABEF.empresa?.idPersonalizado || FABEF.empresaId || "—";
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

    renderGraficoVendas(window.FABEF_GRAFICO_DIAS || 7);
}


/* =====================================================
   MÓDULO CENTRAL: INTERCONEXão E REFRESH EM MASSA (RENDER TUDO)
===================================================== */

/* =====================================================
   MÓDULO LÓGICO: HISTÓRICO DE AUDITORIA (VISUALIZAÇão)
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
   MÓDULO LÓGICO: DESEMPENHO DOS FUNCIONÁRIOS (AVALIAÇÃO DO GERENTE)
   O gerente é quem define metas e avalia o desempenho dos funcionários.
   O desempenho é exclusivamente para os funcionários da empresa.
===================================================== */
function renderDesempenho() {
    const corpo = document.getElementById("tabela-desempenho");
    if (!corpo) return;

    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    const listaFuncionarios = (FABEF.funcionarios || []).filter(f => !f.ramo || f.ramo === FABEF.ramo);

    const todasVendas = (FABEF.vendas && FABEF.vendas.length > 0) ? FABEF.vendas : (FABEF._raw?.vendas || []);

    corpo.innerHTML = listaFuncionarios.map(func => {
        // Vendas realizadas por este funcionário
        const vendasFunc = todasVendas.filter(v => {
            const ehOperador = v.operadorId === func.id || v.operadorNome === func.nome;
            const ehCancelada = v.status === "FALHADA_CANCELADA" || v.status === "CANCELADA";
            return ehOperador && !ehCancelada;
        });

        const valorVendido = vendasFunc.reduce((s, v) => s + numero(v.total), 0);
        const descontos = vendasFunc.reduce((s, v) => s + numero(v.desconto), 0);

        // Calcula total de kg vendidos por este funcionário
        let kgVendidos = 0;
        vendasFunc.forEach(v => {
            const itens = v.itens || v.items || [];
            itens.forEach(it => {
                const un = (it.unidade || "").toLowerCase();
                const q = numero(it.quantidade);
                if (un === "kg") kgVendidos += q;
                else if (un === "g") kgVendidos += (q / 1000);
            });
        });

        // Gastos na conta do funcionário
        const gastosFunc = (FABEF.gastosFuncionarios || []).filter(g => g.funcionarioId === func.id);
        const totalGastos = gastosFunc.reduce((s, g) => s + numero(g.valor), 0);

        const encomendasFunc = (FABEF.encomendas || []).filter(e => e.criadoPor === func.id || e.atribuidoA === func.id).length;
        const dividasFunc = (FABEF.dividas || []).filter(d => d.criadoPor === func.id).length;

        const avaliacaoAtual = func.avaliacaoGerente || "Bom / Satisfatório";

        const seletorAvaliacao = souGerente ? `
            <select style="font-size:12px;padding:4px 8px;border-radius:6px;border:1.5px solid #cbd5e1;font-weight:700;background:#fff;" onchange="salvarAvaliacaoFuncionario('${escapeHTML(func.id)}', this.value)">
                <option value="🌟 Excelente" ${avaliacaoAtual.includes('Excelente') ? 'selected' : ''}>🌟 Excelente</option>
                <option value="👍 Muito Bom" ${avaliacaoAtual.includes('Muito Bom') ? 'selected' : ''}>👍 Muito Bom</option>
                <option value="🆗 Bom / Satisfatório" ${avaliacaoAtual.includes('Satisfatório') || avaliacaoAtual === 'Bom' ? 'selected' : ''}>🆗 Bom / Satisfatório</option>
                <option value="⚠️ Precisa Melhorar" ${avaliacaoAtual.includes('Melhorar') ? 'selected' : ''}>⚠️ Precisa Melhorar</option>
                <option value="🚨 Fraco / Alerta" ${avaliacaoAtual.includes('Fraco') ? 'selected' : ''}>🚨 Fraco / Alerta</option>
            </select>
        ` : `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">${escapeHTML(avaliacaoAtual)}</span>`;

        return `<tr>
            <td>
                <strong>${escapeHTML(func.nome)}</strong>
                <small style="display:block;color:#64748b;">${escapeHTML(func.email || func.telefone || '')}</small>
            </td>
            <td><strong>${vendasFunc.length}</strong></td>
            <td><strong style="color:#0284c7;">${kgVendidos > 0 ? `${kgVendidos.toFixed(3)} kg` : '0 kg'}</strong></td>
            <td><strong style="color:#059669;">${dinheiro(valorVendido)}</strong></td>
            <td>
                <span style="color:#b45309;font-weight:800;">${dinheiro(totalGastos)}</span>
                ${gastosFunc.length > 0 ? `<button type="button" class="btn btn-small btn-light" onclick="mostrarSecao('funcionarios')" style="padding:1px 6px;font-size:11px;margin-left:4px;" title="Ver detalhes de gastos">👁️</button>` : ''}
            </td>
            <td>${descontos > 0 ? dinheiro(descontos) : 'MT 0,00'}</td>
            <td>${encomendasFunc}</td>
            <td>${dividasFunc}</td>
            <td>${seletorAvaliacao}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:16px;">Sem funcionários cadastrados para avaliação no ramo atual.</td></tr>`;
}

window.salvarAvaliacaoFuncionario = async function(funcionarioId, avaliacao) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o Gerente tem permissão para avaliar os funcionários.");
        return;
    }
    try {
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "funcionarios", funcionarioId), {
            avaliacaoGerente: avaliacao,
            avaliadoEm: serverTimestamp()
        });
        const func = (FABEF.funcionarios || []).find(x => x.id === funcionarioId);
        if (func) func.avaliacaoGerente = avaliacao;
        await gravarAuditoria(`Gerente avaliou o desempenho do funcionário "${func?.nome || funcionarioId}" como: ${avaliacao}.`, "INFO");
    } catch(err) {
        console.error("Erro ao salvar avaliação do funcionário:", err);
        alert("Erro ao guardar avaliação:\n" + mensagemFirebase(err));
    }
};

/* =====================================================
   MÓDULO LÓGICO: GASTOS NA CONTA DO FUNCIONÁRIO (VALES, ADIANTAMENTOS)
===================================================== */
function popularSelectFuncionariosGasto(funcionarioId) {
    const select = document.getElementById("gasto-func-select");
    if (!select) return;

    const options = [];
    const gerenteId = "gerente_" + (FABEF.user?.uid || "admin");
    const gerenteNome = FABEF.userData?.nome || "Gerente Principal";

    // 1. Opção do Gerente Principal
    options.push({
        id: gerenteId,
        nome: `${gerenteNome} (Gerente Principal - Todos os Ramos)`,
        selected: funcionarioId === gerenteId || (!funcionarioId && !(FABEF.funcionarios || []).length)
    });

    // 2. Todos os funcionários da empresa
    const funcs = FABEF.funcionarios || [];
    funcs.forEach(f => {
        const ramoTxt = f.ramo ? ` [${f.ramo}]` : '';
        const telTxt = f.telefone || f.email || 'Funcionário';
        options.push({
            id: f.id,
            nome: `${f.nome}${ramoTxt} (${telTxt})`,
            selected: funcionarioId === f.id
        });
    });

    select.innerHTML = options.map(opt => `<option value="${escapeHTML(opt.id)}" ${opt.selected ? 'selected' : ''}>${escapeHTML(opt.nome)}</option>`).join("");
    if (funcionarioId) {
        select.value = funcionarioId;
    }
}

window.abrirModalGastoFuncionario = function(funcionarioId) {
    const modal = document.getElementById("modal-gasto-funcionario");
    if (!modal) return;

    popularSelectFuncionariosGasto(funcionarioId);

    const inputData = document.getElementById("gasto-func-data");
    if (inputData) inputData.value = dataHojeStr();

    const inputValor = document.getElementById("gasto-func-valor");
    if (inputValor) inputValor.value = "";

    const inputDesc = document.getElementById("gasto-func-descricao");
    if (inputDesc) inputDesc.value = "";

    modal.classList.add("show");
    setTimeout(() => inputValor?.focus(), 150);
};

window.abrirModalAdiantamentoSalarial = function(funcionarioId) {
    const modal = document.getElementById("modal-gasto-funcionario");
    if (!modal) return;

    popularSelectFuncionariosGasto(funcionarioId);

    const selectTipo = document.getElementById("gasto-func-tipo");
    if (selectTipo) selectTipo.value = "Adiantamento de Salário (Vale)";

    const inputData = document.getElementById("gasto-func-data");
    if (inputData) inputData.value = dataHojeStr();

    const inputValor = document.getElementById("gasto-func-valor");
    if (inputValor) inputValor.value = "";

    const inputDesc = document.getElementById("gasto-func-descricao");
    if (inputDesc) inputDesc.value = "Adiantamento salarial / vale a descontar no final do mês";

    const chkDespesa = document.getElementById("gasto-func-lancar-despesa");
    if (chkDespesa) chkDespesa.checked = true;

    modal.classList.add("show");
    setTimeout(() => inputValor?.focus(), 150);
};

document.getElementById("btn-abrir-modal-gasto-func")?.addEventListener("click", () => {
    abrirModalGastoFuncionario();
});

document.getElementById("btn-adiantamento-salarial")?.addEventListener("click", () => {
    abrirModalAdiantamentoSalarial();
});

document.getElementById("btn-salvar-gasto-funcionario")?.addEventListener("click", async () => {
    const selectFunc = document.getElementById("gasto-func-select");
    const funcionarioId = selectFunc?.value;
    const funcionarioNome = selectFunc?.options[selectFunc.selectedIndex]?.text?.split(" (")[0] || "Funcionário";
    const tipoGasto = document.getElementById("gasto-func-tipo")?.value || "Adiantamento de Salário (Vale)";
    const valor = numero(document.getElementById("gasto-func-valor")?.value);
    const dataGasto = document.getElementById("gasto-func-data")?.value || dataHojeStr();
    const descricao = (document.getElementById("gasto-func-descricao")?.value || "").trim();
    const lancarDespesa = Boolean(document.getElementById("gasto-func-lancar-despesa")?.checked);

    if (!funcionarioId) {
        alert("Selecione o funcionário para registar o gasto na conta.");
        return;
    }
    if (isNaN(valor) || valor <= 0) {
        alert("Indique um valor válido para o gasto.");
        document.getElementById("gasto-func-valor")?.focus();
        return;
    }
    if (!descricao) {
        alert("Por favor, descreva o motivo do gasto na conta do funcionário.");
        document.getElementById("gasto-func-descricao")?.focus();
        return;
    }

    try {
        const quemRegistou = FABEF.userData?.nome || auth.currentUser?.email || "Gerente";
        const payloadGasto = {
            funcionarioId,
            funcionarioNome,
            tipo: tipoGasto,
            valor,
            data: dataGasto,
            descricao,
            lancarDespesa,
            ramo: FABEF.ramo,
            registadoPor: quemRegistou,
            criadoEm: serverTimestamp()
        };

        let idGasto = "gasto_" + Date.now();
        if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
            try {
                const ref = await addDoc(subRef("gastos_funcionarios"), payloadGasto);
                idGasto = ref.id;
            } catch (fbErr) {
                console.warn("Aviso ao guardar gasto no Firestore:", fbErr);
            }
        }

        if (!FABEF.gastosFuncionarios) FABEF.gastosFuncionarios = [];
        FABEF.gastosFuncionarios.push({ id: idGasto, ...payloadGasto, criadoEm: undefined });

        // Guarda cópia no armazenamento local para resiliência imediata
        try {
            localStorage.setItem("fabef_local_gastos_" + FABEF.empresaId, JSON.stringify(FABEF.gastosFuncionarios || []));
        } catch(e) {}

        // Lança também como despesa operacional se solicitado
        if (lancarDespesa) {
            const payloadDesp = {
                descricao: `Gasto Func.: ${funcionarioNome} (${tipoGasto} - ${descricao})`,
                valor,
                categoria: "Pessoal / Salários",
                data: dataGasto,
                turnoId: FABEF.turnoId || null,
                ramo: FABEF.ramo,
                criadoPor: quemRegistou,
                criadoEm: serverTimestamp()
            };
            if (!window.FABEF?.isDemoMode && db && FABEF.empresaId) {
                await addDoc(subRef("despesas"), payloadDesp).catch(e => console.warn("Aviso ao registar despesa reflexa:", e));
            }
            if (!FABEF.despesas) FABEF.despesas = [];
            FABEF.despesas.push({ id: "desp_" + Date.now(), ...payloadDesp });
            if (typeof renderDespesas === "function") renderDespesas();
        }

        await gravarAuditoria(`💳 GASTO NA CONTA: Registado ${dinheiro(valor)} para o funcionário ${funcionarioNome} (${tipoGasto} - "${descricao}") por ${quemRegistou}.`, "INFO");

        fecharModal("modal-gasto-funcionario");
        renderGastosFuncionarios();
        renderFuncionarios();
        if (typeof renderDesempenho === "function") renderDesempenho();

        alert(`✅ Registado com sucesso na conta de ${funcionarioNome}!\n\nTipo: ${tipoGasto}\nValor: ${dinheiro(valor)}`);
    } catch(err) {
        console.error("Erro ao guardar gasto do funcionário:", err);
        alert("Erro ao guardar gasto:\n" + (err.message || err));
    }
});

function renderGastosFuncionarios() {
    const corpo = document.getElementById("tabela-gastos-funcionarios");
    if (!corpo) return;

    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";
    const lista = (FABEF.gastosFuncionarios || [])
        .filter(g => souGerente || !g.ramo || g.ramo === FABEF.ramo)
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    corpo.innerHTML = lista.map(g => `
        <tr>
            <td>${dataTexto(g.data)}</td>
            <td><strong>${escapeHTML(g.funcionarioNome || "Funcionário")}</strong></td>
            <td><span class="badge badge-yellow">${escapeHTML(g.tipo || "Gasto")}</span></td>
            <td><strong style="color:#b45309;">${dinheiro(g.valor)}</strong></td>
            <td>${escapeHTML(g.descricao || "—")}${g.lancarDespesa ? ' <small style="color:#059669;font-weight:600;">(lançado em despesas)</small>' : ''}</td>
            <td>${escapeHTML(g.registadoPor || "—")}</td>
            <td>${souGerente ? `
                <button class="btn btn-danger btn-small" type="button" onclick="eliminarGastoFuncionario('${escapeHTML(g.id)}')" title="Eliminar registo de gasto">🗑️</button>
            ` : "—"}</td>
        </tr>
    `).join("") || `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:14px;">Ainda não há gastos ou vales registados na conta dos funcionários.</td></tr>`;
}

window.eliminarGastoFuncionario = async function(gastoId) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o gerente pode eliminar registos de gastos.");
        return;
    }
    if (!confirm("Tem a certeza que deseja eliminar este registo de gasto na conta do funcionário?")) return;

    try {
        await deleteDoc(doc(db, "empresas", FABEF.empresaId, "gastos_funcionarios", gastoId));
        FABEF.gastosFuncionarios = (FABEF.gastosFuncionarios || []).filter(g => g.id !== gastoId);
        try {
            localStorage.setItem("fabef_local_gastos_" + FABEF.empresaId, JSON.stringify(FABEF.gastosFuncionarios || []));
        } catch(e) {}
        await gravarAuditoria(`Gerente eliminou registo de gasto de funcionário (#${gastoId.slice(0, 6)}).`, "ALERTA");
        renderGastosFuncionarios();
        renderFuncionarios();
        renderDesempenho();
        alert("Registo de gasto removido.");
    } catch(err) {
        console.error("Erro ao eliminar gasto:", err);
        alert("Erro ao eliminar gasto:\n" + mensagemFirebase(err));
    }
};

/* =====================================================
   MÓDULO LÓGICO: REGISTO RÁPIDO DE CLIENTE & DÍVIDAS NO POS
===================================================== */
document.getElementById("btn-pos-novo-cliente")?.addEventListener("click", () => {
    const modal = document.getElementById("modal-pos-rapido-cliente");
    if (!modal) return;
    const inputNome = document.getElementById("pos-rapido-cliente-nome");
    const inputTel = document.getElementById("pos-rapido-cliente-telefone");
    const inputLim = document.getElementById("pos-rapido-cliente-limite");
    if (inputNome) inputNome.value = "";
    if (inputTel) inputTel.value = "";
    if (inputLim) inputLim.value = "";
    modal.classList.add("show");
    setTimeout(() => inputNome?.focus(), 150);
});

document.getElementById("btn-salvar-pos-rapido-cliente")?.addEventListener("click", async () => {
    let perfilAtual = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfilAtual = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfilAtual = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }

    if (perfilAtual === "gerente") {
        alert("🔒 Acesso Restrito:\n\nO Gerente não tem permissão para registar clientes. Esta missão é exclusiva dos Funcionários no atendimento.");
        return;
    }

    const nome = (document.getElementById("pos-rapido-cliente-nome")?.value || "").trim();
    const telefone = (document.getElementById("pos-rapido-cliente-telefone")?.value || "").trim();
    const limiteCredito = numero(document.getElementById("pos-rapido-cliente-limite")?.value) || 0;

    if (!nome) {
        alert("Introduza o nome do cliente.");
        document.getElementById("pos-rapido-cliente-nome")?.focus();
        return;
    }

    try {
        const payload = {
            nome,
            telefone,
            limiteCredito,
            ramo: FABEF.ramo,
            criadoPor: FABEF.userData?.nome || auth.currentUser?.email || "Operador",
            criadoEm: serverTimestamp()
        };

        const ref = await addDoc(subRef("clientes"), payload);
        const novoCli = { id: ref.id, ...payload, criadoEm: undefined };
        if (!FABEF.clientes) FABEF.clientes = [];
        FABEF.clientes.push(novoCli);

        // Preenche automaticamente o campo no POS
        const campoPos = document.getElementById("pos-cliente-nome");
        if (campoPos) campoPos.value = nome;

        // Atualiza a datalist
        const listaClientesPos = document.getElementById("lista-clientes-pos");
        if (listaClientesPos) {
            listaClientesPos.innerHTML = FABEF.clientes.map(c => `<option value="${escapeHTML(c.nome)}">`).join("");
        }

        fecharModal("modal-pos-rapido-cliente");
        renderClientes();
        await gravarAuditoria(`Cadastrou novo cliente "${nome}" via balcão do POS.`, "INFO");
        alert(`✅ Cliente "${nome}" registado com sucesso!`);
    } catch(err) {
        console.error("Erro ao criar cliente:", err);
        alert("Erro ao criar cliente:\n" + mensagemFirebase(err));
    }
});

document.getElementById("btn-pos-ver-dividas")?.addEventListener("click", () => {
    mostrarSecao("dividas");
});


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
                <button class="btn btn-success btn-small" type="button" onclick="marcarSugestao('${escapeHTML(s.id)}','ADICIONADA')">✔️ Adicionar ao catálogo</button>
                <button class="btn btn-light btn-small" type="button" onclick="marcarSugestao('${escapeHTML(s.id)}','REJEITADA')">✖️ Rejeitar</button>
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
    if (typeof renderGastosFuncionarios === "function") renderGastosFuncionarios();
    if (typeof renderDispensas === "function") renderDispensas();
    if (typeof renderAuditoria === "function") renderAuditoria();
    if (typeof renderMetas === "function") renderMetas();
    if (typeof renderDesempenho === "function") renderDesempenho();
    if (typeof renderSugestoes === "function") renderSugestoes();
    if (typeof renderSugestoesComprasRamo === "function") renderSugestoesComprasRamo();
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
   INICIALIZAÇão SISTÉMICA E CONFIGURAÇÕES VISUAIS
===================================================== */

const diaAtivoElement = document.getElementById("fabef-dia-ativo");
if (diaAtivoElement) {
    diaAtivoElement.value = FABEF.dataAtiva;
    diaAtivoElement.addEventListener("change", e => definirDiaAtivo(e.target.value));
}

const selectIdiomaElement = document.getElementById("select-idioma");
if (selectIdiomaElement) {
    selectIdiomaElement.value = "pt";
}

/*
 OBSERVAÇão CRÍTICA DE PROCESSO:
 A interface da aplicação permanece totalmente oculta (.hidden) até que o 
 gatilho onAuthStateChanged confirme o token do utilizador junto à nuvem.
*/

/* =====================================================
   MODO DEMONSTRAÇão (TESTE RÁPIDO 1-CLIQUE)
===================================================== */
async function entrarModoDemo() {
    const telaLogin = document.getElementById("tela-login");
    if (telaLogin) telaLogin.style.display = "none";
    esconderEcraPin();
    
    window.FABEF.isDemoMode = true;
    window.FABEF.empresaId = "empresa-demo-01";
    window.FABEF.empresa = {
        id: "empresa-demo-01",
        nome: "Supermercado & Talho Central FABEF PRO",
        telefone: "+258 84 123 4567",
        nuit: "400892019",
        endereco: "Av. Eduardo Mondlane nº 104, Bairro Central",
        cidade: "Maputo",
        moeda: "MT",
        ivaRegime: "normal",
        ivaTaxa: 16,
        rodapeRecibo: "Obrigado pela preferência! Carne e produtos frescos todos os dias.",
        gerenteId: "demo-user-01",
        ramo_ativo: "Mercearia / Minimercado",
        ramos_atividade: ["Mercearia / Minimercado", "Talho / Açougue", "Supermercado"],
        estado_licenca: "ATIVO",
        subscricao_paga: true,
        validade_subscricao: "2030-12-31T23:59:59.000Z",
        valor_mensalidade_atual: 250
    };
    window.FABEF.user = {
        uid: "demo-user-01",
        email: "demo@fabef-erp.mz"
    };
    window.FABEF.userData = {
        uid: "demo-user-01",
        nome: "Faruque Abílio (Admin / Gerente)",
        email: "demo@fabef-erp.mz",
        role: "gerente",
        perfil: "gerente",
        estado: "ATIVO"
    };
    window.FABEF.ramo = "Mercearia / Minimercado";
    
    window.FABEF.produtos = [
        // Carnes e Produtos Pesados no Talho / Banca (kg)
        { id: "prod-carne-1", nome: "Carne de Novilho / Alcatra Fresca", preco: 420, custo: 320, stock: 48.5, unidade: "kg", categoria: "Carnes Bovinas", codigoBarras: "600123456720", ramo: "Mercearia / Minimercado" },
        { id: "prod-carne-2", nome: "Costeletas de Vaca de 1ª", preco: 380, custo: 290, stock: 32.25, unidade: "kg", categoria: "Carnes Bovinas", codigoBarras: "600123456721", ramo: "Mercearia / Minimercado" },
        { id: "prod-carne-3", nome: "Carne Moída / Picada Especial", preco: 350, custo: 260, stock: 25.0, unidade: "kg", categoria: "Carnes Moídas", codigoBarras: "600123456722", ramo: "Mercearia / Minimercado" },
        { id: "prod-carne-4", nome: "Peito de Frango Desossado", preco: 290, custo: 210, stock: 30.0, unidade: "kg", categoria: "Aves", codigoBarras: "600123456723", ramo: "Mercearia / Minimercado" },
        { id: "prod-carne-5", nome: "Lombo de Porco Fresco", preco: 340, custo: 250, stock: 18.75, unidade: "kg", categoria: "Suínos", codigoBarras: "600123456724", ramo: "Mercearia / Minimercado" },
        { id: "prod-carne-6", nome: "Peixe Pescada do Indico Fresco", preco: 310, custo: 230, stock: 22.4, unidade: "kg", categoria: "Pescado", codigoBarras: "600123456725", ramo: "Mercearia / Minimercado" },

        // Artigos de Mercearia e Retalho
        { id: "prod-1", nome: "Arroz Basmati Cigala 25kg", preco: 1650, custo: 1320, stock: 45, unidade: "saco", categoria: "Alimentação Básica", codigoBarras: "600123456701", ramo: "Mercearia / Minimercado" },
        { id: "prod-2", nome: "Óleo Alimentar Mariana 5L", preco: 580, custo: 450, stock: 28, unidade: "garrafa", categoria: "Alimentação Básica", codigoBarras: "600123456702", ramo: "Mercearia / Minimercado" },
        { id: "prod-3", nome: "Açúcar Castanho Maragra 1kg", preco: 65, custo: 50, stock: 120, unidade: "kg", categoria: "Mercearia", codigoBarras: "600123456703", ramo: "Mercearia / Minimercado" },
        { id: "prod-4", nome: "Farinha de Milho Chaimite 10kg", preco: 480, custo: 390, stock: 35, unidade: "saco", categoria: "Cereais", codigoBarras: "600123456704", ramo: "Mercearia / Minimercado" },
        { id: "prod-5", nome: "Sabão em Barra Sunlight 1kg", preco: 95, custo: 70, stock: 65, unidade: "barra", categoria: "Higiene & Limpeza", codigoBarras: "600123456705", ramo: "Mercearia / Minimercado" },
        { id: "prod-6", nome: "Leite em Pó Nido 400g", preco: 340, custo: 265, stock: 30, unidade: "lata", categoria: "Lacticínios", codigoBarras: "600123456706", ramo: "Mercearia / Minimercado" },
        { id: "prod-7", nome: "Refrigerante Coca-Cola 330ml", preco: 45, custo: 30, stock: 140, unidade: "lata", categoria: "Bebidas", codigoBarras: "600123456707", ramo: "Mercearia / Minimercado" },
        { id: "prod-8", nome: "Cerveja 2M Garrafa 550ml", preco: 70, custo: 52, stock: 96, unidade: "garrafa", categoria: "Bebidas", codigoBarras: "600123456708", ramo: "Mercearia / Minimercado" },
        { id: "prod-9", nome: "Água Mineral Namaacha 1.5L", preco: 35, custo: 22, stock: 85, unidade: "garrafa", categoria: "Bebidas", codigoBarras: "600123456709", ramo: "Mercearia / Minimercado" }
    ];

    window.FABEF.clientes = [
        { id: "cli-1", nome: "Amélia Cossa", telefone: "84 321 6540", nuit: "109283741", endereco: "Bairro Polana Caniço", limiteCredito: 5000, totalComprado: 14500, divida: 450 },
        { id: "cli-2", nome: "João Machava", telefone: "82 456 7890", nuit: "108765432", endereco: "Av. 24 de Julho", limiteCredito: 3000, totalComprado: 8900, divida: 0 },
        { id: "cli-3", nome: "Helena Tembe", telefone: "87 111 2233", nuit: "102938475", endereco: "Bairro Malhangalene", limiteCredito: 10000, totalComprado: 24500, divida: 1200 }
    ];

    window.FABEF.fornecedores = [
        { id: "forn-1", nome: "Distribuidora Nacional de Produtos Lda", telefone: "+258 21 400 500", nuit: "400123891", email: "comercial@distribuidora.co.mz", contacto: "Sr. Carlos Tembe" },
        { id: "forn-2", nome: "Moçambique Alimentos & Cereais SA", telefone: "+258 21 300 200", nuit: "400987654", email: "vendas@mocalimentos.mz", contacto: "Dra. Marta Sitoe" }
    ];

    const turnoId = "turno-demo-" + Date.now();
    window.FABEF.turnoId = turnoId;
    window.FABEF.turno = {
        id: turnoId,
        operadorId: "demo-user-01",
        operadorNome: "Faruque Abílio",
        abertura: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        saldoInicial: 2500,
        totalVendas: 7280,
        totalVendasDinheiro: 4500,
        totalVendasMpesa: 2780,
        sangrias: [{ valor: 500, motivo: "Pagamento de transporte frete", data: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }],
        reforcos: [{ valor: 1000, motivo: "Troco notas miúdas para caixa", data: new Date(Date.now() - 3 * 3600 * 1000).toISOString() }],
        fechado: false,
        estado: "ABERTO"
    };
    window.FABEF.caixas_turnos = [window.FABEF.turno];

    window.FABEF.vendas = [
        {
            id: "venda-01",
            total: 1650,
            subtotal: 1650,
            desconto: 0,
            pagamento: "M-Pesa",
            cliente: "Amélia Cossa",
            nuitCliente: "109283741",
            operadorNome: "Faruque Abílio",
            data: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            itens: [{ nome: "Arroz Basmati Cigala 25kg", quantidade: 1, preco: 1650, subtotal: 1650, unidade: "saco" }]
        },
        {
            id: "venda-02",
            total: 525,
            subtotal: 525,
            desconto: 0,
            pagamento: "Dinheiro",
            cliente: "João Machava",
            nuitCliente: "108765432",
            operadorNome: "Faruque Abílio",
            data: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
            itens: [
                { nome: "Carne de Novilho / Alcatra Fresca", quantidade: 1.25, preco: 420, subtotal: 525, unidade: "kg" }
            ]
        },
        {
            id: "venda-03",
            total: 262.5,
            subtotal: 262.5,
            desconto: 0,
            pagamento: "Dinheiro",
            cliente: "Consumidor Final",
            operadorNome: "Faruque Abílio",
            data: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
            itens: [{ nome: "Carne Moída / Picada Especial", quantidade: 0.75, preco: 350, subtotal: 262.5, unidade: "kg" }]
        }
    ];

    window.FABEF.dividas = [
        { id: "div-1", cliente: "Helena Tembe", telefone: "87 111 2233", valorTotal: 1200, valorPago: 0, valorPendente: 1200, estado: "PENDENTE", data: new Date(Date.now() - 3 * 86400 * 1000).toISOString() },
        { id: "div-2", cliente: "Amélia Cossa", telefone: "84 321 6540", valorTotal: 450, valorPago: 0, valorPendente: 450, estado: "PENDENTE", data: new Date(Date.now() - 6 * 86400 * 1000).toISOString() }
    ];

    window.FABEF.despesas = [
        { id: "desp-1", descricao: "Electricidade EDM (Factura Mensal)", valor: 1500, categoria: "Energia", data: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), operador: "Faruque Abílio" },
        { id: "desp-2", descricao: "Águas da Região de Maputo Fipag", valor: 450, categoria: "Água", data: new Date(Date.now() - 5 * 86400 * 1000).toISOString(), operador: "Faruque Abílio" },
        { id: "desp-3", descricao: "Transporte e Frete de Mercadoria", valor: 800, categoria: "Logística", data: new Date(Date.now() - 1 * 86400 * 1000).toISOString(), operador: "Faruque Abílio" }
    ];

    window.FABEF.encomendas = [
        { id: "enc-1", cliente: "Restaurante Zambi", telefone: "84 999 8877", total: 4950, estado: "Pendente", itens: [{ nome: "Arroz Basmati 25kg", quantidade: 3, preco: 1650 }], data: new Date(Date.now() - 4 * 3600 * 1000).toISOString() }
    ];

    window.FABEF.funcionarios = [
        { id: "func-1", nome: "Faruque Abílio", email: "gerente@fabef.mz", role: "gerente", perfil: "gerente", telefone: "84 000 0001", estado: "ATIVO", ramo: "Mercearia / Minimercado" },
        { id: "func-2", nome: "Maria Santos", email: "caixa1@fabef.mz", role: "funcionario", perfil: "funcionario", telefone: "84 000 0002", estado: "ATIVO", ramo: "Mercearia / Minimercado" }
    ];

    window.FABEF.compras = [
        { id: "compra-demo-1", produtoNome: "Arroz Basmati Cigala 25kg", fornecedorNome: "Distribuidora Nacional de Produtos Lda", quantidade: 50, custoUnitario: 1320, pagamento: "Dinheiro", data: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), ramo: "Mercearia / Minimercado" },
        { id: "compra-demo-2", produtoNome: "Carne de Novilho / Alcatra Fresca", fornecedorNome: "Moçambique Alimentos & Cereais SA", quantidade: 60, custoUnitario: 320, pagamento: "M-Pesa", data: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), ramo: "Mercearia / Minimercado" }
    ];

    window.FABEF.auditoria = [
        { id: "aud-1", data: new Date().toISOString(), utilizadorNome: "Sistema Demo", mensagem: "Sessão iniciada em Modo Demonstração com catálogo ativo em Meticais (MT) e carnes pesadas em KG", nivel: "INFO" }
    ];

    window.FABEF.carregado = true;
    
    document.getElementById("app")?.classList.remove("hidden");
    const headerUser = document.getElementById("header-user");
    if (headerUser) {
        headerUser.textContent = window.FABEF.userData.nome;
    }
    
    aplicarRestricoesDeAcessoPorPapel();
    renderTudo();
    toast("🚀 Modo Demonstração ativado! Teste o POS, Venda de Carne por Kg/g, Stock e Recibos.");
}

/* =====================================================
   ALTERNADOR DE PERFIL DEMO (GERENTE VS FUNCIONÁRIO)
===================================================== */
window.alternarPerfilDemo = function(novoPerfil) {
    if (!window.FABEF?.isDemoMode) {
        alert("O alternador rápido de perfil está ativo em Modo Demonstração.");
        return;
    }
    const perfil = novoPerfil || (window.FABEF.userData.role === "gerente" ? "funcionario" : "gerente");
    window.FABEF.userData.role = perfil;
    window.FABEF.userData.perfil = perfil;
    window.FABEF.userData.nome = perfil === "gerente" ? "Faruque Abílio (Gerente)" : "Maria Santos (Caixa / Funcionário)";
    const headerUser = document.getElementById("header-user");
    if (headerUser) headerUser.textContent = window.FABEF.userData.nome;
    aplicarRestricoesDeAcessoPorPapel();
    renderTudo();
    alert(`✅ Perfil alternado para: ${perfil.toUpperCase()}.\n\n${perfil === 'funcionario' ? 'Ramos, compras, relatórios e configurações estão ocultos. O funcionário vai diretamente para Vendas / POS.' : 'Acesso total de Gerente restaurado com gestão de ramos, inventário e relatórios.'}`);
};

// Binds
document.getElementById("btn-demo-mode")?.addEventListener("click", entrarModoDemo);
document.getElementById("btn-abrir-sugestoes")?.addEventListener("click", () => {
    document.getElementById("modal-sugestoes")?.classList.add("show");
});
// Suporte aos botões de impressão de recibo direto e do modal de sucesso
const bindImprimirRecibo = () => {
    if (window.FABEF_ultimaVendaId) window.imprimirReciboVenda(window.FABEF_ultimaVendaId);
};
document.getElementById("btn-recibo-imprimir-direto")?.addEventListener("click", bindImprimirRecibo);
document.getElementById("btn-recibo-imprimir")?.addEventListener("click", bindImprimirRecibo);
// Suporte aos botões de WhatsApp de recibo direto e do modal de sucesso
const bindWhatsAppRecibo = () => {
    if (window.FABEF_ultimaVendaId) window.enviarReciboWhatsApp(window.FABEF_ultimaVendaId);
};
document.getElementById("btn-recibo-whatsapp-direto")?.addEventListener("click", bindWhatsAppRecibo);
document.getElementById("btn-recibo-whatsapp")?.addEventListener("click", bindWhatsAppRecibo);
document.getElementById("btn-recibo-fechar")?.addEventListener("click", () => {
    fecharModal("modal-recibo-sucesso");
});

// Suporte para abrir o modal de alteração de senha a partir da barra lateral
document.getElementById("btn-sidebar-alterar-senha")?.addEventListener("click", () => {
    document.getElementById("senha-status").textContent = "";
    document.getElementById("senha-atual").value = "";
    document.getElementById("senha-nova").value = "";
    document.getElementById("senha-nova-confirmar").value = "";
    document.getElementById("modal-alterar-senha")?.classList.add("show");
});

// Suporte para instalação PWA
let deferredPromptInstalacao = null;
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPromptInstalacao = e;
});

window.acionarInstalacaoPWA = async function() {
    if (deferredPromptInstalacao) {
        deferredPromptInstalacao.prompt();
        const { outcome } = await deferredPromptInstalacao.userChoice;
        if (outcome === "accepted") {
            if (typeof toast === "function") toast("✅ Aplicativo adicionado ao seu ecrã!");
            else alert("✅ Aplicativo instalado com sucesso no seu dispositivo!");
        }
        deferredPromptInstalacao = null;
    } else {
        const modalPWA = document.getElementById("modal-instalar-celular");
        if (modalPWA) {
            modalPWA.classList.add("show");
        } else {
            alert(
                "📱 Como colocar o FABEF ERP no ecrã do seu celular:\n\n" +
                "• No Android (Chrome):\n" +
                "Toque no menu ⋮ (3 pontos) no canto superior direito e selecione 'Instalar aplicativo' ou 'Adicionar ao ecrã principal'.\n\n" +
                "• No iPhone / iPad (Safari):\n" +
                "Toque no botão Partilhar 📤 na barra inferior e toque em 'Adicionar ao Ecrã Principal ➕'."
            );
        }
    }
};

const acionarInstalacaoPWA = window.acionarInstalacaoPWA;

document.getElementById("btn-instalar-app")?.addEventListener("click", window.acionarInstalacaoPWA);
document.getElementById("btn-sidebar-instalar")?.addEventListener("click", window.acionarInstalacaoPWA);
document.getElementById("btn-instalar-app-login")?.addEventListener("click", window.acionarInstalacaoPWA);
document.getElementById("btn-instalar-app-pin")?.addEventListener("click", window.acionarInstalacaoPWA);

// Registo automático do Service Worker para suporte PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(err => {
            console.warn("Aviso ao registar Service Worker PWA:", err);
        });
    });
}


async function abrirCaixaAutomatico(saldoInicial = 0) {
    if (FABEF.turnoId) return FABEF.turnoId;
    const agora = new Date().toISOString();
    const dadosTurno = {
        empresaId: FABEF.empresaId,
        ramo: FABEF.ramo,
        operadorUid: FABEF.user?.uid || "sistema",
        operadorNome: FABEF.userData?.nome || "Operador",
        abertoEm: agora,
        saldoInicial: Number(saldoInicial) || 0,
        estado: "ABERTO",
        totalVendasDinheiro: 0,
        totalVendasMpesa: 0,
        totalVendasEmola: 0,
        totalVendasCartao: 0,
        totalVendasCredito: 0,
        totalEntradas: 0,
        totalSaidas: 0,
        criadoEm: serverTimestamp()
    };
    const refDoc = await addDoc(collection(db, "turnos_caixa"), dadosTurno);
    FABEF.turnoId = refDoc.id;
    FABEF.turno = { id: refDoc.id, ...dadosTurno };
    await gravarAuditoria("Abertura automática de caixa/turno no POS (" + FABEF.ramo + ")", "INFO");
    atualizarTelaCaixa();
    return refDoc.id;
}

// Vinculação do botão de regularização da licença
document.getElementById("btn-pagar-licenca")?.addEventListener("click", () => {
    const bloqueio = document.getElementById("bloqueio-licenca");
    if (bloqueio) {
        bloqueio.classList.remove("show");
        bloqueio.style.display = "none";
    }
    mostrarSecao("subscricao");
});

