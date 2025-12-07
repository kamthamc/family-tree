import { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    Background,
    Position,
    type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Relationship, type Person } from '../../api';
import PersonNode from './PersonNode';
import UnionNode from './UnionNode';
import BracketEdge from './BracketEdge';
import EditPersonModal from '../EditPersonModal';
import EditRelationshipModal from '../EditRelationshipModal';
import RelationshipFinderModal from '../RelationshipFinderModal';
import PersonQuickView from '../PersonQuickView';
import Dashboard from '../Dashboard/Dashboard';
import TreeControls, { type FilterState } from './TreeControls';
import { ReactFlowProvider } from '@xyflow/react';
import ColoredSectionsBackground from './ColoredSectionsBackground';

const nodeTypes = {
    person: PersonNode,
    union: UnionNode,
};

const edgeTypes = {
    bracket: BracketEdge,
};

const nodeWidth = 200;
const nodeHeight = 80;
const unionNodeSize = 20;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 120,
        nodesep: 30, // Tighter spacing for partners
        edgesep: 10,
        marginx: 50,
        marginy: 50
    });

    // Add all nodes to dagre with their sizes
    nodes.forEach((node) => {
        if (node.type === 'union') {
            dagreGraph.setNode(node.id, { width: unionNodeSize, height: unionNodeSize });
        } else {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        }
    });

    // Add edges with proper constraints
    edges.forEach((edge) => {
        const isSpouseEdge = edge.data?.isSpouseEdge;
        const isParentToUnion = edge.target.includes('union-');
        const isUnionToChild = edge.source.includes('union-');

        if (isSpouseEdge) {
            // Strong weight to keep spouses together
            dagreGraph.setEdge(edge.source, edge.target, {
                minlen: 1,
                weight: 50
            });
        } else if (isParentToUnion) {
            // Parent to union: minimal separation
            dagreGraph.setEdge(edge.source, edge.target, {
                minlen: 1,
                weight: 20
            });
        } else if (isUnionToChild) {
            // Union to child: normal hierarchy
            dagreGraph.setEdge(edge.source, edge.target, {
                minlen: 1,
                weight: 1
            });
        } else {
            // Other edges
            dagreGraph.setEdge(edge.source, edge.target, {
                minlen: 1,
                weight: 1
            });
        }
    });

    dagre.layout(dagreGraph);

    // Apply positions from dagre
    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        const width = node.type === 'union' ? unionNodeSize : nodeWidth;
        const height = node.type === 'union' ? unionNodeSize : nodeHeight;

        return {
            ...node,
            targetPosition: direction === 'TB' ? Position.Top : Position.Left,
            sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
            position: {
                x: nodeWithPosition.x - width / 2,
                y: nodeWithPosition.y - height / 2,
            },
        };
    });

    // Post-process: Force spouses to be adjacent and align union nodes
    const nodeMap = new Map(layoutedNodes.map(n => [n.id, n]));

    // Identify spouse pairs for colored sections
    const spousePairs: Array<{ p1: Node, p2: Node, union: Node }> = [];

    layoutedNodes.forEach(node => {
        if (node.type === 'union') {
            const parts = node.id.replace('union-', '').split('-');
            if (parts.length === 2) {
                const p1 = nodeMap.get(parts[0]);
                const p2 = nodeMap.get(parts[1]);

                if (p1 && p2) {
                    // Force spouses to be on same Y level
                    const avgY = (p1.position.y + p2.position.y) / 2;
                    p1.position.y = avgY;
                    p2.position.y = avgY;

                    // Ensure spouses are adjacent with minimal gap
                    const leftNode = p1.position.x < p2.position.x ? p1 : p2;
                    const rightNode = leftNode === p1 ? p2 : p1;

                    // Force tight spacing: 25px gap between partners
                    const desiredGap = 25;
                    const midX = (leftNode.position.x + rightNode.position.x + nodeWidth) / 2;
                    leftNode.position.x = midX - nodeWidth - desiredGap / 2;
                    rightNode.position.x = midX + desiredGap / 2;

                    // Position union node exactly between spouses
                    const centerX = (leftNode.position.x + rightNode.position.x + nodeWidth) / 2;
                    node.position.x = centerX - unionNodeSize / 2;
                    node.position.y = avgY + nodeHeight / 2 - unionNodeSize / 2;

                    // Store spouse pair for section rendering
                    spousePairs.push({ p1: leftNode, p2: rightNode, union: node });
                }
            }
        }
    });

    // Update edges for cleaner routing
    const layoutedEdges = edges.map(edge => {
        if (edge.data?.isSpouseEdge) {
            return { ...edge, type: 'straight', style: { ...edge.style, strokeDasharray: '5 5' } };
        }

        // Parent to union: hidden
        if (edge.target.includes('union-')) {
            return { ...edge, hidden: true };
        }

        // Union to child: use bracket edge for shared bus lines
        if (edge.source.includes('union-')) {
            return { ...edge, type: 'bracket', style: { stroke: '#9ca3af', strokeWidth: 2 } };
        }

        return edge;
    });

    return { nodes: layoutedNodes, edges: layoutedEdges, spousePairs };
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

