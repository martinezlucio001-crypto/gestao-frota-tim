import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { addDoc, updateDoc, doc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';
import { Button, Input } from '../../../components/ui';

const NotaModal = ({ isOpen, onClose, editingNota = null }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [contratos, setContratos] = useState([]);

    const [formData, setFormData] = useState({
        numero: '',
        valor: '',
        dataEmissao: '',
        contratoId: '',
        status: 'pendente', // pendente, parcial, recebido
        recebidoEm: '',
        valorRecebido: ''
    });

    // Load available contracts
    useEffect(() => {
        if (isOpen) {
            const fetchContratos = async () => {
                const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/contratos`));
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    label: doc.data().nomeContrato || doc.data().contratante
                }));
                setContratos(data);
            };
            fetchContratos();
        }
    }, [isOpen]);

    // Init form
    useEffect(() => {
        if (isOpen) {
            if (editingNota) {
                setFormData({
                    numero: editingNota.numero || '',
                    valor: editingNota.valor || '',
                    dataEmissao: editingNota.dataEmissao || '',
                    contratoId: editingNota.contratoId || '',
                    status: editingNota.status || 'pendente',
                    recebidoEm: editingNota.recebidoEm || '',
                    valorRecebido: editingNota.valorRecebido || ''
                });
            } else {
                setFormData({
                    numero: '',
                    valor: '',
                    dataEmissao: new Date().toISOString().split('T')[0],
                    contratoId: '',
                    status: 'pendente',
                    recebidoEm: '',
                    valorRecebido: ''
                });
            }
        }
    }, [isOpen, editingNota]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const selectedContrato = contratos.find(c => c.id === formData.contratoId);

            const payload = {
                ...formData,
                valor: Number(formData.valor),
                valorRecebido: formData.valorRecebido ? Number(formData.valorRecebido) : 0,
                contratoNome: selectedContrato?.label || 'Sem contrato', // Denormalization for easy display
                updatedAt: serverTimestamp()
            };

            if (editingNota) {
                await updateDoc(doc(db, `artifacts/${appId}/notas`, editingNota.id), payload);
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, `artifacts/${appId}/notas`), payload);
            }
            onClose();
        } catch (error) {
            console.error("Erro ao salvar nota:", error);
            alert("Erro ao salvar nota.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {editingNota ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700">Contrato Vinculado</label>
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                            value={formData.contratoId}
                            onChange={e => setFormData({ ...formData, contratoId: e.target.value })}
                            required
                        >
                            <option value="">Selecione um contrato...</option>
                            {contratos.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Número da Nota"
                            placeholder="Ex: 12345"
                            required
                            value={formData.numero}
                            onChange={e => setFormData({ ...formData, numero: e.target.value })}
                        />
                        <Input
                            label="Data de Emissão"
                            type="date"
                            required
                            value={formData.dataEmissao}
                            onChange={e => setFormData({ ...formData, dataEmissao: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Valor Total (R$)"
                        type="number"
                        step="0.01"
                        required
                        value={formData.valor}
                        onChange={e => setFormData({ ...formData, valor: e.target.value })}
                    />

                    {/* Seção de Recebimento (apenas edição ou se desejado) */}
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">Status de Recebimento</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                <select
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="pendente">Pendente</option>
                                    <option value="parcial">Recebido Parcialmente</option>
                                    <option value="recebido">Recebido Totalmente</option>
                                </select>
                            </div>
                            {(formData.status === 'recebido' || formData.status === 'parcial') && (
                                <Input
                                    label="Valor Recebido (R$)"
                                    type="number"
                                    step="0.01"
                                    value={formData.valorRecebido}
                                    onChange={e => setFormData({ ...formData, valorRecebido: e.target.value })}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" className="flex-1" disabled={isLoading}>
                            {isLoading ? 'Salvando...' : 'Salvar Nota'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NotaModal;
