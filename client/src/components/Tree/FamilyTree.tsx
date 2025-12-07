import { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    Background,
    type Node,
    Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useQuery } from '@tanstack/react-query';
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
import ColoredSectionsBackground from './ColoredSectionsBackground';
import { ReactFlowProvider } from '@xyflow/react';


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

// Simple Dagre layout function
function layoutNodes(nodes: Node[], edges: Edge[], direction = 'TB') {
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

    // Add nodes to dagre
    nodes.forEach((node) => {
        const width = node.type === 'union' ? unionNodeSize : nodeWidth;
        const height = node.type === 'union' ? unionNodeSize : nodeHeight;
        dagreGraph.setNode(node.id, { width, height });
    });

    // Add edges to dagre with weights
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

    // Apply positions
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

    // Post-process: Force spouse adjacency and center union nodes
    const nodeMap = new Map(layoutedNodes.map(n => [n.id, n]));
    const spousePairs: Array<{ p1: Node, p2: Node, union: Node }> = [];

    layoutedNodes.forEach(node => {
        if (node.type === 'union') {
            const parts = node.id.replace('union-', '').split('-');
            if (parts.length === 2) {
                const p1 = nodeMap.get(parts[0]);
                const p2 = nodeMap.get(parts[1]);

                if (p1 && p2) {
                    // Align Y positions
                    const avgY = (p1.position.y + p2.position.y) / 2;
                    p1.position.y = avgY;
                    p2.position.y = avgY;

                    // Force tight spacing
                    const leftNode = p1.position.x < p2.position.x ? p1 : p2;
                    const rightNode = leftNode === p1 ? p2 : p1;
                    const desiredGap = 25;
                    const midX = (leftNode.position.x + rightNode.position.x + nodeWidth) / 2;
                    leftNode.position.x = midX - nodeWidth - desiredGap / 2;
                    rightNode.position.x = midX + desiredGap / 2;

                    // Center union node
                    const centerX = (leftNode.position.x + rightNode.position.x + nodeWidth) / 2;
                    node.position.x = centerX - unionNodeSize / 2;
                    node.position.y = avgY + nodeHeight / 2 - unionNodeSize / 2;

                    spousePairs.push({ p1: leftNode, p2: rightNode, union: node });
                }
            }
        }
    });

    return { nodes: layoutedNodes, edges, spousePairs };
}

// Calculate generation depth for coloring
function calculateGenerationDepth(people: Person[], relationships: Relationship[]) {
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
}

