import React from 'react';
import { Modal, ModalFooter, Button } from '../../../components/ui';
import { FileText, Package, AlertTriangle } from 'lucide-react';

const NotaDetalheModal = ({ nota, onClose, onProcessar }) => {
    if (!nota) return null;

    const itens = nota.itens || [];

    // Parse items for table view
    const parsedItens = itens.map(item => {
        const parts = item.split(' - ');
        return {
            unitizador: parts[0] || '-',
            lacre: parts[1] || '-',
            peso: parts[2] || '-'
        };
    });

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`Nota ${nota.nota_despacho}`}
            subtitle="Detalhes recebidos via e-mail"
            icon={FileText}
            maxWidth="max-w-2xl"
        >
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Data</span>
                    <p className="font-medium text-slate-700">{nota.data_ocorrencia}</p>
                </div>
                <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Origem</span>
                    <p className="font-medium text-slate-700">{nota.origem}</p>
                </div>
                <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Destino</span>
                    <p className="font-medium text-slate-700">{nota.destino}</p>
                </div>
                <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Status</span>
                    <p className="font-bold text-indigo-600">{nota.status}</p>
                </div>
            </div>

            {/* Divergência Warning */}
            {(nota.status === 'DIVERGENTE' || nota.divergencia) && (
                <div className="mb-6 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="text-rose-500 mt-0.5 min-w-[18px]" size={18} />
                    <div>
                        <h4 className="font-bold text-rose-700 text-sm">Divergência Encontrada</h4>
                        <p className="text-rose-600 text-sm">{nota.divergencia || "Inconsistência nos dados recebidos."}</p>
                    </div>
                </div>
            )}

            {/* Items Table */}
            <div className="mb-6">
                <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Package size={16} className="text-slate-500" />
                    Itens do Despacho ({nota.qtde_unitizadores})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Unitizador</th>
                                <th className="px-4 py-2">Lacre</th>
                                <th className="px-4 py-2 text-right">Peso</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {parsedItens.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 text-slate-700 font-medium">{item.unitizador}</td>
                                    <td className="px-4 py-2 text-slate-500">{item.lacre}</td>
                                    <td className="px-4 py-2 text-right text-slate-700">{item.peso}</td>
                                </tr>
                            ))}
                            {parsedItens.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">
                                        Nenhum item listado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-2 text-right text-sm text-slate-500 font-medium">
                    Peso Total Declarado: {parseFloat(nota.peso_total_declarado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                </div>
            </div>

            <ModalFooter>
                <Button variant="ghost" onClick={onClose}>
                    Fechar
                </Button>
                {/* Só permite processar se ainda não foi processada e não é apenas um registro órfão de devolução (que requer análise) */}
                {nota.status !== 'PROCESSADA' && (
                    <Button variant="primary" onClick={() => onProcessar(nota)}>
                        Realizar Despacho
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    );
};

export default NotaDetalheModal;
