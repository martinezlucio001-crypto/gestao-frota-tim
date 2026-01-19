import React, { useState, useEffect, useRef } from 'react';
import { Fuel, Camera, Check, Loader2, LogOut, History, AlertCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Firebase config (mesmo do App.jsx)
const firebaseConfig = {
    apiKey: "AIzaSyBxRfLqGLieFe7Be97cGYNkQStG3BbLzXg",
    authDomain: "nimble-willow-461118-s7.firebaseapp.com",
    projectId: "nimble-willow-461118-s7",
    storageBucket: "nimble-willow-461118-s7.firebasestorage.app",
    messagingSenderId: "393877912498",
    appId: "1:393877912498:web:9d5b3a23c0c2f6e8e7c3a9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = "frota-tim-oficial";

// Formatador de data BR
const formatDateBR = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Componente de captura de câmera com marca d'água
const CameraCapture = ({ onCapture, label, plate }) => {
    const inputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setProcessing(true);

        // Criar imagem
        const img = new Image();
        img.onload = () => {
            // Criar canvas
            const canvas = document.createElement('canvas');
            const maxWidth = 1200;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Adicionar marca d'água
            const now = new Date();
            const watermark = `📅 ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')} | 🚛 ${plate}`;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(watermark, canvas.width / 2, canvas.height - 14);

            // Converter para blob
            canvas.toBlob((blob) => {
                const previewUrl = URL.createObjectURL(blob);
                setPreview(previewUrl);
                onCapture(blob);
                setProcessing(false);
            }, 'image/jpeg', 0.85);
        };

        img.src = URL.createObjectURL(file);
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
    const [truck, setTruck] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [recentEntries, setRecentEntries] = useState([]);

    const [formData, setFormData] = useState({
        liters: '',
        totalCost: '',
        newMileage: ''
    });
    const [odometerPhoto, setOdometerPhoto] = useState(null);
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

    // Carregar registros recentes
    const loadRecentEntries = async (truckId) => {
        try {
            const q = query(
                collection(db, `artifacts/${appId}/fuelEntries`),
                where('truckId', '==', truckId),
                orderBy('date', 'desc'),
                limit(5)
            );
            const snapshot = await getDocs(q);
            setRecentEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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
            // Buscar caminhão com esse CPF e senha
            const q = query(
                collection(db, `artifacts/${appId}/trucks`),
                where('driverCpf', '==', cpf.replace(/\D/g, '')),
                where('driverPassword', '==', password)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setLoginError('CPF ou senha incorretos');
                setIsLoading(false);
                return;
            }

            const truckData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            setTruck(truckData);
            setIsLoggedIn(true);
            localStorage.setItem('driverTruck', JSON.stringify(truckData));
            loadRecentEntries(truckData.id);
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
    };

    // Upload de foto
    const uploadPhoto = async (blob, type) => {
        const filename = `${truck.id}_${type}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `${appId}/photos/${filename}`);
        await uploadBytes(storageRef, blob);
        return getDownloadURL(storageRef);
    };

    // Salvar abastecimento
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!odometerPhoto || !receiptPhoto) {
            alert('Tire as duas fotos antes de enviar!');
            return;
        }

        setIsSaving(true);
        setSaveSuccess(false);

        try {
            // Upload das fotos
            const [odometerUrl, receiptUrl] = await Promise.all([
                uploadPhoto(odometerPhoto, 'odometer'),
                uploadPhoto(receiptPhoto, 'receipt')
            ]);

            // Criar registro
            const now = new Date();
            const entry = {
                truckId: truck.id,
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].slice(0, 5),
                liters: Number(formData.liters),
                totalCost: Number(formData.totalCost),
                newMileage: Number(formData.newMileage),
                odometerUrl,
                receiptUrl,
                registeredBy: 'driver',
                createdAt: now.toISOString()
            };

            await addDoc(collection(db, `artifacts/${appId}/fuelEntries`), entry);

            // Limpar formulário
            setFormData({ liters: '', totalCost: '', newMileage: '' });
            setOdometerPhoto(null);
            setReceiptPhoto(null);
            setSaveSuccess(true);
            loadRecentEntries(truck.id);

            // Limpar mensagem de sucesso após 3s
            setTimeout(() => setSaveSuccess(false), 3000);
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
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Digite sua senha"
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
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
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <p className="text-indigo-200 text-xs">Motorista</p>
                    <p className="font-bold">{truck.driver}</p>
                </div>
                <div className="text-right">
                    <p className="text-indigo-200 text-xs">Veículo</p>
                    <p className="font-bold">{truck.plate}</p>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-indigo-700 rounded-xl">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="p-4 max-w-lg mx-auto">
                {/* Mensagem de sucesso */}
                {saveSuccess && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2">
                        <Check size={20} />
                        <span className="font-medium">Abastecimento registrado com sucesso!</span>
                    </div>
                )}

                {/* Formulário */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Fuel size={20} className="text-indigo-600" />
                        Novo Abastecimento
                    </h2>

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
                            label="Foto do Odômetro"
                            plate={truck.plate}
                            onCapture={setOdometerPhoto}
                        />

                        <CameraCapture
                            label="Foto da Nota Fiscal"
                            plate={truck.plate}
                            onCapture={setReceiptPhoto}
                        />

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
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

                {/* Histórico recente */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <History size={20} className="text-indigo-600" />
                        Últimos Registros
                    </h2>

                    {recentEntries.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4">Nenhum registro ainda</p>
                    ) : (
                        <div className="space-y-3">
                            {recentEntries.map((entry) => (
                                <div key={entry.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
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
            </div>
        </div>
    );
};

export default DriverPortal;
