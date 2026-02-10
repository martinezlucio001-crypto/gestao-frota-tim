import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Card, Button, Input, Select, Modal, ModalFooter } from '../../components/ui';
import {
    FileText, Package, Truck, Calendar, Search, Filter,
    MoreVertical, CheckCircle2, AlertCircle, X, ChevronRight,
    ArrowUp, ArrowDown, RefreshCw
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../../components/ui/Table';
import NotaDetalheModal from './modals/NotaDetalheModal';
import DespachoModal from './modals/DespachoModal';
import { formatCurrency } from '../../lib/utils';

// Helper for Status Dots (Lights Style)
const StatusLights = ({ status, divergencia }) => {
    // Styles for "lights"
    const lightBase = "w-3 h-3 rounded-full border transition-all duration-300";
    const lightOn = "shadow-[0_0_8px_1px] opacity-100 scale-110 border-transparent";
    const lightOff = "bg-transparent opacity-30 scale-90";

    const isRecebido = ['RECEBIDO', 'PROCESSADA', 'CONCLUIDO', 'DIVERGENTE'].includes(status);
    const isProcessado = ['PROCESSADA', 'CONCLUIDO', 'DIVERGENTE'].includes(status);
    const isEntregue = ['CONCLUIDO', 'DIVERGENTE', 'DEVOLVED_ORPHAN'].includes(status);
    const isOrphan = status === 'DEVOLVED_ORPHAN';

    return (
        <div className="flex items-center justify-center gap-2">
            {/* Amarelo (Recebido) */}
            <div
                className={`${lightBase} border-yellow-500 ${isRecebido && !isOrphan ? `bg-yellow-400 ${lightOn} shadow-yellow-400/60` : lightOff}`}
                title="Recebido"
            />
            {/* Azul (Processado) */}
            <div
                className={`${lightBase} border-blue-500 ${isProcessado && !isOrphan ? `bg-blue-500 ${lightOn} shadow-blue-500/60` : lightOff}`}
                title="Processado"
            />
            {/* Verde (Entregue) */}
            <div
                className={`${lightBase} border-emerald-500 ${isEntregue ? `bg-emerald-500 ${lightOn} shadow-emerald-500/60` : lightOff}`}
                title="Concluído/Entregue"
            />

            {/* Divergência Warning */}
            {(status === 'DIVERGENTE' || divergencia) && (
                <div className="ml-1 text-rose-500 animate-pulse" title={`Divergência: ${divergencia}`}>
                    <AlertCircle size={16} fill="currentColor" className="text-white" />
                </div>
            )}
        </div>
    );
};

// Section Component
const NotaSection = ({ title, notas, icon: Icon, colorClass, onOpenNota, emptyMessage }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'data_ocorrencia', direction: 'desc' });

    const sortedNotas = useMemo(() => {
        let sortable = [...notas];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';

                // Special handling for dates (DD/MM/YYYY)
                if (sortConfig.key === 'data_ocorrencia' && aVal.includes('/')) {
                    aVal = aVal.split('/').reverse().join('-');
                    bVal = bVal.split('/').reverse().join('-');
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [notas, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="w-4 h-4" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    return (
        <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icon size={18} className="text-slate-500" />
                    <h3 className="font-bold text-slate-700">{title}</h3>
                    <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                        {notas.length}
                    </span>
                </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                <Table>
                    <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                        <TableRow>
                            <TableHead className="w-[140px]">Nota</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                onClick={() => handleSort('origem')}
                            >
                                <div className="flex items-center gap-1">
                                    Origem <SortIcon column="origem" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                onClick={() => handleSort('destino')}
                            >
                                <div className="flex items-center gap-1">
                                    Destino <SortIcon column="destino" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                onClick={() => handleSort('data_ocorrencia')}
                            >
                                <div className="flex items-center gap-1">
                                    Data <SortIcon column="data_ocorrencia" />
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Peso (kg)</TableHead>
                            <TableHead className="text-center w-[120px]">Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedNotas.length === 0 ? (
                            <TableEmpty message={emptyMessage || "Nenhuma nota nesta seção."} />
                        ) : (
                            sortedNotas.map(nota => (
                                <TableRow
                                    key={nota.id}
                                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => onOpenNota(nota)}
                                >
                                    <TableCell className="font-medium text-indigo-600">
                                        {nota.nota_despacho}
                                    </TableCell>
                                    <TableCell className="text-slate-600">{nota.origem}</TableCell>
                                    <TableCell className="text-slate-600">{nota.destino}</TableCell>
                                    <TableCell className="text-slate-500 text-xs">
                                        {nota.data_ocorrencia}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {(nota.peso_total_declarado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <StatusLights status={nota.status} divergencia={nota.divergencia} />
                                    </TableCell>
                                    <TableCell>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
};

const NotasDespachoPage = () => {
    const [notas, setNotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [servidores, setServidores] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);

    const [selectedNota, setSelectedNota] = useState(null);
    const [isDespachoModalOpen, setIsDespachoModalOpen] = useState(false);

    // Filters
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterOrigem, setFilterOrigem] = useState('');
    const [filterDestino, setFilterDestino] = useState('');

    // Load Metadata (Last Sync)
    useEffect(() => {
        const fetchMeta = async () => {
            const docRef = doc(db, 'artifacts', `${appId}_sync_metadata`);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.last_sync && data.last_sync.seconds) { // Firestore Timestamp
                    setLastUpdate(new Date(data.last_sync.seconds * 1000).toLocaleString());
                } else if (data.last_sync) {
                    setLastUpdate(new Date(data.last_sync).toLocaleString());
                }
            }
        };
        fetchMeta();
        // Poll every minute
        const interval = setInterval(fetchMeta, 60000);
        return () => clearInterval(interval);
    }, []);

    // Load Notes
    useEffect(() => {
        const q = query(
            collection(db, 'tb_despachos_conferencia'),
            orderBy('criado_em', 'desc') // Load by creation time to get newest
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotas(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load Servers for Modal
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/servidores`), (snapshot) => {
            setServidores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    // Extract Unique Cities for Dropdowns
    const uniqueOrigens = useMemo(() => [...new Set(notas.map(n => n.origem).filter(Boolean))].sort(), [notas]);
    const uniqueDestinos = useMemo(() => [...new Set(notas.map(n => n.destino).filter(Boolean))].sort(), [notas]);

    // Filtering Logic
    const filteredNotas = useMemo(() => {
        return notas.filter(nota => {
            // Date Range
            if (filterDateStart || filterDateEnd) {
                const notaDateStr = nota.data_ocorrencia; // DD/MM/YYYY
                if (notaDateStr) {
                    const [d, m, y] = notaDateStr.split('/');
                    const notaDate = new Date(`${y}-${m}-${d}`);

                    if (filterDateStart) {
                        const start = new Date(filterDateStart);
                        if (notaDate < start) return false;
                    }
                    if (filterDateEnd) {
                        const end = new Date(filterDateEnd);
                        if (notaDate > end) return false;
                    }
                }
            }
            // Origin
            if (filterOrigem && nota.origem !== filterOrigem) return false;
            // Destino
            if (filterDestino && nota.destino !== filterDestino) return false;

            return true;
        });
    }, [notas, filterDateStart, filterDateEnd, filterOrigem, filterDestino]);

    // Sectioning Logic
    const sections = useMemo(() => {
        // Helper: Treat undefined created_by as ROBO (Legacy compatibility)
        const isRobo = (n) => n.created_by === 'ROBO' || !n.created_by;

        return {
            recebidos: filteredNotas.filter(n => n.status === 'RECEBIDO' && isRobo(n)),
            processados: filteredNotas.filter(n => n.status === 'PROCESSADA' && isRobo(n)),
            concluidos: filteredNotas.filter(n => ['CONCLUIDO', 'ENTREGUE'].includes(n.status) && isRobo(n)),
            divergentes: filteredNotas.filter(n => ['DIVERGENTE', 'DEVOLVED_ORPHAN'].includes(n.status) && isRobo(n)),
            manuais: filteredNotas.filter(n => !isRobo(n))
        };
    }, [filteredNotas]);

    // Actions
    const handleProcessarNota = (nota) => {
        setIsDespachoModalOpen(true);
    };

    const handleDespachoSuccess = async () => {
        if (selectedNota) {
            try {
                await updateDoc(doc(db, 'tb_despachos_conferencia', selectedNota.id), {
                    status: 'PROCESSADA',
                    processado_em: new Date().toISOString()
                });
            } catch (error) {
                console.error("Erro ao atualizar status:", error);
            }
        }
        setIsDespachoModalOpen(false);
        setSelectedNota(null);
    };

    const initialDespachoData = useMemo(() => {
        if (!selectedNota) return null;
        return {
            data: selectedNota.data_ocorrencia ? selectedNota.data_ocorrencia.split(' ')[0].split('/').reverse().join('-') : '',
            origem: selectedNota.origem,
            destino: selectedNota.destino,
            pesoTotal: selectedNota.peso_total_declarado,
            volumesCorreios: selectedNota.qtde_unitizadores,
            volumesEntregues: '',
            quantidadePaletes: 0,
            observacoes: `Despacho gerado a partir da Nota ${selectedNota.nota_despacho}.`
        };
    }, [selectedNota]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Notas de Despacho</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <span>Gerenciamento automático via e-mail</span>
                        {lastUpdate && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs border border-slate-200">
                                Última atualização: {lastUpdate}
                            </span>
                        )}
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={async () => {
                        try {
                            setLoading(true);
                            const response = await fetch(`https://gestao-frota-tim.vercel.app/api/sync_emails?key=${import.meta.env.VITE_SYNC_KEY || 'timbelem2025*'}`);
                            const data = await response.json();
                            if (response.ok) {
                                alert(`Sucesso: ${data.message || 'Notas atualizadas!'}`);
                            } else {
                                alert(`Erro: ${data.error || 'Falha na atualização'}`);
                            }
                        } catch (error) {
                            alert('Erro de conexão ao tentar atualizar.');
                            console.error(error);
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    {loading ? "Atualizando..." : "Atualizar Notas"}
                </Button>
            </div>

            {/* Global Filters */}
            <Card className="p-4 bg-white shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Período</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                                value={filterDateStart}
                                onChange={e => setFilterDateStart(e.target.value)}
                            />
                            <input
                                type="date"
                                className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                                value={filterDateEnd}
                                onChange={e => setFilterDateEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Origem</label>
                        <select
                            className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                            value={filterOrigem}
                            onChange={e => setFilterOrigem(e.target.value)}
                        >
                            <option value="">Todas</option>
                            {uniqueOrigens.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Destino</label>
                        <select
                            className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                            value={filterDestino}
                            onChange={e => setFilterDestino(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {uniqueDestinos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setFilterDateStart('');
                                setFilterDateEnd('');
                                setFilterOrigem('');
                                setFilterDestino('');
                            }}
                            disabled={!filterDateStart && !filterDateEnd && !filterOrigem && !filterDestino}
                        >
                            Limpar Filtros
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Sections */}
            <div className="space-y-8">
                {/* 1. Recebido - Amarelo */}
                <NotaSection
                    title="Recebidos - Aguardando Processamento"
                    notas={sections.recebidos}
                    icon={Package}
                    colorClass="border-l-yellow-400"
                    onOpenNota={setSelectedNota}
                    emptyMessage="Nenhuma nota pendente."
                />

                {/* 2. Processado - Amarelo + Azul */}
                <NotaSection
                    title="Processados / Em Trânsito"
                    notas={sections.processados}
                    icon={Truck}
                    colorClass="border-l-blue-500"
                    onOpenNota={setSelectedNota}
                />

                {/* 3. Concluído - 3 Bolinhas */}
                <NotaSection
                    title="Entregues / Devolvidos (Concluídos)"
                    notas={sections.concluidos}
                    icon={CheckCircle2}
                    colorClass="border-l-emerald-500"
                    onOpenNota={setSelectedNota}
                />

                {/* 4. Divergentes / Órfãs - Red/Green mix */}
                {sections.divergentes.length > 0 && (
                    <NotaSection
                        title="Divergências e Órfãs (Atenção)"
                        notas={sections.divergentes}
                        icon={AlertCircle}
                        colorClass="border-l-rose-500"
                        onOpenNota={setSelectedNota}
                    />
                )}

                {/* 5. Manuais */}
                {sections.manuais.length > 0 && (
                    <NotaSection
                        title="Notas Manuais"
                        notas={sections.manuais}
                        icon={FileText}
                        colorClass="border-l-slate-400"
                        onOpenNota={setSelectedNota}
                    />
                )}
            </div>

            {/* Modais */}
            {selectedNota && !isDespachoModalOpen && (
                <NotaDetalheModal
                    nota={selectedNota}
                    onClose={() => setSelectedNota(null)}
                    onProcessar={handleProcessarNota}
                />
            )}

            <DespachoModal
                isOpen={isDespachoModalOpen}
                onClose={() => setIsDespachoModalOpen(false)}
                initialData={initialDespachoData}
                onSaveSuccess={handleDespachoSuccess}
                servidores={servidores}
            />
        </div>
    );
};

export default NotasDespachoPage;
