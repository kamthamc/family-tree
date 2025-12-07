import { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type NodeChange,
    applyNodeChanges,
    type OnNodeDrag,
    Background,
    Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useQuery } from '@tanstack/react-query';
import { api, type Relationship, type Person } from '../../api';

// Custom Components
import ReferencePersonNode from './ReferencePersonNode';
import UnionNode from './UnionNode'; // Keeping existing union logic
import SmartStepEdge from './SmartStepEdge';
// import PartnershipBackground from './PartnershipBackground';
import Dashboard from '../Dashboard/Dashboard';
import TreeControls, { type FilterState } from './TreeControls';
import EditPersonModal from '../EditPersonModal';
import PersonQuickView from '../PersonQuickView';
import { ReactFlowProvider } from '@xyflow/react';
import RelationshipFinderModal from '../RelationshipFinderModal';

import CoupleGroupNode from './CoupleGroupNode';

// Node/Edge Types
const nodeTypes = {
    person: ReferencePersonNode,
    union: UnionNode,
    group: CoupleGroupNode,
};

const edgeTypes = {
    step: SmartStepEdge,
    straight: SmartStepEdge,
};

const nodeWidth = 240;
const nodeHeight = 80;
const unionNodeSize = 20;
const coupleGap = 60; // Gap between partners inside the group
const groupPadding = 50; // Increased padding


// ------------ LAYOUT LOGIC ------------

