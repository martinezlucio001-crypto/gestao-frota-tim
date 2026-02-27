import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

const InstallAppButton = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [isIos, setIsIos] = useState(false);

    useEffect(() => {
        // Regra 1: Apenas no novo link (ou localhost para testes locais)
        const isNewHostname = window.location.hostname === 'app.timtransportespa.com.br' || window.location.hostname === 'localhost';

        // Regra 2: Não exibir se já for standalone
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIos(isIosDevice);

        if (isNewHostname && !isStandalone) {
            setIsVisible(true);
        }

        // Para Android: Capturar o evento de prompt de instalação
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (isIos) {
            setShowIosGuide(true);
        } else if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsVisible(false);
            }
            setDeferredPrompt(null);
        } else {
            // Se o deferredPrompt não disparou no Android (talvez por já ter instalado mas não estar em standalone, ou bloqueio do browser)
            alert('Para instalar, toque no menu do navegador (3 pontinhos) e escolha "Adicionar à tela inicial" ou "Instalar aplicativo".');
        }
    };

    if (!isVisible) return null;

    return (
        <>
            <button
                onClick={handleInstallClick}
                className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold border border-slate-700 hover:bg-slate-800 transition-colors"
                style={{ animation: 'slideInFromTop 0.3s ease-out forwards' }}
            >
                <Download size={16} className="animate-bounce" />
                Instalar App
            </button>

            {/* Modal para iOS */}
            {showIosGuide && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end justify-center sm:items-center p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl pb-8 sm:pb-6 relative animate-in slide-in-from-bottom">
                        <button
                            onClick={() => setShowIosGuide(false)}
                            className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800"
                        >
                            <X size={20} />
                        </button>

                        <div className="text-center mb-6 mt-2">
                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                                <Download size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Instalar App no iPhone</h3>
                            <p className="text-sm text-slate-500 mt-2">
                                Para ter a melhor experiência e não precisar digitar o endereço, instale o app.
                            </p>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="bg-white p-2 text-blue-500 rounded-lg shadow-sm border border-slate-200">
                                    <Share size={24} />
                                </div>
                                <p className="text-sm font-medium text-slate-700">
                                    1. Toque no ícone de <span className="font-bold text-blue-600">Compartilhar</span> na barra inferior do Safari
                                </p>
                            </div>

                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="bg-white p-2 text-slate-700 rounded-lg shadow-sm border border-slate-200">
                                    <PlusSquare size={24} />
                                </div>
                                <p className="text-sm font-medium text-slate-700">
                                    2. Escolha <span className="font-bold text-slate-900">Adicionar à Tela de Início</span>
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIosGuide(false)}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl text-center active:bg-blue-700 transition-colors"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallAppButton;
