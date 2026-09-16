import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
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
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
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
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
   CONFIGURAÃ‡ÃƒO FIREBASE â€” PRODUÃ‡ÃƒO
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

// A sessÃ£o fica guardada no dispositivo (nÃ£o expira ao fechar o navegador/app).
// Isto Ã© necessÃ¡rio para o aplicativo funcionar OFFLINE â€” sem isto, reabrir sem
// internet obrigaria sempre a um novo login, que precisa de rede. A seguranÃ§a de
// "pedir sempre alguma coisa ao reabrir" passa a ser feita pelo ecrÃ£ de PIN local
// (ver mÃ³dulo PIN mais abaixo), que nÃ£o depende de internet.
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Erro ao configurar persistÃªncia de sessÃ£o:", err));

const db = getFirestore(appFirebase);

// Guarda em cache local (IndexedDB) os dados jÃ¡ lidos, para continuarem
// disponÃ­veis sem internet, e permite que escritas feitas offline fiquem
// em fila e sincronizem sozinhas quando a rede voltar.
enableIndexedDbPersistence(db).catch(err => {
    if (err.code === "failed-precondition") {
        console.warn("Modo offline: sÃ³ Ã© suportado numa aba aberta de cada vez.");
    } else if (err.code === "unimplemented") {
        console.warn("Este navegador nÃ£o suporta o modo offline.");
    }
});

/* =====================================================
   POLÃTICA DE OPERAÃ‡Ã•ES CRÃTICAS
   O navegador apenas solicita a operaÃ§Ã£o. A autorizaÃ§Ã£o real
   continua dependente do Firebase Authentication + Firestore Rules.
   NÃ£o existe modo de demonstraÃ§Ã£o nem aprovaÃ§Ã£o local de pagamento.
===================================================== */
const FABEF_PRODUCAO = true;
const FABEF_API_BASE = window.FABEF_API_BASE || "";


/* =====================================================
   ESTADO GLOBAL DA APLICAÃ‡ÃƒO (FABEF GLOBAL MEMORY)
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
    "CalÃ§ados",
    "SalÃ£o de Beleza",
    "Barbearia",
    "Restaurante",
    "Lanchonete",
    "Bar / Bebidas",
    "Pastelaria",
    "Padaria",
    "Doceria / Bolos",
    "Talho / AÃ§ougue",
    "Peixaria",
    "Frutaria",
    "HortÃ­cola",
    "FarmÃ¡cia / Perfumaria",
    "CosmÃ©ticos",
    "Material de ConstruÃ§Ã£o",
    "Ferragem",
    "ElÃ©trica",
    "CanalizaÃ§Ã£o",
    "Serralharia",
    "Serralharia de AlumÃ­nio",
    "VidraÃ§aria",
    "Carpintaria / Marcenaria",
    "Estofaria",
    "Colchoaria",
    "Tintas e Vernizes",
    "InformÃ¡tica",
    "ManutenÃ§Ã£o de Computadores",
    "TelemÃ³veis e AcessÃ³rios",
    "ElectrÃ³nica",
    "Cyber CafÃ©",
    "Papelaria",
    "Papelaria e Material Escolar",
    "Livraria",
    "MÃ³veis",
    "MÃ³veis de EscritÃ³rio",
    "ElectrodomÃ©sticos",
    "Oficina Auto",
    "PeÃ§as Auto",
    "MecÃ¢nica",
    "Motorizadas",
    "Lavagem de Carros (Lavajato)",
    "Aluguer de Equipamentos",
    "Hotel / Hospedagem",
    "AgÃªncia de Viagens",
    "Transporte de Carga",
    "Taxi / Moto-Taxi",
    "Posto de CombustÃ­vel",
    "Distribuidora de GÃ¡s",
    "ServiÃ§os de Limpeza",
    "ServiÃ§os de ImpressÃ£o",
    "GrÃ¡fica",
    "Fotografia / EstÃºdio",
    "Florista",
    "DecoraÃ§Ã£o de Eventos",
    "Aluguer de Salas / Eventos",
    "DJ / Som e IluminaÃ§Ã£o",
    "Pet Shop",
    "AgropecuÃ¡ria",
    "Agro-veterinÃ¡ria",
    "Loja de Sementes",
    "Restaurante / Catering",
    "Joalharia / Bijuteria",
    "Relojoaria",
    "Ã“ptica",
    "Artigos Religiosos",
    "Loja de Brinquedos",
    "Artigos de Festa",
    "Loja de BebÃ©",
    "Loja de Desporto",
    "Loja de Bicicletas",
    "GinÃ¡sio / Academia",
    "ClÃ­nica MÃ©dica",
    "ClÃ­nica DentÃ¡ria",
    "Costura / Alfaiataria",
    "Sapataria (Conserto)",
    "Lavandaria",
    "Escola / ExplicaÃ§Ãµes",
    "InfantÃ¡rio / Creche",
    "EstÃºdio de MÃºsica",
    "Contabilidade / Consultoria",
    "Advocacia",
    "ImobiliÃ¡ria",
    "Seguros",
    "AgÃªncia de Emprego",
    "SeguranÃ§a Privada",
    "Artesanato",
    "ComÃ©rcio Geral",
    "Outro"
];

// Ramos personalizados adicionados pela prÃ³pria empresa (guardados em
// empresa.ramos_atividade) juntam-se aos RAMOS_PADRAO na hora de montar
// os selects â€” ver renderRamos().
let RAMOS = RAMOS_PADRAO.slice();


/* =====================================================
   DICIONÃRIO SISTÃ‰MICO DE IDIOMAS (TRADUÃ‡ÃƒO DE TERMOS)
===================================================== */

