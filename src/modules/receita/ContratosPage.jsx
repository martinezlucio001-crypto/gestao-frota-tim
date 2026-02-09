import React, { useState, useEffect } from 'react';
import {
    Plus,
    FileText,
    Calendar,
    DollarSign,
    MoreVertical,
    Pencil,
    Trash2,
    Truck,
    Ship
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Card, Button, Input } from '../../components/ui';
import ContratoModal from './modals/ContratoModal';

const ContratosPage = () => {
    const [contratos, setContratos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContrato, setEditingContrato] = useState(null);

    // Carregar contratos do Firebase
    useEffect(() => {
        const contratosRef = collection(db, `artifacts/${appId}/contratos`);
        const q = query(contratosRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setContratos(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este contrato?')) {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/contratos`, id));
            } catch (error) {
                console.error("Erro ao excluir contrato:", error);
                alert("Erro ao excluir contrato.");
            }
        }
    };



    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (val) => {
        return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Contratos</h1>
                    <p className="text-slate-500">Gerencie os contratos de prestação de serviços</p>
                </div>
                <Button onClick={() => { setEditingContrato(null); setIsModalOpen(true); }}>
                    <Plus size={20} />
                    Novo Contrato
                </Button>
            </div>



            {/* Lista de Contratos */}
            {isLoading ? (
                <div className="text-center py-20 text-slate-400">Carregando contratos...</div>
            ) : contratos.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Nenhum contrato encontrado</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contratos.map(contrato => (
                        <div key={contrato.id} className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lg transition-all relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                                    <FileText size={24} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setEditingContrato(contrato); setIsModalOpen(true); }}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(contrato.id)}
                                        className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 mb-1">{contrato.nomeContrato || contrato.contratante}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                                    {contrato.unidadePrecificacao}
                                </span>
                                <span>•</span>
                                <span>{formatCurrency(contrato.valorUnitario)} / {contrato.unidadePrecificacao}</span>
                            </div>

                            <div className="space-y-3 text-sm text-slate-600 mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-slate-400" />
                                    <span>Início: <b>{formatDate(contrato.dataInicio)}</b></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-slate-400" />
                                    <span>Término: <b>{formatDate(contrato.dataTermino)}</b></span>
                                </div>
                                {contrato.prorrogavel && (
                                    <div className="pl-6 text-xs text-indigo-600 font-medium">
                                        Prorrogável até {formatDate(contrato.dataProrrogacao)}
                                    </div>
                                )}
                            </div>

                            {/* Resumo de Custos Atribuídos */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Recursos Alocados</p>
                                <div className="flex gap-2">
                                    {contrato.custosAtribuidos?.caminhoes?.length > 0 && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                                            <Truck size={12} /> {contrato.custosAtribuidos.caminhoes.length}
                                        </span>
                                    )}
                                    {contrato.custosAtribuidos?.despacho?.length > 0 && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 px-2 py-1 rounded-lg border border-sky-100">
                                            <Ship size={12} /> {contrato.custosAtribuidos.despacho.length}
                                        </span>
                                    )}
                                    {(!contrato.custosAtribuidos?.caminhoes?.length && !contrato.custosAtribuidos?.despacho?.length) && (
                                        <span className="text-xs text-slate-400 italic">Nenhum recurso específico</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ContratoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingContrato={editingContrato}
            />
        </div>
    );
};

export default ContratosPage;
