import React, { useState, useEffect } from 'react';
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import {
    Loader2,
    Plus,
    Pencil,
    Trash2,
    X,
    Shield,
    Users,
    Truck,
    Ship,
    Monitor,
    Check,
    AlertTriangle
} from 'lucide-react';
import { db } from '../../lib/firebase';

// Definição dos portais disponíveis
const PORTALS = [
    {
        id: 'admin',
        label: 'Painel Administrativo',
        description: 'Acesso total ao sistema de gestão',
        icon: Shield,
        color: 'indigo'
    },
    {
        id: 'motorista',
        label: 'Portal do Motorista',
        description: 'Registro de abastecimentos e manutenções',
        icon: Truck,
        color: 'emerald'
    },
    {
        id: 'despacho_stm',
        label: 'Portal de Despachos STM',
        description: 'Gestão de despachos (em desenvolvimento)',
        icon: Ship,
        color: 'amber'
    },
    {
        id: 'portal_4',
        label: 'Portal 4',
        description: 'Portal futuro (em desenvolvimento)',
        icon: Monitor,
        color: 'purple'
    },
];

const colorStyles = {
    indigo: {
        bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700',
        iconBg: 'bg-indigo-100', badge: 'bg-indigo-100 text-indigo-700',
        header: 'from-indigo-600 to-indigo-700'
    },
    emerald: {
        bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
        iconBg: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700',
        header: 'from-emerald-600 to-emerald-700'
    },
    amber: {
        bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
        iconBg: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700',
        header: 'from-amber-500 to-amber-600'
    },
    purple: {
        bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700',
        iconBg: 'bg-purple-100', badge: 'bg-purple-100 text-purple-700',
        header: 'from-purple-600 to-purple-700'
    },
};

