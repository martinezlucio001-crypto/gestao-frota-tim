import React, { useState, useEffect } from 'react';
import {
    Plus,
    Upload,
    FileText,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    AlertCircle,
    Pencil,
    Trash2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Button, Card, Input } from '../../components/ui';
import NotaModal from './modals/NotaModal';

const NotasPage = () => {
    const [notas, setNotas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNota, setEditingNota] = useState(null);

    // Carregar notas
    useEffect(() => {
        const notasRef = collection(db, `artifacts/${appId}/notas`);
        const q = query(notasRef, orderBy('dataEmissao', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotas(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleConfirmReceipt = async (nota, type) => {
        if (!window.confirm(`Confirmar recebimento ${type === 'recebido' ? 'TOTAL' : 'PARCIAL'} da nota ${nota.numero}?`)) return;

        let valorRecebido = nota.valorRecebido || 0;
        if (type === 'recebido') {
            valorRecebido = nota.valor;
        } else {
            const amount = prompt('Informe o valor recebido (R$):', nota.valor - valorRecebido);
            if (!amount) return;
            valorRecebido += Number(amount.replace(',', '.'));
        }

        try {
            await updateDoc(doc(db, `artifacts/${appId}/notas`, nota.id), {
                status: valorRecebido >= nota.valor ? 'recebido' : 'parcial',
                valorRecebido: valorRecebido,
                recebidoEm: new Date().toISOString().split('T')[0],
                updatedAt: serverTimestamp() // Importante: usar serverTimestamp importado
            });
        } catch (error) {
            console.error("Erro ao atualizar recebimento:", error);
            alert("Erro ao salvar.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Excluir esta nota fiscal permanente?')) {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/notas`, id));
            } catch (error) {
                console.error("Erro ao excluir:", error);
            }
        }
    };

    const handleImport = () => {
        alert("Funcionalidade de Importação de Extratos dos Correios em desenvolvimento.\n\nModelo de planilha pendente.");
    };

    const filteredNotas = notas.filter(n =>
        n.numero?.includes(searchTerm) || n.contratoNome?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (date) => {
        if (!date) return '-';
        const [y, m, d] = date.split('-');
        return `${d}/${m}/${y}`;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'recebido': return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold"><CheckCircle2 size={12} /> Pago</span>;
            case 'parcial': return <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-bold"><Clock size={12} /> Parcial</span>;
            default: return <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold"><AlertCircle size={12} /> Pendente</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Notas Fiscais</h1>
                    <p className="text-slate-500">Gerencie as notas emitidas e pagamentos dos Correios</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleImport}>
                        <Upload size={18} /> Importar Extratos
                    </Button>
                    <Button onClick={() => { setEditingNota(null); setIsModalOpen(true); }}>
                        <Plus size={18} /> Nova Nota
                    </Button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por número ou contrato..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm"
                    />
                </div>
                <div className="text-sm text-slate-500 font-medium">
                    Total: <b>{filteredNotas.length}</b> notas
                </div>
            </div>

            {/* Tabela de Notas */}
            <Card noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Emissão</th>
                                <th className="px-6 py-4">Número</th>
                                <th className="px-6 py-4">Contrato</th>
                                <th className="px-6 py-4 text-right">Valor Total</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Recebido</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400">Carregando...</td></tr>
                            ) : filteredNotas.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400">Nenhuma nota encontrada.</td></tr>
                            ) : filteredNotas.map(nota => (
                                <tr key={nota.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-slate-600 font-medium">{formatDate(nota.dataEmissao)}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">#{nota.numero}</td>
                                    <td className="px-6 py-4 text-slate-600">{nota.contratoNome}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-800">{formatCurrency(nota.valor)}</td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(nota.status)}</td>
                                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                                        {nota.valorRecebido > 0 ? formatCurrency(nota.valorRecebido) : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            {nota.status !== 'recebido' && (
                                                <>
                                                    <button
                                                        onClick={() => handleConfirmReceipt(nota, 'recebido')}
                                                        className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                                                        title="Confirmar Recebimento Total"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleConfirmReceipt(nota, 'parcial')}
                                                        className="p-1.5 hover:bg-sky-50 text-slate-400 hover:text-sky-600 rounded-lg transition-colors"
                                                        title="Informar Recebimento Parcial"
                                                    >
                                                        <Clock size={16} />
                                                    </button>
                                                </>
                                            )}
                                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                            <button
                                                onClick={() => { setEditingNota(nota); setIsModalOpen(true); }}
                                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(nota.id)}
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

            <NotaModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingNota={editingNota}
            />
        </div>
    );
};

export default NotasPage;
