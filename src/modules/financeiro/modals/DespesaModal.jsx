import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, Calendar, PlusCircle, Trash2, Tag } from 'lucide-react';
import { Button, Input } from '../../../components/ui';

const ModalBackdrop = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {children}
        </div>
        <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
);

const DespesaModal = ({ isOpen, onClose, onSave, editingDespesa = null, centrosCusto = [], isSaving }) => {
    const [formData, setFormData] = useState({
        descricao: '',
        valor: '',
        data: new Date().toISOString().split('T')[0],
        categoria: '',
        rateio: [] // { centroCustoId: '', percentagem: '' }
    });

    useEffect(() => {
        if (isOpen) {
            if (editingDespesa) {
                setFormData({
                    descricao: editingDespesa.descricao || '',
                    valor: editingDespesa.valor?.toString() || '',
                    data: editingDespesa.data || new Date().toISOString().split('T')[0],
                    categoria: editingDespesa.categoria || '',
                    rateio: editingDespesa.rateio || []
                });
            } else {
                setFormData({
                    descricao: '',
                    valor: '',
                    data: new Date().toISOString().split('T')[0],
                    categoria: '',
                    rateio: []
                });
            }
        }
    }, [isOpen, editingDespesa]);

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
            const newRateio = [...prev.rateio, { centroCustoId: '', percentagem: '' }];
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

        const payload = { ...formData, valor: Number(formData.valor) };
        if (payload.rateio.length === 0) {
            alert("Selecione a qual centro de custo essa despesa pertence.");
            return;
        }

        let totalPercent = 0;
        const formattedRateio = [];
        for (const r of payload.rateio) {
            if (!r.centroCustoId) {
                alert("Selecione um Centro de Custo no rateio.");
                return;
            }
            const pct = Number(r.percentagem) || 0;
            totalPercent += pct;
            formattedRateio.push({
                centroCustoId: r.centroCustoId,
                percentagem: pct,
                valorRateado: payload.valor * (pct / 100)
            });
        }

        if (totalPercent !== 100) {
            const conf = window.confirm(`ATENÇÃO: A distribuição está em ${totalPercent}% (não fecha 100%). Deseja confirmar do mesmo jeito?`);
            if (!conf) return;
        }

        payload.rateio = formattedRateio;

        onSave(payload);
    };

    // Agrupar Centros de custo para visualização
    const n1s = centrosCusto.filter(c => c.tipo === 'N1');
    const n2s = centrosCusto.filter(c => c.tipo === 'N2');

    return (
        <ModalBackdrop onClose={onClose}>
            <div className={`p-8 border-b border-slate-100 ${editingDespesa ? 'bg-amber-50/50' : 'bg-rose-50/50'} flex justify-between items-center flex-shrink-0`}>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{editingDespesa ? 'Editar Lançamento' : 'Novo Lançamento de Despesa'}</h2>
                    <p className="text-sm text-slate-500 mt-1">Registre custos e distribua proporcionalmente.</p>
                </div>
                <div className={`p-2 rounded-full ${editingDespesa ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                    <DollarSign size={24} />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar">
                <fieldset disabled={isSaving}>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                        <Input
                            label="Descrição"
                            placeholder="Ex: Combustível, Manutenção, Pneu..."
                            value={formData.descricao}
                            onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                            required
                        />
                        <Input
                            label="Categoria"
                            placeholder="Operacional, Adm, Impostos..."
                            value={formData.categoria}
                            onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <Input
                            label="Data de Emissão"
                            type="date"
                            value={formData.data}
                            onChange={e => setFormData({ ...formData, data: e.target.value })}
                            required
                        />
                        <Input
                            label="Valor Total (R$)"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.valor}
                            onChange={e => setFormData({ ...formData, valor: e.target.value })}
                            required
                        />
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Centro de Custos & Rateio</h3>
                                <p className="text-xs text-slate-500">Selecione para qual Centro esse gasto vai.</p>
                            </div>
                            <button type="button" onClick={handleAddRateio} className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 bg-rose-100 px-3 py-1.5 rounded-lg transition-colors">
                                <PlusCircle size={14} /> Novo Vínculo
                            </button>
                        </div>

                        <div className="space-y-3">
                            {formData.rateio.map((r, index) => {
                                const rateioValue = formData.valor && r.percentagem ? (Number(formData.valor) * (Number(r.percentagem) / 100)) : 0;
                                return (
                                    <div key={index} className="flex gap-3 items-start bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex-1 relative">
                                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <select
                                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm font-medium text-slate-700"
                                                value={r.centroCustoId}
                                                onChange={(e) => handleRateioChange(index, 'centroCustoId', e.target.value)}
                                                required
                                            >
                                                <option value="">Selecione um Centro...</option>
                                                {n1s.length > 0 && (
                                                    <optgroup label="Nível 1 (Bases)">
                                                        {n1s.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                    </optgroup>
                                                )}
                                                {n2s.length > 0 && (
                                                    <optgroup label="Nível 2 (Filhos)">
                                                        {n2s.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                        <div className="w-28 relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="%"
                                                className="w-full px-3 py-2 pr-7 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm font-bold text-slate-700"
                                                value={r.percentagem}
                                                onChange={(e) => handleRateioChange(index, 'percentagem', e.target.value)}
                                                required
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                                        </div>
                                        <div className="w-24 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm font-semibold text-slate-500 flex items-center justify-center">
                                            R$ {rateioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRateio(index)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mt-0.5"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}

                            {formData.rateio.length === 0 && (
                                <div className="text-center py-6 px-4 bg-white border border-dashed border-slate-300 rounded-xl">
                                    <p className="text-slate-500 text-sm font-medium">Você precisa selecionar de onde vem esse custo.</p>
                                    <p className="text-slate-400 text-xs mt-1">Ex: Clique em "Novo Vínculo" para alocar 100% no "Caminhão 01".</p>
                                </div>
                            )}

                            {formData.rateio.length > 0 && (
                                <div className="flex justify-end pt-2">
                                    <div className="text-xs font-bold text-slate-500">
                                        Total Alocado: <span className={`text-sm ${formData.rateio.reduce((a, b) => a + (Number(b.percentagem) || 0), 0) === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{formData.rateio.reduce((a, b) => a + (Number(b.percentagem) || 0), 0)}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1" variant={editingDespesa ? "primary" : "primary"}>
                            {isSaving ? "Salvando..." : (editingDespesa ? 'Salvar Lançamento' : 'Registrar Despesa')}
                        </Button>
                    </div>
                </fieldset>
            </form>
        </ModalBackdrop>
    );
};

export default DespesaModal;
