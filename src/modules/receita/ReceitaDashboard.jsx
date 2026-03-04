import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Filter,
    PieChart,
    BarChart3,
    Scale,
    Settings,
    TrendingDown,
    Activity
} from 'lucide-react';
import { collection, onSnapshot, getDocs, doc, addDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Card, Input } from '../../components/ui';
import NetworkGraph from '../financeiro/components/NetworkGraph';
import CentroCustoModal from '../financeiro/modals/CentroCustoModal';
import {
    PieChart as RePieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as ReTooltip,
    BarChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend
} from 'recharts';

/* CORES HARMONIOSAS */
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
const EXPENSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#d946ef', '#8b5cf6', '#06b6d4'];

const ReceitaDashboard = () => {
    // --- ESTADOS DE DADOS ---
    const [notas, setNotas] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [despesas, setDespesas] = useState([]);
    const [centrosCusto, setCentrosCusto] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- ESTADOS DO MODAL DE CENTRO DE CUSTO ---
    const [isCentroModalOpen, setIsCentroModalOpen] = useState(false);
    const [editingCentro, setEditingCentro] = useState(null);
    const [initialCentroData, setInitialCentroData] = useState(null);
    const [isSavingCentro, setIsSavingCentro] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    // --- FILTROS RECEITAS ---
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
    });
    const [selectedContractIds, setSelectedContractIds] = useState([]);

    const toggleContract = (id) => {
        setSelectedContractIds(prev =>
            prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
        );
    };

    const isAllContracts = selectedContractIds.length === 0 || selectedContractIds.length === contratos.length;

    // --- HANDLERS DO GRAFICO DE CENTROS DE CUSTO ---
    const handleEditNode = (nodeData) => {
        setEditingCentro(nodeData);
        setInitialCentroData(null);
        setIsCentroModalOpen(true);
    };

    const handleAddChildNode = (parentNodeData) => {
        let childType = 'N2';
        if (parentNodeData.tipo === 'N2') childType = 'N3';
        if (parentNodeData.tipo === 'N3') childType = 'N4';

        setEditingCentro(null);
        setInitialCentroData({
            tipo: childType,
            rateio: [{ parentId: parentNodeData.id, percentagem: '100' }]
        });
        setIsCentroModalOpen(true);
    };

    const handleSaveCentro = async (payload) => {
        setIsSavingCentro(true);
        try {
            if (payload.id) {
                const { id, ...dataToSave } = payload;
                await updateDoc(doc(db, `artifacts/${appId}/centrosCusto`, id), {
                    ...dataToSave,
                    updatedAt: serverTimestamp()
                });
                setIsCentroModalOpen(false);
            } else {
                await addDoc(collection(db, `artifacts/${appId}/centrosCusto`), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
                setToastMessage("Centro de Custo criado com sucesso!");
                setTimeout(() => setToastMessage(""), 4000);
            }
            return true;
        } catch (error) {
            console.error("Erro ao salvar centro:", error);
            alert("Erro ao salvar.");
            return false;
        } finally {
            setIsSavingCentro(false);
        }
    };


    // --- FILTROS DESPESAS ---
    const [dateRangeDespesas, setDateRangeDespesas] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
    });

    // --- OPÇÕES DOS GRÁFICOS ---
    const [chartOptions, setChartOptions] = useState({
        showTotalRealized: true,
        showTotalMeta: true,
        selectedCompareIds: [],
        showIndividualMeta: true
    });

    const [chartOptionsDespesas, setChartOptionsDespesas] = useState({
        showTotalRealized: true
    });

    const toggleCompareContract = (id) => {
        setChartOptions(prev => ({
            ...prev,
            selectedCompareIds: prev.selectedCompareIds.includes(id)
                ? prev.selectedCompareIds.filter(mid => mid !== id)
                : [...prev.selectedCompareIds, id]
        }));
    };

    // --- CARREGAMENTO DE DADOS ---
    useEffect(() => {
        const fetchData = async () => {
            const contratosRef = collection(db, `artifacts/${appId}/contratos`);
            const contratosSnap = await getDocs(contratosRef);
            setContratos(contratosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Subscribe to Notas
            const unsubNotas = onSnapshot(collection(db, `artifacts/${appId}/notas`), (snap) => {
                setNotas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Subscribe to Despesas
            const qDespesas = query(collection(db, `artifacts/${appId}/public/data/transacoes`), where('tipo', '==', 'saida'));
            const unsubDespesas = onSnapshot(qDespesas, (snap) => {
                setDespesas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Subscribe to Centros de Custo
            const unsubCentros = onSnapshot(collection(db, `artifacts/${appId}/centrosCusto`), (snap) => {
                setCentrosCusto(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            });

            return () => {
                unsubNotas();
                unsubDespesas();
                unsubCentros();
            };
        };
        fetchData();
    }, []);

    // --- UTILS ---
    const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ==========================================
    // MÉTRICAS DE RECEITAS
    // ==========================================
    const metrics = useMemo(() => {
        let filteredNotes = notas.filter(n => {
            if (!n.dataEmissao) return false;
            if (n.dataEmissao < dateRange.start || n.dataEmissao > dateRange.end) return false;
            if (!isAllContracts && !selectedContractIds.includes(n.contratoId)) return false;
            return true;
        });

        const totalReceita = filteredNotes.reduce((sum, n) => sum + (Number(n.valor) || 0), 0);
        let totalQuantidade = 0;
        const byContract = {};

        filteredNotes.forEach(n => {
            const contract = contratos.find(c => c.id === n.contratoId);
            const name = contract?.nomeContrato || contract?.contratante || n.contratoNome || 'Outros';
            const val = Number(n.valor) || 0;

            if (contract?.valorUnitario > 0) {
                const qtd = val / contract.valorUnitario;
                totalQuantidade += qtd;
            }

            if (!byContract[name]) byContract[name] = { name, value: 0, qtd: 0, unit: contract?.unidadePrecificacao || '-' };
            byContract[name].value += val;
            if (contract?.valorUnitario > 0) {
                byContract[name].qtd += (val / contract.valorUnitario);
            }
        });

        const pieData = Object.values(byContract).sort((a, b) => b.value - a.value);

        const byMonth = {};
        const startD = new Date(dateRange.start);
        const endD = new Date(dateRange.end);
        let currentD = new Date(startD.getFullYear(), startD.getMonth(), 1);
        const lastD = new Date(endD.getFullYear(), endD.getMonth(), 1);

        while (currentD <= lastD) {
            const key = currentD.toISOString().slice(0, 7);
            byMonth[key] = { name: key, realizado: 0, esperado: 0 };
            currentD.setMonth(currentD.getMonth() + 1);
        }

        const monthlyExpectedSum = contratos
            .filter(c => isAllContracts || selectedContractIds.includes(c.id))
            .reduce((sum, c) => sum + (Number(c.receitaEsperada) || 0), 0);

        Object.keys(byMonth).forEach(key => {
            byMonth[key].esperado = monthlyExpectedSum;
            contratos.forEach(c => {
                if (byMonth[key][`realizado_${c.id}`] === undefined) {
                    byMonth[key][`realizado_${c.id}`] = 0;
                }
                byMonth[key][`esperado_${c.id}`] = Number(c.receitaEsperada) || 0;
            });
        });

        filteredNotes.forEach(n => {
            const key = n.dataEmissao.substring(0, 7);
            if (byMonth[key]) {
                byMonth[key].realizado += (Number(n.valor) || 0);
                if (n.contratoId) {
                    byMonth[key][`realizado_${n.contratoId}`] = (byMonth[key][`realizado_${n.contratoId}`] || 0) + (Number(n.valor) || 0);
                }
            }
        });

        const barData = Object.values(byMonth)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(item => {
                const [y, m] = item.name.split('-');
                const date = new Date(Number(y), Number(m) - 1, 1);
                return {
                    ...item,
                    fullName: date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
                    shortName: date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
                };
            });

        return { totalReceita, totalQuantidade, pieData, barData };
    }, [notas, contratos, dateRange, selectedContractIds, isAllContracts]);

    // ==========================================
    // MÉTRICAS DE DESPESAS
    // ==========================================
    const metricsDespesas = useMemo(() => {
        let filteredDespesas = despesas.filter(d => {
            const date = d.dataEmissao || d.dataVencimento || d.dataPagamento || d.data;
            if (!date) return false;
            // Garantir que a data está no range correto (slice(0,10) para YYYY-MM-DD caso seja datetime completo)
            const dateOnly = date.substring(0, 10);
            if (dateOnly < dateRangeDespesas.start || dateOnly > dateRangeDespesas.end) return false;
            return true;
        });

        const totalDespesas = filteredDespesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
        const totalQuantidade = filteredDespesas.length;

        const byCategory = {};
        filteredDespesas.forEach(d => {
            const name = d.categoria || d.tipo || 'Outras Despesas';
            const val = Number(d.valor) || 0;
            if (!byCategory[name]) byCategory[name] = { name, value: 0 };
            byCategory[name].value += val;
        });

        const pieData = Object.values(byCategory).sort((a, b) => b.value - a.value);

        const byMonth = {};
        const startD = new Date(dateRangeDespesas.start);
        const endD = new Date(dateRangeDespesas.end);
        let currentD = new Date(startD.getFullYear(), startD.getMonth(), 1);
        const lastD = new Date(endD.getFullYear(), endD.getMonth(), 1);

        while (currentD <= lastD) {
            const key = currentD.toISOString().slice(0, 7);
            byMonth[key] = { name: key, realizado: 0 };
            currentD.setMonth(currentD.getMonth() + 1);
        }

        filteredDespesas.forEach(d => {
            const date = d.dataEmissao || d.dataVencimento || d.dataPagamento || d.data;
            const key = date.substring(0, 7);
            if (byMonth[key]) {
                byMonth[key].realizado += (Number(d.valor) || 0);
            }
        });

        const barData = Object.values(byMonth)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(item => {
                const [y, m] = item.name.split('-');
                const date = new Date(Number(y), Number(m) - 1, 1);
                return {
                    ...item,
                    fullName: date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
                    shortName: date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
                };
            });

        return { totalDespesas, totalQuantidade, pieData, barData };
    }, [despesas, dateRangeDespesas]);

    if (isLoading) return <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[60vh]"><p>Carregando painel financeiro...</p></div>;

    return (
        <div className="space-y-12 animate-in fade-in pb-12">
            <div className="border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel Financeiro</h1>
                <p className="text-slate-500 mt-1">Visão geral interativa de receitas, despesas e centros de custo.</p>
            </div>

            {/* =========================================
                SEÇÃO: RECEITAS
            ========================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-indigo-100 pb-3">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <TrendingUp size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Receitas</h2>
                </div>

                {/* Filtros de Receita */}
                <div className="absolute top-0 right-0 w-full md:w-auto">
                    {toastMessage && (
                        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center justify-center animate-in slide-in-from-bottom-5 z-[200]">
                            {toastMessage}
                        </div>
                    )}
                </div>

                <Card noPadding className="p-4 flex flex-col md:flex-row gap-6 items-start md:items-end bg-white border border-slate-200/60 shadow-sm">
                    <div className="flex gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Início</label>
                            <input
                                type="date"
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fim</label>
                            <input
                                type="date"
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="relative group min-w-[250px]">
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Filtrar Contratos</label>
                        <button className="w-full flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
                            {isAllContracts ? 'Todos os Contratos' : `${selectedContractIds.length} selecionado(s)`}
                            <Filter size={16} className="text-slate-400" />
                        </button>
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl p-2 hidden group-hover:block z-50 max-h-60 overflow-y-auto">
                            <div className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center gap-2" onClick={() => setSelectedContractIds([])}>
                                <div className={`w-4 h-4 rounded border ${isAllContracts ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}></div>
                                <span className="text-sm font-medium">Todos</span>
                            </div>
                            <div className="h-px bg-slate-100 my-1"></div>
                            {contratos.map(c => (
                                <div key={c.id} className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center gap-2" onClick={() => toggleContract(c.id)}>
                                    <div className={`w-4 h-4 rounded border ${selectedContractIds.includes(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}></div>
                                    <span className="text-sm truncate" title={c.nomeContrato || c.contratante}>{c.nomeContrato || c.contratante}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* KPIs de Receita */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-indigo-600/80 uppercase tracking-wider">Receita Total</p>
                                <h3 className="text-3xl font-black text-slate-800">{formatCurrency(metrics.totalReceita)}</h3>
                            </div>
                        </div>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                                <Scale size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-emerald-600/80 uppercase tracking-wider">Volume Realizado</p>
                                <h3 className="text-3xl font-black text-slate-800">
                                    {metrics.totalQuantidade.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-lg text-slate-500 font-medium">unidades (mix)</span>
                                </h3>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Gráficos de Receita */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 min-h-[450px] flex flex-col relative overflow-visible shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <BarChart3 size={20} className="text-indigo-600" />
                                Faturamento Mensal: Realizado vs Esperado
                            </h3>
                            <div className="relative group">
                                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                                    <Settings size={20} />
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-72 max-h-[400px] overflow-y-auto custom-scrollbar bg-white border border-slate-200 shadow-xl rounded-xl p-4 hidden group-hover:block z-50">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-3">Totais Consolidados</p>
                                    <div className="space-y-2 mb-4">
                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                            <input type="checkbox" checked={chartOptions.showTotalRealized} onChange={(e) => setChartOptions({ ...chartOptions, showTotalRealized: e.target.checked })} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm font-medium text-slate-700">Total Realizado</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                            <input type="checkbox" checked={chartOptions.showTotalMeta} onChange={(e) => setChartOptions({ ...chartOptions, showTotalMeta: e.target.checked })} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                            <span className="text-sm font-medium text-slate-700">Total Esperado</span>
                                        </label>
                                    </div>
                                    <div className="border-t border-slate-100 pt-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-bold text-slate-400 uppercase">Comparar Contratos</p>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="checkbox" checked={chartOptions.showIndividualMeta} onChange={(e) => setChartOptions({ ...chartOptions, showIndividualMeta: e.target.checked })} className="rounded text-xs text-indigo-600 focus:ring-indigo-500 scale-75" />
                                                <span className="text-[10px] text-slate-500">Incluir Metas</span>
                                            </label>
                                        </div>
                                        <div className="space-y-1">
                                            {contratos.map(c => (
                                                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                                                    <input type="checkbox" checked={chartOptions.selectedCompareIds.includes(c.id)} onChange={() => toggleCompareContract(c.id)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                                    <span className="text-xs text-slate-600 truncate flex-1">{c.nomeContrato || c.contratante}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full h-[350px]">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={metrics.barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="shortName" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val / 1000}k`} />
                                    <ReTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={(label, payload) => payload[0]?.payload.fullName || label} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {chartOptions.showTotalRealized && <Bar dataKey="realizado" name="Total Realizado" fill="#6366f1" radius={[4, 4, 0, 0]} />}
                                    {chartOptions.showTotalMeta && <Bar dataKey="esperado" name="Total Esperado" fill="#e2e8f0" radius={[4, 4, 0, 0]} />}
                                    {chartOptions.selectedCompareIds.map((id, index) => {
                                        const contract = contratos.find(c => c.id === id);
                                        if (!contract) return null;
                                        const color = COLORS[index % COLORS.length];
                                        return (
                                            <React.Fragment key={id}>
                                                <Bar dataKey={`realizado_${id}`} name={`${contract.nomeContrato || contract.contratante} (R)`} fill={color} radius={[4, 4, 0, 0]} />
                                                {chartOptions.showIndividualMeta && <Bar dataKey={`esperado_${id}`} name={`${contract.nomeContrato || contract.contratante} (Meta)`} fill={color} fillOpacity={0.3} stroke={color} strokeDasharray="3 3" radius={[4, 4, 0, 0]} />}
                                            </React.Fragment>
                                        );
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="flex flex-col min-h-[450px] shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <PieChart size={20} className="text-indigo-600" />
                            Composição da Receita
                        </h3>
                        <div className="flex-1 w-full relative h-[300px] mb-6">
                            <ResponsiveContainer width="100%" height={300}>
                                <RePieChart>
                                    <Pie data={metrics.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                                        {metrics.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <ReTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                </RePieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 overflow-y-auto max-h-[150px] space-y-3 pr-2 custom-scrollbar">
                                {metrics.pieData.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                            <span className="text-slate-600 truncate max-w-[100px]" title={item.name}>{item.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-800">{formatCurrency(item.value)}</p>
                                            <p className="text-[10px] text-slate-400">{item.qtd > 0 ? `${item.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${item.unit}` : ''}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            {/* =========================================
                SEÇÃO: DESPESAS
            ========================================= */}
            <section className="space-y-6 pt-10 border-t border-slate-200">
                <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
                    <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                        <TrendingDown size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Despesas</h2>
                </div>

                {/* Filtros de Despesas */}
                <Card noPadding className="p-4 flex flex-col md:flex-row gap-6 items-start md:items-end bg-white border border-slate-200/60 shadow-sm">
                    <div className="flex gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Início</label>
                            <input
                                type="date"
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                value={dateRangeDespesas.start}
                                onChange={(e) => setDateRangeDespesas({ ...dateRangeDespesas, start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fim</label>
                            <input
                                type="date"
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                value={dateRangeDespesas.end}
                                onChange={(e) => setDateRangeDespesas({ ...dateRangeDespesas, end: e.target.value })}
                            />
                        </div>
                    </div>
                </Card>

                {/* KPIs de Despesas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-gradient-to-br from-rose-50 to-white border-rose-100">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-200">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-rose-600/80 uppercase tracking-wider">Despesa Total</p>
                                <h3 className="text-3xl font-black text-slate-800">{formatCurrency(metricsDespesas.totalDespesas)}</h3>
                            </div>
                        </div>
                    </Card>
                    <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-600 rounded-xl text-white shadow-lg shadow-slate-200">
                                <Activity size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-600/80 uppercase tracking-wider">Qtd Registros</p>
                                <h3 className="text-3xl font-black text-slate-800">
                                    {metricsDespesas.totalQuantidade} <span className="text-lg text-slate-500 font-medium">lançamentos</span>
                                </h3>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Gráficos de Despesas */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 min-h-[450px] flex flex-col relative overflow-visible shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <BarChart3 size={20} className="text-rose-600" />
                                Histórico Mensal: Despesas
                            </h3>
                        </div>
                        <div className="flex-1 w-full h-[350px]">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={metricsDespesas.barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="shortName" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val / 1000}k`} />
                                    <ReTooltip cursor={{ fill: '#FFF1F2' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={(label, payload) => payload[0]?.payload.fullName || label} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {chartOptionsDespesas.showTotalRealized && <Bar dataKey="realizado" name="Total Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="flex flex-col min-h-[450px] shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <PieChart size={20} className="text-rose-600" />
                            Composição das Despesas
                        </h3>
                        {metricsDespesas.pieData.length > 0 ? (
                            <div className="flex-1 w-full relative min-h-[300px] mb-6">
                                <ResponsiveContainer width="100%" height={350}>
                                    <RePieChart>
                                        <Pie data={metricsDespesas.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                                            {metricsDespesas.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />)}
                                        </Pie>
                                        <ReTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    </RePieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 overflow-y-auto max-h-[150px] space-y-3 pr-2 custom-scrollbar">
                                    {metricsDespesas.pieData.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }}></div>
                                                <span className="text-slate-600 truncate max-w-[150px]" title={item.name}>{item.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-800">{formatCurrency(item.value)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                                Nenhuma despesa registrada no período.
                            </div>
                        )}
                    </Card>
                </div>
            </section>

            {/* =========================================
                SEÇÃO: CENTROS DE CUSTO
            ========================================= */}
            <section className="space-y-6 pt-10 border-t border-slate-200">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                        <PieChart size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Gráfico de Centros de Custos</h2>
                </div>

                <Card noPadding className="h-[600px] bg-white border border-slate-200 shadow-sm relative overflow-hidden rounded-2xl">
                    <NetworkGraph
                        centrosCusto={centrosCusto}
                        despesas={despesas}
                        dateRange={dateRangeDespesas}
                        onEditNode={handleEditNode}
                        onAddChildNode={handleAddChildNode}
                    />
                </Card>
            </section>

            <CentroCustoModal
                isOpen={isCentroModalOpen}
                onClose={() => setIsCentroModalOpen(false)}
                onSave={handleSaveCentro}
                editingCentro={editingCentro}
                initialData={initialCentroData}
                centrosCusto={centrosCusto}
                isSaving={isSavingCentro}
            />
        </div>
    );
};

export default ReceitaDashboard;
