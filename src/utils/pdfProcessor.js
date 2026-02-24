import * as pdfjsLib from 'pdfjs-dist';

// Configurar o Worker do PDF.js para funcionar com Vite
// Usando o CDN versionado para evitar problemas de compatibilidade com Vite em dev/prod
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extrai todo o texto de um arquivo PDF.
 * @param {File} file - O arquivo PDF selecionado pelo usuário.
 * @param {Function} onProgress - Callback para atualizar progresso (opcional).
 * @returns {Promise<string>} - Texto completo normalizado (UPPERCASE, sem espaços).
 */
export const extractTextFromPDF = async (file, onProgress) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = '';
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
            if (onProgress) {
                onProgress(`Lendo página ${i} de ${totalPages}...`);
            }

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        // Normalização: Remove espaços em branco e converte para maiúsculo
        // Igual ao que fazíamos no Python: re.sub(r'\s+', '', text).upper()
        return fullText.replace(/\s+/g, '').toUpperCase();
    } catch (error) {
        console.error("Erro ao ler PDF:", error);
        throw new Error("Falha ao processar o arquivo PDF.");
    }
};
