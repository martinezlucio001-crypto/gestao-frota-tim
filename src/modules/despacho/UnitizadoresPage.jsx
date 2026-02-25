import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Card, Button } from '../../components/ui';
import {
    Package, Truck, CheckCircle2, AlertCircle, Search,
    ArrowUp, ArrowDown, Filter, X
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

const UnitizadorSection = ({ title, unitizadores, icon: Icon, colorClass, emptyMessage, onRowClick }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'data_entrada', direction: 'desc' });

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
                        {unitizadores.length > 500 && (
                            <span className="text-[10px] text-slate-400 italic">Exibindo 500</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
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
                                sortedList.slice(0, 500).map((u, idx) => (
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
                        sortedList.slice(0, 200).map((u, idx) => (
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
            </div>
        </Card>
    );
};

// --- Main Page Component ---

const UnitizadoresPage = () => {
    const [unitizadores, setUnitizadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rawNotesMap, setRawNotesMap] = useState({});

    // Dispatch note modal state
    const [selectedNota, setSelectedNota] = useState(null);
    const [availableNotas, setAvailableNotas] = useState([]);
    const [selectedNotaIndex, setSelectedNotaIndex] = useState(0);
    const [divergenceReasons, setDivergenceReasons] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrigem, setFilterOrigem] = useState('');
    const [filterDestino, setFilterDestino] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');

    // helper to parse Excel serial dates like 46357.68 into DD/MM/YYYY
    const parseExcelDate = (excelDate) => {
        if (!excelDate) return '';
        // If it's already a string with a slash, it's already formatted
        if (typeof excelDate === 'string' && excelDate.includes('/')) return excelDate;

        const numericDate = Number(excelDate);
        if (isNaN(numericDate)) return String(excelDate);

        // Excel serial date epoch: Jan 1, 1900. (25569 = Jan 1, 1970)
        // Excel incorrectly thinks 1900 is a leap year, so for dates after Feb 28, 1900, we subtract 1 day.
        // Javascript dates are in milliseconds since 1970.
        const unixTimestamp = (numericDate - 25569) * 86400 * 1000;
        // The timezone offset is required to avoid being off by hours leading to wrong day
        const dateObj = new Date(unixTimestamp);

        // Convert to UTC day, month, year to avoid local offset shifting the day backwards
        const utcDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);

        const d = String(utcDate.getDate()).padStart(2, '0');
        const m = String(utcDate.getMonth() + 1).padStart(2, '0');
        const y = utcDate.getFullYear();

        return `${d}/${m}/${y}`;
    };

    useEffect(() => {
        const q = query(collection(db, 'tb_despachos_conferencia'), orderBy('criado_em', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rawNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Store raw notes in a map for quick lookup by nota_despacho
            const notesLookup = {};
            rawNotes.forEach(n => { notesLookup[n.nota_despacho || n.id] = n; });
            setRawNotesMap(notesLookup);

            // --- DATA TRANSFORMATION LOGIC ---
            // Extract Entry (itens) and Exit (itens_conferencia e devolvidos)
            // Group by Unitizer ID
            const unitizerMap = new Map();

            rawNotes.forEach(nota => {
                // Ensure array format for robust iteration
                const itensEntrada = Array.isArray(nota.itens) ? nota.itens : [];
                const itensSaida = Array.isArray(nota.itens_conferencia) ? nota.itens_conferencia : [];

                // 1. Process ENTRIES (Recebidos)
                itensEntrada.forEach(item => {
                    // Normalize item structure (handle legacy string format)
                    let uData = {};
                    if (typeof item === 'string') {
                        const parts = item.split(' - ');
                        uData = { unitizador: parts[0], lacre: parts[1], peso: parts[2] };
                    } else {
                        uData = item;
                    }

                    if (!uData.unitizador) return;

                    const id = String(uData.unitizador).trim();
                    if (!unitizerMap.has(id)) {
                        unitizerMap.set(id, { id, entries: [], exits: [] });
                    }

                    unitizerMap.get(id).entries.push({
                        notaId: nota.nota_despacho,
                        origem: nota.origem,
                        destino: nota.destino,
                        data: nota.data_ocorrencia,
                        peso: uData.peso,
                        lacre: uData.lacre,
                        statusNota: nota.status, // RECEBIDO, PROCESSADA, etc.
                        correiosMatch: uData.correios_match
                    });
                });

                // 2. Process EXITS (Conferidos via App/Retorno)
                itensSaida.forEach(item => {
                    let uData = {};
                    if (typeof item === 'string') {
                        const parts = item.split(' - ');
                        uData = { unitizador: parts[0], lacre: parts[1], peso: parts[2] };
                    } else {
                        uData = item;
                    }

                    if (!uData.unitizador) return;

                    const id = String(uData.unitizador).trim();
                    if (!unitizerMap.has(id)) {
                        unitizerMap.set(id, { id, entries: [], exits: [] });
                    }

                    unitizerMap.get(id).exits.push({
                        notaId: nota.nota_despacho,
                        peso: uData.peso,
                        lacre: uData.lacre,
                        data: nota.data_ocorrencia, // Often same or later date
                        statusNota: nota.status,
                        // Orphans fetch location from here
                        origem: nota.origem,
                        destino: nota.destino,
                        correiosMatch: uData.correios_match
                    });
                });
            });

            // 3. Flatten and Categorize
            const processedList = [];

            unitizerMap.forEach((data, id) => {
                const entry = data.entries[0]; // Assume most recent?
                const exit = data.exits[0];   // Simplified

                // Logic flags
                const hasEntry = !!entry;
                const hasExit = !!exit;
                const isProcessed = entry?.statusNota === 'PROCESSADA' || entry?.statusNota === 'ENTREGUE';

                // Base Object
                // Collect all unique note IDs for entry and exit
                const entryNoteIds = [...new Set(data.entries.map(e => e.notaId).filter(Boolean))];
                const exitNoteIds = [...new Set(data.exits.map(e => e.notaId).filter(Boolean))];

                const uObj = {
                    id: id,
                    flagEntry: hasEntry,
                    flagProcessed: isProcessed,
                    flagExit: hasExit,
                    // Prefer Entry data, fallback to Exit data for Orphans
                    nota_origem: entry?.notaId || exit?.notaId || '?',
                    origem: entry?.origem || exit?.origem || '?',
                    destino: entry?.destino || exit?.destino || '?',
                    data_entrada: parseExcelDate(entry?.data || exit?.data || ''),
                    peso: entry?.peso || exit?.peso || '0',
                    lacre: entry?.lacre || exit?.lacre || '-',
                    status: 'UNKNOWN',
                    divergenceType: null,
                    correiosMatch: entry?.correiosMatch || exit?.correiosMatch || false,
                    entryNoteIds,
                    exitNoteIds
                };

                // Section Categorization Logic (Mutually Exclusive for Lists)
                if (hasEntry && !hasExit) {
                    if (isProcessed) {
                        uObj.status = 'PROCESSADA'; // Blue List
                    } else {
                        uObj.status = 'RECEBIDO'; // Yellow List
                    }
                } else if (hasExit && !hasEntry) {
                    uObj.status = 'ORPHAN'; // Orange List
                    uObj.divergenceType = 'Unitizador não encontrado na entrada';
                } else if (hasEntry && hasExit) {
                    const weightMatch = entry.peso === exit.peso;
                    if (weightMatch) {
                        uObj.status = 'ENTREGUE'; // Green List
                    } else {
                        uObj.status = 'DIVERGENTE'; // Red List
                        uObj.divergenceType = `Peso divergente (Entrada: ${entry.peso} vs Saída: ${exit.peso})`;
                    }
                }

                processedList.push(uObj);
            });

            setUnitizadores(processedList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Gerenciamento de Unitizadores</h1>
                <p className="text-sm text-slate-500 mt-1">Rastreamento de volumes</p>
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
                />

                <UnitizadorSection
                    title="Processados - Em Trânsito"
                    unitizadores={sections.processados}
                    icon={Truck}
                    colorClass="border-l-blue-500"
                    emptyMessage="Nenhum unitizador em trânsito."
                />

                <UnitizadorSection
                    title="Entregues (Ciclo Fechado)"
                    unitizadores={sections.entregues}
                    icon={CheckCircle2}
                    colorClass="border-l-emerald-500"
                    emptyMessage="Nenhum unitizador finalizado."
                />

                {sections.orfaos.length > 0 && (
                    <UnitizadorSection
                        title="Unitizadores Órfãos (Sem Entrada)"
                        unitizadores={sections.orfaos}
                        icon={AlertCircle}
                        colorClass="border-l-orange-400"
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

                            setAvailableNotas(labeled);
                            setSelectedNotaIndex(0);
                            setSelectedNota(labeled[0]);
                        }}
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
                        onClose={() => { setSelectedNota(null); setAvailableNotas([]); setSelectedNotaIndex(0); setDivergenceReasons([]); }}
                        onProcessar={() => { }}
                        onToggleItem={() => { }}
                        onToggleAll={() => { }}
                        readOnly={true}
                        divergenceAlert={divergenceReasons.length > 0 ? divergenceReasons : null}
                    />
                </div>
            )}
        </div>
    );
};

export default UnitizadoresPage;
