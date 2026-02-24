import React, { useState } from 'react';
import { Modal, ModalFooter, Button } from '../../../components/ui';
import { FileText, Package, AlertTriangle } from 'lucide-react';

const NotaDetalheModal = ({ nota, onClose, onProcessar, onToggleItem, onToggleAll }) => {
    if (!nota) return null;

    const itens = nota.itens || [];

    // Parse items for table view
    const parsedItens = itens.map(item => {
        if (typeof item === 'string') {
            const parts = item.split(' - ');
            return {
                unitizador: parts[0] || '-',
                lacre: parts[1] || '-',
                peso: parts[2] || '-',
                conferido: false,
                original: item
            };
        }
        return {
            unitizador: item.unitizador || '-',
            lacre: item.lacre || '-',
            peso: item.peso ? item.peso.toString() : '-',
            conferido: !!item.conferido,
            ...item
        };
    });

    // Normalizar listas (shared logic for both desktop and mobile)
    const normalizeList = (list) => (list || [])
        .map(i => {
            if (typeof i === 'string') {
                const p = i.split(' - ');
                return {
                    unitizador: (p[0] || '').trim(),
                    lacre: (p[1] || '-').trim(),
                    peso: (p[2] || '-').trim(),
                    origem: i
                };
            }
            if (!i || i.unitizador === undefined || i.unitizador === null) return null;
            return {
                ...i,
                unitizador: String(i.unitizador).trim()
            };
        })
        .filter(i => i && i.unitizador && i.unitizador !== '-'); // Filtra nulos ou incompletos

    const listaRecebimento = normalizeList(nota.itens);
    const listaDevolucao = normalizeList(nota.itens_conferencia);

    const allUnitizadores = Array.from(new Set([
        ...listaRecebimento.map(i => i.unitizador),
        ...listaDevolucao.map(i => i.unitizador)
    ])).filter(u => u).sort();

    // Checkbox Validation State
    const [showWarning, setShowWarning] = useState(false);
    const [uncheckedItens, setUncheckedItens] = useState([]);

    const handleProcessarPreCheck = () => {
        const itensParaVerificar = allUnitizadores.map(u => {
            const inRecebimento = listaRecebimento.find(i => i.unitizador === u);
            const inDevolucao = listaDevolucao.find(i => i.unitizador === u);
            return inRecebimento || inDevolucao;
        }).filter(item => item);

        const naoConferidos = itensParaVerificar.filter(item => !item.conferido);

        if (naoConferidos.length > 0) {
            setUncheckedItens(naoConferidos);
            setShowWarning(true);
        } else {
            onProcessar(nota);
        }
    };

    return (
        <>
            <Modal
                isOpen={true}
                onClose={onClose}
                title={`Nota ${nota.nota_despacho}`}
                subtitle="Detalhes recebidos via e-mail"
                icon={FileText}
                maxWidth="max-w-2xl"
            >
                {/* Header Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-100">
                    <div>
                        <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Data</span>
                        <p className="font-medium text-slate-700 text-sm sm:text-base">{nota.data_ocorrencia}</p>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Origem</span>
                        <p className="font-medium text-slate-700 text-sm sm:text-base">{nota.origem}</p>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Destino</span>
                        <p className="font-medium text-slate-700 text-sm sm:text-base">{nota.destino}</p>
                    </div>
                    <div>
                        <span className="text-xs text-slate-500 uppercase font-bold block mb-1">Status</span>
                        <p className="font-bold text-indigo-600 text-sm sm:text-base">{nota.status}</p>
                    </div>
                </div>

                {/* Divergência Warning Refined */}
                {(nota.status === 'DIVERGENTE' || nota.divergencia) && (
                    <div className="mb-4 sm:mb-6 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-rose-500 mt-0.5 min-w-[18px]" size={18} />
                        <div className="flex-1">
                            <h4 className="font-bold text-rose-700 text-sm mb-1">Divergência Encontrada</h4>

                            {(() => {
                                // Calculate discrepancies dynamically
                                const missingInEntry = listaDevolucao.filter(devItem => !listaRecebimento.find(recItem => recItem.unitizador === devItem.unitizador));
                                const missingInReturn = listaRecebimento.filter(recItem => !listaDevolucao.find(devItem => devItem.unitizador === recItem.unitizador));

                                const hasDynamicDivergence = missingInEntry.length > 0 || missingInReturn.length > 0;

                                if (!hasDynamicDivergence) {
                                    return <p className="text-rose-600 text-xs sm:text-sm">{nota.divergencia || "Inconsistência identificada."}</p>;
                                }

                                return (
                                    <div className="space-y-2 text-xs sm:text-sm text-rose-700">
                                        {missingInEntry.length > 0 && (
                                            <div>
                                                <span className="font-semibold block">Unitizadores que não constam na entrada:</span>
                                                <span className="opacity-90">{missingInEntry.map(i => i.unitizador).join('; ')}</span>
                                            </div>
                                        )}
                                        {missingInReturn.length > 0 && (
                                            <div>
                                                <span className="font-semibold block">Unitizadores que faltaram na devolução:</span>
                                                <span className="opacity-90">{missingInReturn.map(i => i.unitizador).join('; ')}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* Items */}
                <div className="mb-4 sm:mb-6">
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <Package size={16} className="text-slate-500" />
                        Itens do Despacho
                        <span className="ml-2 flex gap-2 text-xs font-normal">
                            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="Itens de Recebimento">
                                ↑ {listaRecebimento.length}
                            </span>
                            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100" title="Itens de Devolução">
                                ↓ {listaDevolucao.length}
                            </span>
                        </span>
                    </h4>

                    {/* Bulk Actions */}
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => {
                                const allChecked = allUnitizadores.every(u => {
                                    const item = listaRecebimento.find(i => i.unitizador === u) || listaDevolucao.find(i => i.unitizador === u);
                                    return item && item.conferido;
                                });
                                onToggleAll(!allChecked);
                            }}
                            className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                        >
                            {allUnitizadores.every(u => {
                                const item = listaRecebimento.find(i => i.unitizador === u) || listaDevolucao.find(i => i.unitizador === u);
                                return item && item.conferido;
                            }) ? 'Desmarcar Todos' : 'Marcar Todos'}
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 w-[80px] text-center">Status</th>
                                    <th className="px-4 py-2">Unitizador</th>
                                    <th className="px-4 py-2">Lacre</th>
                                    <th className="px-4 py-2 text-right">Peso</th>
                                    <th className="px-4 py-2 text-center w-[50px]">Conf.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {allUnitizadores.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic">
                                            Nenhum item listado.
                                        </td>
                                    </tr>
                                ) : (
                                    allUnitizadores.map((unitizador, idx) => {
                                        const inRecebimento = listaRecebimento.find(i => i.unitizador === unitizador);
                                        const inDevolucao = listaDevolucao.find(i => i.unitizador === unitizador);
                                        const displayItem = inRecebimento || inDevolucao;

                                        return (
                                            <tr key={idx} className={`hover:bg-slate-50 ${displayItem.conferido ? 'bg-emerald-50/50' : ''}`}>
                                                <td className="px-4 py-2 text-center flex justify-center gap-1">
                                                    {inRecebimento && (
                                                        <span title="Presente na Nota de Recebimento" className="text-emerald-500 font-bold text-lg cursor-help">
                                                            ↑
                                                        </span>
                                                    )}
                                                    {inDevolucao && (
                                                        <span title="Presente na Nota de Devolução" className="text-rose-500 font-bold text-lg cursor-help">
                                                            ↓
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-slate-700 font-medium">{unitizador}</td>
                                                <td className="px-4 py-2 text-slate-500">{displayItem.lacre}</td>
                                                <td className="px-4 py-2 text-right text-slate-700">{displayItem.peso}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!displayItem.conferido}
                                                        onChange={() => onToggleItem && onToggleItem(unitizador, !displayItem.conferido)}
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-2 max-h-[50vh] overflow-y-auto">
                        {allUnitizadores.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-400 italic text-sm">
                                Nenhum item listado.
                            </div>
                        ) : (
                            allUnitizadores.map((unitizador, idx) => {
                                const inRecebimento = listaRecebimento.find(i => i.unitizador === unitizador);
                                const inDevolucao = listaDevolucao.find(i => i.unitizador === unitizador);
                                const displayItem = inRecebimento || inDevolucao;

                                return (
                                    <div key={idx} className={`border border-slate-200 rounded-lg p-3 ${displayItem.conferido ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-slate-700 text-lg truncate flex-1">{unitizador}</span>
                                            <div className="flex items-center gap-2 ml-2">
                                                <div className="flex gap-0.5">
                                                    {inRecebimento && (
                                                        <span title="Recebimento" className="text-emerald-500 font-bold text-base">↑</span>
                                                    )}
                                                    {inDevolucao && (
                                                        <span title="Devolução" className="text-rose-500 font-bold text-base">↓</span>
                                                    )}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={!!displayItem.conferido}
                                                    onChange={() => onToggleItem && onToggleItem(unitizador, !displayItem.conferido)}
                                                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-500">
                                            <span>Lacre: <span className="text-slate-700 font-medium">{displayItem.lacre || '-'}</span></span>
                                            <span>Peso: <span className="text-slate-700 font-medium">{displayItem.peso}</span></span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-2 text-right text-xs sm:text-sm text-slate-500 font-medium">
                        Peso Total Declarado: {parseFloat(nota.peso_total_declarado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                    </div>
                </div>

                <ModalFooter className="flex-col sm:flex-row">
                    <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
                        Fechar
                    </Button>
                    {nota.status !== 'PROCESSADA' && (
                        <Button variant="primary" onClick={handleProcessarPreCheck} className="w-full sm:w-auto">
                            Realizar Despacho
                        </Button>
                    )}
                </ModalFooter>
            </Modal>

            {/* Warning Modal Overlay */}
            {
                showWarning && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="bg-amber-100 p-3 rounded-full shrink-0">
                                    <AlertTriangle className="text-amber-600" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Itens não conferidos</h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Você ainda não marcou os seguintes unitizadores como conferidos:
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto mb-6 border border-slate-100">
                                <ul className="space-y-1">
                                    {uncheckedItens.map((item, idx) => (
                                        <li key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            <span className="font-medium">{item.unitizador}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowWarning(false)}
                                    className="bg-white hover:bg-slate-50 border border-slate-200"
                                >
                                    Revisar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        setShowWarning(false);
                                        onProcessar(nota);
                                    }}
                                    className="bg-amber-600 hover:bg-amber-700 text-white border-transparent"
                                >
                                    Continuar mesmo assim
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};

export default NotaDetalheModal;
