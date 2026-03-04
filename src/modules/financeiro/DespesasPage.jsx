import React, { useState, useEffect } from 'react';
import {
    Plus,
    Filter,
    Search,
    DollarSign,
    Layers,
    ListTree,
    Pencil,
    Trash2,
    Calendar,
    Tag
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Button, Card, Input } from '../../components/ui';

import DespesaModal from './modals/DespesaModal';
import CentroCustoModal from './modals/CentroCustoModal';

const DespesasPage = () => {
    const [activeTab, setActiveTab] = useState('lancamentos'); // 'lancamentos' ou 'centroscusto'

    const [despesas, setDespesas] = useState([]);
    const [centrosCusto, setCentrosCusto] = useState([]);

    // Modals state
    const [isDespesaModalOpen, setIsDespesaModalOpen] = useState(false);
    const [editingDespesa, setEditingDespesa] = useState(null);
    const [isSavingDespesa, setIsSavingDespesa] = useState(false);

    const [isCentroModalOpen, setIsCentroModalOpen] = useState(false);
    const [editingCentro, setEditingCentro] = useState(null);
    const [isSavingCentro, setIsSavingCentro] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        // Fetch Despesas (agora usando transacoes tipo saida)
        const despesasRef = collection(db, `artifacts/${appId}/public/data/transacoes`);
        const qDespesas = query(despesasRef, where('tipo', '==', 'saida'));
        const unsubDespesas = onSnapshot(qDespesas, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Order by date descending
            data.sort((a, b) => new Date(b.data) - new Date(a.data));
            setDespesas(data);
        });

        // Fetch Centros Custo
        const centrosRef = collection(db, `artifacts/${appId}/centrosCusto`);
        const unsubCentros = onSnapshot(query(centrosRef), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort N1 first, then N2
            data.sort((a, b) => {
                if (a.tipo === b.tipo) return a.nome.localeCompare(b.nome);
                return a.tipo === 'N1' ? -1 : 1;
            });
            setCentrosCusto(data);
        });

        return () => {
            unsubDespesas();
            unsubCentros();
        };
    }, []);

    // --- MANEJO DE DESPESAS ---
    const handleSaveDespesa = async (payload) => {
        setIsSavingDespesa(true);
        try {
            const dataToSave = {
                ...payload,
                tipo: 'saida',
                origem: 'Admin - Despesas'
            };

            if (payload.id) {
                const { id, ...rest } = dataToSave;
                await updateDoc(doc(db, `artifacts/${appId}/public/data/transacoes`, id), {
                    ...rest,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, `artifacts/${appId}/public/data/transacoes`), {
                    ...dataToSave,
                    createdAt: serverTimestamp()
                });
            }
            setIsDespesaModalOpen(false);
        } catch (error) {
            console.error("Erro ao salvar despesa:", error);
            alert("Erro ao salvar despesa.");
        } finally {
            setIsSavingDespesa(false);
        }
    };

    const handleDeleteDespesa = async (id) => {
        if (!window.confirm("Excluir esta despesa permanentemente?")) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/transacoes`, id));
        } catch (error) {
            console.error(error);
        }
    };

    // --- MANEJO DE CENTROS DE CUSTO ---
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

    const handleDeleteCentro = async (id, tipo) => {
        // Validação básica de exclusão em cascata (não permite excluir se há filhos)
        if (tipo === 'N1') {
            const isUsed = centrosCusto.some(c => c.tipo === 'N2' && c.rateio && c.rateio.some(r => r.parentId === id || r.n1Id === id));
            if (isUsed) {
                alert("Este Nível 1 está atrelado a Nível(eis) 2 (Filhos). Desvincule primeiro para excluir.");
                return;
            }
        } else if (tipo === 'N2') {
            const isUsed = centrosCusto.some(c => c.tipo === 'N3' && c.rateio && c.rateio.some(r => r.parentId === id || r.n1Id === id));
            if (isUsed) {
                alert("Este Nível 2 está atrelado a Nível(eis) 3 (Netos). Desvincule primeiro para excluir.");
                return;
            }
        } else if (tipo === 'N3') {
            const isUsed = centrosCusto.some(c => c.tipo === 'N4' && c.rateio && c.rateio.some(r => r.parentId === id || r.n1Id === id));
            if (isUsed) {
                alert("Este Nível 3 está atrelado a Nível(eis) 4 (Bisnetos). Desvincule primeiro para excluir.");
                return;
            }
        }

        // Validação se tem despesa usando
        const hasDespesas = despesas.some(d => d.rateio && d.rateio.some(r => r.centroCustoId === id));
        if (hasDespesas && !window.confirm("Este centro de custo já tem despesas lançadas nele! A exclusão deixará lançamentos órfãos. Confirmar mesmo assim?")) {
            return;
        } else if (!hasDespesas && !window.confirm("Excluir este Centro de Custo?")) {
            return;
        }

        try {
            await deleteDoc(doc(db, `artifacts/${appId}/centrosCusto`, id));
        } catch (error) {
            console.error(error);
        }
    };

    // Utils
    const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (date) => {
        if (!date) return '-';
        const [y, m, d] = date.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    };

    // Renderizações
    const renderLancamentos = () => {
        const filtered = despesas.filter(d =>
            d.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <Card noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Descrição</th>
                                <th className="px-6 py-4">Categoria</th>
                                <th className="px-6 py-4">Centro(s) de Custo (Rateio)</th>
                                <th className="px-6 py-4 text-right">Valor Total</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">Nenhum lançamento encontrado.</td></tr>
                            ) : filtered.map(d => (
                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{formatDate(d.data)}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{d.descricao}</td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {d.categoria ? <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">{d.categoria}</span> : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {(d.rateio || []).map((r, i) => {
                                                const centro = centrosCusto.find(c => c.id === r.centroCustoId);
                                                return (
                                                    <span key={i} className="text-xs text-slate-500 font-medium bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm inline-flex items-center gap-1 w-max block">
                                                        <Tag size={10} className="text-rose-400" />
                                                        {centro ? centro.nome : 'Centro Deletado'} ({r.percentagem}%)
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-rose-600">{formatCurrency(d.valor)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => { setEditingDespesa(d); setIsDespesaModalOpen(true); }}
                                                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDespesa(d.id)}
                                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        );
    };

    const renderCentrosCusto = () => {
        const filtered = centrosCusto.filter(c => c.nome?.toLowerCase().includes(searchTerm.toLowerCase()));

        return (
            <Card noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Nome do Centro de Custo</th>
                                <th className="px-6 py-4">Atrelado a (Rateio)</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">Nenhum Centro de Custo encontrado.</td></tr>
                            ) : filtered.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {c.tipo === 'N1'
                                            ? <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-black text-xs">N1 (Raiz)</span>
                                            : c.tipo === 'N2'
                                                ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold text-xs">N2 (Filho)</span>
                                                : c.tipo === 'N3'
                                                    ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-xs">N3 (Neto)</span>
                                                    : <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold text-xs">N4 (Bisneto)</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{c.nome}</td>
                                    <td className="px-6 py-4">
                                        {c.tipo === 'N1' ? (
                                            <span className="text-slate-400 italic text-xs">-</span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {(c.rateio || []).map((r, i) => {
                                                    const paren = centrosCusto.find(p => p.id === r.parentId || p.id === r.n1Id);
                                                    return (
                                                        <span key={i} className="text-xs text-slate-600 font-medium bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm inline-block w-max">
                                                            Pai: {paren ? paren.nome : 'Desconhecido'} ({r.percentagem}%)
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => { setEditingCentro(c); setIsCentroModalOpen(true); }}
                                                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCentro(c.id, c.tipo)}
                                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in relative">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center justify-center animate-in slide-in-from-bottom-5 z-[200]">
                    {toastMessage}
                </div>
            )}

            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Despesas</h1>
                    <p className="text-slate-500 mt-1">Lançamentos de gastos operacionais e gestão de Centros de Custos.</p>
                </div>
                <div className="flex gap-3">
                    {activeTab === 'lancamentos' ? (
                        <Button variant="primary" onClick={() => { setEditingDespesa(null); setIsDespesaModalOpen(true); }} className="bg-rose-600 hover:bg-rose-700 shadow-rose-200 hover:shadow-rose-300">
                            <Plus size={18} /> Novo Lançamento
                        </Button>
                    ) : (
                        <Button variant="primary" onClick={() => { setEditingCentro(null); setIsCentroModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300">
                            <Plus size={18} /> Novo Centro Custo
                        </Button>
                    )}
                </div>
            </div>

            {/* Abas */}
            <div className="flex gap-4 border-b border-slate-200">
                <button
                    className={`pb-3 px-2 flex items-center gap-2 font-bold transition-all border-b-2 ${activeTab === 'lancamentos' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setActiveTab('lancamentos')}
                >
                    <DollarSign size={18} />
                    Lançamentos (Despesas)
                </button>
                <button
                    className={`pb-3 px-2 flex items-center gap-2 font-bold transition-all border-b-2 ${activeTab === 'centroscusto' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setActiveTab('centroscusto')}
                >
                    <ListTree size={18} />
                    Cadastro de Centros de Custo
                </button>
            </div>

            {/* Barra de Busca/Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={activeTab === 'lancamentos' ? "Buscar despesa..." : "Buscar centro de custo..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-slate-500 transition-all text-sm font-medium text-slate-700"
                    />
                </div>
                <div className="text-sm text-slate-500 font-medium">
                    {activeTab === 'lancamentos'
                        ? <>Total: <b className="text-slate-700">{despesas.length}</b> despesas cadastradas</>
                        : <>Total: <b className="text-slate-700">{centrosCusto.length}</b> centros de custo</>
                    }
                </div>
            </div>

            {/* Conteúdo Dinâmico das Abas */}
            {activeTab === 'lancamentos' ? renderLancamentos() : renderCentrosCusto()}

            {/* Modais */}
            <DespesaModal
                isOpen={isDespesaModalOpen}
                onClose={() => setIsDespesaModalOpen(false)}
                onSave={handleSaveDespesa}
                editingDespesa={editingDespesa}
                centrosCusto={centrosCusto}
                isSaving={isSavingDespesa}
            />

            <CentroCustoModal
                isOpen={isCentroModalOpen}
                onClose={() => setIsCentroModalOpen(false)}
                onSave={handleSaveCentro}
                editingCentro={editingCentro}
                centrosCusto={centrosCusto}
                isSaving={isSavingCentro}
            />
        </div>
    );
};

export default DespesasPage;
