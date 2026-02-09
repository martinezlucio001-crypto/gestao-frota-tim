import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Ship,
    Pencil,
    Trash2,
    MapPin,
    DollarSign,
    Phone,
    Mail,
    CreditCard,
    Check,
    AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Button, Card, Badge } from '../../components/ui';
import { formatCurrency } from '../../lib/utils';
import ServidorModal from './modals/ServidorModal';

const ServidoresPage = () => {
    const [servidores, setServidores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingServidor, setEditingServidor] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Carregar servidores
    useEffect(() => {
        const servidoresRef = collection(db, `artifacts/${appId}/servidores`);
        const unsubscribe = onSnapshot(servidoresRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServidores(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filtrar servidores
    const filteredServidores = servidores.filter(s =>
        s.nome?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (servidor) => {
        setEditingServidor(servidor);
        setIsModalOpen(true);
    };

    const handleDelete = async (servidorId) => {
        if (!confirm('Tem certeza que deseja excluir este servidor?')) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/servidores`, servidorId));
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir servidor.');
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingServidor(null);
    };

    // Formatar rotas para exibição
    const formatRoutes = (rotas) => {
        if (!rotas || rotas.length === 0) return 'Nenhuma rota';
        return rotas.map(r => `${r.origem} ↔ ${r.destino}`).join(', ');
    };

    // Obter unidades ativas
    const getActiveUnits = (unidades) => {
        if (!unidades) return [];
        const active = [];
        if (unidades.kg?.ativo) active.push({ label: 'Kg', value: unidades.kg.valor });
        if (unidades.volume?.ativo) active.push({ label: 'Volume', value: unidades.volume.valor });
        if (unidades.palete?.ativo) active.push({ label: 'Palete', value: unidades.palete.valor });
        return active;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Servidores</h2>
                    <p className="text-slate-500">Prestadores de serviço cadastrados</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus size={18} />
                    Adicionar Servidor
                </Button>
            </div>

            {/* Busca */}
            <Card className="p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar servidor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>
            </Card>

            {/* Grid de Cards */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500">Carregando servidores...</p>
                </div>
            ) : filteredServidores.length === 0 ? (
                <Card className="text-center py-12">
                    <Ship className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">Nenhum servidor encontrado</h3>
                    <p className="text-slate-400 mb-4">Cadastre seu primeiro prestador de serviço.</p>
                    <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                        <Plus size={18} />
                        Adicionar Servidor
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredServidores.map(servidor => {
                        const activeUnits = getActiveUnits(servidor.unidadesPrecificacao);
                        const hasBankData = servidor.dadosBancarios?.chavePix;

                        return (
                            <Card key={servidor.id} className="group">
                                {/* Header do Card */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                                            <Ship className="text-indigo-600" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{servidor.nome}</h3>
                                            <p className="text-xs text-slate-400">
                                                {servidor.rotas?.length || 0} rota(s)
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(servidor)}
                                            className="p-2 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(servidor.id)}
                                            className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Rotas */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                        <MapPin size={14} />
                                        <span className="font-medium">Rotas</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {servidor.rotas?.slice(0, 2).map((rota, i) => (
                                            <Badge key={i} variant="default" className="text-[10px]">
                                                {rota.origem} ↔ {rota.destino}
                                            </Badge>
                                        ))}
                                        {servidor.rotas?.length > 2 && (
                                            <Badge variant="primary" className="text-[10px]">
                                                +{servidor.rotas.length - 2}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Unidades de Precificação */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                        <DollarSign size={14} />
                                        <span className="font-medium">Precificação</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeUnits.length > 0 ? (
                                            activeUnits.map((unit, i) => (
                                                <div key={i} className="bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
                                                    <span className="text-xs font-medium text-emerald-700">
                                                        {unit.label}: {formatCurrency(unit.value)}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400">Nenhuma unidade configurada</span>
                                        )}
                                    </div>
                                </div>

                                {/* Footer - Dados Bancários */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={16} className={hasBankData ? "text-emerald-500" : "text-slate-300"} />
                                        <span className={`text-xs font-medium ${hasBankData ? "text-emerald-600" : "text-slate-400"}`}>
                                            {hasBankData ? "PIX cadastrado" : "Sem dados bancários"}
                                        </span>
                                    </div>
                                    {servidor.contato?.celular && (
                                        <div className="flex items-center gap-1 text-slate-400">
                                            <Phone size={14} />
                                            <span className="text-xs">{servidor.contato.celular}</span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <ServidorModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                editingServidor={editingServidor}
            />
        </div>
    );
};

export default ServidoresPage;
