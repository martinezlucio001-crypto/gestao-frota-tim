import React, { useState, useEffect, useRef } from 'react';
import { Fuel, Camera, Check, Loader2, LogOut, History, AlertCircle, Eye, EyeOff, Plus, RefreshCw, ChevronLeft, User, Truck, Calendar, CheckCircle2, Wrench, AlertTriangle, Image } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, appId } from './lib/firebase';
import heic2any from 'heic2any';
import InstallAppButton from './components/InstallAppButton';

// Formatador de data BR
const formatDateBR = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Componente de captura de câmera com marca d'água e botão refazer
const CameraCapture = ({ onCapture, label, plate }) => {
    const inputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log('Iniciando processamento de imagem:', file.name, file.type, file.size);
        setProcessing(true);

        // Timeout de segurança - 30 segundos máximo
        const timeoutId = setTimeout(() => {
            console.error('Timeout ao processar imagem');
            setProcessing(false);
            alert('Tempo esgotado ao processar imagem. Tente novamente.');
        }, 30000);

        const cleanup = () => {
            clearTimeout(timeoutId);
            setProcessing(false);
        };

        try {
            let fileToProcess = file;

            // Verificar se é HEIC/HEIF (comum em iPhones)
            const isHeic = file.type === 'image/heic' ||
                file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif');

            if (isHeic) {
                console.log('Arquivo HEIC detectado, convertendo...');
                try {
                    const convertedBlob = await heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.8
                    });
                    fileToProcess = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    console.log('Conversão HEIC concluída');
                } catch (heicError) {
                    console.error('Erro ao converter HEIC:', heicError);
                    cleanup();
                    alert('Erro ao processar imagem HEIC. Por favor, tire uma nova foto diretamente pela câmera ou use uma imagem JPG/PNG.');
                    return;
                }
            }

            // Processar imagem - múltiplos métodos de fallback para máxima compatibilidade
            const processImage = async (imageFile) => {
                console.log('processImage iniciado para:', imageFile.name || 'blob', 'tipo:', imageFile.type, 'tamanho:', imageFile.size);

                const applyWatermarkAndConvert = (imgSource, width, height) => {
                    const canvas = document.createElement('canvas');
                    const maxWidth = 1200;
                    const scale = Math.min(1, maxWidth / width);
                    canvas.width = width * scale;
                    canvas.height = height * scale;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);

                    // Marca d'água
                    const now = new Date();
                    const dateStr = now.toLocaleDateString('pt-BR');
                    const timeStr = now.toLocaleTimeString('pt-BR').slice(0, 5);
                    const fontSize = Math.max(32, Math.floor(canvas.width / 18));
                    const watermarkText = `${dateStr}; ${timeStr}, ${plate}`;
                    const textY = canvas.height - fontSize * 0.8;

                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                    ctx.lineWidth = fontSize / 6;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(watermarkText, canvas.width / 2, textY);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.fillText(watermarkText, canvas.width / 2, textY);

                    return canvas.toDataURL('image/jpeg', 0.7);
                };

                // Método 1: createImageBitmap (mais moderno e robusto)
                try {
                    console.log('Tentando createImageBitmap...');
                    const bitmap = await createImageBitmap(imageFile);
                    console.log('createImageBitmap sucesso:', bitmap.width, 'x', bitmap.height);
                    const result = applyWatermarkAndConvert(bitmap, bitmap.width, bitmap.height);
                    bitmap.close();
                    return result;
                } catch (bitmapError) {
                    console.warn('createImageBitmap falhou:', bitmapError.message);
                }

                // Método 2: createObjectURL + Image
                try {
                    console.log('Tentando createObjectURL...');
                    const objectUrl = URL.createObjectURL(imageFile);
                    const img = await new Promise((resolve, reject) => {
                        const image = new window.Image();
                        image.onload = () => resolve(image);
                        image.onerror = () => reject(new Error('Image load failed'));
                        image.src = objectUrl;
                    });
                    console.log('createObjectURL sucesso:', img.width, 'x', img.height);
                    const result = applyWatermarkAndConvert(img, img.width, img.height);
                    URL.revokeObjectURL(objectUrl);
                    return result;
                } catch (urlError) {
                    console.warn('createObjectURL falhou:', urlError.message);
                }

                // Método 3: FileReader + Image (fallback final)
                try {
                    console.log('Tentando FileReader...');
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = () => reject(new Error('FileReader failed'));
                        reader.readAsDataURL(imageFile);
                    });
                    const img = await new Promise((resolve, reject) => {
                        const image = new window.Image();
                        image.onload = () => resolve(image);
                        image.onerror = () => reject(new Error('Image load from DataURL failed'));
                        image.src = dataUrl;
                    });
                    console.log('FileReader sucesso:', img.width, 'x', img.height);
                    return applyWatermarkAndConvert(img, img.width, img.height);
                } catch (readerError) {
                    console.error('Todos os métodos falharam. FileReader erro:', readerError.message);
                }

                throw new Error('Não foi possível processar esta imagem. Por favor, tente tirar uma foto diretamente pela câmera.');
            };

            console.log('Iniciando processamento do canvas...');
            const base64 = await processImage(fileToProcess);
            console.log('Imagem processada com sucesso');

            clearTimeout(timeoutId);
            setPreview(base64);
            onCapture(base64);
            setProcessing(false);

        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            cleanup();
            alert(error.message || 'Erro ao processar imagem. Tente novamente.');
        }
    };

    const handleReset = () => {
        setPreview(null);
        onCapture(null);
        if (inputRef.current) inputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
            {/* Input para câmera */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
            />
            {/* Input para galeria */}
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
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
                <div className="flex gap-3">
                    {/* Botão Câmera */}
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={processing}
                        className="flex-1 h-32 border-2 border-dashed border-indigo-300 rounded-xl flex flex-col items-center justify-center gap-2 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-colors"
                    >
                        {processing ? (
                            <Loader2 size={28} className="animate-spin" />
                        ) : (
                            <>
                                <Camera size={28} />
                                <span className="text-xs font-medium">Câmera</span>
                            </>
                        )}
                    </button>
                    {/* Botão Galeria */}
                    <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={processing}
                        className="flex-1 h-32 border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center justify-center gap-2 text-purple-600 bg-purple-50/50 hover:bg-purple-100 transition-colors"
                    >
                        {processing ? (
                            <Loader2 size={28} className="animate-spin" />
                        ) : (
                            <>
                                <Image size={28} />
                                <span className="text-xs font-medium">Galeria</span>
                            </>
                        )}
                    </button>
                </div>
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
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);

    // Estado de manutenção
    const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
    const [showMaintenanceAlert, setShowMaintenanceAlert] = useState(false);
    const [maintenanceServices, setMaintenanceServices] = useState([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState([]);
    const [maintenanceFormData, setMaintenanceFormData] = useState({
        date: '',
        serviceId: '',
        customServiceName: '',
        mileage: '',
        cost: ''
    });
    const [showMileageWarning, setShowMileageWarning] = useState(false);

    const [formData, setFormData] = useState({
        liters: '',
        totalCost: '',
        newMileage: ''
    });
    // 3 fotos: antes, depois, nota fiscal
    const [odometerBeforePhoto, setOdometerBeforePhoto] = useState(null);
    const [odometerAfterPhoto, setOdometerAfterPhoto] = useState(null);
    const [receiptPhoto, setReceiptPhoto] = useState(null);

    useEffect(() => {
        document.title = "Portal Tim Transportes";
    }, []);

    // Verificar login salvo
    useEffect(() => {
        const savedTruck = localStorage.getItem('driverTruck');
        if (savedTruck) {
            const truckData = JSON.parse(savedTruck);
            setTruck(truckData);
            setIsLoggedIn(true);
            loadRecentEntries(truckData.id);
            // Verificar manutenções pendentes em background (pequeno delay)
            setTimeout(() => checkMaintenanceAlerts(truckData.id), 1500);
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

    // Verificar manutenções pendentes
    const checkMaintenanceAlerts = async (truckId) => {
        try {
            // Buscar serviços
            const servicesSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceServices'));
            const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Buscar registros de manutenção deste veículo
            const recordsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords'));
            const records = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.truckId === truckId);

            // Buscar abastecimentos para saber km atual
            const entriesSnap = await getDocs(query(
                collection(db, 'artifacts', appId, 'public', 'data', 'entries'),
                where('truckId', '==', truckId)
            ));
            const entries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentMileage = entries.length > 0 ? Math.max(...entries.map(e => e.newMileage || 0)) : 0;

            const alerts = [];
            const today = new Date();

            services.forEach(service => {
                // Verificar se este veículo está apto ao serviço
                if (!service.applicableTrucks?.includes(truckId)) return;

                // Último registro deste serviço para este veículo
                const serviceRecords = records.filter(r => r.serviceId === service.id);
                const lastRecord = serviceRecords.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                let isDue = false;
                let dueInfo = '';

                if (!lastRecord) {
                    isDue = true;
                    dueInfo = 'Nunca realizado';
                } else if (service.periodicityType === 'km') {
                    const nextDueKm = lastRecord.mileage + service.periodicityValue;
                    if (currentMileage >= nextDueKm) {
                        isDue = true;
                        dueInfo = `Última: ${lastRecord.mileage.toLocaleString()} km`;
                    }
                } else if (service.periodicityType === 'days') {
                    const lastDate = new Date(lastRecord.date);
                    const nextDueDate = new Date(lastDate);
                    nextDueDate.setDate(nextDueDate.getDate() + service.periodicityValue);
                    if (today >= nextDueDate) {
                        isDue = true;
                        dueInfo = `Última: ${formatDateBR(lastRecord.date)}`;
                    }
                }

                if (isDue) {
                    alerts.push({
                        id: `${service.id}-${truckId}`,
                        serviceId: service.id,
                        serviceName: service.name,
                        dueInfo
                    });
                }
            });

            setMaintenanceAlerts(alerts);
            if (alerts.length > 0) {
                setShowMaintenanceAlert(true);
            }
        } catch (error) {
            console.error('Erro ao verificar manutenções:', error);
        }
    };

    // Carregar dados de manutenção
    const loadMaintenanceData = async (truckId) => {
        try {
            // Buscar serviços
            const servicesSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceServices'));
            const services = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setMaintenanceServices(services.filter(s => s.applicableTrucks?.includes(truckId)));

            // Buscar registros de manutenção deste veículo
            const recordsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords'));
            const records = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.truckId === truckId);
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            setMaintenanceRecords(records);
        } catch (error) {
            console.error('Erro ao carregar dados de manutenção:', error);
        }
    };

    // Salvar registro de manutenção
    const handleSaveMaintenanceRecord = async () => {
        if (!truck) return;
        setIsSaving(true);

        try {
            const serviceName = maintenanceFormData.serviceId === 'outro'
                ? maintenanceFormData.customServiceName
                : maintenanceServices.find(s => s.id === maintenanceFormData.serviceId)?.name || '';

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords'), {
                truckId: truck.id,
                date: maintenanceFormData.date,
                serviceId: maintenanceFormData.serviceId === 'outro' ? null : maintenanceFormData.serviceId,
                serviceName: serviceName,
                mileage: Number(maintenanceFormData.mileage),
                cost: Number(maintenanceFormData.cost) || 0,
                createdAt: new Date().toISOString(),
                addedBy: 'driver',
                driverName: truck.driver
            });

            setMaintenanceFormData({
                date: '',
                serviceId: '',
                customServiceName: '',
                mileage: '',
                cost: ''
            });
            setShowMileageWarning(false);
            setCurrentPage('maintenanceSuccess');
        } catch (error) {
            console.error('Erro ao salvar manutenção:', error);
            alert('Erro ao salvar manutenção. Tente novamente.');
        }

        setIsSaving(false);
    };

    // Calcular última km de manutenção conhecida
    const getLastMaintenanceMileage = () => {
        const allMileages = [
            ...recentEntries.map(e => e.newMileage || 0),
            ...maintenanceRecords.map(r => r.mileage || 0)
        ];
        return allMileages.length > 0 ? Math.max(...allMileages) : 0;
    };

    // Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        try {
            const cleanCpf = cpf.replace(/\D/g, '');
            const fakeEmail = `${cleanCpf}@timtransportespa.com`;

            // 1. Autenticar com Firebase Auth
            let userCredential;
            try {
                userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
            } catch (authError) {
                console.error('Erro no login Firebase Auth:', authError);
                setLoginError('CPF ou senha incorretos');
                setIsLoading(false);
                return;
            }

            // 2. Verificar acesso ao portal do motorista
            const accessDoc = await getDoc(doc(db, 'portalAccess', userCredential.user.uid));
            if (!accessDoc.exists() || !accessDoc.data().allowedPortals?.includes('motorista')) {
                await firebaseSignOut(auth);
                setLoginError('Você não tem acesso ao Portal do Motorista.');
                setIsLoading(false);
                return;
            }

            // 3. Buscar dados do caminhão pelo CPF
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'trucks'),
                where('driverCpf', '==', cleanCpf)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                await firebaseSignOut(auth);
                setLoginError('Nenhum veículo vinculado a este CPF.');
                setIsLoading(false);
                return;
            }

            const truckDoc = snapshot.docs[0];
            const truckData = { id: truckDoc.id, ...truckDoc.data() };

            setTruck(truckData);
            setIsLoggedIn(true);
            localStorage.setItem('driverTruck', JSON.stringify(truckData));
            loadRecentEntries(truckData.id);
            checkMaintenanceAlerts(truckData.id);

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
        firebaseSignOut(auth);
        localStorage.removeItem('driverTruck');
        setTruck(null);
        setIsLoggedIn(false);
        setCpf('');
        setPassword('');
        setCurrentPage('home');
    };

    // Verificação inicial antes de salvar
    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Recibo é obrigatório
        if (!receiptPhoto) {
            alert('A foto do RECIBO é obrigatória para o registro!');
            return;
        }

        // 2. Se faltar alguma foto do odômetro, pede confirmação
        if (!odometerBeforePhoto || !odometerAfterPhoto) {
            setShowConfirmationModal(true);
            return;
        }

        // 3. Se tudo estiver ok, salva direto
        confirmSave();
    };

    // Upload base64 para Firebase Storage
    const uploadBase64ToStorage = async (base64String, path) => {
        if (!base64String) return null;
        try {
            const response = await fetch(base64String);
            const blob = await response.blob();
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error('Erro no upload:', error);
            return null;
        }
    };

    const confirmSave = async () => {
        setShowConfirmationModal(false);
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const now = new Date();
            const entryId = `driver-${Date.now()}`;

            // Upload fotos para Firebase Storage
            const [beforeUrl, afterUrl, receiptUrl] = await Promise.all([
                uploadBase64ToStorage(odometerBeforePhoto, `entries/${entryId}/odometerBefore`),
                uploadBase64ToStorage(odometerAfterPhoto, `entries/${entryId}/odometerAfter`),
                uploadBase64ToStorage(receiptPhoto, `entries/${entryId}/receipt`)
            ]);

            const entry = {
                truckId: truck.id,
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].slice(0, 5),
                liters: Number(formData.liters),
                totalCost: Number(formData.totalCost),
                newMileage: Number(formData.newMileage),
                odometerBeforePhoto: beforeUrl || null,
                odometerAfterPhoto: afterUrl || null,
                odometerUrl: beforeUrl || null,
                receiptPhoto: receiptUrl || null,
                receiptUrl: receiptUrl || null,
                hasReceipt: !!receiptUrl,
                hasOdometer: !!(beforeUrl || afterUrl),
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
                <InstallAppButton />
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Fuel size={32} className="text-indigo-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Portal do Motorista TIM</h1>
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
    }

    // Tela Principal (logado)
    return (
        <div className="min-h-screen bg-slate-100">
            <InstallAppButton />
            {/* Mensagem de boas-vindas */}
            {showWelcome && (
                <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 animate-in fade-in slide-in-from-top duration-300">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2">
                        <span className="text-lg">👋</span>
                        <span className="font-medium">Bem-vindo, {truck.driver}!</span>
                    </div>
                </div>
            )}

            {/* Modal de Alerta de Manutenção */}
            {showMaintenanceAlert && maintenanceAlerts.length > 0 && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Wrench className="text-amber-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Manutenção Pendente</h3>
                                <p className="text-sm text-slate-500">{maintenanceAlerts.length} alerta(s)</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4 overflow-y-auto flex-1 max-h-[40vh] pr-1">
                            {maintenanceAlerts.map(alert => (
                                <div key={alert.id} className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                                    <p className="font-bold text-slate-800">{alert.serviceName}</p>
                                    <p className="text-xs text-slate-500">{alert.dueInfo}</p>
                                </div>
                            ))}
                        </div>

                        <p className="text-sm text-slate-500 mb-4">
                            Seu veículo possui manutenções pendentes. Procure o responsável pela frota para regularizar.
                        </p>

                        <button
                            onClick={() => setShowMaintenanceAlert(false)}
                            className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Entendi
                        </button>
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
                        {/* Abastecimento */}
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Combustível</p>
                        <button
                            onClick={() => setCurrentPage('newEntry')}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-5 rounded-2xl flex items-center gap-4 transition-colors shadow-lg"
                        >
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Fuel size={24} />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-bold">Registrar Abastecimento</p>
                                <p className="text-indigo-200 text-sm">Novo registro de combustível</p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                loadRecentEntries(truck.id);
                                setCurrentPage('history');
                            }}
                            className="w-full bg-white hover:bg-slate-50 text-slate-800 p-5 rounded-2xl flex items-center gap-4 transition-colors shadow-sm border border-slate-100"
                        >
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <History size={24} className="text-indigo-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-bold">Histórico de Abastecimentos</p>
                                <p className="text-slate-500 text-sm">Ver registros anteriores</p>
                            </div>
                        </button>

                        {/* Manutenção */}
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 pt-4">Manutenção</p>
                        <button
                            onClick={() => {
                                loadMaintenanceData(truck.id);
                                setMaintenanceFormData({
                                    date: new Date().toISOString().split('T')[0],
                                    serviceId: '',
                                    customServiceName: '',
                                    mileage: '',
                                    cost: ''
                                });
                                setCurrentPage('newMaintenance');
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white p-5 rounded-2xl flex items-center gap-4 transition-colors shadow-lg"
                        >
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Wrench size={24} />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-bold">Registrar Manutenção</p>
                                <p className="text-amber-100 text-sm">Novo registro de serviço</p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                loadMaintenanceData(truck.id);
                                setCurrentPage('maintenanceHistory');
                            }}
                            className="w-full bg-white hover:bg-slate-50 text-slate-800 p-5 rounded-2xl flex items-center gap-4 transition-colors shadow-sm border border-slate-100"
                        >
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                <History size={24} className="text-amber-600" />
                            </div>
                            <div className="text-left">
                                <p className="text-lg font-bold">Histórico de Manutenções</p>
                                <p className="text-slate-500 text-sm">Ver serviços realizados</p>
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
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={formData.newMileage}
                                    onKeyDown={(e) => {
                                        if (e.key === ',' || e.key === '.' || e.key === '-' || e.key === ' ') {
                                            e.preventDefault();
                                        }
                                    }}
                                    onChange={(e) => {
                                        const cleanValue = e.target.value.replace(/\D/g, '');
                                        e.target.value = cleanValue; // Força atualização imediata no DOM para teclados de celular
                                        setFormData({ ...formData, newMileage: cleanValue });
                                    }}
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

                {/* Página Registrar Manutenção */}
                {currentPage === 'newMaintenance' && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 relative">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Wrench size={20} className="text-amber-600" />
                            Nova Manutenção
                        </h2>

                        <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Truck size={16} className="text-amber-600" />
                                <span className="text-slate-600">Veículo:</span>
                                <span className="font-medium text-slate-800">{truck.plate}</span>
                            </div>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const lastKm = getLastMaintenanceMileage();
                            if (Number(maintenanceFormData.mileage) < lastKm) {
                                setShowMileageWarning(true);
                                return;
                            }
                            handleSaveMaintenanceRecord();
                        }}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data</label>
                                    <input
                                        type="date"
                                        value={maintenanceFormData.date}
                                        onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, date: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo de Serviço</label>
                                    <select
                                        value={maintenanceFormData.serviceId}
                                        onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, serviceId: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                    >
                                        <option value="">Selecione...</option>
                                        {maintenanceServices.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                        <option value="outro">Outro (especificar)</option>
                                    </select>
                                </div>

                                {maintenanceFormData.serviceId === 'outro' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Serviço</label>
                                        <input
                                            type="text"
                                            value={maintenanceFormData.customServiceName}
                                            onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, customServiceName: e.target.value })}
                                            placeholder="Ex: Troca de correia"
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Km Atual</label>
                                        <input
                                            type="number"
                                            value={maintenanceFormData.mileage}
                                            onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, mileage: e.target.value })}
                                            placeholder="Ex: 85000"
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Valor (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={maintenanceFormData.cost}
                                            onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, cost: e.target.value })}
                                            placeholder="Ex: 350"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20} /> : null}
                                {isSaving ? 'Salvando...' : 'Registrar Manutenção'}
                            </button>
                        </form>

                        {/* Modal de aviso de quilometragem */}
                        {showMileageWarning && (
                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center p-4 rounded-2xl">
                                <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                            <AlertTriangle className="text-amber-600" size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800">Km Inferior</h3>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-4">
                                        A Km informada é inferior à última registrada. Deseja continuar?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowMileageWarning(false)}
                                            className="flex-1 py-3 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 transition-colors"
                                        >
                                            Corrigir
                                        </button>
                                        <button
                                            onClick={handleSaveMaintenanceRecord}
                                            className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors"
                                        >
                                            Continuar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Página Histórico de Manutenções */}
                {currentPage === 'maintenanceHistory' && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Wrench size={20} className="text-amber-600" />
                            Histórico de Manutenções
                        </h2>
                        {maintenanceRecords.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center">
                                <div className="text-slate-300 mb-2">
                                    <Wrench size={48} className="mx-auto" />
                                </div>
                                <p className="text-slate-500">Nenhuma manutenção registrada</p>
                            </div>
                        ) : (
                            maintenanceRecords.map((record) => (
                                <div key={record.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800">{record.serviceName}</p>
                                            <p className="text-sm text-slate-500">{formatDateBR(record.date)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-amber-600">{record.mileage?.toLocaleString()} km</p>
                                            {record.cost > 0 && (
                                                <p className="text-sm text-slate-500">R$ {record.cost?.toFixed(2)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Página Sucesso Manutenção */}
                {currentPage === 'maintenanceSuccess' && (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} className="text-amber-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Manutenção Registrada!</h2>
                        <p className="text-slate-500 mb-6">O registro foi salvo com sucesso.</p>
                        <button
                            onClick={() => setCurrentPage('home')}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl transition-colors"
                        >
                            Voltar ao Início
                        </button>
                    </div>
                )}

                {/* Modal de Confirmação para Fotos Faltantes */}
                {showConfirmationModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4">
                                    <AlertCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Fotos do Odômetro Faltando</h3>
                                <p className="text-slate-600">
                                    Você não adicionou todas as fotos do odômetro. Tem certeza que deseja enviar o registro apenas com o recibo?
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmationModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Voltar
                                </button>
                                <button
                                    onClick={confirmSave}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                                >
                                    Sim, Enviar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverPortal;
