import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';
import { Button, Input } from '../../../components/ui';

const LinhaReceitaModal = ({ isOpen, onClose }) => {
    const [linhas, setLinhas] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [novaLinha, setNovaLinha] = useState({
        nome: '',
        contratoId: ''
    });

    useEffect(() => {
        if (!isOpen) return;

        // Fetch contratos
        const fetchContratos = async () => {
            const snap = await getDocs(collection(db, `artifacts/${appId}/contratos`));
            setContratos(snap.docs.map(d => ({ id: d.id, nome: d.data().nomeContrato || d.data().contratante })));
        };
        fetchContratos();

        // Subscribe to linhas
        const unsub = onSnapshot(collection(db, `artifacts/${appId}/linhasReceita`), (snap) => {
            setLinhas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => unsub();
    }, [isOpen]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!novaLinha.nome || !novaLinha.contratoId) return;

        setIsLoading(true);
        try {
            const contratoSelecionado = contratos.find(c => c.id === novaLinha.contratoId);
            await addDoc(collection(db, `artifacts/${appId}/linhasReceita`), {
                nome: novaLinha.nome,
                contratoId: novaLinha.contratoId,
                contratoNome: contratoSelecionado?.nome || '',
                createdAt: serverTimestamp()
            });
            setNovaLinha({ ...novaLinha, nome: '' });
        } catch (error) {
            console.error("Erro ao adicionar:", error);
            alert("Erro ao salvar linha.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir esta Linha de Receita? Notas Fiscais vinculadas a ela perderão a associação de linha.")) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/linhasReceita`, id));
        } catch (error) {
            console.error("Erro", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Linhas de Receita</h2>
                        <p className="text-sm text-slate-500">Ex: LTU, FNDE, etc atreladas a contratos.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                    <form onSubmit={handleAdd} className="flex gap-3 items-end">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase">Contrato</label>
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
                                value={novaLinha.contratoId}
                                onChange={e => setNovaLinha({ ...novaLinha, contratoId: e.target.value })}
                                required
                            >
                                <option value="">Selecione...</option>
                                {contratos.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-[2] space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase">Nome da Linha</label>
                            <Input
                                placeholder="Ex: Santarém X Alenquer"
                                value={novaLinha.nome}
                                onChange={e => setNovaLinha({ ...novaLinha, nome: e.target.value })}
                                required
                                className="h-[38px]"
                            />
                        </div>
                        <Button type="submit" disabled={isLoading} className="h-[38px] px-4 font-bold flex gap-2 items-center">
                            <Plus size={16} /> Adicionar
                        </Button>
                    </form>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {linhas.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            Nenhuma linha de receita cadastrada.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {linhas.map(linha => (
                                <div key={linha.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 flex-col sm:flex-row gap-2">
                                    <div>
                                        <p className="font-bold text-slate-700">{linha.nome}</p>
                                        <p className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">
                                            Contrato: {linha.contratoNome}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(linha.id)}
                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LinhaReceitaModal;
