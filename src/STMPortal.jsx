import React, { useState, useEffect, useRef } from 'react';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Eye, EyeOff, Lock, Mail, ClipboardList, LayoutDashboard, FileText, Package, Users, DollarSign, Shield, Download, ChevronLeft } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { Sidebar, Header } from './components/layout';

// Módulos
import PainelDespachos from './modules/despacho/PainelDespachos';
import ServidoresPage from './modules/despacho/ServidoresPage';
import PagamentosPage from './modules/despacho/PagamentosPage';
import UnitizadoresPage from './modules/despacho/UnitizadoresPage';
import NotasDespachoPage from './modules/despacho/NotasDespachoPage';
import AuditoriaPage from './modules/despacho/AuditoriaPage';
import ImportExportPage from './modules/despacho/ImportExportPage';

// Componente de Login Específico STM
const STMLoginPage = ({ onLogin, isLoading, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(email, password);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-8 border border-white/20">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/30 mb-4">
                        <ClipboardList size={32} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800">Portal STM</h1>
                    <p className="text-slate-500 text-sm mt-1">Gestão de Despachos e Cargas</p>
                </div>

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
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Entrando...
                            </>
                        ) : (
                            'Acessar Portal'
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

const stmMenuItems = [
    { id: 'despacho-painel', label: 'Painel de Despachos', icon: LayoutDashboard, module: 'despacho-painel' },
    { id: 'despacho-notas', label: 'Notas de Despacho', icon: FileText, module: 'despacho-notas' },
    { id: 'despacho-unitizadores', label: 'Unitizadores', icon: Package, module: 'despacho-unitizadores' },
    { id: 'despacho-servidores', label: 'Servidores', icon: Users, module: 'despacho-servidores' },
    { id: 'despacho-pagamentos', label: 'Pagamentos', icon: DollarSign, module: 'despacho-pagamentos' },
    { id: 'despacho-auditoria', label: 'Auditoria', icon: Shield, module: 'despacho-auditoria' },
    { id: 'despacho-importar', label: 'Importar/Exportar', icon: Download, module: 'despacho-importar' }
];

const STMPortal = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [currentView, setCurrentView] = useState('despacho-painel');
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

    useEffect(() => {
        document.title = "Portal STM | TIM Transportes";
    }, []);

    // Verificar autenticação
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Verificar acesso ao portal stm
                const accessDoc = await getDoc(doc(db, 'portalAccess', user.uid));
                if (accessDoc.exists() && accessDoc.data().allowedPortals?.includes('despacho_stm')) {
                    setIsAuthenticated(true);
                    setCurrentUser(user);
                } else {
                    await signOut(auth);
                    setIsAuthenticated(false);
                    setCurrentUser(null);
                }
            } else {
                setIsAuthenticated(false);
                setCurrentUser(null);
            }
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

            // Verificar acesso ao portal stm
            const accessDoc = await getDoc(doc(db, 'portalAccess', userCredential.user.uid));
            if (!accessDoc.exists() || !accessDoc.data().allowedPortals?.includes('despacho_stm')) {
                await signOut(auth);
                setLoginError('Você não tem permissão para acessar o Portal STM.');
                return;
            }
        } catch (error) {
            console.error('Erro no login STM:', error);
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
            setCurrentView('despacho-painel');
        } catch (error) {
            console.error('Erro ao sair:', error);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-500">Carregando Portal STM...</p>
                </div>
            </div>
        );
    }

    // Tela de Login
    if (!isAuthenticated) {
        return (
            <STMLoginPage
                onLogin={handleLogin}
                isLoading={isLoggingIn}
                error={loginError}
            />
        );
    }

    // Renderizar conteúdo baseado na view atual
    const renderContent = () => {
        switch (currentView) {
            case 'despacho-painel': return <PainelDespachos />;
            case 'despacho-servidores': return <ServidoresPage />;
            case 'despacho-notas': return <NotasDespachoPage />;
            case 'despacho-unitizadores': return <UnitizadoresPage />;
            case 'despacho-auditoria': return <AuditoriaPage />;
            case 'despacho-importar': return <ImportExportPage />;
            case 'despacho-pagamentos': return <PagamentosPage />;
            default: return <PainelDespachos />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 flex">
            {/* Sidebar Exclusiva STM (Flat menus) */}
            <Sidebar
                currentView={currentView}
                onNavigate={handleNavigateView}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                items={stmMenuItems}
                hideSettings={true}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen w-full overflow-hidden">
                <Header
                    currentView={currentView}
                    onLogout={handleLogout}
                    userName={currentUser?.email || "Usuário STM"}
                />

                <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default STMPortal;
