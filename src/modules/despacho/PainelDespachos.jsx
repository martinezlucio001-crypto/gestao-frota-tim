import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Search,
    Filter,
    Download,
    Calendar,
    Ship,
    Package,
    MoreVertical,
    Pencil,
    Trash2,
    Eye,
    RefreshCw,
    FileDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore'; // Added deleteDoc, doc
import { db, appId } from '../../lib/firebase';
import {
    Button,
    Card,
    StatCard,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableEmpty,
    StatusBadge,
    Input,
    Select
} from '../../components/ui';
import { formatCurrency, formatDateBR } from '../../lib/utils';
import { CITIES, FINANCIAL_STATUS } from '../../lib/cities';
import DespachoModal from './modals/DespachoModal';

const PainelDespachos = () => {
    const [despachos, setDespachos] = useState([]);
    const [servidores, setServidores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDespacho, setEditingDespacho] = useState(null);

    // Filtros
    const [filters, setFilters] = useState({
        dataInicio: '',
        dataFim: '',
        servidor: '',
        status: '',
        search: ''
    });

    // Carregar despachos do Firebase
    useEffect(() => {
        const despachosRef = collection(db, `artifacts/${appId}/despachos`);
        // Ordenação feita no cliente para garantir critério duplo correto sem índice complexo
        const q = query(despachosRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Ordenar: Data (desc) -> CriadoEm (desc)
            data.sort((a, b) => {
                // Critério 1: Data do despacho
                const dateA = new Date(a.data).getTime();
                const dateB = new Date(b.data).getTime();
                if (dateA !== dateB) return dateB - dateA; // Mais recente primeiro

                // Critério 2: Data de criação (desempate)
                const getTimestamp = (criadoEm) => {
                    // Se criadoEm for null (escrita local pendente), consideramos como "agora" (muito recente)
                    if (criadoEm === null) return Date.now() / 1000 + 999999;
                    // Se criadoEm for undefined (registro antigo), consideramos como 0 (muito antigo)
                    if (criadoEm === undefined) return 0;
                    // Timestamp do Firestore ou Data normal
                    return criadoEm.seconds ? criadoEm.seconds : (new Date(criadoEm).getTime() / 1000);
                };

                const createdA = getTimestamp(a.criadoEm);
                const createdB = getTimestamp(b.criadoEm);

                return createdB - createdA; // Mais recente primeiro
            });

            setDespachos(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Carregar servidores
    useEffect(() => {
        const servidoresRef = collection(db, `artifacts/${appId}/servidores`);
        const unsubscribe = onSnapshot(servidoresRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServidores(data);
        });

        return () => unsubscribe();
    }, []);

    // Filtrar despachos
    const filteredDespachos = useMemo(() => {
        return despachos.filter(d => {
            if (filters.servidor && d.servidorId !== filters.servidor) return false;
            if (filters.status && d.statusFinanceiro !== filters.status) return false;
            if (filters.dataInicio && d.data < filters.dataInicio) return false;
            if (filters.dataFim && d.data > filters.dataFim) return false;
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const matchesSearch =
                    d.origem?.toLowerCase().includes(searchLower) ||
                    d.destino?.toLowerCase().includes(searchLower) ||
                    d.servidorNome?.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }
            return true;
        });
    }, [despachos, filters]);

    // Calcular métricas
    const metrics = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const thisMonthDespachos = despachos.filter(d => {
            const date = new Date(d.data);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const pendente = despachos
            .filter(d => d.statusFinanceiro === 'Pendente' || d.statusFinanceiro === 'Pago Parcial')
            .reduce((sum, d) => sum + (d.custoTotal || 0), 0);

        const pagoMes = thisMonthDespachos
            .filter(d => d.statusFinanceiro === 'Pago Total')
            .reduce((sum, d) => sum + (d.custoTotal || 0), 0);

        return {
            totalPendente: pendente,
            totalPagoMes: pagoMes,
            despachosNoMes: thisMonthDespachos.length,
            servidorMaisUsado: 'Calculando...'
        };
    }, [despachos]);

    const handleEdit = (despacho) => {
        setEditingDespacho(despacho);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este despacho?')) {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/despachos`, id));
            } catch (error) {
                console.error("Erro ao excluir despacho:", error);
                alert("Erro ao excluir. Tente novamente.");
            }
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingDespacho(null);
    };

    const clearFilters = () => {
        setFilters({
            dataInicio: '',
            dataFim: '',
            servidor: '',
            status: '',
            search: ''
        });
    };

    const handleExportPDF = () => {
        // Validar se há servidor selecionado (necessário para o cabeçalho específico)
        // Se não tiver filtro de servidor, tentar inferir se todos os dados são do mesmo servidor
        const uniqueServers = [...new Set(filteredDespachos.map(d => d.servidorId))];
        let targetServer = null;

        if (filters.servidor) {
            targetServer = servidores.find(s => s.id === filters.servidor);
        } else if (uniqueServers.length === 1) {
            targetServer = servidores.find(s => s.id === uniqueServers[0]);
        }

        if (!targetServer) {
            alert("Por favor, selecione um servidor no filtro para gerar o relatório detalhado.");
            return;
        }

        const doc = new jsPDF();

        // --- Cabeçalho ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("TIM Transportes", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // Período
        const periodoStr = (filters.dataInicio && filters.dataFim)
            ? `${formatDateBR(filters.dataInicio)} a ${formatDateBR(filters.dataFim)}`
            : "Completo";
        doc.text(`Período Analisado: ${periodoStr}`, 14, 28);
        doc.text(`Data do Relatório: ${new Date().toLocaleDateString('pt-BR')}`, 14, 33);

        // Dados do Servidor
        doc.setFont("helvetica", "bold");
        doc.text(`Servidor: ${targetServer.nome}`, 14, 43);

        // Unidades de Precificação e Valores
        const units = targetServer.unidadesPrecificacao || {};
        const activeUnits = [];
        if (units.kg?.ativo) activeUnits.push(`Kg (${formatCurrency(units.kg.valor)})`);
        if (units.volume?.ativo) activeUnits.push(`Volume (${formatCurrency(units.volume.valor)})`);
        if (units.palete?.ativo) activeUnits.push(`Palete (${formatCurrency(units.palete.valor)})`);

        doc.setFont("helvetica", "normal");
        doc.text(`Unidade(s) de Precificação: ${activeUnits.join(', ') || 'Nenhuma definida'}`, 14, 48);

        // --- Configuração da Tabela ---
        const usesPalete = units.palete?.ativo;

        const head = [
            ['Data', 'Rota', 'Tipo', 'Vol. Entregues', 'Kg', ...(usesPalete ? ['Paletes'] : []), 'Custo']
        ];

        const body = filteredDespachos.map(d => [
            formatDateBR(d.data),
            `${d.origem} -> ${d.destino}`,
            d.tipoCarga,
            d.volumesEntregues || 0,
            (d.pesoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            ...(usesPalete ? [d.quantidadePaletes || 0] : []),
            formatCurrency(d.custoTotal)
        ]);

        // Totais
        const totalVol = filteredDespachos.reduce((sum, d) => sum + (Number(d.volumesEntregues) || 0), 0);
        const totalKg = filteredDespachos.reduce((sum, d) => sum + (Number(d.pesoTotal) || 0), 0);
        const totalPaletes = filteredDespachos.reduce((sum, d) => sum + (Number(d.quantidadePaletes) || 0), 0);
        const totalCusto = filteredDespachos.reduce((sum, d) => sum + (Number(d.custoTotal) || 0), 0);

        const footerRow = [
            'TOTAL',
            '',
            '',
            totalVol,
            totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            ...(usesPalete ? [totalPaletes] : []),
            formatCurrency(totalCusto)
        ];

        autoTable(doc, {
            startY: 55,
            head: head,
            body: body,
            foot: [footerRow],
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' }, // Indigo
            footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold' }, // Slate-100
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 25 }, // Data
                // Rota auto
                2: { cellWidth: 25 }, // Tipo
                3: { halign: 'right' }, // Vol
                4: { halign: 'right' }, // Kg
                ...(usesPalete ? { 5: { halign: 'right' }, 6: { halign: 'right' } } : { 5: { halign: 'right' } }) // Custo
            }
        });

        // Nome do arquivo
        const fileName = `Relatorio_${targetServer.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    };

    return (
        <div className="space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Pendente"
                    value={formatCurrency(metrics.totalPendente)}
                    icon={Package}
                    color="amber"
                />
                <StatCard
                    title="Pago no Mês"
                    value={formatCurrency(metrics.totalPagoMes)}
                    icon={Package}
                    color="green"
                />
                <StatCard
                    title="Despachos no Mês"
                    value={metrics.despachosNoMes}
                    icon={Package}
                    color="indigo"
                />
                <StatCard
                    title="Servidor Mais Utilizado"
                    value={metrics.servidorMaisUsado}
                    icon={Ship}
                    color="blue"
                />
            </div>

            {/* Filtros e Ações */}
            <Card>
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
                    <div className="flex flex-wrap gap-3 flex-1">
                        {/* Busca */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        {/* Data Início */}
                        <input
                            type="date"
                            value={filters.dataInicio}
                            onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />

                        {/* Data Fim */}
                        <input
                            type="date"
                            value={filters.dataFim}
                            onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />

                        {/* Servidor */}
                        <select
                            value={filters.servidor}
                            onChange={(e) => setFilters({ ...filters, servidor: e.target.value })}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                            <option value="">Todos Servidores</option>
                            {servidores.map(s => (
                                <option key={s.id} value={s.id}>{s.nome}</option>
                            ))}
                        </select>

                        {/* Status */}
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                            <option value="">Todos Status</option>
                            {FINANCIAL_STATUS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>

                        {/* Limpar Filtros */}
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-sm transition-colors flex items-center gap-1"
                        >
                            <RefreshCw size={16} />
                            Limpar
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="secondary" className="gap-2" onClick={handleExportPDF}>
                            <FileDown size={18} />
                            Exportar PDF
                        </Button>
                        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                            <Plus size={18} />
                            Adicionar Despacho
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Tabela de Despachos */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Rota</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Servidor</TableHead>
                        <TableHead className="text-right">Vol. Correios</TableHead>
                        <TableHead className="text-right">Vol. Entregues</TableHead>
                        <TableHead className="text-center">Qtd. Paletes</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-center px-2 w-[80px]">Status</TableHead>
                        <TableHead className="text-center px-2 w-[100px]">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={11} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2 text-slate-500">
                                    <RefreshCw className="animate-spin" size={20} />
                                    Carregando...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : filteredDespachos.length === 0 ? (
                        <TableEmpty
                            message="Nenhum despacho encontrado"
                            icon={Package}
                        />
                    ) : (
                        filteredDespachos.map(despacho => (
                            <TableRow key={despacho.id}>
                                <TableCell className="font-medium">
                                    {formatDateBR(despacho.data)}
                                </TableCell>
                                <TableCell>
                                    <span className="text-slate-800">{despacho.origem}</span>
                                    <span className="text-slate-400 mx-1">→</span>
                                    <span className="text-slate-800">{despacho.destino}</span>
                                </TableCell>
                                <TableCell>
                                    <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-medium">
                                        {despacho.tipoCarga}
                                    </span>
                                </TableCell>
                                <TableCell>{despacho.servidorNome}</TableCell>
                                <TableCell className="text-right">{despacho.volumesCorreios || 0}</TableCell>
                                <TableCell className="text-right">{despacho.volumesEntregues || 0}</TableCell>
                                <TableCell className="text-center">
                                    {despacho.quantidadePaletes > 0 ? despacho.quantidadePaletes : <span className="text-slate-400 text-xs">N/A</span>}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(despacho.custoTotal)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-emerald-600">
                                    {formatCurrency(despacho.receitaEstimada)}
                                </TableCell>
                                <TableCell className="px-2">
                                    <StatusBadge status={despacho.statusFinanceiro} />
                                </TableCell>
                                <TableCell className="px-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => handleEdit(despacho)}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-amber-600"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(despacho.id)}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Modal de Despacho */}
            <DespachoModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                editingDespacho={editingDespacho}
                servidores={servidores}
            />
        </div>
    );
};

export default PainelDespachos;
