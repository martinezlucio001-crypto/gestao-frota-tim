import React, { useState, useEffect, useRef } from 'react';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Eye, EyeOff, Truck, Lock, Mail, Package, ChevronLeft } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { Sidebar, Header } from './components/layout';

// Módulos
import DashboardGeral from './modules/dashboard/DashboardGeral';
import CombustivelModule from './modules/combustivel/CombustivelModule';
import PainelDespachos from './modules/despacho/PainelDespachos';
import ServidoresPage from './modules/despacho/ServidoresPage';
import PagamentosPage from './modules/despacho/PagamentosPage';
import UnitizadoresPage from './modules/despacho/UnitizadoresPage';
import NotasDespachoPage from './modules/despacho/NotasDespachoPage';
import AuditoriaPage from './modules/despacho/AuditoriaPage';
import ImportExportPage from './modules/despacho/ImportExportPage';
import ServidorModal from './modules/despacho/modals/ServidorModal';

import ContratosPage from './modules/receita/ContratosPage';
import NotasPage from './modules/receita/NotasPage';
import ReceitaDashboard from './modules/receita/ReceitaDashboard';

import UsuariosPage from './modules/sistema/UsuariosPage';

// Componente de Login
const LoginPage = ({ onLogin, isLoading, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(email, password);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white/20">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl text-white shadow-lg shadow-indigo-500/30 mb-4">
                        <Truck size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">TIM Transportes</h1>
                    <p className="text-slate-500 text-sm mt-1">Sistema de Gestão Empresarial</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Entrando...
                            </>
                        ) : (
                            'Entrar no Sistema'
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <a
                        href="/"
                        className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors inline-flex items-center gap-1"
                    >
                        <ChevronLeft size={16} />
                        Voltar
                    </a>
                </div>


            </div>
        </div>
    );
};

// Shell Principal
const GestaoTIM = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const scrollPositions = useRef({});

    const handleNavigateView = (newView) => {
        if (newView === currentView) return;
        scrollPositions.current[currentView] = window.scrollY;
        setCurrentView(newView);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            window.scrollTo({
                top: scrollPositions.current[currentView] || 0,
                behavior: 'instant'
            });
        }, 10);
        return () => clearTimeout(timer);
    }, [currentView]);

    // Verificar autenticação
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user);
            setCurrentUser(user);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Login
    const handleLogin = async (email, password) => {
        setIsLoggingIn(true);
        setLoginError('');
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Verificar acesso ao portal admin
            const accessDoc = await getDoc(doc(db, 'portalAccess', userCredential.user.uid));
            if (!accessDoc.exists() || !accessDoc.data().allowedPortals?.includes('admin')) {
                await signOut(auth);
                setLoginError('Você não tem permissão para acessar o painel administrativo.');
                return;
            }
        } catch (error) {
            console.error('Erro no login:', error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
                setLoginError('E-mail ou senha incorretos.');
            } else if (error.code === 'auth/too-many-requests') {
                setLoginError('Muitas tentativas. Tente novamente mais tarde.');
            } else {
                setLoginError('Erro ao fazer login. Tente novamente.');
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Logout
    const handleLogout = async () => {
        try {
            await signOut(auth);
            setCurrentView('dashboard');
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-500">Carregando...</p>
                </div>
            </div>
        );
    }

    // Tela de Login
    if (!isAuthenticated) {
        return (
            <LoginPage
                onLogin={handleLogin}
                isLoading={isLoggingIn}
                error={loginError}
            />
        );
    }

    // Renderizar conteúdo baseado na view atual
    const renderContent = () => {
        switch (currentView) {
            case 'dashboard':
                return <DashboardGeral onNavigate={handleNavigateView} />;

            // Módulo Combustível
            case 'combustivel-dashboard':
            case 'combustivel-trucks':
            case 'combustivel-maintenance':
            case 'combustivel-data':
                return <CombustivelModule view={currentView.replace('combustivel-', '')} user={currentUser} />;

            // Módulo Despacho
            case 'despacho-painel':
                return <PainelDespachos />;
            case 'despacho-servidores':
                return <ServidoresPage />;
            case 'despacho-notas': return <NotasDespachoPage />;
            case 'despacho-unitizadores': return <UnitizadoresPage />;
            case 'despacho-auditoria': return <AuditoriaPage />;
            case 'despacho-importar': return <ImportExportPage />;

            // Módulo Receita
            case 'receita-painel':
                return <ReceitaDashboard />;
            case 'receita-notas':
                return <NotasPage />;
            case 'receita-contratos':
                return <ContratosPage />;

            // Configurações
            case 'settings':
                return (
                    <div className="text-center py-20">
                        <p className="text-slate-500">Configurações em desenvolvimento...</p>
                    </div>
                );

            // Módulo Sistema
            case 'sistema-usuarios':
                return <UsuariosPage />;

            // Módulo Financeiro
            case 'financeiro-painel':
                return (
                    <div className="text-center py-20">
                        <p className="text-slate-500">Módulo Financeiro em desenvolvimento...</p>
                    </div>
                );

            // Módulo Cargas
            case 'cargas':
                return (
                    <div className="text-center py-20">
                        <div className="mb-4 bg-indigo-50 inline-block p-4 rounded-full">
                            <Package size={48} className="text-indigo-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Módulo de Cargas</h2>
                        <p className="text-slate-500">Funcionalidade em desenvolvimento...</p>
                    </div>
                );

            default:
                return <DashboardGeral onNavigate={handleNavigateView} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 flex">
            {/* Sidebar */}
            <Sidebar
                currentView={currentView}
                onNavigate={handleNavigateView}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                <Header
                    currentView={currentView}
                    onLogout={handleLogout}
                />

                <main className="flex-1 p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default GestaoTIM;
