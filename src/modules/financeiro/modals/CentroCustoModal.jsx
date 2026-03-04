import React, { useState, useEffect } from 'react';
import { Layers, HelpCircle, X, PlusCircle, Trash2 } from 'lucide-react';
import { Button, Input } from '../../../components/ui';

const ModalBackdrop = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-opacity duration-300">
        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {children}
        </div>
        <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
);

const CentroCustoModal = ({ isOpen, onClose, onSave, editingCentro = null, initialData = null, centrosCusto = [], isSaving }) => {
    const [formData, setFormData] = useState({
        nome: '',
        tipo: 'N1', // N1, N2, N3, N4
        rateio: [] // [{ parentId: '', percentagem: '' }]
    });

    useEffect(() => {
        if (isOpen) {
            if (editingCentro) {
                setFormData({
                    nome: editingCentro.nome || '',
                    tipo: editingCentro.tipo || 'N1',
                    rateio: editingCentro.rateio || []
                });
            } else if (initialData) {
                setFormData({
                    nome: '',
                    tipo: initialData.tipo,
                    rateio: initialData.rateio
                });
            } else {
                setFormData({
                    nome: '',
                    tipo: 'N1',
                    rateio: []
                });
            }
        }
    }, [isOpen, editingCentro, initialData]);

    if (!isOpen) return null;

    const autoSplitRateio = (rateios) => {
        const count = rateios.length;
        if (count === 0) return rateios;
        const equalPart = Number((100 / count).toFixed(2));
        const firstPart = Number((100 - (equalPart * (count - 1))).toFixed(2));
        return rateios.map((r, i) => ({
            ...r,
            percentagem: String(i === 0 ? firstPart : equalPart)
        }));
    };

    const handleAddRateio = () => {
        setFormData(prev => {
            const newRateio = [...prev.rateio, { parentId: '', percentagem: '' }];
            return { ...prev, rateio: autoSplitRateio(newRateio) };
        });
    };

    const handleRemoveRateio = (index) => {
        setFormData(prev => {
            const newRateio = prev.rateio.filter((_, i) => i !== index);
            return { ...prev, rateio: autoSplitRateio(newRateio) };
        });
    };

    const handleRateioChange = (index, field, value) => {
        const newRateio = [...formData.rateio];
        newRateio[index][field] = value;
        setFormData(prev => ({ ...prev, rateio: newRateio }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const payload = { ...formData };
        if (payload.tipo !== 'N1') {
            if (payload.rateio.length === 0) {
                alert("Adicione pelo menos um Centro de Custo Pai para o rateio.");
                return;
            }

            let totalPercent = 0;
            const formattedRateio = [];
            for (const r of payload.rateio) {
                // Support legacy data that might still use n1Id instead of just keeping it clean
                const targetId = r.parentId || r.n1Id;
                if (!targetId) {
                    alert("Selecione qual o Centro de Custo pai.");
                    return;
                }
                const pct = Number(r.percentagem) || 0;
                totalPercent += pct;
                formattedRateio.push({ parentId: targetId, percentagem: pct });
            }

            // Opcional: Apenas avisamos se não der 100%, mas não impedimos se ele quer ser "flexível"
            if (totalPercent !== 100) {
                const conf = window.confirm(`O rateio total está dando ${totalPercent}%. Deseja continuar mesmo assim?`);
                if (!conf) return;
            }

            payload.rateio = formattedRateio;
        } else {
            payload.rateio = []; // N1 doesn't have rateio
        }

        onSave(payload);
    };

    const parentOptions = centrosCusto.filter(c => {
        if (formData.tipo === 'N2') return c.tipo === 'N1';
        if (formData.tipo === 'N3') return c.tipo === 'N2';
        if (formData.tipo === 'N4') return c.tipo === 'N3';
        return false;
    });

    const getParentLabel = () => {
        if (formData.tipo === 'N2') return 'Nível 1 (Raiz)';
        if (formData.tipo === 'N3') return 'Nível 2 (Filho)';
        if (formData.tipo === 'N4') return 'Nível 3 (Neto)';
        return 'Pai';
    };

    return (
        <ModalBackdrop onClose={onClose}>
            <div className={`p-8 border-b border-slate-100 ${editingCentro ? 'bg-amber-50/50' : 'bg-slate-50/50'} flex justify-between items-center flex-shrink-0 relative`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors z-10"
                >
                    <X size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 pr-8">{editingCentro ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</h2>
                    <p className="text-sm text-slate-500 mt-1">Crie Nível 1 (raízes) e Nível 2 (dependentes).</p>
                </div>
                <div className={`p-2 rounded-full hidden sm:block ${editingCentro ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Layers size={24} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar">
                <fieldset disabled={isSaving}>
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Hierarquia</label>
                        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
                            <button
                                type="button"
                                disabled={editingCentro != null}
                                onClick={() => setFormData({ ...formData, tipo: 'N1', rateio: [] })}
                                className={`flex-1 min-w-[100px] py-2 text-sm font-semibold rounded-lg transition-all ${formData.tipo === 'N1' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${editingCentro ? 'disabled:opacity-50' : ''}`}
                            >
                                N1 (Raiz)
                            </button>
                            <button
                                type="button"
                                disabled={editingCentro != null}
                                onClick={() => setFormData({ ...formData, tipo: 'N2', rateio: [{ parentId: '', percentagem: '100' }] })}
                                className={`flex-1 min-w-[100px] py-2 text-sm font-semibold rounded-lg transition-all ${formData.tipo === 'N2' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${editingCentro ? 'disabled:opacity-50' : ''}`}
                            >
                                N2 (Filho)
                            </button>
                            <button
                                type="button"
                                disabled={editingCentro != null}
                                onClick={() => setFormData({ ...formData, tipo: 'N3', rateio: [{ parentId: '', percentagem: '100' }] })}
                                className={`flex-1 min-w-[100px] py-2 text-sm font-semibold rounded-lg transition-all ${formData.tipo === 'N3' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${editingCentro ? 'disabled:opacity-50' : ''}`}
                            >
                                N3 (Neto)
                            </button>
                            <button
                                type="button"
                                disabled={editingCentro != null}
                                onClick={() => setFormData({ ...formData, tipo: 'N4', rateio: [{ parentId: '', percentagem: '100' }] })}
                                className={`flex-1 min-w-[100px] py-2 text-sm font-semibold rounded-lg transition-all ${formData.tipo === 'N4' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${editingCentro ? 'disabled:opacity-50' : ''}`}
                            >
                                N4 (Bisneto)
                            </button>
                        </div>
                        {formData.tipo === 'N1' ? (
                            <p className="text-xs text-slate-500 mt-2 px-1">Representa entidades principais na raiz da árvore (ex: Contratos, Matrizes).</p>
                        ) : (
                            <p className="text-xs text-slate-500 mt-2 px-1">Sub-entidades atreladas e rateadas aos níveis de {getParentLabel()}.</p>
                        )}
                    </div>

                    <Input
                        label="Nome do Centro de Custo"
                        placeholder="Ex: Contrato de Belém, Caminhão..."
                        value={formData.nome}
                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                        required
                    />

                    {formData.tipo !== 'N1' && (
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                                    Composição de Rateio
                                    <span title={`Distribuir esse custo entre os níveis ${getParentLabel()} acima`} className="text-slate-400 cursor-help"><HelpCircle size={14} /></span>
                                </label>
                                <button type="button" onClick={handleAddRateio} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg">
                                    <PlusCircle size={14} /> Adicionar Rateio
                                </button>
                            </div>

                            {formData.rateio.map((r, index) => (
                                <div key={index} className="flex gap-3 mb-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex-1">
                                        <select
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                            value={r.parentId || r.n1Id || ''}
                                            onChange={(e) => handleRateioChange(index, 'parentId', e.target.value)}
                                            required
                                        >
                                            <option value="">Selecione um {getParentLabel()}...</option>
                                            {parentOptions.map(p => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24 relative">
                                        <input
                                            type="number"
                                            placeholder="%"
                                            className="w-full px-3 py-2 pr-6 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                            value={r.percentagem}
                                            onChange={(e) => handleRateioChange(index, 'percentagem', e.target.value)}
                                            required
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRateio(index)}
                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mt-0.5"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {formData.rateio.length === 0 && (
                                <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                    Nenhum nível atrelado. Adicione o rateio acima.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1" variant={editingCentro ? "primary" : "primary"}>
                            {isSaving ? "Salvando..." : (editingCentro ? 'Atualizar' : 'Criar Centro de Custo')}
                        </Button>
                    </div>
                </fieldset>
            </form>
        </ModalBackdrop>
    );
};

export default CentroCustoModal;
