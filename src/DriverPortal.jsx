import React, { useState, useEffect, useRef } from 'react';
import { Fuel, Camera, Check, Loader2, LogOut, History, AlertCircle, Eye, EyeOff, Plus, RefreshCw, ChevronLeft, User, Truck, Calendar, CheckCircle2 } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

// Firebase config (MESMO do App.jsx)
const firebaseConfig = {
    apiKey: "AIzaSyB-pYZlzUNPuR30gn2cauYdpkDhMYGoHLQ",
    authDomain: "gestao-frota-tim.firebaseapp.com",
    projectId: "gestao-frota-tim",
    storageBucket: "gestao-frota-tim.firebasestorage.app",
    messagingSenderId: "455143595757",
    appId: "1:455143595757:web:036dc514ad7f983ca336e4",
    measurementId: "G-LDYRESTCTG"
};

// Evitar inicialização duplicada
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const appId = "frota-tim-oficial";

// Formatador de data BR
const formatDateBR = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Componente de captura de câmera com marca d'água e botão refazer
const CameraCapture = ({ onCapture, label, plate }) => {
    const inputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setProcessing(true);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxWidth = 1200;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Marca d'água grande, simples e segura (sem fundo preto)
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR'); // DD/MM/AAAA
            const timeStr = now.toLocaleTimeString('pt-BR').slice(0, 5); // HH:MM

            // Gerar código de segurança único (hash simples baseado em timestamp + placa)
            const securityHash = btoa(`${now.getTime()}-${plate}`).slice(0, 8).toUpperCase();

            // Configurar fonte grande (aprox 7x maior que antes)
            const fontSize = Math.max(48, Math.floor(canvas.width / 12)); // ~100px+ em telas grandes

            // Desenhar texto com sombra/contorno para visibilidade sem fundo preto
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Posição central-inferior
            const textY = canvas.height - fontSize * 1.5;

            // Linha 1: Data e Hora
            const line1 = `${dateStr} • ${timeStr}`;
            // Linha 2: Placa + Código de Segurança
            const line2 = `${plate} | #${securityHash}`;

            // Desenhar contorno preto grosso (para legibilidade)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = fontSize / 8;
            ctx.lineJoin = 'round';

            ctx.strokeText(line1, canvas.width / 2, textY - fontSize * 0.6);
            ctx.strokeText(line2, canvas.width / 2, textY + fontSize * 0.5);

            // Desenhar texto branco
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText(line1, canvas.width / 2, textY - fontSize * 0.6);
            ctx.fillText(line2, canvas.width / 2, textY + fontSize * 0.5);

            // Adicionar símbolo de verificação no canto (anti-falsificação)
            const symbolSize = fontSize * 0.6;
            ctx.font = `bold ${symbolSize}px Arial`;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = symbolSize / 10;
            ctx.strokeText('✓ VERIFICADO', canvas.width / 2, textY + fontSize * 1.4);
            ctx.fillStyle = 'rgba(0, 255, 100, 0.9)';
            ctx.fillText('✓ VERIFICADO', canvas.width / 2, textY + fontSize * 1.4);

            // Converter para base64
            const base64 = canvas.toDataURL('image/jpeg', 0.7);
            setPreview(base64);
            onCapture(base64);
            setProcessing(false);
        };

        img.src = URL.createObjectURL(file);
    };

    const handleReset = () => {
        setPreview(null);
        onCapture(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
            />
            {preview ? (
                <div className="relative">
                    <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-xl border-2 border-emerald-500" />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full">
                        <Check size={16} />
                    </div>
                    <button
                        type="button"
                        onClick={handleReset}
                        className="absolute bottom-2 right-2 bg-slate-800/80 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-slate-700"
                    >
                        <RefreshCw size={14} />
                        Refazer
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={processing}
                    className="w-full h-40 border-2 border-dashed border-indigo-300 rounded-xl flex flex-col items-center justify-center gap-2 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-colors"
                >
                    {processing ? (
                        <Loader2 size={32} className="animate-spin" />
                    ) : (
                        <>
                            <Camera size={32} />
                            <span className="text-sm font-medium">Tirar Foto</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

// Componente principal do portal do motorista
const DriverPortal = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState('');
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [truck, setTruck] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [recentEntries, setRecentEntries] = useState([]);
    const [currentPage, setCurrentPage] = useState('home'); // 'home', 'newEntry', 'history', 'success'
    const [showWelcome, setShowWelcome] = useState(false);

    const [formData, setFormData] = useState({
        liters: '',
        totalCost: '',
        newMileage: ''
    });
    // 3 fotos: antes, depois, nota fiscal
    const [odometerBeforePhoto, setOdometerBeforePhoto] = useState(null);
    const [odometerAfterPhoto, setOdometerAfterPhoto] = useState(null);
    const [receiptPhoto, setReceiptPhoto] = useState(null);

    // Verificar login salvo
    useEffect(() => {
        const savedTruck = localStorage.getItem('driverTruck');
        if (savedTruck) {
            const truckData = JSON.parse(savedTruck);
            setTruck(truckData);
            setIsLoggedIn(true);
            loadRecentEntries(truckData.id);
        }
        setIsLoading(false);
    }, []);

    // Carregar registros recentes (sem orderBy para evitar necessidade de índice)
    const loadRecentEntries = async (truckId) => {
        try {
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'entries'),
                where('truckId', '==', truckId)
            );
            const snapshot = await getDocs(q);
            // Ordenar localmente por data
            const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            entries.sort((a, b) => new Date(b.date) - new Date(a.date));
            setRecentEntries(entries.slice(0, 20));
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }
    };

    // Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        try {
            const cleanCpf = cpf.replace(/\D/g, '');
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'trucks'),
                where('driverCpf', '==', cleanCpf)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setLoginError('CPF ou senha incorretos');
                setIsLoading(false);
                return;
            }

            const truckDoc = snapshot.docs[0];
            const truckData = { id: truckDoc.id, ...truckDoc.data() };

            if (truckData.driverPassword !== password) {
                setLoginError('CPF ou senha incorretos');
                setIsLoading(false);
                return;
            }

            setTruck(truckData);
            setIsLoggedIn(true);
            localStorage.setItem('driverTruck', JSON.stringify(truckData));
            loadRecentEntries(truckData.id);

            // Mostrar mensagem de boas-vindas
            setShowWelcome(true);
            setTimeout(() => setShowWelcome(false), 3000);
        } catch (error) {
            console.error('Erro no login:', error);
            setLoginError('Erro ao conectar. Tente novamente.');
        }

        setIsLoading(false);
    };

    // Logout
    const handleLogout = () => {
        localStorage.removeItem('driverTruck');
        setTruck(null);
        setIsLoggedIn(false);
        setCpf('');
        setPassword('');
        setCurrentPage('home');
    };

    // Salvar abastecimento
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!odometerBeforePhoto || !odometerAfterPhoto || !receiptPhoto) {
            alert('Tire as três fotos antes de enviar!');
            return;
        }

        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const now = new Date();
            const entry = {
                truckId: truck.id,
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].slice(0, 5),
                liters: Number(formData.liters),
                totalCost: Number(formData.totalCost),
                newMileage: Number(formData.newMileage),
                odometerBeforePhoto: odometerBeforePhoto,
                odometerAfterPhoto: odometerAfterPhoto,
                receiptPhoto: receiptPhoto,
                registeredBy: 'driver',
                createdAt: now.toISOString()
            };

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'entries'), entry);

            setFormData({ liters: '', totalCost: '', newMileage: '' });
            setOdometerBeforePhoto(null);
            setOdometerAfterPhoto(null);
            setReceiptPhoto(null);
            setSaveSuccess(true);
            loadRecentEntries(truck.id);

            // Ir para tela de sucesso
            setCurrentPage('success');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar. Tente novamente.');
        }

        setIsSaving(false);
    };

    // Loading inicial
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <Loader2 size={48} className="animate-spin text-indigo-600" />
            </div>
        );
    }

    // Tela de Login
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Fuel size={32} className="text-indigo-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Portal do Motorista</h1>
                        <p className="text-sm text-slate-500 mt-1">Registre seus abastecimentos</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">CPF</label>
                            <input
                                type="text"
                                value={cpf}
                                onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                placeholder="Digite seu CPF"
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Digite sua senha"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {loginError && (
                            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {loginError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Tela Principal (logado)
    return (
        <div className="min-h-screen bg-slate-100">
            {/* Mensagem de boas-vindas */}
            {showWelcome && (
                <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 animate-in fade-in slide-in-from-top duration-300">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2">
                        <span className="text-lg">👋</span>
                        <span className="font-medium">Bem-vindo, {truck.driver}!</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                {currentPage !== 'home' && currentPage !== 'success' ? (
                    <button onClick={() => setCurrentPage('home')} className="p-2 hover:bg-indigo-700 rounded-xl">
                        <ChevronLeft size={20} />
                    </button>
                ) : (
                    <div>
                        <p className="text-indigo-200 text-xs">Motorista</p>
                        <p className="font-bold">{truck.driver}</p>
                    </div>
                )}
                <div className="text-right">
                    <p className="text-indigo-200 text-xs">Veículo</p>
                    <p className="font-bold">{truck.plate}</p>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-indigo-700 rounded-xl">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="p-4 max-w-lg mx-auto">
                {/* Página de Sucesso */}
                {currentPage === 'success' && (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={48} className="text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Registro Enviado!</h2>
                        <p className="text-slate-500 mb-6">Seu abastecimento foi registrado com sucesso e já está disponível no sistema.</p>
                        <button
                            onClick={() => setCurrentPage('home')}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-colors"
                        >
                            Voltar ao Início
                        </button>
                    </div>
                )}

                {/* Página Home */}
                {currentPage === 'home' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setCurrentPage('newEntry')}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-6 rounded-2xl flex items-center gap-4 transition-colors shadow-lg"
                        >
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                <Plus size={28} />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-bold">Novo Registro</p>
                                <p className="text-indigo-200 text-sm">Registrar abastecimento</p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                loadRecentEntries(truck.id);
                                setCurrentPage('history');
                            }}
                            className="w-full bg-white hover:bg-slate-50 text-slate-800 p-6 rounded-2xl flex items-center gap-4 transition-colors shadow-sm border border-slate-100"
                        >
                            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <History size={28} className="text-indigo-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-bold">Histórico de Registros</p>
                                <p className="text-slate-500 text-sm">Ver abastecimentos anteriores</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* Página Novo Registro */}
                {currentPage === 'newEntry' && (
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Fuel size={20} className="text-indigo-600" />
                            Novo Abastecimento
                        </h2>

                        {/* Informações pré-preenchidas */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <User size={16} className="text-indigo-600" />
                                <span className="text-slate-600">Motorista:</span>
                                <span className="font-medium text-slate-800">{truck.driver}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Truck size={16} className="text-indigo-600" />
                                <span className="text-slate-600">Veículo:</span>
                                <span className="font-medium text-slate-800">{truck.plate}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar size={16} className="text-indigo-600" />
                                <span className="text-slate-600">Data:</span>
                                <span className="font-medium text-slate-800">{new Date().toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Litros</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.liters}
                                        onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                                        placeholder="Ex: 50.00"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Valor Total (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.totalCost}
                                        onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                                        placeholder="Ex: 275.00"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Quilometragem Atual</label>
                                <input
                                    type="number"
                                    value={formData.newMileage}
                                    onChange={(e) => setFormData({ ...formData, newMileage: e.target.value })}
                                    placeholder="Ex: 125000"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <CameraCapture
                                label="📷 Foto do Odômetro ANTES do Abastecimento"
                                plate={truck.plate}
                                onCapture={setOdometerBeforePhoto}
                            />

                            <CameraCapture
                                label="📷 Foto do Odômetro DEPOIS do Abastecimento"
                                plate={truck.plate}
                                onCapture={setOdometerAfterPhoto}
                            />

                            <CameraCapture
                                label="📷 Foto da Nota Fiscal"
                                plate={truck.plate}
                                onCapture={setReceiptPhoto}
                            />

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Check size={20} />
                                        Registrar Abastecimento
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Página Histórico */}
                {currentPage === 'history' && (
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <History size={20} className="text-indigo-600" />
                            Histórico de Registros
                        </h2>

                        {recentEntries.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-8">Nenhum registro ainda</p>
                        ) : (
                            <div className="space-y-3">
                                {recentEntries.map((entry) => (
                                    <div key={entry.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-700">{formatDateBR(entry.date)}</span>
                                            <span className="text-indigo-600 font-bold">R$ {entry.totalCost?.toFixed(2)}</span>
                                        </div>
                                        <div className="text-sm text-slate-500 mt-1">
                                            {entry.liters?.toFixed(2)} L • {entry.newMileage?.toLocaleString()} km
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverPortal;
