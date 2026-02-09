import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign,
    TrendingUp,
    Calendar,
    Filter,
    PieChart,
    BarChart3,
    Scale,
    Settings // Icone para Config
} from 'lucide-react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Card, Input } from '../../components/ui';
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

const ReceitaDashboard = () => {
    const [notas, setNotas] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters State
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1st current year
        end: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0] // Dec 31st current year
    });

    // Multi-select for contracts: Array of IDs. Empty means ALL.
    const [selectedContractIds, setSelectedContractIds] = useState([]);

    // Toggle logic for multi-select
    const toggleContract = (id) => {
        setSelectedContractIds(prev =>
            prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
        );
    };

    // Chart Customization State
    const [chartOptions, setChartOptions] = useState({
        showTotalRealized: true,
        showTotalMeta: true,
        selectedCompareIds: [], // IDs of contracts to show individually
        showIndividualMeta: true // Whether to show the expected bar for individual contracts
    });

    const toggleCompareContract = (id) => {
        setChartOptions(prev => ({
            ...prev,
            selectedCompareIds: prev.selectedCompareIds.includes(id)
                ? prev.selectedCompareIds.filter(mid => mid !== id)
                : [...prev.selectedCompareIds, id]
        }));
    };

    const isAllContracts = selectedContractIds.length === 0 || selectedContractIds.length === contratos.length;

    // Load Data
    useEffect(() => {
        const fetchData = async () => {
            const contratosRef = collection(db, `artifacts/${appId}/contratos`);
            const notasRef = collection(db, `artifacts/${appId}/notas`);

            const [contratosSnap, notasSnap] = await Promise.all([
                getDocs(contratosRef),
                getDocs(notasRef)
            ]);

            setContratos(contratosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Subscribe to Notes live for updates
            onSnapshot(collection(db, `artifacts/${appId}/notas`), (snap) => {
                setNotas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            });
        };
        fetchData();
    }, []);

    // --- UTILS ---
    const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- METRICS CALCULATION ---
    const metrics = useMemo(() => {
        // 1. FILTER DATA
        let filteredNotes = notas.filter(n => {
            if (!n.dataEmissao) return false;
            // Date Range
            if (n.dataEmissao < dateRange.start || n.dataEmissao > dateRange.end) return false;
            // Contract Selection
            if (!isAllContracts && !selectedContractIds.includes(n.contratoId)) return false;
            return true;
        });

        // 2. AGGREGATE METRICS
        const totalReceita = filteredNotes.reduce((sum, n) => sum + (Number(n.valor) || 0), 0);

        // Calculate Quantity (e.g., Kg or Km) based on 'valor' / 'valorUnitario' from contract
        // This requires looking up the contract for each note
        let totalQuantidade = 0;

        // Group by Contract for Pie Chart & List
        const byContract = {};

        filteredNotes.forEach(n => {
            const contract = contratos.find(c => c.id === n.contratoId);
            const name = contract?.nomeContrato || contract?.contratante || n.contratoNome || 'Outros';
            const val = Number(n.valor) || 0;

            // Calculate implied quantity if unit price exists
            if (contract?.valorUnitario > 0) {
                const qtd = val / contract.valorUnitario;
                totalQuantidade += qtd;
            }

            if (!byContract[name]) byContract[name] = { name, value: 0, qtd: 0, unit: contract?.unidadePrecificacao || '-' };
            byContract[name].value += val;
            // Accumulate quantity per contract
            if (contract?.valorUnitario > 0) {
                byContract[name].qtd += (val / contract.valorUnitario);
            }
        });

        const pieData = Object.values(byContract)
            .sort((a, b) => b.value - a.value);

        // 3. BAR CHART DATA (Monthly Realized vs Expected)
        // Helper: Create all months in range
        const byMonth = {};
        const startD = new Date(dateRange.start);
        const endD = new Date(dateRange.end);

        // Iterate month by month
        let currentD = new Date(startD.getFullYear(), startD.getMonth(), 1);
        const lastD = new Date(endD.getFullYear(), endD.getMonth(), 1);

        while (currentD <= lastD) {
            const key = currentD.toISOString().slice(0, 7); // YYYY-MM
            byMonth[key] = { name: key, realizado: 0, esperado: 0 };
            currentD.setMonth(currentD.getMonth() + 1);
        }

        // Calculate "Esperado" (Totals)
        const monthlyExpectedSum = contratos
            .filter(c => isAllContracts || selectedContractIds.includes(c.id))
            .reduce((sum, c) => sum + (Number(c.receitaEsperada) || 0), 0);

        Object.keys(byMonth).forEach(key => {
            byMonth[key].esperado = monthlyExpectedSum;

            // Populate individual values for ALL contracts to allow dynamic chart toggling
            contratos.forEach(c => {
                // Initialize if not exists
                if (byMonth[key][`realizado_${c.id}`] === undefined) {
                    byMonth[key][`realizado_${c.id}`] = 0;
                }
                byMonth[key][`esperado_${c.id}`] = Number(c.receitaEsperada) || 0;
            });
        });

        // Fill with Realized Data (summing up by contract)
        filteredNotes.forEach(n => {
            const key = n.dataEmissao.substring(0, 7); // YYYY-MM
            if (byMonth[key]) {
                byMonth[key].realizado += (Number(n.valor) || 0); // Total Realized

                // Individual Realized
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

        return {
            totalReceita,
            totalQuantidade,
            pieData,
            barData
        };
    }, [notas, contratos, dateRange, selectedContractIds, isAllContracts]);

    if (isLoading) return <div className="p-8 text-center text-slate-400">Carregando painel...</div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            <h1 className="text-3xl font-bold text-slate-800">Painel de Receita</h1>

            {/* --- FILTROS --- */}
            <Card noPadding className="p-4 flex flex-col md:flex-row gap-6 items-start md:items-end">
                {/* Date Range */}
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

                {/* Contract Multi-select Dropdown */}
                <div className="relative group min-w-[250px]">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Filtrar Contratos</label>
                    <button className="w-full flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
                        {isAllContracts ? 'Todos os Contratos' : `${selectedContractIds.length} selecionado(s)`}
                        <Filter size={16} className="text-slate-400" />
                    </button>
                    {/* Dropdown Content */}
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl p-2 hidden group-hover:block z-50 max-h-60 overflow-y-auto">
                        <div
                            className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center gap-2"
                            onClick={() => setSelectedContractIds([])}
                        >
                            <div className={`w-4 h-4 rounded border ${isAllContracts ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}></div>
                            <span className="text-sm font-medium">Todos</span>
                        </div>
                        <div className="h-px bg-slate-100 my-1"></div>
                        {contratos.map(c => (
                            <div
                                key={c.id}
                                className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center gap-2"
                                onClick={() => toggleContract(c.id)}
                            >
                                <div className={`w-4 h-4 rounded border ${selectedContractIds.includes(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}></div>
                                <span className="text-sm truncate" title={c.nomeContrato || c.contratante}>{c.nomeContrato || c.contratante}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            {/* --- KPIs --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-indigo-50 border-indigo-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-indigo-600 uppercase opacity-70">Receita Total (Período)</p>
                            <h3 className="text-3xl font-black text-slate-800">{formatCurrency(metrics.totalReceita)}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="bg-emerald-50 border-emerald-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm">
                            <Scale size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-emerald-600 uppercase opacity-70">Volume Total Realizado</p>
                            <h3 className="text-3xl font-black text-slate-800">
                                {metrics.totalQuantidade.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-lg text-slate-500 font-medium">unidades (mix)</span>
                            </h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* --- GRÁFICOS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Bar Chart: Realizado vs Esperado */}
                {/* Bar Chart: Realizado vs Esperado */}
                <Card className="lg:col-span-2 min-h-[450px] flex flex-col relative overflow-visible">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 size={20} className="text-indigo-600" />
                            Faturamento Mensal: Realizado vs Esperado
                        </h3>

                        {/* CHART SETTINGS DROPDOWN */}
                        <div className="relative group">
                            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                                <Settings size={20} />
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-72 max-h-[400px] overflow-y-auto custom-scrollbar bg-white border border-slate-200 shadow-xl rounded-xl p-4 hidden group-hover:block z-50">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Totais Consolidados</p>
                                <div className="space-y-2 mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={chartOptions.showTotalRealized}
                                            onChange={(e) => setChartOptions({ ...chartOptions, showTotalRealized: e.target.checked })}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Total Realizado</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={chartOptions.showTotalMeta}
                                            onChange={(e) => setChartOptions({ ...chartOptions, showTotalMeta: e.target.checked })}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Total Esperado</span>
                                    </label>
                                </div>

                                <div className="border-t border-slate-100 pt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Comparar Contratos</p>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={chartOptions.showIndividualMeta}
                                                onChange={(e) => setChartOptions({ ...chartOptions, showIndividualMeta: e.target.checked })}
                                                className="rounded text-xs text-indigo-600 focus:ring-indigo-500 scale-75"
                                            />
                                            <span className="text-[10px] text-slate-500">Incluir Metas</span>
                                        </label>
                                    </div>

                                    <div className="space-y-1">
                                        {contratos.map(c => (
                                            <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={chartOptions.selectedCompareIds.includes(c.id)}
                                                    onChange={() => toggleCompareContract(c.id)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs text-slate-600 truncate flex-1">{c.nomeContrato || c.contratante}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="shortName"
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => `R$${val / 1000}k`}
                                />
                                <ReTooltip
                                    cursor={{ fill: '#F1F5F9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value, name) => [formatCurrency(value), name]}
                                    labelFormatter={(label, payload) => payload[0]?.payload.fullName || label}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                {/* Totals */}
                                {chartOptions.showTotalRealized && (
                                    <Bar
                                        dataKey="realizado"
                                        name="Total Realizado"
                                        fill="#6366f1"
                                        radius={[4, 4, 0, 0]}
                                    />
                                )}
                                {chartOptions.showTotalMeta && (
                                    <Bar
                                        dataKey="esperado"
                                        name="Total Esperado"
                                        fill="#e2e8f0"
                                        radius={[4, 4, 0, 0]}
                                    />
                                )}

                                {/* Individual Contracts */}
                                {chartOptions.selectedCompareIds.map((id, index) => {
                                    const contract = contratos.find(c => c.id === id);
                                    if (!contract) return null;
                                    const color = COLORS[index % COLORS.length]; // Rotate colors

                                    return (
                                        <React.Fragment key={id}>
                                            <Bar
                                                dataKey={`realizado_${id}`}
                                                name={`${contract.nomeContrato || contract.contratante} (R)`}
                                                fill={color}
                                                radius={[4, 4, 0, 0]}
                                            />
                                            {chartOptions.showIndividualMeta && (
                                                <Bar
                                                    dataKey={`esperado_${id}`}
                                                    name={`${contract.nomeContrato || contract.contratante} (Meta)`}
                                                    fill={color}
                                                    fillOpacity={0.3} // Lighter for Meta
                                                    stroke={color}
                                                    strokeDasharray="3 3" // Dashed border for Meta
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Pie Chart: Share com detalhe de Quantidade */}
                <Card className="flex flex-col min-h-[450px]">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-indigo-600" />
                        Composição da Receita
                    </h3>
                    <div className="flex-1 w-full h-full relative mb-6">
                        <ResponsiveContainer width="100%" height={260}>
                            <RePieChart>
                                <Pie
                                    data={metrics.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {metrics.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <ReTooltip
                                    formatter={(value) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                            </RePieChart>
                        </ResponsiveContainer>

                        {/* Listagem detalhada */}
                        <div className="flex-1 overflow-y-auto max-h-[150px] space-y-3 pr-2 custom-scrollbar">
                            {metrics.pieData.map((item, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="text-slate-600 truncate max-w-[100px]" title={item.name}>{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800">{formatCurrency(item.value)}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {item.qtd > 0 ? `${item.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${item.unit}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ReceitaDashboard;
