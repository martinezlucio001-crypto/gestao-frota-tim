
import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';

// Configurando o worker para Node.js
// Em ambiente Node, não usamos o arquivo worker do CDN, e sim o da própria lib
// Mas o pdfjs-dist moderno tenta detectar ambiente. Se falhar, configuramos manualmente.

const extractTextFromPDF = async (filePath) => {
    try {
        console.log(`Lendo arquivo: ${filePath}...`);

        // Ler arquivo do disco
        const buffer = fs.readFileSync(filePath);
        const uint8Array = new Uint8Array(buffer);

        // Carregar Documento
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;

        let fullText = '';
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Mesma lógica do site: junta com espaço
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';

            // Feedback visual
            if (i % 5 === 0) console.log(`   - Página ${i} processada...`);
        }

        // Normalização IDÊNTICA ao site e ao Python
        // Remove todos os espaços e converte para maiúsculo
        const normalized = fullText.replace(/\s+/g, '').toUpperCase();

        return normalized;

    } catch (error) {
        console.error("Erro ao ler PDF:", error);
        return "";
    }
};

const main = async () => {
    // Pegar nome do arquivo dos argumentos ou pedir input
    const args = process.argv.slice(2);
    let fileName = args[0];

    if (!fileName) {
        console.log("===================================================");
        console.log("   COMPARADOR DE EXTRAÇÃO (JAVASCRIPT NODE.JS)");
        console.log("===================================================");
        console.log("Uso: node comparar_extracao.js <nome-do-arquivo.pdf>");
        console.log("---------------------------------------------------");
        // Como estamos em módulo ES, input é chato, vamos pedir para passar argumento
        console.log("❌ Por favor, forneça o nome do arquivo. Exemplo:");
        console.log("   node comparar_extracao.js extrato.pdf");
        return;
    }

    if (!fs.existsSync(fileName)) {
        console.log(`❌ Arquivo '${fileName}' não encontrado.`);
        return;
    }

    const text = await extractTextFromPDF(fileName);

    // Salvar em arquivo para comparação
    const outFile = 'resultado_js.txt';
    fs.writeFileSync(outFile, text);

    console.log("===================================================");
    console.log(`✅ Extração concluída!`);
    console.log(`🔠 Caracteres extraídos: ${text.length}`);
    console.log(`💾 Resultado salvo em: ${outFile}`);
    console.log("===================================================");
    console.log("Agora você pode comparar 'resultado_js.txt' com a saída do seu script Python.");
};

main();
