import React from 'react';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { cn } from '../../lib/utils';

// Mapeamento de views para títulos
const viewTitles = {
    'dashboard': { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
    'combustivel-dashboard': { title: 'Gestão de Combustível', subtitle: 'Painel de controle' },
    'combustivel-trucks': { title: 'Frota', subtitle: 'Veículos cadastrados no sistema' },
    'combustivel-maintenance': { title: 'Manutenção', subtitle: 'Histórico e agendamentos' },
    'combustivel-data': { title: 'Gestão de Dados', subtitle: 'Importação e exportação' },
    'despacho-painel': { title: 'Painel de Despachos', subtitle: 'Todos os despachos registrados' },
    'despacho-servidores': { title: 'Servidores', subtitle: 'Prestadores de serviço cadastrados' },
    'despacho-pagamentos': { title: 'Gestão de Pagamentos', subtitle: 'Controle financeiro' },
    'settings': { title: 'Configurações', subtitle: 'Preferências do sistema' },
    'sistema-usuarios': { title: 'Usuários', subtitle: 'Gerenciar acesso aos portais' },
};

export const Header = ({ currentView, onLogout, userName = "Administrador" }) => {
    const { title, subtitle } = viewTitles[currentView] || { title: 'TIM Transportes', subtitle: '' };

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="flex items-center justify-between h-16 px-6 lg:px-8">
                {/* Título da página */}
                <div className="lg:ml-0 ml-14">
                    <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                    {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Search (futuro) */}
                    <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                        <Search size={20} />
                    </button>

                    {/* Notifications (futuro) */}
                    <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 relative">
                        <Bell size={20} />
                        {/* Badge de notificação */}
                        {/* <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span> */}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>

                    {/* User Menu */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-slate-700">{userName}</p>
                            <p className="text-xs text-slate-400">Administrador</p>
                        </div>
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-200">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        onClick={onLogout}
                        className="p-2 hover:bg-rose-50 rounded-xl transition-colors text-slate-400 hover:text-rose-600 ml-2"
                        title="Sair do sistema"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