const IDIOMAS = {
    pt: {
        idioma: "Idioma",
        entrar: "Entrar",
        sair: "Sair",
        inicio: "InÃ­cio",
        vendas: "Vendas",
        produtos: "Produtos",
        inventario: "InventÃ¡rio",
        compras: "Compras",
        clientes: "Clientes",
        fornecedores: "Fornecedores",
        relatorios: "RelatÃ³rios",
        subscricao: "SubscriÃ§Ã£o"
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
   SUGESTÃ•ES DE ARTIGOS POR RAMO DE NEGÃ“CIO
===================================================== */

const SUGESTOES = {
    "Mercearia / Minimercado": [
        "Arroz", "AÃ§Ãºcar", "Ã“leo", "Farinha de milho", "Farinha de trigo", "FeijÃ£o",
        "Sal", "SabÃ£o azul e branco", "SabÃ£o em pÃ³", "Leite em pÃ³", "Bolachas",
        "Massa esparguete", "ChÃ¡", "CafÃ©", "FÃ³sforos", "Velas", "Pilhas"
    ],
    "Supermercado": [
        "Arroz", "Ã“leo alimentar", "AÃ§Ãºcar", "Leite", "Refrigerante", "Ãgua mineral",
        "Detergente", "Papel higiÃ©nico", "Pasta de dentes", "Sabonete", "Manteiga",
        "Queijo", "Iogurte", "Ovos", "CarvÃ£o", "Fraldas"
    ],
    "Boutique / Moda": [
        "T-shirt", "CalÃ§a de ganga", "Vestido", "Saia", "Camisa social", "Casaco",
        "Cinto", "BonÃ©", "Meias", "LenÃ§o", "Bolsa"
    ],
    "CalÃ§ados": [
        "Sapato social", "SandÃ¡lia", "Chinelo", "Sapatilha desportiva", "Bota",
        "Sapato de crianÃ§a", "Palmilha", "CadarÃ§o"
    ],
    "SalÃ£o de Beleza": [
        "Corte de cabelo", "Penteado / TranÃ§a", "Manicure", "Pedicure",
        "Shampoo", "Condicionador", "Creme alisante", "Tinta de cabelo",
        "ExtensÃ£o de cabelo", "Ã“leo capilar"
    ],
    "Barbearia": [
        "Corte de cabelo", "Barba", "Corte + Barba", "Gel", "Pomada", "Shampoo",
        "MÃ¡quina de corte (manutenÃ§Ã£o)"
    ],
    "Restaurante": [
        "Arroz", "Frango grelhado", "Carne assada", "Peixe grelhado", "Batata frita",
        "Salada", "Sumo natural", "Refrigerante", "Ãgua", "Sobremesa"
    ],
    "Lanchonete": [
        "HambÃºrguer", "Cachorro-quente", "SanduÃ­che", "Batata frita", "Sumo",
        "Ãgua", "Pastel", "Rissol", "ChamuÃ§a"
    ],
    "Bar / Bebidas": [
        "Ãgua", "Sumo", "Cerveja", "Vinho", "Whisky", "Gin", "Vodka", "Gelo",
        "Refrigerante", "Petiscos"
    ],
    "Pastelaria": [
        "PÃ£o", "Croissant", "Bolo", "Pastel de nata", "Empada", "ChamuÃ§a",
        "Rissol", "Sumo", "CafÃ©", "ChÃ¡"
    ],
    "Padaria": [
        "PÃ£o de trigo", "PÃ£o de forma", "PÃ£o integral", "Bolo simples",
        "Bolachas", "Farinha", "Fermento", "Manteiga"
    ],
    "Doceria / Bolos": [
        "Bolo de aniversÃ¡rio", "Cupcake", "Brigadeiro", "Torta", "Bolo de casamento",
        "Docinhos", "Biscoitos decorados"
    ],
    "Talho / AÃ§ougue": [
        "Carne de vaca (kg)", "Carne de porco (kg)", "Frango inteiro (kg)",
        "Peito de frango (kg)", "MiÃºdos", "LinguiÃ§a", "Salsicha", "Osso para caldo"
    ],
    "Peixaria": [
        "Peixe fresco (kg)", "CamarÃ£o (kg)", "Lagosta (kg)", "Polvo (kg)",
        "Caranguejo", "Gelo para conservaÃ§Ã£o"
    ],
    "Frutaria": [
        "Banana", "Manga", "Laranja", "MaÃ§Ã£", "Abacaxi", "Melancia", "Papaia",
        "LimÃ£o", "Abacate"
    ],
    "HortÃ­cola": [
        "Tomate (kg)", "Cebola (kg)", "Repolho", "Alface", "Cenoura (kg)",
        "Batata (kg)", "Couve", "Pimento"
    ],
    "FarmÃ¡cia / Perfumaria": [
        "Paracetamol", "Ibuprofeno", "Soro fisiolÃ³gico", "Ãlcool gel",
        "MÃ¡scara", "Preservativo", "Perfume", "Sabonete lÃ­quido", "Vitaminas"
    ],
    "CosmÃ©ticos": [
        "Base", "Batom", "RÃ­mel", "PÃ³ compacto", "Esmalte", "Creme facial",
        "Protetor solar", "Removedor de maquilhagem"
    ],
    "Material de ConstruÃ§Ã£o": [
        "Cimento (saco)", "Areia (mÂ³)", "Brita (mÂ³)", "Ferro de construÃ§Ã£o",
        "Bloco / Tijolo", "Tinta", "Tubo PVC", "Prego"
    ],
    "Ferragem": [
        "Martelo", "Chave de fendas", "Fita mÃ©trica", "Corda", "Cadeado",
        "DobradiÃ§a", "Fechadura", "Arame"
    ],
    "ElÃ©trica": [
        "LÃ¢mpada", "Fio elÃ©trico (metro)", "Tomada", "Interruptor", "Disjuntor",
        "Fita isoladora", "ExtensÃ£o elÃ©trica"
    ],
    "InformÃ¡tica": [
        "ManutenÃ§Ã£o de computador", "InstalaÃ§Ã£o de Windows", "Rato",
        "Teclado", "Pen drive", "Cabo HDMI", "ImpressÃ£o de documentos"
    ],
    "TelemÃ³veis e AcessÃ³rios": [
        "Capa de telemÃ³vel", "PelÃ­cula de vidro", "Carregador", "Auricular",
        "CartÃ£o de memÃ³ria", "Bateria", "ReparaÃ§Ã£o de ecrÃ£"
    ],
    "Papelaria": [
        "Caderno", "Caneta", "LÃ¡pis", "Borracha", "RÃ©gua", "Cola", "Tesoura",
        "Papel A4 (resma)", "ImpressÃ£o / FotocÃ³pia"
    ],
    "MÃ³veis": [
        "Cama", "SofÃ¡", "Mesa", "Cadeira", "ArmÃ¡rio", "Estante", "ColchÃ£o"
    ],
    "ElectrodomÃ©sticos": [
        "FrigorÃ­fico", "FogÃ£o", "Micro-ondas", "Ventilador", "Ferro de engomar",
        "Liquidificador", "RÃ¡dio"
    ],
    "Oficina Auto": [
        "MudanÃ§a de Ã³leo", "Alinhamento", "Balanceamento", "RevisÃ£o geral",
        "DiagnÃ³stico eletrÃ³nico", "Troca de pastilhas de travÃ£o"
    ],
    "PeÃ§as Auto": [
        "Ã“leo de motor", "Filtro de Ã³leo", "Filtro de ar", "Pastilha de travÃ£o",
        "Vela de igniÃ§Ã£o", "Bateria de carro", "Pneu"
    ],
    "Motorizadas": [
        "MudanÃ§a de Ã³leo", "RevisÃ£o", "Pneu", "Vela", "Corrente", "TravÃµes"
    ],
    "Hotel / Hospedagem": [
        "DiÃ¡ria quarto simples", "DiÃ¡ria quarto duplo", "Pequeno-almoÃ§o",
        "Lavandaria", "Estacionamento"
    ],
    "Transporte de Carga": [
        "Frete curta distÃ¢ncia", "Frete longa distÃ¢ncia", "MudanÃ§a residencial",
        "Carregamento / Descarregamento"
    ],
    "Taxi / Moto-Taxi": [
        "Corrida curta", "Corrida longa", "Corrida noturna", "Aluguer por hora"
    ],
    "Posto de CombustÃ­vel": [
        "Gasolina (litro)", "GasÃ³leo (litro)", "PetrÃ³leo (litro)", "Ã“leo de motor"
    ],
    "Distribuidora de GÃ¡s": [
        "Botija de gÃ¡s 6kg", "Botija de gÃ¡s 12kg", "Botija de gÃ¡s 45kg",
        "Regulador de gÃ¡s", "Mangueira de gÃ¡s"
    ],
    "ServiÃ§os de Limpeza": [
        "Limpeza residencial", "Limpeza de escritÃ³rio", "Limpeza pÃ³s-obra",
        "Lavagem de estofos", "Lavagem de tapetes"
    ],
    "GrÃ¡fica": [
        "ImpressÃ£o de cartÃµes", "ImpressÃ£o de banners", "ImpressÃ£o de flyers",
        "PlastificaÃ§Ã£o", "EncadernaÃ§Ã£o"
    ],
    "Fotografia / EstÃºdio": [
        "SessÃ£o fotogrÃ¡fica", "Cobertura de evento", "RevelaÃ§Ã£o de fotos",
        "EdiÃ§Ã£o de vÃ­deo", "ImpressÃ£o de fotos"
    ],
    "Florista": [
        "Ramo de flores", "Arranjo de mesa", "Coroa de flores", "Vaso decorativo"
    ],
    "Pet Shop": [
        "RaÃ§Ã£o para cÃ£o", "RaÃ§Ã£o para gato", "Banho e tosquia", "Coleira",
        "Vacina", "Brinquedo para animal"
    ],
    "AgropecuÃ¡ria": [
        "RaÃ§Ã£o animal", "Vacina veterinÃ¡ria", "Adubo", "Semente", "Ferramenta agrÃ­cola"
    ],
    "Joalharia / Bijuteria": [
        "Anel", "Colar", "Pulseira", "Brincos", "RelÃ³gio", "Corrente de prata"
    ],
    "Ã“ptica": [
        "Ã“culos de grau", "Ã“culos de sol", "Lente de contacto", "Exame de vista",
        "Conserto de armaÃ§Ã£o"
    ],
    "ClÃ­nica MÃ©dica": [
        "Consulta geral", "Consulta especializada", "Exame de rotina",
        "InjeÃ§Ã£o / Curativo", "AferiÃ§Ã£o de tensÃ£o"
    ],
    "ClÃ­nica DentÃ¡ria": [
        "Consulta dentÃ¡ria", "Limpeza dentÃ¡ria", "ExtraÃ§Ã£o", "ObturaÃ§Ã£o",
        "Branqueamento"
    ],
    "Costura / Alfaiataria": [
        "Ajuste de calÃ§a", "ConfecÃ§Ã£o de fato", "Bainha", "ReparaÃ§Ã£o de roupa",
        "ConfecÃ§Ã£o de capulana"
    ],
    "Lavandaria": [
        "Lavagem de roupa (kg)", "Passar a ferro", "Lavagem a seco",
        "Lavagem de edredon"
    ],
    "Escola / ExplicaÃ§Ãµes": [
        "ExplicaÃ§Ã£o de MatemÃ¡tica", "ExplicaÃ§Ã£o de PortuguÃªs", "ExplicaÃ§Ã£o de InglÃªs",
        "ExplicaÃ§Ã£o de FÃ­sica", "Curso de informÃ¡tica"
    ],
    "Contabilidade / Consultoria": [
        "DeclaraÃ§Ã£o de impostos", "Contabilidade mensal", "Abertura de empresa",
        "Consultoria financeira"
    ],
    "SeguranÃ§a Privada": [
        "VigilÃ¢ncia diurna", "VigilÃ¢ncia noturna", "InstalaÃ§Ã£o de cÃ¢maras",
        "Ronda de seguranÃ§a"
    ],
    "ComÃ©rcio Geral": [
        "Produto diverso 1", "Produto diverso 2", "Produto diverso 3"
    ]
};
/* =====================================================
   FUNÃ‡Ã•ES UTILITÃRIAS DO SISTEMA
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
    if (!v) return "â€”";

    let d;
    if (typeof v === "object" && typeof v.toDate === "function") {
        d = v.toDate();
    } else {
        d = new Date(v);
    }

    if (Number.isNaN(d.getTime())) return "â€”";

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
   REFERÃŠNCIAS DE SEGURANÃ‡A MULTIEMPRESA (FIRESTORE)
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
   MÃ“DULO LÃ“GICO: REGISTO DE AUDITORIA
   FUNÃ‡ÃƒO EM FALTA NO FICHEIRO ORIGINAL â€” Ã© chamada em cerca
   de 20 sÃ­tios (produtos, vendas, compras, caixa, etc.) mas
   nunca tinha sido definida, o que gerava ReferenceError e
   interrompia a operaÃ§Ã£o a meio (ex: guardarConfiguracoes).
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
        // Um erro no registo de auditoria nunca deve travar a operaÃ§Ã£o principal.
        console.error("NÃ£o foi possÃ­vel gravar o registo de auditoria:", error);
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: AUTENTICAÃ‡ÃƒO E CICLO DE ARRANQUE V9.9
   - Um Ãºnico fluxo de login/registo
   - Sem fallback inseguro de perfil
   - Bloqueio de corrida durante criaÃ§Ã£o da conta
   - NÃ£o faz logout automÃ¡tico quando Firestore falha
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
        if (status) status.textContent = "â³ A autenticar...";

        try {
            await signInWithEmailAndPassword(auth, email, senha);
            if (status) status.textContent = "ðŸŸ¢ Login realizado. A carregar...";
        } catch (error) {
            console.error("Erro de login:", error);
            if (status) status.textContent = "ðŸ”´ " + mensagemFirebase(error);
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
            if (status) status.textContent = "ðŸ”´ Escreva primeiro o seu e-mail no campo acima, depois clique em \"Esqueci a senha\".";
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            if (status) status.textContent = "ðŸŸ¢ EnviÃ¡mos um e-mail para " + email + " com as instruÃ§Ãµes para definir uma nova senha. Verifique tambÃ©m a pasta de spam.";
        } catch (error) {
            console.error(error);
            if (status) status.textContent = "ðŸ”´ " + mensagemFirebase(error);
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
    const ramo = elAuth("reg-ramo")?.value?.trim() || "ComÃ©rcio Geral";
    const email = elAuth("reg-email")?.value?.trim() || "";
    const senha = elAuth("reg-senha")?.value || "";
    const status = elAuth("reg-status");

    if (!empresaNome || !gerente || !email || !senha) {
        if (status) status.textContent = "âš ï¸ Preencha os campos obrigatÃ³rios.";
        return;
    }

    if (senha.length < 6) {
        if (status) status.textContent = "âš ï¸ A senha deve ter pelo menos 6 caracteres.";
        return;
    }

    FABEF_registoEmCurso = true;
    if (btnRegistar) btnRegistar.disabled = true;
    if (status) status.textContent = "â³ A criar a conta...";

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

        // Os dois documentos sÃ³ sÃ£o criados para o UID autenticado.
        await setDoc(doc(db, "empresas", empresaId), empresa);
        await setDoc(doc(db, "utilizadores", uidUser), utilizador);

        if (status) status.textContent = "ðŸŸ¢ Conta criada com sucesso. A abrir o sistema...";

        // CORREÃ‡ÃƒO: o onAuthStateChanged jÃ¡ disparou (ignorado, porque
        // FABEF_registoEmCurso estava ativo) e nÃ£o volta a disparar sozinho,
        // porque o estado de autenticaÃ§Ã£o nÃ£o muda outra vez. Por isso,
        // depois de os documentos existirem, arrancamos a sessÃ£o manualmente.
        FABEF_registoEmCurso = false;
        if (auth.currentUser) {
            await iniciarSessaoFABEF(auth.currentUser);
        }
        return;
    } catch (error) {
        console.error("Erro ao criar conta:", error);
        if (status) status.textContent = "ðŸ”´ " + mensagemFirebase(error);
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
        if (loginStatus) loginStatus.textContent = "â³ A carregar a empresa...";

        // NÃƒO existe fallback para perfil inexistente.
        await carregarPerfil(user);
        await carregarEmpresa();
        await carregarDados();

        abrirAplicacao();
        FABEF.carregado = true;
    } catch (error) {
        console.error("Erro crÃ­tico ao iniciar a aplicaÃ§Ã£o:", error);
        const mensagem = mensagemFirebase(error);
        if (loginStatus) loginStatus.textContent = "ðŸ”´ NÃ£o foi possÃ­vel carregar a conta: " + mensagem;

        const regStatus = elAuth("reg-status");
        if (regStatus && !FABEF_registoEmCurso) {
            regStatus.textContent = "ðŸ”´ NÃ£o foi possÃ­vel carregar a empresa: " + mensagem;
        }

        // MantÃ©m a sessÃ£o autenticada para permitir diagnÃ³stico/retry.
        // NÃ£o usamos signOut() aqui, porque um erro do Firestore nÃ£o significa senha invÃ¡lida.
        FABEF.carregado = false;
        elAuth("app")?.classList.add("hidden");
        if (elAuth("tela-login")) elAuth("tela-login").style.display = "flex";
    } finally {
        FABEF_arranqueEmCurso = false;
    }
}

/* =====================================================
   MÃ“DULO LÃ“GICO: BLOQUEIO POR PIN LOCAL (funciona offline)
   Como a sessÃ£o agora fica guardada no dispositivo (para o modo
   offline funcionar), a seguranÃ§a de "pedir sempre algo ao reabrir"
   passa a ser um PIN de 4 dÃ­gitos verificado localmente â€” nÃ£o
   depende de internet, ao contrÃ¡rio de pedir e-mail+senha outra vez.
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
    let pin = prompt("Defina um PIN de 4 dÃ­gitos para desbloquear a aplicaÃ§Ã£o rapidamente da prÃ³xima vez (mesmo sem internet):");
    if (pin === null) return; // o utilizador optou por nÃ£o definir agora
    pin = pin.trim();
    if (!/^\d{4,6}$/.test(pin)) { alert("O PIN deve ter entre 4 e 6 nÃºmeros."); return; }
    const confirmacao = prompt("Confirme o PIN novamente:");
    if (pin !== (confirmacao || "").trim()) { alert("Os PINs nÃ£o coincidem. Tente novamente mais tarde em ConfiguraÃ§Ãµes."); return; }

    const hash = await calcularHashPin(pin);
    localStorage.setItem(chavePinLocal(uid), hash);
    alert("PIN definido com sucesso. Da prÃ³xima vez que abrir a aplicaÃ§Ã£o, vai usar este PIN em vez do e-mail e senha.");
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
    const pinDigitado = (document.getElementById("pin-input")?.value || "").trim();
    const statusPin = document.getElementById("pin-status");
    if (!pinDigitado) { if (statusPin) statusPin.textContent = "Introduza o PIN."; return; }

    if (window.FABEF?.isDemoMode) {
        // No modo teste, aceita 1234 ou qualquer PIN de 4 dígitos
        if (pinDigitado.length >= 4) {
            esconderEcraPin();
            toast("🔓 Aplicação desbloqueada com sucesso.");
        } else {
            if (statusPin) statusPin.textContent = "🔴 O PIN deve ter pelo menos 4 dígitos (ex: 1234).";
        }
        return;
    }

    const user = auth.currentUser;
    if (!user) { mostrarEcraPin(); return; }

    const hashGuardado = localStorage.getItem(chavePinLocal(user.uid));

    const hashDigitado = await calcularHashPin(pinDigitado);
    if (hashDigitado === hashGuardado) {
        esconderEcraPin();
        await iniciarSessaoFABEF(user);
    } else {
        if (statusPin) statusPin.textContent = "🔴 PIN incorreto. Tente novamente.";
    }
});

document.getElementById("btn-pin-sair")?.addEventListener("click", async () => {
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

// Bloqueio por PIN ao minimizar a aplicação (no telemóvel ou ao alternar de janela)
let appFoiMinimizada = false;
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        if (FABEF.carregado && (FABEF.user || window.FABEF?.isDemoMode)) {
            appFoiMinimizada = true;
        }
    } else {
        if (appFoiMinimizada && FABEF.carregado && (FABEF.user || window.FABEF?.isDemoMode)) {
            appFoiMinimizada = false;
            mostrarEcraPin();
            const statusPin = document.getElementById("pin-status");
            if (statusPin) {
                statusPin.textContent = "🔒 Aplicação suspensa. Introduza o PIN para desbloquear.";
                statusPin.style.color = "#1e3a8a";
            }
        }
    }
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

    // LOGIN NORMAL: e-mail + senha abre diretamente a aplicação.
    // O PIN só é usado quando a aplicação foi suspensa/minimizada ou o ecrã foi bloqueado.
    await iniciarSessaoFABEF(user);
});

async function carregarPerfil(user) {
    if (!user?.uid) throw new Error("Utilizador autenticado invÃ¡lido.");

    const snap = await getDoc(doc(db, "utilizadores", user.uid));

    if (!snap.exists()) {
        throw new Error("Perfil do utilizador nÃ£o encontrado no Firebase. A conta nÃ£o estÃ¡ configurada corretamente.");
    }

    const dados = snap.data();
    const empresaId = dados.empresaId;

    if (!empresaId || typeof empresaId !== "string") {
        throw new Error("O perfil do utilizador nÃ£o possui uma empresaId vÃ¡lida.");
    }

    if (dados.uid && dados.uid !== user.uid) {
        throw new Error("InconsistÃªncia de seguranÃ§a: o UID do perfil nÃ£o corresponde ao utilizador autenticado.");
    }

    // Bloqueia o acesso de contas de funcionÃ¡rio que o gerente tenha desativado
    if (dados.perfil === "funcionario" && dados.estado && dados.estado !== "ATIVO") {
        await signOut(auth);
        throw new Error("Esta conta foi desativada pelo gerente. Contacte o gerente do negÃ³cio.");
    }

    FABEF.userData = { uid: user.uid, ...dados };
    FABEF.empresaId = empresaId;
}

async function carregarEmpresa() {
    if (!FABEF.empresaId) throw new Error("Nenhuma empresa foi associada ao utilizador.");

    const snap = await getDoc(empresaRef());
    if (!snap.exists()) {
        throw new Error("Documento da empresa nÃ£o encontrado na base de dados do Firebase.");
    }

    const dados = snap.data();
    if (dados.id && dados.id !== FABEF.empresaId) {
        throw new Error("InconsistÃªncia de seguranÃ§a: o ID da empresa nÃ£o corresponde ao documento.");
    }
    if (dados.gerenteId && FABEF.userData?.perfil === "gerente" && dados.gerenteId !== FABEF.user.uid) {
        throw new Error("InconsistÃªncia de seguranÃ§a: o gerente da empresa nÃ£o corresponde ao utilizador autenticado.");
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

// Agrupa vÃ¡rias atualizaÃ§Ãµes em tempo real que cheguem quase ao mesmo tempo
// (normal quando vÃ¡rios dispositivos sincronizam de uma vez) numa Ãºnica
// renderizaÃ§Ã£o, para nÃ£o sobrecarregar o ecrÃ£ com repaints repetidos.
let FABEF_RENDER_PENDENTE = null;
function pedirRenderTudo() {
    if (FABEF_RENDER_PENDENTE) clearTimeout(FABEF_RENDER_PENDENTE);
    FABEF_RENDER_PENDENTE = setTimeout(() => {
        FABEF_RENDER_PENDENTE = null;
        if (FABEF.carregado) renderTudo();
    }, 150);
}

/* =====================================================
   ESCUTA EM TEMPO REAL DAS COLEÃ‡Ã•ES DA EMPRESA
   Substitui o antigo carregamento "uma vez sÃ³" (getDocs). Com
   onSnapshot, qualquer alteraÃ§Ã£o feita noutro dispositivo (outro
   funcionÃ¡rio, ou o prÃ³prio gerente no telemÃ³vel) aparece aqui
   automaticamente, sem precisar de recarregar a pÃ¡gina. TambÃ©m
   Ã© assim que os dados chegam quando o dispositivo estava offline
   e volta a ligar-se Ã  internet.
===================================================== */
const COLECOES_POR_RAMO = new Set(["produtos","clientes","fornecedores","compras","vendas","despesas","dividas","encomendas","auditoria_logs","sugestoes","caixas_turnos","ajustes_stock"]);
const COLECOES_POR_DIA = new Set(["vendas","despesas","compras","dividas","encomendas","auditoria_logs","sugestoes"]);
function referenciaColecaoFiltrada(nome) {
    const ref = subRef(nome);
    return COLECOES_POR_RAMO.has(nome) && FABEF.ramo ? query(ref, where("ramo", "==", FABEF.ramo)) : ref;
}
function dataDoRegisto(item) {
    const v=item?.data||item?.dataVenda||item?.dataCriacao||item?.criadoEm;
    if(!v) return "";
    if(typeof v === "object" && typeof v.toDate === "function") return v.toDate().toISOString().slice(0,10);
    const d=new Date(v); return Number.isNaN(d.getTime()) ? String(v).slice(0,10) : d.toISOString().slice(0,10);
}
function aplicarFiltroDia(){
    for(const nome of COLECOES_POR_DIA){ const estado=nome==="auditoria_logs"?"auditoria":nome; FABEF[estado]=(FABEF._raw?.[nome]||[]).filter(x=>dataDoRegisto(x)===FABEF.dataAtiva); }
}
function definirDiaAtivo(data){ if(!/^\d{4}-\d{2}-\d{2}$/.test(data||"")) return; FABEF.dataAtiva=data; aplicarFiltroDia(); renderTudo(); }
window.definirDiaAtivo=definirDiaAtivo;

function escutarColecao(nome, estado) {
    return new Promise((resolve) => {
        let primeiraVez = true;
        const unsub = onSnapshot(referenciaColecaoFiltrada(nome), (snap) => {
            const dados=snap.docs.map(d=>({id:d.id,...d.data()}));
            if(COLECOES_POR_DIA.has(nome)){ FABEF._raw=FABEF._raw||{}; FABEF._raw[nome]=dados; } else FABEF[estado]=dados;
            aplicarFiltroDia();
            if(estado==="produtos") verificarReconciliacaoStock();
            if(primeiraVez){primeiraVez=false;resolve();} else pedirRenderTudo();
        }, (erro)=>{ console.error(`Erro ao escutar a colecção "${nome}":`,erro); if(primeiraVez){primeiraVez=false;resolve();} });
        FABEF.listeners.push(unsub);
    });
}

/* =====================================================
   MÃ“DULO LÃ“GICO: INDICADOR DE LIGAÃ‡ÃƒO / MODO OFFLINE
===================================================== */
function atualizarIndicadorLigacao() {
    const indicador = document.getElementById("indicador-ligacao");
    if (!indicador) return;
    if (navigator.onLine) {
        indicador.textContent = "ðŸŸ¢ Online";
        indicador.style.color = "#10b981";
        indicador.title = "Ligado Ã  internet â€” os dados sincronizam em tempo real.";
    } else {
        indicador.textContent = "ðŸ”´ Offline";
        indicador.style.color = "#ef4444";
        indicador.title = "Sem internet. Pode continuar a vender e a trabalhar â€” tudo serÃ¡ sincronizado assim que a ligaÃ§Ã£o voltar.";
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

    // Primeira vez neste dispositivo: sugere definir um PIN para acesso rÃ¡pido offline
    if (FABEF.user?.uid && !localStorage.getItem(chavePinLocal(FABEF.user.uid))) {
        setTimeout(() => configurarNovoPin(FABEF.user.uid), 600);
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: CONTROLO DE ACESSO POR PAPEL
   O gerente Ã© a conta de controlo do negÃ³cio: define preÃ§os,
   stock, funcionÃ¡rios e vÃª relatÃ³rios â€” mas NÃƒO regista vendas.
   SÃ³ as contas de funcionÃ¡rio tÃªm acesso Ã  pÃ¡gina "Vender".
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
    // O funcionário NÃO PODE ver nem alterar os ramos que o gerente está a gerir,
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

    // Atualiza os controles do POS de acordo com o perfil
    verificarAcessoPosGerente();

    // O funcionário ao entrar deve ir DIRETO para a sua atividade (Vender / POS)
    if (!ehGerenteLogado) {
        const secaoAtual = document.querySelector(".secao.active")?.id;
        if (!secaoAtual || secaoAtual === "sec-inicio" || secoesReservadasAoGerente.some(sec => "sec-" + sec === secaoAtual)) {
            mostrarSecao("pos");
        }
    }
}

function verificarAcessoPosGerente() {
    let perfil = "gerente";
    if (window.FABEF?.isDemoMode) {
        perfil = window.FABEF.demoPerfil || "gerente";
    } else if (FABEF.userData) {
        perfil = FABEF.userData.perfil || FABEF.userData.role || "gerente";
    }
    const ehGerenteLogado = perfil === "gerente";
    const avisoPos = document.getElementById("aviso-pos-gerente-bloqueado");
    const btnFinalizar = document.getElementById("btn-finalizar-venda");

    if (avisoPos) {
        avisoPos.style.display = ehGerenteLogado ? "block" : "none";
    }
    if (btnFinalizar) {
        if (ehGerenteLogado) {
            btnFinalizar.disabled = true;
            btnFinalizar.title = "O perfil de Gerente é exclusivo para gestão e supervisão. As vendas devem ser feitas por Funcionários.";
            btnFinalizar.style.opacity = "0.6";
            btnFinalizar.style.cursor = "not-allowed";
        } else {
            btnFinalizar.disabled = false;
            btnFinalizar.title = "";
            btnFinalizar.style.opacity = "1";
            btnFinalizar.style.cursor = "pointer";
        }
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

    const btnZip = e.target.closest(".btn-acao-baixar-zip");
    if (btnZip && !btnZip.dataset.downloadTratado) {
        btnZip.dataset.downloadTratado = "1";
        if (window.baixarProjetoZip) {
            window.baixarProjetoZip();
        }
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

    // AO CLICAR NA OPÇÃO, OS DIZERES DOS 3 PONTOS (SIDEBAR) DESAPARECEM IMEDIATAMENTE
    // E A TELA PRINCIPAL EXIBE LIMPA A OPÇÃO SELECIONADA
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
    }
}
window.mostrarSecao = mostrarSecao;


/* =====================================================
   MÃ“DULO LÃ“GICO: ENCERRAR SESSÃƒO (LOGOUT)
===================================================== */

/* =====================================================
   MÃ“DULO LÃ“GICO: ALTERAR SENHA (QUALQUER UTILIZADOR)
   AcessÃ­vel pelo nome no cabeÃ§alho â€” qualquer funcionÃ¡rio ou
   gerente pode reforÃ§ar a seguranÃ§a da prÃ³pria conta.
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

    if (!atual || !nova || !confirmar) { status.textContent = "ðŸ”´ Preencha todos os campos."; return; }
    if (nova.length < 6) { status.textContent = "ðŸ”´ A nova senha deve ter pelo menos 6 caracteres."; return; }
    if (nova !== confirmar) { status.textContent = "ðŸ”´ A confirmaÃ§Ã£o nÃ£o coincide com a nova senha."; return; }

    try {
        status.textContent = "â³ A validar...";
        const credencial = EmailAuthProvider.credential(auth.currentUser.email, atual);
        await reauthenticateWithCredential(auth.currentUser, credencial);
        await updatePassword(auth.currentUser, nova);
        status.textContent = "ðŸŸ¢ Senha alterada com sucesso!";
        await gravarAuditoria("Alterou a prÃ³pria senha de acesso.", "INFO");
        setTimeout(() => fecharModal("modal-alterar-senha"), 1500);
    } catch (error) {
        console.error(error);
        status.textContent = "ðŸ”´ " + mensagemFirebase(error);
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
   MÃ“DULO LÃ“GICO: DICIONÃRIO E SELEÃ‡ÃƒO DE IDIOMA
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
        dividas: "Fiado / DÃ­vidas",
        encomendas: "Encomendas",
        caixa: "Caixa / Turnos",
        despesas: "Despesas",
        relatorios: d.relatorios,
        funcionarios: "FuncionÃ¡rios",
        ramos: "Ramos",
        auditoria: "Auditoria",
        subscricao: d.subscricao,
        config: "ConfiguraÃ§Ãµes"
    };

    Object.entries(mapa).forEach(([id, text]) => {
        const btn = document.querySelector(`.sidebar button[data-sec="${id}"]`);
        if (btn) btn.textContent = text;
    });
}


/* =====================================================
   MÃ“DULO LÃ“GICO: GESTÃƒO MULTIEMPRESA DE RAMOS
===================================================== */

/* =====================================================
   MÃ“DULO LÃ“GICO: VISÃƒO GERAL DE VENDAS POR RAMO
   Mostra um cartÃ£o por cada ramo que a empresa jÃ¡ usa (tem
   produtos ou vendas registadas), com as vendas de hoje e do
   mÃªs, e um botÃ£o para trocar diretamente para esse ramo.
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
            <h3 style="margin-bottom:10px;">VisÃ£o geral â€” todos os ramos em uso</h3>
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
                        <p style="font-size:13px;margin:6px 0;">Este mÃªs: <strong>${dinheiro(vendasMesRamo)}</strong></p>
                        ${!ativo ? `<button class="btn btn-light btn-small" type="button" onclick="mudarRamo('${escapeHTML(ramo)}')">Ver este ramo</button>` : ""}
                    </div>`;
                }).join("")}
            </div>
        </div>
    `;
}


function renderRamos() {
    // Junta os ramos padrÃ£o com os ramos personalizados que esta empresa
    // jÃ¡ tenha adicionado (empresa.ramos_atividade), sem duplicados.
    const personalizados = FABEF.empresa?.ramos_atividade || [];
    RAMOS = Array.from(new Set([...RAMOS_PADRAO, ...personalizados]));

    renderVisaoGeralRamos();
    renderPastaRamos();

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

    // Injeta as sugestÃµes como checkboxes, para o gerente poder selecionar
    // vÃ¡rias de uma vez e adicionar tudo junto (evita ter de escrever cada
    // atividade manualmente quando o ramo jÃ¡ tem sugestÃµes prontas).
    const sugestoesDoRamo = (SUGESTOES[FABEF.ramo] || []).filter(nome =>
        !FABEF.produtos.some(p => p.ramo === FABEF.ramo && String(p.nome || "").toLowerCase() === nome.toLowerCase())
    );

    const containerSugestoes = document.getElementById("sugestoes-ramo");
    if (sugestoesDoRamo.length === 0) {
        const totalSugestoes = (SUGESTOES[FABEF.ramo] || []).length;
        containerSugestoes.innerHTML = totalSugestoes > 0
            ? `<p style="color:#10b981;font-size:13px;">âœ”ï¸ JÃ¡ adicionou todas as sugestÃµes prontas para este ramo.</p>`
            : `<p style="color:#64748b;font-size:13px;">Ainda nÃ£o hÃ¡ sugestÃµes rÃ¡pidas para este ramo. Pode criar os seus produtos manualmente na pÃ¡gina "Produtos".</p>`;
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
            if (selecionadas.length === 0) { alert("Marque pelo menos uma sugestÃ£o para adicionar."); return; }
            for (const nome of selecionadas) {
                await criarProdutoSugestao(nome, true);
            }
            renderRamos();
            alert(`${selecionadas.length} atividade(s) adicionada(s). VÃ¡ Ã  pÃ¡gina "Produtos" para definir os preÃ§os de cada uma.`);
        });
    }
}


document.getElementById("select-ramo").addEventListener("change", e => mudarRamo(e.target.value));
document.getElementById("ramo-pagina").addEventListener("change", e => mudarRamo(e.target.value));


/* =====================================================
   MÃ“DULO LÃ“GICO: RAMOS PERSONALIZADOS
   Permite ao gerente adicionar um ramo de atividade que nÃ£o
   estÃ¡ na lista padrÃ£o (ex: um negÃ³cio muito especÃ­fico).
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
        alert("Este ramo jÃ¡ existe na lista.");
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
        alert("NÃ£o foi possÃ­vel adicionar o ramo.\n" + mensagemFirebase(error));
    }
}


async function mudarRamo(ramo) {
    if (!RAMOS.includes(ramo)) return;

    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("SÃ³ o gerente pode mudar o ramo de atividade.");
        // RepÃµe o valor visual dos selects para o ramo atual (evita ficar "preso" na opÃ§Ã£o errada)
        renderRamos();
        return;
    }

    if (ramo === FABEF.ramo) return;

    const confirmar = confirm(
        `Vai mudar do ramo "${FABEF.ramo}" para "${ramo}".\n\n` +
        `Produtos, vendas, caixa e relatÃ³rios vÃ£o passar a mostrar apenas os dados deste novo ramo â€” nada Ã© apagado, o ramo anterior continua guardado e pode voltar a ele quando quiser.\n\n` +
        `Deseja continuar?`
    );
    if (!confirmar) {
        renderRamos();
        return;
    }

    try {
        await updateDoc(empresaRef(), {
            ramo_ativo: ramo,
            atualizadoEm: serverTimestamp()
        });

        FABEF.ramo = ramo;
        await ouvirCaixa(); // reescuta o caixa jÃ¡ isolado para o novo ramo
        renderTudo();

        // Escreve de forma persistente a alteraÃ§Ã£o nos registos de auditoria
        await gravarAuditoria("Alterou o ramo activo para " + ramo, "INFO");
    } catch (error) {
        console.error(error);
        alert("NÃ£o foi possÃ­vel alterar o ramo.\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: CRIAR PRODUTO VIA SUGESTÃƒO RÃPIDA
===================================================== */

async function criarProdutoSugestao(nome, silencioso) {
    const existe = FABEF.produtos.some(p => 
        p.ramo === FABEF.ramo &&
        String(p.nome || "").toLowerCase() === nome.toLowerCase()
    );

    if (existe) {
        if (!silencioso) alert("Este produto jÃ¡ existe neste ramo.");
        return;
    }

    try {
        const payload = {
            nome: nome,
            categoria: "SugestÃ£o",
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

        // Atualiza a memÃ³ria local mantendo a integridade estrutural
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
        if (!silencioso) alert("NÃ£o foi possÃ­vel adicionar o produto.\n" + mensagemFirebase(error));
    }
}
/* =====================================================
   MÃ“DULO LÃ“GICO: INTERAÃ‡ÃƒO DA JANELA MODAL DE PRODUTOS
===================================================== */

document.getElementById("btn-novo-produto").addEventListener("click", () => {
    limparProdutoForm();
    document.getElementById("modal-produto").classList.add("show");
});


document.getElementById("btn-salvar-produto").addEventListener("click", salvarProduto);


/* =====================================================
   MÃ“DULO LÃ“GICO: GRAVAÃ‡ÃƒO E VALIDAÃ‡ÃƒO DE PRODUTO
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

    // ValidaÃ§Ã£o de seguranÃ§a bÃ¡sica para integridade de dados
    if (!nome) {
        alert("Introduza o nome do produto.");
        return;
    }

    if (stock < 0 || custo < 0 || preco < 0 || minimo < 0) {
        alert("Os valores monetÃ¡rios ou de inventÃ¡rio nÃ£o podem ser negativos.");
        return;
    }

    // Alerta de margem de lucro negativa ou nula
    if (preco < custo) {
        if (!confirm("O preÃ§o de venda Ã© inferior ao custo de aquisiÃ§Ã£o. Deseja continuar mesmo assim?")) {
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

        // AtualizaÃ§Ã£o sÃ­ncrona da memÃ³ria em cache do navegador
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

        // Registo inalterÃ¡vel do log de auditoria do sistema
        await gravarAuditoria("Criou o produto no catÃ¡logo: " + nome, "INFO");
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
   MÃ“DULO LÃ“GICO: FILTRAGEM E RENDER DO CATÃLOGO
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

    // Filtra primeiro pelo ramo activo, depois pela pesquisa de nome/cÃ³digo
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
            <td>${escapeHTML(p.codigo || "â€”")}</td>
            <td>${ehGerente ? dinheiro(p.custo) : "â€”"}</td>
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
            <td>${escapeHTML(p.ramo || "â€”")}</td>
            <td>
                ${baixo ? 
                    '<span class="badge badge-red">STOCK BAIXO</span>' : 
                    '<span class="badge badge-green">NORMAL</span>'
                }
            </td>
            <td>
                <button class="btn btn-light btn-small" type="button" onclick="abrirModalEditarProduto('${escapeHTML(p.id)}')">âœï¸ Editar</button>
            </td>
        </tr>
        `;
    }).join("") || `
    <tr>
        <td colspan="9" style="text-align: center; color: #64748b;">
            Nenhum produto encontrado no catÃ¡logo deste ramo.
        </td>
    </tr>
    `;

    // Vincula dinamicamente os escutadores para o ecrÃ£ de rastreabilidade de lotes
    document.querySelectorAll("[data-stock-id]").forEach(td => {
        td.addEventListener("click", () => {
            abrirRastreabilidadeDeLotes(td.dataset.stockId, td.dataset.stockNome);
        });
    });
}
/* =====================================================
   MÃ“DULO LÃ“GICO: CÃLCULOS E RENDERIZAÃ‡ÃƒO DE INVENTÃRIO
===================================================== */

function renderInventario() {
    // SÃ³ considera o inventÃ¡rio do ramo actualmente ativo
    const produtos = FABEF.produtos.filter(p => p.ramo === FABEF.ramo);

    // Calcula de forma somatÃ³ria o total de itens fÃ­sicos em stock
    const unidades = produtos.reduce((s, p) => s + numero(p.stock), 0);

    // Filtra e contabiliza quantos artigos atingiram o nÃ­vel de stock crÃ­tico (mas ainda tÃªm stock)
    const baixos = produtos.filter(p => numero(p.stock) > 0 && numero(p.stock) <= numero(p.stockMinimo)).length;

    // Produtos totalmente esgotados (stock zero ou negativo)
    const esgotados = produtos.filter(p => numero(p.stock) <= 0).length;

    // Executa a valoraÃ§Ã£o monetÃ¡ria do stock baseado no preÃ§o de custo
    const custo = produtos.reduce((s, p) => s + (numero(p.stock) * numero(p.custo)), 0);

    const ehGerenteInv = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    // Atualiza os cartÃµes de sumÃ¡rio de indicadores no topo do painel
    document.getElementById("inv-total-artigos").textContent = produtos.length;
    document.getElementById("inv-total-unidades").textContent = unidades;
    document.getElementById("inv-stock-baixo").textContent = baixos;
    if (document.getElementById("inv-esgotados")) document.getElementById("inv-esgotados").textContent = esgotados;
    document.getElementById("inv-valor-custo").textContent = ehGerenteInv ? dinheiro(custo) : "â€”";

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
            <td>${escapeHTML(p.categoria || "â€”")}</td>
            <td 
                class="stock-click" 
                style="color: ${corStock}; font-weight: 900;" 
                data-stock-id="${escapeHTML(p.id)}" 
                data-stock-nome="${escapeHTML(p.nome)}"
            >
                ${stock}
            </td>
            <td>${minimo}</td>
            <td>${ehGerenteInv ? dinheiro(p.custo) : "â€”"}</td>
            <td>${ehGerenteInv ? dinheiro(stock * numero(p.custo)) : "â€”"}</td>
            <td>
                ${esgotado ?
                    '<span class="badge badge-red">ESGOTADO</span>' :
                    (baixo ?
                        '<span class="badge badge-yellow">STOCK BAIXO</span>' :
                        '<span class="badge badge-green">NORMAL</span>')
                }
            </td>
            <td><button class="btn btn-light btn-small" type="button" onclick="abrirModalAjusteStock('${escapeHTML(p.id)}')">âš™ï¸ Ajustar</button></td>
        </tr>
        `;
    }).join("") || `
    <tr>
        <td colspan="8" style="text-align: center; color: #64748b;">
            Nenhum produto cadastrado para inventÃ¡rio neste ramo.
        </td>
    </tr>
    `;

    // Vincula dinamicamente os escutadores de evento Ã  tabela de inventÃ¡rio
    document.querySelectorAll("#tabela-inventario [data-stock-id]").forEach(td => {
        td.addEventListener("click", () => {
            abrirRastreabilidadeDeLotes(td.dataset.stockId, td.dataset.stockNome);
        });
    });
}


/* =====================================================
   MÃ“DULO LÃ“GICO: AJUSTE MANUAL DE STOCK (ENTRADA / SAÃDA / PERDA)
   SÃ³ o gerente pode autorizar â€” conforme pedido explicitamente.
   Cada ajuste fica gravado em empresas/{id}/ajustes_stock e na
   auditoria, com o valor anterior e o valor novo.
===================================================== */

window.abrirModalAjusteStock = function(id) {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o gerente pode autorizar ajustes de stock (perdas, avarias ou correÃ§Ãµes manuais).");
        return;
    }
    const p = FABEF.produtos.find(x => x.id === id);
    if (!p) return;

    document.getElementById("ajuste-produto-id").value = p.id;
    document.getElementById("ajuste-produto-nome").textContent = p.nome + " â€” stock atual: " + numero(p.stock);
    document.getElementById("ajuste-quantidade").value = "";
    document.getElementById("ajuste-motivo").value = "";
    document.getElementById("modal-ajuste-stock")?.classList.add("show");
};

document.getElementById("btn-confirmar-ajuste-stock")?.addEventListener("click", confirmarAjusteStock);

async function confirmarAjusteStock() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("SÃ³ o gerente pode autorizar ajustes de stock (entrada, saÃ­da ou perda/avaria).");
        return;
    }

    const id = document.getElementById("ajuste-produto-id").value;
    const tipo = document.getElementById("ajuste-tipo").value; // entrada | saida | perda
    const quantidade = numero(document.getElementById("ajuste-quantidade").value);
    const motivo = document.getElementById("ajuste-motivo").value.trim();

    const produto = FABEF.produtos.find(p => p.id === id);
    if (!produto) return;

    if (quantidade <= 0) { alert("A quantidade deve ser superior a zero."); return; }
    if (!motivo) { alert("Descreva o motivo do ajuste (obrigatÃ³rio para auditoria)."); return; }
    if (!confirm(`Confirma o ajuste de stock de "${produto.nome}"?\n\nEsta aÃ§Ã£o fica registada com o seu nome, data e motivo.`)) return;

    try {
        const stockAnterior = numero(produto.stock);
        const diferenca = (tipo === "entrada") ? quantidade : -quantidade;
        const stockNovo = Math.max(0, stockAnterior + diferenca);

        // COMPATÃVEL COM OFFLINE: increment() em vez de transaÃ§Ã£o
        await updateDoc(produtoRef(id), { stock: increment(diferenca), atualizadoEm: serverTimestamp() });

        produto.stock = stockNovo;

        const tipoTexto = { entrada: "Entrada manual", saida: "SaÃ­da manual", perda: "Perda / Avaria" }[tipo] || tipo;

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
            `Ajuste de stock (${tipoTexto}) em "${produto.nome}": ${stockAnterior} â†’ ${stockNovo} (motivo: ${motivo})`,
            tipo === "perda" ? "AVISO" : "INFO"
        );
        alert("Ajuste de stock registado com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao ajustar o stock:\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: RASTREABILIDADE SEGURA DE LOTES (AUDITORIA)
   =====================================================
*/

window.abrirRastreabilidadeDeLotes = function (idProduto, nomeProduto) {
    const modal = document.getElementById("modal-detalhe-stock");
    const corpo = document.getElementById("md-tabela-lotes-corpo");
    const resumo = document.getElementById("md-resumo-stock");

    if (!modal || !corpo || !resumo) return;

    document.getElementById("md-titulo-produto").textContent = "ðŸ“‹ HistÃ³rico de Lotes: " + nomeProduto;
    modal.classList.add("show");

    // Usa diretamente os dados jÃ¡ sincronizados em FABEF.compras (memÃ³ria local),
    // em vez de fazer uma nova consulta ao Firestore â€” isto garante que funciona
    // tambÃ©m offline, jÃ¡ que uma consulta nova com where+orderBy nÃ£o Ã© fiÃ¡vel
    // a partir da cache quando nÃ£o hÃ¡ internet.
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
   MÃ“DULO LÃ“GICO: GESTÃƒO E FILTRAGEM DE COMPRAS / ENTRADAS
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

    // SugestÃµes de fornecedores jÃ¡ cadastrados, para evitar erros de digitaÃ§Ã£o
    const listaFornecedores = document.getElementById("lista-fornecedores-compra");
    if (listaFornecedores) {
        listaFornecedores.innerHTML = FABEF.fornecedores
            .map(f => `<option value="${escapeHTML(f.nome)}">`)
            .join("");
    }
}


document.getElementById("btn-registar-compra").addEventListener("click", registarCompra);


/* =====================================================
   MÃ“DULO LÃ“GICO: GRAVAÃ‡ÃƒO ATÃ“MICA DE COMPRA E INVENTÃRIO
===================================================== */

async function registarCompra() {
    const produtoId = document.getElementById("compra-produto").value;
    const fornecedor = document.getElementById("compra-fornecedor").value.trim();
    const quantidade = numero(document.getElementById("compra-quantidade").value);
    const custo = numero(document.getElementById("compra-custo").value);
    const pagamento = document.getElementById("compra-pagamento")?.value || "Dinheiro";

    // ValidaÃ§Ã£o rÃ­gida dos dados de entrada
    if (!produtoId || !fornecedor || quantidade <= 0 || custo < 0) {
        alert("Preencha correctamente todos os dados obrigatÃ³rios da compra.");
        return;
    }

    const produto = FABEF.produtos.find(p => p.id === produtoId);
    if (!produto) {
        alert("O produto seleccionado nÃ£o foi encontrado no sistema.");
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

        // Grava o histÃ³rico de compras de forma isolada
        const ref = await addDoc(subRef("compras"), compra);
        FABEF.compras.push({ id: ref.id, ...compra });

        // Se a compra foi feita a crÃ©dito, regista/atualiza a dÃ­vida ao fornecedor
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
                    observacao: "Criado automaticamente a partir de uma compra a crÃ©dito.",
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
         COMPATÃVEL COM OFFLINE: soma o stock com increment() em vez de uma
         transaÃ§Ã£o (que precisa de internet). O preÃ§o de custo Ã© atualizado
         normalmente a seguir.
        */
        await updateDoc(produtoRef(produtoId), {
            stock: increment(quantidade),
            custo: custo,
            atualizadoEm: serverTimestamp()
        });

        // Atualiza de forma sÃ­ncrona os dados em cache local na memÃ³ria do navegador
        produto.stock = numero(produto.stock) + quantidade;
        produto.custo = custo;

        // Limpa os campos do formulÃ¡rio para o prÃ³ximo registo
        document.getElementById("compra-fornecedor").value = "";
        document.getElementById("compra-quantidade").value = "";
        document.getElementById("compra-custo").value = "";

        renderTudo();

        // Regista a movimentaÃ§Ã£o financeira de entrada nos logs de auditoria
        await gravarAuditoria("Registou compra de " + quantidade + " unidades do artigo: " + produto.nome, "INFO");
        alert("Compra registada com sucesso e stock atualizado na base de dados.");

    } catch (error) {
        console.error("Erro crÃ­tico ao processar transaÃ§Ã£o de compra:", error);
        alert("Erro ao registar a compra de mercadoria:\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: RENDERIZAÃ‡ÃƒO DA TABELA DE ENTRADAS
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
        <td>${escapeHTML(c.produtoNome || "â€”")}</td>
        <td>${escapeHTML(c.fornecedorNome || "â€”")}</td>
        <td>${numero(c.quantidade)}</td>
        <td>${dinheiro(c.custoUnitario)}</td>
        <td>${dinheiro(numero(c.quantidade) * numero(c.custoUnitario))}</td>
    </tr>
    `).join("") || `
    <tr>
        <td colspan="6" style="text-align: center; color: #64748b;">
            Nenhuma operaÃ§Ã£o de compra registada para este negÃ³cio.
        </td>
    </tr>
    `;
}


/* =====================================================
   MÃ“DULO LÃ“GICO: PONTO DE VENDA (POS FLUXO DE CAIXA)
===================================================== */

document.getElementById("pos-pesquisa").addEventListener("input", renderPOS);


function renderPOS() {
    const pesquisa = document.getElementById("pos-pesquisa").value.toLowerCase();

    // Avisa quando offline: o stock mostrado pode nÃ£o refletir vendas feitas
    // por outros dispositivos enquanto ambos estiverem sem internet.
    const avisoOffline = document.getElementById("aviso-pos-offline");
    if (avisoOffline) {
        avisoOffline.innerHTML = navigator.onLine ? "" :
            `<div class="alert alert-warn">ðŸ”´ EstÃ¡ offline. O stock apresentado Ã© o Ãºltimo conhecido neste aparelho â€”
            se outro funcionÃ¡rio tambÃ©m estiver offline a vender o mesmo produto, pode haver stock negativo atÃ©
            os dois voltarem a ter internet e sincronizarem. Assim que sincronizar, verifique o aviso de
            reconciliaÃ§Ã£o no InÃ­cio, se aparecer.</div>`;
    }

    // Filtra artigos ativos pertencentes estritamente ao ramo de negÃ³cio aberto no ecrÃ£
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

    // SugestÃµes rÃ¡pidas marcadas pelo gerente (sÃ³ aparecem quando nÃ£o hÃ¡ pesquisa ativa)
    const containerDestaques = document.getElementById("pos-sugestoes-rapidas");
    if (containerDestaques) {
        const destaques = pesquisa ? [] : FABEF.produtos.filter(p => p.ativo !== false && p.ramo === FABEF.ramo && p.destaque);
        containerDestaques.innerHTML = destaques.length ? `
            <p style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">â­ SUGESTÃ•ES RÃPIDAS</p>
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
        Nenhum produto disponÃ­vel para faturamento neste ramo.
    </div>
    `;

    // Vincula dinamicamente a aÃ§Ã£o de clique nos cartÃµes injetados para adiÃ§Ã£o rÃ¡pida
    document.querySelectorAll("[data-pos-produto]").forEach(btn => {
        btn.addEventListener("click", () => adicionarCarrinho(btn.dataset.posProduto));
    });

    // Alimenta a lista de sugestÃ£o de clientes jÃ¡ cadastrados (para ligar a venda a um cliente)
    const listaClientesPos = document.getElementById("lista-clientes-pos");
    if (listaClientesPos) {
        listaClientesPos.innerHTML = FABEF.clientes
            .map(c => `<option value="${escapeHTML(c.nome)}">`)
            .join("");
    }

    renderCarrinho();
}


/* =====================================================
   MÃ“DULO LÃ“GICO: ADIÃ‡ÃƒO E CONTROLO DE STOCK DO CARRINHO
===================================================== */

async function adicionarCarrinho(id) {
    // A conta de gerente é só de controlo — não regista vendas (a menos que esteja no modo teste)
    if ((FABEF.userData?.perfil || FABEF.userData?.role) === "gerente" && !window.FABEF?.isDemoMode) {
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

    const unidadeFracionada = produto.unidade === "kg" || produto.unidade === "litro" || produto.unidade === "g";

    // Produtos vendidos por peso/volume (ex: carne no talho, granel, líquidos) abrem a calculadora fracionada
    if (unidadeFracionada) {
        abrirModalVendaFracionada(produto);
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
   MÓDULO: CALCULADORA DE VENDA FRACIONADA (PESO / VALOR)
===================================================== */
window.FABEF_frac_modo = "peso";

function abrirModalVendaFracionada(produto) {
    const modal = document.getElementById("modal-venda-fracionada");
    if (!modal) return;

    document.getElementById("frac-produto-id").value = produto.id;
    document.getElementById("frac-titulo").textContent = `🥩 ${produto.nome}`;
    document.getElementById("frac-subtitulo").textContent = `Preço: ${dinheiro(produto.preco)} / ${produto.unidade} | Stock na banca: ${numero(produto.stock)} ${produto.unidade}`;

    const inputPeso = document.getElementById("frac-peso");
    const inputValor = document.getElementById("frac-valor");
    const selectUnidade = document.getElementById("frac-unidade-medida");

    if (inputPeso) inputPeso.value = "";
    if (inputValor) inputValor.value = "";
    if (selectUnidade) selectUnidade.value = produto.unidade === "g" ? "g" : "kg";

    ativarModoCalculoFracionada("peso", produto);

    modal.classList.add("show");
    setTimeout(() => inputPeso?.focus(), 150);
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
        alert(`Quantidade solicitada (${totalPretendido.toFixed(3)} ${produto.unidade}) superior ao stock físico disponível na banca (${numero(produto.stock)} ${produto.unidade}).`);
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

        const qtdFormatada = (item.unidade === "kg" || item.unidade === "litro" || item.unidade === "g") ?
            `${numero(item.quantidade).toFixed(3)} ${item.unidade}` :
            `${numero(item.quantidade)} ${item.unidade || "un"}`;

        return `
        <div class="cart-item">
            <div class="cart-info">
                <strong>${escapeHTML(item.nome)}</strong><br>
                <small>${qtdFormatada} × ${dinheiro(item.preco)}</small>
            </div>
            <div style="font-weight: 700; font-size: 13px; margin-right: 5px; color: #065f46;">
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
   MÃ“DULO LÃ“GICO: FINALIZAR VENDA (TRANSAÃ‡ÃƒO ATÃ“MICA)
===================================================== */

document.getElementById("btn-finalizar-venda").addEventListener("click", finalizarVenda);


/* =====================================================
   MÃ“DULO LÃ“GICO: LEITURA DE CÃ“DIGO DE BARRAS POR CÃ‚MARA
   Usa a biblioteca html5-qrcode (carregada no index.html), que
   descodifica os fotogramas da cÃ¢mara em JavaScript puro â€” por
   isso funciona em qualquer navegador (Chrome, Safari/iOS,
   Firefox), ao contrÃ¡rio da funÃ§Ã£o nativa BarcodeDetector.
===================================================== */
let LEITOR_CODIGO_ATIVO = null;

window.abrirLeitorCodigoBarras = async function() {
    if (typeof Html5Qrcode === "undefined") {
        alert("A biblioteca de leitura de cÃ³digo de barras nÃ£o carregou. Verifique a ligaÃ§Ã£o Ã  internet e recarregue a pÃ¡gina.");
        return;
    }

    document.getElementById("modal-leitor-codigo")?.classList.add("show");
    document.getElementById("leitor-codigo-status").textContent = "A iniciar a cÃ¢mara...";

    try {
        LEITOR_CODIGO_ATIVO = new Html5Qrcode("leitor-codigo-camera");
        await LEITOR_CODIGO_ATIVO.start(
            { facingMode: "environment" }, // cÃ¢mara traseira do telemÃ³vel
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (codigoDetetado) => processarCodigoDetetado(codigoDetetado),
            () => { /* frame sem cÃ³digo legÃ­vel: ignora e continua a tentar */ }
        );
        document.getElementById("leitor-codigo-status").textContent = "Aponte a cÃ¢mara para o cÃ³digo de barras do produto.";
    } catch (error) {
        console.error(error);
        document.getElementById("leitor-codigo-status").textContent =
            "NÃ£o foi possÃ­vel aceder Ã  cÃ¢mara. Verifique se deu permissÃ£o de cÃ¢mara ao site, e se estÃ¡ a aceder por HTTPS.";
    }
};

window.fecharLeitorCodigoBarras = async function() {
    if (LEITOR_CODIGO_ATIVO) {
        try { await LEITOR_CODIGO_ATIVO.stop(); await LEITOR_CODIGO_ATIVO.clear(); } catch (e) { /* jÃ¡ parado */ }
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
            `CÃ³digo "${codigo}" lido, mas nenhum produto deste ramo tem esse cÃ³digo registado. A continuar a procurar...`;
        return; // continua a cÃ¢mara ligada para tentar outro cÃ³digo
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
    span.textContent += restante > 0.5 ? " em falta" : (restante < -0.5 ? " a mais" : " â€” tudo atribuÃ­do âœ“");
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
        alert("Operação Bloqueada: A aba e perfil do Gerente não pode realizar vendas operacionais. Todas as vendas de balcão no POS devem ser realizadas pelo perfil de Funcionário.");
        return;
    }

    if (limiteVendasDiariasAtingido()) {
        avisoLimiteAtingido(`Atingiu o limite diÃ¡rio de ${LIMITES_PLANO_GRATIS.vendasDiarias} vendas do plano grÃ¡tis.`);
        return;
    }

    // O estado do caixa jÃ¡ Ã© mantido em tempo real por um listener persistente.
    if (!FABEF.turnoId || FABEF.turno?.estado !== "ABERTO") {
        FABEF.carrinho = [];
        renderCarrinho();
        atualizarTelaCaixa();
        alert("OperaÃ§Ã£o bloqueada: o caixa / turno estÃ¡ fechado. Abra o caixa antes de realizar vendas.");
        return;
    }

    if (!FABEF.carrinho || !FABEF.carrinho.length) {
        alert("O carrinho estÃ¡ vazio. Adicione produtos antes de finalizar.");
        return;
    }

    const misto = document.getElementById("pos-pagamento-misto")?.checked || false;
    const pagamento = misto ? "Misto" : document.getElementById("forma-pagamento").value;
    const nuitCliente = (document.getElementById("pos-nuit-cliente")?.value.trim() || "Isento");
    const nomeClienteVenda = document.getElementById("pos-cliente-nome")?.value.trim() || "";
    if (nuitCliente !== "Isento" && !/^\d{9}$/.test(nuitCliente)) {
        alert("O NUIT do cliente deve conter exatamente 9 dÃ­gitos ou ficar em branco.");
        return;
    }
    const total = FABEF.carrinho.reduce((s, x) => s + (numero(x.preco) * numero(x.quantidade)), 0);
    const desconto = Math.min(numero(document.getElementById("pos-desconto")?.value), total);
    const totalComDesconto = total - desconto;

    // ---- Pagamento misto: soma das parcelas tem de bater certo com o total ----
    let detalhePagamento = null;
    let valorDinheiroVenda = pagamento === "NumerÃ¡rio" ? totalComDesconto : 0;
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
            alert("Para deixar uma parte da venda como crÃ©dito/fiado, indique o nome do cliente no campo \"Cliente\".");
            return;
        }
        valorDinheiroVenda = detalhePagamento.dinheiro;
        valorCreditoVenda = detalhePagamento.credito;
    }

    try {
        const vendaRef = doc(subRef("vendas"));

        /*
         COMPATÃVEL COM OFFLINE: em vez de uma transaÃ§Ã£o (que exige ligaÃ§Ã£o
         em tempo real ao servidor e falha sem internet), usamos increment(),
         que o Firestore sabe aplicar corretamente mesmo com o pedido em fila
         de espera offline, e resolve sozinho quando a ligaÃ§Ã£o voltar.
         A validaÃ§Ã£o de stock suficiente Ã© feita com os dados mais recentes
         que jÃ¡ temos em cache (FABEF.produtos) â€” em uso normal com internet
         isto Ã© sempre atualizado; offline, Ã© o melhor que se pode garantir
         sem uma leitura ao servidor.
        */
        const linhas = [];

        for (const item of FABEF.carrinho) {
            const produto = FABEF.produtos.find(p => p.id === item.produtoId);
            if (!produto) throw new Error("Produto nÃ£o encontrado no catÃ¡logo: " + item.nome);

            if (numero(produto.stock) < numero(item.quantidade)) {
                throw new Error("Stock insuficiente no estabelecimento para o artigo: " + item.nome);
            }

            updateDoc(produtoRef(item.produtoId), {
                stock: increment(-numero(item.quantidade)),
                atualizadoEm: serverTimestamp()
            });

            // Reflete de imediato na cache local, para a prÃ³xima venda jÃ¡ ver o stock correto
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

        // Grava o documento definitivo histÃ³rico da venda (funciona offline: fica em fila)
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

        // Atualiza de forma somatÃ³ria o fluxo financeiro do Turno de Caixa Ativo
        if (FABEF.turnoId) {
            const turnoRef = doc(db, "empresas", FABEF.empresaId, "caixas_turnos", FABEF.turnoId);
            updateDoc(turnoRef, {
                totalVendas: increment(totalComDesconto),
                totalVendasDinheiro: increment(valorDinheiroVenda),
                atualizadoEm: serverTimestamp()
            });
        }

        // Se parte da venda ficou a crÃ©dito, lanÃ§a/atualiza a conta corrente do cliente
        if (valorCreditoVenda > 0) {
            try {
                const clienteExistente = FABEF.clientes.find(c => c.nome.toLowerCase() === nomeClienteVenda.toLowerCase());
                await registrarOuAtualizarDivida(nomeClienteVenda, clienteExistente?.telefone || "", valorCreditoVenda);
            } catch (erroDivida) {
                console.error(erroDivida);
                alert("A venda foi concluÃ­da, mas nÃ£o foi possÃ­vel lanÃ§ar a parcela de crÃ©dito na conta do cliente:\n" + erroDivida.message);
            }
        }

        // Limpa o carrinho de compras apÃ³s a persistÃªncia bem-sucedida
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
        console.error("Erro crÃ­tico ao processar faturamento no POS:", error);
        alert("A venda nÃ£o pÃ´de ser concluÃ­da de forma segura:\n" + error.message);
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: HISTÃ“RICO E RENDERS DE VENDAS
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
        const ehFalhada = v.status === "FALHADA_CANCELADA" || v.status === "FALHADA" || v.status === "CANCELADA";
        return `
        <tr style="${ehFalhada ? 'background: #fff1f2; opacity: 0.88;' : ''}">
            <td>
                ${dataTexto(v.data || v.date)}
                ${ehFalhada ? `
                    <div style="margin-top:4px;"><span class="badge badge-red" style="font-size:11px;">⚠️ Falhada / Cancelada</span></div>
                    <div style="font-size:11px;color:#b91c1c;margin-top:2px;"><strong>Justificativa ao Gerente:</strong> ${escapeHTML(v.justificativaGerente || v.motivoFalha || 'Venda não concluída')}</div>
                ` : ""}
            </td>
            <td>${escapeHTML(v.operadorNome || v.user || "—")}</td>
            <td style="white-space: normal; max-width: 220px;">${itensMapeados}</td>
            <td><strong style="${ehFalhada ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${dinheiro(v.total)}</strong></td>
            <td>${escapeHTML(v.pagamento || v.method || "—")}</td>
            <td>${escapeHTML(v.nuitCliente || "Isento")}</td>
            <td>${escapeHTML(v.ramo || "—")}</td>
            <td>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    <button class="btn btn-light btn-small" onclick="imprimirReciboVenda('${escapeHTML(v.id)}')" type="button">🖨️ Recibo</button>
                    <button class="btn btn-success btn-small" onclick="enviarReciboWhatsApp('${escapeHTML(v.id)}')" type="button" style="background-color:#25d366;">📱 WhatsApp</button>
                    ${!ehFalhada ? `
                        <button class="btn btn-small" onclick="abrirModalVendaFalhada('${escapeHTML(v.id)}')" type="button" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:700;" title="Registar falha ou alteração com justificativa obrigatória ao Gerente">⚠️ Falhou / Corrigir</button>
                    ` : ""}
                </div>
            </td>
        </tr>`;
    }).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">Nenhuma operação de venda localizada nos critérios definidos.</td></tr>`;
}

window.imprimirReciboVenda = function(vendaId) {
    const v = FABEF.vendas.find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }

    const emp = FABEF.empresa || {};
    const nomeEmpresa = emp.nome || "FABEF GESTÃO ERP PRO";
    const nuitEmpresa = emp.nuit || "Isento / Não registado";
    const telEmpresa = emp.telefone || "+258 84 123 4567";
    const endEmpresa = emp.endereco || "Moçambique";
    const cidadeEmpresa = emp.cidade || "Maputo";
    const regimeIva = emp.ivaRegime === "normal" ? `IVA ${emp.ivaTaxa || 16}% Incluído` : "Regime de Isenção (Art. 9 CIVA)";
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

    const w = window.open("", "_blank");
    if (!w) { alert("O navegador bloqueou a janela de impressão."); return; }

    w.document.write(`
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
    `);
    w.document.close();
};

window.enviarReciboWhatsApp = function(vendaId) {
    const v = FABEF.vendas.find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }

    const emp = FABEF.empresa || {};
    const nomeEmpresa = emp.nome || "FABEF GESTÃO ERP PRO";
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
   EXPORTAÃ‡ÃƒO DE INVENTÃRIO CSV
===================================================== */

window.exportarInventarioCSV = function() {
    const produtosRamo = FABEF.produtos.filter(p => p.ramo === FABEF.ramo);
    if (!produtosRamo || produtosRamo.length === 0) { alert("NÃ£o existem produtos no inventÃ¡rio deste ramo para exportar."); return; }
    const cabecalhos = ["Produto","Categoria","Stock Existente","Stock Minimo","Preco Custo (MT)","Valor em Stock (MT)","Estado"];
    const linhas = produtosRamo.map(p => {
        const stock = numero(p.stock), custo = numero(p.custo), minimo = numero(p.stockMinimo);
        const estado = stock <= minimo ? "STOCK BAIXO" : "NORMAL";
        return [`"${String(p.nome || "").replace(/"/g,'""')}"`,`"${String(p.categoria || "â€”").replace(/"/g,'""')}"`,stock,minimo,custo.toFixed(2),(stock*custo).toFixed(2),estado];
    });
    const csv = [cabecalhos.join(";"), ...linhas.map(l => l.join(";"))].join("\n");
    try {
        const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]),csv], {type:"text/csv;charset=utf-8;"});
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href=url; link.download=`FABEF_Inventario_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        if (typeof gravarAuditoria === "function") gravarAuditoria("Exportou a lista de inventÃ¡rio para formato CSV/Excel.", "INFO");
    } catch(error) { console.error(error); alert("NÃ£o foi possÃ­vel exportar o inventÃ¡rio."); }
};

document.getElementById("btn-exportar-inventario")?.addEventListener("click", exportarInventarioCSV);

/* =====================================================
   MÃ“DULO LÃ“GICO: GESTÃƒO DE FORNECEDORES
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

        // Alimenta de forma sÃ­ncrona a cache interna local
        FABEF.fornecedores.push({
            id: ref.id,
            nome: payload.nome,
            telefone: payload.telefone,
            observacao: payload.observacao,
            divida: payload.divida,
            ramo: payload.ramo,
            data: payload.data
        });

        // Limpa os elementos de texto do formulÃ¡rio
        document.getElementById("fornecedor-nome").value = "";
        document.getElementById("fornecedor-telefone").value = "";
        document.getElementById("fornecedor-observacao").value = "";
        if (document.getElementById("fornecedor-divida")) document.getElementById("fornecedor-divida").value = "";

        renderFornecedores();

        await gravarAuditoria("Adicionou o fornecedor ao catÃ¡logo: " + nome, "INFO");
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
        <td>${escapeHTML(f.telefone || "â€”")}</td>
        <td>${escapeHTML(f.observacao || "â€”")}</td>
        <td style="color:${divida > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(divida)}</td>
        <td>${compras.length}</td>
        <td>
            <div style="display:flex;gap:5px;">
                <button class="btn btn-light btn-small" type="button" onclick="verComprasFornecedor('${escapeHTML(f.nome)}')">ðŸšš Compras</button>
                <button class="btn btn-light btn-small" type="button" onclick="amortizarDividaFornecedorPrompt('${escapeHTML(f.id)}','${escapeHTML(f.nome)}')" ${divida > 0 ? '' : 'disabled'}>ðŸ’µ Pagar</button>
            </div>
        </td>
    </tr>
    `;
    }).join("") || `
    <tr>
        <td colspan="6" style="text-align: center; color: #64748b;">
            Nenhum fornecedor registado para este negÃ³cio.
        </td>
    </tr>
    `;
}

window.verComprasFornecedor = function(nomeFornecedor) {
    const compras = FABEF.compras.filter(c => (c.fornecedorNome || "").toLowerCase() === nomeFornecedor.toLowerCase());
    if (compras.length === 0) { alert("Ainda nÃ£o hÃ¡ compras registadas para " + nomeFornecedor + "."); return; }
    const linhas = compras
        .slice()
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
        .map(c => `${dataTexto(c.data)} â€” ${c.produtoNome} x${c.quantidade} â€” ${dinheiro(numero(c.quantidade) * numero(c.custoUnitario))}`)
        .join("\n");
    alert("Compras a " + nomeFornecedor + ":\n\n" + linhas);
};

window.amortizarDividaFornecedorPrompt = async function(id, nome) {
    const fornecedor = FABEF.fornecedores.find(f => f.id === id);
    if (!fornecedor) return;
    const quantiaStr = prompt("Valor pago ao fornecedor " + nome + " (dÃ­vida atual: " + dinheiro(fornecedor.divida) + "):");
    if (!quantiaStr) return;
    const quantia = numero(quantiaStr);
    if (quantia <= 0) { alert("O valor deve ser superior a zero."); return; }
    if (quantia > numero(fornecedor.divida)) { alert("O valor introduzido Ã© superior Ã  dÃ­vida atual."); return; }

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
   MÃ“DULO LÃ“GICO: GESTÃƒO DE CLIENTES
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
        alert("JÃ¡ existe um cliente registado com este nome.");
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
        <td>${escapeHTML(c.telefone || "â€”")}</td>
        <td>${escapeHTML(c.endereco || "â€”")}</td>
        <td style="color:${saldo > 0 ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(saldo)}</td>
        <td><button class="btn btn-light btn-small" type="button" onclick="verDetalheCliente('${escapeHTML(c.id)}')">ðŸ‘ï¸ Detalhes</button></td>
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

    // HistÃ³rico de compras: vendas do POS ligadas a este cliente pelo nome
    const comprasCliente = FABEF.vendas
        .filter(v => (v.cliente || "").toLowerCase() === (c.nome || "").toLowerCase())
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    const totalPago = comprasCliente.reduce((s, v) => s + numero(v.total), 0);
    const ultimaCompra = comprasCliente.length ? dataTexto(comprasCliente[0].data) : "â€”";

    document.getElementById("dc-titulo").textContent = c.nome;
    document.getElementById("dc-corpo").innerHTML = `
        <p><strong>Telefone:</strong> ${escapeHTML(c.telefone || "â€”")}</p>
        <p><strong>EndereÃ§o:</strong> ${escapeHTML(c.endereco || "â€”")}</p>
        <p><strong>ObservaÃ§Ã£o:</strong> ${escapeHTML(c.observacao || "â€”")}</p>
        <p style="margin-top:10px;"><strong>DÃ­vida atual:</strong>
            <span style="color:${numero(divida?.saldo) > 0 ? '#ef4444' : '#10b981'};font-weight:700;">
                ${dinheiro(numero(divida?.saldo))}
            </span>
        </p>
        <p><strong>Total jÃ¡ pago (histÃ³rico):</strong> ${dinheiro(totalPago)}</p>
        <p><strong>Ãšltima compra:</strong> ${ultimaCompra}</p>
        <p style="margin-top:10px;"><strong>HistÃ³rico de compras (${comprasCliente.length}):</strong></p>
        ${comprasCliente.length ? '<ul style="margin-top:6px;padding-left:18px;max-height:160px;overflow-y:auto;">' +
            comprasCliente.map(v => `<li>${dataTexto(v.data)} â€” ${dinheiro(numero(v.total))} â€” ${escapeHTML(v.pagamento || "â€”")}</li>`).join("") +
            '</ul>' : '<p style="color:#64748b;">Ainda nÃ£o hÃ¡ compras registadas para este cliente.</p>'}
        <p style="margin-top:10px;"><strong>Encomendas registadas:</strong> ${encomendasCliente.length}</p>
        ${encomendasCliente.length ? '<ul style="margin-top:6px;padding-left:18px;">' +
            encomendasCliente.map(e => `<li>${escapeHTML(e.produto)} â€” x${e.quantidade} â€” ${escapeHTML(e.estado || 'Pendente')}</li>`).join("") +
            '</ul>' : ''}
    `;
    document.getElementById("modal-detalhe-cliente")?.classList.add("show");
};


/* =====================================================
   MÃ“DULO LÃ“GICO: GESTÃƒO DE FIADO / DÃVIDAS COM BARREIRA DE CRÃ‰DITO
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
            throw new Error("O limite de crÃ©dito deste cliente foi ultrapassado.");
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
    if ((FABEF.userData?.perfil || FABEF.userData?.role) === "gerente" && !window.FABEF?.isDemoMode) {
        alert("A conta de gerente nÃ£o regista novas dÃ­vidas â€” isso Ã© feito pelo funcionÃ¡rio no momento da venda ou do atendimento. O gerente pode consultar e acompanhar aqui.");
        return;
    }
    const cliente = document.getElementById("divida-cliente").value.trim();
    const telefone = document.getElementById("divida-telefone").value.trim();
    const valor = numero(document.getElementById("divida-valor").value);
    const limite = numero(document.getElementById("divida-limite").value);

    if (!cliente || valor <= 0) {
        alert("Dados invÃ¡lidos. Introduza um cliente e um valor superior a zero.");
        return;
    }

    try {
        // Se jÃ¡ existir cliente, respeita o limite definido antes; senÃ£o usa o limite agora introduzido
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

        // Limpa os campos do formulÃ¡rio apÃ³s o registo bem-sucedido
        document.getElementById("divida-cliente").value = "";
        document.getElementById("divida-telefone").value = "";
        document.getElementById("divida-valor").value = "";

        renderDividas();

        await gravarAuditoria("Registou uma nova dÃ­vida / fiado no valor de " + dinheiro(valor) + " para o cliente: " + cliente, "INFO");
        alert("DÃ­vida registada e conta corrente atualizada com sucesso.");

    } catch (error) {
        console.error("Erro crÃ­tico ao processar conta corrente de fiado:", error);
        alert("NÃ£o foi possÃ­vel registar o fiado:\n" + mensagemFirebase(error));
    }
}
/* =====================================================
   MÃ“DULO LÃ“GICO: RENDERIZAÃ‡ÃƒO DA CONTA CORRENTE DE FIADO (COMPLEMENTO)
===================================================== */

function renderDividas() {
    const tabelaCorpo = document.getElementById("tabela-dividas");
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = FABEF.dividas.map(d => {
        const possuiDivida = numero(d.saldo) > 0;
        const botaoCobrar = possuiDivida
            ? `<button class="btn btn-success btn-small" onclick="enviarLembreteDivida('${escapeHTML(d.id)}')" type="button" style="background-color:#25d366;">ðŸ“± Cobrar</button>`
            : `<button class="btn btn-secondary btn-small" type="button" disabled style="opacity:.4;">ðŸ“± Pago</button>`;
        return `<tr><td><strong>${escapeHTML(d.cliente)}</strong></td><td>${escapeHTML(d.telefone || "â€”")}</td><td style="color:${possuiDivida ? '#ef4444' : '#10b981'};font-weight:700;">${dinheiro(d.saldo)}</td><td>${dinheiro(d.limite)}</td><td><div style="display:flex;gap:5px;"><button class="btn btn-light btn-small" onclick="amortizarDividaPrompt('${escapeHTML(d.id)}','${escapeHTML(d.cliente)}')" type="button" ${possuiDivida ? '' : 'disabled'}>Amortizar</button>${botaoCobrar}</div></td></tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center;color:#64748b;">Nenhum registo de fiado ativo localizado.</td></tr>`;
}

window.enviarLembreteDivida = function(id) {
    const d = FABEF.dividas.find(x => x.id === id);
    if (!d) return;
    if (!d.telefone || d.telefone === "â€”") { alert("Este cliente nÃ£o tem um nÃºmero de telefone registado."); return; }
    let telefoneFormatado = String(d.telefone).trim().replace(/\D/g, "");
    if (telefoneFormatado.length === 9) telefoneFormatado = "258" + telefoneFormatado;
    const nomeEmpresa = FABEF.empresa?.nome || "Nosso Estabelecimento";
    const mensagem = encodeURIComponent(`OlÃ¡ *${d.cliente}*,\n\nEsperamos que esteja bem. Passamos por aqui para lembrar gentilmente que possui um saldo em aberto no valor de *${dinheiro(d.saldo)}* referente Ã s suas compras a fiado em *${nomeEmpresa}*.\n\nO seu limite de crÃ©dito atual Ã© de ${dinheiro(d.limite)}.\n\nAgradecemos se puder passar pelo estabelecimento para regularizar o valor assim que possÃ­vel. Obrigado pela compreensÃ£o! ðŸ™`);
    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, "_blank");
};

window.amortizarDividaPrompt = async function(id, cliente) {
    const quantiaStr = prompt("Introduza o valor recebido para amortizar a dÃ­vida de " + cliente + ":");
    if (!quantiaStr) return;
    
    const quantia = numero(quantiaStr);
    if (quantia <= 0) {
        alert("O valor de amortizaÃ§Ã£o deve ser superior a zero.");
        return;
    }

    const devedor = FABEF.dividas.find(d => d.id === id);
    if (!devedor) return;

    if (quantia > numero(devedor.saldo)) {
        alert("O valor introduzido Ã© superior ao saldo devedor atual (" + dinheiro(devedor.saldo) + ").");
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
        alert("AmortizaÃ§Ã£o registada com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao abater a dÃ­vida:\n" + mensagemFirebase(error));
    }
};


/* =====================================================
   MÃ“DULO LÃ“GICO: GESTÃƒO E FILTRAGEM DE ENCOMENDAS
===================================================== */

document.getElementById("btn-registar-encomenda").addEventListener("click", registarEncomenda);


async function registarEncomenda() {
    if (!window.FABEF?.isDemoMode && (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente") { alert("O Gerente não pode registar encomendas. Esta operação é exclusiva do Funcionário."); return; }
    if (limiteEncomendasDiariasAtingido()) {
        avisoLimiteAtingido(`Atingiu o limite diÃ¡rio de ${LIMITES_PLANO_GRATIS.encomendasDiarias} encomendas do plano grÃ¡tis.`);
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
        alert("Preencha correctamente todos os dados necessÃ¡rios da encomenda.");
        return;
    }
    if (valorPago > valorTotal) {
        alert("O valor jÃ¡ pago nÃ£o pode ser maior do que o valor total da encomenda.");
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

        // Esvazia os campos para prevenir submissÃµes duplicadas
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
    EM_PREPARACAO: "Em preparaÃ§Ã£o",
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
            botoesAcao = `<button class="btn btn-light btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','EM_PREPARACAO')" type="button">ðŸ› ï¸ Em preparaÃ§Ã£o</button>`;
        } else if (e.estado === "EM_PREPARACAO") {
            botoesAcao = `<button class="btn btn-success btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','PRONTA')" type="button">âœ”ï¸ Marcar pronta</button>`;
        } else if (e.estado === "PRONTA") {
            botoesAcao = `<button class="btn btn-danger btn-small" onclick="mudarEstadoEncomenda('${escapeHTML(e.id)}','ENTREGUE')" type="button">ðŸ“¦ Entregar</button>`;
        } else {
            botoesAcao = `<span style="color:#64748b;font-size:12px;font-weight:600;">${e.estado === "CANCELADA" ? "Cancelada" : "ConcluÃ­da"}</span>`;
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
    if (!e.telefone || e.telefone === "â€”") { alert("Esta encomenda nÃ£o possui um nÃºmero de telefone registado."); return; }
    let telefoneFormatado = String(e.telefone).trim().replace(/\D/g, "");
    if (telefoneFormatado.length === 9) telefoneFormatado = "258" + telefoneFormatado;
    const nomeEmpresa = FABEF.empresa?.nome || "Nosso Estabelecimento";
    const valorRestante = Math.max(0, numero(e.valorTotal) - numero(e.valorPago));

    let corpoMensagem;
    if (e.estado === "PRONTA") {
        corpoMensagem = `Temos boas notÃ­cias! A sua encomenda do artigo *${e.produto}* (Quantidade: ${e.quantidade}) jÃ¡ estÃ¡ pronta e disponÃ­vel para levantamento na *${nomeEmpresa}*.`;
    } else {
        corpoMensagem = `Passamos para lembrar sobre a sua encomenda do artigo *${e.produto}* (Quantidade: ${e.quantidade}), com estado atual: *${ROTULO_ESTADO_ENCOMENDA[e.estado] || e.estado}*.` +
            (e.dataPrevista ? `\nPrevisÃ£o de entrega: *${e.dataPrevista}*.` : "");
    }
    if (valorRestante > 0) {
        corpoMensagem += `\n\nValor pendente para esta encomenda: *${dinheiro(valorRestante)}*.`;
    }

    const mensagem = encodeURIComponent(`OlÃ¡ *${e.cliente}*,\n\n${corpoMensagem}\n\nEstamos Ã  sua espera! Muito obrigado. ðŸ›ï¸`);
    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, "_blank");
};

/* =====================================================
   MÃ“DULO LÃ“GICO: CONTROLO FINANCEIRO DE CAIXA / TURNOS
===================================================== */

let FABEF_UNSUB_CAIXA = null;

function ouvirCaixa() {
    return new Promise((resolve) => {
        // Se jÃ¡ havia uma escuta ativa (ex: estava a ouvir o caixa de outro
        // ramo antes de trocar), termina-a primeiro â€” nunca ficam duas em
        // simultÃ¢neo, senÃ£o o estado do caixa ficaria instÃ¡vel.
        if (FABEF_UNSUB_CAIXA) {
            try { FABEF_UNSUB_CAIXA(); } catch (_) {}
            FABEF_UNSUB_CAIXA = null;
        }

        let primeiraVez = true;
        try {
            // Query de seguranÃ§a: Busca se existe algum caixa com estado ativo aberto para este operador e ramo
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
                console.error("Erro crÃ­tico na escuta do estado do caixa:", erro);
                FABEF.turnoId = null;
                FABEF.turno = null;
                atualizarTelaCaixa();
                if (primeiraVez) { primeiraVez = false; resolve(); }
            });

            FABEF.listeners.push(FABEF_UNSUB_CAIXA);
        } catch (error) {
            console.error("Erro crÃ­tico na escuta do estado do caixa:", error);
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
        alert("SÃ³ o gerente pode abrir o caixa. PeÃ§a ao gerente para autenticar-se e abrir o turno antes de comeÃ§ar a vender.");
        return;
    }

    if (FABEF.turnoId) {
        alert("OperaÃ§Ã£o bloqueada: JÃ¡ existe um turno de caixa em execuÃ§Ã£o.");
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
    const motivo = prompt("Motivo da sangria (ex: pagamento a fornecedor, depÃ³sito no banco):", "") || "Sem motivo indicado";

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
    const valor = numero(prompt("Valor do reforÃ§o (entrada extra de dinheiro no caixa):", "0"));
    if (!valor || valor <= 0) return;
    const motivo = prompt("Motivo do reforÃ§o (ex: troco adicional trazido pelo gerente):", "") || "Sem motivo indicado";

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
        await gravarAuditoria(`Registou um reforÃ§o de caixa de ${dinheiro(valor)}. Motivo: ${motivo}`, "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao registar o reforÃ§o:\n" + mensagemFirebase(error));
    }
}


async function fecharCaixa() {
    if (!FABEF.turnoId) return;

    // Fecho de caixa Ã© uma aÃ§Ã£o de controlo: sÃ³ o gerente confirma o fecho.
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o gerente pode confirmar o fecho do caixa. PeÃ§a ao gerente para autenticar-se e fechar o turno.");
        return;
    }

    const esperado = saldoEsperadoCaixa();
    const contadoTexto = prompt(
        `Saldo esperado em dinheiro no caixa: ${dinheiro(esperado)}\n\nConte o dinheiro fÃ­sico na gaveta e introduza o valor contado:`,
        esperado.toFixed(2)
    );
    if (contadoTexto === null) return; // cancelou
    const contado = numero(contadoTexto);
    const diferenca = contado - esperado;

    if (Math.abs(diferenca) > 0.5) {
        const confirmar = confirm(
            `AtenÃ§Ã£o: existe uma diferenÃ§a de caixa de ${dinheiro(diferenca)} (${diferenca > 0 ? "sobra" : "falta"}).\n\nDeseja continuar e fechar o turno mesmo assim?`
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
            `Fechou o turno de caixa. Esperado: ${dinheiro(esperado)} | Contado: ${dinheiro(contado)} | DiferenÃ§a: ${dinheiro(diferenca)}`,
            Math.abs(diferenca) > 0.5 ? "ALERTA" : "INFO"
        );

        FABEF.turnoId = null;
        FABEF.turno = null;

        // Limpa tambÃ©m o formulÃ¡rio inicial para o prÃ³ximo turno
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
        const sangrias = (FABEF.turno?.sangrias || []).map(m => `<li style="color:#ef4444;">âˆ’ ${dinheiro(m.valor)} (Sangria) â€” ${escapeHTML(m.motivo)} â€” ${escapeHTML(m.operadorNome || "")}</li>`);
        const reforcos = (FABEF.turno?.reforcos || []).map(m => `<li style="color:#10b981;">+ ${dinheiro(m.valor)} (ReforÃ§o) â€” ${escapeHTML(m.motivo)} â€” ${escapeHTML(m.operadorNome || "")}</li>`);
        const todos = [...sangrias, ...reforcos];
        listaMovimentos.innerHTML = todos.length ? `<ul style="padding-left:18px;">${todos.join("")}</ul>` : `<p style="color:#64748b;font-size:13px;">Sem sangrias ou reforÃ§os neste turno.</p>`;
    }

    // Gerencia dinamicamente a visibilidade dos ecrÃ£s de aÃ§Ã£o com a classe hidden blindada
    document.getElementById("caixa-abertura")?.classList.toggle("hidden", aberto);
    document.getElementById("caixa-fecho")?.classList.toggle("hidden", !aberto);
    document.getElementById("aviso-pos-caixa")?.classList.toggle("hidden", aberto);

    // Abrir/fechar o caixa Ã© uma aÃ§Ã£o exclusiva do gerente â€” o funcionÃ¡rio sÃ³
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
   MÃ“DULO LÃ“GICO: REGISTO E LANÃ‡AMENTO DE DESPESAS
===================================================== */

document.getElementById("btn-registar-despesa").addEventListener("click", registarDespesa);


async function registarDespesa() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) === "gerente" && !window.FABEF?.isDemoMode) {
        alert("A conta de gerente nÃ£o regista despesas diretamente â€” isso Ã© feito pelo funcionÃ¡rio. O gerente pode consultar aqui.");
        return;
    }
    const descricao = document.getElementById("despesa-descricao").value.trim();
    const valor = numero(document.getElementById("despesa-valor").value);

    if (!descricao || valor <= 0) {
        alert("Introduza uma descriÃ§Ã£o vÃ¡lida e um valor superior a zero.");
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

        // Alimenta de forma sÃ­ncrona a cache local na memÃ³ria do navegador
        FABEF.despesas.push({
            id: ref.id,
            descricao: payload.descricao,
            valor: payload.valor,
            ramo: payload.ramo,
            utilizadorNome: payload.utilizadorNome,
            data: payload.data
        });

        // Limpa os campos do formulÃ¡rio para o prÃ³ximo lanÃ§amento
        document.getElementById("despesa-descricao").value = "";
        document.getElementById("despesa-valor").value = "";

        renderDespesas();

        // Regista a saÃ­da financeira nos logs inalterÃ¡veis de auditoria
        await gravarAuditoria("Registou despesa comercial: " + descricao + " no valor de " + dinheiro(valor), "INFO");
    } catch (error) {
        console.error(error);
        alert("Erro ao registar a despesa na base de dados:\n" + mensagemFirebase(error));
    }
}


function renderDespesas() {
    const tabelaCorpo = document.getElementById("tabela-despesas");
    if (!tabelaCorpo) return;

    // Ordena as despesas de forma decrescente pela data de lanÃ§amento
    const listaOrdenada = FABEF.despesas
        .slice()
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    tabelaCorpo.innerHTML = listaOrdenada.map(d => `
    <tr>
        <td>${dataTexto(d.data)}</td>
        <td>${escapeHTML(d.descricao)}</td>
        <td style="color: #dc2626; font-weight: 600;">${dinheiro(d.valor)}</td>
        <td>${escapeHTML(d.utilizadorNome || "â€”")}</td>
    </tr>
    `).join("") || `
    <tr>
        <td colspan="4" style="text-align: center; color: #64748b;">
            Nenhuma despesa registada para este negÃ³cio.
        </td>
    </tr>
    `;
}


/* =====================================================
   MÃ“DULO LÃ“GICO: MOTOR DINÃ‚MICO DE RELATÃ“RIOS FINANCEIROS
===================================================== */

document.getElementById("btn-atualizar-relatorio").addEventListener("click", renderRelatorios);
document.getElementById("relatorio-periodo").addEventListener("change", renderRelatorios);


function renderRelatorios() {
    const periodo = document.getElementById("relatorio-periodo").value;
    let inicio = null;

    if (periodo === "hoje") inicio = dataHoje();
    if (periodo === "7") inicio = diasAtras(7);
    if (periodo === "30") inicio = diasAtras(30);

    // Filtra vendas e despesas aplicando os limites cronolÃ³gicos selecionados na interface
    const vendasFiltradas = FABEF.vendas.filter(v => {
        const d = new Date(v.data || v.date || 0);
        return !inicio || d >= inicio;
    });

    const despesasFiltradas = FABEF.despesas.filter(d => {
        const dataDespesa = new Date(d.data || 0);
        return !inicio || dataDespesa >= inicio;
    });

    // Executa as somas dos indicadores financeiros bÃ¡sicos
    const faturamento = vendasFiltradas.reduce((s, v) => s + numero(v.total), 0);
    const totalDespesas = despesasFiltradas.reduce((s, d) => s + numero(d.valor), 0);
    const resultado = faturamento - totalDespesas;

    // Alimenta os elementos grÃ¡ficos da pÃ¡gina de relatÃ³rios
    document.getElementById("rel-faturamento").textContent = dinheiro(faturamento);
    document.getElementById("rel-despesas").textContent = dinheiro(totalDespesas);
    
    const resultadoSpan = document.getElementById("rel-resultado");
    if (resultadoSpan) {
        resultadoSpan.textContent = dinheiro(resultado);
        resultadoSpan.style.color = resultado >= 0 ? "#16a34a" : "#dc2626";
    }

    // Soma quantos kg/litros foram vendidos no perÃ­odo (produtos vendidos a peso/volume)
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

    // Guarda o relatÃ³rio atual em memÃ³ria para as funÃ§Ãµes de exportaÃ§Ã£o (PDF/Word/WhatsApp)
    FABEF_RELATORIO_ATUAL = {
        periodo: periodo === "hoje" ? "Hoje" : periodo === "7" ? "Ãšltimos 7 dias" : periodo === "30" ? "Ãšltimos 30 dias" : "Todo o perÃ­odo",
        faturamento, totalDespesas, resultado, kgPeriodo, litroPeriodo,
        numVendas: vendasFiltradas.length
    };

    // Curva ABC e AnÃ¡lise Inteligente sÃ£o funcionalidades avanÃ§adas â€”
    // sÃ³ disponÃ­veis no Plano Pago (ou durante o perÃ­odo de teste).
    const planoRelatorios = obterPlanoAtual();
    const avisoAvancado = document.getElementById("aviso-relatorios-avancados");
    if (planoRelatorios === "GRATIS") {
        if (avisoAvancado) avisoAvancado.innerHTML = `<div class="alert alert-warning">ðŸ”’ A Curva ABC e a AnÃ¡lise Inteligente sÃ£o funcionalidades do Plano Pago. <button class="btn btn-success btn-small" type="button" onclick="mostrarSecao('subscricao')">â­ Atualizar por 250 MT</button></div>`;
        document.getElementById("tabela-abc").innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">DisponÃ­vel no Plano Pago.</td></tr>`;
        document.getElementById("analise-inteligente").innerHTML = "";
    } else {
        if (avisoAvancado) avisoAvancado.innerHTML = "";
        // Invoca o motor matemÃ¡tico da Curva ABC de produtos baseado nas vendas filtradas
        renderABC(vendasFiltradas);
        // AnÃ¡lise inteligente adicional
        renderAnaliseInteligente(vendasFiltradas, despesasFiltradas);
    }
}

let FABEF_RELATORIO_ATUAL = null;

/* =====================================================
   MÃ“DULO LÃ“GICO: EXPORTAÃ‡ÃƒO DE RELATÃ“RIOS
===================================================== */
function textoResumoRelatorio() {
    if (!FABEF_RELATORIO_ATUAL) return "";
    const r = FABEF_RELATORIO_ATUAL;
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    let texto = `ðŸ“Š RelatÃ³rio â€” ${nomeEmpresa} (${escapeHTML(FABEF.ramo)})\n`;
    texto += `PerÃ­odo: ${r.periodo}\n\n`;
    texto += `Faturamento: ${dinheiro(r.faturamento)}\n`;
    texto += `Despesas: ${dinheiro(r.totalDespesas)}\n`;
    texto += `Resultado: ${dinheiro(r.resultado)}\n`;
    texto += `NÃºmero de vendas: ${r.numVendas}\n`;
    if (r.kgPeriodo > 0) texto += `Total vendido em kg: ${r.kgPeriodo.toFixed(2)} kg\n`;
    if (r.litroPeriodo > 0) texto += `Total vendido em litros: ${r.litroPeriodo.toFixed(2)} L\n`;
    return texto;
}

window.enviarRelatorioWhatsApp = function() {
    if (!FABEF_RELATORIO_ATUAL) { alert("Aguarde o relatÃ³rio carregar."); return; }
    const mensagem = encodeURIComponent(textoResumoRelatorio());
    window.open(`https://wa.me/?text=${mensagem}`, "_blank");
};

window.exportarRelatorioPDF = function() {
    if (!FABEF_RELATORIO_ATUAL) { alert("Aguarde o relatÃ³rio carregar."); return; }
    const r = FABEF_RELATORIO_ATUAL;
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    const janela = window.open("", "_blank");
    janela.document.write(`<html><head><title>RelatÃ³rio - ${escapeHTML(nomeEmpresa)}</title>
    <style>body{font-family:Arial;padding:24px;color:#0f172a;} h2{margin-bottom:4px;} table{width:100%;border-collapse:collapse;margin-top:14px;} td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;}</style>
    </head><body>
    <h2>${escapeHTML(nomeEmpresa)}</h2>
    <p>Ramo: ${escapeHTML(FABEF.ramo)} | PerÃ­odo: ${escapeHTML(r.periodo)}</p>
    <table>
        <tr><td><strong>Faturamento</strong></td><td>${dinheiro(r.faturamento)}</td></tr>
        <tr><td><strong>Despesas</strong></td><td>${dinheiro(r.totalDespesas)}</td></tr>
        <tr><td><strong>Resultado</strong></td><td>${dinheiro(r.resultado)}</td></tr>
        <tr><td><strong>NÃºmero de vendas</strong></td><td>${r.numVendas}</td></tr>
        ${r.kgPeriodo > 0 ? `<tr><td><strong>Total vendido em kg</strong></td><td>${r.kgPeriodo.toFixed(2)} kg</td></tr>` : ""}
        ${r.litroPeriodo > 0 ? `<tr><td><strong>Total vendido em litros</strong></td><td>${r.litroPeriodo.toFixed(2)} L</td></tr>` : ""}
    </table>
    <p style="margin-top:20px;color:#64748b;font-size:12px;">Gerado pelo FABEF GestÃ£o ERP PRO</p>
    <script>window.print();<\/script>
    </body></html>`);
    janela.document.close();
};

window.exportarRelatorioWord = function() {
    if (!FABEF_RELATORIO_ATUAL) { alert("Aguarde o relatÃ³rio carregar."); return; }
    const r = FABEF_RELATORIO_ATUAL;
    const nomeEmpresa = FABEF.empresa?.nome || "FABEF ERP";
    const html = `<html><head><meta charset="utf-8"></head><body>
    <h2>${escapeHTML(nomeEmpresa)}</h2>
    <p>Ramo: ${escapeHTML(FABEF.ramo)} | PerÃ­odo: ${escapeHTML(r.periodo)}</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;">
        <tr><td><b>Faturamento</b></td><td>${dinheiro(r.faturamento)}</td></tr>
        <tr><td><b>Despesas</b></td><td>${dinheiro(r.totalDespesas)}</td></tr>
        <tr><td><b>Resultado</b></td><td>${dinheiro(r.resultado)}</td></tr>
        <tr><td><b>NÃºmero de vendas</b></td><td>${r.numVendas}</td></tr>
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

    // HorÃ¡rio com maior movimento (por hora do dia)
    const porHora = {};
    vendasFiltradas.forEach(v => {
        const hora = new Date(v.data || 0).getHours();
        if (!isNaN(hora)) porHora[hora] = (porHora[hora] || 0) + 1;
    });
    const melhorHora = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0];

    // Clientes com maior frequÃªncia de compra
    const porCliente = {};
    vendasFiltradas.forEach(v => {
        if (!v.cliente) return;
        porCliente[v.cliente] = (porCliente[v.cliente] || 0) + 1;
    });
    const clienteFrequente = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0];

    // DÃ­vidas pendentes (global, nÃ£o depende do perÃ­odo)
    const dividasPendentes = FABEF.dividas.filter(d => numero(d.saldo) > 0);
    const totalDividasPendentes = dividasPendentes.reduce((s, d) => s + numero(d.saldo), 0);

    // Produtos prÃ³ximos de acabar (do ramo ativo)
    const produtosBaixos = FABEF.produtos.filter(p => p.ramo === FABEF.ramo && numero(p.stock) > 0 && numero(p.stock) <= numero(p.stockMinimo));

    // Despesa mais elevada do perÃ­odo
    const despesaMaisAlta = [...despesasFiltradas].sort((a, b) => numero(b.valor) - numero(a.valor))[0];

    const linha = (rotulo, valor) => `<p style="margin-bottom:8px;"><strong>${rotulo}:</strong> ${valor}</p>`;

    painel.innerHTML =
        linha("Produto mais vendido", maisVendido ? `${escapeHTML(maisVendido[0])} (${maisVendido[1]} unidades)` : "Sem dados no perÃ­odo") +
        linha("Produto menos vendido", menosVendido && listaProdutos.length > 1 ? `${escapeHTML(menosVendido[0])} (${menosVendido[1]} unidades)` : "Sem dados suficientes") +
        linha("Melhor dia de vendas", melhorDia ? `${escapeHTML(melhorDia[0])} â€” ${dinheiro(melhorDia[1])}` : "Sem dados no perÃ­odo") +
        linha("HorÃ¡rio com maior movimento", melhorHora ? `${melhorHora[0]}h â€” ${melhorHora[1]} venda(s)` : "Sem dados no perÃ­odo") +
        linha("Cliente mais frequente", clienteFrequente ? `${escapeHTML(clienteFrequente[0])} (${clienteFrequente[1]} compras)` : "Ainda sem vendas ligadas a clientes") +
        linha("DÃ­vidas pendentes (total)", `${dinheiro(totalDividasPendentes)} em ${dividasPendentes.length} cliente(s)`) +
        linha("Produtos prÃ³ximos de acabar", produtosBaixos.length ? produtosBaixos.map(p => escapeHTML(p.nome)).join(", ") : "Nenhum, tudo em ordem") +
        linha("Despesa mais elevada do perÃ­odo", despesaMaisAlta ? `${escapeHTML(despesaMaisAlta.descricao)} â€” ${dinheiro(despesaMaisAlta.valor)}` : "Sem despesas no perÃ­odo");
}


/* =====================================================
   MÃ“DULO LÃ“GICO: MOTOR ANALÃTICO DE CURVA ABC (PARETO)
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
         CLASSIFICAÃ‡ÃƒO DE PARETO:
         Classe A: AtÃ© 80% do faturamento (Artigos mais importantes/crÃ­ticos)
         Classe B: De 80% a 95% do faturamento (ImportÃ¢ncia intermÃ©dia)
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
            Nenhuma operaÃ§Ã£o comercial localizada no perÃ­odo para compor a Curva ABC.
        </td>
    </tr>
    `;
}
/* =====================================================
   MÃ“DULO LÃ“GICO: CONFIGURAÃ‡Ã•ES CORPORATIVAS DO NEGÃ“CIO
===================================================== */

function renderConfiguracoes() {
    const nomeInput = document.getElementById("config-nome");
    const nuitInput = document.getElementById("config-nuit");
    const telInput = document.getElementById("config-telefone");
    const endInput = document.getElementById("config-endereco");
    const cidInput = document.getElementById("config-cidade");
    const ivaRegimeInput = document.getElementById("config-iva-regime");
    const ivaTaxaInput = document.getElementById("config-iva-taxa");
    const rodapeInput = document.getElementById("config-rodape");

    const emp = FABEF.empresa || {};
    if (nomeInput) nomeInput.value = emp.nome || "";
    if (nuitInput) nuitInput.value = emp.nuit || "";
    if (telInput) telInput.value = emp.telefone || "";
    if (endInput) endInput.value = emp.endereco || "";
    if (cidInput) cidInput.value = emp.cidade || "";
    if (ivaRegimeInput) ivaRegimeInput.value = emp.ivaRegime || "isento";
    if (ivaTaxaInput) ivaTaxaInput.value = emp.ivaTaxa !== undefined ? emp.ivaTaxa : 16;
    if (rodapeInput) rodapeInput.value = emp.rodapeRecibo || "Obrigado pela sua preferência! Volte sempre.";
}


document.getElementById("btn-guardar-config").addEventListener("click", guardarConfiguracoes);
document.getElementById("btn-alterar-pin")?.addEventListener("click", () => {
    if (FABEF.user?.uid) configurarNovoPin(FABEF.user.uid);
});


async function guardarConfiguracoes() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") {
        alert("Apenas o Gerente pode aceder e alterar as configurações.");
        return;
    }
    const nome = document.getElementById("config-nome")?.value.trim() || "";
    const nuit = document.getElementById("config-nuit")?.value.trim() || "";
    const telefone = document.getElementById("config-telefone")?.value.trim() || "";
    const endereco = document.getElementById("config-endereco")?.value.trim() || "";
    const cidade = document.getElementById("config-cidade")?.value.trim() || "";
    const ivaRegime = document.getElementById("config-iva-regime")?.value || "isento";
    const ivaTaxa = numero(document.getElementById("config-iva-taxa")?.value);
    const rodapeRecibo = document.getElementById("config-rodape")?.value.trim() || "";

    if (!nome) {
        alert("O nome do negócio é um campo de preenchimento obrigatório.");
        return;
    }

    if (!FABEF.empresa) FABEF.empresa = {};
    FABEF.empresa.nome = nome;
    FABEF.empresa.nuit = nuit;
    FABEF.empresa.telefone = telefone;
    FABEF.empresa.endereco = endereco;
    FABEF.empresa.cidade = cidade;
    FABEF.empresa.ivaRegime = ivaRegime;
    FABEF.empresa.ivaTaxa = ivaTaxa;
    FABEF.empresa.rodapeRecibo = rodapeRecibo;

    if (window.FABEF?.isDemoMode) {
        alert("Configurações da empresa e modelo de recibo atualizados com sucesso!");
        renderTudo();
        return;
    }

    try {
        await updateDoc(empresaRef(), {
            nome: nome,
            nuit: nuit,
            telefone: telefone,
            endereco: endereco,
            cidade: cidade,
            ivaRegime: ivaRegime,
            ivaTaxa: ivaTaxa,
            rodapeRecibo: rodapeRecibo,
            atualizadoEm: serverTimestamp()
        });

        renderTudo();

        await gravarAuditoria("Actualizou as configurações estruturais da empresa e dados do recibo profissional.", "INFO");
        alert("Dados do negócio e parâmetros de recibo guardados com sucesso na nuvem.");
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar configurações do negócio:\n" + mensagemFirebase(error));
    }
}


/* =====================================================
   MÃ“DULO LÃ“GICO: RENDERS E INDICADORES DO DASHBOARD (INÃCIO)
===================================================== */

/* =====================================================
   GESTÃƒO DE FUNCIONÃRIOS / UTILIZADORES
===================================================== */

async function cadastrarNovoFuncionario() {
    if ((FABEF.userData?.perfil || FABEF.userData?.role) !== "gerente") { alert("Apenas o gerente pode cadastrar funcionÃ¡rios."); return; }

    // Limite depende do plano: GrÃ¡tis = 1 funcionÃ¡rio; Pago/Teste = 2 funcionÃ¡rios
    // (3 utilizadores no total, incluindo o gerente). A partir do 3Âº
    // funcionÃ¡rio, Ã© preciso pagar uma taxa extra de 20% por cada um.
    const plano = obterPlanoAtual();
    const limiteBase = plano === "GRATIS" ? LIMITES_PLANO_GRATIS.funcionarios : 2;
    const funcionariosAtivos = (FABEF.funcionarios || []).filter(f => (f.estado || "ATIVO") === "ATIVO").length;

    if (plano === "GRATIS" && funcionariosAtivos >= limiteBase) {
        avisoLimiteAtingido(`O Plano GrÃ¡tis inclui apenas ${limiteBase} funcionÃ¡rio.`);
        return;
    }

    if (funcionariosAtivos >= limiteBase) {
        alert(
            `O seu plano atual inclui atÃ© ${limiteBase} funcionÃ¡rios (${limiteBase + 1} utilizadores no total, incluindo o gerente).\n\n` +
            "Para adicionar mais um funcionÃ¡rio, Ã© necessÃ¡ria uma taxa adicional de 20% do valor da subscriÃ§Ã£o por cada funcionÃ¡rio extra.\n\n" +
            "Contacte o suporte para ativar esta funcionÃ¡rio extra na sua subscriÃ§Ã£o antes de continuar."
        );
        return;
    }

    const nome=document.getElementById("func-nome")?.value.trim();
    const email=document.getElementById("func-email")?.value.trim();
    const telefone=document.getElementById("func-telefone")?.value.trim();
    const senha=document.getElementById("func-senha")?.value || "";
    const foto=document.getElementById("func-foto")?.value.trim() || "";
    if(!nome || !email || !senha){ alert("Por favor, preencha os campos obrigatÃ³rios (Nome, E-mail e Senha)."); return; }
    if(senha.length<6){ alert("A senha do funcionÃ¡rio deve conter pelo menos 6 caracteres."); return; }
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
        await gravarAuditoria(`Cadastrou um novo funcionÃ¡rio na equipa: ${nome} (${email})`,"INFO");
        alert("FuncionÃ¡rio cadastrado com sucesso.");
    } catch(error) { console.error(error); alert("NÃ£o foi possÃ­vel criar a conta do funcionÃ¡rio:\n"+mensagemFirebase(error)); }
    finally { if(secondaryApp){ try{await deleteApp(secondaryApp);}catch(e){} } }
}

