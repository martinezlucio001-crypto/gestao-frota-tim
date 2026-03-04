import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Download
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Card, Button } from '../../components/ui';

const ExtratoPage = () => {
    const [transacoes, setTransacoes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });
    const [filtroTipo, setFiltroTipo] = useState('TODOS'); // TODOS, RECEITAS, DESPESAS
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const transacoesRef = collection(db, `artifacts/${appId}/public/data/transacoes`);
        const q = query(transacoesRef, orderBy('data', 'desc'));

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransacoes(data);
            setIsLoading(false);
        });

        return () => unsub();
    }, []);

    // Função auxiliar para processar e filtrar os dados localmente (reduz leituras no banco)
    const filteredTransacoes = transacoes.filter(t => {
        // Filtro Data
        const tDate = t.data;
        if (tDate < dateRange.start || tDate > dateRange.end) return false;

        // Filtro Tipo
        if (filtroTipo === 'RECEITAS' && t.tipo !== 'entrada') return false;
        if (filtroTipo === 'DESPESAS' && t.tipo !== 'saida') return false;

        // Buscador em texto
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                t.descricao?.toLowerCase().includes(term) ||
                t.categoria?.toLowerCase().includes(term) ||
                t.centroCusto?.toLowerCase().includes(term)
            );
        }

        return true;
    });

    const totais = filteredTransacoes.reduce((acc, curr) => {
        if (curr.tipo === 'entrada') acc.entradas += Number(curr.valor);
        else acc.saidas += Number(curr.valor);
        return acc;
    }, { entradas: 0, saidas: 0 });

    const saldo = totais.entradas - totais.saidas;

    const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (d) => {
        if (!d) return '-';
        const [y, m, da] = d.split('-');
        return `${da}/${m}/${y}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Cabecalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Extrato Financeiro</h1>
                    <p className="text-slate-500">Livro-Razão integrado com entradas e saídas de todos os módulos.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => alert('Em breve poderemos exportar este extrato em PDF/Excel.')}>
                        <Download size={18} /> Exportar
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-sm">
                    <h3 className="text-sm font-bold text-indigo-600/80 uppercase">Saldo do Período</h3>
                    <p className={`text-3xl font-black mt-2 ${saldo >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {formatCurrency(saldo)}
                    </p>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm">
                    <h3 className="text-sm font-bold text-emerald-600/80 uppercase">Total Entradas</h3>
                    <p className="text-3xl font-black mt-2 text-emerald-600">
                        {formatCurrency(totais.entradas)}
                    </p>
                </Card>
                <Card className="bg-gradient-to-br from-rose-50 to-white border-rose-100 shadow-sm">
                    <h3 className="text-sm font-bold text-rose-600/80 uppercase">Total Saídas</h3>
                    <p className="text-3xl font-black mt-2 text-rose-600">
                        {formatCurrency(totais.saidas)}
                    </p>
                </Card>
            </div>

            {/* Filtros */}
            <Card noPadding className="p-4 bg-white border border-slate-200/60 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full max-w-sm relative">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Buscar Transação</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por descrição, categoria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Início</label>
                    <input
                        type="date"
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 h-[38px]"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fim</label>
                    <input
                        type="date"
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 h-[38px]"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    />
                </div>

                <div className="bg-slate-100 p-1 rounded-xl flex items-center h-[38px]">
                    <button
                        onClick={() => setFiltroTipo('TODOS')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === 'TODOS' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setFiltroTipo('RECEITAS')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === 'RECEITAS' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-emerald-600'}`}
                    >
                        Extradas
                    </button>
                    <button
                        onClick={() => setFiltroTipo('DESPESAS')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === 'DESPESAS' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-rose-600'}`}
                    >
                        Saídas
                    </button>
                </div>
            </Card>

            {/* Tabela de Transações */}
            <Card noPadding className="overflow-hidden bg-white shadow-sm border border-slate-200/60">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                <th className="p-4 w-40">Data</th>
                                <th className="p-4 w-48">Categoria</th>
                                <th className="p-4">Descrição</th>
                                <th className="p-4 w-64">Centro de Custo / Rec.</th>
                                <th className="p-4 text-right w-40">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">
                                        No momento buscando transações...
                                    </td>
                                </tr>
                            ) : filteredTransacoes.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-slate-500">
                                        Nenhuma transação financeira encontrada neste período.
                                        {/* Futuramente Adicione um texto instrucional aqui para ensinar que os despachos alimentam isso etc. */}
                                    </td>
                                </tr>
                            ) : (
                                filteredTransacoes.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4 text-sm text-slate-600 font-medium">
                                            {formatDate(t.data)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${t.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                'bg-rose-50 text-rose-700 border border-rose-100'
                                                }`}>
                                                {t.categoria}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-700">{t.descricao}</p>
                                            {t.origemRef && (
                                                <p className="text-xs text-slate-400 mt-0.5">Ref: {t.origemRef}</p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-medium">
                                                {t.centroCusto || 'Geral'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-black text-sm flex items-center justify-end gap-1 ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'
                                                }`}>
                                                {t.tipo === 'entrada' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                {formatCurrency(t.valor)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default ExtratoPage;
