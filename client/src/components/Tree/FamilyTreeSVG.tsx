import { useCallback, useEffect, useState, useRef } from 'react';
import dagre from 'dagre';
import { useQuery } from '@tanstack/react-query';
import { api, type Relationship, type Person } from '../../api';
import EditPersonModal from '../EditPersonModal';
import EditRelationshipModal from '../EditRelationshipModal';
import RelationshipFinderModal from '../RelationshipFinderModal';
import PersonQuickView from '../PersonQuickView';
import Dashboard from '../Dashboard/Dashboard';
import TreeControls, { type FilterState } from './TreeControls';

const nodeWidth = 200;
const nodeHeight = 80;
const unionNodeSize = 20;

interface LayoutNode {
    id: string;
    type: 'person' | 'union';
    position: { x: number; y: number };
    data: any;
}

interface LayoutEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    hidden?: boolean;
    data?: any;
}

interface SpousePair {
    p1: LayoutNode;
    p2: LayoutNode;
    union: LayoutNode;
}

const getLayoutedElements = (nodes: LayoutNode[], edges: LayoutEdge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 120,
        nodesep: 30,
        edgesep: 10,
        marginx: 50,
        marginy: 50
    });

    nodes.forEach((node) => {
        if (node.type === 'union') {
            dagreGraph.setNode(node.id, { width: unionNodeSize, height: unionNodeSize });
        } else {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        }
    });

    edges.forEach((edge) => {
        const isSpouseEdge = edge.data?.isSpouseEdge;
        const isParentToUnion = edge.target.includes('union-');

        if (isSpouseEdge) {
            dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 50 });
        } else if (isParentToUnion) {
            dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 20 });
        } else {
            dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 1 });
        }
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const width = node.type === 'union' ? unionNodeSize : nodeWidth;
        const height = node.type === 'union' ? unionNodeSize : nodeHeight;

        return {
            ...node,
            position: {
                x: nodeWithPosition.x - width / 2,
                y: nodeWithPosition.y - height / 2,
            },
        };
    });

    const nodeMap = new Map(layoutedNodes.map(n => [n.id, n]));
    const spousePairs: SpousePair[] = [];

    layoutedNodes.forEach(node => {
        if (node.type === 'union') {
            const parts = node.id.replace('union-', '').split('-');
            if (parts.length === 2) {
                const p1 = nodeMap.get(parts[0]);
                const p2 = nodeMap.get(parts[1]);

                if (p1 && p2) {
                    const avgY = (p1.position.y + p2.position.y) / 2;
                    p1.position.y = avgY;
                    p2.position.y = avgY;

                    const leftNode = p1.position.x < p2.position.x ? p1 : p2;
                    const rightNode = leftNode === p1 ? p2 : p1;

                    const desiredGap = 25;
                    const midX = (leftNode.position.x + rightNode.position.x + nodeWidth) / 2;
                    leftNode.position.x = midX - nodeWidth - desiredGap / 2;
                    rightNode.position.x = midX + desiredGap / 2;

                    const centerX = (leftNode.position.x + rightNode.position.x + nodeWidth) / 2;
                    node.position.x = centerX - unionNodeSize / 2;
                    node.position.y = avgY + nodeHeight / 2 - unionNodeSize / 2;

                    spousePairs.push({ p1: leftNode, p2: rightNode, union: node });
                }
            }
        }
    });

    return { nodes: layoutedNodes, edges, spousePairs };
};

const getGeneration = (birthDate: string | null) => {
    if (!birthDate) return null;
    const year = new Date(birthDate).getFullYear();
    if (isNaN(year)) return null;

    if (year >= 2013) return { label: 'Gen Alpha', color: '#f472b6' };
    if (year >= 1997) return { label: 'Gen Z', color: '#a78bfa' };
    if (year >= 1981) return { label: 'Millennial', color: '#3b82f6' };
    if (year >= 1965) return { label: 'Gen X', color: '#10b981' };
    if (year >= 1946) return { label: 'Boomer', color: '#f59e0b' };
    if (year >= 1928) return { label: 'Silent', color: '#6b7280' };
    if (year >= 1901) return { label: 'Greatest', color: '#9ca3af' };
    return { label: 'Lost', color: '#d1d5db' };
};