export default function FamilyTree() {
    const { data: people } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });
    const { data: relationships } = useQuery({ queryKey: ['relationships'], queryFn: api.getRelationships });

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [quickViewPerson, setQuickViewPerson] = useState<{ person: Person; position: { x: number; y: number } } | null>(null);
    const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
    const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
    const [showRelationshipFinder, setShowRelationshipFinder] = useState(false);
    const [spousePairs, setSpousePairs] = useState<Array<{ p1Id: string, p2Id: string, unionId: string }>>([]);
    const [filters, setFilters] = useState<FilterState>({
        labels: [],
        status: 'all',
        yearRange: { start: null, end: null },
    });

    // Build graph when data changes
    useEffect(() => {
        if (!people || !relationships) return;

        const generatedNodes: Node[] = [];
        const generatedEdges: Edge[] = [];

        const depthMap = calculateGenerationDepth(people, relationships);

        // Apply filters
        let filteredPeople = people;

        // Status filter
        if (filters.status !== 'all') {
            filteredPeople = filteredPeople.filter(p => {
                if (filters.status === 'living') return !p.deathDate;
                if (filters.status === 'deceased') return !!p.deathDate;
                return true;
            });
        }

        // Year range filter
        if (filters.yearRange.start || filters.yearRange.end) {
            filteredPeople = filteredPeople.filter(p => {
                if (!p.birthDate) return false;
                const birthYear = new Date(p.birthDate).getFullYear();
                if (filters.yearRange.start && birthYear < filters.yearRange.start) return false;
                if (filters.yearRange.end && birthYear > filters.yearRange.end) return false;
                return true;
            });
        }

        // Create person nodes
        filteredPeople.forEach((person) => {
            const depth = depthMap.get(person.id) ?? 0;

            generatedNodes.push({
                id: person.id,
                type: 'person',
                data: {
                    label: person.firstName || 'Unknown',
                    person,
                    generationDepth: depth
                },
                position: { x: 0, y: 0 },
            });
        });

        // Create union nodes and spouse edges
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
                type: 'straight',
                style: { strokeDasharray: '5 5' },
            });

            personToUnionMap[rel.fromPersonId] = unionId;
            personToUnionMap[rel.toPersonId] = unionId;
        });

        // Create parent-child edges through union nodes
        const childrenMap: Record<string, string[]> = {};
        relationships.filter(r => r.type === 'parent').forEach(rel => {
            if (!childrenMap[rel.toPersonId]) childrenMap[rel.toPersonId] = [];
            childrenMap[rel.toPersonId].push(rel.fromPersonId);
        });

        Object.keys(childrenMap).forEach(childId => {
            const parents = childrenMap[childId];
            if (parents.length === 2) {
                const pairId = parents.sort().join('-');
                const unionId = `union-${pairId}`;

                if (generatedNodes.find(n => n.id === unionId)) {
                    // Parent to union (hidden)
                    parents.forEach(parentId => {
                        generatedEdges.push({
                            id: `e-${parentId}-${unionId}`,
                            source: parentId,
                            target: unionId,
                            hidden: true,
                        });
                    });

                    // Union to child (bracket edge)
                    generatedEdges.push({
                        id: `e-${unionId}-${childId}`,
                        source: unionId,
                        target: childId,
                        type: 'bracket',
                    });
                }
            }
        });

        // Layout nodes
        const { nodes: layoutedNodes, edges: layoutedEdges, spousePairs: pairs } = layoutNodes(
            generatedNodes,
            generatedEdges,
            direction
        );

        console.log('Layout result - spouse pairs:', pairs?.length || 0, pairs);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Convert spouse pairs to ID format for ColoredSectionsBackground
        const pairIds = (pairs || []).map(pair => ({
            p1Id: pair.p1.id,
            p2Id: pair.p2.id,
            unionId: pair.union.id
        }));
        console.log('Converted spouse pair IDs:', pairIds);
        setSpousePairs(pairIds);
    }, [people, relationships, direction, filters]);



    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge(params, eds));
    }, [setEdges]);

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        if (node.type === 'person' && node.data.person) {
            const rect = (_event.target as HTMLElement).getBoundingClientRect();
            setQuickViewPerson({
                person: node.data.person as Person,
                position: { x: rect.right + 10, y: rect.top }
            });
        }
    }, []);

    const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
        const relationship = relationships?.find(r =>
            (r.fromPersonId === edge.source && r.toPersonId === edge.target) ||
            (r.fromPersonId === edge.target && r.toPersonId === edge.source)
        );
        if (relationship) {
            setEditingRelationship(relationship);
        }
    }, [relationships]);

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

    return (
        <ReactFlowProvider>
            <div className="relative w-full h-screen bg-gray-900">
                <Dashboard />

                <TreeControls
                    people={people}
                    relationships={relationships}
                    onLayoutChange={() => setDirection(d => d === 'TB' ? 'LR' : 'TB')}
                    layoutDirection={direction}
                    onFindRelationship={() => setShowRelationshipFinder(true)}
                    onFilterChange={setFilters}
                    onRefreshLayout={() => {
                        if (people && relationships) {
                            setNodes([]);
                            setTimeout(() => {
                                // Trigger re-layout
                            }, 10);
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
                    <Controls />
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
        </ReactFlowProvider>
    );
}
