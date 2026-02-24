import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fetch from "node-fetch";

const app = initializeApp({
    apiKey: "AIzaSyA3VhT2iHrD1uzOFI9Bc_BYyMoCpOG-G8w",
    authDomain: "gestao-frota-tim.firebaseapp.com",
    projectId: "gestao-frota-tim",
    storageBucket: "gestao-frota-tim.firebasestorage.app",
    messagingSenderId: "455143595757",
    appId: "1:455143595757:web:036dc514ad7f983ca336e4",
});

const db = getFirestore(app);
const delay = ms => new Promise(res => setTimeout(res, ms));

const PROJECT_ID = "gestao-frota-tim";
const API_KEY = "AIzaSyA3VhT2iHrD1uzOFI9Bc_BYyMoCpOG-G8w";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tb_despachos_conferencia`;

// Helper: Convert generic JS Object to Firestore REST API 'fields' Format
function formatToFirestoreFields(obj) {
    const fields = {};
    for (const key in obj) {
        const val = obj[key];
        if (val === null || val === undefined) { fields[key] = { nullValue: null }; }
        else if (typeof val === 'string') { fields[key] = { stringValue: val }; }
        else if (typeof val === 'number') { fields[key] = { doubleValue: val }; }
        else if (typeof val === 'boolean') { fields[key] = { booleanValue: val }; }
        else if (val instanceof Date || (val.toDate && typeof val.toDate === 'function')) {
            fields[key] = { timestampValue: val.toDate ? val.toDate().toISOString() : val.toISOString() };
        }
        else if (Array.isArray(val)) {
            fields[key] = { arrayValue: { values: val.map(v => formatToFirestoreFields({ temp: v }).temp) } };
        }
        else if (typeof val === 'object') {
            fields[key] = { mapValue: { fields: formatToFirestoreFields(val) } };
        }
    }
    return fields;
}

async function run() {
    console.log("========================================");
    console.log(" INICIANDO MIGRAÇÃO HÍBRIDA (Leitura SDK + Escrita REST)");
    console.log("========================================");

    console.log("Buscando documentos via Firebase SDK...");
    const despachosRef = collection(db, "tb_despachos_conferencia");
    const snap = await getDocs(despachosRef);

    let toMigrate = [];

    snap.forEach(d => {
        const id = d.id;
        const data = d.data();

        if (id.length === 20 && data.nota_despacho && String(data.nota_despacho).startsWith("NN")) {
            if (!id.startsWith("NN")) {
                toMigrate.push({ oldId: id, newId: data.nota_despacho, data: formatToFirestoreFields(data) });
            }
        }
    });

    console.log(`Encontrados ${toMigrate.length} documentos importados via Excel com IDs aleatórios.`);

    if (toMigrate.length === 0) {
        console.log("Nenhuma migração necessária.");
        process.exit(0);
    }

    console.log("Migrando sequencialmente via REST...");

    let migrados = 0;

    for (const item of toMigrate) {
        const newUrl = `${BASE_URL}/${item.newId}?key=${API_KEY}`;
        const oldUrl = `${BASE_URL}/${item.oldId}?key=${API_KEY}`;

        // Crio o novo documento apontando exatamente para os mesmos campos JSON que o Firestore precisa
        const resCreate = await fetch(newUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: item.data })
        });

        if (resCreate.ok) {
            // Deleto o antigo usando REST 
            await fetch(oldUrl, { method: 'DELETE' });
            migrados++;
        } else {
            const err = await resCreate.text();
            console.error(`Falha ao criar ${item.newId}:`, err);
        }

        if (migrados % 50 === 0) {
            console.log(`Progresso: ${migrados} / ${toMigrate.length} notas processadas...`);
        }

        // 50ms atraso para não engasgar conexões
        await delay(50);
    }

    console.log("========================================");
    console.log(`✅ SUCESSO! ${migrados} notas migradas com segurança.`);
    console.log("=========================================");
    process.exit(0);
}

run().catch(console.error);
