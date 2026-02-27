import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, getDocs, limit, startAfter, writeBatch, where } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { Card, Button, Input, Select, Modal, ModalFooter } from '../../components/ui';
import {
    FileText, Package, Truck, Calendar, Search, Filter,
    MoreVertical, CheckCircle2, AlertCircle, X, ChevronRight,
    ArrowUp, ArrowDown, RefreshCw, AlertTriangle, Loader2, DatabaseZap, Plus
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../../components/ui/Table';
import NotaDetalheModal from './modals/NotaDetalheModal';
import DespachoModal from './modals/DespachoModal';
import NotaManualModal from './modals/NotaManualModal';
import { formatCurrency } from '../../lib/utils';
import { CITIES } from '../../lib/cities';

// Helper to parse Excel serial dates like 46357.68 into DD/MM/YYYY
const parseExcelDate = (excelDate) => {
    if (!excelDate) return '';
    if (typeof excelDate === 'string' && excelDate.includes('/')) return excelDate;

    const numericDate = Number(excelDate);
    if (isNaN(numericDate)) return String(excelDate);

    const unixTimestamp = (numericDate - 25569) * 86400 * 1000;
    const dateObj = new Date(unixTimestamp);

    const utcDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);

    const d = String(utcDate.getDate()).padStart(2, '0');
    const m = String(utcDate.getMonth() + 1).padStart(2, '0');
    const y = utcDate.getFullYear();

    // Extract time from the fractional part of the Excel date
    const fractionalDay = numericDate % 1;
    if (fractionalDay > 0) {
        const totalMinutes = Math.round(fractionalDay * 24 * 60);
        const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
        const minutes = String(totalMinutes % 60).padStart(2, '0');
        return `${d}/${m}/${y} ${hours}:${minutes}`;
    }

    return `${d}/${m}/${y}`;
};

// Helper for Status Dots (Lights Style)
const StatusLights = ({ nota }) => {
    const { status, divergencia, processado_em } = nota;

    // Styles for "lights"
    const lightBase = "w-3 h-3 rounded-full border transition-all duration-300";
    const lightOn = "shadow-[0_0_8px_1px] opacity-100 scale-110 border-transparent";
    const lightOff = "bg-transparent opacity-30 scale-90";

    const isRecebido = ['RECEBIDO', 'PROCESSADA', 'CONCLUIDO', 'DIVERGENTE'].includes(status);

    // Blue Dot: Only if explicitly processed (has timestamp or specific status)
    const isProcessado = status === 'PROCESSADA' || !!processado_em;

    const isEntregue = ['CONCLUIDO', 'DIVERGENTE', 'DEVOLVED_ORPHAN'].includes(status);
    const isOrphan = status === 'DEVOLVED_ORPHAN';

    return (
        <div className="flex items-center justify-center gap-2">
            {/* Amarelo (Recebido) */}
            <div
                className={`${lightBase} border-yellow-500 ${isRecebido && !isOrphan ? `bg-yellow-400 ${lightOn} shadow-yellow-400/60` : lightOff}`}
                title="Recebido"
            />
            {/* Azul (Processado) */}
            <div
                className={`${lightBase} border-blue-500 ${isProcessado ? `bg-blue-500 ${lightOn} shadow-blue-500/60` : lightOff}`}
                title={isProcessado ? "Processado/Despachado" : "Não Processado"}
            />
            {/* Verde (Entregue) */}
            <div
                className={`${lightBase} border-emerald-500 ${isEntregue ? `bg-emerald-500 ${lightOn} shadow-emerald-500/60` : lightOff}`}
                title="Concluído/Entregue"
            />

            {/* Divergência Warning */}
            {(status === 'DIVERGENTE' || divergencia) && (
                <div className="ml-1 text-rose-500 animate-pulse" title={`Divergência: ${divergencia}`}>
                    <AlertCircle size={16} fill="currentColor" className="text-white" />
                </div>
            )}
        </div>
    );
};

const NOTES_PAGE_SIZE = 50;

