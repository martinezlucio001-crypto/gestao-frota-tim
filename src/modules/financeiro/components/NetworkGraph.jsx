import React, { useMemo } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Save, Check } from 'lucide-react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, appId } from '../../../lib/firebase';

// --- CUSTOM NODES ---
// Círculo customizado para o gráfico
const CustomCircleNode = ({ data }) => {
    // Dimensionar o nó baseado no valor (mínimo 60, máximo 200)
    // Mas de forma simples, vamos apenas usar uma escala logarítmica ou um tamanho fixo por nível se for muito complexo.
    // Vamos usar o radius que o criador das nodes.
    const size = data.size || 80;

    // Cores por nível
    const bgColors = {
        'N1': 'bg-indigo-600 border-indigo-200 text-white',
        'N2': 'bg-emerald-500 border-emerald-200 text-white',
        'N3': 'bg-amber-500 border-amber-200 text-white',
        'N4': 'bg-slate-500 border-slate-200 text-white',
        'DESPESA': 'bg-rose-50 border-rose-200 text-rose-700'
    };

    const currentClass = bgColors[data.type] || 'bg-slate-200';

    const textSizeClass =
        data.type === 'N1' ? 'text-3xl sm:text-4xl' :
            data.type === 'N2' ? 'text-xl sm:text-2xl' :
                data.type === 'N3' ? 'text-sm sm:text-base' :
                    data.type === 'N4' ? 'text-[10px] sm:text-xs' :
                        'text-xs sm:text-sm';

    return (
        <div
            style={{ width: size, height: size }}
            className={`relative rounded-full border-4 flex items-center justify-center shadow-lg transition-transform hover:scale-105 group cursor-pointer ${currentClass} font-bold text-center p-4`}
        >
            <Handle type="target" position={Position.Top} className="opacity-0" />

            <div className="flex flex-col items-center justify-center overflow-hidden w-full h-full">
                <span className={`${textSizeClass} leading-tight line-clamp-3 max-w-full`}>{data.label}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
};

const nodeTypes = {
    customCircle: CustomCircleNode,
};

// Direção do Layout: Top to Bottom (TB)
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configurar o espaçamento (ranksep é o vertical entre N1 e N2, nodesep é o horizontal entre elementos do mesmo nível)
    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 150, // Espaço horizontal entre nós vizinhos
        ranksep: 200, // Espaço vertical entre as "camadas" (Raiz -> Filhos)
        align: 'UL' // Alinhamento para garantir distribuição consistente
    });

    nodes.forEach((node) => {
        // Definimos o width/height para o algoritmo Dagre saber o tamanho
        dagreGraph.setNode(node.id, { width: node.data.size, height: node.data.size });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        // Centralizar o nó (dagre retorna x,y do topo esquerdo, então ajustamos pro centro baseado no tamanho dele)
        node.targetPosition = Position.Top;
        node.sourcePosition = Position.Bottom;

        node.position = {
            x: nodeWithPosition.x - node.data.size / 2,
            y: nodeWithPosition.y - node.data.size / 2,
        };

        return node;
    });

    return { nodes, edges };
};


