import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
    Button, StatusBadge, Card
} from '../../components/ui';
import { formatDateBR, formatCurrency } from '../../lib/utils';
import {
    Mail,
    ArrowRight,
    Truck,
    CheckCircle2,
    X,
    ChevronRight,
    Package,
    AlertCircle,
    Scale
} from 'lucide-react';
import DespachoModal from './modals/DespachoModal';

// --- Subcomponent: Modal de Detalhes da Nota (Mobile First) ---
const NotaDetalheModal = ({ nota, onClose, onProcessar }) => {
    const [itens, setItens] = useState([]);

    useEffect(() => {
        if (nota) {
            // Inicializa itens com estado de conferido
            setItens(nota.itens.map(i => ({ ...i, conferido: false })));
        }
    }, [nota]);

    const toggleItem = (index) => {
        setItens(prev => prev.map((item, i) =>
            i === index ? { ...item, conferido: !item.conferido } : item
        ));
    };

    const todosConferidos = itens.length > 0 && itens.every(i => i.conferido);

    if (!nota) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
            {/* 1. Header Fixo */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm flex-none">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                        <X size={24} />
                    </button>
                    <h3 className="font-bold text-lg text-slate-800">Nota {nota.nota_despacho}</h3>
                    <div className="w-10"></div> {/* Spacer */}
                </div>

                {/* Macro Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="block text-xs text-slate-400 mb-1">Rota</span>
                        <div className="font-semibold text-slate-700 flex items-center gap-1">
                            {nota.origem} <ArrowRight size={12} /> {nota.destino}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="block text-xs text-slate-400 mb-1">Data</span>
                        <span className="font-semibold text-slate-700">{formatDateBR(nota.data_ocorrencia)}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="block text-xs text-slate-400 mb-1">Qtd. Total</span>
                        <span className="font-semibold text-slate-700">{nota.qtde_unitizadores} Unit.</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                        <span className="block text-xs text-slate-400 mb-1">Peso Total</span>
                        <span className="font-semibold text-slate-700">{nota.peso_total_declarado?.toLocaleString('pt-BR')} kg</span>
                    </div>
                </div>
            </div>

            {/* 2. Lista Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Itens da Nota</h4>
                {itens.map((item, idx) => (
                    <div
                        key={idx}
                        onClick={() => toggleItem(idx)}
                        className={`bg-white p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${item.conferido
                            ? 'border-emerald-500 bg-emerald-50/30'
                            : 'border-transparent shadow-sm hover:border-indigo-200'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-1 inline-block">
                                    {item.unitizador}
                                </span>
                                <div className="text-sm font-medium text-slate-800 whitespace-pre-line">
                                    {(item.lacre && item.lacre !== '?' && item.lacre.trim() !== '') ? item.lacre : <span className="text-slate-400 italic font-normal">Sem Lacre</span>}
                                </div>
                            </div>
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${item.conferido ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                    }`}>
                                <CheckCircle2 size={24} strokeWidth={3} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-500 text-sm mt-2 pt-2 border-t border-slate-100">
                            <Scale size={14} />
                            <span>{item.peso?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Footer de Ações */}
            <div className="bg-white border-t border-slate-200 p-4 pb-8 flex-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3">
                    <Button variant="ghost" className="flex-1 h-12" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => onProcessar(nota)}
                        className={`flex-1 h-12 text-base shadow-lg shadow-indigo-200 ${todosConferidos ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                            }`}
                        leftIcon={Truck}
                    >
                        Realizar Despacho
                    </Button>
                </div>
                {!todosConferidos && (
                    <p className="text-center text-xs text-amber-600 mt-2 flex items-center justify-center gap-1">
                        <AlertCircle size={12} />
                        Confira todos os itens antes de despachar
                    </p>
                )}
            </div>
        </div >
    );
};