// Section Component
const NotaSection = ({ title, notas, icon: Icon, colorClass, onOpenNota, emptyMessage, hasMoreFirestoreDocs, onLoadMore }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'data_ocorrencia', direction: 'desc' });
    const [visibleCount, setVisibleCount] = useState(NOTES_PAGE_SIZE);
    const sentinelRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Reset visible count only when sort changes (not when data loads)
    useEffect(() => {
        setVisibleCount(NOTES_PAGE_SIZE);
    }, [sortConfig]);

    const sortedNotas = useMemo(() => {
        let sortable = [...notas];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';

                // Special handling for dates (DD/MM/YYYY)
                if (sortConfig.key === 'data_ocorrencia') {
                    // Helper to convert DD/MM/YYYY HH:mm:ss to YYYY-MM-DD HH:mm:ss for string comparison
                    const parseDate = (val) => {
                        if (!val) return '';
                        const cleanVal = parseExcelDate(val).toString().trim();

                        // Handle DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
                        if (cleanVal.includes('/')) {
                            const [datePart, timePart] = cleanVal.split(' ');
                            const parts = datePart.split('/');
                            if (parts.length === 3) {
                                // YYYY-MM-DD + Time (if exists)
                                return `${parts[2]}-${parts[1]}-${parts[0]}${timePart ? ' ' + timePart : ''}`;
                            }
                        }
                        return cleanVal;
                    };

                    const dateA = parseDate(aVal);
                    const dateB = parseDate(bVal);

                    // If dates are different, sort by date
                    if (dateA !== dateB) {
                        if (!dateA) return 1; // Empty dates go to bottom
                        if (!dateB) return -1;
                        if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
                        if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
                    }

                    // Tie-breaker: Creation Time (criado_em)
                    // Ensure the most recently created appears first (desc) or last (asc)
                    const getTimestamp = (obj) => {
                        if (!obj.criado_em) return 0;
                        if (obj.criado_em.seconds) return obj.criado_em.seconds; // Firestore Timestamp
                        const d = new Date(obj.criado_em);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    };

                    const timeA = getTimestamp(a);
                    const timeB = getTimestamp(b);

                    // Always respect direction for tie-breaker too to keep consistent ordering visual
                    if (timeA < timeB) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (timeA > timeB) return sortConfig.direction === 'asc' ? 1 : -1;

                    return 0;
                }

                // Default string/number comparison
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [notas, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="w-4 h-4" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    const visibleNotas = sortedNotas.slice(0, visibleCount);
    const hasMore = visibleCount < sortedNotas.length;

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!sentinelRef.current || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(prev + NOTES_PAGE_SIZE, sortedNotas.length));
                }
            },
            { threshold: 0.1, root: scrollContainerRef.current }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, sortedNotas.length, visibleCount]);

    return (
        <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icon size={18} className="text-slate-500" />
                    <h3 className="font-bold text-slate-700 text-sm sm:text-base">{title}</h3>
                    <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                        {notas.length}
                    </span>
                    {hasMore && (
                        <span className="text-[10px] text-slate-400 italic">Exibindo {visibleCount}</span>
                    )}
                </div>
            </div>

            <div ref={scrollContainerRef} className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {/* Desktop Table */}
                <div className="hidden sm:block">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                            <TableRow>
                                <TableHead className="w-[140px]">Nota</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                    onClick={() => handleSort('origem')}
                                >
                                    <div className="flex items-center gap-1">
                                        Origem <SortIcon column="origem" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                    onClick={() => handleSort('destino')}
                                >
                                    <div className="flex items-center gap-1">
                                        Destino <SortIcon column="destino" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                                    onClick={() => handleSort('data_ocorrencia')}
                                >
                                    <div className="flex items-center gap-1">
                                        Data <SortIcon column="data_ocorrencia" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right">Peso (kg)</TableHead>
                                <TableHead className="text-center w-[120px]">Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedNotas.length === 0 ? (
                                <TableEmpty message={emptyMessage || "Nenhuma nota nesta seção."} />
                            ) : (
                                visibleNotas.map(nota => (
                                    <TableRow
                                        key={nota.id}
                                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => onOpenNota(nota)}
                                    >
                                        <TableCell className="font-medium text-indigo-600">
                                            <div className="flex items-center gap-2">
                                                {nota.nota_despacho}
                                                {nota.isManual && (
                                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">Manual</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-600">{nota.origem}</TableCell>
                                        <TableCell className="text-slate-600">{nota.destino}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">
                                            <div className="flex items-center gap-1">
                                                {parseExcelDate(nota.data_ocorrencia)}
                                                {/* Merge Indicator */}
                                                {(nota.msgs_entrada > 1 || nota.msgs_saida > 1) && (
                                                    <div
                                                        className="flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded cursor-help"
                                                        title={`${nota.msgs_entrada > 1 ? `${nota.msgs_entrada} E-mails de Entrada` : ''} ${nota.msgs_saida > 1 ? `${nota.msgs_saida} E-mails de Saída` : ''}`.trim()}
                                                    >
                                                        <AlertTriangle size={10} />
                                                        <span className="text-[10px] font-bold">
                                                            {Math.max(nota.msgs_entrada || 0, nota.msgs_saida || 0)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {(() => {
                                                let totalWeight = nota.peso_total_declarado;
                                                if (totalWeight === undefined || totalWeight === null || totalWeight === 0 || totalWeight === '') {
                                                    const parseFloatSafe = (val) => {
                                                        const p = parseFloat(String(val || 0).replace(',', '.'));
                                                        return isNaN(p) ? 0 : p;
                                                    };
                                                    const weightItens = (nota.itens || []).reduce((sum, item) => sum + parseFloatSafe(item.peso), 0);
                                                    const weightConferencia = (nota.itens_conferencia || []).reduce((sum, item) => sum + parseFloatSafe(item.peso), 0);
                                                    totalWeight = weightItens + weightConferencia;
                                                }
                                                return Number(totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <StatusLights nota={nota} />
                                        </TableCell>
                                        <TableCell>
                                            <ChevronRight size={18} className="text-slate-400" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {sortedNotas.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-400 italic text-sm">
                            {emptyMessage || "Nenhuma nota nesta seção."}
                        </div>
                    ) : (
                        visibleNotas.map(nota => (
                            <div
                                key={nota.id}
                                className="px-4 py-3 active:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => onOpenNota(nota)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-indigo-600 text-sm">{nota.nota_despacho}</span>
                                        {nota.isManual && (
                                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">Manual</span>
                                        )}
                                    </div>
                                    <StatusLights nota={nota} />
                                </div>
                                <div className="flex items-center gap-1 text-slate-600 text-xs mb-1">
                                    <span>{nota.origem}</span>
                                    <span className="text-slate-400">→</span>
                                    <span>{nota.destino}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <span>{parseExcelDate(nota.data_ocorrencia)}</span>
                                        {(nota.msgs_entrada > 1 || nota.msgs_saida > 1) && (
                                            <div className="flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded" title="E-mails mesclados">
                                                <AlertTriangle size={10} />
                                                <span className="font-bold">{Math.max(nota.msgs_entrada || 0, nota.msgs_saida || 0)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-medium text-slate-600">
                                        {(() => {
                                            let totalWeight = nota.peso_total_declarado;
                                            if (totalWeight === undefined || totalWeight === null || totalWeight === 0 || totalWeight === '') {
                                                const parseFloatSafe = (val) => {
                                                    const p = parseFloat(String(val || 0).replace(',', '.'));
                                                    return isNaN(p) ? 0 : p;
                                                };
                                                const weightItens = (nota.itens || []).reduce((sum, item) => sum + parseFloatSafe(item.peso), 0);
                                                const weightConferencia = (nota.itens_conferencia || []).reduce((sum, item) => sum + parseFloatSafe(item.peso), 0);
                                                totalWeight = weightItens + weightConferencia;
                                            }
                                            return Number(totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                        })()} kg
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Infinite scroll sentinel + loader (client-side) */}
                {hasMore && (
                    <div ref={sentinelRef} className="flex items-center justify-center gap-2 py-4 text-slate-400">
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                        <span className="text-xs font-medium">Carregando...</span>
                    </div>
                )}
                {/* Firestore loading sentinel - when section items are exhausted but more exist in DB */}
                {!hasMore && hasMoreFirestoreDocs && notas.length > 0 && (
                    <div
                        className="flex items-center justify-center gap-2 py-4 text-indigo-400 cursor-pointer hover:bg-indigo-50 transition-colors"
                        onClick={onLoadMore}
                    >
                        <span className="text-xs font-medium">Carregar mais</span>
                    </div>
                )}
            </div>
        </Card>
    );
};

const FIRESTORE_PAGE_SIZE = 50;

const NotasDespachoPage = () => {
    const [notas, setNotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [servidores, setServidores] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);

    const [selectedNota, setSelectedNota] = useState(null);
    const [isDespachoModalOpen, setIsDespachoModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    // Pagination state
    const [lastDocSnapshot, setLastDocSnapshot] = useState(null);
    const [hasMoreDocs, setHasMoreDocs] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const pageSentinelRef = useRef(null);

    // Filters
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterOrigem, setFilterOrigem] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Load Metadata (Last Sync)
    useEffect(() => {
        const fetchMeta = async () => {
            const docRef = doc(db, 'artifacts', `${appId}_sync_metadata`);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.last_sync && data.last_sync.seconds) {
                    setLastUpdate(new Date(data.last_sync.seconds * 1000).toLocaleString());
                } else if (data.last_sync) {
                    setLastUpdate(new Date(data.last_sync).toLocaleString());
                }
            }
        };
        fetchMeta();
        const interval = setInterval(fetchMeta, 60000);
        return () => clearInterval(interval);
    }, []);

    // Load Notes - PAGINATED: onSnapshot for first page (live), getDocs for scroll
    useEffect(() => {
        const q = query(
            collection(db, 'tb_despachos_conferencia'),
            orderBy('criado_em', 'desc'),
            limit(FIRESTORE_PAGE_SIZE)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const liveData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Merge: replace first page with live data, keep scroll-loaded data
            setNotas(prev => {
                const scrollLoaded = prev.filter(p => !liveData.find(l => l.id === p.id));
                return [...liveData, ...scrollLoaded];
            });
            // Store last doc from live snapshot for cursor pagination
            if (snapshot.docs.length > 0) {
                setLastDocSnapshot(snapshot.docs[snapshot.docs.length - 1]);
            }
            setHasMoreDocs(snapshot.docs.length >= FIRESTORE_PAGE_SIZE);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load more notes (scroll pagination)
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMoreDocs || !lastDocSnapshot) return;
        setLoadingMore(true);
        try {
            const nextQ = query(
                collection(db, 'tb_despachos_conferencia'),
                orderBy('criado_em', 'desc'),
                startAfter(lastDocSnapshot),
                limit(FIRESTORE_PAGE_SIZE)
            );
            const snapshot = await getDocs(nextQ);
            if (snapshot.docs.length > 0) {
                const newData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setNotas(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const unique = newData.filter(n => !existingIds.has(n.id));
                    return [...prev, ...unique];
                });
                setLastDocSnapshot(snapshot.docs[snapshot.docs.length - 1]);
            }
            setHasMoreDocs(snapshot.docs.length >= FIRESTORE_PAGE_SIZE);
        } catch (error) {
            console.error('Erro ao carregar mais notas:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMoreDocs, lastDocSnapshot]);

    // Page-level IntersectionObserver for loading more from Firestore
    useEffect(() => {
        if (!pageSentinelRef.current || !hasMoreDocs) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(pageSentinelRef.current);
        return () => observer.disconnect();
    }, [hasMoreDocs, loadMore]);

    // "Atualizar Status" - Full reconciliation
    const handleReconcileStatus = async () => {
        if (reconciling) return;
        setReconciling(true);
        try {
            // Load ALL notes
            const allQ = query(collection(db, 'tb_despachos_conferencia'), orderBy('criado_em', 'desc'));
            const allSnapshot = await getDocs(allQ);
            const allNotes = allSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Build unitizer map: unitizer ID → { entryNoteIds, exitNoteIds }
            const unitizerMap = new Map();
            allNotes.forEach(nota => {
                const itensEntrada = Array.isArray(nota.itens) ? nota.itens : [];
                const itensSaida = Array.isArray(nota.itens_conferencia) ? nota.itens_conferencia : [];

                itensEntrada.forEach(item => {
                    const u = typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador;
                    if (!u) return;
                    const id = String(u).trim();
                    if (!unitizerMap.has(id)) unitizerMap.set(id, { entryNoteIds: new Set(), exitNoteIds: new Set() });
                    unitizerMap.get(id).entryNoteIds.add(nota.id);
                });

                itensSaida.forEach(item => {
                    const u = typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador;
                    if (!u) return;
                    const id = String(u).trim();
                    if (!unitizerMap.has(id)) unitizerMap.set(id, { entryNoteIds: new Set(), exitNoteIds: new Set() });
                    unitizerMap.get(id).exitNoteIds.add(nota.id);
                });
            });

            // Determine note-level status from unitizer cross-reference
            const noteStatusUpdates = new Map(); // noteId → newStatus

            allNotes.forEach(nota => {
                if (nota.status === 'PROCESSADA' || nota.processado_em) return; // Dont overwrite manually processed

                const itensEntrada = Array.isArray(nota.itens) ? nota.itens : [];
                const itensSaida = Array.isArray(nota.itens_conferencia) ? nota.itens_conferencia : [];
                const hasEntry = itensEntrada.length > 0;
                const hasExit = itensSaida.length > 0;

                if (hasEntry && !hasExit) {
                    // Check if ALL entry unitizers have exits in other notes
                    const allResolved = itensEntrada.every(item => {
                        const u = typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador;
                        if (!u) return true;
                        const data = unitizerMap.get(String(u).trim());
                        return data && data.exitNoteIds.size > 0;
                    });
                    if (allResolved && nota.status !== 'CONCLUIDO') {
                        noteStatusUpdates.set(nota.id, 'CONCLUIDO');
                    }
                } else if (hasExit && !hasEntry) {
                    if (nota.status !== 'DEVOLVED_ORPHAN') {
                        noteStatusUpdates.set(nota.id, 'DEVOLVED_ORPHAN');
                    }
                } else if (hasEntry && hasExit) {
                    // Check divergence
                    const entryUnitizers = itensEntrada.map(i => typeof i === 'string' ? i.split(' - ')[0] : i?.unitizador).filter(Boolean).map(u => String(u).trim());
                    const exitUnitizers = itensSaida.map(i => typeof i === 'string' ? i.split(' - ')[0] : i?.unitizador).filter(Boolean).map(u => String(u).trim());
                    const mismatch = entryUnitizers.some(u => !exitUnitizers.includes(u)) || exitUnitizers.some(u => !entryUnitizers.includes(u));
                    if (mismatch && nota.status !== 'DIVERGENTE') {
                        noteStatusUpdates.set(nota.id, 'DIVERGENTE');
                    } else if (!mismatch && nota.status !== 'CONCLUIDO') {
                        noteStatusUpdates.set(nota.id, 'CONCLUIDO');
                    }
                }
            });

            // Write updates in batches (Firestore limit: 500 per batch)
            const entries = [...noteStatusUpdates.entries()];
            for (let i = 0; i < entries.length; i += 450) {
                const batch = writeBatch(db);
                const chunk = entries.slice(i, i + 450);
                chunk.forEach(([noteId, newStatus]) => {
                    batch.update(doc(db, 'tb_despachos_conferencia', noteId), { status: newStatus });
                });
                await batch.commit();
            }

            alert(`Status atualizado! ${entries.length} notas foram reconciliadas.`);
        } catch (error) {
            console.error('Erro na reconcilia\u00e7\u00e3o:', error);
            alert('Erro ao atualizar status. Verifique o console.');
        } finally {
            setReconciling(false);
        }
    };

    // Load Servers for Modal
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, `artifacts/${appId}/servidores`), (snapshot) => {
            setServidores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    // Extract Unique Cities for Dropdowns
    const uniqueOrigens = useMemo(() => [...new Set(notas.map(n => n.origem).filter(Boolean))].sort(), [notas]);
    const uniqueDestinos = useMemo(() => [...new Set(notas.map(n => n.destino).filter(Boolean))].sort(), [notas]);

    // Filtering Logic
    const filteredNotas = useMemo(() => {
        return notas.filter(nota => {
            // Text Search (ID, Origin, Unitizers)
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                const matchId = String(nota.nota_despacho || '').toLowerCase().includes(lowerTerm);
                const matchOrigem = String(nota.origem || '').toLowerCase().includes(lowerTerm);
                const matchDestino = String(nota.destino || '').toLowerCase().includes(lowerTerm);
                const matchObs = String(nota.observacoes || '').toLowerCase().includes(lowerTerm);

                // Search in Items (Unitizers)
                const matchItems = nota.itens?.some(item =>
                    String(item.unitizador || '').toLowerCase().includes(lowerTerm) ||
                    String(item.lacre || '').toLowerCase().includes(lowerTerm)
                );

                if (!matchId && !matchOrigem && !matchDestino && !matchItems && !matchObs) return false;
            }

            // Date Range
            if (filterDateStart || filterDateEnd) {
                const notaDateStr = parseExcelDate(nota.data_ocorrencia || ''); // DD/MM/YYYY
                if (notaDateStr) {
                    const [d, m, y] = notaDateStr.split(' ')[0].split('/');
                    const notaDate = new Date(`${y}-${m}-${d}`);

                    if (filterDateStart) {
                        const start = new Date(filterDateStart);
                        if (notaDate < start) return false;
                    }
                    if (filterDateEnd) {
                        const end = new Date(filterDateEnd);
                        if (notaDate > end) return false;
                    }
                }
            }
            // Origin
            if (filterOrigem && nota.origem !== filterOrigem) return false;
            // Destino
            if (filterDestino && nota.destino !== filterDestino) return false;

            return true;
        });
    }, [notas, filterDateStart, filterDateEnd, filterOrigem, filterDestino, searchTerm]);

    // Sectioning Logic
    const sections = useMemo(() => {
        return {
            recebidos: filteredNotas.filter(n => n.status === 'RECEBIDO' || n.status === 'IMPORTADO'),
            processados: filteredNotas.filter(n => n.status === 'PROCESSADA'),
            concluidos: filteredNotas.filter(n => ['CONCLUIDO', 'ENTREGUE'].includes(n.status)),
            divergentes: filteredNotas.filter(n => n.status === 'DIVERGENTE'),
            orfas: filteredNotas.filter(n => n.status === 'DEVOLVED_ORPHAN')
        };
    }, [filteredNotas]);

    // Actions
    const handleProcessarNota = (nota) => {
        setIsDespachoModalOpen(true);
    };

    const handleDespachoSuccess = async () => {
        if (selectedNota) {
            try {
                // Check for unchecked items and flag them
                const processList = (list) => {
                    return (list || []).map(item => {
                        const isChecked = typeof item === 'string' ? false : !!item.conferido;
                        if (!isChecked) {
                            return typeof item === 'string'
                                ? { unitizador: item.split(' - ')[0] || '-', lacre: item.split(' - ')[1] || '-', peso: item.split(' - ')[2] || '-', conferido: false, divergencia_processamento: true, origem: item }
                                : { ...item, divergencia_processamento: true };
                        }
                        return typeof item === 'string'
                            ? { unitizador: item.split(' - ')[0] || '-', lacre: item.split(' - ')[1] || '-', peso: item.split(' - ')[2] || '-', conferido: true, origem: item }
                            : item;
                    });
                };

                const newItens = processList(selectedNota.itens);
                const newItensConf = processList(selectedNota.itens_conferencia);

                const hasDivergence = newItens.some(i => i.divergencia_processamento) || newItensConf.some(i => i.divergencia_processamento);
                const nextStatus = hasDivergence ? 'DIVERGENTE' : 'PROCESSADA';

                await updateDoc(doc(db, 'tb_despachos_conferencia', selectedNota.id), {
                    status: nextStatus,
                    processado_em: new Date().toISOString(),
                    itens: newItens,
                    itens_conferencia: newItensConf
                });
            } catch (error) {
                console.error("Erro ao atualizar status:", error);
            }
        }
        setIsDespachoModalOpen(false);
        setSelectedNota(null);
    };


    const handleToggleItem = async (unitizador, newStatus) => {
        if (!selectedNota) return;

        // Helper para buscar e atualizar em uma lista
        const findAndUpdate = (list) => {
            const updatedList = [...(list || [])];
            const index = updatedList.findIndex(item => {
                const u = String((typeof item === 'string' ? item.split(' - ')[0] : item.unitizador) || '');
                return u.trim() === String(unitizador).trim();
            });

            if (index === -1) return null;

            const item = updatedList[index];
            if (typeof item === 'string') {
                const parts = item.split(' - ');
                updatedList[index] = {
                    unitizador: parts[0] || '-',
                    lacre: parts[1] || '-',
                    peso: parts[2] || '-',
                    conferido: newStatus,
                    origem: item
                };
            } else {
                updatedList[index] = { ...item, conferido: newStatus };
            }
            return updatedList;
        };

        // 1. Tentar encontrar na lista de entrada (padrão)
        let targetField = 'itens';
        let updatedList = findAndUpdate(selectedNota.itens);

        // 2. Se não encontrar, tentar na lista de conferência (devoluções/órfãs)
        if (!updatedList) {
            targetField = 'itens_conferencia';
            updatedList = findAndUpdate(selectedNota.itens_conferencia);
        }

        if (!updatedList) return; // Não encontrou em lugar nenhum

        // Atualizar estado
        const updatedNota = { ...selectedNota, [targetField]: updatedList };
        setSelectedNota(updatedNota);
        setNotas(prev => prev.map(n => n.id === selectedNota.id ? updatedNota : n));

        // Persistir no Firebase
        try {
            await updateDoc(doc(db, 'tb_despachos_conferencia', selectedNota.id), {
                [targetField]: updatedList
            });
        } catch (error) {
            console.error("Erro ao atualizar item:", error);
            alert("Erro ao salvar alteração. Verifique sua conexão.");
        }
    };

    const handleToggleAllItems = async (newStatus) => {
        if (!selectedNota) return;

        const updateListStatus = (list) => {
            return (list || []).map(item => {
                if (typeof item === 'string') {
                    const parts = item.split(' - ');
                    return {
                        unitizador: parts[0] || '-',
                        lacre: parts[1] || '-',
                        peso: parts[2] || '-',
                        conferido: newStatus,
                        origem: item
                    };
                }
                return { ...item, conferido: newStatus };
            });
        };

        const updatedItens = updateListStatus(selectedNota.itens);
        const updatedItensConferencia = updateListStatus(selectedNota.itens_conferencia);

        const updatedNota = {
            ...selectedNota,
            itens: updatedItens,
            itens_conferencia: updatedItensConferencia
        };

        setSelectedNota(updatedNota);
        setNotas(prev => prev.map(n => n.id === selectedNota.id ? updatedNota : n));

        try {
            await updateDoc(doc(db, 'tb_despachos_conferencia', selectedNota.id), {
                itens: updatedItens,
                itens_conferencia: updatedItensConferencia
            });
        } catch (error) {
            console.error("Erro ao atualizar todos os itens:", error);
            alert("Erro ao salvar alterações em massa.");
        }
    };

    const findClosestCity = (cityName) => {
        if (!cityName) return '';
        const normalize = str => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const target = normalize(cityName);
        const match = CITIES.find(c => normalize(c) === target);
        return match || cityName;
    };

    const initialDespachoData = useMemo(() => {
        if (!selectedNota) return null;

        // Parse weights safely
        let peso = selectedNota.peso_total_declarado;
        if (typeof peso === 'string') {
            peso = peso.replace(',', '.');
        }

        return {
            locked: true,
            data: (() => {
                const d = new Date();
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            })(),
            origem: findClosestCity(selectedNota.origem),
            destino: findClosestCity(selectedNota.destino),
            pesoTotal: peso,
            volumesCorreios: selectedNota.qtde_unitizadores || (selectedNota.itens ? selectedNota.itens.length : 0),
            volumesEntregues: '', // User usually fills this upon delivery/dispatch
            quantidadePaletes: 0,
            observacoes: `Despacho gerado a partir da Nota ${selectedNota.nota_despacho}.`
        };
    }, [selectedNota]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Notas de Despacho</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <span>Gerenciamento automático via e-mail</span>
                        {lastUpdate && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs border border-slate-200">
                                Última atualização: {lastUpdate}
                            </span>
                        )}
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs border border-indigo-200 font-medium">
                            {notas.length} notas carregadas
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        className="flex items-center gap-2"
                        onClick={() => setIsManualModalOpen(true)}
                    >
                        <Plus size={16} />
                        Adicionar Despacho
                    </Button>
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={async () => {
                            try {
                                setLoading(true);
                                const response = await fetch(`https://gestao-frota-tim.vercel.app/api/sync_emails?key=${import.meta.env.VITE_SYNC_KEY || 'timbelem2025*'}`);
                                const data = await response.json();

                                if (response.ok) {
                                    alert(`Sucesso: ${data.message || 'Notas atualizadas!'}`);
                                } else {
                                    alert(`Erro: ${data.error || 'Falha na atualização'}`);
                                }
                            } catch (error) {
                                alert('Erro de conexão ao tentar atualizar.');
                                console.error(error);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        {loading ? "Atualizando..." : "Atualizar Notas"}
                    </Button>
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={handleReconcileStatus}
                        disabled={reconciling}
                    >
                        {reconciling ? <Loader2 size={16} className="animate-spin" /> : <DatabaseZap size={16} />}
                        {reconciling ? "Reconciliando..." : "Atualizar Status"}
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar por Nota, Unitizador, Lacre..."
                        className="w-full h-12 pl-10 pr-4 rounded-lg border border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-white"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Global Filters */}
            <Card className="p-4 bg-white shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Período</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                                value={filterDateStart}
                                onChange={e => setFilterDateStart(e.target.value)}
                            />
                            <input
                                type="date"
                                className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                                value={filterDateEnd}
                                onChange={e => setFilterDateEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Origem</label>
                        <select
                            className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                            value={filterOrigem}
                            onChange={e => setFilterOrigem(e.target.value)}
                        >
                            <option value="">Todas</option>
                            {uniqueOrigens.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Destino</label>
                        <select
                            className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none bg-white"
                            value={filterDestino}
                            onChange={e => setFilterDestino(e.target.value)}
                        >
                            <option value="">Todos</option>
                            {uniqueDestinos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setFilterDateStart('');
                                setFilterDateEnd('');
                                setFilterOrigem('');
                                setFilterDestino('');
                            }}
                            disabled={!filterDateStart && !filterDateEnd && !filterOrigem && !filterDestino}
                        >
                            Limpar Filtros
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Sections */}
            <div className="space-y-8">
                {/* 1. Recebido - Amarelo */}
                <NotaSection
                    title="Recebidos - Aguardando Processamento"
                    notas={sections.recebidos}
                    icon={Package}
                    colorClass="border-l-yellow-400"
                    onOpenNota={setSelectedNota}
                    emptyMessage="Nenhuma nota pendente."
                    hasMoreFirestoreDocs={hasMoreDocs}
                    onLoadMore={loadMore}
                />

                {/* 2. Processado - Amarelo + Azul */}
                <NotaSection
                    title="Processados / Em Trânsito"
                    notas={sections.processados}
                    icon={Truck}
                    colorClass="border-l-blue-500"
                    onOpenNota={setSelectedNota}
                    hasMoreFirestoreDocs={hasMoreDocs}
                    onLoadMore={loadMore}
                />

                {/* 3. Concluído - 3 Bolinhas */}
                <NotaSection
                    title="Entregues / Devolvidos (Concluídos)"
                    notas={sections.concluidos}
                    icon={CheckCircle2}
                    colorClass="border-l-emerald-500"
                    onOpenNota={setSelectedNota}
                    hasMoreFirestoreDocs={hasMoreDocs}
                    onLoadMore={loadMore}
                />

                {/* 4. Notas Órfãs (Entregues sem Entrada) */}
                {sections.orfas.length > 0 && (
                    <NotaSection
                        title="Notas Órfãs"
                        notas={sections.orfas}
                        icon={AlertCircle}
                        colorClass="border-l-orange-400"
                        onOpenNota={setSelectedNota}
                        hasMoreFirestoreDocs={hasMoreDocs}
                        onLoadMore={loadMore}
                    />
                )}

                {/* 5. Notas Divergentes */}
                {sections.divergentes.length > 0 && (
                    <NotaSection
                        title="Notas Divergentes"
                        notas={sections.divergentes}
                        icon={AlertCircle}
                        colorClass="border-l-rose-500"
                        onOpenNota={setSelectedNota}
                        hasMoreFirestoreDocs={hasMoreDocs}
                        onLoadMore={loadMore}
                    />
                )}

            </div>


            {/* Modais */}
            {selectedNota && !isDespachoModalOpen && (
                <NotaDetalheModal
                    nota={selectedNota}
                    onClose={() => setSelectedNota(null)}
                    onProcessar={handleProcessarNota}
                    onToggleItem={handleToggleItem}
                    onToggleAll={handleToggleAllItems}
                />
            )}

            <DespachoModal
                key={selectedNota ? selectedNota.id : 'new-despacho'}
                isOpen={isDespachoModalOpen}
                onClose={() => setIsDespachoModalOpen(false)}
                initialData={initialDespachoData}
                onSaveSuccess={handleDespachoSuccess}
                servidores={servidores}
            />

            <NotaManualModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
            />
        </div>
    );
};

export default NotasDespachoPage;
