import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign,
    Ship,
    Copy,
    Check,
    CreditCard,
    Calendar,
    ChevronDown,
    ChevronUp,
    RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Button, Card, StatusBadge } from '../../components/ui';
import { formatCurrency, formatDateBR } from '../../lib/utils';
import PagamentoModal from './modals/PagamentoModal';

const PagamentosPage = () => {
    const [despachos, setDespachos] = useState([]);
    const [servidores, setServidores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedServidor, setExpandedServidor] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedServidor, setSelectedServidor] = useState(null);
    const [copiedPix, setCopiedPix] = useState(null);

    // Filtros
    const [filters, setFilters] = useState({
        dataInicio: '',
        dataFim: '',
        status: ''
    });

    // Carregar dados
    useEffect(() => {
        const despachosRef = collection(db, `artifacts/${appId}/despachos`);
        const servidoresRef = collection(db, `artifacts/${appId}/servidores`);

        const unsubDespachos = onSnapshot(query(despachosRef, orderBy('data', 'desc')), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDespachos(data);
            setIsLoading(false);
        });

        const unsubServidores = onSnapshot(servidoresRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServidores(data);
        });

        return () => {
            unsubDespachos();
            unsubServidores();
        };
    }, []);

    // Agrupar despachos por servidor
    const groupedByServidor = useMemo(() => {
        const groups = {};

        despachos.forEach(d => {
            if (!d.servidorId) return;

            // Aplicar filtros
            if (filters.status && d.statusFinanceiro !== filters.status) return;
            if (filters.dataInicio && d.data < filters.dataInicio) return;
            if (filters.dataFim && d.data > filters.dataFim) return;

            if (!groups[d.servidorId]) {
                const servidor = servidores.find(s => s.id === d.servidorId);
                groups[d.servidorId] = {
                    servidor: servidor || { nome: d.servidorNome || 'Desconhecido' },
                    despachos: [],
                    totalDevido: 0,
                    totalPago: 0
                };
            }

            groups[d.servidorId].despachos.push(d);

            // Usar campos de valor pago se disponíveis, ou fallback para lógica antiga baseada em status
            const valorPago = d.valorPago || 0;
            const custo = d.custoTotal || 0;

            if (d.statusFinanceiro === 'Pago Total') {
                groups[d.servidorId].totalPago += custo;
                groups[d.servidorId].totalDevido += 0;
            } else {
                // Se tem valor pago parcial registrado
                if (valorPago > 0) {
                    groups[d.servidorId].totalPago += valorPago;
                    groups[d.servidorId].totalDevido += (custo - valorPago);
                } else {
                    // Sem registro de valor pago
                    groups[d.servidorId].totalPago += 0;
                    groups[d.servidorId].totalDevido += custo;
                }
            }
        });

        return Object.values(groups).sort((a, b) => b.totalDevido - a.totalDevido);
    }, [despachos, servidores, filters]);

    const handleCopyPix = async (pixKey, servidorId) => {
        try {
            await navigator.clipboard.writeText(pixKey);
            setCopiedPix(servidorId);
            setTimeout(() => setCopiedPix(null), 2000);
        } catch (err) {
            console.error('Erro ao copiar:', err);
        }
    };

    const handleOpenPayment = (servidor, despachosPendentes) => {
        setSelectedServidor({ ...servidor, despachosPendentes });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Gestão de Pagamentos</h2>
                <p className="text-slate-500">Controle financeiro por servidor</p>
            </div>

            {/* Filtros */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar size={16} />
                        <span>Período:</span>
                    </div>
                    <input
                        type="date"
                        value={filters.dataInicio}
                        onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                    <span className="text-slate-400">até</span>
                    <input
                        type="date"
                        value={filters.dataFim}
                        onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                        <option value="">Todos Status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Pago Parcial">Pago Parcial</option>
                        <option value="Pago Total">Pago Total</option>
                    </select>
                    <button
                        onClick={() => setFilters({ dataInicio: '', dataFim: '', status: '' })}
                        className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                    >
                        <RefreshCw size={14} />
                        Limpar
                    </button>
                </div>
            </Card>

            {/* Lista de Servidores com Pagamentos */}
            {isLoading ? (
                <Card className="text-center py-12">
                    <RefreshCw className="animate-spin mx-auto text-indigo-600 mb-4" size={32} />
                    <p className="text-slate-500">Carregando pagamentos...</p>
                </Card>
            ) : groupedByServidor.length === 0 ? (
                <Card className="text-center py-12">
                    <DollarSign className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">Nenhum pagamento encontrado</h3>
                    <p className="text-slate-400">Não há despachos correspondentes aos filtros.</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {groupedByServidor.map(group => {
                        const isExpanded = expandedServidor === group.servidor.id;
                        const pixKey = group.servidor.dadosBancarios?.chavePix;
                        const saldo = group.totalDevido;
                        const despachosPendentes = group.despachos.filter(d => d.statusFinanceiro !== 'Pago Total');

                        return (
                            <Card key={group.servidor.id || group.servidor.nome} className="overflow-hidden">
                                {/* Header do Servidor */}
                                <div
                                    className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedServidor(isExpanded ? null : group.servidor.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                                            <Ship className="text-indigo-600" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{group.servidor.nome}</h3>
                                            <p className="text-sm text-slate-500">{group.despachos.length} despacho(s)</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">Total Devido</p>
                                            <p className={`text-lg font-bold ${saldo > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(saldo)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">Total Pago</p>
                                            <p className="text-lg font-bold text-emerald-600">
                                                {formatCurrency(group.totalPago)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {pixKey && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyPix(pixKey, group.servidor.id);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors"
                                                >
                                                    {copiedPix === group.servidor.id ? (
                                                        <>
                                                            <Check size={16} className="text-emerald-600" />
                                                            <span className="text-emerald-600">Copiado!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={16} className="text-slate-500" />
                                                            <span className="text-slate-600">Copiar PIX</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {saldo > 0 && (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenPayment(group.servidor, despachosPendentes);
                                                    }}
                                                    size="sm"
                                                    className="gap-1"
                                                >
                                                    <DollarSign size={16} />
                                                    Pagar
                                                </Button>
                                            )}
                                            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Despachos (Expandido) */}
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-slate-500">
                                                        <th className="pb-3 font-medium">Data</th>
                                                        <th className="pb-3 font-medium">Rota</th>
                                                        <th className="pb-3 font-medium text-right">Volumes</th>
                                                        <th className="pb-3 font-medium text-right">Valor</th>
                                                        <th className="pb-3 font-medium">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.despachos.map(d => (
                                                        <tr key={d.id} className="hover:bg-slate-50">
                                                            <td className="py-3">{formatDateBR(d.data)}</td>
                                                            <td className="py-3">{d.origem} → {d.destino}</td>
                                                            <td className="py-3 text-right">{d.volumesEntregues || 0}</td>
                                                            <td className="py-3 text-right font-medium">{formatCurrency(d.custoTotal)}</td>
                                                            <td className="py-3">
                                                                <StatusBadge
                                                                    status={(d.valorPago > 0 || d.statusFinanceiro === 'Pago Total') ? d.statusFinanceiro : 'Pendente'}
                                                                    size="sm"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal de Pagamento */}
            <PagamentoModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedServidor(null);
                }}
                servidor={selectedServidor}
            />
        </div>
    );
};

export default PagamentosPage;