// --- Página Principal ---
const NotasDespachoPage = () => {
    const [notas, setNotas] = useState([]);
    const [servidores, setServidores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedNota, setSelectedNota] = useState(null);
    const [isDespachoModalOpen, setIsDespachoModalOpen] = useState(false);

    // Carregar Notas
    useEffect(() => {
        const q = query(
            collection(db, 'tb_despachos_conferencia'),
            orderBy('data_ocorrencia', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotas(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Carregar Servidores (para o modal de despacho)
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/servidores`), (snapshot) => {
            setServidores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    const handleOpenNota = (nota) => {
        setSelectedNota(nota);
    };

    const handleProcessarNota = (nota) => {
        // Fecha visualização detalhada e abre o modal de despacho oficial
        // O selectedNota continua setado para passar os dados
        setIsDespachoModalOpen(true);
    };

    const handleDespachoSuccess = async () => {
        // Callback após salvar o despacho com sucesso
        // Atualizar status da nota para PROCESSADA
        if (selectedNota) {
            try {
                await updateDoc(doc(db, 'tb_despachos_conferencia', selectedNota.id), {
                    status: 'PROCESSADA',
                    processado_em: new Date().toISOString()
                });
            } catch (error) {
                console.error("Erro ao atualizar status da nota:", error);
            }
        }
        setIsDespachoModalOpen(false);
        setSelectedNota(null);
    };

    // Dados para preencher o formulário automaticamente
    const initialDespachoData = useMemo(() => {
        if (!selectedNota) return null;
        return {
            data: selectedNota.data_ocorrencia ? selectedNota.data_ocorrencia.split(' ')[0].split('/').reverse().join('-') : '', // DD/MM/YYYY -> YYYY-MM-DD (aprox) ou verificar formato salvo
            origem: selectedNota.origem,
            destino: selectedNota.destino,
            pesoTotal: selectedNota.peso_total_declarado,
            volumesCorreios: selectedNota.qtde_unitizadores,
            volumesEntregues: '', // Deixa em branco para usuário preencher
            quantidadePaletes: 0,
            observacoes: `Despacho gerado a partir da Nota ${selectedNota.nota_despacho}.`
        };
    }, [selectedNota]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Notas de Despacho</h1>
                    <p className="text-slate-500">Gerencie e processe as notas recebidas por e-mail.</p>
                </div>
            </div>

            {/* Lista Principal */}
            <Card className="overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nota de Despacho</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Destino</TableHead>
                            <TableHead>Data Recebimento</TableHead>
                            <TableHead className="text-right">Qtd. Unit.</TableHead>
                            <TableHead className="text-right">Peso (kg)</TableHead>
                            <TableHead className="text-center w-[120px]">Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell>
                            </TableRow>
                        ) : notas.length === 0 ? (
                            <TableEmpty message="Nenhuma nota encontrada." icon={Mail} />
                        ) : (
                            notas.map(nota => (
                                <TableRow
                                    key={nota.id}
                                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => handleOpenNota(nota)}
                                >
                                    <TableCell className="font-bold text-indigo-700">
                                        {nota.nota_despacho}
                                    </TableCell>
                                    <TableCell>{nota.origem}</TableCell>
                                    <TableCell>{nota.destino}</TableCell>
                                    <TableCell>{/* Formato da data pode variar, exibir como string ou formatar se possível */}
                                        {nota.data_ocorrencia || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">
                                            {nota.qtde_unitizadores || 0}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {(nota.peso_total_declarado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {nota.status === 'PROCESSADA' ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                <CheckCircle2 size={12} />
                                                Processada
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                Pend. Despacho
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Modal de Detalhes (Mobile Styles) */}
            {selectedNota && !isDespachoModalOpen && (
                <NotaDetalheModal
                    nota={selectedNota}
                    onClose={() => setSelectedNota(null)}
                    onProcessar={handleProcessarNota}
                />
            )}

            {/* Modal Oficial de Despacho (Reutilizado) */}
            <DespachoModal
                isOpen={isDespachoModalOpen}
                onClose={() => setIsDespachoModalOpen(false)}
                servidores={servidores}
                initialData={initialDespachoData}
                onSaveSuccess={handleDespachoSuccess}
            />
        </div>
    );
};

export default NotasDespachoPage;