export default function NetworkGraph({ centrosCusto = [], despesas = [], dateRange, onEditNode, onAddChildNode }) {

    // Filtrar despesas pelo periodo selecionado (como no dashboard)
    const filteredDespesas = useMemo(() => {
        return despesas.filter(d => {
            const date = (d.dataEmissao || d.dataVencimento || d.dataPagamento || d.data)?.substring(0, 10);
            if (!date) return false;
            if (dateRange && (date < dateRange.start || date > dateRange.end)) return false;
            return true;
        });
    }, [despesas, dateRange]);

    const [isSavingLayout, setIsSavingLayout] = React.useState(false);
    const [layoutSaved, setLayoutSaved] = React.useState(false);

    // Context Menu state
    const [contextMenu, setContextMenu] = React.useState(null);

    const { initialNodes, initialEdges } = useMemo(() => {
        const rawNodes = [];
        const rawEdges = [];

        // Calcular os totais a partir das despesas Rateadas
        const totalsMap = {}; // centroId -> Number
        filteredDespesas.forEach(d => {
            if (d.rateio) {
                d.rateio.forEach(r => {
                    if (!totalsMap[r.centroCustoId]) totalsMap[r.centroCustoId] = 0;
                    totalsMap[r.centroCustoId] += Number(r.valorRateado || 0);
                });
            }
        });

        // Mas e se um N2 manda para N1? O valor do N2 compõe o N1?
        // SIM. Então o total real do N1 é a soma das despesas dele + a proporção das despesas do N2!
        // Para simplificar a visualização, mostramos o total real rateado que DE FATO caiu naquele nó.
        // Então, ao inves de fazer calculos complexos em cascata de rateio, como a despesa ja joga o rateio pro N2 ou pro N1, e o N2 depois joga pro N1... 
        // Wait. In the despesa creation, the user selects a "Centro de Custo" (which can be N1 or N2).
        // If they select an N2, the money flows to N2, and logically N2 flows to N1 based on N2's `rateio` config.
        // If they select N1 directly, the money flows to N1.
        // So the N1 total = direct expenses + proportional expenses from connected N2s.

        const n1s = centrosCusto.filter(c => c.tipo === 'N1');
        const n2s = centrosCusto.filter(c => c.tipo === 'N2');
        const n3s = centrosCusto.filter(c => c.tipo === 'N3');
        const n4s = centrosCusto.filter(c => c.tipo === 'N4');

        // Mapeamento extra: N2 totals already calculated from totalsMap.
        const calculatedTotals = {};
        centrosCusto.forEach(c => calculatedTotals[c.id] = (totalsMap[c.id] || 0));

        // Propagar em cascata: N4 -> N3 -> N2 -> N1
        const propagateTotals = (list) => {
            list.forEach(node => {
                const total = calculatedTotals[node.id] || 0;
                if (node.rateio && total > 0) {
                    node.rateio.forEach(r => {
                        const pid = r.parentId || r.n1Id;
                        if (pid) {
                            const toAdd = total * (Number(r.percentagem) / 100);
                            if (!calculatedTotals[pid]) calculatedTotals[pid] = 0;
                            calculatedTotals[pid] += toAdd;
                        }
                    });
                }
            });
        };

        propagateTotals(n4s);
        propagateTotals(n3s);
        propagateTotals(n2s);

        // Helper para tamanho (escala de 50 a 160)
        const getScaleSize = (val) => {
            if (val <= 0) return 60;
            // Arbitrary scale just for visuals 
            const maxVal = Math.max(...Object.values(calculatedTotals), 1);
            const ratio = val / maxVal;
            return 60 + (ratio * 100); // min 60, max 160
        };

        // Construindo Nodes N1
        n1s.forEach(n1 => {
            rawNodes.push({
                id: `N1_${n1.id}`,
                type: 'customCircle',
                position: n1.position || { x: 0, y: 0 }, // Usará posição salva se existir, senão 0,0 para Dagre calcular
                data: {
                    label: n1.nome,
                    value: calculatedTotals[n1.id] || 0,
                    type: 'N1',
                    size: getScaleSize(calculatedTotals[n1.id] || 0) * 5,
                    rateios: [],
                    dbId: n1.id,
                    fullData: n1,
                    hasSavedPosition: !!n1.position,
                    savedPosition: n1.position
                },
            });
        });

        const buildNodesAndEdges = (nodesList, typeStr, scaleMultiplier, parentList, parentTypeStr) => {
            nodesList.forEach(n => {
                const rateiosInfo = [];
                if (n.rateio) {
                    n.rateio.forEach(r => {
                        const pid = r.parentId || r.n1Id;
                        const parent = parentList.find(p => p.id === pid);
                        if (parent) {
                            rateiosInfo.push({ nome: parent.nome, pct: r.percentagem });
                            rawEdges.push({
                                id: `e_${pid}_${n.id}`,
                                source: `${parentTypeStr}_${pid}`,
                                target: `${typeStr}_${n.id}`,
                                animated: true,
                                style: { stroke: '#94a3b8', strokeWidth: 2 }
                            });
                        }
                    });
                }

                rawNodes.push({
                    id: `${typeStr}_${n.id}`,
                    type: 'customCircle',
                    position: n.position || { x: 0, y: 0 },
                    data: {
                        label: n.nome,
                        value: calculatedTotals[n.id] || 0,
                        type: typeStr,
                        size: getScaleSize(calculatedTotals[n.id] || 0) * scaleMultiplier,
                        rateios: rateiosInfo,
                        dbId: n.id,
                        fullData: n,
                        hasSavedPosition: !!n.position,
                        savedPosition: n.position
                    }
                });
            });
        };

        buildNodesAndEdges(n2s, 'N2', 3.2, n1s, 'N1');
        buildNodesAndEdges(n3s, 'N3', 2, n2s, 'N2');
        buildNodesAndEdges(n4s, 'N4', 1.2, n3s, 'N3');

        // Construindo Nodes Despesas (Apenas aglomerando para nao poluir se forem muitas?)
        // A regra diz "Base: Círculos ainda menores representando as Despesas"
        // Faremos círculos pra cada despesa no range.

        // Se forem muitas despesas, o grafico pode explodir. Limitarei ao top 20 para visualização, 
        // ou agruparei por categoria. Mas a regra pede por despesa.
        const topDespesas = [...filteredDespesas].sort((a, b) => b.valor - a.valor).slice(0, 30); // Max 30 para nao travar.

        topDespesas.forEach(d => {
            const rateiosInfo = [];
            // Despesa liga pra qual centro? 
            if (d.rateio) {
                d.rateio.forEach(r => {
                    const parentCentro = centrosCusto.find(c => c.id === r.centroCustoId);
                    if (parentCentro) {
                        rateiosInfo.push({ nome: parentCentro.nome, pct: r.percentagem });

                        const pType = parentCentro.tipo; // N1 | N2 | N3 | N4
                        const parentNodeId = `${pType}_${parentCentro.id}`;

                        // Edge do Centro(Pai) -> Despesa(Filho) 
                        rawEdges.push({
                            id: `e_${parentNodeId}_d_${d.id}`,
                            source: parentNodeId,
                            target: `D_${d.id}`,
                            animated: true,
                            style: { stroke: '#e2e8f0', strokeWidth: 1.5 }
                        });
                    }
                });
            }

            rawNodes.push({
                id: `D_${d.id}`,
                type: 'customCircle',
                data: {
                    label: d.descricao,
                    value: d.valor || 0,
                    type: 'DESPESA',
                    size: 150, // Tamanho fixo menor pra despesas (50 * 3)
                    rateios: rateiosInfo
                }
            });
        });

        // Após construir todos os nodes e edges, passamos pelo cálculo do Dagre
        // para aqueles que NÃO têm posição salva. Se tiver posição salva, retiramos do Dagre?
        // Se passarmos tudo pelo Dagre, ele recorta quem não tem rank.
        // O ideal é passar apenas os que NÃO tem posição salva para o Dagre organizar.
        // Mas se tirarmos os N1 do Dagre, ele não saberá como conectar N2 nas posições relativas.
        // Então rodamos o Dagre em todo mundo para obter "uma estrutura base inteligente".
        const layouted = getLayoutedElements(rawNodes, rawEdges);

        const layoutedNodes = layouted.nodes.map(node => {
            // Se o nó já tem posição salva (N1 ou N2) vinda do Banco de Dados, usamos a cópia armazenada no data
            if (node.data.hasSavedPosition && node.data.savedPosition) {
                node.position = { ...node.data.savedPosition };
            }
            return node;
        });

        return { initialNodes: layoutedNodes, initialEdges: layouted.edges };
    }, [centrosCusto, filteredDespesas]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const [tooltip, setTooltip] = React.useState(null);

    const onNodeMouseEnter = React.useCallback((event, node) => {
        if (contextMenu) return; // Não mostra tooltip se menu estiver aberto
        setTooltip({
            data: node.data,
            x: event.clientX,
            y: event.clientY
        });
    }, [contextMenu]);

    const onNodeMouseMove = React.useCallback((event, node) => {
        if (contextMenu) return;
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
    }, [contextMenu]);

    const onNodeMouseLeave = React.useCallback(() => {
        setTooltip(null);
    }, []);

    const onPaneClick = React.useCallback(() => {
        setContextMenu(null);
    }, []);

    const onNodeClick = React.useCallback((event, node) => {
        if (node.data.type === 'DESPESA') return; // Apenas Centros de Custo importam
        setTooltip(null); // Remove tooltip

        // Menu at right click or left click as defined in requirements:
        // "ao clicar sobre um centro de custos com o botão esquerdo do mouse"
        event.preventDefault();
        event.stopPropagation();

        const canAddChild = node.data.type !== 'N4'; // Não pode ter filho se já é bisneto (N4)

        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            nodeData: node.data,
            canAddChild
        });
    }, []);

    // Se os dados mudarem, dar rebuild
    React.useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    if (initialNodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                <p className="text-slate-400 font-medium">Cadastre Centros de Custos e/ou Lance Despesas para ver a Hierarquia.</p>
            </div>
        );
    }

    const handleSaveLayout = async () => {
        setIsSavingLayout(true);
        try {
            const batch = writeBatch(db);
            let hasChanges = false;

            nodes.forEach(node => {
                // Apenas salvar se for N1 ou N2 (pois N3/Despesa é efêmero)
                if ((node.data.type === 'N1' || node.data.type === 'N2') && node.data.dbId) {
                    const docRef = doc(db, `artifacts/${appId}/centrosCusto`, node.data.dbId);
                    batch.update(docRef, { position: { x: node.position.x, y: node.position.y } });
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                await batch.commit();
                setLayoutSaved(true);
                setTimeout(() => setLayoutSaved(false), 3000);
            }
        } catch (error) {
            console.error("Erro ao salvar posições do layout:", error);
            alert("Erro ao salvar posições da estrutura.");
        } finally {
            setIsSavingLayout(false);
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Action Bar Overlay */}
            <div className="absolute top-4 right-4 z-[50] flex items-center gap-2">
                <button
                    onClick={handleSaveLayout}
                    disabled={isSavingLayout}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all
                        ${layoutSaved
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
                        }
                    `}
                >
                    {isSavingLayout ? (
                        <>Salvando...</>
                    ) : layoutSaved ? (
                        <><Check size={16} /> Estrutura Salva</>
                    ) : (
                        <><Save size={16} className="text-indigo-600" /> Salvar Estrutura</>
                    )}
                </button>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseMove={onNodeMouseMove}
                onNodeMouseLeave={onNodeMouseLeave}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onClick={onPaneClick}
                fitView
                minZoom={0.1}
                maxZoom={1.5}
                attributionPosition="bottom-right"
            >
                <Background color="#cbd5e1" gap={30} size={1} />
                <Controls showInteractive={false} />
            </ReactFlow>

            {/* Global Tooltip rendering on top of everything via fixed positioning */}
            {tooltip && (
                <div
                    className="fixed bg-slate-800 text-white p-4 rounded-2xl text-xs w-56 shadow-2xl pointer-events-none z-[9999] transition-opacity animate-in fade-in"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y + 20,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <p className="font-bold text-base mb-1">{tooltip.data.label}</p>
                    <p className="opacity-90 mt-1">Total: <span className="font-bold text-emerald-400">{Number(tooltip.data.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>

                    {tooltip.data.rateios && tooltip.data.rateios.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-600">
                            {tooltip.data.rateios.map((r, i) => (
                                <p key={i} className="text-[11px] flex justify-between items-center bg-slate-700/50 px-2 py-1 rounded mb-1">
                                    <span className="truncate max-w-[130px]" title={r.nome}>{r.nome}</span>
                                    <span className="font-black bg-slate-900 px-1.5 py-0.5 rounded text-white">{r.pct}%</span>
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Context Menu flutuante */}
            {contextMenu && (
                <div
                    className="fixed bg-white border border-slate-200 p-2 rounded-xl w-48 shadow-2xl z-[10000] animate-in fade-in zoom-in-95 flex flex-col gap-1"
                    style={{
                        left: contextMenu.x + 10,
                        top: contextMenu.y + 10,
                    }}
                >
                    <div className="px-2 py-1.5 border-b border-slate-100 mb-1 pointer-events-none">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{contextMenu.nodeData.label}</span>
                    </div>

                    <button
                        onClick={() => {
                            if (onEditNode) onEditNode(contextMenu.nodeData.fullData);
                            setContextMenu(null);
                        }}
                        className="text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors w-full"
                    >
                        Editar
                    </button>

                    {contextMenu.canAddChild && (
                        <button
                            onClick={() => {
                                if (onAddChildNode) onAddChildNode(contextMenu.nodeData.fullData);
                                setContextMenu(null);
                            }}
                            className="text-left px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors w-full"
                        >
                            Adicionar Filho
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
