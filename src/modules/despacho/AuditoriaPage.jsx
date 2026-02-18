import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, AlertCircle, Copy, Search, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const AuditoriaPage = () => {
    const [filePostal, setFilePostal] = useState(null);
    const [fileDensa, setFileDensa] = useState(null);
    const [monthPostal, setMonthPostal] = useState('');
    const [monthDensa, setMonthDensa] = useState('');
    const [pricePostal, setPricePostal] = useState('2.89');
    const [priceDensa, setPriceDensa] = useState('0.39');

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            if (type === 'postal') setFilePostal(file);
            else setFileDensa(file);
        } else {
            alert('Por favor, selecione um arquivo PDF válido.');
        }
    };

    const handleProcess = async () => {
        if (!filePostal && !fileDensa) {
            alert("Selecione pelo menos um arquivo para auditoria.");
            return;
        }

        if ((filePostal && !monthPostal) || (fileDensa && !monthDensa)) {
            alert("Selecione o mês de referência para os arquivos carregados.");
            return;
        }

        setLoading(true);
        setResult(null);

        const formData = new FormData();
        if (filePostal) {
            formData.append('file_postal', filePostal);
            formData.append('month_postal', monthPostal);
            formData.append('price_postal', pricePostal);
        }
        if (fileDensa) {
            formData.append('file_densa', fileDensa);
            formData.append('month_densa', monthDensa);
            formData.append('price_densa', priceDensa);
        }

        try {
            const response = await fetch('https://gestao-frota-tim.vercel.app/api/audit_pdf', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                setResult(data);
            } else {
                alert(`Erro: ${data.error || 'Falha no processamento'}`);
            }
        } catch (error) {
            console.error(error);
            alert("Erro de conexão ao processar auditoria.");
        } finally {
            setLoading(false);
        }
    };

    const copyMissing = () => {
        if (result && result.missing_codes) {
            navigator.clipboard.writeText(result.missing_codes.join('\n'));
            alert("Códigos copiados para a área de transferência!");
        }
    };

    const months = [
        "Janeiro/2026", "Fevereiro/2026", "Março/2026", "Abril/2026",
        "Maio/2026", "Junho/2026", "Julho/2026", "Agosto/2026",
        "Setembro/2026", "Outubro/2026", "Novembro/2026", "Dezembro/2026"
    ];

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Auditoria de Unitizadores</h1>
                <p className="text-slate-500 text-sm">Auditoria cruzada entre e-mails recebidos e extratos PDF dos Correios.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Carga Postal */}
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                            <FileText size={20} />
                            Extrato Carga Postal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept=".pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleFileChange(e, 'postal')}
                            />
                            {filePostal ? (
                                <div className="text-blue-600 font-medium flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    {filePostal.name}
                                </div>
                            ) : (
                                <>
                                    <Upload size={24} className="text-slate-400 mb-2" />
                                    <span className="text-sm text-slate-500">Clique para selecionar PDF</span>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Mês Referência</label>
                                <Select value={monthPostal} onValueChange={setMonthPostal}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Valor (R$/Kg)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={pricePostal}
                                    onChange={e => setPricePostal(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Card Carga Densa */}
                <Card className="border-l-4 border-l-indigo-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                            <FileText size={20} />
                            Extrato Carga Densa
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept=".pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleFileChange(e, 'densa')}
                            />
                            {fileDensa ? (
                                <div className="text-indigo-600 font-medium flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    {fileDensa.name}
                                </div>
                            ) : (
                                <>
                                    <Upload size={24} className="text-slate-400 mb-2" />
                                    <span className="text-sm text-slate-500">Clique para selecionar PDF</span>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Mês Referência</label>
                                <Select value={monthDensa} onValueChange={setMonthDensa}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Valor (R$/Kg)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={priceDensa}
                                    onChange={e => setPriceDensa(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-center pt-4">
                <Button
                    size="lg"
                    className="w-full md:w-1/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={handleProcess}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="animate-spin mr-2">⟳</span> Processando Auditoria...
                        </>
                    ) : (
                        <>
                            <Search className="mr-2" size={20} /> Processar Auditoria
                        </>
                    )}
                </Button>
            </div>

            {/* Resultados */}
            {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <div className="text-3xl font-bold text-emerald-600">{result.found_count}</div>
                                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Encontrados</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <div className="text-3xl font-bold text-red-500">{result.missing_count}</div>
                                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Não Localizados</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <div className="text-3xl font-bold text-indigo-600">{result.total_processed}</div>
                                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Total Analisado</div>
                            </CardContent>
                        </Card>
                    </div>

                    {result.missing_codes && result.missing_codes.length > 0 && (
                        <Card className="border-red-100 bg-red-50/30">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-red-700 flex items-center gap-2 text-lg">
                                    <AlertTriangle size={20} />
                                    Unitizadores Não Localizados ({result.missing_count})
                                </CardTitle>
                                <Button variant="outline" size="sm" onClick={copyMissing} className="border-red-200 text-red-700 hover:bg-red-50">
                                    <Copy size={14} className="mr-2" />
                                    Copiar Todos
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-60 overflow-y-auto bg-white rounded border border-red-100 p-4 font-mono text-sm text-red-600 shadow-inner">
                                    {result.missing_codes.map((code, idx) => (
                                        <div key={idx} className="border-b border-dashed border-red-50 last:border-0 py-1">
                                            {code}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {result.found_count > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-emerald-700 flex items-center gap-3">
                            <CheckCircle size={20} className="shrink-0" />
                            <div>
                                <span className="font-bold">Sucesso!</span> {result.found_count} unitizadores foram atualizados no sistema e marcados como conferidos pelos Correios.
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AuditoriaPage;