const calculateGenerationDepth = (people: Person[], relationships: Relationship[]) => {
    const depthMap = new Map<string, number>();
    const childToParents = new Map<string, string[]>();

    relationships.filter(r => r.type === 'parent').forEach(rel => {
        if (!childToParents.has(rel.toPersonId)) {
            childToParents.set(rel.toPersonId, []);
        }
        childToParents.get(rel.toPersonId)!.push(rel.fromPersonId);
    });

    const roots = people.filter(p => !childToParents.has(p.id));
    const queue: Array<{ id: string, depth: number }> = roots.map(r => ({ id: r.id, depth: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        depthMap.set(id, depth);

        relationships
            .filter(r => r.type === 'parent' && r.fromPersonId === id)
            .forEach(rel => {
                if (!visited.has(rel.toPersonId)) {
                    queue.push({ id: rel.toPersonId, depth: depth + 1 });
                }
            });
    }

    return depthMap;
};

export default function FamilyTreeSVG() {
    const { data: people } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });
    const { data: relationships } = useQuery({ queryKey: ['relationships'], queryFn: api.getRelationships });

    const [nodes, setNodes] = useState<LayoutNode[]>([]);
    const [edges, setEdges] = useState<LayoutEdge[]>([]);
    const [spouseSections, setSpouseSections] = useState<SpousePair[]>([]);

    const [pan, setPan] = useState({ x: 400, y: 100 });
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const svgRef = useRef<SVGSVGElement>(null);

    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [quickViewPerson, setQuickViewPerson] = useState<{ person: Person; position: { x: number; y: number } } | null>(null);
    const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
    const [filteredNodeIds] = useState<Set<string> | null>(null);
    const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
    const [showRelationshipFinder, setShowRelationshipFinder] = useState(false);
    const [, setFilters] = useState<FilterState>({
        labels: [],
        status: 'all',
        yearRange: { start: null, end: null },
    });

    // Escape key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEditingPerson(null);
                setQuickViewPerson(null);
                setEditingRelationship(null);
                setShowRelationshipFinder(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Build graph
    useEffect(() => {
        if (!people || !relationships) return;

        let generatedNodes: LayoutNode[] = [];
        let generatedEdges: LayoutEdge[] = [];

        const depthMap = calculateGenerationDepth(people, relationships);

        generatedNodes = people.map((p) => {
            const gen = getGeneration(p.birthDate);
            const depth = depthMap.get(p.id) ?? 0;

            return {
                id: p.id,
                type: 'person' as const,
                data: {
                    label: p.firstName || 'Unknown',
                    person: p,
                    generationLabel: gen?.label,
                    generationColor: gen?.color,
                    generationDepth: depth
                },
                position: { x: 0, y: 0 },
            };
        });

        const spouseRelationships = relationships.filter(r => r.type === 'spouse' || r.type === 'divorced');
        const processedSpousePairs = new Set<string>();
        const personToUnionMap: Record<string, string> = {};

        spouseRelationships.forEach(rel => {
            const pairId = [rel.fromPersonId, rel.toPersonId].sort().join('-');
            if (processedSpousePairs.has(pairId)) return;
            processedSpousePairs.add(pairId);

            const unionId = `union-${pairId}`;

            generatedNodes.push({
                id: unionId,
                type: 'union',
                data: { label: rel.type === 'spouse' ? '💍' : '💔' },
                position: { x: 0, y: 0 },
            });

            generatedEdges.push({
                id: `e-${rel.fromPersonId}-${rel.toPersonId}`,
                source: rel.fromPersonId,
                target: rel.toPersonId,
                data: { isSpouseEdge: true },
            });

            personToUnionMap[rel.fromPersonId] = unionId;
            personToUnionMap[rel.toPersonId] = unionId;
        });

        const childrenMap: Record<string, string[]> = {};
        relationships.filter(r => r.type === 'parent').forEach(rel => {
            if (!childrenMap[rel.toPersonId]) childrenMap[rel.toPersonId] = [];
            childrenMap[rel.toPersonId].push(rel.fromPersonId);
        });

        Object.keys(childrenMap).forEach(childId => {
            const parents = childrenMap[childId];
            if (parents.length === 2) {
                const p1 = parents[0];
                const p2 = parents[1];
                const pairId = [p1, p2].sort().join('-');
                const unionId = `union-${pairId}`;

                const unionExists = generatedNodes.find(n => n.id === unionId);

                if (unionExists) {
                    generatedEdges.push({
                        id: `e-${unionId}-${childId}`,
                        source: unionId,
                        target: childId,
                        type: 'bracket',
                    });
                }
            }
        });

        const { nodes: layoutedNodes, edges: layoutedEdges, spousePairs } = getLayoutedElements(
            generatedNodes,
            generatedEdges,
            direction
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setSpouseSections(spousePairs);
    }, [people, relationships, direction, filteredNodeIds]);

    // Pan & Zoom handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        setZoom(z => Math.min(Math.max(0.1, z + delta), 3));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleNodeClick = (person: Person, e: React.MouseEvent) => {
        e.stopPropagation();
        setQuickViewPerson({
            person,
            position: { x: e.clientX, y: e.clientY }
        });
    };



    return (
        <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
            <Dashboard />

            <TreeControls
                people={people}
                relationships={relationships}
                onLayoutChange={() => setDirection(d => d === 'TB' ? 'LR' : 'TB')}
                layoutDirection={direction}
                onFindRelationship={() => setShowRelationshipFinder(true)}
                onFilterChange={setFilters}
                onRefreshLayout={() => {
                    // Trigger re-layout
                    setNodes([...nodes]);
                }}
            />

            <svg
                ref={svgRef}
                className="w-full h-full cursor-move"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="#374151" opacity="0.5" />
                    </pattern>
                </defs>

                <rect width="100%" height="100%" fill="url(#grid)" />

                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                    {/* Colored sections - render first (bottom layer) */}
                    {spouseSections.map((section, idx) => {
                        const { p1, p2 } = section;
                        const generationDepth = (typeof p1.data?.generationDepth === 'number' ? p1.data.generationDepth : 0);

                        const colors = [
                            { bg: '#FEE2E2', border: '#FCA5A5' },
                            { bg: '#FFEDD5', border: '#FDBA74' },
                            { bg: '#FEF3C7', border: '#FCD34D' },
                            { bg: '#DBEAFE', border: '#93C5FD' },
                            { bg: '#D1FAE5', border: '#6EE7B7' },
                        ];
                        const colorIndex = generationDepth % colors.length;
                        const color = colors[colorIndex];

                        const padding = 15;
                        const minX = Math.min(p1.position.x, p2.position.x) - padding;
                        const maxX = Math.max(p1.position.x + nodeWidth, p2.position.x + nodeWidth) + padding;
                        const minY = p1.position.y - padding;
                        const height = nodeHeight + padding * 2;
                        const width = maxX - minX;

                        return (
                            <rect
                                key={`section-${idx}`}
                                x={minX}
                                y={minY}
                                width={width}
                                height={height}
                                fill={color.bg}
                                stroke={color.border}
                                strokeWidth={2}
                                rx={8}
                                opacity={0.6}
                            />
                        );
                    })}

                    {/* Edges */}
                    {edges.filter(e => !e.hidden).map(edge => {
                        const sourceNode = nodes.find(n => n.id === edge.source);
                        const targetNode = nodes.find(n => n.id === edge.target);
                        if (!sourceNode || !targetNode) return null;

                        const sourceX = sourceNode.position.x + (sourceNode.type === 'union' ? unionNodeSize / 2 : nodeWidth / 2);
                        const sourceY = sourceNode.position.y + (sourceNode.type === 'union' ? unionNodeSize / 2 : nodeHeight);
                        const targetX = targetNode.position.x + (targetNode.type === 'union' ? unionNodeSize / 2 : nodeWidth / 2);
                        const targetY = targetNode.position.y;

                        if (edge.data?.isSpouseEdge) {
                            return (
                                <line
                                    key={edge.id}
                                    x1={sourceX}
                                    y1={sourceY - nodeHeight / 2}
                                    x2={targetX}
                                    y2={targetY + nodeHeight / 2}
                                    stroke="#9ca3af"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            );
                        }

                        if (edge.type === 'bracket') {
                            const busOffset = 40;
                            const path = `M ${sourceX},${sourceY} L ${sourceX},${sourceY + busOffset} L ${targetX},${sourceY + busOffset} L ${targetX},${targetY}`;
                            return (
                                <path
                                    key={edge.id}
                                    d={path}
                                    stroke="#9ca3af"
                                    strokeWidth={2}
                                    fill="none"
                                />
                            );
                        }

                        return (
                            <line
                                key={edge.id}
                                x1={sourceX}
                                y1={sourceY}
                                x2={targetX}
                                y2={targetY}
                                stroke="#9ca3af"
                                strokeWidth={2}
                            />
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map(node => {
                        if (node.type === 'union') {
                            return (
                                <g key={node.id} transform={`translate(${node.position.x},${node.position.y})`}>
                                    <circle
                                        cx={unionNodeSize / 2}
                                        cy={unionNodeSize / 2}
                                        r={unionNodeSize / 2}
                                        fill="#6b7280"
                                        stroke="#9ca3af"
                                        strokeWidth={2}
                                    />
                                    <text
                                        x={unionNodeSize / 2}
                                        y={unionNodeSize / 2}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize="12"
                                    >
                                        {node.data.label}
                                    </text>
                                </g>
                            );
                        }

                        const person = node.data.person;
                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.position.x},${node.position.y})`}
                                onClick={(e) => handleNodeClick(person, e)}
                                className="cursor-pointer"
                            >
                                <rect
                                    width={nodeWidth}
                                    height={nodeHeight}
                                    rx={8}
                                    fill="#1f2937"
                                    stroke={node.data.generationColor || '#4b5563'}
                                    strokeWidth={2}
                                    className="hover:fill-gray-700 transition-colors"
                                />
                                <text
                                    x={nodeWidth / 2}
                                    y={30}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="16"
                                    fontWeight="bold"
                                >
                                    {person.firstName} {person.lastName}
                                </text>
                                {person.birthDate && (
                                    <text
                                        x={nodeWidth / 2}
                                        y={50}
                                        textAnchor="middle"
                                        fill="#9ca3af"
                                        fontSize="12"
                                    >
                                        {new Date(person.birthDate).getFullYear()}
                                        {person.deathDate && ` - ${new Date(person.deathDate).getFullYear()}`}
                                    </text>
                                )}
                                {node.data.generationLabel && (
                                    <text
                                        x={nodeWidth / 2}
                                        y={68}
                                        textAnchor="middle"
                                        fill={node.data.generationColor}
                                        fontSize="10"
                                    >
                                        {node.data.generationLabel}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <button
                    onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg shadow-lg border border-gray-600"
                >
                    +
                </button>
                <button
                    onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg shadow-lg border border-gray-600"
                >
                    −
                </button>
                <button
                    onClick={() => { setZoom(1); setPan({ x: 400, y: 100 }); }}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg shadow-lg border border-gray-600 text-xs"
                >
                    Reset
                </button>
            </div>

            {showRelationshipFinder && people && relationships && (
                <RelationshipFinderModal
                    people={people}
                    relationships={relationships}
                    onClose={() => setShowRelationshipFinder(false)}
                />
            )}

            {quickViewPerson && (
                <PersonQuickView
                    person={quickViewPerson.person}
                    position={quickViewPerson.position}
                    onClose={() => setQuickViewPerson(null)}
                    onEdit={() => {
                        setEditingPerson(quickViewPerson.person);
                        setQuickViewPerson(null);
                    }}
                />
            )}

            {editingPerson && (
                <EditPersonModal
                    person={editingPerson}
                    onClose={() => setEditingPerson(null)}
                />
            )}

            {editingRelationship && (
                <EditRelationshipModal
                    relationship={editingRelationship}
                    onClose={() => setEditingRelationship(null)}
                />
            )}
        </div>
    );
}
