import React, { useState, useEffect } from 'react';
import { Ship, Loader2, Plus, Trash2, MapPin } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';
import { Modal, ModalFooter, Button, Input, Select, Textarea, Checkbox } from '../../../components/ui';
import { CITIES } from '../../../lib/cities';

const ServidorModal = ({ isOpen, onClose, editingServidor }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        rotas: [{ origem: '', destino: '' }],
        unidadesPrecificacao: {
            kg: { ativo: false, valor: '' },
            volume: { ativo: false, valor: '' },
            palete: { ativo: false, valor: '' }
        },
        dadosBancarios: {
            chavePix: '',
            nomeRecebedor: '',
            banco: '',
            agencia: '',
            conta: ''
        },
        contato: {
            nomeResponsavel: '',
            celular: '',
            email: ''
        },
        observacoes: ''
    });

    // Reset form quando modal abre
    useEffect(() => {
        if (isOpen) {
            if (editingServidor) {
                setFormData({
                    nome: editingServidor.nome || '',
                    rotas: editingServidor.rotas?.length > 0 ? editingServidor.rotas : [{ origem: '', destino: '' }],
                    unidadesPrecificacao: {
                        kg: {
                            ativo: editingServidor.unidadesPrecificacao?.kg?.ativo || false,
                            valor: editingServidor.unidadesPrecificacao?.kg?.valor || ''
                        },
                        volume: {
                            ativo: editingServidor.unidadesPrecificacao?.volume?.ativo || false,
                            valor: editingServidor.unidadesPrecificacao?.volume?.valor || ''
                        },
                        palete: {
                            ativo: editingServidor.unidadesPrecificacao?.palete?.ativo || false,
                            valor: editingServidor.unidadesPrecificacao?.palete?.valor || ''
                        }
                    },
                    dadosBancarios: {
                        chavePix: editingServidor.dadosBancarios?.chavePix || '',
                        nomeRecebedor: editingServidor.dadosBancarios?.nomeRecebedor || '',
                        banco: editingServidor.dadosBancarios?.banco || '',
                        agencia: editingServidor.dadosBancarios?.agencia || '',
                        conta: editingServidor.dadosBancarios?.conta || ''
                    },
                    contato: {
                        nomeResponsavel: editingServidor.contato?.nomeResponsavel || '',
                        celular: editingServidor.contato?.celular || '',
                        email: editingServidor.contato?.email || ''
                    },
                    observacoes: editingServidor.observacoes || ''
                });
            } else {
                setFormData({
                    nome: '',
                    rotas: [{ origem: '', destino: '' }],
                    unidadesPrecificacao: {
                        kg: { ativo: false, valor: '' },
                        volume: { ativo: false, valor: '' },
                        palete: { ativo: false, valor: '' }
                    },
                    dadosBancarios: {
                        chavePix: '',
                        nomeRecebedor: '',
                        banco: '',
                        agencia: '',
                        conta: ''
                    },
                    contato: {
                        nomeResponsavel: '',
                        celular: '',
                        email: ''
                    },
                    observacoes: ''
                });
            }
        }
    }, [isOpen, editingServidor]);

    const handleAddRoute = () => {
        setFormData(prev => ({
            ...prev,
            rotas: [...prev.rotas, { origem: '', destino: '' }]
        }));
    };

    const handleRemoveRoute = (index) => {
        setFormData(prev => ({
            ...prev,
            rotas: prev.rotas.filter((_, i) => i !== index)
        }));
    };

    const handleRouteChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            rotas: prev.rotas.map((r, i) => i === index ? { ...r, [field]: value } : r)
        }));
    };

    const handleUnitToggle = (unit) => {
        setFormData(prev => ({
            ...prev,
            unidadesPrecificacao: {
                ...prev.unidadesPrecificacao,
                [unit]: {
                    ...prev.unidadesPrecificacao[unit],
                    ativo: !prev.unidadesPrecificacao[unit].ativo,
                    valor: !prev.unidadesPrecificacao[unit].ativo ? prev.unidadesPrecificacao[unit].valor : ''
                }
            }
        }));
    };

    const handleUnitValueChange = (unit, value) => {
        setFormData(prev => ({
            ...prev,
            unidadesPrecificacao: {
                ...prev.unidadesPrecificacao,
                [unit]: {
                    ...prev.unidadesPrecificacao[unit],
                    valor: value
                }
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validação: pelo menos uma rota
        const validRoutes = formData.rotas.filter(r => r.origem && r.destino);
        if (validRoutes.length === 0) {
            alert('Adicione pelo menos uma rota válida.');
            return;
        }

        // Validação: pelo menos uma unidade
        const hasUnit = Object.values(formData.unidadesPrecificacao).some(u => u.ativo && u.valor);
        if (!hasUnit) {
            alert('Habilite pelo menos uma unidade de precificação com valor.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = {
                nome: formData.nome,
                rotas: validRoutes,
                unidadesPrecificacao: {
                    kg: {
                        ativo: formData.unidadesPrecificacao.kg.ativo,
                        valor: Number(formData.unidadesPrecificacao.kg.valor) || 0
                    },
                    volume: {
                        ativo: formData.unidadesPrecificacao.volume.ativo,
                        valor: Number(formData.unidadesPrecificacao.volume.valor) || 0
                    },
                    palete: {
                        ativo: formData.unidadesPrecificacao.palete.ativo,
                        valor: Number(formData.unidadesPrecificacao.palete.valor) || 0
                    }
                },
                dadosBancarios: formData.dadosBancarios,
                contato: formData.contato,
                observacoes: formData.observacoes,
                atualizadoEm: serverTimestamp()
            };

            if (editingServidor) {
                await updateDoc(doc(db, `artifacts/${appId}/servidores`, editingServidor.id), payload);
            } else {
                payload.criadoEm = serverTimestamp();
                await addDoc(collection(db, `artifacts/${appId}/servidores`), payload);
            }

            onClose();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar servidor. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const cityOptions = CITIES.map(c => ({ value: c, label: c }));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingServidor ? 'Editar Servidor' : 'Novo Servidor'}
            subtitle="Cadastre um prestador de serviço"
            icon={Ship}
            iconBg={editingServidor ? 'bg-amber-100' : 'bg-indigo-100'}
            iconColor={editingServidor ? 'text-amber-600' : 'text-indigo-600'}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit}>
                {/* Nome */}
                <Input
                    label="Nome do Servidor"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Barco Amazônia"
                    required
                />

                {/* Rotas */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <MapPin size={16} />
                            Rotas de Operação
                        </label>
                        <button
                            type="button"
                            onClick={handleAddRoute}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                        >
                            <Plus size={16} />
                            Adicionar Rota
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.rotas.map((rota, index) => (
                            <div key={index} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl">
                                <select
                                    value={rota.origem}
                                    onChange={(e) => handleRouteChange(index, 'origem', e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    required
                                >
                                    <option value="">Origem</option>
                                    {cityOptions.filter(c => c.value !== rota.destino).map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <span className="text-slate-400 font-bold">↔</span>
                                <select
                                    value={rota.destino}
                                    onChange={(e) => handleRouteChange(index, 'destino', e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    required
                                >
                                    <option value="">Destino</option>
                                    {cityOptions.filter(c => c.value !== rota.origem).map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                {formData.rotas.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRoute(index)}
                                        className="p-2 hover:bg-rose-100 rounded-lg text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">As rotas são bidirecionais (Origem ↔ Destino)</p>
                </div>

                {/* Unidades de Precificação */}
                <div className="mb-6">
                    <label className="text-sm font-semibold text-slate-700 block mb-3">
                        Unidades de Precificação
                    </label>
                    <div className="space-y-3">
                        {[
                            { key: 'kg', label: 'Quilograma (Kg)' },
                            { key: 'volume', label: 'Volume' },
                            { key: 'palete', label: 'Palete' }
                        ].map(unit => (
                            <div key={unit.key} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                                <Checkbox
                                    checked={formData.unidadesPrecificacao[unit.key].ativo}
                                    onChange={() => handleUnitToggle(unit.key)}
                                    label={unit.label}
                                />
                                <div className="flex-1 max-w-[150px]">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.unidadesPrecificacao[unit.key].valor}
                                            onChange={(e) => handleUnitValueChange(unit.key, e.target.value)}
                                            disabled={!formData.unidadesPrecificacao[unit.key].ativo}
                                            placeholder="0,00"
                                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dados Bancários */}
                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                    <h4 className="text-sm font-bold text-slate-700 mb-4">Dados Bancários</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Chave PIX"
                            value={formData.dadosBancarios.chavePix}
                            onChange={(e) => setFormData({
                                ...formData,
                                dadosBancarios: { ...formData.dadosBancarios, chavePix: e.target.value }
                            })}
                            placeholder="CPF, Email, Telefone..."
                        />
                        <Input
                            label="Nome do Recebedor"
                            value={formData.dadosBancarios.nomeRecebedor}
                            onChange={(e) => setFormData({
                                ...formData,
                                dadosBancarios: { ...formData.dadosBancarios, nomeRecebedor: e.target.value }
                            })}
                        />
                        <Input
                            label="Banco"
                            value={formData.dadosBancarios.banco}
                            onChange={(e) => setFormData({
                                ...formData,
                                dadosBancarios: { ...formData.dadosBancarios, banco: e.target.value }
                            })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                label="Agência"
                                value={formData.dadosBancarios.agencia}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    dadosBancarios: { ...formData.dadosBancarios, agencia: e.target.value }
                                })}
                            />
                            <Input
                                label="Conta"
                                value={formData.dadosBancarios.conta}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    dadosBancarios: { ...formData.dadosBancarios, conta: e.target.value }
                                })}
                            />
                        </div>
                    </div>
                </div>

                {/* Contato */}
                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                    <h4 className="text-sm font-bold text-slate-700 mb-4">Informações de Contato</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Responsável"
                            value={formData.contato.nomeResponsavel}
                            onChange={(e) => setFormData({
                                ...formData,
                                contato: { ...formData.contato, nomeResponsavel: e.target.value }
                            })}
                        />
                        <Input
                            label="Celular"
                            type="tel"
                            value={formData.contato.celular}
                            onChange={(e) => setFormData({
                                ...formData,
                                contato: { ...formData.contato, celular: e.target.value }
                            })}
                            placeholder="(00) 00000-0000"
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            value={formData.contato.email}
                            onChange={(e) => setFormData({
                                ...formData,
                                contato: { ...formData.contato, email: e.target.value }
                            })}
                        />
                    </div>
                </div>

                {/* Observações */}
                <Textarea
                    label="Observações"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Anotações sobre este servidor..."
                />

                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        className="flex-1"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Salvando...
                            </>
                        ) : (
                            editingServidor ? 'Salvar Alterações' : 'Cadastrar Servidor'
                        )}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
};

export default ServidorModal;