function calculateGenerationDepth(people: Person[], relationships: Relationship[]) {
    const depthMap = new Map<string, number>();
    const childToParents = new Map<string, string[]>();

    relationships.filter(r => r.type === 'parent').forEach(rel => {
        if (!childToParents.has(rel.toPersonId)) {
            childToParents.set(rel.toPersonId, []);
        }
        childToParents.get(rel.toPersonId)!.push(rel.fromPersonId);
    });

    // Find roots (people with no parents in the tree)
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

// Layout nodes using dagre
// NOW: We layout "Layout Items" which can be a single person OR a Couple Group.
function layoutNodes(nodes: Node[], edges: Edge[]) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // TB = Top to Bottom
    dagreGraph.setGraph({
        rankdir: 'TB',
        ranksep: 120,
        nodesep: 50,
        edgesep: 20,
        marginx: 50,
        marginy: 50
    });

    const rootNodes = nodes.filter(n => !n.parentId);

    rootNodes.forEach((node) => {
        // If it's a group, use its stored dimensions (calculated during creation)
        // If it's a single person, use standard dimensions
        let width = nodeWidth;
        let height = nodeHeight;

        if (node.type === 'group') {
            width = (node.measured?.width ?? (nodeWidth * 2 + coupleGap + 40)); // padding
            height = (node.measured?.height ?? (nodeHeight + 40));
        }

        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        // Only layout edges that connect Root Nodes (groups or singles)
        // If an edge connects to/from a node inside a group, we should effectively connect to the group for layout purposes?
        // OR: Dagre doesn't handle hierarchical nodes natively well for edges entering strictly.
        // Simplified strategy: Map internal Node IDs to their Parent Group ID for the layout graph.

        const findLayoutId = (id: string) => {
            const n = nodes.find(x => x.id === id);
            return n?.parentId ? n.parentId : id;
        };

        const u = findLayoutId(edge.source);
        const v = findLayoutId(edge.target);

        if (u !== v) {
            dagreGraph.setEdge(u, v, { minlen: 1 });
        }
    });

    dagre.layout(dagreGraph);

    // Apply positions
    const layoutedNodes = nodes.map((node) => {
        if (node.parentId) return node; // Skip internal nodes, they are relative

        const pos = dagreGraph.node(node.id);
        if (!pos) return node;

        // Center based on dagre pos
        // For groups, specific width. For singles, nodeWidth
        let width = nodeWidth;
        let height = nodeHeight;

        if (node.type === 'group') {
            width = (node.measured?.width ?? (nodeWidth * 2 + coupleGap + 40));
            height = (node.measured?.height ?? (nodeHeight + 40));
        }

        return {
            ...node,
            position: {
                x: pos.x - width / 2,
                y: pos.y - height / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
}

// ------------ MAIN COMPONENT ------------

export default function NewFamilyTree() {
    // Data Query
    const { data: people } = useQuery({ queryKey: ['people'], queryFn: api.getPeople });
    const { data: relationships } = useQuery({ queryKey: ['relationships'], queryFn: api.getRelationships });

    // React Flow State
    const [nodes, setNodes] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [filters, setFilters] = useState<FilterState>({
        labels: [],
        status: 'all',
        yearRange: { start: null, end: null },
    });

    // --- Persistence Logic ---
    // Load saved positions from localStorage on mount
    const [savedPositions, setSavedPositions] = useState<Record<string, { x: number, y: number }>>({});

    // Modals State
    // Modals State
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [clickPosition, setClickPosition] = useState<{ x: number, y: number } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showFinder, setShowFinder] = useState(false);


    useEffect(() => {
        const saved = localStorage.getItem('familyTreePositions');
        if (saved) {
            try {
                setSavedPositions(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved positions", e);
            }
        }
    }, []);

    // Dynamic Group Resizing
    const onNodeDrag: OnNodeDrag = useCallback((_event, node) => {
        if (!node.parentId) return;

        setNodes((nds) => {
            const parentNode = nds.find(n => n.id === node.parentId);
            if (!parentNode) return nds;

            // Get all siblings including the dragged node
            // Note: 'node' passed to onNodeDrag has the NEW position.
            // We must use 'node' for the dragged item, and 's' from state for others.
            const siblings = nds.filter(s => s.parentId === node.parentId && s.id !== node.id);
            const allChildren = [...siblings, node];

            // Calculate Bounding Box relative to Parent's CURRENT Origin (0,0 of the group content)
            // Note: React Flow child positions are relative to Parent.
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            allChildren.forEach(child => {
                const childW = child.measured?.width ?? nodeWidth;
                const childH = child.measured?.height ?? nodeHeight;
                const x = child.position.x;
                const y = child.position.y;

                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + childW > maxX) maxX = x + childW;
                if (y + childH > maxY) maxY = y + childH;
            });

            const padding = 50;

            // If bounds are growing outwards (standard right/bottom expansion)
            // Or if bounds are negative (left/top expansion), we need to adjust parent pos.

            let newParentX = parentNode.position.x;
            let newParentY = parentNode.position.y;
            let shiftChildrenX = 0;
            let shiftChildrenY = 0;

            // Check Left Expansion
            if (minX < padding) {
                // If content is too close to left or negative
                // We need to shift parent Left calculate delta
                // We want minX to be 'padding'. 
                const delta = padding - minX;
                // If minX is 10, padding 50. delta = 40. Shift parent Left by 40. Shift Children Right by 40.
                // If minX is -10 (dragged out). delta = 60. Shift parent Left 60. Shift Children Right 60.
                // Only shift if delta > 0 (expanding check? or just correcting?)
                // Let's allow expanding. 

                // However, we only trigger this if it actually CHANGED boundaries significant enough?
                // Continuous updates might be jittery. But React Flow handles direct updates well.

                if (delta > 0) {
                    newParentX -= delta;
                    shiftChildrenX += delta;
                }
            }

            // Check Top Expansion
            if (minY < padding) {
                const delta = padding - minY;
                if (delta > 0) {
                    newParentY -= delta;
                    shiftChildrenY += delta;
                }
            }

            // Recalculate Width/Height after potential shift
            // If we shift children X by +delta, their new maxX increases by +delta.
            // newWidth = (maxX + shiftChildrenX) + padding
            const newWidth = (maxX + shiftChildrenX) + padding;
            const newHeight = (maxY + shiftChildrenY) + padding;


            // Apply Changes
            return nds.map((n) => {
                if (n.id === parentNode.id) {
                    return {
                        ...n,
                        position: { x: newParentX, y: newParentY },
                        style: {
                            ...n.style,
                            width: newWidth,
                            height: newHeight,
                        }
                    };
                }
                if (n.parentId === parentNode.id) {
                    // Shift children if needed
                    if (shiftChildrenX === 0 && shiftChildrenY === 0) return n;

                    // Note: 'node' (dragged one) is also in 'nds', but we can't easily modify the 'node' object passed in event?
                    // actually onNodeDrag updates state. The 'node' arg is just the snapshot.
                    // Important: if n.id === node.id (the dragged node), React Flow is essentially handling its pos.
                    // If we programmatically shift it, it might conflict with the mouse drag?
                    // YES. Shifting the dragged node while dragging is bad UX/laggy.
                    // BUT relative position MUST change if parent moves, otherwise visual world pos changes.

                    // If we move Parent LEFT, and don't change Child Rel X, Child moves LEFT in World.
                    // To keep Child in same World Pos (Mouse Pos), Child Rel X must increase.

                    const isDraggedNode = n.id === node.id;
                    // For the dragged node, we update 'position' in the state. 
                    // React Flow's 'applyNodeChanges' usually handles this. 
                    // But here we are overriding state manually.

                    let cx = n.position.x;
                    let cy = n.position.y;

                    if (isDraggedNode) {
                        // Use the latest pos from event as base?
                        // actually 'node' has the latest pos. 'n' is old state.
                        cx = node.position.x;
                        cy = node.position.y;
                    }

                    return {
                        ...n,
                        position: {
                            x: cx + shiftChildrenX,
                            y: cy + shiftChildrenY
                        }
                    };
                }
                return n;
            });
        });
    }, [setNodes]);

    const onNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
        const newPositions = { ...savedPositions, [node.id]: node.position };
        setSavedPositions(newPositions);
        localStorage.setItem('familyTreePositions', JSON.stringify(newPositions));
    }, [savedPositions]);

    // Graph Construction
    useEffect(() => {
        if (!people || !relationships) return;

        // --- 1. Filter People ---
        let filteredPeople = people;
        if (filters.status !== 'all') {
            filteredPeople = filteredPeople.filter(p => {
                if (filters.status === 'living') return !p.deathDate;
                if (filters.status === 'deceased') return !!p.deathDate;
                return true;
            });
        }
        if (filters.yearRange.start || filters.yearRange.end) {
            filteredPeople = filteredPeople.filter(p => {
                if (!p.birthDate) return false;
                const year = new Date(p.birthDate).getFullYear();
                if (filters.yearRange.start && year < filters.yearRange.start) return false;
                if (filters.yearRange.end && year > filters.yearRange.end) return false;
                return true;
            });
        }

        const depthMap = calculateGenerationDepth(people, relationships);
        const generatedNodes: Node[] = [];
        const generatedEdges: Edge[] = [];

        // --- 3. Generate Union Nodes & Couple Groups ---
        // Strategy: If a person has a spouse, we potentially create a GROUP for them.
        // We need to track who has been "grouped" so we don't duplicate.

        const processedPeople = new Set<string>();
        const spouseRelationships = relationships.filter(r => r.type === 'spouse' || r.type === 'divorced');

        // --- PRE-CALCULATION: childrenMap ---
        // We need this for Single Parent detection
        const childrenMap: Record<string, string[]> = {};
        relationships.filter(r => r.type === 'parent').forEach(rel => {
            if (!childrenMap[rel.toPersonId]) childrenMap[rel.toPersonId] = [];
            childrenMap[rel.toPersonId].push(rel.fromPersonId);
        });

        // Helper to find spouse
        const getSpouseId = (pId: string) => {
            // simplified: finding first spouse relationship
            const rel = spouseRelationships.find(r => r.fromPersonId === pId || r.toPersonId === pId);
            if (!rel) return null;
            return rel.fromPersonId === pId ? rel.toPersonId : rel.fromPersonId;
        };

        // First pass: Identify "Couples" and generate Groups
        filteredPeople.forEach(person => {
            if (processedPeople.has(person.id)) return;

            const spouseId = getSpouseId(person.id);
            if (spouseId && filteredPeople.some(p => p.id === spouseId)) {
                // We have a couple both in the filtered list
                // Create a GROUP
                const p1 = person;
                const p2 = filteredPeople.find(p => p.id === spouseId)!;

                // Deterministic ID
                const [id1, id2] = [p1.id, p2.id].sort();
                const groupId = `group-${id1}-${id2}`;

                // Mark processed
                processedPeople.add(p1.id);
                processedPeople.add(p2.id);

                // Create Parent Group Node
                const p1Depth = depthMap.get(p1.id) ?? 0;

                // Group width calculation: 2 cards + gap + padding
                const grpWidth = (nodeWidth * 2) + coupleGap + (groupPadding * 2);
                const grpHeight = nodeHeight + (groupPadding * 2);

                // Calculate Year Range for the Couple
                const getYear = (dateStr?: string) => dateStr ? new Date(dateStr).getFullYear() : null;
                const p1Birth = getYear(p1.birthDate ?? undefined);
                const p1Death = getYear(p1.deathDate ?? undefined);
                const p2Birth = getYear(p2.birthDate ?? undefined);
                const p2Death = getYear(p2.deathDate ?? undefined);

                let startYear = p1Birth;
                if (p2Birth && (startYear === null || p2Birth < startYear)) startYear = p2Birth;

                let endYear: number | string = 'Present';
                // If BOTH are deceased, end year is the max death year
                if (p1.deathDate && p2.deathDate) {
                    const d1 = p1Death || 0;
                    const d2 = p2Death || 0;
                    endYear = Math.max(d1, d2);
                } else if (!p1.birthDate && !p2.birthDate) {
                    // No dates at all
                    endYear = '';
                }

                const yearRangeString = startYear ? `${startYear} - ${endYear}` : '';

                generatedNodes.push({
                    id: groupId,
                    type: 'group',
                    data: { generationDepth: p1Depth, yearRange: yearRangeString },
                    position: { x: 0, y: 0 }, // Will be set by layout
                    style: { width: grpWidth, height: grpHeight },
                    measured: { width: grpWidth, height: grpHeight } // Pre-measure for dagre
                });

                // Add Person 1 (Left within group)
                generatedNodes.push({
                    id: p1.id,
                    type: 'person',
                    data: { person: p1, generationDepth: p1Depth },
                    position: { x: groupPadding, y: groupPadding },
                    parentId: groupId,
                    // extent: 'parent', // REMOVED constraint
                });

                // Add Person 2 (Right within group)
                generatedNodes.push({
                    id: p2.id,
                    type: 'person',
                    data: { person: p2, generationDepth: p1Depth },
                    position: { x: groupPadding + nodeWidth + coupleGap, y: groupPadding },
                    parentId: groupId,
                    // extent: 'parent', // REMOVED constraint
                });

                // Add Union Node (Center within group)
                const unionId = `union-${id1}-${id2}`;
                generatedNodes.push({
                    id: unionId,
                    type: 'union',
                    data: { label: '💍' }, // Ring emoji
                    position: {
                        x: groupPadding + nodeWidth + (coupleGap / 2) - (unionNodeSize / 2),
                        y: groupPadding + (nodeHeight / 2) - (unionNodeSize / 2)
                    },
                    parentId: groupId,
                    style: { zIndex: 10 }, // Ensure visible on top of lines
                    // extent: 'parent',
                });

                // Add Edges INSIDE Group (Static handles)
                // Left Person (Right Side) -> Union (Left Side)
                generatedEdges.push({
                    id: `e-${p1.id}-${unionId}`,
                    source: p1.id,
                    target: unionId,
                    type: 'straight',
                    sourceHandle: 'right-source',
                    targetHandle: 'left-target',
                    style: { stroke: '#94a3b8', strokeWidth: 2 }
                });

                // Right Person (Left Side) -> Union (Right Side)
                generatedEdges.push({
                    id: `e-${p2.id}-${unionId}`,
                    source: p2.id,
                    target: unionId,
                    type: 'straight',
                    sourceHandle: 'left-source',
                    targetHandle: 'right-target',
                    style: { stroke: '#94a3b8', strokeWidth: 2 }
                });

            } else {
                // Check if this person is a Single Parent (has children but no spouse link found above)
                // We want to force them into a group structure too, to ensure children connect correctly.
                // Or maybe they HAVE a spouse relationship but the spouse is filtered out? 
                // The current logic only grouped if BOTH were present.

                // Let's broaden the group logic:
                // If they have children, OR if they have a spouse (even if filtered out/missing), we might want a group?
                // For now, let's specifically target the "Single Parent" case requested by user.

                // We know they are not part of a "Complete Couple" group (checked above).

                // Let's check if they are a parent.
                // We check if this person ID appears as a parent in ANY entry of childrenMap values.
                // childrenMap keys are Children IDs. Values are [ParentID1, ParentID2].
                // So to check if 'person.id' is a parent, we scan values.
                const hasChildren = Object.values(childrenMap).some(parentIds => parentIds.includes(person.id));

                if (hasChildren) {
                    // Create a Single Parent Group with a Placeholder
                    processedPeople.add(person.id);

                    const groupId = `group-single-${person.id}`;
                    const pDepth = depthMap.get(person.id) ?? 0;

                    // Group Dimensions
                    const grpWidth = (nodeWidth * 2) + coupleGap + (groupPadding * 2);
                    const grpHeight = nodeHeight + (groupPadding * 2);

                    generatedNodes.push({
                        id: groupId,
                        type: 'group',
                        data: { generationDepth: pDepth },
                        position: { x: 0, y: 0 },
                        style: { width: grpWidth, height: grpHeight },
                        measured: { width: grpWidth, height: grpHeight }
                    });

                    // Add Person (Left)
                    generatedNodes.push({
                        id: person.id,
                        type: 'person',
                        data: { person, generationDepth: pDepth },
                        position: { x: groupPadding, y: groupPadding },
                        parentId: groupId,
                    });

                    // Add Placeholder (Right)
                    const placeholderId = `placeholder-${person.id}`;
                    generatedNodes.push({
                        id: placeholderId,
                        type: 'person', // Use person type but with placeholder data? Or just standard looking empty card.
                        data: { label: 'Unknown Partner', isPlaceholder: true },
                        // We need to handle 'isPlaceholder' in ReferencePersonNode or create a new type. 
                        // For now, let's use a dummy person object or handle it in the Node Component.
                        position: { x: groupPadding + nodeWidth + coupleGap, y: groupPadding },
                        parentId: groupId,
                        style: { opacity: 0.5, borderStyle: 'dashed' },
                        draggable: false,
                    });

                    // Add Union Node (Center)
                    const unionId = `union-single-${person.id}`;
                    generatedNodes.push({
                        id: unionId,
                        type: 'union',
                        data: { label: '?' },
                        position: {
                            x: groupPadding + nodeWidth + (coupleGap / 2) - (unionNodeSize / 2),
                            y: groupPadding + (nodeHeight / 2) - (unionNodeSize / 2)
                        },
                        parentId: groupId,
                        style: { zIndex: 10 },
                    });

                    // Edge: Person -> Union
                    generatedEdges.push({
                        id: `e-${person.id}-${unionId}`,
                        source: person.id,
                        target: unionId,
                        type: 'straight',
                        sourceHandle: 'right-source',
                        targetHandle: 'left-target',
                        style: { stroke: '#94a3b8', strokeWidth: 2 }
                    });

                    // Edge: Placeholder -> Union 
                    generatedEdges.push({
                        id: `e-${placeholderId}-${unionId}`,
                        source: placeholderId,
                        target: unionId,
                        type: 'straight',
                        sourceHandle: 'left-source',
                        targetHandle: 'right-target',
                        style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5 5' }
                    });
                } else {
                    // Truly single person
                    generatedNodes.push({
                        id: person.id,
                        type: 'person',
                        data: { person, generationDepth: depthMap.get(person.id) ?? 0 },
                        position: { x: 0, y: 0 },
                    });
                    processedPeople.add(person.id);
                }
            }
        });


        // --- 4. Generate Parent-Child Edges ---
        // Connect Union Node -> Child Node
        // childrenMap already calculated above

        Object.keys(childrenMap).forEach(childId => {
            const parents = childrenMap[childId];
            if (parents.length === 2) {
                const pairId = parents.sort().join('-');
                const unionId = `union-${pairId}`;

                if (generatedNodes.find(n => n.id === unionId)) {
                    // Find parent generation for edge coloring
                    const parentId = parents[0];
                    const parentDepth = depthMap.get(parentId) ?? 0;

                    generatedEdges.push({
                        id: `e-${unionId}-${childId}`,
                        source: unionId,
                        target: childId,
                        type: 'step', // Orthogonal edge
                        data: { generationDepth: parentDepth } // Use parent's generation color
                    });
                }
            } else if (parents.length === 1) {
                // Single Parent Case
                const parentId = parents[0];
                const unionId = `union-single-${parentId}`;
                const parentDepth = depthMap.get(parentId) ?? 0;

                // Check if we have a Single Parent Group (Union Node)
                if (generatedNodes.find(n => n.id === unionId)) {
                    generatedEdges.push({
                        id: `e-${unionId}-${childId}`,
                        source: unionId,
                        target: childId,
                        type: 'step',
                        data: { generationDepth: parentDepth }
                    });
                } else {
                    // Fallback: Connect directly from Parent to Child if no group exists
                    // This handles cases where grouping logic might have been skipped or filtered stats
                    generatedEdges.push({
                        id: `e-${parentId}-${childId}`,
                        source: parentId,
                        target: childId,
                        type: 'step',
                        data: { generationDepth: parentDepth }
                    });
                }
            }
        });

        // --- 5. Run Layout (Auto) ---
        const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodes(generatedNodes, generatedEdges);

        // setSpousePairs(pairs); // Deprecated


        // --- 6. Apply Saved Positions (Manual Override) ---
        const finalNodes = layoutedNodes.map(node => {
            if (savedPositions[node.id]) {
                return { ...node, position: savedPositions[node.id] };
            }
            return node;
        });

        setNodes(finalNodes);
        setEdges(layoutedEdges);

    }, [people, relationships, filters]); // Re-run if data/filters change (will reset layout if new nodes appear, but persistence is keyed by ID)

    // Handle normal node drag changes (xyflow requirement)
    const onNodesChangeHandler = useCallback((changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
    }, [setNodes]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (node.type === 'person' && node.data.person) {
            setSelectedPerson(node.data.person as Person);
            setClickPosition({ x: event.clientX, y: event.clientY });
        }
    }, []);

    return (
        <div className="w-full h-screen bg-slate-950"> {/* Dark background */}
            <ReactFlowProvider>
                <Dashboard people={people} />

                <TreeControls
                    people={people}
                    relationships={relationships}
                    onLayoutChange={() => {/* Only 1 layout for now */ }}
                    layoutDirection={'TB'}
                    onFindRelationship={() => setShowFinder(true)}
                    onFilterChange={setFilters}
                    onRefreshLayout={() => {
                        if (confirm('Reset custom layout?')) {
                            setSavedPositions({});
                            localStorage.removeItem('familyTreePositions');
                            window.location.reload();
                        }
                    }}
                />

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChangeHandler}
                    onEdgesChange={onEdgesChange}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    minZoom={0.1}
                    maxZoom={4}
                >
                    <Background color="#334155" gap={20} />
                    <Controls
                        className="bg-slate-800 border-slate-700 shadow-lg [&>button]:fill-slate-100 [&>button]:text-slate-100 [&>button:hover]:bg-slate-700"
                    />
                </ReactFlow>

                {/* Modals */}
                {selectedPerson && clickPosition && (
                    <PersonQuickView
                        person={selectedPerson}
                        position={clickPosition}
                        onClose={() => setSelectedPerson(null)}
                        onEdit={() => setIsEditModalOpen(true)}
                    />
                )}

                {selectedPerson && isEditModalOpen && (
                    <EditPersonModal
                        person={selectedPerson}
                        onClose={() => setIsEditModalOpen(false)}
                    />
                )}

                {showFinder && (
                    <RelationshipFinderModal
                        people={people || []}
                        relationships={relationships || []}
                        onClose={() => setShowFinder(false)}
                    />
                )}
            </ReactFlowProvider>
        </div>
    );
}
