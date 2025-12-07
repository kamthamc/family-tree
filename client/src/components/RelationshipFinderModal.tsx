import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, UserCircle, UserCircle2, HelpCircle } from 'lucide-react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType, type Node, type Edge } from '@xyflow/react';
import dagre from 'dagre';
import { type Person, type Relationship } from '../api';
import { findRelationshipPath, describeRelationship } from '../utils/relationshipFinder';
import SearchablePersonSelect from './SearchablePersonSelect';
import '@xyflow/react/dist/style.css';

interface RelationshipFinderModalProps {
    people: Person[];
    relationships: Relationship[];
    onClose: () => void;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 150;
const nodeHeight = 60;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    dagreGraph.setGraph({ rankdir: 'LR' }); // Left to Right for path view

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
    });

    return { nodes, edges };
};

export default function RelationshipFinderModal({ people, relationships, onClose }: RelationshipFinderModalProps) {
    const [personA, setPersonA] = useState<string>('');
    const [personB, setPersonB] = useState<string>('');

    // ReactFlow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [foundRelationship, setFoundRelationship] = useState<string | null>(null);

    const pathData = useMemo(() => {
        if (!personA || !personB || personA === personB) return null;
        // The utility now handles adding the start person to the path
        return findRelationshipPath(personA, personB, people, relationships);
    }, [personA, personB, people, relationships]);

    useEffect(() => {
        if (pathData) {
            // Get text description
            const description = describeRelationship(pathData, people);
            setFoundRelationship(description);

            // Build Graph
            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            const personMap = new Map(people.map(p => [p.id, p]));

            pathData.forEach((step, index) => {
                const p = personMap.get(step.personId);
                if (!p) return;

                // Determine icon based on gender
                const GenderIcon = p.gender === 'male' ? UserCircle : (p.gender === 'female' ? UserCircle2 : HelpCircle);
                const iconColor = p.gender === 'male' ? '#60a5fa' : (p.gender === 'female' ? '#ec4899' : '#9ca3af');

                newNodes.push({
                    id: step.personId,
                    data: {
                        label: (
                            <div className="flex items-center gap-2">
                                <GenderIcon size={20} color={iconColor} />
                                <span>{p.firstName} {p.lastName}</span>
                            </div>
                        )
                    },
                    position: { x: 0, y: 0 },
                    style: {
                        background: '#1f2937',
                        color: 'white',
                        border: '1px solid #4b5563',
                        borderRadius: '8px',
                        padding: '10px',
                        width: nodeWidth,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    },
                });

                if (index > 0) {
                    const prevStep = pathData[index - 1];
                    const relType = step.relType;

                    let emoji = '';
                    let label = relType as string;

                    if (relType === 'spouse') {
                        label = 'Spouse';
                        emoji = '💍';
                    } else if (relType === 'parent') {
                        label = 'Parent';
                        emoji = '👨‍👩‍👧';
                    } else if (relType === 'child') {
                        label = 'Child';
                        emoji = '👶';
                    } else if (relType === 'sibling') {
                        label = 'Sibling';
                        emoji = '🤝';
                    }

                    const displayLabel = `${emoji} ${label}`;

                    newEdges.push({
                        id: `e-${prevStep.personId}-${step.personId}`,
                        source: prevStep.personId,
                        target: step.personId,
                        label: displayLabel,
                        type: 'smoothstep',
                        style: { stroke: '#60a5fa', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' },
                        labelStyle: { fill: '#9ca3af', fontWeight: 600, fontSize: 12 }
                    });
                }
            });

            const layout = getLayoutedElements(newNodes, newEdges);
            setNodes(layout.nodes);
            setEdges(layout.edges);

        } else {
            setNodes([]);
            setEdges([]);
            setFoundRelationship(null);
        }
    }, [pathData, setNodes, setEdges, people]);


    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl p-6 flex flex-col h-[80vh]"
            >
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Search className="text-blue-400" /> Relationship Finder
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="flex gap-4 mb-6">
                    <div className="flex-1">
                        <SearchablePersonSelect
                            people={people}
                            value={personA}
                            onChange={setPersonA}
                            label="Person A"
                            placeholder="Select first person..."
                        />
                    </div>
                    <div className="flex-1">
                        <SearchablePersonSelect
                            people={people}
                            value={personB}
                            onChange={setPersonB}
                            label="Person B"
                            placeholder="Select second person..."
                        />
                    </div>
                </div>

                <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 relative overflow-hidden">
                    {!personA || !personB ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 italic">
                            Select two people to see their relationship.
                        </div>
                    ) : pathData ? (
                        <>
                            <div className="absolute top-4 left-4 z-10 bg-gray-800/80 p-2 rounded border border-gray-600 backdrop-blur-sm">
                                <span className="text-gray-400 text-sm">Relationship: </span>
                                <span className="text-white font-bold">{foundRelationship}</span>
                            </div>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                fitView
                            >
                                <Background color="#374151" gap={20} />
                                <Controls />
                            </ReactFlow>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-red-400">
                            No relationship path found.
                        </div>
                    )}
                </div>

            </motion.div>
        </div>
    );
}
