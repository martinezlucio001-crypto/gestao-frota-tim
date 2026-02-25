import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Truck,
  Plus,
  Fuel,
  History,
  ChevronLeft,
  Save,
  FileText,
  Image as ImageIcon,
  TrendingUp,
  Droplet,
  DollarSign,
  AlertCircle,
  Calendar,
  Gauge,
  MoreVertical,
  BarChart3,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  HelpCircle,
  Pencil,
  Loader2,
  Trash2,
  X,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Eye,
  EyeOff,
  LogOut,
  Shield,
  CalendarRange,
  PlusCircle,
  Edit2,
  Info,
  Wrench,
  Settings
} from 'lucide-react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { auth, db, appId, storage } from './lib/firebase'; // Usando configuração centralizada
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- URL DO SEU SCRIPT GOOGLE ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw_mOblGA9apR8iX8lNWf2SD8scFuyMe0u-AtFxkSJ4OVUrWxks_srLuPlv_KVKcx9_uQ/exec";

// --- Helpers de Integração ---

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Comprime uma imagem e faz upload para o Firebase Storage, retornando a URL pública
const uploadToStorage = (file, path) => {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const MAX_DIMENSION = 1600; // Boa resolução para visualização, mas controlada
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIMENSION) {
          height = Math.round(height * (MAX_DIMENSION / width));
          width = MAX_DIMENSION;
        } else if (height > MAX_DIMENSION) {
          width = Math.round(width * (MAX_DIMENSION / height));
          height = MAX_DIMENSION;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Converte para Blob JPEG (80% de qualidade — bom equilíbrio)
        canvas.toBlob(async (blob) => {
          try {
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
            const url = await getDownloadURL(storageRef);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

// Função para formatar datas sem problema de fuso horário
const formatDateBR = (dateString) => {
  if (!dateString) return '-';
  // Divide a string de data (YYYY-MM-DD) para evitar interpretação UTC
  const parts = dateString.split('T')[0].split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

// Função para parse robusto de datas (ISO e DD/MM/YYYY)
const parseDateSafe = (dateString) => {
  if (!dateString) return new Date(0);
  const str = String(dateString).split('T')[0];
  // Formato DD/MM/YYYY
  if (str.includes('/')) {
    const [day, month, year] = str.split('/');
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  // Formato YYYY-MM-DD
  const [year, month, day] = str.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const sendToGoogleSheets = async (payload) => {
  try {
    // mode: 'no-cors' permite enviar dados para o Google sem erro de bloqueio do navegador,
    // porém não conseguimos ler a resposta de "sucesso". Assumimos que foi se não der erro de rede.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("Dados enviados para sincronização com Google Sheets/Drive");
  } catch (error) {
    console.error("Falha na sincronização com Google:", error);
  }
};

// --- Estilos Globais ---
const globalStyles = `
  /* Chrome, Safari, Edge, Opera */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  /* Firefox */
  input[type=number] {
    -moz-appearance: textfield;
  }
`;

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// --- Componentes UI ---


const Card = ({ children, className = "", noPadding = false, ...props }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 ${noPadding ? '' : 'p-6'} ${className}`} {...props}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, subtext, color = "blue", trend }) => {
  const styles = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
    green: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
  };

  const currentStyle = styles[color] || styles.blue;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 transition-transform hover:-translate-y-1 duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${currentStyle.bg} ${currentStyle.text}`}>
          <Icon size={24} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-2 font-medium">{subtext}</p>}
      </div>
    </div>
  );
};

const Button = ({ children, onClick, variant = "primary", className = "", ...props }) => {
  const baseStyle = "px-5 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm hover:border-slate-300",
    danger: "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100",
    ghost: "hover:bg-slate-100 text-slate-600",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200",
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ label, type, ...props }) => (
  <div className="mb-5 group">
    <label className="block text-sm font-semibold text-slate-700 mb-2 transition-colors group-focus-within:text-indigo-600">{label}</label>
    <input
      type={type}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500"
      onWheel={type === 'number' ? (e) => e.target.blur() : undefined}
      {...props}
    />
  </div>
);

// Componente InfoCard com tooltip explicativo
const InfoCard = ({ children, className = "", tooltip, style }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 segundos
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  const toggleTooltip = (e) => {
    e.stopPropagation();
    setShowTooltip(!showTooltip);
  };

  return (
    <div
      className={`rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 p-6 relative ${className}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ícone de informação */}
      <button
        onClick={toggleTooltip}
        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 transition-colors z-10"
        title="Ver explicação"
      >
        <HelpCircle size={14} />
      </button>

      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45"></div>
          <p className="relative z-10 leading-relaxed">{tooltip}</p>
        </div>
      )}

      {children}
    </div>
  );
};

// --- Modais ---

const ModalBackdrop = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
      {children}
    </div>
    <div className="absolute inset-0 -z-10" onClick={onClose}></div>
  </div>
);

const TruckModal = ({ isOpen, onClose, onSave, editingTruck = null }) => {
  const [formData, setFormData] = useState({
    plate: '',
    model: '',
    capacity: '',
    expectedKmlList: [],
    tankLevelGoal: '',
    expectedIntervalKm: '',
    pixKey: '',
    vehicleType: '',
    driver: '',
    driverCpf: '',
    driverPassword: ''
  });
  const [kmlInput, setKmlInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingTruck) {
        setFormData({
          plate: editingTruck.plate || '',
          model: editingTruck.model || '',
          capacity: String(editingTruck.capacity || ''),
          expectedKmlList: editingTruck.expectedKmlList || (editingTruck.expectedKml ? [Number(editingTruck.expectedKml)] : []),
          tankLevelGoal: String(editingTruck.tankLevelGoal || ''),
          expectedIntervalKm: String(editingTruck.expectedIntervalKm || ''),
          pixKey: editingTruck.pixKey || '',
          vehicleType: editingTruck.vehicleType || '',
          driver: editingTruck.driver || '',
          driverCpf: editingTruck.driverCpf || '',
          driverPassword: editingTruck.driverPassword || ''
        });
      } else {
        setFormData({ plate: '', model: '', capacity: '', expectedKmlList: [], tankLevelGoal: '', expectedIntervalKm: '', pixKey: '', vehicleType: '', driver: '', driverCpf: '', driverPassword: '' });
      }
      setKmlInput('');
    }
  }, [isOpen, editingTruck]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.expectedKmlList.length === 0) {
      alert("Adicione pelo menos uma eficiência prevista.");
      return;
    }
    onSave({
      ...(editingTruck ? { id: editingTruck.id } : {}),
      ...formData,
      capacity: Number(formData.capacity),
      expectedKmlList: formData.expectedKmlList,
      expectedKml: formData.expectedKmlList[0], // Backwards compatibility
      tankLevelGoal: Number(formData.tankLevelGoal),
      expectedIntervalKm: Number(formData.expectedIntervalKm),
      initialFuel: editingTruck ? (editingTruck.initialFuel || 0) : 0,
      initialMileage: editingTruck ? (editingTruck.initialMileage || 0) : 0,
      currentMileage: editingTruck ? editingTruck.currentMileage : 0,
    });
    onClose();
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className={`p-8 border-b border-slate-100 ${editingTruck ? 'bg-amber-50/50' : 'bg-slate-50/50'} flex justify-between items-center flex-shrink-0`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{editingTruck ? 'Editar Caminhão' : 'Novo Caminhão'}</h2>
          <p className="text-sm text-slate-500 mt-1">{editingTruck ? 'Atualize os dados do veículo.' : 'Cadastre um novo veículo na frota.'}</p>
        </div>
        <div className={`p-2 rounded-full ${editingTruck ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
          {editingTruck ? <Pencil size={24} /> : <Truck size={24} />}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-8 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6">
          <Input label="Placa do Veículo" placeholder="ABC-1234" required value={formData.plate} onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })} />
          <Input label="Tipo de Veículo" placeholder="Ex: Utilitário" value={formData.vehicleType} onChange={e => setFormData({ ...formData, vehicleType: e.target.value })} />
        </div>
        <Input label="Modelo / Marca" placeholder="Ex: Volvo FH" required value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
        <div className="grid grid-cols-2 gap-6">
          <Input label="Capacidade Tanque (L)" type="number" required value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} />
          <div className="flex flex-col mb-4 relative">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Eficiências Previstas (Km/L)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 5.3"
                value={kmlInput}
                onChange={e => setKmlInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (kmlInput) {
                      setFormData({ ...formData, expectedKmlList: [...formData.expectedKmlList, Number(kmlInput)] });
                      setKmlInput('');
                    }
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                style={{ height: '48px' }}
              />
              <Button type="button" variant="secondary" onClick={() => {
                if (kmlInput) {
                  setFormData({ ...formData, expectedKmlList: [...formData.expectedKmlList, Number(kmlInput)] });
                  setKmlInput('');
                }
              }}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.expectedKmlList.map((kml, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-sm">
                  {kml} Km/L
                  <button type="button" onClick={() => {
                    const newList = [...formData.expectedKmlList];
                    newList.splice(idx, 1);
                    setFormData({ ...formData, expectedKmlList: newList });
                  }} className="text-indigo-400 hover:text-indigo-800 ml-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Input label="Meta Nível Tanque (L)" type="number" placeholder="Ex: 500" value={formData.tankLevelGoal} onChange={e => setFormData({ ...formData, tankLevelGoal: e.target.value })} />
          <Input label="Km Esperado (Intervalo)" type="number" placeholder="Ex: 500" value={formData.expectedIntervalKm} onChange={e => setFormData({ ...formData, expectedIntervalKm: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Input label="Motorista Responsável" placeholder="Nome Completo" required value={formData.driver} onChange={e => setFormData({ ...formData, driver: e.target.value })} />
          <Input label="Chave Pix" placeholder="CPF/Email/Celular" value={formData.pixKey} onChange={e => setFormData({ ...formData, pixKey: e.target.value })} />
        </div>
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 mt-2">
          <p className="text-xs font-bold text-indigo-600 uppercase mb-3">Acesso do Motorista (Portal)</p>
          <div className="grid grid-cols-2 gap-6">
            <Input label="CPF do Motorista" placeholder="Apenas números" value={formData.driverCpf} onChange={e => setFormData({ ...formData, driverCpf: e.target.value.replace(/\D/g, '').slice(0, 11) })} />
            <Input label="Senha de Acesso" type="text" placeholder="Definida por você" value={formData.driverPassword} onChange={e => setFormData({ ...formData, driverPassword: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1" variant={editingTruck ? "primary" : "primary"}>{editingTruck ? 'Salvar Alterações' : 'Confirmar Cadastro'}</Button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

const EntryModal = ({ isOpen, onClose, onSave, truck, allTrucks = [], editingEntry = null, isSaving, entries = [] }) => {
  const [localTruckId, setLocalTruckId] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    totalCost: '',
    liters: '',
    newMileage: '',
    initialFuel: ''
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [odometerBeforeFile, setOdometerBeforeFile] = useState(null);
  const [odometerAfterFile, setOdometerAfterFile] = useState(null);

  const activeTruck = truck || allTrucks.find(t => t.id === localTruckId);

  // Determinar se este é o primeiro registro de uma seção (necessita input inicial)
  const isFirst = useMemo(() => {
    if (!activeTruck) return false;
    if (!formData.date || !formData.time) return false;

    const fullEntryDateStr = `${formData.date}T${formData.time}`;
    const truckEntries = entries.filter(e => e.truckId === activeTruck.id);

    // 1. Encontrar a seção a qual este registro pertence
    const sections = activeTruck.sections || [];
    // Ordenar seções da mais recente para a mais antiga
    const sortedSections = [...sections].sort((a, b) => new Date(b.date) - new Date(a.date));

    // A seção ativa é a mais recente que começou ANTES ou IGUAL a data do registro
    const activeSection = sortedSections.find(s => s.date <= fullEntryDateStr);
    const sectionStartDate = activeSection ? activeSection.date : (activeTruck.sectionStartDate || null);

    // 2. Verificar se existem registros ANTERIORES dentro desta mesma seção
    const priorEntries = truckEntries.filter(e => {
      if (editingEntry && e.id === editingEntry.id) return false; // Ignorar a si mesmo na edição

      // Deve ser estritamente anterior ao registro atual
      const isBeforeCurrent = e.date < fullEntryDateStr;

      // E deve ser posterior (ou igual) ao início da seção
      const isAfterSectionStart = sectionStartDate ? e.date >= sectionStartDate : true;

      return isBeforeCurrent && isAfterSectionStart;
    });

    // Se não houver registros anteriores nesta seção, é o primeiro!
    return priorEntries.length === 0;
  }, [activeTruck, editingEntry, entries, formData.date, formData.time]);

  useEffect(() => {
    if (isOpen) {
      // Resetar arquivos
      setReceiptFile(null);
      setOdometerBeforeFile(null);
      setOdometerAfterFile(null);

      if (editingEntry) {
        setFormData({
          date: editingEntry.date,
          time: editingEntry.time || '',
          totalCost: editingEntry.totalCost,
          liters: editingEntry.liters,
          newMileage: editingEntry.newMileage,
          initialFuel: editingEntry.initialFuel !== undefined ? String(editingEntry.initialFuel) : ''
        });
        if (!truck) setLocalTruckId(editingEntry.truckId);
      } else {
        setFormData({
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          totalCost: '',
          liters: '',
          newMileage: '',
          initialFuel: ''
        });
        if (!truck) setLocalTruckId('');
      }
    }
  }, [isOpen, editingEntry, truck]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeTruck) return;

    const liters = Number(formData.liters);
    const totalCost = Number(formData.totalCost);
    const newMileage = Number(formData.newMileage);
    const costPerLiter = liters > 0 ? totalCost / liters : 0;

    // --- Lógica Alterada ---
    // Não calculamos 'distanceTraveled' para o registro atual (ele será 0).
    // O cálculo do gap (diferença) será feito no handleSaveEntry e aplicado ao registro ANTERIOR.
    // Apenas passamos os dados brutos.

    // Validação: Quilometragem deve estar entre o registro anterior e o posterior (por data)
    const truckHistory = entries.filter(e => e.truckId === activeTruck.id);
    const currentDate = parseDateSafe(formData.date);

    // Filtrar registros com data anterior
    const entriesBeforeDate = truckHistory.filter(e => {
      if (editingEntry && e.id === editingEntry.id) return false;
      return parseDateSafe(e.date) < currentDate;
    });

    // Filtrar registros com data posterior
    const entriesAfterDate = truckHistory.filter(e => {
      if (editingEntry && e.id === editingEntry.id) return false;
      return parseDateSafe(e.date) > currentDate;
    });

    // Validar: não pode ser menor que o máximo dos anteriores
    if (entriesBeforeDate.length > 0) {
      const maxMileageBeforeDate = Math.max(...entriesBeforeDate.map(e => e.newMileage));
      if (newMileage < maxMileageBeforeDate) {
        alert(`Erro: A quilometragem (${newMileage}) não pode ser menor que a de um registro anterior (${maxMileageBeforeDate} km).`);
        return;
      }
    }

    // Validar: não pode ser maior que o mínimo dos posteriores
    if (entriesAfterDate.length > 0) {
      const minMileageAfterDate = Math.min(...entriesAfterDate.map(e => e.newMileage));
      if (newMileage > minMileageAfterDate) {
        alert(`Erro: A quilometragem (${newMileage}) não pode ser maior que a de um registro posterior (${minMileageAfterDate} km).`);
        return;
      }
    }

    const payload = {
      ...(editingEntry ? { id: editingEntry.id } : {}),
      truckId: activeTruck.id,
      date: formData.date,
      time: formData.time,
      totalCost,
      liters,
      costPerLiter,
      newMileage,
      distanceTraveled: 0,
    };

    if (isFirst) {
      payload.initialFuel = Number(formData.initialFuel || 0);
    }

    onSave(payload, { receiptFile, odometerBeforeFile, odometerAfterFile });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className={`p-8 border-b border-slate-100 ${editingEntry ? 'bg-amber-50/30' : 'bg-emerald-50/30'} flex justify-between items-center flex-shrink-0`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{editingEntry ? 'Editar Registro' : 'Registrar Abastecimento'}</h2>
          <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
            {activeTruck ? (
              <><span className="font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700">{activeTruck.plate}</span>{activeTruck.vehicleType && <span className="font-semibold px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 text-xs">{activeTruck.vehicleType}</span>}<span>{activeTruck.model}</span></>
            ) : (<span>Selecione um veículo abaixo</span>)}
          </div>
        </div>
        <div className={`p-2 rounded-full ${editingEntry ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {editingEntry ? <Pencil size={24} /> : <Fuel size={24} />}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-8 overflow-y-auto">
        {!truck && !editingEntry && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Selecione o Caminhão</label>
            <div className="relative">
              <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer text-slate-700 font-medium" value={localTruckId} onChange={(e) => setLocalTruckId(e.target.value)} required>
                <option value="">-- Escolha um veículo --</option>
                {allTrucks.map(t => (<option key={t.id} value={t.id}>{t.plate} - {t.model} ({t.driver})</option>))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Truck size={18} /></div>
            </div>
          </div>
        )}
        <fieldset disabled={!activeTruck || isSaving} className={(!activeTruck || isSaving) ? 'opacity-50 grayscale' : ''}>
          <div className="grid grid-cols-2 gap-6">
            <Input label="Data do Abastecimento" type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            <Input label="Horário" type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Input label="Valor Total (R$)" type="number" step="0.01" required placeholder="0,00" value={formData.totalCost} onChange={e => setFormData({ ...formData, totalCost: e.target.value })} />
            <Input label="Litros Abastecidos" type="number" step="0.1" required placeholder="0 L" value={formData.liters} onChange={e => setFormData({ ...formData, liters: e.target.value })} />
          </div>
          <Input
            label="Quilometragem Atual"
            type="number"
            required
            value={formData.newMileage}
            onChange={e => setFormData({ ...formData, newMileage: e.target.value })}
          />

          {isFirst && (
            <div className="bg-amber-50 p-4 rounded-xl mb-5 border border-amber-100">
              <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-2">Estado Inicial do Veículo</p>
              <Input
                label="Combustível Inicial no Tanque (L)"
                type="number"
                placeholder="Ex: 50"
                required
                value={formData.initialFuel}
                onChange={e => setFormData({ ...formData, initialFuel: e.target.value })}
              />
              <p className="text-[10px] text-amber-500 italic mt-1">Informe quanto combustível já havia no tanque antes deste abastecimento.</p>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Gauge size={14} /> Fotos do Registro
            </p>
            <div className="grid grid-cols-3 gap-4">
              {/* Odômetro Antes */}
              <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${odometerBeforeFile ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-amber-50/50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setOdometerBeforeFile(e.target.files[0])} />
                {odometerBeforeFile ? <CheckCircle2 className="text-amber-500 mb-2" size={22} /> : <Gauge className="mb-2 text-amber-400 group-hover:scale-110 transition-transform" size={22} />}
                <span className={`text-xs font-bold text-center leading-tight ${odometerBeforeFile ? 'text-amber-700' : 'text-slate-500'}`}>
                  {odometerBeforeFile ? 'Odômetro\nAntes ✓' : 'Odômetro\nAntes'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">📍 Antes</span>
              </label>

              {/* Odômetro Depois */}
              <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${odometerAfterFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-emerald-50/50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setOdometerAfterFile(e.target.files[0])} />
                {odometerAfterFile ? <CheckCircle2 className="text-emerald-500 mb-2" size={22} /> : <Gauge className="mb-2 text-slate-400 group-hover:scale-110 transition-transform" size={22} />}
                <span className={`text-xs font-bold text-center leading-tight ${odometerAfterFile ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {odometerAfterFile ? 'Odômetro\nDepois ✓' : 'Odômetro\nDepois'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">✅ Depois</span>
              </label>

              {/* Recibo */}
              <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${receiptFile ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setReceiptFile(e.target.files[0])} />
                {receiptFile ? <CheckCircle2 className="text-indigo-500 mb-2" size={22} /> : <FileText className="mb-2 text-slate-400 group-hover:scale-110 transition-transform" size={22} />}
                <span className={`text-xs font-bold text-center leading-tight ${receiptFile ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {receiptFile ? 'Recibo ✓' : 'Foto Recibo'}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">🧾 Nota</span>
              </label>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" variant={editingEntry ? "primary" : "success"} className="flex-1" disabled={!activeTruck || isSaving}>
              {isSaving ? <><Loader2 className="animate-spin" size={18} /> Salvando...</> : (editingEntry ? "Atualizar Registro" : "Salvar Registro")}
            </Button>
          </div>
        </fieldset>
      </form>
    </ModalBackdrop>
  );
};

const ImagePreviewModal = ({ isOpen, onClose, imageUrl, imageUrl2, title, title2 }) => {
  if (!isOpen || (!imageUrl && !imageUrl2)) return null;
  const hasTwo = imageUrl && imageUrl2;
  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-lg flex items-center justify-center z-[100] p-4 md:p-8" onClick={onClose}>
      <div className="relative max-w-5xl w-full flex flex-col items-center animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        {/* Header de Ações */}
        <div className="w-full flex justify-between items-center mb-4 px-2">
          <div className="flex flex-col">
            <p className="text-white font-black text-xl tracking-tight uppercase">{hasTwo ? 'Fotos do Odômetro' : title}</p>
            <div className="h-1 w-12 bg-indigo-500 rounded-full mt-1"></div>
          </div>
          <div className="flex items-center gap-3">
            {imageUrl && (
              <button
                onClick={() => {
                  // Baixar primeira imagem
                  const link1 = document.createElement('a');
                  link1.href = imageUrl;
                  link1.download = hasTwo ? 'odometro_antes.jpg' : `${title || 'foto'}.jpg`;
                  link1.click();

                  // Se tiver segunda imagem, baixar também após pequeno delay
                  if (imageUrl2) {
                    setTimeout(() => {
                      const link2 = document.createElement('a');
                      link2.href = imageUrl2;
                      link2.download = 'odometro_depois.jpg';
                      link2.click();
                    }, 500);
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2 font-bold transition-all border border-white/10 active:scale-95"
              >
                <Download size={18} /> <span className="hidden sm:inline">Baixar {hasTwo ? 'Fotos' : ''}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl backdrop-blur-md transition-all border border-rose-500/20 active:scale-95"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Container da Imagem */}
        <div className={`${hasTwo ? 'grid grid-cols-2 gap-4' : ''} w-full`}>
          {imageUrl && (
            <div className="bg-white p-1 md:p-2 rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden ring-4 ring-black/20">
              {hasTwo && <p className="text-center text-xs font-bold text-slate-600 bg-amber-100 py-1 rounded-t-2xl mb-1">📍 ANTES do Abastecimento</p>}
              <img
                src={imageUrl}
                alt={title}
                className="max-w-full max-h-[60vh] object-contain rounded-[1.5rem] select-none mx-auto"
              />
            </div>
          )}
          {imageUrl2 && (
            <div className="bg-white p-1 md:p-2 rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden ring-4 ring-black/20">
              {hasTwo && <p className="text-center text-xs font-bold text-slate-600 bg-emerald-100 py-1 rounded-t-2xl mb-1">✅ DEPOIS do Abastecimento</p>}
              <img
                src={imageUrl2}
                alt={title2}
                className="max-w-full max-h-[60vh] object-contain rounded-[1.5rem] select-none mx-auto"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal de Detalhes do Registro (substitui os 4 botões de ação)
const EntryDetailsModal = ({ isOpen, onClose, entry, truck, onSave, onDelete, isSaving, entries = [] }) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    totalCost: '',
    liters: '',
    newMileage: '',
    note: '',
    initialFuel: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewingImage, setPreviewingImage] = useState(null); // 'odometer' | 'receipt' | null
  const [zoom, setZoom] = useState(1);
  const [newOdometerBeforeFile, setNewOdometerBeforeFile] = useState(null);
  const [newOdometerAfterFile, setNewOdometerAfterFile] = useState(null);
  const [newReceiptFile, setNewReceiptFile] = useState(null);
  const [removeOdometerBefore, setRemoveOdometerBefore] = useState(false);
  const [removeOdometerAfter, setRemoveOdometerAfter] = useState(false);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const odometerBeforeInputRef = useRef(null);
  const odometerAfterInputRef = useRef(null);
  const receiptInputRef = useRef(null);

  // Determinar se este é o primeiro registro de uma seção (necessita input inicial)
  const isFirst = useMemo(() => {
    if (!truck || !entry) return false;

    const fullEntryDateStr = entry.date;
    const truckEntries = entries.filter(e => e.truckId === truck.id);

    // 1. Encontrar a seção a qual este registro pertence
    const sections = truck.sections || [];
    const sortedSections = [...sections].sort((a, b) => new Date(b.date) - new Date(a.date));
    const activeSection = sortedSections.find(s => s.date <= fullEntryDateStr);
    const sectionStartDate = activeSection ? activeSection.date : (truck.sectionStartDate || null);

    // 2. Verificar se existem registros ANTERIORES dentro desta mesma seção
    const priorEntries = truckEntries.filter(e => {
      if (e.id === entry.id) return false; // Ignorar a si mesmo
      const isBeforeCurrent = e.date < fullEntryDateStr;
      const isAfterSectionStart = sectionStartDate ? e.date >= sectionStartDate : true;
      return isBeforeCurrent && isAfterSectionStart;
    });

    return priorEntries.length === 0;
  }, [truck, entry, entries]);

  useEffect(() => {
    if (isOpen && entry) {
      // Extrair apenas a parte da data (YYYY-MM-DD) removendo o horário se existir
      const dateOnly = entry.date ? entry.date.split('T')[0] : '';
      setFormData({
        date: dateOnly,
        time: entry.time || '',
        totalCost: entry.totalCost || '',
        liters: entry.liters || '',
        newMileage: entry.newMileage || '',
        note: entry.note || '',
        initialFuel: entry.initialFuel !== undefined ? String(entry.initialFuel) : ''
      });
      setShowDeleteConfirm(false);
      setPreviewingImage(null);
      setNewOdometerBeforeFile(null);
      setNewOdometerAfterFile(null);
      setNewReceiptFile(null);
      setRemoveOdometerBefore(false);
      setRemoveOdometerAfter(false);
      setRemoveReceipt(false);
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Combinar date e time no formato esperado
    const combinedDate = formData.date && formData.time
      ? `${formData.date}T${formData.time}`
      : formData.date || entry.date;

    const payload = {
      id: entry.id,
      truckId: entry.truckId,
      date: combinedDate,
      time: formData.time,
      totalCost: Number(formData.totalCost),
      liters: Number(formData.liters),
      costPerLiter: Number(formData.liters) > 0 ? Number(formData.totalCost) / Number(formData.liters) : 0,
      newMileage: Number(formData.newMileage),
      note: formData.note || null,
      // Manter campos existentes que não estão sendo editados e garantir que não sejam undefined
      distanceTraveled: entry.distanceTraveled || 0,
      initialFuel: isFirst ? Number(formData.initialFuel || 0) : (entry.initialFuel ?? null),
      registeredBy: entry.registeredBy ?? null,
      createdAt: entry.createdAt ?? null
    };

    // Gerenciar fotos (garantir null se undefined)
    payload.odometerBeforePhoto = removeOdometerBefore ? null : (entry.odometerBeforePhoto || entry.odometerUrl || null);
    payload.odometerAfterPhoto = removeOdometerAfter ? null : (entry.odometerAfterPhoto || null);

    // Se removeu o principal (odometerUrl) e não tem before, garantir que odometroUrl seja null
    payload.odometerUrl = payload.odometerBeforePhoto;

    if (removeReceipt) {
      payload.receiptUrl = null;
      payload.receiptPhoto = null;
    } else {
      payload.receiptUrl = entry.receiptUrl || null;
      payload.receiptPhoto = entry.receiptPhoto || null;
    }

    onSave(payload, {
      odometerBeforeFile: newOdometerBeforeFile,
      odometerAfterFile: newOdometerAfterFile,
      receiptFile: newReceiptFile
    });
  };

  const handleDelete = () => {
    onDelete(entry.id, entry.date);
    onClose();
  };

  const odometerPhoto = entry.odometerBeforePhoto || entry.odometerUrl;
  const receiptPhoto = entry.receiptPhoto || entry.receiptUrl;
  const hasOdometer = odometerPhoto && odometerPhoto !== 'imported' && !removeOdometerBefore && !removeOdometerAfter;
  const hasReceipt = receiptPhoto && receiptPhoto !== 'imported' && !removeReceipt;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6 border-b border-slate-100 bg-indigo-50/30 flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Info className="text-indigo-600" size={24} />
            Detalhes do Registro
          </h2>
          <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
            <span className="font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700">{truck?.plate}</span>
            <span>{formatDateBR(entry.date)}</span>
            {entry.time && <span>às {entry.time}</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={24} className="text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
        {/* Dados do Abastecimento */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Fuel size={16} className="text-indigo-600" />
            Dados do Abastecimento
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            <Input label="Horário" type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Valor Total (R$)" type="number" step="0.01" required value={formData.totalCost} onChange={e => setFormData({ ...formData, totalCost: e.target.value })} />
            <Input label="Litros" type="number" step="0.1" required value={formData.liters} onChange={e => setFormData({ ...formData, liters: e.target.value })} />
            <Input label="Km Atual" type="number" required value={formData.newMileage} onChange={e => setFormData({ ...formData, newMileage: e.target.value })} />
          </div>
        </div>

        {/* Estado Inicial do Veículo - apenas para primeiro registro da seção */}
        {isFirst && (
          <div className="bg-amber-50 p-4 rounded-xl mb-6 border border-amber-100">
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-2">Estado Inicial do Veículo</p>
            <Input
              label="Combustível Inicial no Tanque (L)"
              type="number"
              placeholder="Ex: 50"
              required
              value={formData.initialFuel}
              onChange={e => setFormData({ ...formData, initialFuel: e.target.value })}
            />
            <p className="text-[10px] text-amber-500 italic mt-1">Informe quanto combustível já havia no tanque antes deste abastecimento.</p>
          </div>
        )}

        {/* Seção de Fotos */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ImageIcon size={16} className="text-indigo-600" />
            Fotos Anexadas
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Fotos do Odômetro (Antes e Depois) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <p className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
                <Gauge size={14} /> Odômetro
              </p>
              <div className="space-y-3">
                {/* Foto ANTES */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] font-bold text-amber-700 uppercase">📍 Antes do Abastecimento</p>
                    <div className="flex gap-1">
                      {!removeOdometerBefore && (entry.odometerBeforePhoto || entry.odometerUrl) && (
                        <button type="button" onClick={() => setRemoveOdometerBefore(true)} className="text-rose-500 hover:text-rose-700 p-0.5">
                          <Trash2 size={12} />
                        </button>
                      )}
                      {!removeOdometerBefore && !(entry.odometerBeforePhoto || entry.odometerUrl) && !newOdometerBeforeFile && (
                        <button type="button" onClick={() => odometerBeforeInputRef.current?.click()} className="text-indigo-500 hover:text-indigo-700 p-0.5">
                          <PlusCircle size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <input ref={odometerBeforeInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setNewOdometerBeforeFile(e.target.files[0])} />

                  {newOdometerBeforeFile && !removeOdometerBefore ? (
                    <div className="flex items-center gap-2 p-1 bg-emerald-50 border border-emerald-100 rounded">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span className="text-[10px] text-emerald-700 flex-1 truncate">{newOdometerBeforeFile.name}</span>
                      <button type="button" onClick={() => setNewOdometerBeforeFile(null)} className="text-rose-500"><X size={10} /></button>
                    </div>
                  ) : (entry.odometerBeforePhoto || entry.odometerUrl) && !removeOdometerBefore ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={entry.odometerBeforePhoto || entry.odometerUrl}
                        alt="Odômetro Antes"
                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewingImage('odometer-before')}
                      />
                      <button type="button" onClick={() => setPreviewingImage('odometer-before')} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-medium hover:bg-indigo-200">
                        <Eye size={10} className="inline" /> Ver
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">{removeOdometerBefore ? 'Será removida' : 'Sem foto'}</p>
                  )}
                </div>

                {/* Foto DEPOIS */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">✅ Depois do Abastecimento</p>
                    <div className="flex gap-1">
                      {!removeOdometerAfter && entry.odometerAfterPhoto && (
                        <button type="button" onClick={() => setRemoveOdometerAfter(true)} className="text-rose-500 hover:text-rose-700 p-0.5">
                          <Trash2 size={12} />
                        </button>
                      )}
                      {!removeOdometerAfter && !entry.odometerAfterPhoto && !newOdometerAfterFile && (
                        <button type="button" onClick={() => odometerAfterInputRef.current?.click()} className="text-indigo-500 hover:text-indigo-700 p-0.5">
                          <PlusCircle size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <input ref={odometerAfterInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setNewOdometerAfterFile(e.target.files[0])} />

                  {newOdometerAfterFile && !removeOdometerAfter ? (
                    <div className="flex items-center gap-2 p-1 bg-emerald-50 border border-emerald-100 rounded">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      <span className="text-[10px] text-emerald-700 flex-1 truncate">{newOdometerAfterFile.name}</span>
                      <button type="button" onClick={() => setNewOdometerAfterFile(null)} className="text-rose-500"><X size={10} /></button>
                    </div>
                  ) : entry.odometerAfterPhoto && !removeOdometerAfter ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={entry.odometerAfterPhoto}
                        alt="Odômetro Depois"
                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewingImage('odometer-after')}
                      />
                      <button type="button" onClick={() => setPreviewingImage('odometer-after')} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-medium hover:bg-indigo-200">
                        <Eye size={10} className="inline" /> Ver
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">{removeOdometerAfter ? 'Será removida' : 'Sem foto'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Foto do Recibo */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <p className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
                <FileText size={14} /> Recibo
              </p>
              {hasReceipt ? (
                <div className="space-y-2">
                  <img
                    src={receiptPhoto}
                    alt="Recibo"
                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewingImage('receipt')}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPreviewingImage('receipt')} className="flex-1 text-xs bg-indigo-100 text-indigo-700 py-1.5 rounded-lg font-medium hover:bg-indigo-200 transition-colors">
                      <Eye size={12} className="inline mr-1" /> Ver
                    </button>
                    <button type="button" onClick={() => setRemoveReceipt(true)} className="flex-1 text-xs bg-rose-100 text-rose-700 py-1.5 rounded-lg font-medium hover:bg-rose-200 transition-colors">
                      <Trash2 size={12} className="inline mr-1" /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {removeReceipt && (
                    <p className="text-xs text-rose-600 italic">Foto será removida ao salvar</p>
                  )}
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setNewReceiptFile(e.target.files[0])}
                  />
                  {newReceiptFile ? (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-xs text-emerald-700 flex-1 truncate">{newReceiptFile.name}</span>
                      <button type="button" onClick={() => setNewReceiptFile(null)} className="text-rose-500 hover:text-rose-700">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-white hover:border-indigo-300 transition-colors text-sm"
                    >
                      <Plus size={20} className="mx-auto mb-1" />
                      Adicionar Foto
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Campo de Nota */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText size={16} className="text-indigo-600" />
            Observação / Nota
          </h3>
          <textarea
            value={formData.note || ''}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="Adicione uma observação sobre este registro (opcional)..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none z-10 relative"
            rows={3}
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {!showDeleteConfirm ? (
            <>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> Excluir
              </button>
              <div className="flex-1" />
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? <><Loader2 className="animate-spin" size={18} /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </>
          ) : (
            <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 animate-in fade-in">
              <p className="text-rose-700 font-bold mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                Confirmar exclusão do registro de {formatDateBR(entry.date)}?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-white text-slate-600 font-bold rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Modal de Preview de Imagem (interno) */}
      {previewingImage && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-lg flex items-center justify-center z-[110] p-4" onClick={() => { setPreviewingImage(null); setZoom(1); }}>
          <div className="relative max-w-4xl w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-white font-bold text-lg">
                {previewingImage === 'odometer-before' && 'Odômetro - Antes do Abastecimento'}
                {previewingImage === 'odometer-after' && 'Odômetro - Depois do Abastecimento'}
                {previewingImage === 'receipt' && 'Foto do Recibo'}
              </p>
              <div className="flex gap-2 items-center">
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl transition-all" title="Reduzir Zoom">
                  <ZoomOut size={20} />
                </button>
                <span className="text-white font-mono text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(z + 0.5, 4))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl transition-all" title="Aumentar Zoom">
                  <ZoomIn size={20} />
                </button>
                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                <button
                  onClick={() => {
                    const src = previewingImage === 'odometer-before' ? (entry.odometerBeforePhoto || entry.odometerUrl) : previewingImage === 'odometer-after' ? entry.odometerAfterPhoto : receiptPhoto;
                    // Abrir em nova aba (download direto costuma ser bloqueado pelo CORS)
                    if (src) window.open(src, '_blank');
                  }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-all ml-1" title="Baixar/Ver Original"
                >
                  <Download size={20} />
                </button>
                <button onClick={() => { setPreviewingImage(null); setZoom(1); }} className="bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white p-2 rounded-xl transition-all ml-2" title="Fechar">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center relative bg-black/50 rounded-2xl border border-slate-700/50 custom-scrollbar p-0">
              <img
                src={
                  previewingImage === 'odometer-before' ? (entry.odometerBeforePhoto || entry.odometerUrl) :
                    previewingImage === 'odometer-after' ? entry.odometerAfterPhoto :
                      receiptPhoto
                }
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                alt="Preview"
                className="max-w-full max-h-full object-contain cursor-move"
              />
            </div>
          </div>
        </div>
      )}
    </ModalBackdrop>
  );
};

// Modal de Gerenciamento de Seções
const SectionManagementModal = ({ isOpen, onClose, onSave, truck }) => {
  const [sections, setSections] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('00:00');
  const [newSectionDate, setNewSectionDate] = useState('');
  const [newSectionNote, setNewSectionNote] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Carregar seções iniciais
  useEffect(() => {
    if (!isOpen || !truck) return;

    console.log('SectionManagementModal: Loading sections for truck', truck.id);
    const existingSections = truck.sections || [];

    // Garantir que a data inicial legada vire uma seção se não houver duplicata
    let initialSections = [...existingSections];
    if (truck.sectionStartDate && !existingSections.some(s => s.date === truck.sectionStartDate)) {
      initialSections.unshift({
        id: 'legacy-start-' + truck.id, // ID consistente
        date: truck.sectionStartDate,
        type: 'created',
        note: 'Data Inicial (Legado)'
      });
    }

    // Garantir IDs únicos para tudo
    const sectionsWithIds = initialSections.map((s, i) => ({
      ...s,
      id: s.id || `section-${Date.now()}-${i}`
    }));

    setSections(sectionsWithIds);
  }, [isOpen, truck?.id]);

  const resetForm = () => {
    setEditingId(null);
    setNewSectionDate('');
    setNewSectionNote('');
    setDeletingId(null);
  };

  const handleMainAction = () => {
    if (!newSectionDate) {
      alert('A data de início da seção é obrigatória.');
      return;
    }

    const newSection = {
      id: editingId || `section-${Date.now()}`,
      date: newSectionDate,
      note: newSectionNote,
    };

    setSections(prevSections => {
      let updatedSections;
      if (editingId) {
        updatedSections = prevSections.map(s => s.id === editingId ? newSection : s);
      } else {
        updatedSections = [...prevSections, newSection];
      }
      // Sort by date descending
      return updatedSections.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    resetForm();
  };

  const cancelEditing = () => {
    resetForm();
  };

  const handleEdit = (e, section) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(section.id);
    setNewSectionDate(section.date);
    setNewSectionNote(section.note || '');
    setDeletingId(null); // Fecha confirmação de delete se abrir edição
  };

  const handleRequestDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    setEditingId(null); // Fecha edição se abrir delete
  };

  const handleConfirmDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('SectionManagementModal: Deleting section', id);
    setSections(prev => prev.filter(s => s.id !== id));
    setDeletingId(null);
  };

  const handleCancelDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(null);
  };

  const handleSaveToTruck = () => {
    // Validar seções sem data
    if (sections.some(s => !s.date)) {
      alert('Todas as seções precisam de uma data válida.');
      return;
    }
    onSave(truck.id, sections); // Pass truck.id and sections
    onClose();
  };

  if (!isOpen || !truck) return null;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header Fixo */}
        <div className="px-8 py-6 border-b border-indigo-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <CalendarRange className="text-indigo-600" />
              Seções do Histórico
            </h2>
            <p className="text-sm text-slate-500 mt-1">Gerencie os pontos de corte de média</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Corpo Rolável */}
        <div className="p-8 flex flex-col flex-1 min-h-0 overflow-y-auto">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="text-amber-600 shrink-0" size={20} />
              <div className="text-sm text-amber-800">
                <p className="font-bold mb-1">Como funciona?</p>
                <p>Criar uma nova seção zera os contadores de média e consumo a partir daquela data. O histórico anterior é preservado, mas separado.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PlusCircle size={16} />
              {editingId ? 'Editar Seção' : 'Nova Seção'}
            </h3>
            <div className="flex gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
                  <input
                    type="datetime-local"
                    value={newSectionDate}
                    onChange={(e) => setNewSectionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observação (Opcional)</label>
                  <input
                    type="text"
                    value={newSectionNote}
                    onChange={(e) => setNewSectionNote(e.target.value)}
                    placeholder="Ex: Troca de Motorista"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col justify-end">
                {editingId ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleMainAction}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg transition-colors flex items-center justify-center"
                      title="Salvar Edição"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-3 rounded-lg transition-colors flex items-center justify-center"
                      title="Cancelar Edição"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleMainAction}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg h-[88px] transition-colors flex items-center justify-center shadow-lg shadow-indigo-200"
                    title="Adicionar à Lista"
                  >
                    <PlusCircle size={24} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Seções Ativas ({sections.length})</h3>
            {sections.length === 0 ? (
              <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                Nenhuma seção definida
              </div>
            ) : (
              <div className="space-y-2">
                {sections.sort((a, b) => new Date(b.date) - new Date(a.date)).map(section => (
                  <div key={section.id} className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-all shadow-sm hover:shadow-md">

                    {/* Conteúdo da Linha */}
                    <div>
                      <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-700">
                        <Calendar size={14} className="text-indigo-500" />
                        {new Date(section.date).toLocaleString('pt-BR')}
                      </div>
                      {section.note && (
                        <div className="text-xs text-slate-500 mt-0.5 ml-6 italic">
                          "{section.note}"
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">

                      {deletingId === section.id ? (
                        <div className="flex items-center bg-rose-50 border border-rose-200 rounded-lg p-1 animate-in fade-in slide-in-from-right-5 duration-200">
                          <span className="text-[10px] font-bold text-rose-700 uppercase mr-2 ml-1">Confirmar?</span>
                          <button
                            type="button"
                            onClick={(e) => handleConfirmDelete(e, section.id)}
                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md mr-1 transition-colors"
                            title="Sim, excluir"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md transition-colors"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleEdit(e, section)}
                            className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Editar data"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleRequestDelete(e, section.id)}
                            className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Excluir seção"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer Fixo */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveToTruck}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform active:scale-95"
          >
            Salvar Alterações
          </button>
        </div>

      </div>
    </ModalBackdrop>
  );
};

// Modal de Cadastro de Serviço de Manutenção
const ServiceModal = ({ isOpen, onClose, onSave, editingService = null, trucks = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    periodicityType: 'km',
    periodicityValue: '',
    applicableTrucks: []
  });

  useEffect(() => {
    if (isOpen) {
      if (editingService) {
        setFormData({
          name: editingService.name || '',
          periodicityType: editingService.periodicityType || 'km',
          periodicityValue: editingService.periodicityValue || '',
          applicableTrucks: editingService.applicableTrucks || []
        });
      } else {
        setFormData({
          name: '',
          periodicityType: 'km',
          periodicityValue: '',
          applicableTrucks: trucks.map(t => t.id) // Por padrão, todos
        });
      }
    }
  }, [isOpen, editingService, trucks]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: editingService?.id,
      name: formData.name,
      periodicityType: formData.periodicityType,
      periodicityValue: Number(formData.periodicityValue),
      applicableTrucks: formData.applicableTrucks,
      createdAt: editingService?.createdAt || new Date().toISOString()
    });
    onClose();
  };

  const toggleTruck = (truckId) => {
    setFormData(prev => ({
      ...prev,
      applicableTrucks: prev.applicableTrucks.includes(truckId)
        ? prev.applicableTrucks.filter(id => id !== truckId)
        : [...prev.applicableTrucks, truckId]
    }));
  };

  const toggleAll = () => {
    if (formData.applicableTrucks.length === trucks.length) {
      setFormData(prev => ({ ...prev, applicableTrucks: [] }));
    } else {
      setFormData(prev => ({ ...prev, applicableTrucks: trucks.map(t => t.id) }));
    }
  };

  if (!isOpen) return null;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6 border-b border-slate-100 bg-indigo-50/30 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-indigo-600" size={24} />
            {editingService ? 'Editar Serviço' : 'Cadastrar Serviço'}
          </h2>
          <p className="text-sm text-slate-500">Defina regras de manutenção periódica</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={24} className="text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <Input
          label="Nome do Serviço"
          type="text"
          placeholder="Ex: Troca de Óleo"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Periodicidade</label>
            <select
              value={formData.periodicityType}
              onChange={(e) => setFormData({ ...formData, periodicityType: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium"
            >
              <option value="km">Por Quilometragem (Km)</option>
              <option value="days">Por Tempo (Dias)</option>
            </select>
          </div>
          <Input
            label={formData.periodicityType === 'km' ? 'A cada (Km)' : 'A cada (Dias)'}
            type="number"
            placeholder={formData.periodicityType === 'km' ? 'Ex: 10000' : 'Ex: 90'}
            required
            value={formData.periodicityValue}
            onChange={(e) => setFormData({ ...formData, periodicityValue: e.target.value })}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Veículos Aptos</label>
            <button type="button" onClick={toggleAll} className="text-xs text-indigo-600 font-bold hover:underline">
              {formData.applicableTrucks.length === trucks.length ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
            {trucks.map(truck => (
              <label key={truck.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded-lg">
                <input
                  type="checkbox"
                  checked={formData.applicableTrucks.includes(truck.id)}
                  onChange={() => toggleTruck(truck.id)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-sm font-medium text-slate-700">{truck.plate}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1">
            {editingService ? 'Atualizar Serviço' : 'Cadastrar Serviço'}
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// Modal de Registro de Manutenção
const MaintenanceRecordModal = ({ isOpen, onClose, onSave, trucks = [], services = [], entries = [], records = [], prefilled = null, isSaving = false }) => {
  const [formData, setFormData] = useState({
    truckId: '',
    date: '',
    serviceId: '',
    customServiceName: '',
    mileage: '',
    cost: ''
  });
  const [showMileageWarning, setShowMileageWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowMileageWarning(false);
      if (prefilled) {
        setFormData({
          truckId: prefilled.truckId || '',
          date: new Date().toISOString().split('T')[0],
          serviceId: prefilled.serviceId || '',
          customServiceName: '',
          mileage: '',
          cost: ''
        });
      } else {
        setFormData({
          truckId: trucks.length === 1 ? trucks[0].id : '',
          date: new Date().toISOString().split('T')[0],
          serviceId: '',
          customServiceName: '',
          mileage: '',
          cost: ''
        });
      }
    }
  }, [isOpen, prefilled, trucks]);

  const selectedTruck = trucks.find(t => t.id === formData.truckId);

  // Calcular última km conhecida (maior entre abastecimentos e manutenções)
  const getLastKnownMileage = () => {
    if (!formData.truckId) return 0;
    const truckEntries = entries.filter(e => e.truckId === formData.truckId);
    const truckRecords = records.filter(r => r.truckId === formData.truckId);
    const lastEntryKm = truckEntries.length > 0 ? Math.max(...truckEntries.map(e => e.newMileage || 0)) : 0;
    const lastRecordKm = truckRecords.length > 0 ? Math.max(...truckRecords.map(r => r.mileage || 0)) : 0;
    return Math.max(lastEntryKm, lastRecordKm);
  };

  const lastKnownMileage = getLastKnownMileage();

  const doSave = () => {
    const mileage = Number(formData.mileage);
    const serviceName = formData.serviceId === 'outro'
      ? formData.customServiceName
      : services.find(s => s.id === formData.serviceId)?.name || '';

    onSave({
      truckId: formData.truckId,
      date: formData.date,
      serviceId: formData.serviceId === 'outro' ? null : formData.serviceId,
      serviceName: serviceName,
      mileage: mileage,
      cost: Number(formData.cost),
      createdAt: new Date().toISOString()
    });
    setShowMileageWarning(false);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const mileage = Number(formData.mileage);
    if (mileage < lastKnownMileage) {
      setShowMileageWarning(true);
      return;
    }

    doSave();
  };

  if (!isOpen) return null;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6 border-b border-slate-100 bg-emerald-50/30 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="text-emerald-600" size={24} />
            Registro de Manutenção
          </h2>
          <p className="text-sm text-slate-500">Registre uma manutenção realizada</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={24} className="text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Veículo</label>
          <select
            value={formData.truckId}
            onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium"
          >
            <option value="">Selecione um veículo</option>
            {trucks.map(truck => (
              <option key={truck.id} value={truck.id}>{truck.plate} - {truck.driver}</option>
            ))}
          </select>
        </div>

        <Input
          label="Data da Manutenção"
          type="date"
          required
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        />

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Manutenção</label>
          <select
            value={formData.serviceId}
            onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium"
          >
            <option value="">Selecione o tipo</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
            <option value="outro">Outro (especificar)</option>
          </select>
        </div>

        {formData.serviceId === 'outro' && (
          <Input
            label="Especifique o Serviço"
            type="text"
            placeholder="Ex: Alinhamento e Balanceamento"
            required
            value={formData.customServiceName}
            onChange={(e) => setFormData({ ...formData, customServiceName: e.target.value })}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="Km no Ato"
              type="number"
              required
              placeholder="Ex: 45000"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
            />
            {selectedTruck && lastKnownMileage > 0 && (
              <p className="text-[10px] text-slate-500 mt-1">Última Km: {lastKnownMileage.toLocaleString()}</p>
            )}
          </div>
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            required
            placeholder="Ex: 350.00"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="success" className="flex-1" disabled={isSaving}>
            {isSaving ? <><Loader2 className="animate-spin" size={18} /> Salvando...</> : 'Registrar Manutenção'}
          </Button>
        </div>
      </form>

      {/* Modal de aviso de quilometragem */}
      {showMileageWarning && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center p-4 rounded-3xl">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-amber-600" size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Quilometragem Inferior</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              A quilometragem informada ({Number(formData.mileage).toLocaleString()} km) é <span className="font-bold text-amber-600">inferior</span> à última registrada ({lastKnownMileage.toLocaleString()} km).
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Isso pode ocorrer se você estiver cadastrando uma manutenção histórica. Deseja continuar mesmo assim?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMileageWarning(false)}
                className="flex-1 py-3 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 transition-colors"
              >
                Corrigir
              </button>
              <button
                onClick={doSave}
                className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalBackdrop>
  );
};

// --- Dashboard Charts ---

const EfficiencyChart = ({ data, period, onPeriodChange }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <Card className="min-h-[400px] flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="text-indigo-600" size={20} />Eficiência da Frota (Km/L)</h3>
          <p className="text-xs text-slate-400 font-medium">Histórico acumulado da frota</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['week', 'month', 'year'].map(p => (
            <button key={p} onClick={() => onPeriodChange(p)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Ano'}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-end gap-2 relative pt-6 pb-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            <div className="absolute -top-4 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] py-1 px-2 rounded-md z-10">{item.value.toFixed(2)} Km/L</div>
            <div className="w-full max-w-[40px] rounded-t-lg transition-all bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-500 shadow-md" style={{ height: `${(item.value / maxVal) * 100}%` }}></div>
            <span className="text-[9px] font-bold text-slate-400 mt-3 truncate w-full text-center">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

const DashboardPieChart = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-sm font-bold text-slate-700 uppercase mb-4">{title}</h3>
      <div className="flex flex-1 items-center gap-6">
        <div className="relative w-32 h-32 rounded-full overflow-hidden">
          <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
            {total > 0 ? data.map((item, idx) => {
              const percentage = (item.value / total) * 100;
              const r = 8;
              const C = 2 * Math.PI * r;
              const dashValue = (percentage / 100) * C;
              const dash = `${dashValue} ${C - dashValue}`;
              const offset = (currentAngle / 100) * -C;
              currentAngle += percentage;
              return (
                <circle
                  key={idx}
                  r={r}
                  cx="16"
                  cy="16"
                  fill="transparent"
                  stroke={colors[idx % colors.length]}
                  strokeWidth={r * 2}
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                />
              );
            }) : (
              <circle r="16" cx="16" cy="16" fill="#f1f5f9" />
            )}
          </svg>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                <span className="text-slate-600 truncate max-w-[100px]" title={item.label}>{item.label}</span>
              </div>
              <span className="font-bold text-slate-800">{((item.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

const DashboardBarChart = ({ data, title, unit = "" }) => {
  const maxVal = Math.max(...data.map(d => d.value), 0.1);
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-sm font-bold text-slate-700 uppercase mb-6">{title}</h3>
      <div className="flex-1 flex items-end gap-3 pt-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            <div className="absolute -top-4 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] py-1 px-2 rounded-md z-10 whitespace-nowrap">
              {unit} {item.value.toFixed(2)}
            </div>
            <div
              className="w-full rounded-t-lg transition-all opacity-80 group-hover:opacity-100"
              style={{
                height: `${(item.value / maxVal) * 80}%`,
                backgroundColor: colors[idx % colors.length]
              }}
            ></div>
            <span className="text-[9px] font-bold text-slate-400 mt-2 truncate w-full text-center" title={item.label}>{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

// --- Componente Principal ---

export default function FleetManager({ embedded = false, externalView, onNavigate, user: externalUser }) {
  const [user, setUser] = useState(externalUser || null);
  const [view, setView] = useState('dashboard');
  const [trucks, setTrucks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [activeKmlIndex, setActiveKmlIndex] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    setActiveKmlIndex(0);
  }, [selectedTruck]);
  const [editingTruck, setEditingTruck] = useState(null);
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('week');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsEntry, setDetailsEntry] = useState(null);

  // Filtro do Dashboard Geral
  const [dashboardStartDate, setDashboardStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dashboardEndDate, setDashboardEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Sincronizar view externa (quando embarcado)
  useEffect(() => {
    if (embedded && externalView) {
      setView(externalView);
    }
  }, [embedded, externalView]);

  // Função interna para mudar view (chama onNavigate se embarcado)
  const handleViewChange = (newView) => {
    if (embedded && onNavigate) {
      onNavigate(newView);
    } else {
      setView(newView);
    }
  };

  // ... (o restante dos estados) ...
  const [maintenanceServices, setMaintenanceServices] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isMaintenanceRecordModalOpen, setIsMaintenanceRecordModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [prefilledMaintenance, setPrefilledMaintenance] = useState(null);
  const [selectedMaintenanceTruck, setSelectedMaintenanceTruck] = useState(null);


  // Estado de autenticação do admin (Firebase Auth)
  const [adminUser, setAdminUser] = useState((embedded && externalUser && !externalUser.isAnonymous) ? externalUser : null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(embedded ? (!externalUser) : true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    if (!embedded) {
      document.title = "Gestão de Frota TIM";
    }
  }, [embedded]);

  // Monitorar estado de autenticação do admin
  useEffect(() => {
    if (embedded) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Usuário logado com email (não anônimo) = admin
      if (currentUser && !currentUser.isAnonymous && currentUser.email) {
        setAdminUser(currentUser);
      } else {
        setAdminUser(null);
      }
      setIsAdminLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sincronizar usuário externo se embarcado
  useEffect(() => {
    if (embedded && externalUser && !externalUser.isAnonymous) {
      setAdminUser(externalUser);
      setIsAdminLoading(false);
    }
  }, [embedded, externalUser]);

  // Login do admin com Firebase Auth
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    setIsAdminLoading(true);

    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      // onAuthStateChanged will handle setting adminUser
    } catch (error) {
      console.error('Erro no login:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAdminLoginError('Email ou senha incorretos');
      } else if (error.code === 'auth/invalid-email') {
        setAdminLoginError('Email inválido');
      } else if (error.code === 'auth/too-many-requests') {
        setAdminLoginError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setAdminLoginError('Erro ao conectar. Tente novamente.');
      }
    }
    setIsAdminLoading(false);
  };

  // Logout do admin
  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      setAdminEmail('');
      setAdminPassword('');
      // Reautenticar anonimamente para continuar acessando Firestore
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  // Recuperação de senha
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setAdminLoginError('');

    if (!adminEmail) {
      setAdminLoginError('Digite seu email para recuperar a senha');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, adminEmail);
      setResetEmailSent(true);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      if (error.code === 'auth/user-not-found') {
        setAdminLoginError('Email não cadastrado');
      } else if (error.code === 'auth/invalid-email') {
        setAdminLoginError('Email inválido');
      } else {
        setAdminLoginError('Erro ao enviar email. Tente novamente.');
      }
    }
  };

  useEffect(() => {
    const scripts = ['https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js'];
    scripts.forEach(src => { if (!document.querySelector(`script[src="${src}"]`)) { const s = document.createElement('script'); s.src = src; s.async = true; document.head.appendChild(s); } });
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (embedded) return;
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
      else await signInAnonymously(auth);
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubT = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'trucks'), (snap) => setTrucks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubE = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'entries'), (snap) => setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubMS = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceServices'), (snap) => setMaintenanceServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubMR = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords'), (snap) => setMaintenanceRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => { unsubT(); unsubE(); unsubMS(); unsubMR(); };
  }, [user]);

  // Função para adicionar ou atualizar caminhão
  const handleSaveTruck = async (d) => {
    if (!user) return null;

    if (d.id) {
      // Editar
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', d.id), d);
      sendToGoogleSheets({ type: 'truck_update', id: d.id, ...d });
    } else {
      // Adicionar novo
      const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trucks'), d);
      sendToGoogleSheets({ type: 'truck', id: ref.id, ...d });
      return { id: ref.id, ...d };
    }
  };

  const handleDeleteTruck = async (id, plate) => {
    if (!user) return;
    if (!confirm(`Tem certeza que deseja excluir o caminhão ${plate}? Isso removerá permanentemente o caminhão e TODOS os seus registros de abastecimento e manutenção.`)) return;

    try {
      // 1. Deletar o caminhão
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', id));

      // 2. Deletar todos os abastecimentos (entries) associados
      const truckEntries = entries.filter(e => e.truckId === id);
      for (const entry of truckEntries) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'entries', entry.id));
      }

      // 3. Deletar todos os registros de manutenção (maintenanceRecords) associados
      const truckMaintenance = maintenanceRecords.filter(m => m.truckId === id);
      for (const record of truckMaintenance) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords', record.id));
      }

      sendToGoogleSheets({ type: 'truck_delete', id });
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir caminhão e seus registros.");
    }
  };

  // Função para definir quebra de seção
  const handleSectionBreak = async (truckId, sectionsData) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), {
        sections: sectionsData,
        sectionStartDate: sectionsData.length > 0 ? sectionsData[0].date : null // Manter compatibilidade com lógica antiga se necessário, ou apenas usar sections
      });
      // Atualizar o selectedTruck local se for o mesmo
      if (selectedTruck && selectedTruck.id === truckId) {
        setSelectedTruck({ ...selectedTruck, sections: sectionsData, sectionStartDate: sectionsData.length > 0 ? sectionsData[0].date : null });
      }
    } catch (err) {
      console.error('Erro ao definir seções:', err);
      alert("Erro ao definir seções. Tente novamente.");
    }
  };

  // Salvar serviço de manutenção
  const handleSaveService = async (data) => {
    if (!user) return;
    try {
      const { id, ...serviceData } = data; // Remove id do objeto
      if (id) {
        // Editar existente
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenanceServices', id), serviceData);
      } else {
        // Criar novo
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceServices'), serviceData);
      }
    } catch (err) {
      console.error('Erro ao salvar serviço:', err);
      alert("Erro ao salvar serviço. Tente novamente.");
    }
  };

  // Deletar serviço de manutenção
  const handleDeleteService = async (id, name) => {
    if (!user) return;
    if (!confirm(`Tem certeza que deseja excluir o serviço "${name}"? Os registros de manutenções já feitas não serão afetados.`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenanceServices', id));
    } catch (err) {
      console.error('Erro ao excluir serviço:', err);
      alert("Erro ao excluir serviço.");
    }
  };

  // Salvar registro de manutenção
  const handleSaveMaintenanceRecord = async (data) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords'), data);
    } catch (err) {
      console.error('Erro ao salvar registro de manutenção:', err);
      alert("Erro ao salvar registro de manutenção. Tente novamente.");
    }
  };

  // Deletar registro de manutenção
  const handleDeleteMaintenanceRecord = async (id) => {
    if (!user) return;
    if (!confirm('Tem certeza que deseja excluir este registro de manutenção?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'maintenanceRecords', id));
    } catch (err) {
      console.error('Erro ao excluir registro:', err);
      alert("Erro ao excluir registro.");
    }
  };

  // Calcular alertas de manutenção
  const maintenanceAlerts = useMemo(() => {
    const alerts = [];
    const today = new Date();

    maintenanceServices.forEach(service => {
      service.applicableTrucks.forEach(truckId => {
        const truck = trucks.find(t => t.id === truckId);
        if (!truck) return;

        // Última km do veículo (maior entre abastecimentos)
        const truckEntries = entries.filter(e => e.truckId === truckId);
        const currentMileage = truckEntries.length > 0
          ? Math.max(...truckEntries.map(e => e.newMileage || 0))
          : (truck.currentMileage || 0);

        // Último registro deste serviço para este veículo
        const serviceRecords = maintenanceRecords.filter(
          r => r.truckId === truckId && r.serviceId === service.id
        );
        const lastRecord = serviceRecords.sort((a, b) =>
          new Date(b.date) - new Date(a.date)
        )[0];

        let isDue = false;
        let dueInfo = '';

        if (!lastRecord) {
          // Nunca feito - alertar imediatamente
          isDue = true;
          dueInfo = 'Nunca realizado';
        } else if (service.periodicityType === 'km') {
          const nextDueKm = lastRecord.mileage + service.periodicityValue;
          if (currentMileage >= nextDueKm) {
            isDue = true;
            dueInfo = `Última: ${lastRecord.mileage.toLocaleString()} km (Próxima: ${nextDueKm.toLocaleString()} km)`;
          }
        } else if (service.periodicityType === 'days') {
          const lastDate = new Date(lastRecord.date);
          const nextDueDate = new Date(lastDate);
          nextDueDate.setDate(nextDueDate.getDate() + service.periodicityValue);
          if (today >= nextDueDate) {
            isDue = true;
            dueInfo = `Última: ${formatDateBR(lastRecord.date)} (Venceu: ${formatDateBR(nextDueDate.toISOString().split('T')[0])})`;
          }
        }

        if (isDue) {
          alerts.push({
            id: `${service.id}-${truckId}`,
            truckId,
            serviceId: service.id,
            truck,
            service,
            dueInfo,
            lastRecord
          });
        }
      });
    });

    return alerts;
  }, [maintenanceServices, maintenanceRecords, trucks, entries]);


  const handleSaveEntry = async (d, files = {}) => {
    if (!user) return;
    setIsSavingEntry(true);

    try {
      let entryId = d.id;

      // Encontra o registro anterior para calcular a diferença (GAP)
      // O registro anterior é aquele cuja quilometragem é imediatamente inferior à atual (ou o mais recente por data)
      const truckHistory = entries
        .filter(e => e.truckId === d.truckId)
        .sort((a, b) => new Date(b.date) - new Date(a.date) || b.newMileage - a.newMileage);

      let previousEntry = null;

      if (d.id) {
        // Se estiver editando, o anterior é o próximo na lista após o atual
        const currentIndex = truckHistory.findIndex(e => e.id === d.id);
        if (currentIndex !== -1 && currentIndex < truckHistory.length - 1) {
          previousEntry = truckHistory[currentIndex + 1];
        }
      } else {
        // Se for novo, o anterior é o topo da lista (o mais recente até agora)
        if (truckHistory.length > 0) {
          previousEntry = truckHistory[0];
        }
      }

      // Se existir registro anterior, calculamos a distância percorrida DELE até o ATUAL
      // E salvamos essa distância NO REGISTRO ANTERIOR.
      if (previousEntry) {
        const dist = Number(d.newMileage) - Number(previousEntry.newMileage);

        // Atualiza o registro anterior com a distância calculada se for um valor válido
        if (!isNaN(dist)) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'entries', previousEntry.id), {
            distanceTraveled: dist
          });
        }
      }

      // 3. Upload de fotos para Firebase Storage (retornam URLs, não Base64)
      // O entryId é necessário para o path, então usamos d.id quando editó
      const photoEntryId = d.id || `pending-${Date.now()}`;
      const [odometerBeforeUrl, odometerAfterUrl, receiptUploadUrl] = await Promise.all([
        uploadToStorage(files.odometerBeforeFile || files.odometerFile, `entries/${photoEntryId}/odometerBefore`),
        uploadToStorage(files.odometerAfterFile, `entries/${photoEntryId}/odometerAfter`),
        uploadToStorage(files.receiptFile, `entries/${photoEntryId}/receipt`)
      ]);

      // Payload genérico não é mais usado diretamente — ver ramificações abaixo

      // 1. Salvar no Firebase
      if (d.id) {
        // --- EDIÇÃO: Envia só os campos que mudaram, NUNCA re-envia fotos existentes ---
        const editPayload = {
          date: d.date,
          time: d.time,
          totalCost: d.totalCost,
          liters: d.liters,
          costPerLiter: d.costPerLiter,
          newMileage: d.newMileage,
          note: d.note ?? null,
          distanceTraveled: d.distanceTraveled || 0,
          initialFuel: d.initialFuel ?? null,
        };

        // Só inclui fotos se houve mudança explícita (nova foto ou remoção)
        if (odometerBeforeUrl) {
          editPayload.odometerBeforePhoto = odometerBeforeUrl;
          editPayload.odometerUrl = odometerBeforeUrl;
        } else if (d.odometerBeforePhoto === null) {
          editPayload.odometerBeforePhoto = null;
          editPayload.odometerUrl = null;
        }

        if (odometerAfterUrl) {
          editPayload.odometerAfterPhoto = odometerAfterUrl;
        } else if (d.odometerAfterPhoto === null) {
          editPayload.odometerAfterPhoto = null;
        }

        if (receiptUploadUrl) {
          editPayload.receiptUrl = receiptUploadUrl;
          editPayload.receiptPhoto = receiptUploadUrl;
        } else if (d.receiptUrl === null) {
          editPayload.receiptUrl = null;
          editPayload.receiptPhoto = null;
        }

        editPayload.hasReceipt = receiptUploadUrl ? true : !!(d.receiptUrl);
        editPayload.hasOdometer = odometerBeforeUrl || odometerAfterUrl ? true : !!(d.odometerUrl);

        const originalEntry = entries.find(e => e.id === d.id);
        if (originalEntry && originalEntry.registeredBy === 'driver') {
          editPayload.editedByController = true;
          editPayload.registeredBy = 'driver';
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'entries', d.id), editPayload);
      } else {
        // --- NOVO REGISTRO: Cria primeiro o doc para obter o ID, então atualiza com as URLs ---
        const { id: _id2, ...dataForNew } = d;
        const newPayload = {
          ...dataForNew,
          distanceTraveled: 0,
          receiptUrl: receiptUploadUrl || null,
          receiptPhoto: receiptUploadUrl || null,
          odometerUrl: odometerBeforeUrl || null,
          odometerBeforePhoto: odometerBeforeUrl || null,
          odometerAfterPhoto: odometerAfterUrl || null,
          hasReceipt: !!receiptUploadUrl,
          hasOdometer: !!(odometerBeforeUrl || odometerAfterUrl)
        };
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'entries'), newPayload);
        entryId = docRef.id;
      }

      // 2. Atualizar parâmetros do Caminhão
      const truck = trucks.find(t => t.id === d.truckId);
      if (truck) {
        const dummyPayload = {
          ...d,
          receiptUrl: receiptUploadUrl || d.receiptUrl || null,
          odometerBeforePhoto: odometerBeforeUrl || d.odometerBeforePhoto || null,
          odometerAfterPhoto: odometerAfterUrl || d.odometerAfterPhoto || null,
        };
        const currentEntryForCalcs = { ...dummyPayload, id: entryId };
        const otherEntries = entries.filter(e => e.truckId === d.truckId && e.id !== entryId);
        const truckEntries = [...otherEntries, currentEntryForCalcs];

        const sorted = [...truckEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
        const isFirst = sorted[0]?.id === entryId;
        const maxMileage = Math.max(...truckEntries.map(e => e.newMileage), 0);

        const truckUpdate = { currentMileage: maxMileage };

        if (isFirst) {
          truckUpdate.initialMileage = d.newMileage;
          if (d.initialFuel !== undefined) {
            truckUpdate.initialFuel = Number(d.initialFuel || 0);
          }
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', d.truckId), truckUpdate);
      }

      if (!d.id) {
        sendToGoogleSheets({
          type: 'entry',
          id: entryId,
          truckId: d.truckId,
          date: d.date,
          time: d.time,
          totalCost: d.totalCost,
          liters: d.liters,
          newMileage: d.newMileage,
          receiptUrl: receiptUploadUrl || null,
          odometerBeforeUrl: odometerBeforeUrl || null,
          odometerAfterUrl: odometerAfterUrl || null
        });
      }

    } catch (err) {
      console.error(err);
      alert("Erro ao salvar dados.");
    } finally {
      setIsSavingEntry(false);
      setEditingEntry(null);
      setIsEntryModalOpen(false);
    }
  };

  const handleDeleteEntry = async (id, date) => {
    if (!user) return;
    if (!confirm(`Tem certeza que deseja excluir o registro do dia ${new Date(date).toLocaleDateString('pt-BR')}?`)) return;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'entries', id));
      sendToGoogleSheets({ type: 'entry_delete', id });

      // 2. Atualizar parâmetros do Caminhão com base no que restou
      const truckId = entries.find(e => e.id === id)?.truckId;
      if (truckId) {
        const remaining = entries.filter(e => e.truckId === truckId && e.id !== id);

        if (remaining.length === 0) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), {
            currentMileage: 0,
            initialMileage: 0,
            initialFuel: 0
          });
        } else {
          const sorted = [...remaining].sort((a, b) => new Date(a.date) - new Date(b.date));
          const first = sorted[0];
          const last = sorted[sorted.length - 1];

          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), {
            currentMileage: Math.max(...remaining.map(e => e.newMileage)),
            initialMileage: first.newMileage,
            initialFuel: first.initialFuel || 0
          });
        }
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir registro.");
    }
  };

  // --- Importação / Exportação ---

  const downloadTemplate = () => {
    if (!window.XLSX) return alert("Carregando ferramentas...");
    const data = [
      {
        "Placa": "ABC1D23", "Modelo": "Volvo FH 540", "Motorista": "João Silva", "Capacidade Tanque (L)": 500, "Eficiência Esperada (Km/L)": 2.5, "Km Inicial": 100000,
        "Data/Hora": "2024-01-01 08:00", "Valor Abastecimento (R$)": 1200, "Litros Abastecidos": 300, "Nova Km": 100750
      },
      {
        "Placa": "ABC1D23", "Modelo": "Volvo FH 540", "Motorista": "João Silva", "Capacidade Tanque (L)": 500, "Eficiência Esperada (Km/L)": 2.5, "Km Inicial": 100000,
        "Data/Hora": "2024-01-05 10:00", "Valor Abastecimento (R$)": 1500, "Litros Abastecidos": 380, "Nova Km": 101800
      }
    ];
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Controle");
    window.XLSX.writeFile(wb, "Modelo_Importacao_Historico.xlsx");
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const workbook = window.XLSX.read(evt.target.result, { type: 'binary' });
      const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      json.sort((a, b) => new Date(a["Data/Hora"]) - new Date(b["Data/Hora"]));

      const truckMap = {};

      for (const row of json) {
        const plate = String(row.Placa || "");
        if (!plate) continue;

        let truck = trucks.find(t => t.plate === plate) || truckMap[plate];

        if (!truck) {
          truck = await handleAddTruck({
            plate: plate, model: String(row.Modelo || "N/A"), driver: String(row.Motorista || "Importado"),
            capacity: Number(row["Capacidade Tanque (L)"] || 0), expectedKml: Number(row["Eficiência Esperada (Km/L)"] || 0),
            initialMileage: Number(row["Km Inicial"] || 0), currentMileage: Number(row["Km Inicial"] || 0), initialFuel: 0
          });
        }
        truckMap[plate] = truck;

        const newKm = Number(row["Nova Km"] || 0);
        const prevKm = truck.currentMileage;
        const dist = newKm - prevKm;

        if (dist >= 0) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'entries'), {
            truckId: truck.id, date: String(row["Data/Hora"]), totalCost: Number(row["Valor Abastecimento (R$)"] || 0),
            liters: Number(row["Litros Abastecidos"] || 1), costPerLiter: Number(row["Valor Abastecimento (R$)"] || 0) / (Number(row["Litros Abastecidos"] || 1)),
            newMileage: newKm, distanceTraveled: dist, receiptUrl: "imported", odometerUrl: "imported"
          });
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truck.id), { currentMileage: newKm });
          truck.currentMileage = newKm;
        }
      }
      setIsProcessing(false);
      alert("Histórico importado com sucesso!");
      setView('dashboard');
    };
    reader.readAsBinaryString(file);
  };

  const exportToExcel = () => {
    if (!window.XLSX) return;
    const tData = trucks.map(t => ({ Placa: t.plate, Modelo: t.model, Km: t.currentMileage, Motorista: t.driver }));
    const eData = entries.map(e => ({ Data: e.date, Placa: trucks.find(t => t.id === e.truckId)?.plate, Valor: e.totalCost, Litros: e.liters, Km: e.newMileage }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(tData), "Frota");
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(eData), "Historico");
    window.XLSX.writeFile(wb, "FrotaLog_Export.xlsx");
  };

  const exportToPDF = () => {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório Geral de Frota", 14, 20);
    doc.autoTable({ startY: 30, head: [['Placa', 'Modelo', 'Motorista', 'Km Atual']], body: trucks.map(t => [t.plate, t.model, t.driver, t.currentMileage]) });
    doc.save("Relatorio_Frota.pdf");
  };

  // --- Stats & UI ---

  const globalStats = useMemo(() => {
    const cost = entries.reduce((a, c) => a + Number(c.totalCost || 0), 0);
    const lit = entries.reduce((a, c) => a + Number(c.liters || 0), 0);
    const dist = entries.reduce((a, c) => a + Number(c.distanceTraveled || 0), 0);
    return {
      cost: cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      liters: lit.toFixed(1) + " L",
      eff: trucks.length > 0 ? (trucks.reduce((a, t) => a + (t.expectedKml || 0), 0) / trucks.length).toFixed(2) + " Km/L" : "0.00 Km/L",
      count: trucks.length
    };
  }, [entries, trucks]);

  const chartData = useMemo(() => {
    const p = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); p.push({ k: d.toISOString().split('T')[0], l: d.toLocaleDateString('pt-BR', { weekday: 'short' }), d: 0, li: 0 }); }
    entries.forEach(e => { p.forEach(item => { if (e.date.startsWith(item.k)) { item.d += e.distanceTraveled; item.li += e.liters; } }); });
    return p.map(item => ({ label: item.l, value: item.li > 0 ? item.d / item.li : 0 }));
  }, [entries]);

  const renderDashboard = () => {
    // --- NOVOS CÁLCULOS DO DASHBOARD FILTRADO ---
    const filteredEntries = entries.filter(e => {
      const truckExists = trucks.some(t => t.id === e.truckId);
      return truckExists && e.date >= dashboardStartDate && e.date <= dashboardEndDate;
    });

    const totalPeriodCost = filteredEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);

    // Gasto por motorista (Pizza)
    const driverCosts = {};
    filteredEntries.forEach(entry => {
      const truck = trucks.find(t => t.id === entry.truckId);
      const driverName = truck ? truck.driver || 'Não Identificado' : 'Não Identificado';
      driverCosts[driverName] = (driverCosts[driverName] || 0) + (entry.totalCost || 0);
    });
    const pieData = Object.entries(driverCosts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // Média de Custo do Km Rodado por Tipo de Veículo (Barras)
    const typeKmCosts = {};
    trucks.forEach(truck => {
      const allTruckEntries = entries
        .filter(e => e.truckId === truck.id)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const absoluteLatest = allTruckEntries[allTruckEntries.length - 1];

      const periodEntries = allTruckEntries.filter(e => e.date >= dashboardStartDate && e.date <= dashboardEndDate);

      if (periodEntries.length >= 2) {
        const first = periodEntries[0];
        const last = periodEntries[periodEntries.length - 1];
        const dist = last.newMileage - first.newMileage;

        if (dist > 0) {
          let sumCost = periodEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);

          // Excluir o último registro se for o absoluto mais recente do sistema (conforme solicitado)
          if (last.id === absoluteLatest.id) {
            sumCost -= (last.totalCost || 0);
          }

          const costPerKm = sumCost / dist;
          const type = truck.vehicleType || 'Outros';
          if (!typeKmCosts[type]) typeKmCosts[type] = [];
          typeKmCosts[type].push(costPerKm);
        }
      }
    });

    const barData = Object.entries(typeKmCosts).map(([label, values]) => ({
      label,
      value: values.reduce((s, v) => s + v, 0) / values.length
    })).sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900">Painel Geral da Frota</h1>
            <p className="text-sm text-slate-500">Gestão operacional de combustível e performance</p>
          </div>

          <div className="flex-1 flex justify-center w-full md:w-auto">
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">De</label>
                <input
                  type="date"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500"
                  value={dashboardStartDate}
                  onChange={(e) => setDashboardStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Até</label>
                <input
                  type="date"
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500"
                  value={dashboardEndDate}
                  onChange={(e) => setDashboardEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            <Button
              variant="primary"
              className="w-full md:w-48 justify-start text-xs font-bold gap-3 py-2.5 shadow-sm"
              onClick={() => { setEditingTruck(null); setIsTruckModalOpen(true); }}
            >
              <Truck size={18} /> Novo Caminhão
            </Button>
            <Button
              variant="success"
              className="w-full md:w-48 justify-start text-xs font-bold gap-3 py-2.5 shadow-sm"
              onClick={() => { setSelectedTruck(null); setEditingEntry(null); setIsEntryModalOpen(true); }}
            >
              <Fuel size={18} /> Novo Registro
            </Button>
          </div>
        </div>

        {/* Mini Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Gasto Total no Período"
            value={formatCurrency(totalPeriodCost)}
            icon={DollarSign}
            color="rose"
            subtext={`${filteredEntries.length} registros no período`}
          />
          <DashboardPieChart
            title="Gasto (R$) por Motorista"
            data={pieData}
          />
          <DashboardBarChart
            title="Média Custo/Km por Tipo"
            data={barData}
            unit="R$"
          />
        </div>

        <div className="grid gap-6">
          {trucks.map(truck => {
            // Todos os registros para exibição de última data
            const allTruckEntries = entries
              .filter(e => e.truckId === truck.id)
              .sort((a, b) => new Date(b.date) - new Date(a.date) || b.newMileage - a.newMileage);

            // Registros ativos (após sectionStartDate) para cálculos
            const activeEntries = allTruckEntries.filter(e => {
              let latestSectionDate = null;
              if (truck.sections && truck.sections.length > 0) {
                // Assumindo que sections está ordenado, mas garantindo:
                const sortedSections = [...truck.sections].sort((a, b) => new Date(b.date) - new Date(a.date));
                latestSectionDate = sortedSections[0].date;
              } else {
                latestSectionDate = truck.sectionStartDate;
              }

              if (!latestSectionDate) return true;

              const [sDate, sTime] = latestSectionDate.split('T');
              const entryDateTime = `${e.date}T${e.time || '00:00'}`;
              const sectionDateTime = `${sDate}T${sTime || '00:00'}`;
              return entryDateTime >= sectionDateTime;
            });

            let suggestionDisplay = null;
            let costDisplay = null;
            let lastDateDisplay = "Sem registros";

            if (allTruckEntries.length > 0) {
              const lastEntry = allTruckEntries[0];
              lastDateDisplay = formatDateBR(lastEntry.date);

              // Cálculos apenas com registros ativos (após sectionStartDate)
              let currentTank = truck.initialFuel || 0;
              let previousMile = truck.initialMileage || 0;
              let calculatedLastNewTank = 0;

              // Recriando histórico cronológico para chegar ao valor atual
              const chronologicalEntries = [...activeEntries].reverse(); // Oldest first

              // Se temos seção ativa, o primeiro registro da seção é tratado como inicial
              if (chronologicalEntries.length > 0 && truck.sectionStartDate) {
                const firstActiveEntry = chronologicalEntries[0];
                currentTank = firstActiveEntry.initialFuel || 0;
                previousMile = firstActiveEntry.newMileage - (firstActiveEntry.distanceTraveled || 0);
              }

              chronologicalEntries.forEach(entry => {
                const dist = entry.newMileage - previousMile;
                const consumed = dist / (truck.expectedKml || 1);
                const remaining = currentTank - consumed;
                const newTank = Math.min(truck.capacity || 0, remaining + entry.liters);

                currentTank = newTank;
                previousMile = entry.newMileage;
                calculatedLastNewTank = newTank;
              });

              if (truck.expectedIntervalKm && truck.tankLevelGoal) {
                const estimatedConsumption = truck.expectedIntervalKm / (truck.expectedKmlList?.[0] || truck.expectedKml || 1);
                const estimatedRemaining = calculatedLastNewTank - estimatedConsumption;
                const suggestion = Math.max(0, truck.tankLevelGoal - estimatedRemaining);

                suggestionDisplay = `${suggestion.toFixed(2)} L`;

                // Calcular preço do combustível a partir do último registro
                const lastEntry = allTruckEntries[0];
                if (lastEntry && lastEntry.liters > 0) {
                  const fuelPrice = lastEntry.totalCost / lastEntry.liters;
                  const cost = suggestion * fuelPrice;
                  costDisplay = cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
              }
            }

            // --- NOVOS CÁLCULOS PARA O PAINEL ---
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Registros do mês atual
            const monthEntries = allTruckEntries.filter(e => {
              const d = new Date(e.date);
              return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });

            const mtdCost = monthEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);

            // Quilometragem percorrida no mês
            let mtdDistance = 0;
            if (monthEntries.length > 0) {
              const maxKm = Math.max(...monthEntries.map(e => e.newMileage));
              const minDateEntry = [...monthEntries].sort((a, b) => new Date(a.date) - new Date(b.date))[0];

              // Encontrar o registro IMEDIATAMENTE ANTERIOR ao primeiro do mês para saber de onde partiu
              const priorEntry = allTruckEntries
                .filter(e => new Date(e.date) < new Date(minDateEntry.date))
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

              const startKm = priorEntry ? priorEntry.newMileage : (truck.initialMileage || 0);
              mtdDistance = Math.max(0, maxKm - startKm);
            }

            // Custo por Km Realizado (do mês)
            const realizedCostPerKm = mtdDistance > 0 ? mtdCost / mtdDistance : 0;

            // Custo por Km Previsto (baseado no último preço carregado ou fixo)
            const lastEntryForPrice = allTruckEntries[0];
            const fuelPrice = lastEntryForPrice && lastEntryForPrice.liters > 0 ? lastEntryForPrice.totalCost / lastEntryForPrice.liters : 0;
            const expectedKml = truck.expectedKmlList?.[0] || truck.expectedKml || 1;
            const predictedCostPerKm = expectedKml > 0 ? fuelPrice / expectedKml : 0;

            const isPerformanceGood = predictedCostPerKm > 0 && realizedCostPerKm <= predictedCostPerKm;
            const performanceColor = isPerformanceGood ? 'text-emerald-600' : 'text-rose-600';


            return (
              <Card key={truck.id} className="p-6 transition-all hover:shadow-md border-l-4 border-l-indigo-500 cursor-pointer" onClick={() => { setSelectedTruck(truck); setView('truck-detail'); }}>
                <div className="grid md:grid-cols-5 gap-6 items-center">

                  {/* Identificação */}
                  <div className="md:col-span-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><Truck size={24} /></div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                          {truck.plate}
                          {truck.vehicleType && <span className="text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{truck.vehicleType}</span>}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{truck.model}</p>
                      </div>
                    </div>
                  </div>

                  {/* Motorista & Pix */}
                  <div className="md:col-span-1 border-l border-slate-100 pl-0 md:pl-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Motorista Responsável</p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-700">{truck.driver}</span>
                    </div>
                    {truck.pixKey ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 w-fit group">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Pix</span>
                        <span className="font-mono select-all">{truck.pixKey}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(truck.pixKey);
                            const btn = e.currentTarget;
                            btn.classList.add('copied');
                            setTimeout(() => btn.classList.remove('copied'), 1500);
                          }}
                          className="p-1 rounded hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-all [&.copied]:bg-emerald-100 [&.copied]:text-emerald-600"
                          title="Copiar Pix"
                        >
                          <Copy size={12} className="[.copied_&]:hidden" />
                          <Check size={12} className="hidden [.copied_&]:block" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Pix não cadastrado</span>
                    )}
                  </div>

                  {/* Performance */}
                  <div className="md:col-span-1 border-l border-slate-100 pl-0 md:pl-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Performance</p>
                    <div className="flex flex-col">
                      <span className={`text-lg font-black ${performanceColor}`}>
                        {realizedCostPerKm > 0 ? `R$ ${realizedCostPerKm.toFixed(2)}` : '---'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Km Realizado</span>
                    </div>
                  </div>

                  {/* Estatísticas Mensais */}
                  <div className="md:col-span-1 border-l border-slate-100 pl-0 md:pl-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Este Mês</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Gasto</span>
                        <span className="text-xs font-bold text-slate-800">R$ {mtdCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Km Rodado</span>
                        <span className="text-xs font-bold text-slate-800">{mtdDistance.toLocaleString()} km</span>
                      </div>
                    </div>
                  </div>

                  {/* Status / Data */}
                  <div className="md:col-span-1 border-l border-slate-100 pl-0 md:pl-6 flex flex-col justify-center items-end text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Último Abastecimento</p>
                    <p className="text-lg font-bold text-slate-700">{lastDateDisplay}</p>
                    <div className="mt-2">
                      {/* Espaço reservado para status futuro se necessário */}
                      <button onClick={() => { setSelectedTruck(truck); setView('truck-detail'); }} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                        Ver Detalhes <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                </div>
              </Card>
            );
          })}

          {trucks.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
              <Truck className="mx-auto text-slate-200 mb-4" size={64} />
              <h3 className="text-xl font-bold text-slate-400">Nenhum veículo cadastrado</h3>
              <p className="text-slate-400 text-sm mt-2">Cadastre seu primeiro caminhão para começar.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTrucksList = () => (
    <div className="space-y-8 animate-in slide-in-from-right">
      <style>{globalStyles}</style>
      <div className="flex justify-between items-center"><div><h2 className="text-3xl font-bold">Caminhões</h2><p className="text-slate-500">Frota cadastrada no sistema.</p></div><Button onClick={() => { setEditingTruck(null); setIsTruckModalOpen(true); }}><Plus size={20} /> Adicionar Novo</Button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{trucks.map(t => (<Card key={t.id} noPadding className="cursor-pointer" onClick={() => { setSelectedTruck(t); setView('truck-detail'); }}><div className="p-6">
        <div className="flex justify-between mb-4">
          <div className="bg-slate-100 border px-3 py-1 font-mono font-bold text-lg rounded shadow-sm flex items-center gap-2">{t.plate} {t.vehicleType && <span className="text-xs font-sans font-normal text-slate-500 bg-white border px-1.5 py-0.5 rounded">{t.vehicleType}</span>}</div>
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); setEditingTruck(t); setIsTruckModalOpen(true); }} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-amber-600" title="Editar"><Pencil size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteTruck(t.id, t.plate); }} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-rose-600" title="Excluir"><Trash2 size={18} /></button>
          </div>
        </div>
        <h3 className="font-bold mb-1">{t.model}</h3><p className="text-xs text-slate-400 mb-6 font-medium">{t.driver}</p><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-slate-50 p-2 rounded text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">KM Atual</p><p className="text-sm font-bold">{t.currentMileage}</p></div><div className="bg-emerald-50 p-2 rounded text-center"><p className="text-[10px] text-emerald-600 font-bold uppercase">Meta</p><p className="text-sm font-bold">{t.expectedKmlList?.length > 0 ? t.expectedKmlList[0] : t.expectedKml}</p></div></div><Button variant="secondary" className="w-full justify-between" onClick={(e) => { e.stopPropagation(); setSelectedTruck(t); setView('truck-detail'); }}><span>Mostrar histórico</span><ChevronLeft className="rotate-180" size={16} /></Button></div></Card>))}</div>
    </div>
  );

  const renderTruckDetail = () => {
    if (!selectedTruck) return null;

    const kmlList = selectedTruck.expectedKmlList?.length > 0 ? selectedTruck.expectedKmlList : [selectedTruck.expectedKml || 1];
    const currentExpectedKml = kmlList[activeKmlIndex] || kmlList[0];

    // Todos os registros (para exibição completa)
    const allHistory = entries
      .filter(e => e.truckId === selectedTruck?.id)
      .sort((a, b) => {
        // Combinar data e hora para ordenação cronológica correta
        const dateTimeA = new Date(`${a.date.split('T')[0]}T${a.time || '00:00'}`);
        const dateTimeB = new Date(`${b.date.split('T')[0]}T${b.time || '00:00'}`);
        return dateTimeA - dateTimeB || a.newMileage - b.newMileage;
      });

    // Histórico completo ordenado cronologicamente (Antigo -> Novo) para cálculos sequenciais
    // AVISO: NÃO INVERTER AQUI. O cálculo precisa ser cronológico. Inverter apenas no final para exibição.
    const rawHistory = [...allHistory];

    // Calcular histórico de tanque sequencialmente (respeitando seções)
    let previousNewTank = 0;
    let previousMileage = selectedTruck.initialMileage || 0;
    let lastSectionId = null;

    const calculatedHistoryRaw = rawHistory.map((entry, index) => {
      // Identificar a seção deste registro
      let currentSection = null;
      // Encontrar a seção mais recente que engloba este registro
      let sortedSections = [];
      if (selectedTruck.sections && Array.isArray(selectedTruck.sections)) {
        sortedSections = [...selectedTruck.sections].sort((a, b) => new Date(a.date) - new Date(b.date));
      } else if (selectedTruck.sectionStartDate) {
        sortedSections = [{ id: 'legacy', date: selectedTruck.sectionStartDate }];
      }

      for (let i = sortedSections.length - 1; i >= 0; i--) {
        const sec = sortedSections[i];
        const [sDate, sTime] = sec.date.split('T');
        const entryDateTime = `${entry.date}T${entry.time || '00:00'}`;
        const sectionDateTime = `${sDate}T${sTime || '00:00'}`;

        if (entryDateTime >= sectionDateTime) {
          currentSection = sec;
          break; // Encontrou a mais recente aplicável
        }
      }

      const currentSectionId = currentSection ? currentSection.id : null;
      // Identificar se mudou de seção (início de um novo bloco lógico)
      const isStartOfSection = currentSectionId && currentSectionId !== lastSectionId;
      // Vamos adicionar lastSectionId fora.

      let isSectionStart = false;
      if (currentSectionId !== lastSectionId) {
        isSectionStart = true;
        if (currentSectionId) {
          previousNewTank = 0;
          // previousMileage não deve zerar, continua do valor anterior do hodômetro para calcular distância percorrida real
          // A MENOS que seja o primeiro registro ABSOLUTO da seção e queiramos ignorar o GAP anterior.
          // Se dist for calculado normalmente: entry.newMileage - previousMileage.
          // Se previousMileage veio do registro anterior (fora da seção), a distância é válida.
          // Só o consumo deve zerar.
        }
      }

      let dist = 0;
      if (index === 0) {
        dist = Math.max(0, entry.newMileage - previousMileage);
      } else {
        // Se é início de seção, a distância é válida (rodou até chegar no posto para iniciar a seção).
        dist = Math.max(0, entry.newMileage - previousMileage);
      }

      const consumido = dist > 0 ? dist / currentExpectedKml : 0;

      let remaining = 0;
      // Se é o PRIMEIRO registro da seção, usamos o initialFuel dele se houver, ou assumimos tanque cheio?
      // Ou assumimos 0?
      if (isSectionStart && entry.initialFuel !== undefined) {
        remaining = Number(entry.initialFuel);
      } else if (isSectionStart) {
        // Inicio de seção sem initialFuel definido -> Reseta o tanque lógico para 0 (novo ciclo)
        remaining = 0;
      } else if (index === 0 && entry.initialFuel !== undefined) {
        remaining = Number(entry.initialFuel);
      } else {
        remaining = previousNewTank - consumido;
      }

      const newTank = remaining + entry.liters;

      let prospectiveCostPerKm = 0;
      let realizedCostPerKm = 0;
      let costPerKmDisplay = 0;
      let isProspective = false;

      // Cálculo do Custo/Km
      if (isSectionStart || index === 0) {
        // Lógica Prospectiva (Primeiro Registro da Seção/Histórico)
        // Fórmula: (Preço/Litro * NovoTanque) / Distância até o próximo abastecimento
        // "Quanto custaria rodar o próximo trecho só com este tanque cheio?"

        const nextEntry = rawHistory[index + 1];
        if (nextEntry) {
          // Verificar se o próximo registro pertence à MESMA seção (ou se não houve quebra)
          // Se houver quebra logo depois, o cálculo pode ser inválido, mas assumimos continuidade.
          const distToNext = nextEntry.newMileage - entry.newMileage;

          if (distToNext > 0 && entry.liters > 0) {
            const pricePerLiter = entry.totalCost / entry.liters;
            const tankValue = newTank * pricePerLiter;
            prospectiveCostPerKm = tankValue / distToNext;
            costPerKmDisplay = prospectiveCostPerKm;
            isProspective = true;
          }
        }
      } else {
        // Lógica Realizada (Registros Normais)
        // Fórmula: Custo do Abastecimento Atual / Distância Percorrida desde o anterior
        // "Quanto custou rodar o trecho anterior?"
        if (dist > 0) {
          realizedCostPerKm = entry.totalCost / dist;
          costPerKmDisplay = realizedCostPerKm;
        }
      }

      previousNewTank = newTank;
      previousMileage = entry.newMileage;
      lastSectionId = currentSectionId;

      return {
        ...entry,
        calculatedDistance: dist,
        calculatedRemaining: remaining,
        calculatedNewTank: newTank,
        isInActiveSection: true, // Legacy support (all visible)
        currentSection: currentSection,
        isSectionStart: isSectionStart,
        costPerKm: costPerKmDisplay,
        isProspective: isProspective
      };
    });

    const calculatedHistory = [...calculatedHistoryRaw].reverse();

    const h = calculatedHistory; // Alias para manter compatibilidade com contadores se houver
    return (<div className="space-y-8 animate-in slide-in-from-right">
      <style>{globalStyles}</style>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('trucks')} className="p-2 border rounded-xl hover:bg-white"><ChevronLeft /></button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {selectedTruck.plate}
              {selectedTruck.vehicleType && <span className="text-sm font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">{selectedTruck.vehicleType}</span>}
              <span className="text-sm font-normal text-slate-400">| {selectedTruck.model}</span>
              {selectedTruck.sectionStartDate && (
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
                  📅 Seção desde {formatDateBR(selectedTruck.sectionStartDate.split('T')[0])} às {selectedTruck.sectionStartDate.split('T')[1]}
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-500">Motorista: <span className="font-medium text-slate-700">{selectedTruck.driver || 'Não informado'}</span> • Histórico de abastecimentos e performance.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsSectionModalOpen(true)}>
            <Calendar size={18} /> Seções
          </Button>
          <Button variant="success" onClick={() => { setEditingEntry(null); setIsEntryModalOpen(true); }}>
            <Fuel size={18} /> Novo Registro
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-4">
        {/* Calcular valores necessários para os cards */}
        {(() => {
          // Custo por Km Previsto
          const lastEntry = calculatedHistory[0];
          const fuelPrice = lastEntry && lastEntry.liters > 0 ? lastEntry.totalCost / lastEntry.liters : 0;
          const costPerKmPrevisto = currentExpectedKml > 0 ? fuelPrice / currentExpectedKml : 0;

          // Custo por Km Realizado
          let costPerKmRealizado = 0;
          let hasRealizado = false;
          if (calculatedHistory.length >= 2) {
            const oldestIndex = Math.min(7, calculatedHistory.length - 1);
            const kmMostRecent = calculatedHistory[0].newMileage || 0;
            const kmOldest = calculatedHistory[oldestIndex].newMileage || 0;
            const totalDistance = kmMostRecent - kmOldest;
            let totalCost = 0;
            for (let i = 1; i <= oldestIndex; i++) {
              totalCost += calculatedHistory[i].totalCost || 0;
            }
            if (totalDistance > 0) {
              costPerKmRealizado = totalCost / totalDistance;
              hasRealizado = true;
            }
          }

          // Determinar cor do fundo do Custo do Km Realizado
          const realizadoBgClass = !hasRealizado ? 'bg-white' :
            (costPerKmRealizado > costPerKmPrevisto ? 'bg-rose-50' : 'bg-emerald-50');

          return (
            <>
              {/* Eficiência Prevista */}
              <InfoCard className="text-center bg-white" tooltip="Quantos km o veículo deve percorrer por litro de combustível, conforme metas cadastradas. Use as setas para simular.">
                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Eficiência Prevista</p>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setActiveKmlIndex(prev => Math.max(0, prev - 1))} disabled={activeKmlIndex === 0} className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"><ChevronLeft size={16} /></button>
                  <p className="text-xl font-bold text-slate-800 w-24">{currentExpectedKml.toFixed(2)} Km/L</p>
                  <button onClick={() => setActiveKmlIndex(prev => Math.min((kmlList.length - 1), prev + 1))} disabled={activeKmlIndex === kmlList.length - 1} className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"><ChevronRight size={16} /></button>
                </div>
                {kmlList.length > 1 && <p className="text-[9px] text-slate-400 font-medium mt-1">META {activeKmlIndex + 1} DE {kmlList.length}</p>}
              </InfoCard>

              {/* Custo do Km Previsto */}
              <InfoCard className="text-center bg-white" tooltip="Custo estimado por km baseado no preço atual do combustível e na eficiência prevista. Quanto menor, melhor.">
                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Custo do Km Previsto</p>
                <p className="text-xl font-bold text-slate-800">{fuelPrice > 0 ? `R$ ${costPerKmPrevisto.toFixed(2)}` : '---'}</p>
              </InfoCard>

              {/* Custo do Km Realizado */}
              <InfoCard className={`text-center ${realizadoBgClass}`} tooltip="Custo real por km dos últimos 7 abastecimentos. Verde = igual ou melhor que o previsto. Vermelho = pior que o previsto.">
                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Custo do Km Realizado</p>
                <p className="text-xl font-bold text-slate-800">{hasRealizado ? `R$ ${costPerKmRealizado.toFixed(2)}` : '---'}</p>
              </InfoCard>

              {/* Capacidade do Tanque */}
              <InfoCard className="text-center bg-white" tooltip="Capacidade máxima do tanque de combustível em litros.">
                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Capacidade do Tanque</p>
                <p className="text-xl font-bold text-slate-800">{selectedTruck.capacity} L</p>
              </InfoCard>
            </>
          );
        })()}

        {/* Card de Sugestão de Abastecimento (L) */}
        {selectedTruck.expectedIntervalKm && selectedTruck.tankLevelGoal && calculatedHistory.length > 0 ? (
          (() => {
            const lastEntry = calculatedHistory[0];
            const lastNewTank = lastEntry.calculatedNewTank || 0;
            const estimatedConsumption = selectedTruck.expectedIntervalKm / currentExpectedKml;
            const estimatedRemaining = lastNewTank - estimatedConsumption;
            const suggestion = Math.max(0, selectedTruck.tankLevelGoal - estimatedRemaining);

            return (
              <InfoCard className="text-center bg-indigo-600" tooltip="Quantidade de litros sugerida para o próximo abastecimento, baseada na meta de tanque e consumo estimado.">
                <p className="text-[10px] font-bold text-indigo-200 uppercase mb-1">Sugestão Abastecimento</p>
                <h3 className="text-xl font-bold text-white">{suggestion.toFixed(2)} L</h3>
                <p className="text-[9px] text-indigo-200 mt-1 font-medium">
                  Meta: {selectedTruck.tankLevelGoal}L | Est. Rest: {estimatedRemaining.toFixed(2)}L
                </p>
              </InfoCard>
            );
          })()
        ) : (
          <InfoCard className="text-center bg-white opacity-70" tooltip="Configure Meta de Tanque e Km Esperado para ver a sugestão.">
            <p className="text-[10px] font-bold text-indigo-600 uppercase">Sugestão Indisponível</p>
            <p className="text-[9px] text-slate-400 mt-1">Configure Meta e Km Esperado</p>
          </InfoCard>
        )}

        {/* Card de Próximo Abastecimento (R$) */}
        {selectedTruck.expectedIntervalKm && selectedTruck.tankLevelGoal && calculatedHistory.length > 0 ? (
          (() => {
            const lastEntry = calculatedHistory[0];
            const lastNewTank = lastEntry.calculatedNewTank || 0;
            const estimatedConsumption = selectedTruck.expectedIntervalKm / selectedTruck.expectedKml;
            const estimatedRemaining = lastNewTank - estimatedConsumption;
            const suggestion = Math.max(0, selectedTruck.tankLevelGoal - estimatedRemaining);

            // Calcular preço do combustível a partir do último registro
            const fuelPrice = lastEntry.liters > 0 ? lastEntry.totalCost / lastEntry.liters : 0;
            const estimatedCost = suggestion * fuelPrice;

            return fuelPrice > 0 ? (
              <InfoCard className="text-center bg-indigo-600" tooltip="Valor estimado em reais para o próximo abastecimento, baseado na sugestão de litros e preço atual.">
                <p className="text-[10px] font-bold text-indigo-200 uppercase mb-1">Próximo Abastecimento (R$)</p>
                <h3 className="text-xl font-bold text-white">R$ {estimatedCost.toFixed(2)}</h3>
                <p className="text-[9px] text-indigo-200 mt-1 font-medium">
                  {suggestion.toFixed(2)} L x R$ {fuelPrice.toFixed(2)}
                </p>
              </InfoCard>
            ) : (
              <InfoCard className="text-center bg-white opacity-70" tooltip="Valor estimado em reais para o próximo abastecimento. Precisa de registros anteriores.">
                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Próximo Abastecimento</p>
                <p className="text-sm font-bold text-slate-400">---</p>
              </InfoCard>
            );
          })()
        ) : (
          <InfoCard className="text-center bg-white opacity-70" tooltip="Configure Meta de Tanque e Km Esperado para ver o valor estimado.">
            <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Próximo Abastecimento</p>
            <p className="text-sm font-bold text-slate-400">---</p>
          </InfoCard>
        )}
      </div>
      <Card noPadding className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b"><tr>
        <th className="px-6 py-2">Data</th>
        <th className="px-6 py-2 text-center">Horário</th>
        <th className="px-6 py-2 text-center">Custo</th>
        <th className="px-6 py-2 text-center">Combustível Inserido</th>
        <th className="px-6 py-2 text-center">Km Rodados</th>
        <th className="px-6 py-2 text-center">Custo do Km Rodado</th>
        <th className="px-6 py-2 text-emerald-600 text-center">Comb. Remanescente</th>
        <th className="px-6 py-2 text-blue-600 text-center">Novo Tanque</th>
        <th className="px-6 py-2 text-center">Ações</th>
      </tr></thead><tbody>{calculatedHistory.map((e, idx) => {
        return (
          <React.Fragment key={e.id}>
            <tr className={`hover:bg-slate-50 ${!e.isInActiveSection ? 'opacity-60 bg-slate-50/30' : ''}`}>
              <td className="px-6 py-2 font-medium flex items-center gap-2">
                {/* Badges: M = Motorista, E = Editado pelo Gestor, G = Gestor */}
                {e.registeredBy === 'driver' && !e.editedByController && (
                  <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold" title="Registrado pelo Motorista">M</span>
                )}
                {e.registeredBy === 'driver' && e.editedByController && (
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold" title="Registrado pelo Motorista e Editado pelo Gestor">E</span>
                )}
                {e.registeredBy !== 'driver' && (
                  <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold" title="Registrado pelo Gestor">G</span>
                )}
                {formatDateBR(e.date)}
              </td>
              <td className="px-6 py-2 text-slate-500 text-center">{e.time || '-'}</td>
              <td className="px-6 py-2 font-bold text-slate-800 text-center">R$ {e.totalCost.toFixed(2)}</td>
              <td className="px-6 py-2 font-bold text-center">{e.liters.toFixed(2)} L</td>
              <td className="px-6 py-2 text-center font-medium text-slate-600"></td>
              <td className="px-6 py-2 text-center font-bold text-slate-700"></td>
              <td className="px-6 py-2 text-emerald-600 font-medium text-center">
                {e.calculatedRemaining !== null ? (
                  <span className="flex items-center justify-center gap-1">
                    {(e.calculatedRemaining < 0 || e.calculatedRemaining > selectedTruck.capacity) && <AlertTriangle size={14} className="text-red-500" />}
                    {e.calculatedRemaining.toFixed(2)} L
                  </span>
                ) : "-"}
              </td>
              <td className="px-6 py-2 text-blue-600 font-bold text-center">
                {e.calculatedNewTank !== null ? (
                  <span className="flex items-center justify-center gap-1">
                    {(e.calculatedNewTank < 0 || e.calculatedNewTank > selectedTruck.capacity) && <AlertTriangle size={14} className="text-red-500" />}
                    {e.calculatedNewTank.toFixed(2)} L
                  </span>
                ) : "-"}
              </td>
              <td className="px-6 py-2 flex justify-center">
                <button
                  onClick={() => { setDetailsEntry(e); setIsDetailsModalOpen(true); }}
                  className="p-2 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-200 transition-all text-indigo-600"
                  title="Ver Detalhes"
                >
                  <Info size={16} />
                </button>
              </td>
            </tr>
            {e.isSectionStart && e.currentSection && (
              <tr className="bg-amber-50">
                <td colSpan="9" className="px-6 py-3">
                  <div className="flex items-center justify-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-widest">
                    <div className="h-px bg-amber-200 flex-1"></div>
                    <Calendar size={14} />
                    Nova Seção Iniciada Aqui ({formatDateBR(e.currentSection.date.split('T')[0])} {e.currentSection.date.split('T')[1]})
                    <div className="h-px bg-amber-200 flex-1"></div>
                  </div>
                </td>
              </tr>
            )}
            {idx < calculatedHistory.length - 1 && (
              <tr className="bg-slate-50/20">
                <td className="px-6 border-b border-slate-100"></td>
                <td className="px-6 border-b border-slate-100"></td>
                <td className="px-6 border-b border-slate-100"></td>
                <td className="px-6 border-b border-slate-100"></td>
                <td className="px-6 border-b border-slate-100 text-center">
                  {e.calculatedDistance > 0 ? (
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">+{e.calculatedDistance} km</span>
                  ) : (
                    <span className="text-slate-300 text-[10px]">---</span>
                  )}
                </td>
                <td className="px-6 border-b border-slate-100 text-center">
                  {(() => {
                    // Custo do Km Rodado = custo do abastecimento anterior / km percorridos
                    // calculatedHistory[idx+1] é o registro anterior (mais antigo)
                    const previousEntry = calculatedHistory[idx + 1];
                    if (previousEntry && e.calculatedDistance > 0) {
                      const costPerKm = previousEntry.totalCost / e.calculatedDistance;
                      // Comparar com custo por km previsto
                      const lastEntry = calculatedHistory[0];
                      const fuelPrice = lastEntry && lastEntry.liters > 0 ? lastEntry.totalCost / lastEntry.liters : 0;
                      const costPerKmPrevisto = currentExpectedKml > 0 ? fuelPrice / currentExpectedKml : 0;

                      // Verde se <= previsto, vermelho se > previsto
                      const isGood = costPerKmPrevisto > 0 && costPerKm <= costPerKmPrevisto;
                      const bgClass = isGood ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200';

                      return <span className={`${bgClass} px-2 py-0.5 rounded text-[10px] font-bold border`}>R$ {costPerKm.toFixed(2)}</span>;
                    }
                    return <span className="text-slate-300 text-[10px]">---</span>;
                  })()}
                </td>
                <td className="px-6 border-b border-slate-100"></td>
                <td className="px-6 border-b border-slate-100"></td>
                <td className="px-6 border-b border-slate-100"></td>
              </tr>
            )}
          </React.Fragment>
        );
      })}</tbody></table></div></Card>
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url}
        title={previewImage?.title}
      />
      <EntryDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => { setIsDetailsModalOpen(false); setDetailsEntry(null); }}
        entry={detailsEntry}
        truck={selectedTruck}
        entries={entries}
        onSave={(payload, files) => {
          handleSaveEntry(payload, files);
          setIsDetailsModalOpen(false);
          setDetailsEntry(null);
        }}
        onDelete={handleDeleteEntry}
        isSaving={isSavingEntry}
      />
    </div>);
  };

  // Página de Manutenção
  const renderMaintenance = () => {
    // Stats por caminhão
    const getTruckMaintenanceStats = (truckId) => {
      const truckRecords = maintenanceRecords.filter(r => r.truckId === truckId);
      const totalCost = truckRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
      return { totalCost, recordCount: truckRecords.length };
    };

    // Km atual de cada caminhão
    const getTruckCurrentMileage = (truckId) => {
      const truckEntries = entries.filter(e => e.truckId === truckId);
      return truckEntries.length > 0 ? Math.max(...truckEntries.map(e => e.newMileage || 0)) : 0;
    };

    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800">Manutenção</h1>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setIsServiceModalOpen(true)}>
              <Settings size={16} /> Cadastrar Serviço
            </Button>
            <Button variant="primary" onClick={() => { setPrefilledMaintenance(null); setIsMaintenanceRecordModalOpen(true); }}>
              <Plus size={16} /> Registrar Manutenção
            </Button>
          </div>
        </div>

        {/* Seção de Alertas */}
        <Card noPadding>
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="text-amber-600" size={20} />
              Manutenções Pendentes
              {maintenanceAlerts.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {maintenanceAlerts.length}
                </span>
              )}
            </h2>
          </div>

          {maintenanceAlerts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-medium">Nenhuma manutenção pendente!</p>
              <p className="text-sm">Todos os veículos estão em dia.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {maintenanceAlerts.map(alert => (
                <div key={alert.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-800">
                      {alert.truck.plate} <span className="text-slate-400 font-normal">({alert.truck.driver})</span> — {alert.service.name}
                    </p>
                    <p className="text-xs text-slate-500">{alert.dueInfo}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPrefilledMaintenance({ truckId: alert.truckId, serviceId: alert.serviceId });
                        setIsMaintenanceRecordModalOpen(true);
                      }}
                      className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                      title="Marcar como Realizado"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Seção de Serviços Cadastrados */}
        <Card noPadding>
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings className="text-indigo-600" size={20} />
              Serviços Cadastrados
            </h2>
          </div>

          {maintenanceServices.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="font-medium">Nenhum serviço cadastrado</p>
              <p className="text-sm">Cadastre serviços para ativar os alertas automáticos.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {maintenanceServices.map(service => (
                <div key={service.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-800">{service.name}</p>
                    <p className="text-xs text-slate-500">
                      A cada {service.periodicityValue.toLocaleString()} {service.periodicityType === 'km' ? 'km' : 'dias'} • {service.applicableTrucks.length} veículo(s)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingService(service); setIsServiceModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteService(service.id, service.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Frota - Cards dos Caminhões */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="text-indigo-600" size={20} />
            Frota
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trucks.map(truck => {
              const stats = getTruckMaintenanceStats(truck.id);
              const currentKm = getTruckCurrentMileage(truck.id);
              const alertCount = maintenanceAlerts.filter(a => a.truckId === truck.id).length;

              return (
                <div
                  key={truck.id}
                  onClick={() => setSelectedMaintenanceTruck(truck)}
                  className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-indigo-300 hover:shadow-lg cursor-pointer transition-all relative"
                >
                  {alertCount > 0 && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {alertCount}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                      <Truck size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{truck.plate}</p>
                      <p className="text-xs text-slate-500">{truck.driver}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Km: <span className="font-medium text-slate-600">{currentKm.toLocaleString()}</span></p>
                    <p>Total gasto: <span className="font-medium text-emerald-600">R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal de Detalhes do Caminhão */}
        {selectedMaintenanceTruck && (
          <ModalBackdrop onClose={() => setSelectedMaintenanceTruck(null)}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="text-indigo-600" size={24} />
                  {selectedMaintenanceTruck.plate}
                </h2>
                <p className="text-sm text-slate-500">Motorista: {selectedMaintenanceTruck.driver}</p>
              </div>
              <button onClick={() => setSelectedMaintenanceTruck(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-indigo-50 p-4 rounded-xl text-center">
                  <p className="text-xs font-bold text-indigo-600 uppercase">Km Atual</p>
                  <p className="text-2xl font-bold text-slate-800">{getTruckCurrentMileage(selectedMaintenanceTruck.id).toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl text-center">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Total Gasto</p>
                  <p className="text-2xl font-bold text-slate-800">R$ {getTruckMaintenanceStats(selectedMaintenanceTruck.id).totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Histórico */}
              <h3 className="font-bold text-slate-800 mb-3">Histórico de Manutenções</h3>
              {(() => {
                const truckRecords = maintenanceRecords
                  .filter(r => r.truckId === selectedMaintenanceTruck.id)
                  .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (truckRecords.length === 0) {
                  return <p className="text-slate-400 text-sm text-center py-4">Nenhum registro de manutenção ainda.</p>;
                }

                return (
                  <div className="space-y-2">
                    {truckRecords.map(record => (
                      <div key={record.id} className="bg-slate-50 p-3 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-800">{record.serviceName}</p>
                          <p className="text-xs text-slate-500">{formatDateBR(record.date)} • {record.mileage.toLocaleString()} km</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">R$ {record.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <button
                            onClick={() => handleDeleteMaintenanceRecord(record.id)}
                            className="text-xs text-rose-500 hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </ModalBackdrop>
        )}

        {/* Modais de Cadastro */}
        <ServiceModal
          isOpen={isServiceModalOpen}
          onClose={() => { setIsServiceModalOpen(false); setEditingService(null); }}
          onSave={handleSaveService}
          editingService={editingService}
          trucks={trucks}
        />
        <MaintenanceRecordModal
          isOpen={isMaintenanceRecordModalOpen}
          onClose={() => { setIsMaintenanceRecordModalOpen(false); setPrefilledMaintenance(null); }}
          onSave={handleSaveMaintenanceRecord}
          trucks={trucks}
          services={maintenanceServices}
          entries={entries}
          records={maintenanceRecords}
          prefilled={prefilledMaintenance}
        />
      </div>
    );
  };



  const renderDataManagement = () => (
    <div className="space-y-8 animate-in fade-in"><h1 className="text-3xl font-bold">Gestão de Dados</h1><div className="grid md:grid-cols-2 gap-8">
      <Card><div className="bg-indigo-100 p-3 rounded-xl w-fit mb-6 text-indigo-600"><Download size={32} /></div><h3 className="font-bold text-xl mb-2">Exportar</h3><p className="text-sm text-slate-500 mb-8">Baixe todos os dados registrados em formatos Excel ou PDF.</p><div className="grid grid-cols-2 gap-4"><Button variant="secondary" onClick={exportToExcel}><FileSpreadsheet size={16} /> Excel</Button><Button variant="secondary" onClick={exportToPDF}><FileText size={16} /> PDF</Button></div></Card>
      <Card className="border-dashed border-2 bg-indigo-50/10 border-indigo-200"><div className="bg-indigo-600 p-3 rounded-xl w-fit mb-6 text-white"><Upload size={32} /></div><h3 className="font-bold text-xl mb-2">Importar Histórico Acumulado</h3><p className="text-sm text-slate-500 mb-6">Importe sua planilha atual. Se houver várias linhas para o mesmo caminhão, o sistema criará o histórico cronológico.</p>
        <div className="mb-6 flex justify-between items-center bg-white p-3 border border-indigo-100 rounded-xl"><div className="flex gap-2 text-indigo-600 font-bold text-[10px] uppercase"><HelpCircle size={18} />Modelo Completo</div><button onClick={downloadTemplate} className="text-xs font-bold text-indigo-600 hover:underline">Baixar Planilha Exemplo</button></div>
        <div className="relative overflow-hidden"><input type="file" accept=".xlsx" onChange={handleImportExcel} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isProcessing} /><Button variant="primary" className="w-full" disabled={isProcessing}>{isProcessing ? "Processando Histórico..." : "Escolher Arquivo XLSX"}</Button></div></Card>
    </div></div>
  );

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Truck className="animate-bounce text-indigo-600" size={48} /><p className="ml-4 font-bold text-indigo-900 tracking-widest uppercase text-xs">Carregando Sistema...</p></div>;

  // Tela de loading do admin
  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  // Tela de Login do Admin
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Painel de Gestão</h1>
            <p className="text-sm text-slate-500 mt-1">
              {showPasswordReset ? 'Recuperar senha' : 'Acesso restrito a administradores'}
            </p>
          </div>

          {/* Mensagem de sucesso ao enviar email */}
          {resetEmailSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Email Enviado!</h2>
              <p className="text-sm text-slate-500 mb-6">
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
              <button
                onClick={() => { setResetEmailSent(false); setShowPasswordReset(false); setAdminLoginError(''); }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Voltar ao Login
              </button>
            </div>
          ) : showPasswordReset ? (
            /* Formulário de recuperação de senha */
            <form onSubmit={handlePasswordReset}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Digite seu email cadastrado"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              {adminLoginError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {adminLoginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Enviar Link de Recuperação
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setShowPasswordReset(false); setAdminLoginError(''); }}
                  className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  ← Voltar ao login
                </button>
              </div>
            </form>
          ) : (
            /* Formulário de login */
            <form onSubmit={handleAdminLogin}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Digite seu email"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Senha</label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showAdminPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={() => { setShowPasswordReset(true); setAdminLoginError(''); }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              {adminLoginError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {adminLoginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isAdminLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAdminLoading ? <Loader2 size={20} className="animate-spin" /> : 'Entrar'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-slate-400 hover:text-indigo-600 transition-colors">
              ← Voltar para a página inicial
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50/50 font-sans text-slate-900 ${embedded ? '' : 'pb-10'}`}>
      {!embedded && (
        <nav className="bg-white border-b sticky top-0 z-40 backdrop-blur-md bg-white/80">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-20">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><Truck size={24} /></div>
              <div>
                <span className="font-black text-xl tracking-tight block">Gestão de Combustível Tim</span>
                <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest">Enterprise v3.0</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex space-x-2">
                <button onClick={() => setView('dashboard')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>Painel</button>
                <button onClick={() => setView('trucks')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view.includes('truck') ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>Frota</button>
                <button onClick={() => setView('maintenance')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative ${view === 'maintenance' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>
                  Manutenção
                  {maintenanceAlerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {maintenanceAlerts.length > 9 ? '9+' : maintenanceAlerts.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setView('data-management')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'data-management' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>Dados</button>
              </div>
              <button
                onClick={handleAdminLogout}
                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="Sair do sistema"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </nav>
      )}
      <main className={`mx-auto ${embedded ? 'w-full px-0 py-0' : 'max-w-7xl px-4 py-10'}`}>
        {view === 'dashboard' && renderDashboard()}{view === 'trucks' && renderTrucksList()}{view === 'truck-detail' && renderTruckDetail()}{view === 'maintenance' && renderMaintenance()}{view === 'data-management' && renderDataManagement()}
      </main>
      <TruckModal isOpen={isTruckModalOpen} onClose={() => { setIsTruckModalOpen(false); setEditingTruck(null); }} onSave={handleSaveTruck} editingTruck={editingTruck} />
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => { setIsEntryModalOpen(false); setEditingEntry(null); }}
        onSave={handleSaveEntry}
        truck={selectedTruck}
        allTrucks={trucks}
        entries={entries}
        editingEntry={editingEntry}
        isSaving={isSavingEntry}
      />
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url}
        imageUrl2={previewImage?.url2}
        title={previewImage?.title}
        title2={previewImage?.title2}
      />
      <SectionManagementModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        onSave={handleSectionBreak}
        truck={selectedTruck}
      />
    </div>
  );
}
