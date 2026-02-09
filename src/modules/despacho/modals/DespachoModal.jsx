import React, { useState, useEffect, useMemo } from 'react';
import { Package, Loader2, Plus, X, ArrowRightLeft } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';
import { Modal, ModalFooter, Button, Input, Select, Textarea } from '../../../components/ui';
import { formatCurrency, routeMatches } from '../../../lib/utils';
import { CITIES, CARGO_TYPES, PRICING_UNITS, FINANCIAL_STATUS } from '../../../lib/cities';

const DespachoModal = ({ isOpen, onClose, editingDespacho, servidores = [] }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        data: new Date().toISOString().split('T')[0],
        origem: '',
        destino: '',
        tipoCarga: '',
        servidorId: '',
        servidorNome: '',
        unidadePrecificacao: '',
        volumesCorreios: '',
        volumesEntregues: '',
        pesoTotal: '',
        quantidadePaletes: '',
        valorUnitario: '',
        statusFinanceiro: 'Pendente',
        observacoes: ''
    });

    // Reset form quando modal abre
    useEffect(() => {
        if (isOpen) {
            if (editingDespacho) {
                setFormData({
                    data: editingDespacho.data || new Date().toISOString().split('T')[0],
                    origem: editingDespacho.origem || '',
                    destino: editingDespacho.destino || '',
                    tipoCarga: editingDespacho.tipoCarga || '',
                    servidorId: editingDespacho.servidorId || '',
                    servidorNome: editingDespacho.servidorNome || '',
                    unidadePrecificacao: editingDespacho.unidadePrecificacao || '',
                    volumesCorreios: editingDespacho.volumesCorreios || '',
                    volumesEntregues: editingDespacho.volumesEntregues || '',
                    pesoTotal: editingDespacho.pesoTotal || '',
                    quantidadePaletes: editingDespacho.quantidadePaletes || '',
                    valorUnitario: editingDespacho.valorUnitario || '',
                    statusFinanceiro: editingDespacho.statusFinanceiro || 'Pendente',
                    observacoes: editingDespacho.observacoes || ''
                });
            } else {
                setFormData({
                    data: new Date().toISOString().split('T')[0],
                    origem: '',
                    destino: '',
                    tipoCarga: '',
                    servidorId: '',
                    servidorNome: '',
                    unidadePrecificacao: '',
                    volumesCorreios: '',
                    volumesEntregues: '',
                    pesoTotal: '',
                    quantidadePaletes: '',
                    valorUnitario: '',
                    statusFinanceiro: 'Pendente',
                    observacoes: ''
                });
            }
        }
    }, [isOpen, editingDespacho]);

    // Servidores não são mais filtrados restritivamente, mas exibidos para escolha
    const servidorOptions = useMemo(() => {
        return servidores
            .filter(s => s.nome) // Garante que tem nome
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [servidores]);

    // Servidor selecionado
    const selectedServidor = useMemo(() => {
        return servidores.find(s => s.id === formData.servidorId);
    }, [servidores, formData.servidorId]);

    // Unidades disponíveis para o servidor
    const availableUnits = useMemo(() => {
        if (!selectedServidor?.unidadesPrecificacao) return [];
        const units = [];
        const up = selectedServidor.unidadesPrecificacao;

        // Validação: FNDE só permite Kg ou Palete
        const isFNDE = formData.tipoCarga === 'FNDE (Livros)';

        if (up.kg?.ativo && (!isFNDE || true)) {
            units.push({ value: 'kg', label: 'Quilograma (Kg)', preco: up.kg.valor });
        }
        if (up.volume?.ativo && !isFNDE) {
            units.push({ value: 'volume', label: 'Volume', preco: up.volume.valor });
        }
        if (up.palete?.ativo) {
            units.push({ value: 'palete', label: 'Palete', preco: up.palete.valor });
        }
        return units;
    }, [selectedServidor, formData.tipoCarga]);

    // Auto-selecionar unidade se só houver uma
    useEffect(() => {
        if (availableUnits.length === 1 && !formData.unidadePrecificacao) {
            const unit = availableUnits[0];
            setFormData(prev => ({
                ...prev,
                unidadePrecificacao: unit.value,
                valorUnitario: unit.preco
            }));
        }
    }, [availableUnits]);

    // Calcular valores
    const calculations = useMemo(() => {
        const valorUnit = Number(formData.valorUnitario) || 0;
        const volCorreios = Number(formData.volumesCorreios) || 0;
        const volEntregues = Number(formData.volumesEntregues) || 0;
        const peso = Number(formData.pesoTotal) || 0;
        const paletes = Number(formData.quantidadePaletes) || 0;

        let custoTotal = 0;
        switch (formData.unidadePrecificacao) {
            case 'volume':
                custoTotal = volEntregues * valorUnit;
                break;
            case 'kg':
                custoTotal = peso * valorUnit;
                break;
            case 'palete':
                custoTotal = paletes * valorUnit;
                break;
        }

        // Receita sempre baseada em volumes correios
        const receitaEstimada = volCorreios * valorUnit;
        const margem = receitaEstimada - custoTotal;

        return { custoTotal, receitaEstimada, margem };
    }, [formData]);

    const handleSwapRoute = () => {
        setFormData(prev => ({
            ...prev,
            origem: prev.destino,
            destino: prev.origem
        }));
    };

    const handleChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'servidorId') {
                const servidor = servidores.find(s => s.id === value);
                updated.servidorNome = servidor?.nome || '';
                updated.unidadePrecificacao = '';
                updated.valorUnitario = '';

                // Preencher rota automaticamente com a primeira do servidor
                if (servidor?.rotas?.[0]) {
                    let rotaOrigem = servidor.rotas[0].origem;
                    let rotaDestino = servidor.rotas[0].destino;

                    // Ajuste inteligente: Inverter rota se o tipo de carga exigir direção específica

                    // Caso 1: Carga Densa exige que o Destino seja Santarém
                    // Se a rota padrão do servidor sai de Santarém, invertemos para chegar em Santarém
                    if (updated.tipoCarga === 'Densa' && rotaOrigem === 'Santarém') {
                        rotaOrigem = servidor.rotas[0].destino;
                        rotaDestino = 'Santarém';
                    }

                    // Caso 2: FNDE exige que a Origem seja Santarém
                    // Se a rota padrão do servidor chega em Santarém, invertemos para sair de Santarém
                    else if (updated.tipoCarga === 'FNDE (Livros)' && rotaDestino === 'Santarém') {
                        rotaDestino = servidor.rotas[0].origem;
                        rotaOrigem = 'Santarém';
                    }

                    updated.origem = rotaOrigem;
                    updated.destino = rotaDestino;
                }
            }
            if (field === 'unidadePrecificacao') {
                const unit = availableUnits.find(u => u.value === value);
                updated.valorUnitario = unit?.preco || '';
            }
            if (field === 'tipoCarga') {
                updated.unidadePrecificacao = '';
                updated.valorUnitario = '';
                // Sugestão automática para FNDE
                if (value === 'FNDE (Livros)') {
                    updated.origem = 'Santarém';
                }
                // Sugestão automática para Carga Densa
                if (value === 'Densa') {
                    updated.destino = 'Santarém';
                    // Se a origem for Santarém, limpamos pois não faz sentido origem=destino
                    if (updated.origem === 'Santarém') {
                        updated.origem = '';
                    }
                }
            }

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                volumesCorreios: Number(formData.volumesCorreios) || 0,
                volumesEntregues: Number(formData.volumesEntregues) || 0,
                pesoTotal: Number(formData.pesoTotal) || 0,
                quantidadePaletes: Number(formData.quantidadePaletes) || 0,
                valorUnitario: Number(formData.valorUnitario) || 0,
                custoTotal: calculations.custoTotal,
                receitaEstimada: calculations.receitaEstimada,
                margem: calculations.margem,
                atualizadoEm: serverTimestamp()
            };

            if (editingDespacho) {
                await updateDoc(doc(db, `artifacts/${appId}/despachos`, editingDespacho.id), payload);
            } else {
                payload.criadoEm = serverTimestamp();
                await addDoc(collection(db, `artifacts/${appId}/despachos`), payload);
            }

            onClose();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar despacho. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handler para permitir apenas inteiros
    const handleIntegerInput = (e) => {
        if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }
    };

    // Opções de cidade (excluir selecionada do outro campo)
    const originOptions = CITIES.map(c => ({ value: c, label: c }));
    const destinationOptions = CITIES
        .filter(c => c !== formData.origem)
        .map(c => ({ value: c, label: c }));

    // Opções de tipo de carga (FNDE só se origem = Santarém)
    const cargoOptions = CARGO_TYPES.map(c => ({
        value: c.value,
        label: c.label
    }));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingDespacho ? 'Editar Despacho' : 'Novo Despacho'}
            subtitle="Preencha os dados do despacho"
            icon={Package}
            iconBg={editingDespacho ? 'bg-amber-100' : 'bg-emerald-100'}
            iconColor={editingDespacho ? 'text-amber-600' : 'text-emerald-600'}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit}>
                {/* Seção 1: Informações Básicas */}
                {/* Seção 1: Informações Básicas */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input
                        label="Data"
                        type="date"
                        value={formData.data}
                        onChange={(e) => handleChange('data', e.target.value)}
                        required
                    />
                    <Select
                        label="Tipo de Carga"
                        value={formData.tipoCarga}
                        onChange={(e) => handleChange('tipoCarga', e.target.value)}
                        options={cargoOptions}
                        placeholder="Selecione o tipo"
                        required
                    />
                </div>

                <div className="mb-4">
                    <Select
                        label="Servidor (Prestador)"
                        value={formData.servidorId}
                        onChange={(e) => handleChange('servidorId', e.target.value)}
                        options={servidorOptions.map(s => ({ value: s.id, label: s.nome }))}
                        placeholder="Selecione o servidor"
                        required
                    />
                </div>

                <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start mb-6">
                    <Select
                        label="Origem"
                        value={formData.origem}
                        onChange={(e) => handleChange('origem', e.target.value)}
                        options={originOptions}
                        placeholder="Selecione"
                        required
                    />

                    <button
                        type="button"
                        onClick={handleSwapRoute}
                        className="mt-8 p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors border border-transparent hover:border-slate-200"
                        title="Inverter Origem e Destino"
                    >
                        <ArrowRightLeft size={20} />
                    </button>

                    <Select
                        label="Destino"
                        value={formData.destino}
                        onChange={(e) => handleChange('destino', e.target.value)}
                        options={destinationOptions}
                        placeholder="Selecione"
                        required
                    />
                </div>

                {/* Seção 2: Detalhes da Carga */}
                {formData.servidorId && (
                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                        <h4 className="text-sm font-bold text-slate-700 mb-4">Detalhes da Carga</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Unidade de Precificação"
                                value={formData.unidadePrecificacao}
                                onChange={(e) => handleChange('unidadePrecificacao', e.target.value)}
                                options={availableUnits}
                                placeholder="Selecione"
                                required
                            />
                            <Input
                                label="Valor Unitário (R$)"
                                type="number"
                                step="0.01"
                                value={formData.valorUnitario}
                                onChange={(e) => handleChange('valorUnitario', e.target.value)}
                                helper="Valor sugerido do cadastro. Editável."
                                required
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />

                            <Input
                                label="Volumes Correios"
                                type="number"
                                value={formData.volumesCorreios}
                                onChange={(e) => handleChange('volumesCorreios', e.target.value)}
                                onKeyDown={handleIntegerInput}
                                required
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Input
                                label="Volumes Entregues"
                                type="number"
                                value={formData.volumesEntregues}
                                onChange={(e) => handleChange('volumesEntregues', e.target.value)}
                                onKeyDown={handleIntegerInput}
                                required
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />

                            <Input
                                label="Peso Total (kg)"
                                type="number"
                                step="0.01"
                                value={formData.pesoTotal}
                                onChange={(e) => handleChange('pesoTotal', e.target.value)}
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Input
                                label="Quantidade de Paletes"
                                type="number"
                                value={formData.quantidadePaletes}
                                onChange={(e) => handleChange('quantidadePaletes', e.target.value)}
                                onKeyDown={handleIntegerInput}
                                disabled={!selectedServidor?.unidadesPrecificacao?.palete?.ativo}
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>

                        {/* Resumo Financeiro */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="bg-white p-3 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Custo Total</p>
                                <p className="text-lg font-bold text-slate-800">{formatCurrency(calculations.custoTotal)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Status e Observações */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <Select
                        label="Status Financeiro"
                        value={formData.statusFinanceiro}
                        onChange={(e) => handleChange('statusFinanceiro', e.target.value)}
                        options={FINANCIAL_STATUS}
                    />
                </div>

                <Textarea
                    label="Observações"
                    value={formData.observacoes}
                    onChange={(e) => handleChange('observacoes', e.target.value)}
                    placeholder="Anotações adicionais sobre este despacho..."
                />

                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant={editingDespacho ? 'primary' : 'success'}
                        className="flex-1"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Salvando...
                            </>
                        ) : (
                            editingDespacho ? 'Atualizar' : 'Enviar Registro'
                        )}
                    </Button>
                </ModalFooter>
            </form>
        </Modal >
    );
};

export default DespachoModal;
