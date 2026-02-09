import React, { useState } from 'react';
import {
    LayoutDashboard,
    Fuel,
    Ship,
    ChevronRight,
    ChevronLeft,
    Truck,
    Users,
    CreditCard,
    FileText,
    Settings,
    LogOut,
    Menu,
    X,
    DollarSign,
    Package
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Estrutura do menu com módulos e submódulos
const menuItems = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        module: 'dashboard'
    },
    {
        id: 'financeiro',
        label: 'Financeiro',
        icon: DollarSign, // Using DollarSign
        module: 'financeiro',
        submenu: [
            { id: 'financeiro-painel', label: 'Visão Geral', view: 'financeiro-painel' },
        ]
    },
    {
        id: 'receita',
        label: 'Receita',
        icon: CreditCard,
        module: 'receita',
        submenu: [
            { id: 'receita-painel', label: 'Painel de Receita', view: 'receita-painel' },
            { id: 'receita-notas', label: 'Notas', view: 'receita-notas' },
            { id: 'receita-contratos', label: 'Contratos', view: 'receita-contratos' },
        ]
    },
    {
        id: 'despacho',
        label: 'Despachos',
        icon: Ship,
        module: 'despacho',
        submenu: [
            { id: 'despacho-painel', label: 'Painel de Despachos', view: 'despacho-painel' },
            { id: 'despacho-servidores', label: 'Servidores', view: 'despacho-servidores' },
            { id: 'despacho-pagamentos', label: 'Pagamentos', view: 'despacho-pagamentos' },
        ]
    },
    {
        id: 'cargas',
        label: 'Cargas',
        icon: Package,
        module: 'cargas'
    },
    {
        id: 'combustivel',
        label: 'Combustível',
        icon: Fuel,
        module: 'combustivel',
        submenu: [
            { id: 'combustivel-painel', label: 'Painel', view: 'combustivel-dashboard' },
            { id: 'combustivel-frota', label: 'Frota', view: 'combustivel-trucks' },
            { id: 'combustivel-manutencao', label: 'Manutenção', view: 'combustivel-maintenance' },
            { id: 'combustivel-dados', label: 'Dados', view: 'combustivel-data' },
        ]
    }
];

export const Sidebar = ({ currentView, onNavigate, isCollapsed, onToggleCollapse }) => {
    const [expandedMenus, setExpandedMenus] = useState(['combustivel', 'despacho', 'receita', 'financeiro']);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const toggleSubmenu = (menuId) => {
        setExpandedMenus(prev =>
            prev.includes(menuId)
                ? prev.filter(id => id !== menuId)
                : [...prev, menuId]
        );
    };

    const handleNavigate = (view) => {
        onNavigate(view);
        setIsMobileOpen(false);
    };

    const isActive = (item) => {
        if (item.view) return currentView === item.view;
        if (item.submenu) return item.submenu.some(sub => currentView === sub.view);
        return currentView === item.module;
    };

    const SidebarContent = () => (
        <>
            {/* Logo / Header */}
            <div className={cn(
                "h-20 flex items-center border-b border-slate-100 px-4",
                isCollapsed ? "justify-center" : "justify-between"
            )}>
                {!isCollapsed ? (
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <Truck size={22} />
                        </div>
                        <div>
                            <span className="font-black text-lg tracking-tight block text-slate-800">TIM Transportes</span>
                            <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-widest">Gestão Empresarial</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <Truck size={22} />
                    </div>
                )}

                {/* Botão de colapsar - apenas desktop */}
                <button
                    onClick={onToggleCollapse}
                    className={cn(
                        "hidden lg:flex p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400",
                        isCollapsed && "absolute -right-3 bg-white border border-slate-200 shadow-sm"
                    )}
                >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                {menuItems.map(item => (
                    <div key={item.id} className="mb-1">
                        {/* Item Principal */}
                        <button
                            onClick={() => item.submenu ? toggleSubmenu(item.id) : handleNavigate(item.module)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                                isActive(item)
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon size={20} className={isActive(item) ? "text-indigo-600" : ""} />
                            {!isCollapsed && (
                                <>
                                    <span className="flex-1 font-medium text-sm">{item.label}</span>
                                    {item.submenu && (
                                        <ChevronRight
                                            size={16}
                                            className={cn(
                                                "transition-transform text-slate-400",
                                                expandedMenus.includes(item.id) && "rotate-90"
                                            )}
                                        />
                                    )}
                                </>
                            )}
                        </button>

                        {/* Submenu */}
                        {item.submenu && !isCollapsed && expandedMenus.includes(item.id) && (
                            <div className="ml-4 mt-1 pl-4 border-l-2 border-slate-100 space-y-1">
                                {item.submenu.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => handleNavigate(sub.view)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left text-sm",
                                            currentView === sub.view
                                                ? "bg-indigo-100 text-indigo-700 font-semibold"
                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            currentView === sub.view ? "bg-indigo-500" : "bg-slate-300"
                                        )} />
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-slate-100 p-3">
                <button
                    onClick={() => handleNavigate('settings')}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-slate-600 hover:bg-slate-50",
                        isCollapsed && "justify-center"
                    )}
                >
                    <Settings size={20} />
                    {!isCollapsed && <span className="text-sm font-medium">Configurações</span>}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
            >
                <Menu size={24} className="text-slate-600" />
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <div className={cn(
                "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300",
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <button
                    onClick={() => setIsMobileOpen(false)}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg"
                >
                    <X size={20} className="text-slate-500" />
                </button>
                <SidebarContent />
            </div>

            {/* Desktop Sidebar */}
            <aside className={cn(
                "hidden lg:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 h-screen sticky top-0",
                isCollapsed ? "w-20" : "w-72"
            )}>
                <SidebarContent />
            </aside>
        </>
    );
};

export default Sidebar;
