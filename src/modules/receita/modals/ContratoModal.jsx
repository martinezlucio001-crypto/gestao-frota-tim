import React, { useState, useEffect } from 'react';
import {
    X,
    Save,
    Plus,
    Trash2,
    ChevronDown,
    ChevronRight,
    Truck,
    Ship,
    Users,
    Briefcase,
    Building2
} from 'lucide-react';
import { addDoc, updateDoc, doc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';
import { Button, Input } from '../../../components/ui';

/* Mock data for dispatch types matching user request */
const DISPATCH_TYPES = [
    { id: 'fnde', label: 'FNDE (Livros)' },
    { id: 'postal', label: 'Postal' },
    { id: 'densa', label: 'Carga Densa' }
];

/* Cost Allocation Section Component */
const CostSection = ({ title, icon: Icon, items, selectedItems, onItemToggle, isOpen, onToggleOpen }) => {
    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
            <button
                type="button"
                onClick={onToggleOpen}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600">
                        <Icon size={18} />
                    </div>
                    <span className="font-bold text-slate-700">{title}</span>
                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-bold">
                        {selectedItems.length}
                    </span>
                </div>
                {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
            </button>

            {isOpen && (
                <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200">
                    {items.length === 0 ? (
                        <p className="text-sm text-slate-400 italic p-2">Nenhum item disponível para seleção.</p>
                    ) : items.map(item => (
                        <label
                            key={item.id}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${selectedItems.includes(item.id)
                                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500/30'
                                : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => onItemToggle(item.id)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mr-3"
                            />
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${selectedItems.includes(item.id) ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {item.label}
                                </p>
                                {item.sublabel && (
                                    <p className="text-xs text-slate-500">{item.sublabel}</p>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

const ContratoModal = ({ isOpen, onClose, editingContrato = null }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [trucks, setTrucks] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        nomeContrato: '', // Novo campo
        contratante: '',
        dataInicio: '',
        dataTermino: '',
        prorrogavel: false,
        dataProrrogacao: '',
        unidadePrecificacao: 'Kg', // Kg ou Km
        valorUnitario: '',
        quantidadePrevista: '',
        impostos: [], // { nome, aliquota }
        custosAtribuidos: {
            caminhoes: [],
            despacho: [],
            funcionarios: [], // Placeholder
            prepostos: [], // Placeholder
            despesas: [] // Placeholder
        }
    });

    // Validations State
    const [errors, setErrors] = useState({});

    // UI State for Accordions
    const [openSections, setOpenSections] = useState({
        caminhoes: false,
        despacho: false,
        funcionarios: false,
        prepostos: false,
        despesas: false
    });

    // Load Resources (Trucks)
    useEffect(() => {
        if (isOpen) {
            const fetchTrucks = async () => {
                const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/trucks`));
                const trucksData = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        label: `${data.plate} - ${data.model || 'Modelo não inf.'}`,
                        sublabel: `Motorista: ${data.driver || 'Não definido'}`
                    };
                });
                setTrucks(trucksData);
            };
            fetchTrucks();
        }
    }, [isOpen]);

    // Initialize Form
    useEffect(() => {
        if (isOpen) {
            if (editingContrato) {
                setFormData({
                    nomeContrato: editingContrato.nomeContrato || '', // Novo campo
                    contratante: editingContrato.contratante || '',
                    dataInicio: editingContrato.dataInicio || '',
                    dataTermino: editingContrato.dataTermino || '',
                    prorrogavel: editingContrato.prorrogavel || false,
                    dataProrrogacao: editingContrato.dataProrrogacao || '',
                    unidadePrecificacao: editingContrato.unidadePrecificacao || 'Kg',
                    valorUnitario: editingContrato.valorUnitario || '',
                    quantidadePrevista: editingContrato.quantidadePrevista || '',
                    receitaEsperada: editingContrato.receitaEsperada || '', // Novo campo
                    impostos: editingContrato.impostos || [],
                    custosAtribuidos: {
                        caminhoes: editingContrato.custosAtribuidos?.caminhoes || [],
                        despacho: editingContrato.custosAtribuidos?.despacho || [],
                        funcionarios: editingContrato.custosAtribuidos?.funcionarios || [],
                        prepostos: editingContrato.custosAtribuidos?.prepostos || [],
                        despesas: editingContrato.custosAtribuidos?.despesas || [],
                    }
                });
            } else {
                setFormData({
                    nomeContrato: '', // Novo campo
                    contratante: '',
                    dataInicio: '',
                    dataTermino: '',
                    prorrogavel: false,
                    dataProrrogacao: '',
                    unidadePrecificacao: 'Kg',
                    valorUnitario: '',
                    quantidadePrevista: '',
                    receitaEsperada: '', // Novo campo
                    impostos: [],
                    custosAtribuidos: {
                        caminhoes: [],
                        despacho: [],
                        funcionarios: [],
                        prepostos: [],
                        despesas: []
                    }
                });
            }
        }
    }, [isOpen, editingContrato]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddImposto = () => {
        setFormData(prev => ({
            ...prev,
            impostos: [...prev.impostos, { nome: '', aliquota: '' }]
        }));
    };

    const handleImpostoChange = (index, field, value) => {
        const newImpostos = [...formData.impostos];
        newImpostos[index][field] = value;
        setFormData(prev => ({ ...prev, impostos: newImpostos }));
    };

    const handleRemoveImposto = (index) => {
        const newImpostos = formData.impostos.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, impostos: newImpostos }));
    };

    const toggleSection = (section) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleCostItem = (category, itemId) => {
        setFormData(prev => {
            const currentList = prev.custosAtribuidos[category];
            const newList = currentList.includes(itemId)
                ? currentList.filter(id => id !== itemId)
                : [...currentList, itemId];

            return {
                ...prev,
                custosAtribuidos: {
                    ...prev.custosAtribuidos,
                    [category]: newList
                }
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                valorUnitario: Number(formData.valorUnitario),
                quantidadePrevista: Number(formData.quantidadePrevista),
                receitaEsperada: Number(formData.receitaEsperada),
                updatedAt: serverTimestamp()
            };

            if (editingContrato) {
                await updateDoc(doc(db, `artifacts/${appId}/contratos`, editingContrato.id), payload);
            } else {
                payload.createdAt = serverTimestamp();
                await addDoc(collection(db, `artifacts/${appId}/contratos`), payload);
            }
            onClose();
        } catch (error) {
            console.error("Erro ao salvar contrato:", error);
            alert("Erro ao salvar contrato. Verifique os dados e tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">
                            {editingContrato ? 'Editar Contrato' : 'Novo Contrato'}
                        </h2>
                        <p className="text-sm text-slate-500">Defina os termos e aloque os custos</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">

                    {/* Dados Básicos */}
                    <section className="mb-8">
                        <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-100 pb-2">
                            Detalhes Principais
                        </h3>

                        <div className="mb-6">
                            <Input
                                label="Nome do Contrato"
                                placeholder="Ex: Contrato Correios 2024 - Rota Sul"
                                required
                                value={formData.nomeContrato}
                                onChange={e => handleInputChange('nomeContrato', e.target.value)}
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <Input
                                label="Contratante (Cliente)"
                                placeholder="Nome da Empresa"
                                required
                                value={formData.contratante}
                                onChange={e => handleInputChange('contratante', e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Data de Início"
                                    type="date"
                                    required
                                    value={formData.dataInicio}
                                    onChange={e => handleInputChange('dataInicio', e.target.value)}
                                />
                                <Input
                                    label="Data de Término"
                                    type="date"
                                    required
                                    value={formData.dataTermino}
                                    onChange={e => handleInputChange('dataTermino', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col md:flex-row gap-6">
                            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer w-fit">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 text-indigo-600 rounded"
                                    checked={formData.prorrogavel}
                                    onChange={e => handleInputChange('prorrogavel', e.target.checked)}
                                />
                                <span className="font-medium text-slate-700">Contrato Prorrogável?</span>
                            </label>

                            {formData.prorrogavel && (
                                <div className="flex-1 animate-in slide-in-from-left-2 duration-200">
                                    <Input
                                        label="Data Limite de Prorrogação"
                                        type="date"
                                        value={formData.dataProrrogacao}
                                        onChange={e => handleInputChange('dataProrrogacao', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Valores e Impostos */}
                    <section className="mb-8">
                        <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-100 pb-2">
                            Financeiro e Impostos
                        </h3>
                        <div className="grid md:grid-cols-3 gap-6 mb-6">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-slate-700">Unidade de Precificação</label>
                                <select
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm text-slate-700"
                                    value={formData.unidadePrecificacao}
                                    onChange={e => handleInputChange('unidadePrecificacao', e.target.value)}
                                    required
                                >
                                    <option value="Kg">Kg</option>
                                    <option value="Km">Km</option>
                                </select>
                            </div>
                            <Input
                                label="Valor Unitário (R$)"
                                type="number"
                                step="0.01"
                                required
                                value={formData.valorUnitario}
                                onChange={e => handleInputChange('valorUnitario', e.target.value)}
                            />
                            <Input
                                label="Quantidade Prevista"
                                type="number"
                                placeholder={`Total em ${formData.unidadePrecificacao}`}
                                value={formData.quantidadePrevista}
                                onChange={e => handleInputChange('quantidadePrevista', e.target.value)}
                            />
                        </div>

                        <div className="mb-6">
                            <Input
                                label="Receita Mensal Esperada (R$)"
                                type="number"
                                step="0.01"
                                placeholder="Valor estimado mensal"
                                required
                                value={formData.receitaEsperada}
                                onChange={e => handleInputChange('receitaEsperada', e.target.value)}
                            />
                            <p className="text-xs text-slate-500 mt-1">Usado para comparar com o realizado no Dashboard.</p>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <label className="block text-sm font-bold text-slate-700 mb-3">Impostos Aplicáveis</label>
                            {formData.impostos.map((imposto, index) => (
                                <div key={index} className="flex gap-3 mb-2 animate-in slide-in-from-left-2">
                                    <input
                                        placeholder="Nome do Imposto (Ex: ISS)"
                                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        value={imposto.nome}
                                        onChange={e => handleImpostoChange(index, 'nome', e.target.value)}
                                    />
                                    <div className="relative w-32">
                                        <input
                                            type="number"
                                            placeholder="%"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 pr-8"
                                            value={imposto.aliquota}
                                            onChange={e => handleImpostoChange(index, 'aliquota', e.target.value)}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImposto(index)}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddImposto}
                                className="mt-2 text-sm text-indigo-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <Plus size={16} /> Adicionar Imposto
                            </button>
                        </div>
                    </section>

                    {/* Atribuição de Custos */}
                    <section>
                        <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-100 pb-2">
                            Alocação de Custos
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Selecione quais recursos da empresa estão alocados para este contrato.
                        </p>

                        <CostSection
                            title="Caminhões"
                            icon={Truck}
                            items={trucks}
                            selectedItems={formData.custosAtribuidos.caminhoes}
                            onItemToggle={(id) => toggleCostItem('caminhoes', id)}
                            isOpen={openSections.caminhoes}
                            onToggleOpen={() => toggleSection('caminhoes')}
                        />

                        <CostSection
                            title="Despacho (Tipo de Carga)"
                            icon={Ship}
                            items={DISPATCH_TYPES}
                            selectedItems={formData.custosAtribuidos.despacho}
                            onItemToggle={(id) => toggleCostItem('despacho', id)}
                            isOpen={openSections.despacho}
                            onToggleOpen={() => toggleSection('despacho')}
                        />

                        <CostSection
                            title="Funcionários"
                            icon={Users}
                            items={[]} // Placeholder
                            selectedItems={formData.custosAtribuidos.funcionarios}
                            onItemToggle={(id) => toggleCostItem('funcionarios', id)}
                            isOpen={openSections.funcionarios}
                            onToggleOpen={() => toggleSection('funcionarios')}
                        />

                        <CostSection
                            title="Prepostos"
                            icon={Briefcase}
                            items={[]} // Placeholder
                            selectedItems={formData.custosAtribuidos.prepostos}
                            onItemToggle={(id) => toggleCostItem('prepostos', id)}
                            isOpen={openSections.prepostos}
                            onToggleOpen={() => toggleSection('prepostos')}
                        />

                        <CostSection
                            title="Despesas Operacionais"
                            icon={Building2}
                            items={[]} // Placeholder
                            selectedItems={formData.custosAtribuidos.despesas}
                            onItemToggle={(id) => toggleCostItem('despesas', id)}
                            isOpen={openSections.despesas}
                            onToggleOpen={() => toggleSection('despesas')}
                        />
                    </section>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? 'Salvando...' : 'Salvar Contrato'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ContratoModal;
