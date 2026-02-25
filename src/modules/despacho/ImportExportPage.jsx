/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Card, Button } from '../../components/ui';
import { Upload, FileDown, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { formatDateBR } from '../../lib/utils';
import { CITIES } from '../../lib/cities';

const ImportExportPage = () => {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [importProgress, setImportProgress] = useState(0); // Progress 0-100
    const [stats, setStats] = useState(null);

    // Helper to normalize city names
    const findClosestCity = (cityName) => {
        if (!cityName) return '-';
        const normalize = str => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const target = normalize(cityName);

        // 1. Exact Match (Normalized)
        const match = CITIES.find(c => normalize(c) === target);
        if (match) return match;

        // 2. Common Mappings (CSV vs System)
        if (target.includes('castelo')) return 'AC CASTELO DOS SONHOS'; // CSV: DOS SONHOS -> System: DE SONHOS
        if (target.includes('trombetas')) return 'AC PORTO TROMBETAS';
        if (target.includes('curua')) return 'AC CURUA'; // Ensure accents don't break it

        return cityName; // Keep original if no match found
    };

    // Helper: convert Excel serial date to DD/MM/YYYY HH:mm string
    const parseExcelDate = (val) => {
        if (!val) return '';
        // Already a formatted string (contains /)
        if (typeof val === 'string' && val.includes('/')) return val;
        const num = Number(val);
        if (isNaN(num)) return String(val);
        // Excel epoch: day 1 = Jan 1 1900; JS epoch offset = 25569 days
        const ms = (num - 25569) * 86400 * 1000;
        const d = new Date(ms);
        // Adjust for local timezone so the day doesn't shift
        const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
        const dd = String(utc.getDate()).padStart(2, '0');
        const mm = String(utc.getMonth() + 1).padStart(2, '0');
        const yy = utc.getFullYear();
        const hh = String(utc.getHours()).padStart(2, '0');
        const mi = String(utc.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yy} ${hh}:${mi}`;
    };

    // Helper: normalize peso value from Excel
    // Excel may deliver 22,45 as number 22.45 or string "22,45"
    const parsePeso = (raw) => {
        if (raw === undefined || raw === null || raw === '') return '0';
        if (typeof raw === 'number') return raw.toString();
        // String: replace comma decimal separator
        return raw.replace(',', '.');
    };

    // --- IMPORT LOGIC ---

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setStats(null);
        setLoading(true);
        setProgress('Lendo arquivo...');
        setImportProgress(0);

        try {
            const data = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            setPreviewData(jsonData);
            setLoading(false);
        } catch (error) {
            console.error("Erro ao ler Excel:", error);
            alert("Erro ao ler arquivo. Certifique-se que é um Excel válido.");
            setLoading(false);
        }
    };

    const processImport = async () => {
        if (previewData.length === 0) return;

        setLoading(true);
        setProgress('Iniciando processamento...');
        setImportProgress(0);
        setStats(null);

        try {
            // 1. Group by Nota
            const batches = {}; // Nota -> { metadata, itens: [], itens_conferencia: [] }

            setProgress(`Agrupando ${previewData.length} linhas...`);

            previewData.forEach((row, index) => {
                const notaOrigem = row['Nota'] || `SEM_NOTA_${index}`;
                const tipo = row['Tipo'];

                if (!batches[notaOrigem]) {
                    batches[notaOrigem] = {
                        origem: findClosestCity(row['Origem']),
                        destino: findClosestCity(row['Destino']),
                        data: parseExcelDate(row['Data']),
                        itens: [],
                        itens_conferencia: []
                    };
                }

                const peso = parsePeso(row['Peso']);

                const itemData = {
                    unitizador: row['Unitizador'],
                    peso: peso,
                    lacre: row['Lacre'] || '-'
                };

                if (tipo === 'Recebimento') {
                    batches[notaOrigem].itens.push(itemData);
                } else if (tipo === 'Devolução') {
                    batches[notaOrigem].itens_conferencia.push(itemData);
                }
            });

            // 2. Process to Firestore (Optimized with 'in' query chunks)
            // Batch reads to avoid 1 read per doc (~30x faster)
            let batchHandler = writeBatch(db);
            const despachosRef = collection(db, 'tb_despachos_conferencia');

            let createdCount = 0;
            let updatedCount = 0;
            let totalOps = 0;

            const notasList = Object.keys(batches);
            const totalNotas = notasList.length;
            const READ_CHUNK_SIZE = 30; // Firestore 'in' limit is 30

            // Helper to chunk array
            const chunkArray = (arr, size) => {
                const chunks = [];
                for (let i = 0; i < arr.length; i += size) {
                    chunks.push(arr.slice(i, i + size));
                }
                return chunks;
            };

            const notaChunks = chunkArray(notasList, READ_CHUNK_SIZE);
            let processedReadChunks = 0;

            for (const chunk of notaChunks) {
                // Fetch existing docs for this chunk of 30
                // Use 'in' query
                const q = query(despachosRef, where('nota_despacho', 'in', chunk));
                const querySnapshot = await getDocs(q);

                // Create Map for quick lookup
                const existingDocsMap = {};
                querySnapshot.forEach(doc => {
                    existingDocsMap[doc.data().nota_despacho] = doc;
                });

                // Process each nota in the chunk
                for (const notaKey of chunk) {
                    const data = batches[notaKey];
                    const existingDoc = existingDocsMap[notaKey];

                    if (existingDoc) {
                        // Update
                        const existingData = existingDoc.data();
                        const newItens = [...(existingData.itens || []), ...data.itens];
                        const newConferencia = [...(existingData.itens_conferencia || []), ...data.itens_conferencia];

                        batchHandler.update(existingDoc.ref, {
                            itens: newItens,
                            itens_conferencia: newConferencia
                        });
                        updatedCount++;
                    } else {
                        // Create
                        const newDocRef = doc(despachosRef, notaKey);
                        batchHandler.set(newDocRef, {
                            nota_despacho: notaKey,
                            origem: data.origem,
                            destino: data.destino,
                            data_ocorrencia: data.data,
                            criado_em: new Date(),
                            itens: data.itens,
                            itens_conferencia: data.itens_conferencia,
                            status: 'RECEBIDO',
                            created_by: 'USER'
                        });
                        createdCount++;
                    }

                    totalOps++;

                    // Commit logic (Firestore limit 500)
                    if (totalOps >= 400) {
                        await batchHandler.commit();
                        batchHandler = writeBatch(db);
                        totalOps = 0;
                    }
                }

                processedReadChunks++;
                const processedItems = processedReadChunks * READ_CHUNK_SIZE;
                const currentProgress = Math.min(Math.round((processedItems / totalNotas) * 100), 99);
                setImportProgress(currentProgress);
                setProgress(`Processando... ${Math.min(processedItems, totalNotas)} / ${totalNotas} notas`);

                // Yield to UI
                await new Promise(r => setTimeout(r, 0));
            }

            // Final Commit
            if (totalOps > 0) {
                await batchHandler.commit();
            }

            setImportProgress(100);
            setStats({
                imported: previewData.length,
                notasCreated: createdCount,
                notasUpdated: updatedCount
            });
            setFile(null);
            setPreviewData([]);

        } catch (error) {
            console.error("Erro na importação:", error);
            alert(`Falha na importação: ${error.message}`);
        } finally {
            setLoading(false);
            setTimeout(() => {
                setProgress('');
                setImportProgress(0);
            }, 3000);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* --- IMPORT CARD --- */}
                <Card className="p-6 bg-white shadow-sm border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-slate-800">Importar Despachos</h3>
                            <p className="text-sm text-slate-500">Arquivo Excel (.xlsx) ou CSV</p>
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 hover:bg-slate-50 transition-colors cursor-pointer relative group">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="text-center">
                            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h4 className="font-medium text-slate-700 mb-1">
                                {file ? file.name : "Clique ou arraste o arquivo"}
                            </h4>
                            <p className="text-xs text-slate-400">
                                Suporta XLSX e CSV (Ponto e vírgula)
                            </p>
                        </div>
                    </div>

                    {file && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-4 text-sm">
                                <span className="text-slate-600 font-medium">Linhas encontradas:</span>
                                <span className="text-indigo-600 font-bold">{previewData.length}</span>
                            </div>

                            <Button
                                onClick={processImport}
                                disabled={loading || previewData.length === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
                                ) : (
                                    <><CheckCircle className="w-4 h-4 mr-2" /> Confirmar Importação</>
                                )}
                            </Button>
                        </div>
                    )}

                    {loading && progress && (
                        <div className="mt-4 text-center">
                            <span className="text-sm text-slate-500 animate-pulse block mb-2">{progress}</span>
                            {importProgress > 0 && (
                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden relative">
                                    <div
                                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                        style={{ width: `${importProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {stats && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100 animate-in fade-in slide-in-from-bottom-2">
                            <h4 className="flex items-center font-semibold text-green-800 mb-2">
                                <CheckCircle className="w-4 h-4 mr-2" /> Importação Concluída
                            </h4>
                            <ul className="text-sm text-green-700 space-y-1 ml-6 list-disc">
                                <li>Novas notas criadas: <b>{stats.notasCreated}</b></li>
                                <li>Notas atualizadas: <b>{stats.notasUpdated}</b></li>
                            </ul>
                        </div>
                    )}
                </Card>

                {/* --- EXPORT CARD (Placeholder for future) --- */}
                <Card className="p-6 bg-white shadow-sm border-slate-200 opacity-60">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <FileDown className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-slate-800">Exportar Relatórios</h3>
                            <p className="text-sm text-slate-500">Baixar dados em Excel</p>
                        </div>
                    </div>

                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                        <Download className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Funcionalidade em desenvolvimento</p>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default ImportExportPage;
