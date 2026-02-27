import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, limit, startAfter, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Card, Button } from '../../components/ui';
import {
    Package, Truck, CheckCircle2, AlertCircle, Search,
    ArrowUp, ArrowDown, Filter, X, Loader2, DatabaseZap
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '../../components/ui/Table';
import NotaDetalheModal from './modals/NotaDetalheModal';

// --- Helper Components ---

const StatusLights = ({ unitizador }) => {
    const { status, flagEntry, flagProcessed, flagExit, divergenceType, correiosMatch } = unitizador;
    // console.log('StatusLights Debug:', { id: unitizador.id, status, flagEntry, flagExit, flagProcessed });

    // Styles for "lights"
    const lightBase = "w-3 h-3 rounded-full border transition-all duration-300";
    const lightOn = "shadow-[0_0_8px_1px] opacity-100 scale-110 border-transparent";
    const lightOff = "bg-transparent opacity-30 scale-90";

    const isDivergente = status === 'DIVERGENTE';

    return (
        <div className="flex items-center justify-center gap-2">
            {/* 1. Amarelo (Entrada/Recebido) */}
            <div
                className={`${lightBase} border-yellow-500 ${flagEntry ? `bg-yellow-400 ${lightOn} shadow-yellow-400/60` : lightOff}`}
                title={`Entrada Registrada (${flagEntry ? 'Sim' : 'Não'})`}
            />
            {/* 2. Azul (Processado/Saída) */}
            <div
                className={`${lightBase} border-blue-500 ${flagProcessed ? `bg-blue-500 ${lightOn} shadow-blue-500/60` : lightOff}`}
                title={`Processado (${flagProcessed ? 'Sim' : 'Não'})`}
            />
            {/* 3. Verde (Entregue/Conferido) */}
            <div
                className={`${lightBase} border-emerald-500 ${flagExit ? `bg-emerald-500 ${lightOn} shadow-emerald-500/60` : lightOff}`}
                title={`Conferido (${flagExit ? 'Sim' : 'Não'})`}
            />
            {/* 4. Check Correios (Futuro) */}
            <div
                className={`${lightBase} border-slate-400 ${correiosMatch ? `bg-green-600 ${lightOn}` : lightOff}`}
                title="Confirmado Correios"
            >
                {correiosMatch && <CheckCircle2 size={10} className="text-white" />}
            </div>

            {/* Warn for Divergence */}
            {(isDivergente) && (
                <div className="ml-1 text-rose-500 animate-pulse" title={divergenceType || "Atenção"}>
                    <AlertCircle size={16} fill="currentColor" className="text-white" />
                </div>
            )}
        </div>
    );
};

const PAGE_SIZE = 50;

const UnitizadorSection = ({ title, unitizadores, icon: Icon, colorClass, emptyMessage, onRowClick, hasMoreFirestoreDocs, onLoadMore }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'data_entrada', direction: 'desc' });
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Reset visible count only when sort changes (not when data loads)
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [sortConfig]);

    const sortedList = useMemo(() => {
        let sortable = [...unitizadores];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';

                // Date Handling
                if (sortConfig.key === 'data_entrada') {
                    const parseDate = (val) => {
                        if (!val) return '';
                        const cleanVal = val.toString().trim();
                        // Handle DD/MM/YYYY HH:mm:ss
                        if (cleanVal.includes('/')) {
                            const [datePart, timePart] = cleanVal.split(' ');
                            const parts = datePart.split('/');
                            if (parts.length === 3) {
                                return `${parts[2]}-${parts[1]}-${parts[0]}${timePart ? ' ' + timePart : ''}`;
                            }
                        }
                        return cleanVal;
                    };
                    aVal = parseDate(aVal);
                    bVal = parseDate(bVal);
                }

                // Numeric Weight Handling
                if (sortConfig.key === 'peso') {
                    const parseWeight = (w) => parseFloat(String(w).replace(',', '.') || 0);
                    aVal = parseWeight(aVal);
                    bVal = parseWeight(bVal);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [unitizadores, sortConfig]);

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

    const visibleList = sortedList.slice(0, visibleCount);
    const hasMore = visibleCount < sortedList.length;

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!sentinelRef.current || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, sortedList.length));
                }
            },
            { threshold: 0.1, root: scrollContainerRef.current }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, sortedList.length, visibleCount]);

    return (
        <Card className={`overflow-hidden border-l-4 ${colorClass}`}>
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icon size={18} className="text-slate-500" />
                    <h3 className="font-bold text-slate-700 text-sm sm:text-base">{title}</h3>
                    <div className="flex items-center gap-2">
                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                            {unitizadores.length}
                        </span>
                        {hasMore && (
                            <span className="text-[10px] text-slate-400 italic">Exibindo {visibleCount}</span>
                        )}
                    </div>
                </div>
            </div>

            <div ref={scrollContainerRef} className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <div className="hidden sm:block">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                            <TableRow>
                                <TableHead onClick={() => handleSort('id')} className="cursor-pointer hover:bg-slate-50 w-[180px]">
                                    <div className="flex items-center gap-1">Unitizador <SortIcon column="id" /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('nota_origem')} className="cursor-pointer hover:bg-slate-50">
                                    <div className="flex items-center gap-1">Nota <SortIcon column="nota_origem" /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('origem')} className="cursor-pointer hover:bg-slate-50">
                                    <div className="flex items-center gap-1">Origem <SortIcon column="origem" /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('destino')} className="cursor-pointer hover:bg-slate-50">
                                    <div className="flex items-center gap-1">Destino <SortIcon column="destino" /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('data_entrada')} className="cursor-pointer hover:bg-slate-50">
                                    <div className="flex items-center gap-1">Data Entrada <SortIcon column="data_entrada" /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('peso')} className="cursor-pointer hover:bg-slate-50 text-right">
                                    <div className="flex items-center justify-end gap-1">Peso (kg) <SortIcon column="peso" /></div>
                                </TableHead>
                                <TableHead className="text-center w-[120px]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedList.length === 0 ? (
                                <TableEmpty message={emptyMessage || "Nenhum unitizador nesta seção."} />
                            ) : (
                                visibleList.map((u, idx) => (
                                    <TableRow key={`${u.id}-${idx}`} className={`hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick && onRowClick(u)}>
                                        <TableCell className="font-medium text-indigo-600 text-xs">
                                            {u.id}
                                            {u.lacre && u.lacre !== '-' && (
                                                <span className="block text-[10px] text-slate-400 font-normal">Lacre: {u.lacre}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">{u.nota_origem || '-'}</TableCell>
                                        <TableCell className="text-xs">{u.origem}</TableCell>
                                        <TableCell className="text-xs">{u.destino}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{u.data_entrada || '-'}</TableCell>
                                        <TableCell className="text-right font-medium text-xs">
                                            {u.peso ? parseFloat(String(u.peso).replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <StatusLights unitizador={u} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden divide-y divide-slate-100">
                    {sortedList.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-400 italic text-sm">
                            {emptyMessage || "Vazio."}
                        </div>
                    ) : (
                        visibleList.map((u, idx) => (
                            <div key={`${u.id}-${idx}`} className={`px-4 py-3 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick && onRowClick(u)}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-indigo-600 text-xs">{u.id}</span>
                                    <StatusLights unitizador={u} />
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-600 mb-1">
                                    <span>Nota: {u.nota_origem}</span>
                                    <span>{u.data_entrada}</span>
                                    <span>{u.origem} → {u.destino}</span>
                                </div>
                                <div className="text-right text-xs font-semibold text-slate-700">
                                    {u.peso} kg
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
                {/* Firestore loading sentinel */}
                {!hasMore && hasMoreFirestoreDocs && unitizadores.length > 0 && (
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

const UnitizadoresPage = () => {
    const [unitizadores, setUnitizadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rawNotesMap, setRawNotesMap] = useState({});
    const [accumulatedNotes, setAccumulatedNotes] = useState([]);

    // Pagination state
    const [lastDocSnapshot, setLastDocSnapshot] = useState(null);
    const [hasMoreDocs, setHasMoreDocs] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const pageSentinelRef = useRef(null);

    // Dispatch note modal state
    const [selectedNota, setSelectedNota] = useState(null);
    const [availableNotas, setAvailableNotas] = useState([]);
    const [selectedNotaIndex, setSelectedNotaIndex] = useState(0);
    const [divergenceReasons, setDivergenceReasons] = useState([]);
    const [selectedUnitizerId, setSelectedUnitizerId] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrigem, setFilterOrigem] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');

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

    // Extract unitizer transformation into reusable function
    const transformNotesToUnitizers = useCallback((rawNotes) => {
        const notesLookup = {};
        rawNotes.forEach(n => { notesLookup[n.nota_despacho || n.id] = n; });
        setRawNotesMap(notesLookup);

        const unitizerMap = new Map();

        rawNotes.forEach(nota => {
            const itensEntrada = Array.isArray(nota.itens) ? nota.itens : [];
            const itensSaida = Array.isArray(nota.itens_conferencia) ? nota.itens_conferencia : [];

            itensEntrada.forEach(item => {
                let uData = typeof item === 'string'
                    ? { unitizador: item.split(' - ')[0], lacre: item.split(' - ')[1], peso: item.split(' - ')[2] }
                    : item;
                if (!uData.unitizador) return;
                const id = String(uData.unitizador).trim();
                if (!unitizerMap.has(id)) unitizerMap.set(id, { id, entries: [], exits: [] });
                unitizerMap.get(id).entries.push({
                    notaId: nota.nota_despacho, origem: nota.origem, destino: nota.destino,
                    data: nota.data_ocorrencia, peso: uData.peso, lacre: uData.lacre,
                    statusNota: nota.status, correiosMatch: uData.correios_match
                });
            });

            itensSaida.forEach(item => {
                let uData = typeof item === 'string'
                    ? { unitizador: item.split(' - ')[0], lacre: item.split(' - ')[1], peso: item.split(' - ')[2] }
                    : item;
                if (!uData.unitizador) return;
                const id = String(uData.unitizador).trim();
                if (!unitizerMap.has(id)) unitizerMap.set(id, { id, entries: [], exits: [] });
                unitizerMap.get(id).exits.push({
                    notaId: nota.nota_despacho, peso: uData.peso, lacre: uData.lacre,
                    data: nota.data_ocorrencia, statusNota: nota.status,
                    origem: nota.origem, destino: nota.destino, correiosMatch: uData.correios_match
                });
            });
        });

        const processedList = [];
        unitizerMap.forEach((data, id) => {
            const entry = data.entries[0];
            const exit = data.exits[0];
            const hasEntry = !!entry;
            const hasExit = !!exit;
            const isProcessed = entry?.statusNota === 'PROCESSADA' || entry?.statusNota === 'ENTREGUE';
            const entryNoteIds = [...new Set(data.entries.map(e => e.notaId).filter(Boolean))];
            const exitNoteIds = [...new Set(data.exits.map(e => e.notaId).filter(Boolean))];

            const uObj = {
                id, flagEntry: hasEntry, flagProcessed: isProcessed, flagExit: hasExit,
                nota_origem: entry?.notaId || exit?.notaId || '?',
                origem: entry?.origem || exit?.origem || '?',
                destino: entry?.destino || exit?.destino || '?',
                data_entrada: parseExcelDate(entry?.data || exit?.data || ''),
                peso: entry?.peso || exit?.peso || '0',
                lacre: entry?.lacre || exit?.lacre || '-',
                status: 'UNKNOWN', divergenceType: null,
                correiosMatch: entry?.correiosMatch || exit?.correiosMatch || false,
                entryNoteIds, exitNoteIds
            };

            if (hasEntry && !hasExit) {
                uObj.status = isProcessed ? 'PROCESSADA' : 'RECEBIDO';
            } else if (hasExit && !hasEntry) {
                uObj.status = 'ORPHAN';
                uObj.divergenceType = 'Unitizador não encontrado na entrada';
            } else if (hasEntry && hasExit) {
                const safePeso = (p) => parseFloat(String(p || 0).replace(',', '.'));
                if (safePeso(entry.peso) === safePeso(exit.peso)) {
                    uObj.status = 'ENTREGUE';
                } else {
                    uObj.status = 'DIVERGENTE';
                    uObj.divergenceType = `Peso divergente (Entrada: ${entry.peso} vs Saída: ${exit.peso})`;
                }
            }
            processedList.push(uObj);
        });

        return processedList;
    }, []);

    // Load Notes - PAGINATED
    useEffect(() => {
        const q = query(
            collection(db, 'tb_despachos_conferencia'),
            orderBy('criado_em', 'desc'),
            limit(FIRESTORE_PAGE_SIZE)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const liveNotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Merge live data with scroll-loaded data
            setAccumulatedNotes(prev => {
                const scrollLoaded = prev.filter(p => !liveNotes.find(l => l.id === p.id));
                const merged = [...liveNotes, ...scrollLoaded];
                setUnitizadores(transformNotesToUnitizers(merged));
                return merged;
            });
            if (snapshot.docs.length > 0) {
                setLastDocSnapshot(snapshot.docs[snapshot.docs.length - 1]);
            }
            setHasMoreDocs(snapshot.docs.length >= FIRESTORE_PAGE_SIZE);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [transformNotesToUnitizers]);

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
                const newNotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setAccumulatedNotes(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const unique = newNotes.filter(n => !existingIds.has(n.id));
                    const merged = [...prev, ...unique];
                    setUnitizadores(transformNotesToUnitizers(merged));
                    return merged;
                });
                setLastDocSnapshot(snapshot.docs[snapshot.docs.length - 1]);
            }
            setHasMoreDocs(snapshot.docs.length >= FIRESTORE_PAGE_SIZE);
        } catch (error) {
            console.error('Erro ao carregar mais notas:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMoreDocs, lastDocSnapshot, transformNotesToUnitizers]);

    // Page-level IntersectionObserver for loading more from Firestore
    useEffect(() => {
        if (!pageSentinelRef.current || !hasMoreDocs) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { threshold: 0.1 }
        );
        observer.observe(pageSentinelRef.current);
        return () => observer.disconnect();
    }, [hasMoreDocs, loadMore]);

    const handleReconcileStatus = async () => {
        if (reconciling) return;
        setReconciling(true);
        try {
            const allQ = query(collection(db, 'tb_despachos_conferencia'), orderBy('criado_em', 'desc'));
            const allSnapshot = await getDocs(allQ);
            const allNotes = allSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Build unitizer map
            const unitizerMap = new Map();
            allNotes.forEach(nota => {
                (Array.isArray(nota.itens) ? nota.itens : []).forEach(item => {
                    const u = typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador;
                    let peso = typeof item === 'string' ? item.split(' - ')[2] : item?.peso;
                    if (!u) return;
                    peso = parseFloat(String(peso || 0).replace(',', '.'));
                    const id = String(u).trim();
                    if (!unitizerMap.has(id)) unitizerMap.set(id, { entries: [], exits: [] });
                    unitizerMap.get(id).entries.push({ notaId: nota.id, peso });
                });
                (Array.isArray(nota.itens_conferencia) ? nota.itens_conferencia : []).forEach(item => {
                    const u = typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador;
                    let peso = typeof item === 'string' ? item.split(' - ')[2] : item?.peso;
                    if (!u) return;
                    peso = parseFloat(String(peso || 0).replace(',', '.'));
                    const id = String(u).trim();
                    if (!unitizerMap.has(id)) unitizerMap.set(id, { entries: [], exits: [] });
                    unitizerMap.get(id).exits.push({ notaId: nota.id, peso });
                });
            });

            const updates = new Map();
            allNotes.forEach(nota => {
                const itensEntrada = Array.isArray(nota.itens) ? nota.itens : [];
                const itensSaida = Array.isArray(nota.itens_conferencia) ? nota.itens_conferencia : [];
                const hasEntry = itensEntrada.length > 0;
                const hasExit = itensSaida.length > 0;

                let isDivergent = false;
                let isOrphan = false;
                let allEntryMatched = true;
                let allExitMatched = true;
                let divergenceReasons = [];

                itensEntrada.forEach(item => {
                    const u = String(typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador).trim();
                    const peso = parseFloat(String(typeof item === 'string' ? item.split(' - ')[2] : item?.peso || 0).replace(',', '.'));
                    const data = unitizerMap.get(u);
                    if (!data || data.exits.length === 0) {
                        allEntryMatched = false;
                    } else {
                        const exitWeight = data.exits[0].peso;
                        if (peso !== exitWeight) {
                            isDivergent = true;
                            divergenceReasons.push(`Peso div. ${u}`);
                        }
                    }
                });

                itensSaida.forEach(item => {
                    const u = String(typeof item === 'string' ? item.split(' - ')[0] : item?.unitizador).trim();
                    const peso = parseFloat(String(typeof item === 'string' ? item.split(' - ')[2] : item?.peso || 0).replace(',', '.'));
                    const data = unitizerMap.get(u);
                    if (!data || data.entries.length === 0) {
                        allExitMatched = false;
                        isOrphan = true;
                        divergenceReasons.push(`Órfão ${u}`);
                    } else {
                        const entryWeight = data.entries[0].peso;
                        if (peso !== entryWeight) {
                            isDivergent = true;
                            if (!divergenceReasons.includes(`Peso div. ${u}`)) {
                                divergenceReasons.push(`Peso div. ${u}`);
                            }
                        }
                    }
                });

                let newStatus = nota.status;
                let newDivergence = divergenceReasons.join(' | ');

                if (isDivergent) {
                    newStatus = 'DIVERGENTE';
                } else if (hasExit && !hasEntry && isOrphan) {
                    newStatus = 'DEVOLVED_ORPHAN';
                } else if (hasEntry && !hasExit) {
                    if (allEntryMatched) {
                        newStatus = 'CONCLUIDO';
                    } else if (nota.status === 'CONCLUIDO' || nota.status === 'DIVERGENTE') {
                        newStatus = nota.processado_em ? 'PROCESSADA' : 'RECEBIDO';
                        newDivergence = '';
                    }
                } else if (hasExit && !hasEntry) {
                    if (allExitMatched) {
                        newStatus = 'CONCLUIDO';
                        newDivergence = '';
                    } else if (nota.status === 'CONCLUIDO' || nota.status === 'DIVERGENTE') {
                        newStatus = 'DEVOLVED_ORPHAN';
                    }
                } else if (hasEntry && hasExit) {
                    if (isOrphan) {
                        newStatus = 'DIVERGENTE';
                    } else if (allEntryMatched && allExitMatched) {
                        newStatus = 'CONCLUIDO';
                    } else if (nota.status === 'CONCLUIDO' || nota.status === 'DIVERGENTE') {
                        newStatus = nota.processado_em ? 'PROCESSADA' : 'RECEBIDO';
                    }
                }

                if (newStatus !== nota.status || newDivergence !== (nota.divergencia || '')) {
                    updates.set(nota.id, { status: newStatus, divergencia: newDivergence });
                }
            });

            const entries = [...updates.entries()];
            for (let i = 0; i < entries.length; i += 450) {
                const batch = writeBatch(db);
                entries.slice(i, i + 450).forEach(([noteId, fields]) => {
                    batch.update(doc(db, 'tb_despachos_conferencia', noteId), fields);
                });
                await batch.commit();
            }

            alert(`Status atualizado! ${entries.length} notas foram reconciliadas.`);
        } catch (error) {
            console.error('Erro na reconciliação:', error);
            alert('Erro ao atualizar status. Verifique o console.');
        } finally {
            setReconciling(false);
        }
    };

    const filteredList = useMemo(() => {
        return unitizadores.filter(u => {
            // Search
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                const match =
                    String(u.id || '').toLowerCase().includes(lower) ||
                    String(u.nota_origem || '').toLowerCase().includes(lower) ||
                    String(u.lacre || '').toLowerCase().includes(lower);
                if (!match) return false;
            }

            // Filters
            if (filterOrigem && u.origem !== filterOrigem) return false;
            if (filterDestino && u.destino !== filterDestino) return false;

            // Date
            if (filterDateStart || filterDateEnd) {
                // Parse DD/MM/YYYY
                if (!u.data_entrada) return false;
                const parts = String(u.data_entrada).split(' ')[0].split('/');
                if (parts.length !== 3) return false;
                const uDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                if (filterDateStart) {
                    const startDate = new Date(filterDateStart);
                    // Reset time for fair comparison
                    uDate.setHours(0, 0, 0, 0);
                    startDate.setHours(0, 0, 0, 0);
                    if (uDate < startDate) return false;
                }
                if (filterDateEnd) {
                    const endDate = new Date(filterDateEnd);
                    uDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    if (uDate > endDate) return false;
                }
            }

            return true;
        });
    }, [unitizadores, searchTerm, filterOrigem, filterDestino, filterDateStart, filterDateEnd]);

    const sections = useMemo(() => {
        return {
            recebidos: filteredList.filter(u => u.status === 'RECEBIDO').sort((a, b) => String(b.data_entrada || '').localeCompare(String(a.data_entrada || ''))),
            processados: filteredList.filter(u => u.status === 'PROCESSADA').sort((a, b) => String(b.data_entrada || '').localeCompare(String(a.data_entrada || ''))),
            entregues: filteredList.filter(u => u.status === 'ENTREGUE').sort((a, b) => String(b.data_entrada || '').localeCompare(String(a.data_entrada || ''))),
            orfaos: filteredList.filter(u => u.status === 'ORPHAN').sort((a, b) => String(b.data_entrada || '').localeCompare(String(a.data_entrada || ''))),
            divergentes: filteredList.filter(u => u.status === 'DIVERGENTE').sort((a, b) => String(b.data_entrada || '').localeCompare(String(a.data_entrada || ''))),
        };
    }, [filteredList]);

    const uniqueOrigens = useMemo(() => [...new Set(unitizadores.map(u => u.origem).filter(x => x && x !== '?'))].sort(), [unitizadores]);
    const uniqueDestinos = useMemo(() => [...new Set(unitizadores.map(u => u.destino).filter(x => x && x !== '?'))].sort(), [unitizadores]);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gerenciamento de Unitizadores</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-slate-500">Rastreamento de volumes</p>
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs border border-indigo-200 font-medium">
                            {unitizadores.length} unitizadores ({accumulatedNotes.length} notas)
                        </span>
                    </div>
                </div>
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

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar Unitizador, Nota ou Lacre..."
                        className="w-full h-12 pl-10 pr-4 rounded-lg border border-slate-200 shadow-sm focus:border-indigo-500 outline-none bg-white font-medium text-slate-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 bg-white shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Período (Entrada)</label>
                        <div className="flex gap-2">
                            <input type="date" className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
                            <input type="date" className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Origem</label>
                        <select className="w-full h-9 px-2 rounded border border-slate-200 text-sm bg-white focus:border-indigo-500 focus:outline-none" value={filterOrigem} onChange={e => setFilterOrigem(e.target.value)}>
                            <option value="">Todas</option>
                            {uniqueOrigens.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Destino</label>
                        <select className="w-full h-9 px-2 rounded border border-slate-200 text-sm bg-white focus:border-indigo-500 focus:outline-none" value={filterDestino} onChange={e => setFilterDestino(e.target.value)}>
                            <option value="">Todos</option>
                            {uniqueDestinos.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterOrigem(''); setFilterDestino(''); }} disabled={!filterDateStart && !filterDateEnd && !filterOrigem && !filterDestino}>
                            Limpar Filtros
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Sections */}
            <div className="space-y-8">
                <UnitizadorSection
                    title="Recebidos - Em estoque"
                    unitizadores={sections.recebidos}
                    icon={Package}
                    colorClass="border-l-yellow-400"
                    emptyMessage="Nenhum unitizador em estoque."
                    hasMoreFirestoreDocs={hasMoreDocs}
                    onLoadMore={loadMore}
                />

                <UnitizadorSection
                    title="Processados - Em Trânsito"
                    unitizadores={sections.processados}
                    icon={Truck}
                    colorClass="border-l-blue-500"
                    emptyMessage="Nenhum unitizador em trânsito."
                    hasMoreFirestoreDocs={hasMoreDocs}
                    onLoadMore={loadMore}
                />

                <UnitizadorSection
                    title="Entregues (Ciclo Fechado)"
                    unitizadores={sections.entregues}
                    icon={CheckCircle2}
                    colorClass="border-l-emerald-500"
                    emptyMessage="Nenhum unitizador finalizado."
                    hasMoreFirestoreDocs={hasMoreDocs}
                    onLoadMore={loadMore}
                />

                {sections.orfaos.length > 0 && (
                    <UnitizadorSection
                        title="Unitizadores Órfãos (Sem Entrada)"
                        unitizadores={sections.orfaos}
                        icon={AlertCircle}
                        colorClass="border-l-orange-400"
                        hasMoreFirestoreDocs={hasMoreDocs}
                        onLoadMore={loadMore}
                    />
                )}

                {sections.divergentes.length > 0 && (
                    <UnitizadorSection
                        title="Unitizadores Divergentes"
                        unitizadores={sections.divergentes}
                        icon={AlertCircle}
                        colorClass="border-l-rose-500"
                        onRowClick={(u) => {
                            // Compute divergence reasons
                            const reasons = [];
                            if (u.divergenceType) reasons.push(u.divergenceType);
                            const entryIds = u.entryNoteIds || [];
                            const exitIds = u.exitNoteIds || [];
                            if (entryIds.length > 0 && exitIds.length > 0) {
                                const differentNotes = !entryIds.some(id => exitIds.includes(id));
                                if (differentNotes) reasons.push(`Notas de Despacho diferentes (Recebimento: ${entryIds.join(', ')} | Devolu\u00e7\u00e3o: ${exitIds.join(', ')})`);
                            }
                            setDivergenceReasons(reasons);

                            // Collect all associated notes (entry + exit)
                            const allNoteIds = [...new Set([...entryIds, ...exitIds])];
                            const notasRaw = allNoteIds.map(id => rawNotesMap[id]).filter(Boolean);
                            if (notasRaw.length === 0) return;

                            // Separate into Recebimento (has itens) and Devolu\u00e7\u00e3o (has itens_conferencia)
                            // A note can be both; classify by where the unitizer lives
                            const recNotas = entryIds.map(id => rawNotesMap[id]).filter(Boolean);
                            const devNotas = exitIds.map(id => rawNotesMap[id]).filter(Boolean);

                            // Build labeled list sorted by date (oldest first)
                            const labeled = [];
                            recNotas.forEach((n, i) => {
                                labeled.push({ ...n, _switchLabel: `Recebimento ${i + 1}`, _type: 'rec', _order: i });
                            });
                            devNotas.forEach((n, i) => {
                                // Avoid duplicate if same nota is in both lists
                                const already = labeled.find(l => l.nota_despacho === n.nota_despacho);
                                if (!already) {
                                    labeled.push({ ...n, _switchLabel: `Devolu\u00e7\u00e3o ${i + 1}`, _type: 'dev', _order: i });
                                } else {
                                    // Update label to show both
                                    already._switchLabel = `Recebimento ${recNotas.indexOf(n) + 1}`;
                                }
                            });

                            setSelectedUnitizerId(u.id);
                            setAvailableNotas(labeled);
                            setSelectedNotaIndex(0);
                            setSelectedNota(labeled[0]);
                        }}
                        hasMoreFirestoreDocs={hasMoreDocs}
                        onLoadMore={loadMore}
                    />
                )}
            </div>

            {/* Dispatch Note Modal with Switch */}
            {selectedNota && (
                <div className="relative">
                    {/* Switch between notes if multiple */}
                    {availableNotas.length > 1 && (
                        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center bg-white rounded-full shadow-xl border border-slate-200 p-1 gap-1">
                            {availableNotas.map((nota, idx) => {
                                const isActive = idx === selectedNotaIndex;
                                return (
                                    <button
                                        key={nota.nota_despacho || idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedNotaIndex(idx);
                                            setSelectedNota(availableNotas[idx]);
                                        }}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${isActive
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {nota._switchLabel || `Nota ${idx + 1}`}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <NotaDetalheModal
                        nota={selectedNota}
                        onClose={() => { setSelectedNota(null); setAvailableNotas([]); setSelectedNotaIndex(0); setDivergenceReasons([]); setSelectedUnitizerId(null); }}
                        onProcessar={() => { }}
                        onToggleItem={() => { }}
                        onToggleAll={() => { }}
                        readOnly={true}
                        divergenceAlert={divergenceReasons.length > 0 ? divergenceReasons : null}
                        subtitle={selectedUnitizerId ? `Unitizador: ${selectedUnitizerId}` : null}
                    />
                </div>
            )}
        </div>
    );
};

export default UnitizadoresPage;
