import React, { useState, useEffect } from 'react';
import { DollarSign, Loader2, Upload, Check } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';
import { Modal, ModalFooter, Button, Input, Select, Textarea, Checkbox } from '../../../components/ui';
import { formatCurrency, formatDateBR } from '../../../lib/utils';
import { PAYMENT_METHODS } from '../../../lib/cities';

const PagamentoModal = ({ isOpen, onClose, servidor }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDespachos, setSelectedDespachos] = useState([]);
    const [formData, setFormData] = useState({
        dataPagamento: new Date().toISOString().split('T')[0],
        valorPago: '',
        formaPagamento: 'PIX',
        observacoes: ''
    });

    // Reset quando modal abre
    useEffect(() => {
        if (isOpen && servidor) {
            setSelectedDespachos(servidor.despachosPendentes?.map(d => d.id) || []);
            const total = servidor.despachosPendentes?.reduce((sum, d) => sum + (d.custoTotal || 0), 0) || 0;
            setFormData({
                dataPagamento: new Date().toISOString().split('T')[0],
                valorPago: total.toFixed(2),
                formaPagamento: 'PIX',
                observacoes: ''
            });
        }
    }, [isOpen, servidor]);

    if (!servidor) return null;

    const despachosPendentes = servidor.despachosPendentes || [];

    const totalSelecionado = despachosPendentes
        .filter(d => selectedDespachos.includes(d.id))
        .reduce((sum, d) => sum + (d.custoTotal || 0), 0);

    const handleToggleDespacho = (despachoId) => {
        setSelectedDespachos(prev =>
            prev.includes(despachoId)
                ? prev.filter(id => id !== despachoId)
                : [...prev, despachoId]
        );
    };

    const handleSelectAll = () => {
        if (selectedDespachos.length === despachosPendentes.length) {
            setSelectedDespachos([]);
        } else {
            setSelectedDespachos(despachosPendentes.map(d => d.id));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (selectedDespachos.length === 0) {
            alert('Selecione pelo menos um despacho.');
            return;
        }

        setIsLoading(true);

        try {
            const valorPago = Number(formData.valorPago);
            const batch = writeBatch(db);

            // Registrar o pagamento
            const pagamentoRef = collection(db, `artifacts/${appId}/pagamentos`);
            await addDoc(pagamentoRef, {
                servidorId: servidor.id,
                servidorNome: servidor.nome,
                despachosIds: selectedDespachos,
                dataPagamento: formData.dataPagamento,
                valorPago,
                formaPagamento: formData.formaPagamento,
                observacoes: formData.observacoes,
                criadoEm: serverTimestamp()
            });

            // Atualizar status dos despachos
            // Atualizar status dos despachos
            // Calcular fator de pagamento para distribuição proporcional se for parcial
            const isTotalPayment = Math.abs(valorPago - totalSelecionado) < 0.01; // Margem para erro de float
            const paymentRatio = isTotalPayment ? 1 : (valorPago / totalSelecionado);

            for (const despachoId of selectedDespachos) {
                const despacho = despachosPendentes.find(d => d.id === despachoId);
                if (!despacho) continue;

                const docRef = doc(db, `artifacts/${appId}/despachos`, despachoId);
                const custo = despacho.custoTotal || 0;

                // Calcular valor pago para este despacho específico
                // Se já tinha um valor pago antes, soma (embora o modal atual pareça feito para pagar pendentes)
                // Assumindo que o modal paga o restante ou parte do restante

                // Na implementação atual, despachosPendentes filtra !== 'Pago Total'. 
                // Se for 'Pago Parcial', o custoTotal ainda é o total original.
                // Idealmente deveríamos saber quanto já foi pago. Como não temos histórico confiável nos antigos,
                // vamos assumir que o "saldo devedor" implícito é tratado pelo usuário ao definir o valor no modal.

                const valorPagoNesteRateio = custo * paymentRatio;
                const valorPagoAnterior = despacho.valorPago || 0;
                const novoValorPagoAcumulado = valorPagoAnterior + valorPagoNesteRateio;

                // Determinar novo status
                let novoStatus = 'Pago Total';
                // Usar uma pequena margem de tolerância para considerar pago total
                if (novoValorPagoAcumulado < (custo - 0.01)) {
                    novoStatus = 'Pago Parcial';
                }

                await updateDoc(docRef, {
                    statusFinanceiro: novoStatus,
                    valorPago: novoValorPagoAcumulado,
                    saldoDevido: custo - novoValorPagoAcumulado,
                    atualizadoEm: serverTimestamp()
                });
            }

            onClose();
        } catch (error) {
            console.error('Erro ao registrar pagamento:', error);
            alert('Erro ao registrar pagamento. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Efetuar Pagamento"
            subtitle={`Para: ${servidor.nome}`}
            icon={DollarSign}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit}>
                {/* Dados Bancários */}
                {servidor.dadosBancarios?.chavePix && (
                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                        <h4 className="text-sm font-bold text-slate-700 mb-3">Dados para Pagamento</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500">Chave PIX</p>
                                <p className="font-medium text-slate-800">{servidor.dadosBancarios.chavePix}</p>
                            </div>
                            {servidor.dadosBancarios.nomeRecebedor && (
                                <div>
                                    <p className="text-slate-500">Recebedor</p>
                                    <p className="font-medium text-slate-800">{servidor.dadosBancarios.nomeRecebedor}</p>
                                </div>
                            )}
                            {servidor.dadosBancarios.banco && (
                                <div>
                                    <p className="text-slate-500">Banco</p>
                                    <p className="font-medium text-slate-800">{servidor.dadosBancarios.banco}</p>
                                </div>
                            )}
                            {servidor.dadosBancarios.agencia && (
                                <div>
                                    <p className="text-slate-500">Agência / Conta</p>
                                    <p className="font-medium text-slate-800">
                                        {servidor.dadosBancarios.agencia} / {servidor.dadosBancarios.conta}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Seleção de Despachos */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-slate-700">
                            Despachos a Pagar
                        </label>
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            {selectedDespachos.length === despachosPendentes.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {despachosPendentes.map(despacho => (
                            <label
                                key={despacho.id}
                                className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedDespachos.includes(despacho.id)}
                                    onChange={() => handleToggleDespacho(despacho.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="flex-1 text-sm">
                                    <p className="font-medium text-slate-700">
                                        {formatDateBR(despacho.data)} - {despacho.origem} → {despacho.destino}
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        {despacho.volumesEntregues || 0} volumes
                                    </p>
                                </div>
                                <p className="font-medium text-slate-800">
                                    {formatCurrency(despacho.custoTotal)}
                                </p>
                            </label>
                        ))}
                    </div>

                    <div className="mt-3 flex justify-between items-center bg-indigo-50 p-3 rounded-xl">
                        <span className="text-sm font-medium text-indigo-700">
                            {selectedDespachos.length} despacho(s) selecionado(s)
                        </span>
                        <span className="text-lg font-bold text-indigo-800">
                            {formatCurrency(totalSelecionado)}
                        </span>
                    </div>
                </div>

                {/* Dados do Pagamento */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <Input
                        label="Data do Pagamento"
                        type="date"
                        value={formData.dataPagamento}
                        onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                        required
                    />
                    <Input
                        label="Valor Pago (R$)"
                        type="number"
                        step="0.01"
                        value={formData.valorPago}
                        onChange={(e) => setFormData({ ...formData, valorPago: e.target.value })}
                        required
                    />
                </div>

                <Select
                    label="Forma de Pagamento"
                    value={formData.formaPagamento}
                    onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value })}
                    options={PAYMENT_METHODS}
                />

                <Textarea
                    label="Observações"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais sobre o pagamento..."
                />

                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="success"
                        className="flex-1"
                        disabled={isLoading || selectedDespachos.length === 0}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Confirmar Pagamento
                            </>
                        )}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
};

export default PagamentoModal;