// Calculate generation depth (distance from root) for proper layering
const calculateGenerationDepth = (people: Person[], relationships: Relationship[]) => {
    const depthMap = new Map<string, number>();
    const childToParents = new Map<string, string[]>();

    // Build parent map
    relationships.filter(r => r.type === 'parent').forEach(rel => {
        if (!childToParents.has(rel.toPersonId)) {
            childToParents.set(rel.toPersonId, []);
        }
        childToParents.get(rel.toPersonId)!.push(rel.fromPersonId);
    });

    // Find root nodes (people with no parents)
    const roots = people.filter(p => !childToParents.has(p.id));

    // BFS to assign depths
    const queue: Array<{ id: string, depth: number }> = roots.map(r => ({ id: r.id, depth: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        depthMap.set(id, depth);

        // Find children
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

export default function FamilyTree() {
    const { data: people } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });
    const { data: relationships } = useQuery({ queryKey: ['relationships'], queryFn: api.getRelationships });

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Track spouse pairs for colored sections
    const [spousePairs, setSpousePairs] = useState<Array<{ p1Id: string, p2Id: string, unionId: string }>>([]);

    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [quickViewPerson, setQuickViewPerson] = useState<{ person: Person; position: { x: number; y: number } } | null>(null);
    const [connectParams, setConnectParams] = useState<Connection | null>(null);
    const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
    const [filteredNodeIds, setFilteredNodeIds] = useState<Set<string> | null>(null);
    const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
    const [showRelationshipFinder, setShowRelationshipFinder] = useState(false);

    // Escape key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEditingPerson(null);
                setQuickViewPerson(null);
                setConnectParams(null);
                setEditingRelationship(null);
                setShowRelationshipFinder(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Graph Construction Logic
    useEffect(() => {
        if (!people || !relationships) return;

        let generatedNodes: Node[] = [];
        let generatedEdges: Edge[] = [];

        // Calculate generation depths
        const depthMap = calculateGenerationDepth(people, relationships);

        // 1. Create Person Nodes
        generatedNodes = people.map((p) => {
            const gen = getGeneration(p.birthDate);
            const depth = depthMap.get(p.id) ?? 0;

            return {
                id: p.id,
                type: 'person',
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

        // 2. Process Relationships to create Union Nodes
        // We need to group parents who have children together, OR spouses
        const spouseRelationships = relationships.filter(r => r.type === 'spouse' || r.type === 'divorced');
        const processedSpousePairs = new Set<string>();

        // Map to store which union node a person belongs to (to connect children)
        const personToUnionMap: Record<string, string> = {};

        spouseRelationships.forEach(rel => {
            const pairId = [rel.fromPersonId, rel.toPersonId].sort().join('-');
            if (processedSpousePairs.has(pairId)) return;
            processedSpousePairs.add(pairId);

            const unionId = `union-${pairId}`;

            // Create Union Node
            generatedNodes.push({
                id: unionId,
                type: 'union',
                data: { label: rel.type === 'spouse' ? '💍' : '💔' },
                position: { x: 0, y: 0 },
            });

            // Layout dependency edges (Parent -> Union) - HIDDEN
            // We keep these so Dagre places the Union Node in the hierarchy (usually below),
            // but we will manually move it up to be between parents.
            generatedEdges.push({
                id: `e-${rel.fromPersonId}-${unionId}`,
                source: rel.fromPersonId,
                target: unionId,
                type: 'smoothstep',
                hidden: true,
                animated: false,
            });

            generatedEdges.push({
                id: `e-${rel.toPersonId}-${unionId}`,
                source: rel.toPersonId,
                target: unionId,
                type: 'smoothstep',
                hidden: true,
                animated: false,
            });

            // Visual direct edge between spouses
            generatedEdges.push({
                id: `spouse-${pairId}`,
                source: rel.fromPersonId,
                target: rel.toPersonId,
                type: 'smoothstep',
                style: { stroke: '#ec4899', strokeWidth: 2, strokeDasharray: '5 5' },
                sourceHandle: 'right-source', // Optimistic, will fix in post-layout if needed
                targetHandle: 'left-target',
                animated: false,
                data: { isSpouseEdge: true }
            });

            personToUnionMap[rel.fromPersonId] = unionId;
            personToUnionMap[rel.toPersonId] = unionId;
        });

        // 3. Process Parent-Child Relationships
        // We want to connect the Union Node (if exists) -> Child
        // If single parent, connect Parent -> Child directly.

        // Group children by parents
        const childrenMap: Record<string, string[]> = {}; // childId -> [parentIds]

        relationships.filter(r => r.type === 'parent').forEach(rel => {
            if (!childrenMap[rel.toPersonId]) childrenMap[rel.toPersonId] = [];
            childrenMap[rel.toPersonId].push(rel.fromPersonId);
        });

        Object.keys(childrenMap).forEach(childId => {
            const parents = childrenMap[childId];
            if (parents.length === 2) {
                // Try to find the union node for these two parents
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
                        type: 'smoothstep',
                        style: { stroke: '#9ca3af', strokeWidth: 2 },
                        animated: false,
                    });
                } else {
                    // Fallback
                    parents.forEach(pid => {
                        generatedEdges.push({
                            id: `e-${pid}-${childId}`,
                            source: pid,
                            target: childId,
                            type: 'smoothstep',
                            style: { stroke: '#9ca3af', strokeWidth: 2 },
                        });
                    });
                }
            } else {
                // Single parent
                parents.forEach(pid => {
                    generatedEdges.push({
                        id: `e-${pid}-${childId}`,
                        source: pid,
                        target: childId,
                        type: 'smoothstep',
                        style: { stroke: '#9ca3af', strokeWidth: 2 },
                    });
                });
            }
        });


        const { nodes: layoutedNodes, edges: layoutedEdges, spousePairs } = getLayoutedElements(
            generatedNodes,
            generatedEdges,
            direction
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Convert spouse pairs to ID format for ColoredSectionsBackground
        const pairIds = (spousePairs || []).map(pair => ({
            p1Id: pair.p1.id,
            p2Id: pair.p2.id,
            unionId: pair.union.id
        }));
        setSpousePairs(pairIds);
    }, [people, relationships, direction, filteredNodeIds]);

    const queryClient = useQueryClient();

    const createRelMutation = useMutation({
        mutationFn: api.createRelationship,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['relationships'] });
        },
    });

    const onConnect = useCallback(
        (params: Connection) => {
            if (params.source && params.target) {
                setConnectParams(params);
            }
        },
        []
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (node.type !== 'person') return;
        setQuickViewPerson({
            person: node.data.person as Person,
            position: { x: event.clientX, y: event.clientY }
        });
    }, []);

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
        // Find if this edge corresponds to a real relationship
        // Our generated edges might be virtual (union -> child).
        // Real rel logic:
        // If edge is normal ID?
        const rel = relationships?.find(r => r.id === edge.id); // Direct match
        if (rel) {
            setEditingRelationship(rel);
            return;
        }

        // If virtual edge? Maybe unlikely to click perfectly.
    }, [relationships]);

    const handleFocus = useCallback((personId: string, mode: 'ancestors' | 'descendants' | 'all') => {
        if (mode === 'all') {
            setFilteredNodeIds(null);
            setEditingPerson(null);
            return;
        }

        if (!relationships) return;

        const ids = new Set<string>();
        ids.add(personId);

        const traverse = (currentId: string, direction: 'up' | 'down') => {
            const relevantRels = relationships.filter(r =>
                direction === 'up' ? r.toPersonId === currentId : r.fromPersonId === currentId
            );
            relevantRels.forEach(rel => {
                const nextId = direction === 'up' ? rel.fromPersonId : rel.toPersonId;
                if (!ids.has(nextId)) {
                    ids.add(nextId);
                    traverse(nextId, direction);
                }
            });
        };

        traverse(personId, mode === 'ancestors' ? 'up' : 'down');
        setFilteredNodeIds(ids);
        setEditingPerson(null);
    }, [relationships]);

    const [filters, setFilters] = useState<FilterState>({
        labels: [],
        status: 'all',
        yearRange: { start: null, end: null },
    });

    const isPersonVisible = useCallback((person: Person) => {
        // Status Filter
        if (filters.status === 'living' && person.deathDate) return false;
        if (filters.status === 'deceased' && !person.deathDate) return false;

        // Year Filter
        if (filters.yearRange.start || filters.yearRange.end) {
            const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
            if (birthYear) {
                if (filters.yearRange.start && birthYear < filters.yearRange.start) return false;
                if (filters.yearRange.end && birthYear > filters.yearRange.end) return false;
            } else {
                // Determine behavior for missing dates? Hide? Or Show? 
                // Usually filters imply exclusion if criteria not met.
                return false;
            }
        }

        // Label Filter
        if (filters.labels.length > 0) {
            const personLabels = person.attributes?.labels || [];
            // If selecting multiple labels, usually "has any" or "has all"? 
            // "Has any" is common for inclusive filtering.
            const hasMatch = filters.labels.some((l: string) => personLabels.includes(l));
            if (!hasMatch) return false;
        }

        return true;
    }, [filters]);

    useEffect(() => {
        setNodes((nds) => nds.map((node) => {
            let isVisible = true;

            if (node.type === 'person') {
                const person = node.data.person as Person;

                // 1. Focus Mode Filter
                if (filteredNodeIds && !filteredNodeIds.has(node.id)) {
                    isVisible = false;
                }

                // 2. Attribute Filters
                if (isVisible && !isPersonVisible(person)) {
                    isVisible = false;
                }
            } else if (node.type === 'union') {
                // Union is hidden if both connected edges are hidden? 
                // Complex to check edges here. 
                // Simple hack: Union is always visible unless Focus Mode hides it (Focus Mode logic needs update for unions)
                // Or we rely on edges being hidden making nodes look isolated.

                // Better: If Focus Mode is active, we need to know if Union is relevant.
                // For now, let's leave Union always "visible" technically, but if edges are hidden it's just a dot.
                // Ideally we hide it.
            }

            return {
                ...node,
                hidden: !isVisible,
            };
        }));

        // Edge visibility handled by ReactFlow (connecting to hidden nodes) usually,
        // but explicit hiding is better.
        // We can just rely on nodes being hidden for now.
    }, [filteredNodeIds, filters, isPersonVisible, setNodes]);

    return (
        <ReactFlowProvider>
            <div className="h-full w-full bg-gray-900 relative">
                {filteredNodeIds && (
                    <button
                        onClick={() => setFilteredNodeIds(null)}
                        className="absolute top-20 left-4 z-20 bg-blue-600 text-white px-4 py-2 rounded shadow-lg hover:bg-blue-500"
                    >
                        Show All
                    </button>
                )}
                {editingPerson && (
                    <EditPersonModal
                        person={editingPerson}
                        onClose={() => setEditingPerson(null)}
                        onFocus={handleFocus}
                    />
                )}
                {editingRelationship && (
                    <EditRelationshipModal
                        relationship={editingRelationship}
                        onClose={() => setEditingRelationship(null)}
                    />
                )}
                <Dashboard people={people} />
                <TreeControls
                    people={people}
                    relationships={relationships}
                    onLayoutChange={() => setDirection(d => d === 'TB' ? 'LR' : 'TB')}
                    layoutDirection={direction}
                    onFindRelationship={() => setShowRelationshipFinder(true)}
                    onFilterChange={setFilters}
                    onRefreshLayout={() => {
                        // Trigger layout re-computation
                        if (nodes.length > 0) {
                            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                                nodes,
                                edges,
                                direction
                            );
                            setNodes(layoutedNodes);
                            setEdges(layoutedEdges);
                        }
                    }}
                />
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                >
                    <ColoredSectionsBackground spousePairs={spousePairs} />
                    <Background />
                </ReactFlow>

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

                {connectParams && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-80">
                            <h3 className="text-xl font-bold mb-4 text-center">Relationship Type</h3>
                            <div className="flex flex-col gap-2">
                                {['parent', 'spouse', 'divorced'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            if (connectParams.source && connectParams.target) {
                                                createRelMutation.mutate({
                                                    fromPersonId: connectParams.source,
                                                    toPersonId: connectParams.target,
                                                    type,
                                                });
                                                setEdges((eds) => addEdge(connectParams, eds));
                                            }
                                            setConnectParams(null);
                                        }}
                                        className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-600 capitalize font-medium transition-colors"
                                    >
                                        {type}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setConnectParams(null)}
                                    className="w-full py-2 mt-2 text-gray-400 hover:text-white text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ReactFlowProvider>
    );
}
