import React, { useState } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button, Input, Select } from '../../../components/ui';
import { CITIES } from '../../../lib/cities';

const NotaManualModal = ({ isOpen, onClose, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        nota_despacho: 'NN',
        tipo: 'Recebimento',
        data_ocorrencia: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
        origem: '',
        destino: ''
    });

    // Lista dinâmica de unitizadores
    const [unitizadores, setUnitizadores] = useState([
        { id: Date.now().toString(), unitizador: '', peso: '' }
    ]);

    if (!isOpen) return null;

    const handleAddUnitizador = () => {
        setUnitizadores([...unitizadores, { id: Date.now().toString(), unitizador: '', peso: '' }]);
    };

    const handleRemoveUnitizador = (idToRemove) => {
        setUnitizadores(unitizadores.filter(u => u.id !== idToRemove));
    };

    const handleUnitizadorChange = (id, field, value) => {
        setUnitizadores(unitizadores.map(u =>
            u.id === id ? { ...u, [field]: value } : u
        ));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.origem || !formData.destino) {
            alert("Origem e Destino são obrigatórios!");
            return;
        }

        if (formData.origem === formData.destino) {
            alert("Origem e Destino não podem ser iguais!");
            return;
        }

        // Valida se há ao menos um unitizador preenchido se o array não estiver vazio
        const validUnitizadores = unitizadores.filter(u => u.unitizador.trim() !== '');

        setIsLoading(true);

        try {
            // Conta peso total e quantidade
            let totalPeso = 0;
            const itensFormatados = validUnitizadores.map(u => {
                const p = parseFloat(u.peso.replace(',', '.'));
                if (!isNaN(p)) totalPeso += p;

                return {
                    unitizador: u.unitizador.trim(),
                    lacre: "-",
                    peso: u.peso.trim() || "0",
                    origem: "Manual",
                    conferido: formData.tipo === 'Devolução' // se devolução, já sai como true porque é saída? Ou mantém false? Deixaremos false para Recebimento, e true para saída? Na verdade, melhor setar como conferido base dependendo. 
                };
            });

            const dataToSave = {
                nota_despacho: formData.nota_despacho,
                data_ocorrencia: formData.data_ocorrencia,
                origem: formData.origem,
                destino: formData.destino,
                qtde_unitizadores: itensFormatados.length,
                peso_total_declarado: totalPeso.toString().replace('.', ','),
                status: formData.tipo === 'Recebimento' ? 'RECEBIDO' : 'PROCESSADA', // Devolução já entra como despachada/processada
                criado_em: new Date().toISOString(),
                isManual: true, // Marcação de nota manual
                tipoManual: formData.tipo
            };

            // Anexa os itens na chave correta dependendo do Tipo
            if (formData.tipo === 'Recebimento') {
                dataToSave.itens = itensFormatados;
            } else {
                dataToSave.itens_conferencia = itensFormatados;
            }

            await addDoc(collection(db, 'tb_despachos_conferencia'), dataToSave);

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Erro ao salvar nota manual:", error);
            alert("Erro ao salvar a nota.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col relative my-8 sm:my-0">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Adicionar Despacho Manual</h2>
                        <p className="text-sm text-slate-500">Insira uma nota de despacho não importada no sistema.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <form id="nota-manual-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Linha 1 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Input
                                label="Nota de Despacho"
                                value={formData.nota_despacho}
                                onChange={e => setFormData({ ...formData, nota_despacho: e.target.value })}
                                required
                            />

                            <Select
                                label="Tipo"
                                value={formData.tipo}
                                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                options={[
                                    { value: 'Recebimento', label: 'Recebimento (Entrada)' },
                                    { value: 'Devolução', label: 'Devolução (Saída)' }
                                ]}
                                required
                            />

                            <Input
                                type="datetime-local"
                                label="Data e Hora"
                                value={formData.data_ocorrencia}
                                onChange={e => setFormData({ ...formData, data_ocorrencia: e.target.value })}
                                required
                            />
                        </div>

                        {/* Linha 2 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Select
                                label="Origem"
                                value={formData.origem}
                                onChange={e => setFormData({ ...formData, origem: e.target.value })}
                                options={CITIES.map(c => ({ value: c, label: c }))}
                                placeholder="Selecione..."
                                required
                            />

                            <Select
                                label="Destino"
                                value={formData.destino}
                                onChange={e => setFormData({ ...formData, destino: e.target.value })}
                                options={CITIES.map(c => ({ value: c, label: c }))}
                                placeholder="Selecione..."
                                required
                            />
                        </div>

                        {/* Lista de Unitizadores */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-slate-700">Unitizadores</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddUnitizador}
                                    className="gap-2"
                                >
                                    <Plus size={16} /> Adicionar Volume
                                </Button>
                            </div>

                            {unitizadores.map((u, index) => (
                                <div key={u.id} className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Input
                                            label={index === 0 ? "Identificação (Unitizador)" : undefined}
                                            placeholder="Ex: 574482939"
                                            value={u.unitizador}
                                            onChange={e => handleUnitizadorChange(u.id, 'unitizador', e.target.value)}
                                            required={index === 0}
                                        />
                                    </div>
                                    <div className="w-1/3">
                                        <Input
                                            label={index === 0 ? "Peso (kg)" : undefined}
                                            placeholder="0,00"
                                            value={u.peso}
                                            onChange={e => handleUnitizadorChange(u.id, 'peso', e.target.value)}
                                            required={index === 0}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveUnitizador(u.id)}
                                        disabled={unitizadores.length === 1}
                                        className="mb-1 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Remover linha"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-2xl shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="nota-manual-form"
                        disabled={isLoading || formData.origem === formData.destino}
                        className="gap-2"
                    >
                        {isLoading ? "Salvando..." : (
                            <>
                                <Save size={18} />
                                Salvar Despacho Manual
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NotaManualModal;