// Modal de Adicionar/Editar Usuário
const UserModal = ({ isOpen, onClose, onSave, editingUser, isSaving }) => {
    const [formData, setFormData] = useState({
        uid: '',
        name: '',
        allowedPortals: []
    });

    useEffect(() => {
        if (isOpen) {
            if (editingUser) {
                setFormData({
                    uid: editingUser.uid,
                    name: editingUser.name || '',
                    allowedPortals: editingUser.allowedPortals || []
                });
            } else {
                setFormData({ uid: '', name: '', allowedPortals: [] });
            }
        }
    }, [isOpen, editingUser]);

    if (!isOpen) return null;

    const togglePortal = (portalId) => {
        setFormData(prev => ({
            ...prev,
            allowedPortals: prev.allowedPortals.includes(portalId)
                ? prev.allowedPortals.filter(p => p !== portalId)
                : [...prev.allowedPortals, portalId]
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.uid.trim()) {
            alert('O UID é obrigatório.');
            return;
        }
        if (formData.allowedPortals.length === 0) {
            alert('Selecione pelo menos um portal.');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className={`p-6 border-b border-slate-100 ${editingUser ? 'bg-amber-50/50' : 'bg-indigo-50/50'} flex justify-between items-center`}>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {editingUser ? 'Atualize os portais permitidos' : 'Adicione um novo usuário ao sistema'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* UID */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">UID do Firebase Auth</label>
                        <input
                            type="text"
                            value={formData.uid}
                            onChange={(e) => setFormData({ ...formData, uid: e.target.value.trim() })}
                            placeholder="Ex: bXm3aIIeofR2hSfkjlRAD4KHYGI2"
                            required
                            disabled={!!editingUser}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 font-mono text-sm"
                        />
                        {!editingUser && (
                            <p className="text-xs text-slate-400 mt-1">
                                Copie do Firebase Console → Authentication → Usuários
                            </p>
                        )}
                    </div>

                    {/* Nome */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Usuário</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: João Silva"
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>

                    {/* Portais Permitidos */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Portais Permitidos</label>
                        <div className="space-y-2">
                            {PORTALS.map(portal => {
                                const isSelected = formData.allowedPortals.includes(portal.id);
                                const style = colorStyles[portal.color];
                                return (
                                    <button
                                        key={portal.id}
                                        type="button"
                                        onClick={() => togglePortal(portal.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? `${style.border} ${style.bg}`
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? style.iconBg : 'bg-slate-100'}`}>
                                            <portal.icon size={16} className={isSelected ? style.text : 'text-slate-400'} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-semibold ${isSelected ? style.text : 'text-slate-600'}`}>
                                                {portal.label}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className={`w-6 h-6 rounded-full ${style.iconBg} flex items-center justify-center`}>
                                                <Check size={14} className={style.text} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <><Loader2 size={18} className="animate-spin" /> Salvando...</>
                            ) : (
                                editingUser ? 'Salvar Alterações' : 'Adicionar Usuário'
                            )}
                        </button>
                    </div>
                </form>
            </div>
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
};

// Modal de Confirmação de Exclusão
const DeleteModal = ({ isOpen, onClose, onConfirm, userName, isSaving }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-in fade-in zoom-in-95">
                <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={28} className="text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Remover Usuário?</h3>
                <p className="text-sm text-slate-500 mb-6">
                    Tem certeza que deseja remover <strong>{userName}</strong> de todos os portais?
                    Esta ação não exclui a conta do Firebase Auth.
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        Remover
                    </button>
                </div>
            </div>
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
};

// Página Principal
const UsuariosPage = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Carregar usuários em tempo real
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'portalAccess'), (snapshot) => {
            const data = snapshot.docs.map(d => ({
                uid: d.id,
                ...d.data()
            }));
            setUsers(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Salvar usuário (criar ou editar)
    const handleSave = async (formData) => {
        setIsSaving(true);
        try {
            const docRef = doc(db, 'portalAccess', formData.uid);
            if (editingUser) {
                await updateDoc(docRef, {
                    name: formData.name,
                    allowedPortals: formData.allowedPortals,
                    updatedAt: serverTimestamp(),
                });
            } else {
                await setDoc(docRef, {
                    name: formData.name,
                    allowedPortals: formData.allowedPortals,
                    createdAt: serverTimestamp(),
                });
            }
            setIsModalOpen(false);
            setEditingUser(null);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar usuário.');
        }
        setIsSaving(false);
    };

    // Excluir usuário
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(db, 'portalAccess', deleteTarget.uid));
            setDeleteTarget(null);
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir usuário.');
        }
        setIsSaving(false);
    };

    // Agrupar usuários por portal
    const getUsersByPortal = (portalId) => {
        return users.filter(u => u.allowedPortals?.includes(portalId));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-2xl">
                        <Users size={24} className="text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">
                            {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-200"
                >
                    <Plus size={18} />
                    Novo Usuário
                </button>
            </div>

            {/* Grid de Portais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {PORTALS.map(portal => {
                    const portalUsers = getUsersByPortal(portal.id);
                    const style = colorStyles[portal.color];
                    const Icon = portal.icon;

                    return (
                        <div key={portal.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            {/* Portal Header */}
                            <div className={`bg-gradient-to-r ${style.header} px-5 py-4 flex items-center gap-3`}>
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Icon size={20} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold">{portal.label}</h3>
                                    <p className="text-white/70 text-xs">{portal.description}</p>
                                </div>
                                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    {portalUsers.length} usuário{portalUsers.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Users List */}
                            <div className="p-4">
                                {portalUsers.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-6 italic">
                                        Nenhum usuário habilitado
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {portalUsers.map(user => (
                                            <div
                                                key={user.uid}
                                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                                            >
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${style.iconBg} ${style.text} font-bold text-sm`}>
                                                    {(user.name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-700 truncate">
                                                        {user.name || 'Sem nome'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 font-mono truncate">
                                                        {user.uid}
                                                    </p>
                                                </div>
                                                {/* Badges de outros portais */}
                                                <div className="hidden sm:flex gap-1">
                                                    {user.allowedPortals?.filter(p => p !== portal.id).map(p => {
                                                        const otherPortal = PORTALS.find(pp => pp.id === p);
                                                        if (!otherPortal) return null;
                                                        const otherStyle = colorStyles[otherPortal.color];
                                                        return (
                                                            <span key={p} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${otherStyle.badge}`}>
                                                                {otherPortal.label.split(' ')[0]}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                {/* Actions */}
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                                                        className="p-2 hover:bg-amber-100 rounded-lg transition-colors text-slate-400 hover:text-amber-600"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(user)}
                                                        className="p-2 hover:bg-rose-100 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
                                                        title="Remover"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modais */}
            <UserModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
                onSave={handleSave}
                editingUser={editingUser}
                isSaving={isSaving}
            />

            <DeleteModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                userName={deleteTarget?.name}
                isSaving={isSaving}
            />
        </div>
    );
};

export default UsuariosPage;
