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
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  HelpCircle,
  Pencil,
  Loader2,
  Trash2,
  X,
  ExternalLink
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  deleteDoc,
  getDocs
} from 'firebase/firestore';

// --- Configuração do Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyA3VhT2iHrD1uzOFI9Bc_BYyMoCpOG-G8w",
  authDomain: "gestao-frota-tim.firebaseapp.com",
  projectId: "gestao-frota-tim",
  storageBucket: "gestao-frota-tim.firebasestorage.app",
  messagingSenderId: "455143595757",
  appId: "1:455143595757:web:036dc514ad7f983ca336e4",
  measurementId: "G-LDYRESTCTG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "frota-tim-oficial"; // Esse é o nome da pasta onde os dados vão ficar

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
    expectedKml: '',
    driver: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (editingTruck) {
        setFormData({
          plate: editingTruck.plate || '',
          model: editingTruck.model || '',
          capacity: String(editingTruck.capacity || ''),
          expectedKml: String(editingTruck.expectedKml || ''),
          driver: editingTruck.driver || ''
        });
      } else {
        setFormData({ plate: '', model: '', capacity: '', expectedKml: '', driver: '' });
      }
    }
  }, [isOpen, editingTruck]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...(editingTruck ? { id: editingTruck.id } : {}),
      ...formData,
      capacity: Number(formData.capacity),
      expectedKml: Number(formData.expectedKml),
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
          <Input label="Modelo / Marca" placeholder="Ex: Volvo FH" required value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Input label="Capacidade Tanque (L)" type="number" required value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} />
          <Input label="Eficiência Prevista Km/L" type="number" step="0.1" required value={formData.expectedKml} onChange={e => setFormData({ ...formData, expectedKml: e.target.value })} />
        </div>
        <Input label="Motorista Responsável" placeholder="Nome Completo" required value={formData.driver} onChange={e => setFormData({ ...formData, driver: e.target.value })} />
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
    totalCost: '',
    liters: '',
    newMileage: '',
    initialFuel: ''
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [odometerFile, setOdometerFile] = useState(null);

  const activeTruck = truck || allTrucks.find(t => t.id === localTruckId);

  // Determinar se este é o primeiro registro (baseado no histórico real)
  const isFirst = useMemo(() => {
    if (!activeTruck) return false;
    const truckEntries = entries.filter(e => e.truckId === activeTruck.id);

    if (!editingEntry) {
      return truckEntries.length === 0;
    } else {
      if (truckEntries.length === 0) return true;
      const sorted = [...truckEntries].sort((a, b) => a.newMileage - b.newMileage);
      return sorted[0]?.id === editingEntry.id;
    }
  }, [activeTruck, editingEntry, entries]);

  useEffect(() => {
    if (isOpen) {
      // Resetar arquivos
      setReceiptFile(null);
      setOdometerFile(null);

      if (editingEntry) {
        setFormData({
          date: editingEntry.date,
          totalCost: editingEntry.totalCost,
          liters: editingEntry.liters,
          newMileage: editingEntry.newMileage,
          initialFuel: editingEntry.initialFuel !== undefined ? String(editingEntry.initialFuel) : ''
        });
        if (!truck) setLocalTruckId(editingEntry.truckId);
      } else {
        setFormData({
          date: new Date().toISOString().split('T')[0],
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

    // Pequena validação básica (apenas se não estiver editando e for menor que o atual do caminhão)
    if (!editingEntry && activeTruck.currentMileage > 0 && newMileage < activeTruck.currentMileage) {
      alert("Erro: A nova quilometragem deve ser maior que a atual do caminhão.");
      return;
    }

    const payload = {
      ...(editingEntry ? { id: editingEntry.id } : {}),
      truckId: activeTruck.id,
      date: formData.date,
      totalCost,
      liters,
      costPerLiter,
      newMileage,
      distanceTraveled: 0,
    };

    if (isFirst) {
      payload.initialFuel = Number(formData.initialFuel || 0);
    }

    onSave(payload, { receiptFile, odometerFile });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className={`p-8 border-b border-slate-100 ${editingEntry ? 'bg-amber-50/30' : 'bg-emerald-50/30'} flex justify-between items-center flex-shrink-0`}>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{editingEntry ? 'Editar Registro' : 'Registrar Abastecimento'}</h2>
          <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
            {activeTruck ? (
              <><span className="font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700">{activeTruck.plate}</span><span>{activeTruck.model}</span></>
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
          <Input label="Data do Abastecimento" type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-6">
            <Input label="Valor Total (R$)" type="number" step="0.01" required placeholder="0,00" value={formData.totalCost} onChange={e => setFormData({ ...formData, totalCost: e.target.value })} />
            <Input label="Litros Abastecidos" type="number" step="0.1" required placeholder="0 L" value={formData.liters} onChange={e => setFormData({ ...formData, liters: e.target.value })} />
          </div>
          <Input
            label="Nova Quilometragem (Informada)"
            type="number"
            required
            min={editingEntry ? 0 : (activeTruck?.currentMileage || 0)}
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

          <div className="grid grid-cols-2 gap-4 mb-8">
            <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${odometerFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setOdometerFile(e.target.files[0])} />
              {odometerFile ? <CheckCircle2 className="text-emerald-500 mb-2" size={24} /> : <Gauge className="mb-2 text-slate-400 group-hover:scale-110 transition-transform" size={24} />}
              <span className={`text-xs font-medium ${odometerFile ? 'text-emerald-700' : 'text-slate-500'}`}>{odometerFile ? 'Odômetro OK' : 'Foto Odômetro'}</span>
            </label>

            <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${receiptFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setReceiptFile(e.target.files[0])} />
              {receiptFile ? <CheckCircle2 className="text-emerald-500 mb-2" size={24} /> : <FileText className="mb-2 text-slate-400 group-hover:scale-110 transition-transform" size={24} />}
              <span className={`text-xs font-medium ${receiptFile ? 'text-emerald-700' : 'text-slate-500'}`}>{receiptFile ? 'Recibo OK' : 'Foto Recibo'}</span>
            </label>
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

const ImagePreviewModal = ({ isOpen, onClose, imageUrl, title }) => {
  if (!isOpen || !imageUrl) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-lg flex items-center justify-center z-[100] p-4 md:p-8" onClick={onClose}>
      <div className="relative max-w-5xl w-full flex flex-col items-center animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        {/* Header de Ações */}
        <div className="w-full flex justify-between items-center mb-4 px-2">
          <div className="flex flex-col">
            <p className="text-white font-black text-xl tracking-tight uppercase">{title}</p>
            <div className="h-1 w-12 bg-indigo-500 rounded-full mt-1"></div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={imageUrl}
              download={`${title}.png`}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2 font-bold transition-all border border-white/10 active:scale-95"
            >
              <Download size={18} /> <span className="hidden sm:inline">Baixar</span>
            </a>
            <button
              onClick={onClose}
              className="bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl backdrop-blur-md transition-all border border-rose-500/20 active:scale-95"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Container da Imagem */}
        <div className="bg-white p-1 md:p-2 rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden ring-8 ring-black/20">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-[75vh] object-contain rounded-[1.5rem] select-none"
          />
        </div>
      </div>
    </div>
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

// --- Componente Principal ---

export default function FleetManager() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [trucks, setTrucks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingTruck, setEditingTruck] = useState(null);
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('week');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const scripts = ['https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js'];
    scripts.forEach(src => { if (!document.querySelector(`script[src="${src}"]`)) { const s = document.createElement('script'); s.src = src; s.async = true; document.head.appendChild(s); } });
  }, []);

  useEffect(() => {
    const initAuth = async () => {
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
    return () => { unsubT(); unsubE(); };
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
    if (!confirm(`Tem certeza que deseja excluir o caminhão ${plate}? Isso removerá o cadastro do sistema.`)) return;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', id));
      sendToGoogleSheets({ type: 'truck_delete', id });
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir caminhão.");
    }
  };

  // Função para salvar abastecimento (com fotos)
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
        const dist = d.newMileage - previousEntry.newMileage;

        // Atualiza o registro anterior com a distância calculada
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'entries', previousEntry.id), {
          distanceTraveled: dist
        });
      }

      // 3. Converter arquivos e enviar para Google Drive/Sheets
      // 3. Converter arquivos e enviar para Google Drive/Sheets
      const receiptBase64 = files.receiptFile ? await fileToBase64(files.receiptFile) : null;
      const odometerBase64 = files.odometerFile ? await fileToBase64(files.odometerFile) : null;

      // Salva o registro atual (sempre com distância 0 ou pendente, pois só saberemos no próximo)
      const payloadToSave = {
        ...d,
        distanceTraveled: 0,
        receiptUrl: receiptBase64 || d.receiptUrl || null,
        odometerUrl: odometerBase64 || d.odometerUrl || null,
        hasReceipt: !!(receiptBase64 || d.receiptUrl),
        hasOdometer: !!(odometerBase64 || d.odometerUrl)
      };

      // 1. Salvar no Firebase
      if (d.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'entries', d.id), payloadToSave);
      } else {
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'entries'), payloadToSave);
        entryId = docRef.id;
      }

      // 2. Atualizar parâmetros do Caminhão
      const truck = trucks.find(t => t.id === d.truckId);
      if (truck) {
        // Obter histórico atualizado (incluindo o que acabamos de salvar)
        const currentEntryForCalcs = { ...payloadToSave, id: entryId };
        const otherEntries = entries.filter(e => e.truckId === d.truckId && e.id !== entryId);
        const truckEntries = [...otherEntries, currentEntryForCalcs];

        const sorted = [...truckEntries].sort((a, b) => a.newMileage - b.newMileage);
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
          totalCost: d.totalCost,
          liters: d.liters,
          newMileage: d.newMileage,
          receiptBase64,
          odometerBase64
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
          const sorted = [...remaining].sort((a, b) => a.newMileage - b.newMileage);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];

          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trucks', truckId), {
            currentMileage: last.newMileage,
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
    const cost = entries.reduce((a, c) => a + c.totalCost, 0);
    const lit = entries.reduce((a, c) => a + c.liters, 0);
    const dist = entries.reduce((a, c) => a + c.distanceTraveled, 0);
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

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in">
      <style>{globalStyles}</style>
      <div className="flex justify-between items-center"><h1 className="text-3xl font-bold">Painel de Controle</h1><div className="flex gap-3"><Button variant="success" onClick={() => { setEditingEntry(null); setIsEntryModalOpen(true); }}><Fuel size={18} /> Novo Registro</Button><Button onClick={() => { setEditingTruck(null); setIsTruckModalOpen(true); }}><Plus size={18} /> Novo Veículo</Button></div></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6"><StatCard title="Total Gasto" value={globalStats.cost} icon={DollarSign} color="green" /><StatCard title="Combustível" value={globalStats.liters} icon={Droplet} color="indigo" /><StatCard title="Eficiência Média" value={globalStats.eff} icon={TrendingUp} color="amber" /><StatCard title="Frota" value={globalStats.count} icon={Truck} color="blue" /></div>
    </div>
  );

  const renderTrucksList = () => (
    <div className="space-y-8 animate-in slide-in-from-right">
      <style>{globalStyles}</style>
      <div className="flex justify-between items-center"><div><h2 className="text-3xl font-bold">Caminhões</h2><p className="text-slate-500">Frota cadastrada no sistema.</p></div><Button onClick={() => { setEditingTruck(null); setIsTruckModalOpen(true); }}><Plus size={20} /> Adicionar Novo</Button></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{trucks.map(t => (<Card key={t.id} noPadding className="cursor-pointer" onClick={() => { setSelectedTruck(t); setView('truck-detail'); }}><div className="p-6">
        <div className="flex justify-between mb-4">
          <div className="bg-slate-100 border px-3 py-1 font-mono font-bold text-lg rounded shadow-sm">{t.plate}</div>
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); setEditingTruck(t); setIsTruckModalOpen(true); }} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-amber-600" title="Editar"><Pencil size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteTruck(t.id, t.plate); }} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-rose-600" title="Excluir"><Trash2 size={18} /></button>
          </div>
        </div>
        <h3 className="font-bold mb-1">{t.model}</h3><p className="text-xs text-slate-400 mb-6 font-medium">{t.driver}</p><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-slate-50 p-2 rounded text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">KM Atual</p><p className="text-sm font-bold">{t.currentMileage}</p></div><div className="bg-emerald-50 p-2 rounded text-center"><p className="text-[10px] text-emerald-600 font-bold uppercase">Meta</p><p className="text-sm font-bold">{t.expectedKml}</p></div></div><Button variant="secondary" className="w-full justify-between" onClick={(e) => { e.stopPropagation(); setSelectedTruck(t); setView('truck-detail'); }}><span>Mostrar histórico</span><ChevronLeft className="rotate-180" size={16} /></Button></div></Card>))}</div>
    </div>
  );

  const renderTruckDetail = () => {
    // Ordenar cronologicamente para cálculos (antigo -> novo)
    const rawHistory = entries
      .filter(e => e.truckId === selectedTruck?.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.newMileage - b.newMileage);

    // Calcular histórico de tanque
    let currentTank = selectedTruck.initialFuel || 0;

    // Precisamos recalcular a distância baseada na ordem cronológica correta para garantir a consistência
    // caso os dados do DB estejam fora de ordem ou com gaps.
    let previousMileage = selectedTruck.initialMileage || 0;

    const calculatedHistoryRaw = rawHistory.map(entry => {
      // Recalcular distância para garantir consistência visual na tabela (opcional, mas seguro)
      // Se usarmos o do DB (entry.distanceTraveled), dependemos do save anterior estar correto.
      // Vamos confiar no DB para distância (já que ele lida com gaps de edição complexos), 
      // MAS para o tanque usamos a eficiência fixa.

      const dist = entry.distanceTraveled;
      const consumido = dist > 0 ? dist / (selectedTruck.expectedKml || 1) : 0;

      // Se for o primeiro registro ele pode ter trazido um initialFuel
      // Caso contrário calculamos baseado no que sobrou do tanque anterior
      const remaining = entry.initialFuel > 0 ? entry.initialFuel : (currentTank - consumido);
      const newTank = remaining + entry.liters;

      // Atualiza para o próximo
      currentTank = newTank;
      previousMileage = entry.newMileage;

      return {
        ...entry,
        calculatedRemaining: remaining,
        calculatedNewTank: newTank
      };
    });

    // Inverter para mostrar do mais novo para o mais antigo
    const calculatedHistory = [...calculatedHistoryRaw].reverse();

    const h = calculatedHistory; // Alias para manter compatibilidade com contadores se houver
    return (<div className="space-y-8 animate-in slide-in-from-right">
      <style>{globalStyles}</style>
      <div className="flex justify-between items-center"><div className="flex items-center gap-4"><button onClick={() => setView('trucks')} className="p-2 border rounded-xl hover:bg-white"><ChevronLeft /></button><div><h2 className="text-2xl font-bold">{selectedTruck.plate} <span className="text-sm font-normal text-slate-400">{selectedTruck.model}</span></h2><p className="text-sm text-slate-500">Histórico de abastecimentos e performance.</p></div></div><Button variant="success" onClick={() => { setEditingEntry(null); setIsEntryModalOpen(true); }}><Fuel size={18} /> Novo Registro</Button></div>
      <div className="grid grid-cols-3 gap-6"><Card className="text-center bg-blue-50/50"><p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Km Percorridos</p><p className="text-2xl font-bold">{selectedTruck.currentMileage - selectedTruck.initialMileage} km</p></Card><Card className="text-center bg-emerald-50/50"><p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Eficiência Prevista</p><p className="text-2xl font-bold">{selectedTruck.expectedKml.toFixed(2)} Km/L</p></Card><Card className="text-center bg-amber-50/50"><p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Total de Litros</p><p className="text-2xl font-bold">{h.reduce((a, c) => a + c.liters, 0).toFixed(0)} L</p></Card></div>
      <Card noPadding className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b"><tr>
        <th className="px-6 py-4">Data</th>
        <th className="px-6 py-4">Custo</th>
        <th className="px-6 py-4">Combustível Inserido</th>
        <th className="px-6 py-4">Km Rodada</th>
        <th className="px-6 py-4 text-emerald-600">Comb. Remanescente</th>
        <th className="px-6 py-4 text-blue-600">Novo Tanque</th>
        <th className="px-6 py-4 text-center">Ações</th>
      </tr></thead><tbody className="divide-y">{calculatedHistory.map(e => (
        <tr key={e.id} className="hover:bg-slate-50">
          <td className="px-6 py-4 font-medium">{new Date(e.date).toLocaleDateString('pt-BR')}</td>
          <td className="px-6 py-4 font-bold text-slate-800">R$ {e.totalCost.toFixed(2)}</td>
          <td className="px-6 py-4 font-bold">{e.liters.toFixed(1)} L</td>
          <td className="px-6 py-4">
            {e.distanceTraveled > 0 ? (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">+{e.distanceTraveled} km</span>
            ) : (
              <span className="text-slate-400 text-[10px]">---</span>
            )}
          </td>
          <td className="px-6 py-4 text-emerald-600 font-medium">
            {e.calculatedRemaining !== null ? e.calculatedRemaining.toFixed(1) + " L" : "-"}
          </td>
          <td className="px-6 py-4 text-blue-600 font-bold">
            {e.calculatedNewTank !== null ? e.calculatedNewTank.toFixed(1) + " L" : "-"}
          </td>
          <td className="px-6 py-4 flex justify-center gap-2">
            {e.receiptUrl && e.receiptUrl !== 'imported' && (
              <button onClick={() => setPreviewImage({ url: e.receiptUrl, title: 'Recibo de Abastecimento' })} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-emerald-600" title="Ver Recibo"><FileText size={14} /></button>
            )}
            {e.odometerUrl && e.odometerUrl !== 'imported' && (
              <button onClick={() => setPreviewImage({ url: e.odometerUrl, title: 'Foto do Odômetro' })} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-blue-600" title="Ver Odômetro"><Gauge size={14} /></button>
            )}
            <button onClick={() => { setEditingEntry(e); setIsEntryModalOpen(true); }} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-amber-600" title="Editar"><Pencil size={14} /></button>
            <button onClick={() => handleDeleteEntry(e.id, e.date)} className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-slate-200 transition-all text-rose-600" title="Excluir"><Trash2 size={14} /></button>
          </td>
        </tr>))}</tbody></table></div></Card>
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url}
        title={previewImage?.title}
      />
    </div>);
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

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 pb-10">
      <nav className="bg-white border-b sticky top-0 z-40 backdrop-blur-md bg-white/80"><div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-20"><div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}><div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><Truck size={24} /></div><div><span className="font-black text-xl tracking-tight block">Gestão de Combustível Tim</span><span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest">Enterprise v3.0</span></div></div><div className="flex space-x-2"><button onClick={() => setView('dashboard')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>Painel</button><button onClick={() => setView('trucks')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view.includes('truck') ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>Frota</button><button onClick={() => setView('data-management')} className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'data-management' ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>Dados</button></div></div></nav>
      <main className="max-w-7xl mx-auto px-4 py-10">
        {view === 'dashboard' && renderDashboard()}{view === 'trucks' && renderTrucksList()}{view === 'truck-detail' && renderTruckDetail()}{view === 'data-management' && renderDataManagement()}
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
    </div>
  );
}