function renderFuncionarios(){
    const tabela = document.getElementById("tabela-funcionarios");
    if (!tabela) return;

    const gerente = `
        <tr style="background:#f8fafc;">
            <td><strong>${escapeHTML(FABEF.userData?.nome || "Gerente Principal")}</strong></td>
            <td>${escapeHTML(FABEF.user?.email || "â€”")}</td>
            <td>${escapeHTML(FABEF.empresa?.telefone || "â€”")}</td>
            <td><span class="badge badge-green" style="background-color:#0f172a;color:#fff;">GERENTE</span></td>
            <td><span class="badge badge-green">ATIVO</span></td>
            <td>â€”</td>
        </tr>`;

    const souGerente = (FABEF.userData?.perfil || FABEF.userData?.role) === "gerente";

    const funcionarios = (FABEF.funcionarios || []).map(f => {
        const ativo = (f.estado || "ATIVO") === "ATIVO";
        const acoes = souGerente ? `
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="btn btn-light btn-small" type="button" onclick="abrirEdicaoFuncionario('${escapeHTML(f.id)}')">âœï¸ Editar</button>
                <button class="btn ${ativo ? 'btn-danger' : 'btn-success'} btn-small" type="button" onclick="alternarEstadoFuncionario('${escapeHTML(f.id)}')">${ativo ? 'ðŸš« Desativar' : 'âœ… Reativar'}</button>
            </div>` : "â€”";

        return `
        <tr>
            <td>${f.foto ? `<img src="${escapeHTML(f.foto)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none';">` : ""}<strong>${escapeHTML(f.nome || "â€”")}</strong></td>
            <td>${escapeHTML(f.email || "â€”")}</td>
            <td>${escapeHTML(f.telefone || "â€”")}</td>
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
    if (!id || !nome) { alert("O nome do funcionÃ¡rio Ã© obrigatÃ³rio."); return; }

    try {
        const dadosAtualizados = { nome, telefone, atualizadoEm: serverTimestamp() };
        await updateDoc(doc(db, "utilizadores", id), dadosAtualizados);
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "funcionarios", id), dadosAtualizados);

        const f = FABEF.funcionarios.find(x => x.id === id);
        if (f) { f.nome = nome; f.telefone = telefone; }

        fecharModal("modal-editar-funcionario");
        renderFuncionarios();
        await gravarAuditoria("Editou os dados do funcionÃ¡rio: " + nome, "INFO");
        alert("Dados do funcionÃ¡rio atualizados com sucesso.");
    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar funcionÃ¡rio:\n" + mensagemFirebase(error));
    }
});

window.alternarEstadoFuncionario = async function(id) {
    const f = FABEF.funcionarios.find(x => x.id === id);
    if (!f) return;
    const novoEstado = (f.estado || "ATIVO") === "ATIVO" ? "INATIVO" : "ATIVO";
    const acao = novoEstado === "INATIVO" ? "desativar" : "reativar";

    if (!confirm(`Tem a certeza que deseja ${acao} o acesso de "${f.nome}"?` + (novoEstado === "INATIVO" ? "\n\nO funcionÃ¡rio deixarÃ¡ de conseguir entrar no sistema imediatamente." : ""))) return;

    try {
        await updateDoc(doc(db, "utilizadores", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "funcionarios", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        f.estado = novoEstado;
        renderFuncionarios();
        await gravarAuditoria(`${novoEstado === "INATIVO" ? "Desativou" : "Reativou"} o acesso do funcionÃ¡rio: ${f.nome}`, "ALERTA");
        alert(`FuncionÃ¡rio ${novoEstado === "INATIVO" ? "desativado" : "reativado"} com sucesso.`);
    } catch (error) {
        console.error(error);
        alert("Erro ao alterar o estado do funcionÃ¡rio:\n" + mensagemFirebase(error));
    }
};

/* CONTROLO DE SUBSCRIÃ‡ÃƒO */

/* =====================================================
   MÃ“DULO LÃ“GICO: PLANO GRÃTIS COM LIMITES (FREEMIUM)
   Dias 1-7: acesso total (teste). A partir do dia 8, sem
   pagamento, passa a Plano GrÃ¡tis com limites â€” em vez de
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
    alert((mensagem || "Atingiu o limite diÃ¡rio do plano grÃ¡tis.") + "\n\nAtualize para o plano premium por apenas 250 MT para continuar!");
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
            <strong>ðŸ†“ Plano GrÃ¡tis</strong> â€” Vendas hoje: ${vendasHoje}/${LIMITES_PLANO_GRATIS.vendasDiarias} Â·
            Encomendas hoje: ${encomendasHoje}/${LIMITES_PLANO_GRATIS.encomendasDiarias} Â·
            FuncionÃ¡rios: ${LIMITES_PLANO_GRATIS.funcionarios} mÃ¡x.
            <button class="btn btn-success btn-small" type="button" onclick="mostrarSecao('subscricao')" style="margin-left:8px;">â­ Passar a Premium (250 MT)</button>
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
            aviso.textContent = `âœ… LicenÃ§a Comercial Activa atÃ©: ${new Date(validade).toLocaleDateString("pt-MZ")}`;
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-success";
            estadoSpan.textContent = "SubscriÃ§Ã£o Regularizada. Obrigado por escolher o FABEF ERP!";
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
            aviso.textContent = `ðŸ’¡ PerÃ­odo de teste gratuito: Restam aproximadamente ${dias} dia(s).`;
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-warning";
            estadoSpan.textContent = "PerÃ­odo de teste gratuito activo.";
        }
        if (bloqueio) {
            bloqueio.classList.remove("show");
            bloqueio.style.display = "none";
        }
    } else {
        if (aviso) {
            aviso.className = "alert alert-warning";
            aviso.textContent = "ðŸ†“ EstÃ¡ no Plano GrÃ¡tis (limites diÃ¡rios de vendas/encomendas e 1 funcionÃ¡rio). Pague 250 MT para desbloquear tudo.";
        }
        if (estadoSpan) {
            estadoSpan.className = "alert alert-warning";
            estadoSpan.textContent = "Plano GrÃ¡tis â€” com limites diÃ¡rios.";
        }
        if (bloqueio) {
            bloqueio.classList.remove("show");
            bloqueio.style.display = "none";
        }
    }

    FABEF_LICENCA_BLOQUEADA = false; // o plano grÃ¡tis nunca bloqueia tudo, sÃ³ limita
    renderAvisoPlano();
}

let FABEF_LICENCA_BLOQUEADA = false;

// Cole aqui o link completo do Workflow 1 do Pipedream (o "URL exclusivo para
// acionar este fluxo de trabalho" que apareceu ao criar o gatilho).
const FABEF_PIPEDREAM_COBRANCA_URL = "https://eoworwel5cr2z9j.m.pipedream.net";

async function solicitarPagamentoBackend(operadora, telefone) {
    if (!FABEF_PIPEDREAM_COBRANCA_URL || FABEF_PIPEDREAM_COBRANCA_URL.includes("SEU-LINK-AQUI")) {
        throw new Error("O endereÃ§o do servidor de pagamentos ainda nÃ£o foi configurado.");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("SessÃ£o Firebase invÃ¡lida.");

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

    if (!telefone) { alert("Por favor, introduza o nÃºmero de telefone."); return; }
    if (!/^\d{9}$/.test(telefone)) { alert("O nÃºmero de telefone deve conter exatamente 9 dÃ­gitos."); return; }
    if (operadora === "MPESA" && !/^8[45]/.test(telefone)) { alert("NÃºmero invÃ¡lido para M-Pesa. Deve comeÃ§ar com 84 ou 85."); return; }
    if (operadora === "EMOLA" && !/^8[67]/.test(telefone)) { alert("NÃºmero invÃ¡lido para e-Mola. Deve comeÃ§ar com 86 ou 87."); return; }

    try {
        if (botao) botao.disabled = true;
        const backendResult = await solicitarPagamentoBackend(operadora, telefone);

        // O prÃ³prio servidor (Pipedream) jÃ¡ regista o pedido em "pagamentos" â€”
        // aqui sÃ³ mostramos o estado, sem duplicar o registo.
        if (resultado) {
            resultado.className = "alert alert-warning";
            resultado.innerHTML = `â³ Pedido enviado. Confirme o PIN no seu telemÃ³vel.<br>ReferÃªncia: <strong>${escapeHTML(backendResult?.referencia || backendResult?.sourceId || "â€”")}</strong><br><small>A licenÃ§a Ã© activada automaticamente assim que o pagamento for confirmado.</small>`;
        }
        await gravarAuditoria("Solicitou subscriÃ§Ã£o mensal via " + operadora, "INFO");
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
            <div class="card card-ramo-pasta" style="border: 2px solid ${ehAtivo ? '#10b981' : '#cbd5e1'}; background:${ehAtivo ? '#f0fdf4' : '#ffffff'}; padding:16px; border-radius:12px; position:relative; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:32px;">📁</span>
                        <div>
                            <h4 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHTML(r.nome)}</h4>
                            <small style="color:#64748b;font-weight:500;">${escapeHTML(r.tipo || r.nome)}</small>
                        </div>
                    </div>
                    <div>
                        ${ehAtivo 
                            ? `<span class="badge badge-green" style="font-size:11px;padding:3px 8px;">✅ Ativo</span>` 
                            : `<span class="badge badge-yellow" style="font-size:11px;padding:3px 7px;">Alternativo</span>`
                        }
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.03);padding:10px;border-radius:8px;margin-bottom:12px;font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div>
                        <span style="color:#64748b;display:block;font-size:11px;">📦 Artigos:</span>
                        <strong>${totalProds} no stock</strong>
                    </div>
                    <div>
                        <span style="color:#64748b;display:block;font-size:11px;">💰 Vendas Hoje:</span>
                        <strong>${dinheiro(totalHojeRamo)}</strong>
                    </div>
                    <div style="grid-column:1/-1;border-top:1px dashed #cbd5e1;padding-top:6px;font-size:12px;">
                        ${temSenha 
                            ? `<span style="color:#b45309;font-weight:600;">🔒 Protegido com Senha</span>` 
                            : `<span style="color:#10b981;font-weight:600;">🔓 Acesso Livre</span>`
                        }
                    </div>
                </div>

                <div style="display:flex;gap:8px;">
                    ${ehAtivo ? `
                        <button class="btn btn-success btn-small" type="button" style="width:100%;font-weight:700;" disabled>
                            ✔ Ramo Selecionado Agora
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-small" type="button" style="width:100%;font-weight:700;" onclick="alternarRamoPasta('${escapeHTML(r.nome)}')">
                            📂 Alternar para este Ramo
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join("");
}
window.renderPastaRamos = renderPastaRamos;

window.alternarRamoPasta = async function(nomeRamo) {
    const ramos = obterConfigRamos();
    const ramoAlvo = ramos.find(r => r.nome === nomeRamo);
    if (!ramoAlvo) {
        alert("Ramo não encontrado na pasta.");
        return;
    }

    if (ramoAlvo.senha && ramoAlvo.senha.trim()) {
        const pinDigitado = prompt(`🔒 Segurança de Ramo:\n\nO ramo "${nomeRamo}" está protegido por senha.\nPor favor, introduza a senha de acesso definida pelo Gerente:`);
        if (pinDigitado === null) return;
        if (pinDigitado.trim() !== ramoAlvo.senha.trim()) {
            alert("❌ Senha incorreta! Acesso não autorizado para o ramo " + nomeRamo);
            return;
        }
    }

    await mudarRamo(nomeRamo);
    renderPastaRamos();
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
   MÓDULO LÓGICO: CALCULADORA & SUBSCRIÇÃO (250 MT - 30 DIAS)
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
// A licença NÃO é activada no navegador: somente o backend/webhook, após confirmação real do pagamento, deve actualizar o Firestore.


/* =====================================================
   MÓDULO LÓGICO: MODAIS DE JUSTIFICATIVA AO GERENTE
   (VENDA FALHADA & ENCOMENDA FALHADA)
===================================================== */
window.abrirModalVendaFalhada = function(vendaId) {
    const v = (FABEF.vendas || []).find(x => x.id === vendaId);
    if (!v) { alert("Venda não localizada."); return; }

    const elId = document.getElementById("falha-venda-id");
    const elRef = document.getElementById("falha-venda-ref");
    const elTotal = document.getElementById("falha-venda-total");
    const elItens = document.getElementById("falha-venda-itens");
    const elJust = document.getElementById("falha-venda-justificativa");

    if (elId) elId.value = v.id;
    if (elRef) elRef.textContent = "#" + v.id.slice(0, 8);
    if (elTotal) elTotal.textContent = dinheiro(v.total);

    const itensStr = (v.itens || v.items || []).map(it => `${escapeHTML(it.nome || "Item")} (${it.quantidade} ${it.unidade || 'un'})`).join(", ");
    if (elItens) elItens.textContent = itensStr || "—";
    if (elJust) elJust.value = "";

    document.getElementById("modal-venda-falhada")?.classList.add("show");
};

document.getElementById("btn-confirmar-venda-falhada")?.addEventListener("click", async () => {
    const vendaId = document.getElementById("falha-venda-id")?.value;
    const motivoTipo = document.getElementById("falha-venda-motivo-tipo")?.value || "Venda Cancelada";
    const justificativa = (document.getElementById("falha-venda-justificativa")?.value || "").trim();
    const reporStock = Boolean(document.getElementById("falha-venda-repor-stock")?.checked);

    if (!justificativa) {
        alert("⚠️ Campo Obrigatório:\nPor favor, escreva a justificativa para o Gerente explicando o motivo pelo qual esta venda falhou ou necessita de ser anulada.");
        document.getElementById("falha-venda-justificativa")?.focus();
        return;
    }

    const v = (FABEF.vendas || []).find(x => x.id === vendaId);
    if (!v) { alert("Venda não encontrada."); return; }

    try {
        const usuarioNome = FABEF.userData?.nome || auth.currentUser?.email || "Funcionário";
        const payloadAtualizacao = {
            status: "FALHADA_CANCELADA",
            motivoFalha: motivoTipo,
            justificativaGerente: justificativa,
            falhadaPor: usuarioNome,
            falhadaEm: new Date().toISOString()
        };

        if (reporStock && (v.itens || v.items)) {
            for (const item of (v.itens || v.items)) {
                const prod = (FABEF.produtos || []).find(p => p.id === item.id);
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

        await gravarAuditoria(`⚠️ VENDA FALHADA (#${v.id.slice(0, 8)} - ${dinheiro(v.total)}) registada por ${usuarioNome}. Motivo ao Gerente: "${justificativa}"`, "ALERTA");

        fecharModal("modal-venda-falhada");
        renderVendas();
        renderProdutos();
        renderDashboard();

        alert("A venda foi registada como Falhada/Cancelada com sucesso.\nA justificativa foi arquivada para o Gerente nos registos de auditoria e o stock foi restabelecido.");
    } catch (error) {
        console.error("Erro ao registar venda falhada:", error);
        alert("Erro ao processar a anulação da venda:\n" + mensagemFirebase(error));
    }
});

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
    document.getElementById("btn-toggle-dark").textContent=escuro?"â˜€ï¸ Modo Claro":"ðŸŒ™ Modo Escuro";
    try{localStorage.setItem("FABEF_dark_mode",escuro?"1":"0");}catch(e){}
});
try{if(localStorage.getItem("FABEF_dark_mode")==="1"){document.body.classList.add("dark-mode");const b=document.getElementById("btn-toggle-dark");if(b)b.textContent="â˜€ï¸ Modo Claro";}}catch(e){}

/* =====================================================
   MÃ“DULO LÃ“GICO: RECONCILIAÃ‡ÃƒO DE STOCK (CONFLITOS OFFLINE)
   Se dois dispositivos venderem offline o mesmo produto ao
   mesmo tempo, cada um sÃ³ via o stock que tinha guardado
   localmente â€” quando ambos sincronizam, o stock real pode
   ficar negativo. Isto avisa o gerente para poder confirmar
   a quantidade fÃ­sica real e corrigir.
===================================================== */
const FABEF_STOCK_NEGATIVO_ALERTADO = new Set();

function verificarReconciliacaoStock() {
    const negativos = FABEF.produtos.filter(p => numero(p.stock) < 0);

    negativos.forEach(p => {
        if (!FABEF_STOCK_NEGATIVO_ALERTADO.has(p.id)) {
            FABEF_STOCK_NEGATIVO_ALERTADO.add(p.id);
            // SÃ³ grava o alerta de auditoria uma vez por produto/ocorrÃªncia,
            // para nÃ£o encher o histÃ³rico com o mesmo aviso repetido.
            gravarAuditoria(
                `âš ï¸ ReconciliaÃ§Ã£o necessÃ¡ria: o produto "${p.nome}" ficou com stock negativo (${numero(p.stock)}${p.unidade && p.unidade !== "unidade" ? " " + p.unidade : ""}). Isto normalmente acontece quando dois dispositivos venderam offline o mesmo produto ao mesmo tempo, antes de sincronizar.`,
                "ALERTA"
            );
        }
    });

    // Esquece os que jÃ¡ foram corrigidos (stock voltou a 0 ou mais), para
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
            <strong>âš ï¸ ReconciliaÃ§Ã£o de stock necessÃ¡ria (${negativos.length})</strong>
            <p style="margin:6px 0;font-size:13px;">
                Estes produtos ficaram com stock negativo â€” normalmente porque dois dispositivos
                venderam offline o mesmo produto ao mesmo tempo, antes de sincronizar. Confirme a
                quantidade real na loja e corrija em InventÃ¡rio â†’ "âš™ï¸ Ajustar".
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

    if (indicadorEmpresa) indicadorEmpresa.textContent = FABEF.empresa?.nome || "â€”";
    if (painelNomeNegocio) painelNomeNegocio.textContent = FABEF.empresa?.nome || "â€”";
    if (painelIdEmpresa) painelIdEmpresa.textContent = FABEF.empresaId || "â€”";
    if (painelUtilizador) painelUtilizador.textContent = FABEF.user?.email || "â€”";
    if (painelRamo) painelRamo.textContent = FABEF.ramo;

    const hoje = dataHoje();

    // Filtra transaÃ§Ãµes realizadas no dia atual para o somatÃ³rio rÃ¡pido do balcÃ£o
    const vendasHoje = FABEF.vendas.filter(v => {
        const dataVenda = new Date(v.data || v.date || 0);
        return dataVenda >= hoje;
    });

    const totalHoje = vendasHoje.reduce((s, v) => s + numero(v.total), 0);
    
    const painelVendas = document.getElementById("inicio-vendas");
    if (painelVendas) painelVendas.textContent = dinheiro(totalHoje);

    // Soma quantos KGs (e litros) foram vendidos hoje, alÃ©m do valor em MT
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
   MÃ“DULO CENTRAL: INTERCONEXÃƒO E REFRESH EM MASSA (RENDER TUDO)
===================================================== */

/* =====================================================
   MÃ“DULO LÃ“GICO: HISTÃ“RICO DE AUDITORIA (VISUALIZAÃ‡ÃƒO)
===================================================== */
/* =====================================================
   MÃ“DULO LÃ“GICO: METAS (LOJA E POR FUNCIONÃRIO)
===================================================== */
function inicioDaSemana(data) {
    const d = new Date(data);
    const diaSemana = d.getDay(); // 0=domingo
    const diff = (diaSemana === 0 ? -6 : 1) - diaSemana; // segunda-feira como inÃ­cio
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
            <div class="kpi"><div class="rotulo">Meta diÃ¡ria</div>${barraHtml(somaTotais(vendasHoje), metaDiaria)}</div>
            <div class="kpi"><div class="rotulo">Meta semanal</div>${barraHtml(somaTotais(vendasSemana), metaSemanal)}</div>
            <div class="kpi"><div class="rotulo">Meta mensal</div>${barraHtml(somaTotais(vendasMes), metaMensal)}</div>
        `;
    }

    // FormulÃ¡rio de metas gerais (sÃ³ o gerente edita)
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

    // Metas por funcionÃ¡rio
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
        }).join("") || `<tr><td colspan="3" style="text-align:center;color:#64748b;">Sem funcionÃ¡rios cadastrados.</td></tr>`;
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
        alert("Erro ao guardar meta do funcionÃ¡rio:\n" + mensagemFirebase(error));
    }
};


/* =====================================================
   MÃ“DULO LÃ“GICO: DESEMPENHO DOS FUNCIONÃRIOS
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
   MÃ“DULO LÃ“GICO: SUGESTÃ•ES DO FUNCIONÃRIO
===================================================== */
document.getElementById("btn-enviar-sugestao")?.addEventListener("click", async () => {
    const texto = document.getElementById("sugestao-texto")?.value.trim();
    if (!texto) { alert("Escreva a sua sugestÃ£o antes de enviar."); return; }

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
        alert("SugestÃ£o enviada ao gerente. Obrigado!");
    } catch (error) {
        console.error(error);
        alert("Erro ao enviar sugestÃ£o:\n" + mensagemFirebase(error));
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
            <td>${escapeHTML(s.criadoPorNome || "â€”")}</td>
            <td>${escapeHTML(s.texto)}</td>
            <td><span class="badge ${s.estado === 'ADICIONADA' ? 'badge-green' : (s.estado === 'REJEITADA' ? 'badge-red' : 'badge-yellow')}">${escapeHTML(s.estado || "NOVA")}</span></td>
            <td>${souGerente && s.estado === "NOVA" ? `
                <button class="btn btn-success btn-small" type="button" onclick="marcarSugestao('${escapeHTML(s.id)}','ADICIONADA')">âœ”ï¸ Adicionar ao catÃ¡logo</button>
                <button class="btn btn-light btn-small" type="button" onclick="marcarSugestao('${escapeHTML(s.id)}','REJEITADA')">âœ–ï¸ Rejeitar</button>
            ` : "â€”"}</td>
        </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#64748b;">Ainda nÃ£o hÃ¡ sugestÃµes enviadas.</td></tr>`;
}

window.marcarSugestao = async function(id, novoEstado) {
    try {
        await updateDoc(doc(db, "empresas", FABEF.empresaId, "sugestoes", id), { estado: novoEstado, atualizadoEm: serverTimestamp() });
        const s = FABEF.sugestoes.find(x => x.id === id);
        if (s) s.estado = novoEstado;
        renderSugestoes();
        await gravarAuditoria(`Marcou uma sugestÃ£o de funcionÃ¡rio como: ${novoEstado}`, "INFO");
        if (novoEstado === "ADICIONADA") {
            alert('SugestÃ£o marcada como adicionada. VÃ¡ Ã  pÃ¡gina "Produtos" para criar o novo artigo/serviÃ§o, se ainda nÃ£o o fez.');
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar sugestÃ£o:\n" + mensagemFirebase(error));
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
        .slice(0, 300); // Limita a exibiÃ§Ã£o Ã s 300 entradas mais recentes por performance

    corpo.innerHTML = registos.map(a => {
        const cor = a.nivel === "ALERTA" ? "#ef4444" : (a.nivel === "AVISO" ? "#f59e0b" : "#2563eb");
        return `<tr>
            <td style="white-space:nowrap;">${dataTexto(a.data)}</td>
            <td>${escapeHTML(a.utilizadorNome || "â€”")}</td>
            <td>${escapeHTML(a.mensagem || "â€”")}</td>
            <td><span class="badge" style="background:${cor}22;color:${cor};">${escapeHTML(a.nivel || "INFO")}</span></td>
        </tr>`;
    }).join("") || `<tr><td colspan="4" style="text-align:center;color:#64748b;">Sem registos de auditoria ainda.</td></tr>`;
}
document.getElementById("auditoria-pesquisa")?.addEventListener("input", renderAuditoria);


function renderTudo() {
    // Executa em cadeia sequencial a renderizaÃ§Ã£o e o desenho de cada bloco da SPA
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

    // ProteÃ§Ãµes de seguranÃ§a contra erros de inicializaÃ§Ã£o de funÃ§Ãµes secundÃ¡rias
    if (typeof renderFuncionarios === "function") renderFuncionarios();
    if (typeof renderAuditoria === "function") renderAuditoria();
    if (typeof renderMetas === "function") renderMetas();
    if (typeof renderDesempenho === "function") renderDesempenho();
    if (typeof renderSugestoes === "function") renderSugestoes();
    if (typeof renderConfiguracoes === "function") renderConfiguracoes();
    if (typeof verificarSubscricao === "function") verificarSubscricao();
}


/* =====================================================
   MÃ“DULO TRADUTOR: CENTRAL DE TRATAMENTO DE ERROS DO FIREBASE
===================================================== */

function mensagemFirebase(error) {
    if (!error) return "Erro interno desconhecido.";

    const code = error.code || "";

    const mensagens = {
        "auth/invalid-credential": "E-mail ou palavra-passe introduzidos estÃ£o incorretos.",
        "auth/email-already-in-use": "Aviso de SeguranÃ§a: Este endereÃ§o de e-mail jÃ¡ se encontra registado.",
        "auth/invalid-email": "O formato de e-mail introduzido nÃ£o Ã© considerado vÃ¡lido.",
        "auth/weak-password": "A senha introduzida Ã© demasiado fraca. Use pelo menos 6 caracteres.",
        "permission-denied": "Acesso Recusado: PermissÃµes insuficientes para ler ou escrever no Firebase.",
        "failed-precondition": "A base de dados do Firebase exige a criaÃ§Ã£o de Ã­ndices de consulta.",
        "unavailable": "O servidor do Firebase encontra-se temporariamente indisponÃ­vel. Verifique a internet."
    };

    return mensagens[code] || error.message || code || "Falha operacional nÃ£o catalogada.";
}


/* =====================================================
   INICIALIZAÃ‡ÃƒO SISTÃ‰MICA E CONFIGURAÃ‡Ã•ES VISUAIS
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
 OBSERVAÃ‡ÃƒO CRÃTICA DE PROCESSO:
 A interface da aplicaÃ§Ã£o permanece totalmente oculta (.hidden) atÃ© que o 
 gatilho onAuthStateChanged confirme o token do utilizador junto Ã  nuvem.
*/

/* =====================================================
   MODO DEMONSTRAÇÃO (TESTE RÁPIDO 1-CLIQUE)
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
        { id: "func-1", nome: "Faruque Abílio", email: "gerente@fabef.mz", role: "gerente", perfil: "gerente", telefone: "84 000 0001", estado: "ATIVO" },
        { id: "func-2", nome: "Maria Santos", email: "caixa1@fabef.mz", role: "funcionario", perfil: "funcionario", telefone: "84 000 0002", estado: "ATIVO" }
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

/* =====================================================
   EXPORTAÇÃO COMPLETA DO PROJETO EM FICHEIRO ZIP
===================================================== */
window.baixarProjetoZip = async function() {
    const btn = document.getElementById("btn-baixar-projeto-zip");
    const textoOriginal = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ A compilar ficheiros do projeto...";
    }

    try {
        const zip = new JSZip();
        
        // Obter index.html atual
        const resHtml = await fetch("/index.html");
        const htmlContent = await resHtml.text();
        zip.file("index.html", htmlContent);

        // Obter src/app.js atual
        const resApp = await fetch("/src/app.js");
        const appContent = await resApp.text();
        zip.folder("src").file("app.js", appContent);

        // Obter package.json
        try {
            const resPkg = await fetch("/package.json");
            if (resPkg.ok) {
                zip.file("package.json", await resPkg.text());
            }
        } catch (_) {}

        // README explicativo com instruções de instalação e substituição
        zip.file("LEIA-ME-INSTALACAO.txt", 
`=============================================================
  FABEF GESTÃO ERP PRO - PACOTE COMPLETO DE CÓDIGO FONTE
=============================================================

Este arquivo ZIP contém a versão atualizada do FABEF Gestão ERP PRO com todas as melhorias solicitadas:
1. Controle rigoroso de perfis (Funcionário restrito a Vendas/Caixa sem acesso a outros ramos).
2. Bloqueio automático de segurança com PIN ao minimizar a tela ou sair do foco do navegador.
3. Logout forçado com e-mail e senha ao encerrar a sessão.
4. Navegação ágil: o menu de 3 pontos fecha instantaneamente e abre apenas a aba selecionada.
5. Venda fracionada de carne (kg, gramas e litros) com conversão automática de preço por peso.
6. Recibo profissional personalizável pelo Gerente (NUIT, Endereço, Cidade, Regime de IVA e Rodapé).
7. Impressão térmica de 80mm e envio direto via WhatsApp.

COMO SUBSTITUIR NO SEU PROJETO OU GITHUB:
------------------------------------------
1. Extraia este arquivo ZIP no seu computador.
2. Copie o arquivo 'index.html' para a raiz do seu repositório/hospedagem.
3. Copie o arquivo 'src/app.js' para a pasta 'src/' substituindo o anterior.
4. Faça commit e push no GitHub Pages ou hospede no seu servidor web.

Desenvolvido com excelência para empresas de Moçambique!
`);

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `FABEF_ERP_PRO_Completo_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast("📦 Ficheiro ZIP gerado e descarregado com sucesso!");
    } catch (err) {
        console.error("Erro ao gerar ZIP:", err);
        alert("Não foi possível gerar o ZIP automaticamente:\n" + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
};

// Binds
document.getElementById("btn-demo-mode")?.addEventListener("click", entrarModoDemo);
document.getElementById("btn-abrir-sugestoes")?.addEventListener("click", () => {
    document.getElementById("modal-sugestoes")?.classList.add("show");
});
document.getElementById("btn-recibo-imprimir-direto")?.addEventListener("click", () => {
    if (window.FABEF_ultimaVendaId) window.imprimirReciboVenda(window.FABEF_ultimaVendaId);
});
document.getElementById("btn-recibo-whatsapp-direto")?.addEventListener("click", () => {
    if (window.FABEF_ultimaVendaId) window.enviarReciboWhatsApp(window.FABEF_ultimaVendaId);
});
document.getElementById("btn-recibo-fechar")?.addEventListener("click", () => {
    fecharModal("modal-recibo-sucesso");
});
